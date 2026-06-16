import "server-only";

import path from "node:path";
import { access, readFile } from "node:fs/promises";
import { Document } from "@langchain/core/documents";

type StoredDocument = {
  pageContent: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
};

let storePromise: Promise<StoredDocument[]> | null = null;

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "what",
  "with",
]);

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function keywordScore(questionTokens: string[], document: StoredDocument) {
  const content = document.pageContent.toLowerCase();
  const metadata = Object.values(document.metadata).join(" ").toLowerCase();
  let score = 0;

  for (const token of questionTokens) {
    if (metadata.includes(token)) score += 4;
    if (content.includes(token)) score += 1;
  }

  return score;
}

async function loadStore() {
  const vectorDirectory = path.join(process.cwd(), "vectorstore");
  const documentsPath = path.join(vectorDirectory, "documents.json");
  try {
    await access(documentsPath);
  } catch {
    throw new Error(
      "Portable vector documents not found. Run `npm run build:vectors` first.",
    );
  }

  return JSON.parse(await readFile(documentsPath, "utf8")) as StoredDocument[];
}

export async function retrieveContext(question: string, topK = 8) {
  storePromise ??= loadStore();
  const store = await storePromise;
  const questionTokens = tokenize(question);
  const documents = store
    .map((document) => ({
      document,
      score: keywordScore(questionTokens, document),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, topK)
    .map(
      ({ document }) =>
        new Document({
          pageContent: document.pageContent,
          metadata: document.metadata,
        }),
    );

  return {
    documents,
    context: documents
      .map((document, index) => `[Source ${index + 1}]\n${document.pageContent}`)
      .join("\n\n"),
  };
}
