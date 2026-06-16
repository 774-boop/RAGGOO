import "server-only";

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { IndexFlatIP } from "faiss-node";

export type VisualMetadata = {
  brand: string;
  itemType: string;
  category: string;
  condition: string;
  resalePrice: number;
  description: string;
  imagePath: string;
};

export type VisualMatch = VisualMetadata & {
  similarity: number;
};

type ImageFeatureExtractor = (
  inputs: string | Blob | Array<string | Blob>,
  options?: { normalize?: boolean },
) => Promise<{ dims: number[]; tolist(): number[] | number[][] }>;

let extractorPromise: Promise<ImageFeatureExtractor> | null = null;
let indexPromise: Promise<{
  index: IndexFlatIP;
  metadata: VisualMetadata[];
}> | null = null;

function normalizeVector(vector: number[]) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return vector.map((value) => value / Math.max(norm, 1e-12));
}

async function getExtractor() {
  extractorPromise ??= import("@huggingface/transformers").then(
    async ({ pipeline }) => {
      const createPipeline = pipeline as unknown as (
        task: "image-feature-extraction",
        model: string,
      ) => Promise<ImageFeatureExtractor>;
      return createPipeline(
        "image-feature-extraction",
        "Xenova/clip-vit-base-patch32",
      );
    },
  );
  return extractorPromise;
}

async function loadIndex() {
  const directory = path.join(process.cwd(), "visualstore");
  const indexPath = path.join(directory, "visual.index");
  const metadataPath = path.join(directory, "metadata.json");
  await access(indexPath);
  const metadata = JSON.parse(
    await readFile(metadataPath, "utf8"),
  ) as VisualMetadata[];
  return {
    index: IndexFlatIP.read(indexPath),
    metadata,
  };
}

export async function visualIndexExists() {
  try {
    await access(path.join(process.cwd(), "visualstore", "visual.index"));
    return true;
  } catch {
    return false;
  }
}

export async function searchSimilarImages(
  images: Array<{ buffer: Buffer; mimeType: string; view: string }>,
  topK = 5,
): Promise<VisualMatch[]> {
  const searchableImages = images.filter(
    (image) => image.view.toLowerCase() !== "label",
  );
  if (searchableImages.length === 0 || !(await visualIndexExists())) return [];

  indexPromise ??= loadIndex();
  const [{ index, metadata }, extractor] = await Promise.all([
    indexPromise,
    getExtractor(),
  ]);
  const blobs = searchableImages.map(
    (image) =>
      new Blob([Uint8Array.from(image.buffer)], { type: image.mimeType }),
  );
  const output = await extractor(blobs, { normalize: true });
  const vectors = (output.tolist() as number[][]).map(normalizeVector);
  const dimensions = vectors[0]?.length ?? 0;
  if (!dimensions || vectors.some((vector) => vector.length !== dimensions)) {
    throw new Error("Local visual embedding failed.");
  }

  const average = new Array<number>(dimensions).fill(0);
  for (const vector of vectors) {
    for (let index = 0; index < dimensions; index += 1) {
      average[index] += vector[index] / vectors.length;
    }
  }
  const normalized = normalizeVector(average);
  const result = index.search(normalized, Math.min(topK, metadata.length));

  return result.labels
    .map((label, indexPosition) => {
      if (label < 0 || !metadata[label]) return null;
      return {
        ...metadata[label],
        similarity: result.distances[indexPosition],
      };
    })
    .filter((match): match is VisualMatch => match !== null);
}
