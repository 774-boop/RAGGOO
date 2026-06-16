import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export const runtime = "nodejs";

const attributesSchema = z.object({
  brand: z.string().trim().min(1).max(100),
  itemType: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(100),
  color: z.string().trim().min(1).max(100),
  condition: z.string().trim().min(1).max(100),
  conditionSignals: z.array(z.string().max(100)).max(20),
  ocr: z
    .object({
      rawText: z.array(z.string().max(300)).max(30),
      brand: z.string().max(100),
      productCode: z.string().max(100),
      size: z.string().max(100),
      material: z.string().max(300),
      countryOfManufacture: z.string().max(100),
    })
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const feedbackSchema = z.object({
  prediction: attributesSchema,
  correction: attributesSchema.omit({ confidence: true }),
  imageViews: z.array(z.string().max(30)).min(1).max(3),
  quality: z.array(
    z.object({
      view: z.string().max(30),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      brightness: z.number(),
      sharpness: z.number(),
      issues: z.array(z.string().max(100)),
    }),
  ),
  notes: z.string().trim().max(1000).default(""),
});

export async function POST(request: Request) {
  try {
    const feedback = feedbackSchema.parse(await request.json());
    const feedbackDirectory = path.join(process.cwd(), "data", "feedback");
    const filename = path.join(feedbackDirectory, "warehouse-feedback.jsonl");
    const record = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...feedback,
      changedFields: Object.keys(feedback.correction).filter((key) => {
        const predictionValue =
          feedback.prediction[key as keyof typeof feedback.prediction];
        const correctionValue =
          feedback.correction[key as keyof typeof feedback.correction];
        return JSON.stringify(predictionValue) !== JSON.stringify(correctionValue);
      }),
    };

    await mkdir(feedbackDirectory, { recursive: true });
    await appendFile(filename, `${JSON.stringify(record)}\n`, "utf8");
    return Response.json({ saved: true, id: record.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save feedback.";
    return Response.json(
      { error: message },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}
