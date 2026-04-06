import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { buildGovernanceArtifacts, detectGovernanceDrift, normalizePath } from "./governance.ts";
import { parseYamlDocument } from "./yaml.ts";

export interface GitSnapshot {
  branch: string;
  statusLines: string[];
  worktreeLines: string[];
}

export interface PreflightReport {
  branch: string;
  trackedChanges: string[];
  untrackedChanges: string[];
  worktreeCount: number;
  governanceDrift: string[];
  currentBlockExists: boolean;
  currentBlockPlaceholders: string[];
  recommendations: string[];
  severity: "ok" | "warning" | "action-needed";
}

function readGit(rootDir: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

export function captureGitSnapshot(rootDir: string): GitSnapshot {
  return {
    branch: readGit(rootDir, ["branch", "--show-current"]),
    statusLines: readGit(rootDir, ["status", "--short"]).split(/\r?\n/).filter(Boolean),
    worktreeLines: readGit(rootDir, ["worktree", "list"]).split(/\r?\n/).filter(Boolean),
  };
}

export function analyzePreflight(rootDir: string, snapshot: GitSnapshot): PreflightReport {
  const trackedChanges = snapshot.statusLines.filter((line) => !line.startsWith("??"));
  const untrackedChanges = snapshot.statusLines.filter((line) => line.startsWith("??"));
  const artifacts = buildGovernanceArtifacts(rootDir);
  const governanceDrift = artifacts.errors.length > 0 ? ["metadata-invalid"] : detectGovernanceDrift(rootDir, artifacts);

  const currentBlockPath = path.join(rootDir, ".agents", "runtime", "current_block.yaml");
  const currentBlockExists = fs.existsSync(currentBlockPath);
  const currentBlockPlaceholders: string[] = [];
  if (currentBlockExists) {
    const block = parseYamlDocument(fs.readFileSync(currentBlockPath, "utf8"));
    for (const [key, value] of Object.entries(block)) {
      if (typeof value === "string" && value.includes("<")) {
        currentBlockPlaceholders.push(key);
      }
      if (Array.isArray(value) && value.some((item) => String(item).includes("<"))) {
        currentBlockPlaceholders.push(key);
      }
    }
  }

  const recommendations: string[] = [];
  let severity: PreflightReport["severity"] = "ok";

  if (trackedChanges.length > 0 && snapshot.branch === "develop") {
    severity = "action-needed";
    recommendations.push("Tracked changes are on develop. Create a feature branch before editing.");
  }
  if (governanceDrift.length > 0) {
    severity = "action-needed";
    recommendations.push("Run `pnpm agent:sync` to regenerate governance artifacts and clear drift.");
  }
  if (!currentBlockExists) {
    severity = severity === "ok" ? "warning" : severity;
    recommendations.push("Run `pnpm agent:route --staged` or `pnpm agent:route --changed <paths>` to create `.agents/runtime/current_block.yaml`.");
  }
  if (currentBlockPlaceholders.length > 0) {
    severity = severity === "ok" ? "warning" : severity;
    recommendations.push(`Fill current_block placeholders: ${currentBlockPlaceholders.join(", ")}.`);
  }
  if (snapshot.worktreeLines.length > 1) {
    severity = severity === "ok" ? "warning" : severity;
    recommendations.push("Multiple worktrees detected. Review whether any auxiliary worktree should be removed.");
  }
  if (trackedChanges.length === 0 && governanceDrift.length === 0 && currentBlockExists && currentBlockPlaceholders.length === 0) {
    recommendations.push("Workspace is ready for implementation.");
  }

  return {
    branch: snapshot.branch,
    trackedChanges,
    untrackedChanges,
    worktreeCount: snapshot.worktreeLines.length,
    governanceDrift,
    currentBlockExists,
    currentBlockPlaceholders,
    recommendations,
    severity,
  };
}

export function renderPreflight(report: PreflightReport): string {
  const lines = [
    "# Agent Preflight",
    "",
    `- Branch: ${report.branch || "(detached)"}`,
    `- Tracked changes: ${report.trackedChanges.length}`,
    `- Untracked changes: ${report.untrackedChanges.length}`,
    `- Worktrees: ${report.worktreeCount}`,
    `- Governance drift: ${report.governanceDrift.length}`,
    `- Current block: ${report.currentBlockExists ? "present" : "missing"}`,
    `- Severity: ${report.severity}`,
    "",
    "## Recommendations",
    ...(report.recommendations.length > 0 ? report.recommendations.map((item) => `- ${item}`) : ["- None"]),
  ];
  if (report.untrackedChanges.length > 0) {
    lines.push("", "## Untracked changes", ...report.untrackedChanges.map((line) => `- ${normalizePath(line)}`));
  }
  if (report.trackedChanges.length > 0) {
    lines.push("", "## Tracked changes", ...report.trackedChanges.map((line) => `- ${normalizePath(line)}`));
  }
  return lines.join("\n");
}

export function serializePreflight(report: PreflightReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
