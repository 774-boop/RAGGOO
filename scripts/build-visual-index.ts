import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { IndexFlatIP } from "faiss-node";
import type { VisualMetadata } from "../lib/visual-search";

type CsvRow = Record<string, string>;
type ImageFeatureExtractor = (
  inputs: string[],
  options?: { normalize?: boolean },
) => Promise<{ dims: number[]; tolist(): number[][] }>;

const root = process.cwd();
const outputDirectory = path.join(root, "visualstore");
const batchSize = 32;

async function getExtractor() {
  const { pipeline } = await import("@huggingface/transformers");
  const createPipeline = pipeline as unknown as (
    task: "image-feature-extraction",
    model: string,
  ) => Promise<ImageFeatureExtractor>;
  return createPipeline(
    "image-feature-extraction",
    "Xenova/clip-vit-base-patch32",
  );
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function normalizeVector(vector: number[]) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return vector.map((value) => value / Math.max(norm, 1e-12));
}

async function main() {
  const content = await readFile(
    path.join(root, "data", "processed", "resale_products.csv"),
    "utf8",
  );
  const rows = (parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as CsvRow[]).filter((row) => row.image_exists === "true" && row.image_path);

  console.log(`Embedding ${rows.length} resale images with CLIP...`);
  const extractor = await getExtractor();
  let index: IndexFlatIP | null = null;
  const metadata: VisualMetadata[] = [];
  const batches = chunks(rows, batchSize);

  for (const [batchIndex, batch] of batches.entries()) {
    const imagePaths = batch.map((row) => path.join(root, row.image_path));
    const output = await extractor(imagePaths, { normalize: true });
    const vectors = output.tolist().map(normalizeVector);
    const dimensions = vectors[0]?.length ?? 0;
    if (!dimensions || vectors.some((vector) => vector.length !== dimensions)) {
      throw new Error(`Invalid CLIP vectors in batch ${batchIndex + 1}.`);
    }
    index ??= new IndexFlatIP(dimensions);
    index.add(vectors.flat());
    metadata.push(
      ...batch.map((row) => ({
        brand: row.brand,
        itemType: row.item_type,
        category: row.category,
        condition: row.condition,
        resalePrice: Number(row.resale_price),
        description: row.description,
        imagePath: row.image_path,
      })),
    );
    console.log(`Embedded batch ${batchIndex + 1}/${batches.length}`);
  }

  if (!index) throw new Error("No valid resale images were found.");
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  index.write(path.join(outputDirectory, "visual.index"));
  await writeFile(
    path.join(outputDirectory, "metadata.json"),
    JSON.stringify(metadata),
    "utf8",
  );
  console.log(`Saved ${metadata.length} visual records to ${outputDirectory}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
