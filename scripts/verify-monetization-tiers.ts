import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

type TierLabel = "FREE" | "PRO" | "STUDIO PRO";

type SmokeUser = {
  tier: TierLabel;
  email: string;
  password: string;
  userId: string;
  token: string;
  createdByScript: boolean;
};

type SmokeRow = {
  tier: TierLabel;
  flow: string;
  before: number;
  after: number;
  delta: number;
  expectedDelta: number;
  result: "PASS" | "FAIL";
  notes: string;
};

type BusinessConfig = {
  toolCredits?: {
    tools?: Record<string, { actions?: Array<{ actionId: string; creditCost?: number }> }>;
  };
};

const DEFAULT_API_URL = "http://localhost:3001/api";
const DEFAULT_PASSWORD = process.env.MONETIZATION_SMOKE_USER_PASSWORD || "VoreaSmoke2026!";
const OUTPUT_DIR = path.resolve(process.cwd(), "output", "monetization-smoke");

const POSITIVE_CASES: Array<{ tier: TierLabel; toolId: string; actionId: string; flow: string }> = [
  { tier: "FREE", toolId: "studio", actionId: "download_stl", flow: "free.studio.download_stl" },
  { tier: "PRO", toolId: "organic", actionId: "deform", flow: "pro.organic.deform" },
  { tier: "STUDIO PRO", toolId: "studio", actionId: "download_scad", flow: "studio.download_scad" },
];

const BLOCKED_CASES: Array<{ tier: TierLabel; toolId: string; actionId: string; flow: string; expectedStatus: number }> = [
  { tier: "FREE", toolId: "organic", actionId: "deform", flow: "free.organic.deform.blocked", expectedStatus: 403 },
  { tier: "PRO", toolId: "studio", actionId: "download_scad", flow: "pro.studio.download_scad.blocked", expectedStatus: 403 },
];

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(current, "true");
      continue;
    }
    args.set(current, next);
    index += 1;
  }
  return args;
}

function boolFrom(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function apiFetch<T>(baseUrl: string, pathname: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || `${response.status} ${response.statusText}`);
  }
  return json as T;
}

async function apiFetchRaw(baseUrl: string, pathname: string, init: RequestInit = {}, token?: string): Promise<{ status: number; json: any }> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

async function signin(baseUrl: string, email: string, password: string) {
  const json = await apiFetch<any>(baseUrl, "/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return {
    token: String(json.token || ""),
    userId: String(json.profile?.id || json.user?.id || ""),
  };
}

async function signup(baseUrl: string, email: string, password: string, displayName: string, username: string) {
  const smokeIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
  const json = await apiFetch<any>(baseUrl, "/auth/signup", {
    method: "POST",
    headers: {
      "x-forwarded-for": smokeIp,
    },
    body: JSON.stringify({ email, password, displayName, username }),
  });
  return {
    token: String(json.token || ""),
    userId: String(json.profile?.id || json.user?.id || ""),
    email,
    password,
  };
}

async function updateUserTier(baseUrl: string, adminToken: string, userId: string, tier: TierLabel) {
  await apiFetch<any>(baseUrl, `/admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ tier }),
  }, adminToken);
}

async function deleteUser(baseUrl: string, adminToken: string, userId: string) {
  await apiFetch<any>(baseUrl, `/admin/users/${userId}`, { method: "DELETE" }, adminToken);
}

async function getToolCreditBalance(baseUrl: string, token: string): Promise<number> {
  const json = await apiFetch<any>(baseUrl, "/tool-credits/me", {}, token);
  return Number(json?.credits?.balance || 0);
}

function getActionCreditCost(config: BusinessConfig, toolId: string, actionId: string): number {
  const actions = config.toolCredits?.tools?.[toolId]?.actions || [];
  const action = actions.find((entry) => entry.actionId === actionId);
  if (!action) {
    throw new Error(`No se encontró ${toolId}.${actionId} en /api/config/business`);
  }
  const creditCost = Number(action.creditCost || 0);
  if (!Number.isFinite(creditCost) || creditCost <= 0) {
    throw new Error(`La acción ${toolId}.${actionId} dejó de ser monetizada en la config pública.`);
  }
  return creditCost;
}

function renderMarkdown(rows: SmokeRow[], meta: { apiUrl: string; cleanup: boolean }): string {
  const lines = [
    "# Monetization Tier Smoke",
    "",
    `Generado: ${new Date().toISOString()}`,
    `API: ${meta.apiUrl}`,
    `Cleanup: ${meta.cleanup ? "enabled" : "disabled"}`,
    "",
    "| Tier | Flow | Before | After | Delta | Expected | Result | Notes |",
    "|---|---|---:|---:|---:|---:|---|---|",
    ...rows.map((row) =>
      `| ${row.tier} | \`${row.flow}\` | ${row.before} | ${row.after} | ${row.delta} | ${row.expectedDelta} | ${row.result} | ${row.notes} |`
    ),
    "",
  ];
  return lines.join("\n");
}

async function ensureOutputArtifacts(markdown: string, rows: SmokeRow[]) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const stamp = timestampSlug();
  await fs.writeFile(path.join(OUTPUT_DIR, `monetization-tier-smoke-${stamp}.md`), markdown, "utf8");
  await fs.writeFile(path.join(OUTPUT_DIR, `monetization-tier-smoke-${stamp}.json`), JSON.stringify(rows, null, 2), "utf8");
}

async function provisionUsers(baseUrl: string, adminToken: string): Promise<SmokeUser[]> {
  const seed = Date.now();
  const definitions: Array<{ tier: TierLabel; slug: string }> = [
    { tier: "FREE", slug: "free" },
    { tier: "PRO", slug: "pro" },
    { tier: "STUDIO PRO", slug: "studio" },
  ];

  const users: SmokeUser[] = [];
  for (const definition of definitions) {
    const email = `monetization.${definition.slug}.${seed}@vorea-smoke.local`;
    const username = `@${definition.slug}_${seed}`;
    const created = await signup(baseUrl, email, DEFAULT_PASSWORD, `Smoke ${definition.tier}`, username);
    if (!created.userId || !created.token) {
      throw new Error(`No se pudo crear usuario temporal ${definition.tier}`);
    }
    if (definition.tier !== "FREE") {
      await updateUserTier(baseUrl, adminToken, created.userId, definition.tier);
    }
    users.push({
      tier: definition.tier,
      email,
      password: DEFAULT_PASSWORD,
      userId: created.userId,
      token: created.token,
      createdByScript: true,
    });
  }

  return users;
}

async function loadExistingUsers(baseUrl: string): Promise<SmokeUser[]> {
  const definitions: Array<{ tier: TierLabel; email?: string; password?: string }> = [
    {
      tier: "FREE",
      email: process.env.MONETIZATION_SMOKE_FREE_EMAIL,
      password: process.env.MONETIZATION_SMOKE_FREE_PASSWORD,
    },
    {
      tier: "PRO",
      email: process.env.MONETIZATION_SMOKE_PRO_EMAIL,
      password: process.env.MONETIZATION_SMOKE_PRO_PASSWORD,
    },
    {
      tier: "STUDIO PRO",
      email: process.env.MONETIZATION_SMOKE_STUDIO_EMAIL,
      password: process.env.MONETIZATION_SMOKE_STUDIO_PASSWORD,
    },
  ];

  if (definitions.some((entry) => !entry.email || !entry.password)) {
    throw new Error(
      "Faltan credenciales por tier. Usa MONETIZATION_SMOKE_*_EMAIL/PASSWORD o provee admin para provisioning temporal."
    );
  }

  const users: SmokeUser[] = [];
  for (const definition of definitions) {
    const signed = await signin(baseUrl, definition.email!, definition.password!);
    users.push({
      tier: definition.tier,
      email: definition.email!,
      password: definition.password!,
      userId: signed.userId,
      token: signed.token,
      createdByScript: false,
    });
  }
  return users;
}

async function runPositiveCase(baseUrl: string, config: BusinessConfig, user: SmokeUser, flow: { toolId: string; actionId: string; flow: string }): Promise<SmokeRow> {
  const before = await getToolCreditBalance(baseUrl, user.token);
  const expectedDelta = getActionCreditCost(config, flow.toolId, flow.actionId);
  const consume = await apiFetch<any>(baseUrl, "/tool-actions/consume", {
    method: "POST",
    body: JSON.stringify({ toolId: flow.toolId, actionId: flow.actionId, consume: true }),
  }, user.token);
  const after = await getToolCreditBalance(baseUrl, user.token);
  const delta = before - after;
  const pass = consume.allowed === true && consume.consumed === (expectedDelta > 0) && delta === expectedDelta;

  return {
    tier: user.tier,
    flow: flow.flow,
    before,
    after,
    delta,
    expectedDelta,
    result: pass ? "PASS" : "FAIL",
    notes: pass ? "consumo y delta validados" : `respuesta=${JSON.stringify(consume)}`,
  };
}

async function runBlockedCase(baseUrl: string, user: SmokeUser, flow: { toolId: string; actionId: string; flow: string; expectedStatus: number }): Promise<SmokeRow> {
  const before = await getToolCreditBalance(baseUrl, user.token);
  const blocked = await apiFetchRaw(baseUrl, "/tool-actions/consume", {
    method: "POST",
    body: JSON.stringify({ toolId: flow.toolId, actionId: flow.actionId, consume: true }),
  }, user.token);
  const after = await getToolCreditBalance(baseUrl, user.token);
  const delta = before - after;
  const pass = blocked.status === flow.expectedStatus && delta === 0;

  return {
    tier: user.tier,
    flow: flow.flow,
    before,
    after,
    delta,
    expectedDelta: 0,
    result: pass ? "PASS" : "FAIL",
    notes: pass ? `bloqueo esperado (${flow.expectedStatus})` : `status=${blocked.status} body=${JSON.stringify(blocked.json)}`,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.has("--help")) {
    console.log([
      "Usage: pnpm verify:monetization:tiers [--api-base http://localhost:3001/api] [--keep-users]",
      "",
      "Provision mode env:",
      "  MONETIZATION_SMOKE_ADMIN_EMAIL",
      "  MONETIZATION_SMOKE_ADMIN_PASSWORD",
      "",
      "Existing users mode env:",
      "  MONETIZATION_SMOKE_FREE_EMAIL / MONETIZATION_SMOKE_FREE_PASSWORD",
      "  MONETIZATION_SMOKE_PRO_EMAIL / MONETIZATION_SMOKE_PRO_PASSWORD",
      "  MONETIZATION_SMOKE_STUDIO_EMAIL / MONETIZATION_SMOKE_STUDIO_PASSWORD",
    ].join("\n"));
    return;
  }

  const apiBase = stripTrailingSlash(
    args.get("--api-base") ||
    process.env.MONETIZATION_SMOKE_API_URL ||
    DEFAULT_API_URL
  );
  const cleanupUsers = !boolFrom(args.get("--keep-users") || process.env.MONETIZATION_SMOKE_KEEP_USERS, false);

  const businessConfig = await apiFetch<BusinessConfig>(apiBase, "/config/business");

  let adminToken = "";
  const createdUsers: SmokeUser[] = [];
  let users: SmokeUser[] = [];

  try {
    if (process.env.MONETIZATION_SMOKE_ADMIN_EMAIL && process.env.MONETIZATION_SMOKE_ADMIN_PASSWORD) {
      const admin = await signin(
        apiBase,
        process.env.MONETIZATION_SMOKE_ADMIN_EMAIL,
        process.env.MONETIZATION_SMOKE_ADMIN_PASSWORD
      );
      adminToken = admin.token;
      users = await provisionUsers(apiBase, adminToken);
      createdUsers.push(...users);
    } else {
      users = await loadExistingUsers(apiBase);
    }

    const rows: SmokeRow[] = [];

    for (const flow of POSITIVE_CASES) {
      const user = users.find((entry) => entry.tier === flow.tier);
      if (!user) throw new Error(`No se encontró cuenta para tier ${flow.tier}`);
      rows.push(await runPositiveCase(apiBase, businessConfig, user, flow));
    }

    for (const flow of BLOCKED_CASES) {
      const user = users.find((entry) => entry.tier === flow.tier);
      if (!user) throw new Error(`No se encontró cuenta para tier ${flow.tier}`);
      rows.push(await runBlockedCase(apiBase, user, flow));
    }

    const markdown = renderMarkdown(rows, { apiUrl: apiBase, cleanup: cleanupUsers });
    await ensureOutputArtifacts(markdown, rows);
    console.log(markdown);

    const failed = rows.some((row) => row.result === "FAIL");
    if (failed) {
      process.exitCode = 1;
    }
  } finally {
    if (cleanupUsers && adminToken) {
      for (const user of createdUsers) {
        try {
          await deleteUser(apiBase, adminToken, user.userId);
        } catch (error: any) {
          console.warn(`[monetization-smoke] cleanup warning for ${user.email}: ${error?.message || error}`);
        }
      }
    }
  }
}

main().catch((error) => {
  console.error(`[monetization-smoke] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
