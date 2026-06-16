import { access } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const documentsPath = path.join(
    process.cwd(),
    "vectorstore",
    "documents.json",
  );

  let hasVectorDocuments = true;
  try {
    await access(documentsPath);
  } catch {
    hasVectorDocuments = false;
  }

  return Response.json({
    ok: true,
    hasGoogleApiKey: Boolean(process.env.GOOGLE_API_KEY),
    geminiModel: process.env.GEMINI_CHAT_MODEL ?? "gemini-3.1-flash-lite",
    hasVectorDocuments,
  });
}
