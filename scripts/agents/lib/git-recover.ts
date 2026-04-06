import { normalizePath } from "./governance.ts";
import type { GitSnapshot } from "./preflight.ts";

export interface GitRecoveryPlan {
  trackedChanges: string[];
  untrackedChanges: string[];
  recommendations: string[];
  safeCommands: string[];
}

export function analyzeGitRecovery(snapshot: GitSnapshot): GitRecoveryPlan {
  const trackedChanges = snapshot.statusLines.filter((line) => !line.startsWith("??")).map(normalizePath);
  const untrackedChanges = snapshot.statusLines.filter((line) => line.startsWith("??")).map(normalizePath);
  const recommendations: string[] = [];
  const safeCommands: string[] = [];

  if (trackedChanges.length === 0 && untrackedChanges.length === 0) {
    recommendations.push("Workspace is clean; fast-forward develop if needed.");
    safeCommands.push("git switch develop", "git pull --ff-only origin develop");
    return { trackedChanges, untrackedChanges, recommendations, safeCommands };
  }

  if (snapshot.branch === "develop" && trackedChanges.length > 0) {
    recommendations.push("Protect the current WIP in a backup branch before syncing develop.");
    safeCommands.push(
      "git switch -c wip/<yyyy-mm-dd>-<short-description>",
      "git add -A",
      "git commit -m \"wip: backup local workspace before syncing develop\"",
      "git switch develop",
      "git pull --ff-only origin develop",
    );
  } else if (trackedChanges.length > 0) {
    recommendations.push("Keep working on the feature branch or cherry-pick only the useful commits back into develop.");
    safeCommands.push("git status --short", "git diff develop...HEAD");
  }

  if (untrackedChanges.length > 0) {
    recommendations.push("Review untracked files before syncing; move or commit only the ones that collide with incoming files.");
    safeCommands.push("git status --short", "git ls-files --others --exclude-standard");
  }

  if (snapshot.worktreeLines.length > 1) {
    recommendations.push("Review auxiliary worktrees and remove only the absorbed ones.");
    safeCommands.push("git worktree list", "git worktree remove <path-to-absorbed-worktree>");
  }

  safeCommands.push("git fetch origin --prune", "git branch --merged develop");
  return { trackedChanges, untrackedChanges, recommendations, safeCommands };
}

export function renderGitRecoveryPlan(plan: GitRecoveryPlan, mode: "plan-only" | "dry-run"): string {
  return [
    `# Agent Git Recover (${mode})`,
    "",
    "## Recommendations",
    ...(plan.recommendations.length > 0 ? plan.recommendations.map((item) => `- ${item}`) : ["- None"]),
    "",
    "## Safe commands",
    ...(plan.safeCommands.length > 0 ? plan.safeCommands.map((item) => `- \`${item}\``) : ["- None"]),
    "",
    "## Snapshot",
    `- Tracked changes: ${plan.trackedChanges.length}`,
    `- Untracked changes: ${plan.untrackedChanges.length}`,
  ].join("\n");
}

export function serializeGitRecoveryPlan(plan: GitRecoveryPlan, mode: "plan-only" | "dry-run"): string {
  return `${JSON.stringify({ mode, plan }, null, 2)}\n`;
}
