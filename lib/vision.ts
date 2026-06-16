import "server-only";

import { ChatGoogle } from "@langchain/google/node";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";

export const visualAnalysisSchema = z.object({
  brand: z.string().describe("Visible clothing brand, or Unknown"),
  itemType: z.string().describe("Specific item type such as jeans, hoodie, or jacket"),
  category: z.string().describe("Broad category such as bottoms, tops, outerwear, or footwear"),
  color: z.string().describe("Primary visible color"),
  condition: z
    .string()
    .describe("Estimated condition: New, Gently Used, Used, Worn, or Unknown"),
  conditionSignals: z
    .array(z.string())
    .describe("Visible wear such as stains, pilling, holes, fading, or none visible"),
  ocr: z.object({
    rawText: z
      .array(z.string())
      .describe("All clearly readable text from labels, tags, logos, or prints"),
    brand: z.string().describe("Brand read from text, or Unknown"),
    productCode: z.string().describe("Style, article, SKU, or product code, or Unknown"),
    size: z.string().describe("Readable garment size, or Unknown"),
    material: z.string().describe("Readable material composition, or Unknown"),
    countryOfManufacture: z
      .string()
      .describe("Readable country of manufacture, or Unknown"),
  }),
  confidence: z.number().min(0).max(1),
});

export type VisualAnalysis = z.infer<typeof visualAnalysisSchema>;

type ImageInput = {
  base64: string;
  mimeType: string;
  view: string;
};

export async function analyzeClothingImages(
  images: ImageInput[],
): Promise<VisualAnalysis> {
  const model = new ChatGoogle({
    model: process.env.GEMINI_CHAT_MODEL ?? "gemini-3.1-flash-lite",
    maxRetries: 2,
    temperature: 0,
  }).withStructuredOutput(visualAnalysisSchema);

  return model.invoke([
    new SystemMessage(
      [
        "Analyze the clothing item for resale retrieval.",
        "Use only visible evidence from the image.",
        "Do not guess a brand when no readable logo or distinctive evidence is visible; use Unknown.",
        "Condition is only a visual estimate and must be Unknown when the image is insufficient.",
        "Perform OCR on labels, care tags, logos, and printed text.",
        "Copy only text that is genuinely readable. Use Unknown instead of guessing missing OCR fields.",
        "When OCR identifies a brand more reliably than visual appearance, use the OCR brand as the main brand.",
        "Return concise normalized attributes.",
      ].join("\n"),
    ),
    new HumanMessage({
      content: [
        {
          type: "text",
          text: [
            "Identify this clothing item and its visible resale-relevant condition.",
            "The images may show front, back, and brand-label views of the same item.",
            "Use agreement across views. Prefer readable label evidence for brand.",
          ].join("\n"),
        },
        ...images.flatMap((image) => [
          {
            type: "text" as const,
            text: `${image.view} view:`,
          },
          {
            type: "image_url" as const,
            image_url: `data:${image.mimeType};base64,${image.base64}`,
          },
        ]),
      ],
    }),
  ]);
}
