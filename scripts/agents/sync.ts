import path from "node:path";
import { buildGovernanceArtifacts, writeGovernanceArtifacts } from "./lib/governance.ts";

const rootDir = process.cwd();
const artifacts = buildGovernanceArtifacts(rootDir);

if (artifacts.errors.length > 0) {
  console.error("Governance metadata is invalid:");
  for (const error of artifacts.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const written = writeGovernanceArtifacts(rootDir, artifacts);

console.log("Governance sync complete.");
console.log(`Entries: ${artifacts.entries.length}`);
console.log(`Warnings: ${artifacts.warnings.length}`);
console.log(`Updated files: ${written.length}`);
for (const file of written) {
  console.log(`- ${path.normalize(file)}`);
}
