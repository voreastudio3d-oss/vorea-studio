import { analyzePreflight, captureGitSnapshot, renderPreflight, serializePreflight } from "./lib/preflight.ts";

const json = process.argv.includes("--json");
const snapshot = captureGitSnapshot(process.cwd());
const report = analyzePreflight(process.cwd(), snapshot);
console.log(json ? serializePreflight(report) : renderPreflight(report));

if (report.severity === "action-needed") {
  process.exitCode = 1;
}
