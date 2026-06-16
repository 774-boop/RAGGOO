import { readFile } from "node:fs/promises";
import path from "node:path";

type FeedbackRecord = {
  prediction: { confidence?: number };
  changedFields: string[];
  imageViews: string[];
  quality: Array<{ issues: string[] }>;
};

async function main() {
  const filename = path.join(
    process.cwd(),
    "data",
    "feedback",
    "warehouse-feedback.jsonl",
  );
  let content: string;
  try {
    content = await readFile(filename, "utf8");
  } catch {
    console.log("No warehouse feedback has been recorded yet.");
    return;
  }

  const records = content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FeedbackRecord);
  const correctionCounts = new Map<string, number>();
  let correctedRecords = 0;
  let qualityIssueRecords = 0;
  let confidenceTotal = 0;
  let confidenceCount = 0;

  for (const record of records) {
    if (record.changedFields.length > 0) correctedRecords += 1;
    for (const field of record.changedFields) {
      correctionCounts.set(field, (correctionCounts.get(field) ?? 0) + 1);
    }
    if (record.quality.some((quality) => quality.issues.length > 0)) {
      qualityIssueRecords += 1;
    }
    if (typeof record.prediction.confidence === "number") {
      confidenceTotal += record.prediction.confidence;
      confidenceCount += 1;
    }
  }

  console.log(`Feedback records: ${records.length}`);
  console.log(
    `Records corrected: ${correctedRecords} (${Math.round(
      (correctedRecords / records.length) * 100,
    )}%)`,
  );
  console.log(`Records with image-quality issues: ${qualityIssueRecords}`);
  if (confidenceCount > 0) {
    console.log(
      `Average model confidence: ${Math.round(
        (confidenceTotal / confidenceCount) * 100,
      )}%`,
    );
  }
  console.log("Corrections by field:");
  for (const [field, count] of [...correctionCounts.entries()].sort(
    (left, right) => right[1] - left[1],
  )) {
    console.log(`  ${field}: ${count}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
