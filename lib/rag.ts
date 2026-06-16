import "server-only";

import path from "node:path";
import { access, readFile } from "node:fs/promises";
import { Document } from "@langchain/core/documents";
import { LocalEmbeddings } from "@/lib/local-embeddings";

type StoredDocument = {
  pageContent: string;
  metadata: Record<string, unknown>;
  embedding: number[];
};

let storePromise: Promise<StoredDocument[]> | null = null;

function similarity(left: number[], right: number[]) {
  let score = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    score += left[index] * right[index];
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
  const [store, queryEmbedding] = await Promise.all([
    storePromise,
    new LocalEmbeddings().embedQuery(question),
  ]);
  const documents = store
    .map((document) => ({
      document,
      score: similarity(queryEmbedding, document.embedding),
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
