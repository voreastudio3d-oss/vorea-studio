import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { buildGovernanceArtifacts, matchPathPattern, normalizePath, serializeCurrentBlock, type GovernanceEntry } from "./governance.ts";
import { parseYamlDocument, type YamlValue } from "./yaml.ts";

export interface RouteRecommendation {
  changedPaths: string[];
  rules: GovernanceEntry[];
  workflows: GovernanceEntry[];
  skills: GovernanceEntry[];
  subagents: GovernanceEntry[];
  validations: string[];
  docsToUpdate: string[];
  notes: string[];
}

export interface RouteOptions {
  changedPaths?: string[];
  staged?: boolean;
  since?: string;
}

function matchesGovernanceSource(entry: GovernanceEntry, changedPath: string): boolean {
  if (changedPath === entry.path) {
    return true;
  }
  if (entry.adapter?.path === changedPath) {
    return true;
  }
  if (entry.sourceGroup === "codex_skills") {
    const skillDirectory = normalizePath(path.dirname(entry.path));
    if (changedPath.startsWith(`${skillDirectory}/`)) {
      return true;
    }
  }
  return false;
}

function readGitChangedPaths(rootDir: string, args: string[]): string[] {
  try {
    const output = execFileSync("git", args, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output
      .split(/\r?\n/)
      .map((line) => normalizePath(line.trim()))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getChangedPaths(rootDir: string, options: RouteOptions): string[] {
  if (options.changedPaths && options.changedPaths.length > 0) {
    return options.changedPaths.map(normalizePath);
  }
  if (options.staged) {
    return readGitChangedPaths(rootDir, ["diff", "--cached", "--name-only"]);
  }
  if (options.since) {
    return readGitChangedPaths(rootDir, ["diff", "--name-only", `${options.since}...HEAD`]);
  }
  return readGitChangedPaths(rootDir, ["diff", "--name-only", "HEAD"]);
}

function uniqueById(entries: GovernanceEntry[]): GovernanceEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) {
      return false;
    }
    seen.add(entry.id);
    return true;
  });
}

function sortBySpecificity(entries: GovernanceEntry[], changedPaths: string[]): GovernanceEntry[] {
  const scoreEntry = (entry: GovernanceEntry): number =>
    Math.max(
      ...changedPaths.map((changedPath) => {
        if (matchesGovernanceSource(entry, changedPath)) {
          return 10_000 + changedPath.length;
        }
        return Math.max(
          ...entry.appliesTo.map((pattern) => (matchPathPattern(changedPath, pattern) ? pattern.length : 0)),
          0,
        );
      }),
      0,
    );

  return [...entries].sort((left, right) => {
    const leftScore = scoreEntry(left);
    const rightScore = scoreEntry(right);
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    return left.title.localeCompare(right.title);
  });
}

export function routeGovernance(rootDir: string, options: RouteOptions = {}): RouteRecommendation {
  const artifacts = buildGovernanceArtifacts(rootDir);
  if (artifacts.errors.length > 0) {
    throw new Error(`Governance metadata is invalid:\n${artifacts.errors.join("\n")}`);
  }

  const changedPaths = getChangedPaths(rootDir, options);
  const matches = artifacts.entries.filter(
    (entry) =>
      entry.tags.includes("base-required") ||
      changedPaths.some(
        (changedPath) =>
          entry.appliesTo.some((pattern) => matchPathPattern(changedPath, pattern)) || matchesGovernanceSource(entry, changedPath),
      ),
  );

  const rules = uniqueById(sortBySpecificity(matches.filter((entry) => entry.kind === "rule"), changedPaths));
  const workflows = uniqueById(sortBySpecificity(matches.filter((entry) => entry.kind === "workflow"), changedPaths));
  const skills = uniqueById(sortBySpecificity(matches.filter((entry) => entry.kind === "skill"), changedPaths));
  const subagents = uniqueById(sortBySpecificity(matches.filter((entry) => entry.kind === "subagent"), changedPaths));

  const validations = Array.from(new Set([...rules, ...workflows, ...skills, ...subagents].flatMap((entry) => entry.validations))).sort();
  const docsToUpdate = Array.from(
    new Set([...rules, ...workflows, ...skills, ...subagents].flatMap((entry) => entry.docsToUpdate)),
  ).sort();
  const notes: string[] = [];
  if (subagents.length > 0) {
    notes.push(`Lead subagent: ${subagents[0].id}`);
  }
  if (skills.length > 0) {
    notes.push(`Lead skill: ${skills[0].id}`);
  }
  if (changedPaths.length === 0) {
    notes.push("No changed paths were detected; routing includes only base-required governance items.");
  }

  return {
    changedPaths,
    rules,
    workflows,
    skills,
    subagents,
    validations,
    docsToUpdate,
    notes,
  };
}

export function buildCurrentBlockSuggestion(route: RouteRecommendation, goalOverride?: string): Record<string, unknown> {
  return {
    goal:
      goalOverride?.trim() ||
      (route.changedPaths.length > 0 ? `Coordinate active block for ${route.changedPaths.length} changed path(s)` : "<describe-goal>"),
    scope: route.changedPaths.length > 0 ? route.changedPaths : ["<fill-scope>"],
    expected_files: route.changedPaths.length > 0 ? route.changedPaths : ["<expected-files>"],
    validations: route.validations.length > 0 ? route.validations : ["npm run test"],
    risks: route.notes.length > 0 ? route.notes : ["<fill-risks>"],
    next_step: route.changedPaths.length > 0 ? "Implement, validate, and update the routed documentation surfaces." : "<fill-next-step>",
    selected_workflows: [
      ...route.rules.map((entry) => `rule:${entry.id}`),
      ...route.workflows.map((entry) => `workflow:${entry.id}`),
    ],
    selected_skills: route.skills.map((entry) => entry.id),
    selected_subagents: route.subagents.map((entry) => entry.id),
    docs_to_update: route.docsToUpdate,
  };
}

export function writeCurrentBlock(rootDir: string, block: Record<string, unknown>): string {
  const runtimeDirectory = path.join(rootDir, ".agents", "runtime");
  fs.mkdirSync(runtimeDirectory, { recursive: true });
  const targetPath = path.join(runtimeDirectory, "current_block.yaml");
  const existing = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : "";
  const existingDoc = existing ? parseYamlDocument(existing) : {};
  const typedBlock = block as Record<string, YamlValue>;
  const incomingGoal = typeof typedBlock.goal === "string" ? typedBlock.goal.trim() : "";
  const shouldOverrideGoal = incomingGoal.length > 0 && incomingGoal !== "<describe-goal>";
  const merged = {
    ...typedBlock,
    goal:
      shouldOverrideGoal
        ? typedBlock.goal
        : typeof existingDoc.goal === "string" && existingDoc.goal.trim() && existingDoc.goal !== "<describe-goal>"
        ? existingDoc.goal
        : typedBlock.goal,
    next_step:
      typeof existingDoc.next_step === "string" && existingDoc.next_step.trim() && existingDoc.next_step !== "<fill-next-step>"
        ? existingDoc.next_step
        : typedBlock.next_step,
    risks:
      Array.isArray(existingDoc.risks) && existingDoc.risks.length > 0 && !existingDoc.risks.includes("<fill-risks>")
        ? existingDoc.risks
        : typedBlock.risks,
  };
  const serialized = serializeCurrentBlock(merged);
  fs.writeFileSync(targetPath, serialized, "utf8");
  return normalizePath(path.relative(rootDir, targetPath));
}

function renderChangedPaths(paths: string[]): string[] {
  return paths.length > 0 ? paths.map((item) => `- \`${item}\``) : ["- Ninguno"];
}

function renderEntries(entries: GovernanceEntry[]): string[] {
  return entries.length > 0
    ? entries.map((entry) => `- \`${entry.id}\` (${entry.kind}) — ${entry.title}`)
    : ["- Ninguno"];
}

export function renderRouteRecommendation(route: RouteRecommendation): string {
  return [
    "# Agent Route",
    "",
    "## Changed paths",
    ...renderChangedPaths(route.changedPaths),
    "",
    "## Rules",
    ...renderEntries(route.rules),
    "",
    "## Workflows",
    ...renderEntries(route.workflows),
    "",
    "## Skills",
    ...renderEntries(route.skills),
    "",
    "## Subagents",
    ...renderEntries(route.subagents),
    "",
    "## Validations",
    ...(route.validations.length > 0 ? route.validations.map((item) => `- ${item}`) : ["- Ninguna"]),
    "",
    "## Docs to update",
    ...(route.docsToUpdate.length > 0 ? route.docsToUpdate.map((item) => `- ${item}`) : ["- Ninguno"]),
    "",
    "## Notes",
    ...(route.notes.length > 0 ? route.notes.map((item) => `- ${item}`) : ["- Sin observaciones"]),
  ].join("\n");
}
