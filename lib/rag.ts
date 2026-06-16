import "server-only";

import path from "node:path";
import { access } from "node:fs/promises";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { LocalEmbeddings } from "@/lib/local-embeddings";

let storePromise: Promise<FaissStore> | null = null;

async function loadStore() {
  const vectorDirectory = path.join(process.cwd(), "vectorstore");
  try {
    await access(path.join(vectorDirectory, "faiss.index"));
  } catch {
    throw new Error("FAISS index not found. Run `npm run build:vectors` first.");
  }

  const embeddings = new LocalEmbeddings();
  return FaissStore.load(vectorDirectory, embeddings);
}

export async function retrieveContext(question: string, topK = 8) {
  storePromise ??= loadStore();
  const store = await storePromise;
  const documents = await store.similaritySearch(question, topK);

  return {
    documents,
    context: documents
      .map((document, index) => `[Source ${index + 1}]\n${document.pageContent}`)
      .join("\n\n"),
  };
}
