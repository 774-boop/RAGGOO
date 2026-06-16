import { access, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { Document } from "@langchain/core/documents";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { parse } from "csv-parse/sync";
import { loadEnvConfig } from "@next/env";
import { LocalEmbeddings } from "../lib/local-embeddings";

type CsvRow = Record<string, string>;

const root = process.cwd();
const processedDirectory = path.join(root, "data", "processed");
const vectorDirectory = path.join(root, "vectorstore");
loadEnvConfig(root);

async function readCsv(filename: string): Promise<CsvRow[]> {
  const content = await readFile(path.join(processedDirectory, filename), "utf8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });
}

function percentile(values: number[], ratio: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(ratio * sorted.length));
  return sorted[index];
}

function createResaleDocuments(rows: CsvRow[]) {
  const groups = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const key = [row.brand, row.item_type, row.category, row.condition].join("|");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.values()].map((group) => {
    const first = group[0];
    const prices = group.map((row) => Number(row.resale_price)).filter(Number.isFinite);
    const low = percentile(prices, 0.25);
    const median = percentile(prices, 0.5);
    const high = percentile(prices, 0.75);
    return new Document({
      pageContent: [
        `Brand: ${first.brand}`,
        `Item Type: ${first.item_type}`,
        `Category: ${first.category}`,
        `Condition: ${first.condition}`,
        `Typical Resale Price: $${low.toFixed(0)}-$${high.toFixed(0)}`,
        `Median Resale Price: $${median.toFixed(0)}`,
        `Listings Analyzed: ${prices.length}`,
        "Source: Resale Dataset",
      ].join("\n"),
      metadata: {
        source: "resale",
        brand: first.brand,
        itemType: first.item_type,
        category: first.category,
        condition: first.condition,
        sampleSize: prices.length,
      },
    });
  });
}

function createRetailDocuments(rows: CsvRow[]) {
  const groups = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const key = [row.brand, row.item_type].join("|");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.values()].map((group) => {
    const first = group[0];
    const prices = group.map((row) => Number(row.retail_price)).filter(Number.isFinite);
    const low = percentile(prices, 0.25);
    const median = percentile(prices, 0.5);
    const high = percentile(prices, 0.75);
    return new Document({
      pageContent: [
        `Brand: ${first.brand}`,
        `Department: ${first.item_type}`,
        `Typical Retail Price: $${low.toFixed(0)}-$${high.toFixed(0)}`,
        `Median Retail Price: $${median.toFixed(0)}`,
        `Products Analyzed: ${prices.length}`,
        `Example Product: ${first.description}`,
        "Source: SSENSE Retail Reference",
      ].join("\n"),
      metadata: {
        source: "retail",
        brand: first.brand,
        itemType: first.item_type,
        sampleSize: prices.length,
      },
    });
  });
}

function createConditionDocuments(rows: CsvRow[]) {
  const groups = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const key = [
      row.item_type,
      row.category,
      row.condition,
      row.pilling,
      row.stains,
      row.holes,
      row.damage,
      row.price_range,
    ].join("|");
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  return [...groups.values()].map((group) => {
    const row = group[0];
    return new Document({
      pageContent: [
        `Item Type: ${row.item_type}`,
        `Category: ${row.category}`,
        `Condition Score: ${row.condition}`,
        `Pilling Score: ${row.pilling}`,
        `Stains: ${row.stains}`,
        `Holes: ${row.holes}`,
        `Damage: ${row.damage}`,
        `Material Example: ${row.material}`,
        `Observed Price Range: ${row.price_range}`,
        `Similar Condition Records: ${group.length}`,
        "Source: Clothing Condition Dataset",
      ].join("\n"),
      metadata: {
        source: "condition",
        itemType: row.item_type,
        category: row.category,
        condition: row.condition,
        sampleSize: group.length,
      },
    });
  });
}

function chunkDocuments(documents: Document[], size: number) {
  const chunks: Document[][] = [];
  for (let index = 0; index < documents.length; index += size) {
    chunks.push(documents.slice(index, index + size));
  }
  return chunks;
}

async function ensureProcessedData() {
  try {
    await access(path.join(processedDirectory, "resale_products.csv"));
  } catch {
    throw new Error("Processed data is missing. Run `npm run clean:data` first.");
  }
}

async function main() {
  await ensureProcessedData();
  const [resaleRows, retailRows, conditionRows] = await Promise.all([
    readCsv("resale_products.csv"),
    readCsv("retail_reference.csv"),
    readCsv("condition_guide.csv"),
  ]);

  const documents = [
    ...createResaleDocuments(resaleRows),
    ...createRetailDocuments(retailRows),
    ...createConditionDocuments(conditionRows),
  ];

  console.log(`Embedding ${documents.length} aggregated documents...`);
  const embeddings = new LocalEmbeddings();
  const batches = chunkDocuments(documents, 100);
  const [firstBatch, ...remainingBatches] = batches;
  const store = await FaissStore.fromDocuments(firstBatch, embeddings);

  console.log(`Embedded batch 1/${batches.length}`);
  for (const [index, batch] of remainingBatches.entries()) {
    await store.addDocuments(batch);
    console.log(`Embedded batch ${index + 2}/${batches.length}`);
  }

  await rm(vectorDirectory, { recursive: true, force: true });
  await mkdir(vectorDirectory, { recursive: true });
  await store.save(vectorDirectory);
  console.log(`Saved FAISS index to ${vectorDirectory}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
