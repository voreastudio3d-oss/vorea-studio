import { buildGovernanceArtifacts, detectGovernanceDrift } from "./lib/governance.ts";

const rootDir = process.cwd();
const artifacts = buildGovernanceArtifacts(rootDir);
const drift = artifacts.errors.length > 0 ? [] : detectGovernanceDrift(rootDir, artifacts);

if (artifacts.errors.length > 0) {
  console.error("Governance metadata errors detected:");
  for (const error of artifacts.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

if (drift.length > 0) {
  console.error("Governance drift detected. Run `pnpm agent:sync`.");
  for (const file of drift) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("Governance check passed.");
if (artifacts.warnings.length > 0) {
  console.log("Warnings:");
  for (const warning of artifacts.warnings) {
    console.log(`- ${warning}`);
  }
}
