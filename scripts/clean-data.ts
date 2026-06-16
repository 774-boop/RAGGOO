import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

type CsvRow = Record<string, string>;
type JsonRow = Record<string, unknown>;

const root = process.cwd();
const outputDirectory = path.join(root, "data", "processed");
const conditionDirectories = [
  "sep2022",
  "oct2022",
  "nov2022",
  "dec2022",
  "jan2023",
  "feb2023",
];

function cleanText(value: unknown, fallback = "Unknown") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function cleanNumber(value: unknown) {
  const number = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(number) ? number : null;
}

function normalizeCondition(value: unknown) {
  return cleanText(value)
    .replace(/^is_/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferItemType(categoryPath: string, title: string) {
  const pathParts = categoryPath.split(".").filter(Boolean);
  if (pathParts.length > 1) {
    return pathParts.at(-1)!.replaceAll("_", " ");
  }

  const knownTypes = [
    "jacket",
    "hoodie",
    "coat",
    "jeans",
    "pants",
    "shirt",
    "sweater",
    "shorts",
    "dress",
    "skirt",
    "shoes",
    "sneakers",
    "bag",
  ];
  const lowerTitle = title.toLowerCase();
  return knownTypes.find((type) => lowerTitle.includes(type)) ?? "clothing";
}

function toProjectPath(filename: string) {
  return path.relative(root, filename).replaceAll("\\", "/");
}

async function fileExists(filename: string) {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
}

async function findLabelFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findLabelFiles(entryPath);
      return entry.isFile() && /^labels_.*\.json$/i.test(entry.name)
        ? [entryPath]
        : [];
    }),
  );
  return nested.flat();
}

async function readCsv(filename: string): Promise<CsvRow[]> {
  const content = await readFile(path.join(root, filename), "utf8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });
}

async function writeCsv(filename: string, rows: Record<string, unknown>[]) {
  const content = stringify(rows, { header: true });
  await writeFile(path.join(outputDirectory, filename), content, "utf8");
  console.log(`Wrote ${rows.length} rows to data/processed/${filename}`);
}

async function cleanConditionRows() {
  const files = (
    await Promise.all(
      conditionDirectories.map((directory) =>
        findLabelFiles(path.join(root, directory)),
      ),
    )
  ).flat();

  const rows: Record<string, unknown>[] = [];
  let malformed = 0;
  for (const filename of files) {
    try {
      const row = JSON.parse(await readFile(filename, "utf8")) as JsonRow;
      const timestamp = path.basename(filename).replace(/^labels_/, "").replace(/\.json$/i, "");
      const directory = path.dirname(filename);
      const frontPath = path.join(directory, `front_${timestamp}.jpg`);
      const backPath = path.join(directory, `back_${timestamp}.jpg`);
      const brandPath = path.join(directory, `brand_${timestamp}.jpg`);

      rows.push({
        condition: cleanText(row.condition),
        pilling: cleanText(row.pilling),
        stains: cleanText(row.stains, "None"),
        holes: cleanText(row.holes, "None"),
        damage: cleanText(row.damage, "None"),
        material: cleanText(row.material),
        price_range: cleanText(row.price),
        brand: cleanText(row.brand),
        item_type: cleanText(row.type),
        category: cleanText(row.category),
        season: cleanText(row.season),
        usage: cleanText(row.usage),
        label_path: toProjectPath(filename),
        front_image_path: (await fileExists(frontPath)) ? toProjectPath(frontPath) : "",
        back_image_path: (await fileExists(backPath)) ? toProjectPath(backPath) : "",
        brand_image_path: (await fileExists(brandPath)) ? toProjectPath(brandPath) : "",
        source: "Clothing Condition Dataset",
      });
    } catch {
      malformed += 1;
    }
  }

  console.log(`Skipped ${malformed} malformed condition label files.`);
  return rows;
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });

  const resaleRows = (await readCsv("updated_dataset.csv"))
    .map((row) => {
      const description = cleanText(row.title);
      const categoryPath = cleanText(row.category_path, "");
      const sourceImagePath = row.image_path.trim();
      const imagePath = sourceImagePath
        ? path.join(root, "bottoms", "bottoms", sourceImagePath)
        : "";
      return {
        brand: cleanText(row.brand),
        item_type: inferItemType(categoryPath, description),
        category: cleanText(row.category),
        condition: normalizeCondition(row.condition),
        resale_price: cleanNumber(row.price),
        description,
        image_path: imagePath ? toProjectPath(imagePath) : "",
        image_exists: "false",
        source: "Resale Dataset",
      };
    })
    .filter((row) => row.resale_price !== null);

  await Promise.all(
    resaleRows.map(async (row) => {
      row.image_exists = row.image_path
        ? String(await fileExists(path.join(root, row.image_path)))
        : "false";
    }),
  );

  const retailRows = (await readCsv("ssense_dataset.csv"))
    .map((row) => ({
      brand: cleanText(row.brand),
      item_type: cleanText(row.type),
      retail_price: cleanNumber(row.price_usd),
      description: cleanText(row.description),
      source: "SSENSE Retail Reference",
    }))
    .filter((row) => row.retail_price !== null);

  await writeCsv("resale_products.csv", resaleRows);
  await writeCsv("retail_reference.csv", retailRows);
  await writeCsv("condition_guide.csv", await cleanConditionRows());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
