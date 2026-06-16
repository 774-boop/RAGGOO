import { ChatGoogle } from "@langchain/google/node";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { retrieveContext } from "@/lib/rag";
import { analyzeClothingImages, type VisualAnalysis } from "@/lib/vision";
import {
  searchSimilarImages,
  type VisualMatch,
} from "@/lib/visual-search";

export const runtime = "nodejs";
export const maxDuration = 60;

const messageSchema = z.string().trim().min(1).max(2000);
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 8 * 1024 * 1024;

async function parseRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const rawMessage = String(formData.get("message") ?? "").trim();
    const imageValues = [
      ...formData.getAll("images"),
      formData.get("image"),
    ].filter(
      (value): value is File => value instanceof File && value.size > 0,
    );
    const views = formData
      .getAll("views")
      .map(String)
      .filter(Boolean);

    if (!rawMessage && imageValues.length === 0) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["message"],
          message: "Enter a question or attach an image.",
        },
      ]);
    }

    return {
      message: rawMessage || "Identify this item and recommend a resale strategy.",
      images: imageValues.map((image, index) => ({
        image,
        view: views[index] ?? `Image ${index + 1}`,
      })),
    };
  }

  const body = (await request.json()) as { message?: unknown };
  return { message: messageSchema.parse(body.message), images: [] };
}

function validateImage(image: File) {
  if (!allowedImageTypes.has(image.type)) {
    throw new Error("Use a JPEG, PNG, or WebP image.");
  }
  if (image.size > maxImageBytes) {
    throw new Error("Image must be 8 MB or smaller.");
  }
}

function normalizeItemType(itemType: string) {
  const normalized = itemType.toLowerCase();
  if (
    ["cargo pants", "work pants", "trousers", "chinos", "slacks"].some((type) =>
      normalized.includes(type),
    )
  ) {
    return "casual pants";
  }
  if (["jeans", "denim pants"].some((type) => normalized.includes(type))) {
    return "denim";
  }
  if (["overalls", "dungarees"].some((type) => normalized.includes(type))) {
    return "jumpsuits";
  }
  return itemType;
}

function rerankVisualMatches(
  analysis: VisualAnalysis,
  matches: VisualMatch[],
  limit = 5,
) {
  const identifiedBrand =
    analysis.ocr.brand !== "Unknown" ? analysis.ocr.brand : analysis.brand;
  if (identifiedBrand === "Unknown") return matches.slice(0, limit);

  const normalizedBrand = identifiedBrand.toLowerCase();
  const sameBrand = matches.filter(
    (match) => match.brand.toLowerCase() === normalizedBrand,
  );
  return (sameBrand.length > 0 ? sameBrand : matches).slice(0, limit);
}

function visualRetrievalQuery(
  analysis: VisualAnalysis,
  normalizedItemType: string,
  visualMatches: VisualMatch[],
  question: string,
) {
  const visualCandidates = visualMatches
    .slice(0, 3)
    .map(
      (match) =>
        `${match.brand} ${match.itemType} (${Math.round(
          match.similarity * 100,
        )}% visual similarity)`,
    )
    .join("; ");
  return [
    analysis.ocr.brand !== "Unknown"
      ? `OCR brand: ${analysis.ocr.brand}`
      : analysis.brand !== "Unknown"
        ? `Brand: ${analysis.brand}`
        : "",
    `Item type: ${normalizedItemType}`,
    `Category: ${analysis.category}`,
    analysis.condition !== "Unknown" ? `Condition: ${analysis.condition}` : "",
    `Visible condition: ${analysis.conditionSignals.join(", ")}`,
    analysis.ocr.rawText.length > 0
      ? `Readable label text: ${analysis.ocr.rawText.join(" | ")}`
      : "",
    analysis.ocr.productCode !== "Unknown"
      ? `Product code: ${analysis.ocr.productCode}`
      : "",
    visualCandidates ? `Visual neighbor candidates: ${visualCandidates}` : "",
    `User question: ${question}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const parsed = await parseRequest(request);
    const message = messageSchema.parse(parsed.message);
    let visualAnalysis: VisualAnalysis | null = null;
    let visualMatches: VisualMatch[] = [];
    let normalizedItemType: string | null = null;
    let retrievalQuery = message;

    if (parsed.images.length > 0) {
      if (parsed.images.length > 3) {
        throw new Error("Upload no more than three item views.");
      }
      parsed.images.forEach(({ image }) => validateImage(image));
      const imageInputs = await Promise.all(
        parsed.images.map(async ({ image, view }) => {
          const buffer = Buffer.from(await image.arrayBuffer());
          return {
            buffer,
            base64: buffer.toString("base64"),
            mimeType: image.type,
            view,
          };
        }),
      );
      visualAnalysis = await analyzeClothingImages(imageInputs);
      visualMatches = rerankVisualMatches(
        visualAnalysis,
        await searchSimilarImages(imageInputs, 20),
      );
      normalizedItemType = normalizeItemType(visualAnalysis.itemType);
      retrievalQuery = visualRetrievalQuery(
        visualAnalysis,
        normalizedItemType,
        visualMatches,
        message,
      );
    }

    const { context, documents } = await retrieveContext(retrievalQuery);
    const model = new ChatGoogle({
      model: process.env.GEMINI_CHAT_MODEL ?? "gemini-3.1-flash-lite",
      maxRetries: 2,
      temperature: 0.2,
    });

    const response = await model.invoke([
      new SystemMessage(
        [
          "You are a resale intelligence assistant for thrift stores and clothing resellers.",
          "Answer only from the retrieved dataset context.",
          "Visual analysis identifies the item but does not provide market price evidence.",
          "Give pricing ranges and business recommendations only when supported by retrieved data.",
          "Clearly distinguish retail reference prices from resale prices.",
          "Mention sample sizes when available and warn when evidence is limited.",
          "If the dataset does not cover the identified item, say so instead of transferring prices from a different category.",
          "A normalized item type may map a visual synonym to the dataset taxonomy. You may use that evidence, but state the mapping when it affects the recommendation.",
          "Treat image-based condition and brand as estimates, especially when confidence is low.",
          "OCR evidence is stronger than appearance-based brand guessing when the text is clearly readable.",
          "Visual neighbors are similarity candidates, not exact product matches. Use agreement across OCR, visual analysis, neighbors, and text retrieval.",
          "Do not use a visual neighbor's price as the sole pricing basis.",
          "Do not invent brands, prices, condition effects, or market facts.",
          visualAnalysis
            ? `\nVisual analysis:\n${JSON.stringify(visualAnalysis, null, 2)}`
            : "",
          normalizedItemType && normalizedItemType !== visualAnalysis?.itemType
            ? `Dataset item-type mapping: ${visualAnalysis?.itemType} -> ${normalizedItemType}`
            : "",
          visualMatches.length > 0
            ? `\nNearest verified resale images:\n${visualMatches
                .map(
                  (match, index) =>
                    `${index + 1}. ${match.brand} ${match.itemType}, ${match.condition}, listed at $${match.resalePrice}, similarity ${Math.round(match.similarity * 100)}%`,
                )
                .join("\n")}`
            : "",
          `\nRetrieved context:\n${context}`,
        ]
          .filter(Boolean)
          .join("\n"),
      ),
      new HumanMessage(message),
    ]);

    return Response.json({
      answer: response.text,
      visualAnalysis,
      visualMatches,
      normalizedItemType,
      sources: documents.map((document) => document.metadata),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to answer the question.";
    const status = error instanceof z.ZodError ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
