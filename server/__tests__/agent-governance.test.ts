import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parseFrontmatter } from "../../scripts/agents/lib/frontmatter.ts";
import {
  buildGovernanceArtifacts,
  detectGovernanceDrift,
  loadGovernanceEntries,
} from "../../scripts/agents/lib/governance.ts";
import { analyzeGitRecovery } from "../../scripts/agents/lib/git-recover.ts";
import { analyzePreflight } from "../../scripts/agents/lib/preflight.ts";
import { routeGovernance, writeCurrentBlock } from "../../scripts/agents/lib/router.ts";
import { parseYamlDocument } from "../../scripts/agents/lib/yaml.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDirectories: string[] = [];
const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("agent governance", () => {
  it("parses frontmatter with arrays and nested adapter metadata", () => {
    const parsed = parseFrontmatter(`---\nid: sample\nkind: workflow\nllm_support:\n  - codex\ncross_llm_notes:\n  claude:\n    - Keep local memory aligned.\nadapter:\n  display_name: Demo\n---\n# Demo\n`);

    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.attributes.id).toBe("sample");
    expect(parsed.attributes.kind).toBe("workflow");
    expect(parsed.attributes.llm_support).toEqual(["codex"]);
    expect(parsed.attributes.cross_llm_notes).toEqual({ claude: ["Keep local memory aligned."] });
    expect(parsed.attributes.adapter).toEqual({ display_name: "Demo" });
  });

  it("loads valid governance metadata from the repo", () => {
    const result = loadGovernanceEntries(repoRoot);

    expect(result.errors).toEqual([]);
    expect(result.entries.length).toBeGreaterThan(20);
  });

  it("builds governance artifacts without drift after sync", () => {
    const artifacts = buildGovernanceArtifacts(repoRoot);
    const registry = JSON.parse(artifacts.files[".agents/generated/registry.json"]);
    const skillReviewUpgrade = registry.entries.find((entry: { id: string }) => entry.id === "skill-review-upgrade");

    expect(artifacts.errors).toEqual([]);
    expect(registry.entries.length).toBe(artifacts.entries.length);
    expect(skillReviewUpgrade.cross_llm_notes).toEqual({});
    expect(detectGovernanceDrift(repoRoot, artifacts)).toEqual([]);
  });

  it("routes backend changes to backend governance surfaces", () => {
    const route = routeGovernance(repoRoot, { changedPaths: ["server/app.ts"] });
    const workflowIds = route.workflows.map((entry) => entry.id);
    const ruleIds = route.rules.map((entry) => entry.id);
    const skillIds = route.skills.map((entry) => entry.id);
    const subagentIds = route.subagents.map((entry) => entry.id);

    expect(ruleIds).toContain("change-quality-gate");
    expect(workflowIds).toContain("change-validation-master");
    expect(workflowIds).toContain("endpoint-security-validation");
    expect(skillIds).toContain("web-ts-services-postgres-headless-mcp");
    expect(subagentIds).toContain("subagent-fullstack-ts-services");
  });

  it("routes locale changes to i18n governance surfaces", () => {
    const route = routeGovernance(repoRoot, { changedPaths: ["src/app/locales/es.json"] });
    const workflowIds = route.workflows.map((entry) => entry.id);

    expect(workflowIds).toContain("i18n-locale-sync");
    expect(route.docsToUpdate).toContain("ai_handoff_YYYY-MM-DD.md");
  });

  it("routes adapter changes to the matching repo skill and governance workflow", () => {
    const route = routeGovernance(repoRoot, {
      changedPaths: [".agents/codex-skills/vorea-parametric-scad-surface/agents/openai.yaml"],
    });
    const workflowIds = route.workflows.map((entry) => entry.id);
    const skillIds = route.skills.map((entry) => entry.id);

    expect(workflowIds).toContain("skill-review-upgrade");
    expect(skillIds).toContain("vorea-parametric-scad-surface");
    expect(route.skills[0]?.id).toBe("vorea-parametric-scad-surface");
  });

  it("writes current_block while allowing an explicit goal override", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-current-block-"));
    tempDirectories.push(tempRoot);
    const runtimeDirectory = path.join(tempRoot, ".agents", "runtime");
    fs.mkdirSync(runtimeDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(runtimeDirectory, "current_block.yaml"),
      "goal: Keep this custom goal\nscope:\n  - old/file.ts\nnext_step: Keep custom next step\nrisks:\n  - existing-risk\n",
      "utf8",
    );

    const relativePath = writeCurrentBlock(tempRoot, {
      goal: "Harden governance v1.1",
      scope: ["server/app.ts"],
      expected_files: ["server/app.ts"],
      validations: ["npm run test"],
      risks: ["<fill-risks>"],
      next_step: "<fill-next-step>",
      selected_workflows: ["workflow:change-validation-master"],
      selected_skills: ["web-ts-services-postgres-headless-mcp"],
      selected_subagents: ["subagent-fullstack-ts-services"],
      docs_to_update: ["ai_handoff_YYYY-MM-DD.md"],
    });

    const generated = parseYamlDocument(
      fs.readFileSync(path.join(tempRoot, relativePath), "utf8"),
    );

    expect(relativePath).toBe(".agents/runtime/current_block.yaml");
    expect(generated.goal).toBe("Harden governance v1.1");
    expect(generated.next_step).toBe("Keep custom next step");
    expect(generated.risks).toEqual(["existing-risk"]);
    expect(generated.selected_workflows).toEqual(["workflow:change-validation-master"]);
  });

  it("flags a dirty develop workspace during preflight", () => {
    const report = analyzePreflight(repoRoot, {
      branch: "develop",
      statusLines: [" M server/app.ts"],
      worktreeLines: [`${repoRoot} 64bda66 [develop]`],
    });

    expect(report.severity).toBe("action-needed");
    expect(report.recommendations.some((item) => item.includes("Create a feature branch"))).toBe(true);
  });

  it("builds a safe git recovery plan for dirty develop", () => {
    const plan = analyzeGitRecovery({
      branch: "develop",
      statusLines: [" M ai_shared_plan.md", "?? docs/marketing/local.md"],
      worktreeLines: [`${repoRoot} 64bda66 [develop]`],
    });

    expect(plan.recommendations[0]).toContain("Protect the current WIP");
    expect(plan.safeCommands).toContain("git switch -c wip/<yyyy-mm-dd>-<short-description>");
    expect(plan.safeCommands).toContain("git pull --ff-only origin develop");
  });

  it("prints preflight as json", () => {
    let output: string;
    try {
      output = execFileSync(process.execPath, [tsxCli, "scripts/agents/preflight.ts", "--json"], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error: any) {
      output = error.stdout;
    }
    const parsed = JSON.parse(output);

    expect(parsed).toHaveProperty("branch");
    expect(parsed).toHaveProperty("severity");
    expect(Array.isArray(parsed.recommendations)).toBe(true);
  });

  it("prints git recovery as json", () => {
    const output = execFileSync(process.execPath, [tsxCli, "scripts/agents/git-recover.ts", "--json"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const parsed = JSON.parse(output);

    expect(parsed.mode).toBe("plan-only");
    expect(parsed.plan).toHaveProperty("recommendations");
    expect(Array.isArray(parsed.plan.safeCommands)).toBe(true);
  });
});
