import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const statusLine = /^\*\*Physical Android status:\*\* (.+)$/gmu;

export function validatePhysicalAndroidEvidence(v011Evidence, v012Evidence) {
  for (const [release, evidence] of [
    ["v0.1.1", v011Evidence],
    ["v0.1.2", v012Evidence],
  ]) {
    const matches = [...evidence.matchAll(statusLine)];
    if (matches.length !== 1 || matches[0][1] !== "Pass") {
      throw new Error(
        `${release} Android evidence must contain exactly one '**Physical Android status:** Pass' line`,
      );
    }
  }
}

export function validatePhysicalAndroidEvidenceFiles(root = process.cwd()) {
  const v011 = fs.readFileSync(
    path.join(root, "docs/testing/2026-07-17-mobile-safe-rejection.md"),
    "utf8",
  );
  const v012 = fs.readFileSync(
    path.join(root, "docs/testing/2026-07-18-lower-memory-full-fft.md"),
    "utf8",
  );
  validatePhysicalAndroidEvidence(v011, v012);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validatePhysicalAndroidEvidenceFiles();
  console.log("Both physical Android evidence records explicitly pass.");
}