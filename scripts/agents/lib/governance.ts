import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter.ts";
import { parseYamlDocument, stringifyYamlDocument, type YamlValue } from "./yaml.ts";

export type GovernanceKind = "rule" | "workflow" | "skill" | "subagent";
export type CrossLlmNotes = Record<string, string[]>;

export interface GovernanceEntry {
  id: string;
  kind: GovernanceKind;
  title: string;
  description: string;
  whenToUse: string[];
  inputs: string[];
  outputs: string[];
  validations: string[];
  docsToUpdate: string[];
  tags: string[];
  appliesTo: string[];
  llmSupport: string[];
  crossLlmNotes: CrossLlmNotes;
  related: string[];
  path: string;
  heading: string | null;
  sourceGroup: "rules" | "workflows" | "skills_catalog" | "subagents" | "codex_skills";
  adapter:
    | {
        provider: "openai";
        path: string;
        interface: Record<string, string>;
        valid: boolean;
        errors: string[];
      }
    | null;
}

export interface GovernanceValidationResult {
  entries: GovernanceEntry[];
  errors: string[];
  warnings: string[];
}

export interface GovernanceArtifacts extends GovernanceValidationResult {
  files: Record<string, string>;
}

const REQUIRED_METADATA_KEYS = [
  "id",
  "kind",
  "title",
  "when_to_use",
  "inputs",
  "outputs",
  "validations",
  "docs_to_update",
  "tags",
  "applies_to",
  "llm_support",
  "related",
] as const;

export const GENERATED_BLOCK_START = "<!-- AGENTS:GENERATED:START -->";
export const GENERATED_BLOCK_END = "<!-- AGENTS:GENERATED:END -->";

const TRACKED_TRUTH_SOURCE_FILES = ["project_backlog.md", "ai_shared_plan.md", "ai_handoff_YYYY-MM-DD.md"];

export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function getStringRecordOfArrays(value: unknown): CrossLlmNotes {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, rawValue]) => {
        const normalizedKey = String(key).trim();
        if (!normalizedKey) {
          return [normalizedKey, []] as const;
        }
        if (typeof rawValue === "string") {
          const normalized = rawValue.trim();
          return [normalizedKey, normalized ? [normalized] : []] as const;
        }
        return [normalizedKey, getStringArray(rawValue)] as const;
      })
      .filter(([key, values]) => Boolean(key) && values.length > 0),
  );
}

function getStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function walkFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }
  const results: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
      continue;
    }
    results.push(fullPath);
  }
  return results;
}

function listGovernanceSourceFiles(rootDir: string): string[] {
  const directories = [
    path.join(rootDir, ".agents", "rules"),
    path.join(rootDir, ".agents", "workflows"),
    path.join(rootDir, ".agents", "skills_catalog"),
    path.join(rootDir, ".agents", "subagents"),
    path.join(rootDir, ".agents", "codex-skills"),
  ];
  return directories
    .flatMap((directory) => walkFiles(directory))
    .filter((filePath) => filePath.endsWith(".md"))
    .filter((filePath) => !normalizePath(filePath).endsWith("/README.md"))
    .filter((filePath) => !normalizePath(filePath).includes("/references/"))
    .sort((left, right) => normalizePath(left).localeCompare(normalizePath(right)));
}

function resolveSourceGroup(relativePath: string): GovernanceEntry["sourceGroup"] {
  if (relativePath.startsWith(".agents/rules/")) {
    return "rules";
  }
  if (relativePath.startsWith(".agents/workflows/")) {
    return "workflows";
  }
  if (relativePath.startsWith(".agents/skills_catalog/")) {
    return "skills_catalog";
  }
  if (relativePath.startsWith(".agents/subagents/")) {
    return "subagents";
  }
  return "codex_skills";
}

function extractHeading(body: string): string | null {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function loadAdapter(relativeFilePath: string, rootDir: string): GovernanceEntry["adapter"] {
  if (!relativeFilePath.startsWith(".agents/codex-skills/")) {
    return null;
  }
  const skillDirectory = path.dirname(path.join(rootDir, relativeFilePath));
  const adapterPath = path.join(skillDirectory, "agents", "openai.yaml");
  if (!fs.existsSync(adapterPath)) {
    return null;
  }
  const raw = fs.readFileSync(adapterPath, "utf8");
  const adapterDoc = parseYamlDocument(raw);
  const interfaceNode = adapterDoc.interface;
  const interfaceValues =
    interfaceNode && typeof interfaceNode === "object" && !Array.isArray(interfaceNode)
      ? Object.fromEntries(
          Object.entries(interfaceNode as Record<string, YamlValue>).map(([key, value]) => [key, String(value)]),
        )
      : {};
  const errors: string[] = [];
  for (const requiredKey of ["display_name", "short_description", "default_prompt"]) {
    if (!interfaceValues[requiredKey]) {
      errors.push(`Missing adapter interface.${requiredKey}`);
    }
  }
  return {
    provider: "openai",
    path: normalizePath(path.relative(rootDir, adapterPath)),
    interface: interfaceValues,
    valid: errors.length === 0,
    errors,
  };
}

function validateKind(sourceGroup: GovernanceEntry["sourceGroup"], kind: string): boolean {
  if (sourceGroup === "rules") {
    return kind === "rule";
  }
  if (sourceGroup === "workflows") {
    return kind === "workflow";
  }
  if (sourceGroup === "subagents") {
    return kind === "subagent";
  }
  return kind === "skill";
}

function parseGovernanceFile(filePath: string, rootDir: string, errors: string[], warnings: string[]): GovernanceEntry | null {
  const relativePath = normalizePath(path.relative(rootDir, filePath));
  const sourceGroup = resolveSourceGroup(relativePath);
  const contents = fs.readFileSync(filePath, "utf8");
  const parsed = parseFrontmatter(contents);

  if (!parsed.hasFrontmatter) {
    errors.push(`${relativePath}: missing frontmatter`);
    return null;
  }

  for (const key of REQUIRED_METADATA_KEYS) {
    if (!(key in parsed.attributes)) {
      errors.push(`${relativePath}: missing frontmatter key "${key}"`);
    }
  }

  if (sourceGroup === "codex_skills") {
    for (const requiredKey of ["name", "description"]) {
      if (!(requiredKey in parsed.attributes)) {
        errors.push(`${relativePath}: repo skill is missing "${requiredKey}" for Codex discovery`);
      }
    }
  }

  const entry: GovernanceEntry = {
    id: getStringValue(parsed.attributes.id),
    kind: getStringValue(parsed.attributes.kind) as GovernanceKind,
    title: getStringValue(parsed.attributes.title),
    description:
      getStringValue(parsed.attributes.description) ||
      getStringValue(parsed.attributes.name) ||
      getStringValue(parsed.attributes.title),
    whenToUse: getStringArray(parsed.attributes.when_to_use),
    inputs: getStringArray(parsed.attributes.inputs),
    outputs: getStringArray(parsed.attributes.outputs),
    validations: getStringArray(parsed.attributes.validations),
    docsToUpdate: getStringArray(parsed.attributes.docs_to_update),
    tags: getStringArray(parsed.attributes.tags),
    appliesTo: getStringArray(parsed.attributes.applies_to),
    llmSupport: getStringArray(parsed.attributes.llm_support),
    crossLlmNotes: getStringRecordOfArrays(parsed.attributes.cross_llm_notes),
    related: getStringArray(parsed.attributes.related),
    path: relativePath,
    heading: extractHeading(parsed.body),
    sourceGroup,
    adapter: loadAdapter(relativePath, rootDir),
  };

  if (!validateKind(sourceGroup, entry.kind)) {
    errors.push(`${relativePath}: kind "${entry.kind}" does not match source group "${sourceGroup}"`);
  }
  if (!entry.id) {
    errors.push(`${relativePath}: id cannot be empty`);
  }
  if (!entry.title) {
    errors.push(`${relativePath}: title cannot be empty`);
  }
  if (!entry.description) {
    errors.push(`${relativePath}: description cannot be empty`);
  }
  if (entry.whenToUse.length === 0) {
    errors.push(`${relativePath}: when_to_use must contain at least one entry`);
  }
  if (entry.appliesTo.length === 0) {
    errors.push(`${relativePath}: applies_to must contain at least one path pattern`);
  }
  if (entry.llmSupport.length === 0) {
    errors.push(`${relativePath}: llm_support must contain at least one consumer`);
  }
  for (const provider of Object.keys(entry.crossLlmNotes)) {
    if (!entry.llmSupport.includes(provider)) {
      warnings.push(`${relativePath}: cross_llm_notes references "${provider}" but llm_support does not include it`);
    }
  }
  if (entry.adapter && !entry.adapter.valid) {
    warnings.push(`${relativePath}: openai adapter is missing required interface keys`);
  }
  return entry;
}

export function loadGovernanceEntries(rootDir: string): GovernanceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const entries = listGovernanceSourceFiles(rootDir)
    .map((filePath) => parseGovernanceFile(filePath, rootDir, errors, warnings))
    .filter((entry): entry is GovernanceEntry => Boolean(entry));

  const ids = new Map<string, string>();
  for (const entry of entries) {
    const previous = ids.get(entry.id);
    if (previous) {
      errors.push(`Duplicate governance id "${entry.id}" in ${previous} and ${entry.path}`);
      continue;
    }
    ids.set(entry.id, entry.path);
  }

  return { entries, errors, warnings };
}

function toBulletList(items: string[]): string {
  if (items.length === 0) {
    return "- Ninguno";
  }
  return items.map((item) => `- ${item}`).join("\n");
}

function renderLinkItem(entry: GovernanceEntry): string {
  return `- [\`${path.basename(entry.path)}\`](./${entry.path.replace(".agents/", "")}) — ${entry.title}`;
}

function getExistingContent(rootDir: string, relativePath: string): string | null {
  const fullPath = path.join(rootDir, relativePath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : null;
}

function renderManagedDocument(
  title: string,
  intro: string[],
  generatedBody: string,
  outro: string[],
  existingContent: string | null,
): string {
  const generatedBlock = `${GENERATED_BLOCK_START}\n${generatedBody.trim()}\n${GENERATED_BLOCK_END}`;
  if (existingContent && existingContent.includes(GENERATED_BLOCK_START) && existingContent.includes(GENERATED_BLOCK_END)) {
    return existingContent.replace(
      new RegExp(`${GENERATED_BLOCK_START}[\\s\\S]*?${GENERATED_BLOCK_END}`),
      generatedBlock,
    );
  }
  const sections = [`# ${title}`, "", ...intro, "", generatedBlock];
  if (outro.length > 0) {
    sections.push("", ...outro);
  }
  return sections.join("\n").trimEnd() + "\n";
}

function buildTruthSourceWarnings(rootDir: string): string[] {
  const warnings: string[] = [];
  const backlogPath = path.join(rootDir, "project_backlog.md");
  const sharedPlanPath = path.join(rootDir, "ai_shared_plan.md");
  const latestHandoffPath = fs
    .readdirSync(rootDir)
    .filter((name) => /^ai_handoff_\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .sort()
    .at(-1);

  if (fs.existsSync(backlogPath)) {
    const backlog = fs.readFileSync(backlogPath, "utf8");
    if (/Validaciones ejecutadas|Resultado por comando|Comandos corridos/i.test(backlog)) {
      warnings.push("project_backlog.md contains handoff-style validation details; keep backlog focused on state/priority.");
    }
    if (/^##?\s+Objetivo activo\b/m.test(backlog)) {
      warnings.push("project_backlog.md contains active-plan language; keep backlog focused on state/priority.");
    }
  }
  if (fs.existsSync(sharedPlanPath)) {
    const sharedPlan = fs.readFileSync(sharedPlanPath, "utf8");
    if (/\bPENDING\b|\bNOT STARTED\b|\bIN PROGRESS\b/i.test(sharedPlan) || /\| ID \| Estado \|/i.test(sharedPlan)) {
      warnings.push("ai_shared_plan.md contains backlog-style status labels; keep shared plan focused on active execution.");
    }
    if (/##\s+Plan por fases|##\s+P0\b|##\s+P1\b/i.test(sharedPlan)) {
      warnings.push("ai_shared_plan.md contains roadmap/backlog sections; keep shared plan focused on the current execution block.");
    }
  }
  if (latestHandoffPath) {
    const handoff = fs.readFileSync(path.join(rootDir, latestHandoffPath), "utf8");
    if (/estado\/prioridad|roadmap maestro/i.test(handoff) || /^##?\s+Orden inmediato de acción\b/m.test(handoff)) {
      warnings.push(`${latestHandoffPath} contains backlog-like priority language; keep handoff focused on daily delta/evidence.`);
    }
  }
  return warnings;
}

function buildLlmCoverage(entries: GovernanceEntry[]): Record<string, number> {
  return entries.reduce<Record<string, number>>((accumulator, entry) => {
    for (const provider of entry.llmSupport) {
      accumulator[provider] = (accumulator[provider] ?? 0) + 1;
    }
    return accumulator;
  }, {});
}

function buildCrossLlmNotes(entries: GovernanceEntry[]): Record<string, Array<{ entry: GovernanceEntry; note: string }>> {
  const results: Record<string, Array<{ entry: GovernanceEntry; note: string }>> = {};
  for (const entry of entries) {
    for (const [provider, notes] of Object.entries(entry.crossLlmNotes)) {
      if (!results[provider]) {
        results[provider] = [];
      }
      for (const note of notes) {
        results[provider].push({ entry, note });
      }
    }
  }
  return Object.fromEntries(
    Object.entries(results)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([provider, notes]) => [
        provider,
        [...notes].sort((left, right) =>
          `${left.entry.id}:${left.note}`.localeCompare(`${right.entry.id}:${right.note}`),
        ),
      ]),
  );
}

function buildRegistryJson(entries: GovernanceEntry[]): string {
  const payload = {
    schemaVersion: 1,
    generatedFrom: "frontmatter",
    entries: entries.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      description: entry.description,
      when_to_use: entry.whenToUse,
      inputs: entry.inputs,
      outputs: entry.outputs,
      validations: entry.validations,
      docs_to_update: entry.docsToUpdate,
      tags: entry.tags,
      applies_to: entry.appliesTo,
      llm_support: entry.llmSupport,
      cross_llm_notes: entry.crossLlmNotes,
      related: entry.related,
      path: entry.path,
      source_group: entry.sourceGroup,
      adapter: entry.adapter,
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function buildValidationReport(entries: GovernanceEntry[], warnings: string[], errors: string[]): string {
  const grouped = entries.reduce<Record<string, number>>((accumulator, entry) => {
    accumulator[entry.kind] = (accumulator[entry.kind] ?? 0) + 1;
    return accumulator;
  }, {});
  const repoSkills = entries.filter((entry) => entry.sourceGroup === "codex_skills");
  const validAdapters = repoSkills.filter((entry) => entry.adapter?.valid).length;
  const invalidAdapters = repoSkills.filter((entry) => entry.adapter && !entry.adapter.valid).length;
  const missingAdapters = repoSkills.filter((entry) => !entry.adapter).length;
  const adapterWarnings = entries
    .filter((entry) => entry.sourceGroup === "codex_skills" && !entry.adapter)
    .map((entry) => `${entry.path}: missing agents/openai.yaml adapter`);
  const llmCoverage = buildLlmCoverage(entries);
  const allWarnings = [...warnings, ...adapterWarnings];
  const lines = [
    "# Governance Validation Report",
    "",
    "## Registry summary",
    "",
    `- Total entries: ${entries.length}`,
    `- Rules: ${grouped.rule ?? 0}`,
    `- Workflows: ${grouped.workflow ?? 0}`,
    `- Skills: ${grouped.skill ?? 0}`,
    `- Subagents: ${grouped.subagent ?? 0}`,
    "",
    "## Adapter coverage",
    "",
    `- Repo-local skills: ${repoSkills.length}`,
    `- Valid OpenAI adapters: ${validAdapters}`,
    `- Invalid OpenAI adapters: ${invalidAdapters}`,
    `- Missing OpenAI adapters: ${missingAdapters}`,
    "",
    "## LLM support matrix",
    "",
    ...Object.entries(llmCoverage)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([provider, count]) => `- ${provider}: ${count}`),
    "## Warnings",
    "",
    toBulletList(allWarnings),
    "",
    "## Errors",
    "",
    toBulletList(errors),
    "",
    "## Truth-source policy",
    "",
    ...TRACKED_TRUTH_SOURCE_FILES.map((file) => `- ${file}`),
  ];
  return `${lines.join("\n")}\n`;
}

function renderSkillsIndex(entries: GovernanceEntry[], rootDir: string): string {
  const baseRules = entries.filter((entry) => entry.kind === "rule" && entry.tags.includes("base-required"));
  const baseWorkflows = entries.filter((entry) => entry.kind === "workflow" && entry.tags.includes("base-required"));
  const uiEntries = entries.filter((entry) => ["rule", "workflow"].includes(entry.kind) && entry.tags.includes("ui"));
  const backendEntries = entries.filter(
    (entry) => ["rule", "workflow"].includes(entry.kind) && entry.tags.includes("backend"),
  );
  const securityEntries = entries.filter(
    (entry) => ["rule", "workflow"].includes(entry.kind) && entry.tags.includes("security"),
  );
  const engineEntries = entries.filter(
    (entry) => ["rule", "workflow"].includes(entry.kind) && entry.tags.includes("3d"),
  );
  const gitEntries = entries.filter((entry) => ["rule", "workflow"].includes(entry.kind) && entry.tags.includes("git"));
  const skillCatalog = entries.filter((entry) => entry.sourceGroup === "skills_catalog");
  const repoSkills = entries.filter((entry) => entry.sourceGroup === "codex_skills");
  const subagents = entries.filter((entry) => entry.kind === "subagent");

  const generated = [
    "## Base obligatoria",
    "",
    "### Reglas normativas",
    ...baseRules.map(renderLinkItem),
    "",
    "### Workflows maestros",
    ...baseWorkflows.map(renderLinkItem),
    "",
    "## Routing por tipo de cambio",
    "",
    "### UI / Frontend",
    ...uiEntries.map(renderLinkItem),
    "",
    "### Backend / API / Datos",
    ...backendEntries.map(renderLinkItem),
    "",
    "### Seguridad / Auth / Pagos",
    ...securityEntries.map(renderLinkItem),
    "",
    "### Engine 3D / Parametric / Render",
    ...engineEntries.map(renderLinkItem),
    "",
    "### Git / Gobernanza",
    ...gitEntries.map(renderLinkItem),
    "",
    "## Skills y subagentes",
    "",
    "### Skills expertas del catálogo",
    ...skillCatalog.map(renderLinkItem),
    "",
    "### Skills repo-locales",
    ...repoSkills.map(renderLinkItem),
    "",
    "### Subagentes",
    ...subagents.map(renderLinkItem),
  ].join("\n");

  return renderManagedDocument(
    "Índice Maestro de Gobernanza IA — `.agents`",
    [
      "Modo de enforcement: **bloqueante estricto**.",
      "La selección automática de workflows, skills, subagentes y documentos se deriva de metadata frontmatter versionada en `.agents/**`.",
      "Este archivo se sincroniza con `pnpm agent:sync` y no debe editarse a mano dentro del bloque generado.",
    ],
    generated,
    [
      "## Checklist de salida (obligatorio)",
      "",
      "1. Validaciones corridas y resultado:",
      "   - `npm run test`",
      "   - checks específicos del bloque y del router",
      "2. Impacto reportado:",
      "   - impacto funcional",
      "   - impacto API si aplica",
      "3. Trazabilidad mínima:",
      "   - `project_backlog.md` solo para estado/prioridad",
      "   - `ai_shared_plan.md` solo para ejecución activa",
      "   - `ai_handoff_YYYY-MM-DD.md` solo para delta/evidencia del día",
      "4. Si cambia gobernanza agentica, reejecutar `pnpm agent:sync` y `pnpm agent:governance:check`.",
    ],
    getExistingContent(rootDir, ".agents/skills"),
  );
}

function renderSkillsCatalogReadme(entries: GovernanceEntry[], rootDir: string): string {
  const skillCatalog = entries
    .filter((entry) => entry.sourceGroup === "skills_catalog")
    .sort((left, right) => left.title.localeCompare(right.title));

  const generated = skillCatalog
    .map(
      (entry, index) =>
        `${index + 1}. \`${entry.id}\`\n   - Archivo: \`${path.basename(entry.path)}\`\n   - Alcance: ${entry.description}`,
    )
    .join("\n\n");

  return renderManagedDocument(
    "Catalogo de Skills Expertas",
    [
      "Este catalogo define las skills expertas reutilizables del repo.",
      "La lista se genera desde el frontmatter de `.agents/skills_catalog/*.md`.",
    ],
    `## Skills activas\n\n${generated}`,
    [
      "## Regla de aplicacion",
      "",
      "- Seleccionar al menos 1 skill lider en tareas complejas.",
      "- Registrar la selección en `ai_handoff_YYYY-MM-DD.md` cuando la tarea se cierre.",
      "- Si cambian skills, catálogo o adapters, aplicar `pnpm agent:sync` y `.agents/workflows/skill_review_upgrade_workflow.md`.",
    ],
    getExistingContent(rootDir, ".agents/skills_catalog/README.md"),
  );
}

function renderSubagentsReadme(entries: GovernanceEntry[], rootDir: string): string {
  const subagents = entries
    .filter((entry) => entry.kind === "subagent")
    .sort((left, right) => left.title.localeCompare(right.title));

  const generated = subagents
    .map(
      (entry, index) =>
        `${index + 1}. \`${entry.id}\`\n   - Archivo: \`${path.basename(entry.path)}\`\n   - Dominio: ${entry.description}`,
    )
    .join("\n\n");

  return renderManagedDocument(
    "Catalogo de Subagentes",
    [
      "Este directorio define subagentes especializados para bloques complejos.",
      "La lista se genera desde el frontmatter de `.agents/subagents/*.md`.",
    ],
    `## Subagentes disponibles\n\n${generated}`,
    [
      "## Regla de coordinacion",
      "",
      "- Elegir 1 orquestador principal y no más de 2 workers cuando realmente aporten.",
      "- Consolidar salida en un único handoff siguiendo `.agents/workflows/agent_handoff_evidence_workflow.md`.",
      "- Si cambia el catálogo o los adapters, aplicar `.agents/workflows/skill_review_upgrade_workflow.md`.",
    ],
    getExistingContent(rootDir, ".agents/subagents/README.md"),
  );
}

export function buildGovernanceArtifacts(rootDir: string): GovernanceArtifacts {
  const validation = loadGovernanceEntries(rootDir);
  const entries = [...validation.entries].sort((left, right) => left.id.localeCompare(right.id));
  const warnings = [...validation.warnings, ...buildTruthSourceWarnings(rootDir)];

  const files: Record<string, string> = {
    ".agents/generated/registry.json": buildRegistryJson(entries),
    ".agents/generated/validation-report.md": buildValidationReport(entries, warnings, validation.errors),
    ".agents/skills": renderSkillsIndex(entries, rootDir),
    ".agents/skills_catalog/README.md": renderSkillsCatalogReadme(entries, rootDir),
    ".agents/subagents/README.md": renderSubagentsReadme(entries, rootDir),
  };

  return {
    entries,
    errors: validation.errors,
    warnings,
    files,
  };
}

export function writeGovernanceArtifacts(rootDir: string, artifacts: GovernanceArtifacts): string[] {
  const writtenFiles: string[] = [];
  for (const [relativePath, contents] of Object.entries(artifacts.files)) {
    const fullPath = path.join(rootDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const previous = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : null;
    if (previous === contents) {
      continue;
    }
    fs.writeFileSync(fullPath, contents, "utf8");
    writtenFiles.push(relativePath);
  }
  return writtenFiles;
}

export function detectGovernanceDrift(rootDir: string, artifacts: GovernanceArtifacts): string[] {
  const drift: string[] = [];
  for (const [relativePath, expected] of Object.entries(artifacts.files)) {
    const fullPath = path.join(rootDir, relativePath);
    const current = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
    if (current !== expected) {
      drift.push(relativePath);
    }
  }
  return drift;
}

export function matchPathPattern(filePath: string, pattern: string): boolean {
  const normalizedFilePath = normalizePath(filePath);
  const normalizedPattern = normalizePath(pattern);
  if (normalizedPattern === "**" || normalizedPattern === "*") {
    return true;
  }
  const globToken = "__DOUBLE_STAR__";
  const starToken = "__SINGLE_STAR__";
  const escaped = normalizedPattern
    .replace(/\*\*/g, globToken)
    .replace(/\*/g, starToken)
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(new RegExp(globToken, "g"), ".*")
    .replace(new RegExp(starToken, "g"), "[^/]*");
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(normalizedFilePath);
}

export function serializeCurrentBlock(block: Record<string, YamlValue>): string {
  return `${stringifyYamlDocument(block)}\n`;
}
