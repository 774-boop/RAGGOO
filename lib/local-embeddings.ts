import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";

type FeatureExtractor = (
  inputs: string | string[],
  options: { pooling: "mean"; normalize: true },
) => Promise<{ tolist(): number[] | number[][] }>;

let extractorPromise: Promise<FeatureExtractor> | null = null;

async function getExtractor() {
  extractorPromise ??= import("@huggingface/transformers").then(
    async ({ pipeline }) => {
      const createPipeline = pipeline as unknown as (
        task: "feature-extraction",
        model: string,
      ) => Promise<FeatureExtractor>;
      return createPipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
      );
    },
  );
  return extractorPromise;
}

export class LocalEmbeddings extends Embeddings {
  constructor(options: EmbeddingsParams = {}) {
    super(options);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    if (documents.length === 0) return [];
    const extractor = await getExtractor();
    const output = await extractor(documents, {
      pooling: "mean",
      normalize: true,
    });
    return output.tolist() as number[][];
  }

  async embedQuery(query: string): Promise<number[]> {
    const extractor = await getExtractor();
    const output = await extractor(query, {
      pooling: "mean",
      normalize: true,
    });
    const vector = output.tolist() as number[] | number[][];
    return Array.isArray(vector[0]) ? (vector[0] as number[]) : (vector as number[]);
  }
}
