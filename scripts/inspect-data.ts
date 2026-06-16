import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

type Row = Record<string, unknown>;

const root = process.cwd();
const conditionDirectories = [
  "sep2022",
  "oct2022",
  "nov2022",
  "dec2022",
  "jan2023",
  "feb2023",
];

function isMissing(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

function printSummary(name: string, rows: Row[]) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const missing = Object.fromEntries(
    columns.map((column) => [
      column,
      rows.filter((row) => isMissing(row[column])).length,
    ]),
  );

  console.log(`\n=== ${name} ===`);
  console.log(`Rows: ${rows.length}`);
  console.log(`Columns: ${columns.join(", ")}`);
  console.log("Missing values:", missing);
  console.log("Sample rows:", rows.slice(0, 5));
}

async function readCsv(filename: string): Promise<Row[]> {
  const content = await readFile(path.join(root, filename), "utf8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });
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

async function readConditionRows() {
  const labelFiles = (
    await Promise.all(
      conditionDirectories.map((directory) =>
        findLabelFiles(path.join(root, directory)),
      ),
    )
  ).flat();

  const rows: Row[] = [];
  const errors: string[] = [];
  for (const filename of labelFiles) {
    try {
      const parsed = JSON.parse(await readFile(filename, "utf8")) as Row;
      rows.push({
        ...parsed,
        label_path: path.relative(root, filename).replaceAll("\\", "/"),
      });
    } catch (error) {
      errors.push(
        `${path.relative(root, filename)}: ${
          error instanceof Error ? error.message : "Invalid JSON"
        }`,
      );
    }
  }

  return { rows, errors, fileCount: labelFiles.length };
}

async function main() {
  printSummary("updated_dataset.csv", await readCsv("updated_dataset.csv"));
  printSummary("ssense_dataset.csv", await readCsv("ssense_dataset.csv"));

  const conditionData = await readConditionRows();
  printSummary("Monthly clothing condition labels", conditionData.rows);
  console.log(`Label files discovered: ${conditionData.fileCount}`);
  console.log(`Malformed label files: ${conditionData.errors.length}`);
  if (conditionData.errors.length > 0) {
    console.log("Malformed examples:", conditionData.errors.slice(0, 5));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
