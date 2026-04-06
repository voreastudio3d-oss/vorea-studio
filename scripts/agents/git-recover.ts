import { analyzeGitRecovery, renderGitRecoveryPlan, serializeGitRecoveryPlan } from "./lib/git-recover.ts";
import { captureGitSnapshot } from "./lib/preflight.ts";

const mode = process.argv.includes("--dry-run") ? "dry-run" : "plan-only";
const json = process.argv.includes("--json");
const snapshot = captureGitSnapshot(process.cwd());
const plan = analyzeGitRecovery(snapshot);
console.log(json ? serializeGitRecoveryPlan(plan, mode) : renderGitRecoveryPlan(plan, mode));
