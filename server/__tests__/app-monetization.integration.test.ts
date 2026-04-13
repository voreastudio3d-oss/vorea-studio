// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

type KvState = {
  store: Map<string, any>;
};

type AuthState = {
  tokens: Map<string, string>;
};

const kvState = vi.hoisted<KvState>(() => ({
  store: new Map<string, any>(),
}));

const authState = vi.hoisted<AuthState>(() => ({
  tokens: new Map<string, string>(),
}));

const subscriptionFinanceState = vi.hoisted(() => ({
  summary: {
    available: false,
    activeSubscriptions: 0,
    mappedActiveSubscriptions: 0,
    unmappedActiveSubscriptions: 0,
    estimatedMonthlyRecurringRevenue: 0,
    estimatedAnnualContractValue: 0,
    activeByTier: {},
    estimatedMonthlyByTier: {},
    breakdown: [] as any[],
    unavailableReason: "mocked" as any,
  },
}));

// ─── BG-107: Resend module mock (hoisted so vi.mock works correctly) ───────────
const resendState = vi.hoisted(() => ({
  emailsSend: vi.fn().mockResolvedValue({ id: "resend-mock-id" }),
}));

function clone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

vi.mock("../kv.js", () => ({
  set: async (key: string, value: any) => {
    kvState.store.set(key, clone(value));
  },
  get: async (key: string) => {
    return kvState.store.has(key) ? clone(kvState.store.get(key)) : null;
  },
  del: async (key: string) => {
    kvState.store.delete(key);
  },
  mset: async (keys: string[], values: any[]) => {
    keys.forEach((key, index) => {
      kvState.store.set(key, clone(values[index]));
    });
  },
  mget: async (keys: string[]) => {
    return keys.map((key) =>
      kvState.store.has(key) ? clone(kvState.store.get(key)) : null
    );
  },
  mdel: async (keys: string[]) => {
    keys.forEach((key) => kvState.store.delete(key));
  },
  getByPrefix: async (prefix: string) => {
    const values: any[] = [];
    for (const [key, value] of kvState.store.entries()) {
      if (key.startsWith(prefix)) values.push(clone(value));
    }
    return values;
  },
}));

vi.mock("../auth.js", () => ({
  getUserIdFromHeader: (authorization?: string) => {
    if (!authorization?.startsWith("Bearer ")) return null;
    const token = authorization.slice("Bearer ".length);
    return authState.tokens.get(token) || null;
  },
  getUserById: async (id: string) => ({
    id,
    email: `${id}@test.local`,
    role: "user",
    tier: "FREE",
  }),
  updateUser: async () => {},
  deleteUser: async () => {},
}));

vi.mock("../community-repository.js", () => ({
  createCommunityRepository: () => ({
    getAllModels: async () => [],
    getAllModelsRaw: async () => [],
    getModel: async () => null,
    upsertModel: async () => {},
    deleteModel: async () => {},
    getTag: async () => null,
    upsertTag: async () => {},
    listTags: async () => [],
    getLike: async () => null,
    upsertLike: async () => {},
    deleteLike: async () => {},
    listLikesByModel: async () => [],
    getUserProfile: async () => null,
    upsertUserProfile: async () => {},
  }),
}));

vi.mock("../subscription-finance.js", () => ({
  getSubscriptionFinanceSummary: async () => clone(subscriptionFinanceState.summary),
}));

vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = { send: resendState.emailsSend };
    },
  };
});

function jsonResponse(status: number, payload: any): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function loadApp() {
  const mod = await import("../app.ts");
  return mod.default;
}

async function postJson(
  app: any,
  path: string,
  body: Record<string, unknown>,
  token?: string
) {
  return app.request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("app monetization integration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    kvState.store.clear();
    authState.tokens.clear();
    subscriptionFinanceState.summary = {
      available: false,
      activeSubscriptions: 0,
      mappedActiveSubscriptions: 0,
      unmappedActiveSubscriptions: 0,
      estimatedMonthlyRecurringRevenue: 0,
      estimatedAnnualContractValue: 0,
      activeByTier: {},
      estimatedMonthlyByTier: {},
      breakdown: [],
      unavailableReason: "mocked",
    };
    authState.tokens.set("token-admin", "admin_user");
    authState.tokens.set("token-free", "user_free");
    authState.tokens.set("token-pro", "user_pro");
    delete process.env.GA4_SERVICE_ACCOUNT_KEY;
    delete process.env.GA4_PROPERTY_ID;
    delete process.env.ADMIN_ANALYTICS_ALLOW_MOCK;
    delete process.env.RESEND_API_KEY;
    process.env.ENABLE_LEGACY_CREDIT_PACKS = "true";
    process.env.PAYPAL_CLIENT_ID = "test-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
    process.env.PAYPAL_MODE = "sandbox";
    resendState.emailsSend.mockClear();
  });

  it("enforces generic tool-action consumption with aliases and limits", async () => {
    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
      tools: {
        community: {
          label: "Comunidad",
          actions: [
            {
              actionId: "publish",
              labelKey: "credits.community.publish",
              creditCost: 0,
              limits: { free: 1, pro: -1, studioPro: -1 },
              limitPeriod: "day",
            },
          ],
        },
      },
    });

    const app = await loadApp();
    const first = await postJson(
      app,
      "/api/tool-actions/consume",
      { toolId: "comunidad", actionId: "publish", consume: true },
      "token-free"
    );
    expect(first.status).toBe(200);
    const firstJson = await first.json();
    expect(firstJson.consumed).toBe(true);

    const second = await postJson(
      app,
      "/api/tool-actions/consume",
      { toolId: "community", actionId: "publish", consume: true },
      "token-free"
    );
    expect(second.status).toBe(402);
  });

  it("enforces gcode action limits on server route", async () => {
    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
      tools: {
        gcode: {
          label: "GCode",
          actions: [
            {
              actionId: "edit_linear",
              labelKey: "credits.gcode.edit_linear",
              creditCost: 1,
              limits: { free: 1, pro: -1, studioPro: -1 },
              limitPeriod: "total",
            },
          ],
        },
      },
    });

    const app = await loadApp();
    const ok = await postJson(
      app,
      "/api/gcode",
      { name: "test", gcode: "G1 X0 Y0", actionId: "edit_linear" },
      "token-free"
    );
    expect(ok.status).toBe(200);

    const blocked = await postJson(
      app,
      "/api/gcode",
      { name: "test-2", gcode: "G1 X1 Y1", actionId: "edit_linear" },
      "token-free"
    );
    expect(blocked.status).toBe(402);
  });

  it("defaults gcode saves to a free view action when no actionId is provided", async () => {
    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
      tools: {
        gcode: {
          label: "GCode",
          actions: [
            {
              actionId: "view",
              labelKey: "credits.gcode.view",
              creditCost: 0,
              limits: { free: -1, pro: -1, studioPro: -1 },
              limitPeriod: "unlimited",
            },
            {
              actionId: "edit_linear",
              labelKey: "credits.gcode.edit_linear",
              creditCost: 1,
              limits: { free: 1, pro: -1, studioPro: -1 },
              limitPeriod: "total",
            },
          ],
        },
      },
    });

    const app = await loadApp();
    const res = await postJson(
      app,
      "/api/gcode",
      { name: "view-only", gcode: "G1 X0 Y0" },
      "token-free"
    );
    expect(res.status).toBe(200);
    expect(kvState.store.get("user:user_free:tool_credits")).toBeUndefined();
  });

  it("rejects invalid gcode action ids before applying any charge", async () => {
    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
      tools: {
        gcode: {
          label: "GCode",
          actions: [
            {
              actionId: "export",
              labelKey: "credits.gcode.export",
              creditCost: 1,
              limits: { free: 6, pro: -1, studioPro: -1 },
              limitPeriod: "total",
            },
          ],
        },
      },
    });

    const app = await loadApp();
    const res = await postJson(
      app,
      "/api/gcode",
      { name: "bad-action", gcode: "G1 X0 Y0", actionId: "hack" },
      "token-free"
    );
    expect(res.status).toBe(400);
    expect(kvState.store.get("user:user_free:tool_credits")).toBeUndefined();
  });

  it("deducts monthly tool credits when a gated action is consumed", async () => {
    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
      tools: {
        studio: {
          label: "Studio",
          actions: [
            {
              actionId: "export_stl",
              labelKey: "credits.studio.export_stl",
              creditCost: 2,
              limits: { free: 10, pro: -1, studioPro: -1 },
              limitPeriod: "month",
            },
          ],
        },
      },
    });

    const app = await loadApp();
    const res = await postJson(
      app,
      "/api/tool-actions/consume",
      { toolId: "studio", actionId: "export_stl", consume: true },
      "token-free",
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.consumed).toBe(true);
    expect(json.credits.balance).toBe(4);
    expect(json.credits.totalUsed).toBe(2);

    expect(kvState.store.get("user:user_free:tool_credits")).toMatchObject({
      balance: 4,
      monthlyAllocation: 6,
      totalUsed: 2,
      tier: "FREE",
    });
  });

  it("marks credit-based actions as consumed even without a usage counter", async () => {
    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
      tools: {
        makerworld: {
          label: "MakerWorld",
          actions: [
            {
              actionId: "download_prep",
              labelKey: "credits.mw.download",
              creditCost: 2,
              limits: { free: -1, pro: -1, studioPro: -1 },
              limitPeriod: "unlimited",
            },
          ],
        },
      },
    });

    const app = await loadApp();
    const res = await postJson(
      app,
      "/api/tool-actions/consume",
      { toolId: "makerworld", actionId: "download_prep", consume: true },
      "token-free",
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.consumed).toBe(true);
    expect(json.credits.balance).toBe(4);
    expect(json.credits.totalUsed).toBe(2);
  });

  it("blocks a gated action when monthly tool credits are insufficient", async () => {
    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 1, PRO: 200, "STUDIO PRO": 500 },
      tools: {
        relief: {
          label: "Relief",
          actions: [
            {
              actionId: "export_hybrid",
              labelKey: "credits.relief.export_hybrid",
              creditCost: 2,
              limits: { free: 10, pro: -1, studioPro: -1 },
              limitPeriod: "month",
            },
          ],
        },
      },
    });

    const app = await loadApp();
    const res = await postJson(
      app,
      "/api/tool-actions/consume",
      { toolId: "relief", actionId: "export_hybrid", consume: true },
      "token-free",
    );
    expect(res.status).toBe(402);
    const json = await res.json();
    expect(String(json.error)).toContain("Créditos insuficientes");
  });

  it("returns the authenticated user's monthly tool credit snapshot", async () => {
    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 8, PRO: 200, "STUDIO PRO": 500 },
      tools: {},
    });

    const app = await loadApp();
    const res = await app.request("/api/tool-credits/me", {
      method: "GET",
      headers: { Authorization: "Bearer token-free" },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.credits).toMatchObject({
      balance: 8,
      monthlyAllocation: 8,
      monthlyBalance: 8,
      topupBalance: 0,
      totalUsed: 0,
      tier: "FREE",
    });
  });

  it("migrates legacy purchased credits into the universal balance and consumes monthly credits first", async () => {
    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("user:user_free:credits", { freeUsed: 6, purchasedCredits: 5, totalExported: 6 });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
      tools: {
        studio: {
          label: "Studio",
          actions: [
            {
              actionId: "download_scad",
              labelKey: "credits.studio.download_scad",
              creditCost: 7,
              limits: { free: -1, pro: -1, studioPro: -1 },
              limitPeriod: "month",
            },
          ],
        },
      },
    });

    const app = await loadApp();
    const snapshot = await app.request("/api/tool-credits/me", {
      method: "GET",
      headers: { Authorization: "Bearer token-free" },
    });
    expect(snapshot.status).toBe(200);
    const snapshotJson = await snapshot.json();
    expect(snapshotJson.credits).toMatchObject({
      balance: 11,
      monthlyAllocation: 6,
      monthlyBalance: 6,
      topupBalance: 5,
      totalUsed: 0,
      tier: "FREE",
    });
    expect(kvState.store.get("user:user_free:credits")).toMatchObject({
      purchasedCredits: 0,
      totalExported: 6,
    });

    const consume = await postJson(
      app,
      "/api/tool-actions/consume",
      { toolId: "studio", actionId: "download_scad", consume: true },
      "token-free",
    );
    expect(consume.status).toBe(200);
    const consumeJson = await consume.json();
    expect(consumeJson.credits).toMatchObject({
      balance: 4,
      monthlyBalance: 0,
      topupBalance: 4,
      totalUsed: 7,
    });
    expect(kvState.store.get("user:user_free:tool_credits")).toMatchObject({
      balance: 4,
      monthlyAllocation: 6,
      topupBalance: 4,
      totalUsed: 7,
      tier: "FREE",
    });
    expect(kvState.store.get("user:user_free:activity_log")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "tool_credit_topup_migrated",
        }),
        expect.objectContaining({
          action: "tool_credit_consumed",
          creditCost: 7,
          creditsFromMonthly: 6,
          creditsFromTopup: 1,
        }),
      ]),
    );
  });

  it("adds admin credit grants to the universal top-up balance", async () => {
    kvState.store.set("user:admin_user:profile", { id: "admin_user", tier: "STUDIO PRO", role: "superadmin" });
    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
      tools: {},
    });

    const app = await loadApp();
    const res = await postJson(
      app,
      "/api/credits/purchase",
      { packId: "admin_grant", credits: 12, targetUserId: "user_free" },
      "token-admin",
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.toolCredits).toMatchObject({
      balance: 18,
      monthlyAllocation: 6,
      topupBalance: 12,
      totalUsed: 0,
      tier: "FREE",
    });
    expect(kvState.store.get("user:user_free:tool_credits")).toMatchObject({
      balance: 18,
      monthlyAllocation: 6,
      topupBalance: 12,
      totalUsed: 0,
      tier: "FREE",
    });
  });

  it("previews pending legacy purchased credits for admin backfill", async () => {
    kvState.store.set("user:admin_user:profile", {
      id: "admin_user",
      displayName: "Admin",
      email: "admin@test.local",
      username: "@admin",
      tier: "STUDIO PRO",
      role: "superadmin",
    });
    kvState.store.set("user:user_free:profile", {
      id: "user_free",
      displayName: "Free User",
      email: "free@test.local",
      username: "@free",
      tier: "FREE",
      role: "user",
    });
    kvState.store.set("user:user_pro:profile", {
      id: "user_pro",
      displayName: "Pro User",
      email: "pro@test.local",
      username: "@pro",
      tier: "PRO",
      role: "user",
    });
    kvState.store.set("user:user_free:credits", { freeUsed: 2, purchasedCredits: 5, totalExported: 3 });
    kvState.store.set("user:user_pro:credits", { freeUsed: 0, purchasedCredits: 0, totalExported: 0 });

    const app = await loadApp();
    const res = await app.request("/api/admin/tool-credits/legacy-status", {
      method: "GET",
      headers: { Authorization: "Bearer token-admin" },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      totalUsersScanned: 3,
      affectedUsers: 1,
      totalLegacyPurchasedCredits: 5,
    });
    expect(json.preview).toEqual([
      expect.objectContaining({
        userId: "user_free",
        legacyPurchasedCredits: 5,
        tier: "FREE",
      }),
    ]);
  });

  it("batch migrates legacy purchased credits into universal top-ups from admin", async () => {
    kvState.store.set("user:admin_user:profile", {
      id: "admin_user",
      displayName: "Admin",
      email: "admin@test.local",
      username: "@admin",
      tier: "STUDIO PRO",
      role: "superadmin",
    });
    kvState.store.set("user:user_free:profile", {
      id: "user_free",
      displayName: "Free User",
      email: "free@test.local",
      username: "@free",
      tier: "FREE",
      role: "user",
    });
    kvState.store.set("user:user_free:credits", { freeUsed: 4, purchasedCredits: 7, totalExported: 9 });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
      tools: {},
    });

    const app = await loadApp();
    const res = await postJson(
      app,
      "/api/admin/tool-credits/legacy-migrate",
      {},
      "token-admin",
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.migratedUsers).toBe(1);
    expect(json.totalCreditsMigrated).toBe(7);
    expect(json.affectedUsers).toBe(0);
    expect(json.totalLegacyPurchasedCredits).toBe(0);
    expect(json.lastRun).toMatchObject({
      migratedUsers: 1,
      totalCreditsMigrated: 7,
      executedBy: "admin_user",
    });
    expect(kvState.store.get("user:user_free:credits")).toMatchObject({
      purchasedCredits: 0,
      totalExported: 9,
    });
    expect(kvState.store.get("user:user_free:tool_credits")).toMatchObject({
      balance: 13,
      monthlyAllocation: 6,
      topupBalance: 7,
      totalUsed: 0,
      tier: "FREE",
    });
    expect(kvState.store.get("admin:tool_credits:legacy_backfill:last_run")).toMatchObject({
      migratedUsers: 1,
      totalCreditsMigrated: 7,
      executedBy: "admin_user",
    });
  });

  it("includes tool credit usage in the admin KPI dashboard", async () => {
    const now = new Date().toISOString();
    kvState.store.set("user:admin_user:profile", {
      id: "admin_user",
      tier: "STUDIO PRO",
      role: "superadmin",
    });
    kvState.store.set("users_list", [{ id: "user_free" }]);
    kvState.store.set("user:user_free:activity_log", [
      { action: "tool_credit_consumed", toolId: "studio", actionId: "download_stl", creditCost: 2, at: now },
      { action: "credit_consumed", creditCost: 1, at: now },
      { action: "credit_purchased", creditsAdded: 10, at: now },
    ]);

    const app = await loadApp();
    const res = await app.request("/api/admin/kpi", {
      method: "GET",
      headers: { Authorization: "Bearer token-admin" },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.kpi).toMatchObject({
      totalExports: 1,
      totalPaidActions: 2,
      totalToolCreditActions: 1,
      totalCreditsSpent: 3,
      totalLegacyCreditsSpent: 1,
      totalToolCreditsSpent: 2,
      totalCreditPurchases: 1,
      toolActionCounts: { studio: 1 },
    });
  });

  it("returns analytics insights as unavailable when GA4 is not configured and mock mode is off", async () => {
    kvState.store.set("user:admin_user:profile", {
      id: "admin_user",
      tier: "STUDIO PRO",
      role: "superadmin",
    });

    const app = await loadApp();
    const res = await app.request("/api/admin/analytics-insights", {
      method: "GET",
      headers: { Authorization: "Bearer token-admin" },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      available: false,
      configured: false,
      mock: false,
      metrics: null,
    });
    expect(Array.isArray(json.insights)).toBe(true);
    expect(json.insights).toHaveLength(0);
    expect(String(json.unavailableReason)).toContain("GA4");
  });

  it("does not inject default operating costs into revenue reports when admin costs are unset", async () => {
    const now = new Date().toISOString();
    kvState.store.set("user:admin_user:profile", {
      id: "admin_user",
      tier: "STUDIO PRO",
      role: "superadmin",
    });
    kvState.store.set("paypal:order:ord_1", {
      orderId: "ord_1",
      status: "COMPLETED",
      price: 6.99,
      createdAt: now,
      capturedAt: now,
    });

    const app = await loadApp();
    const res = await app.request("/api/admin/reports/revenue", {
      method: "GET",
      headers: { Authorization: "Bearer token-admin" },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.revenue.totalRevenue).toBe(6.99);
    expect(json.expenses.aiCosts).toMatchObject({
      costPerRun: 0,
      totalCost: 0,
      configured: false,
    });
    expect(json.expenses.infrastructure).toMatchObject({
      monthly: 0,
      configured: false,
    });
    expect(json.profit).toBe(6.99);
  });

  it("aggregates donations, recurring revenue and tracked ai spend in revenue reports", async () => {
    const now = new Date("2026-03-28T12:00:00.000Z").toISOString();
    kvState.store.set("user:admin_user:profile", {
      id: "admin_user",
      tier: "STUDIO PRO",
      role: "superadmin",
    });
    kvState.store.set("users_list", [
      { id: "admin_user" },
      { id: "user_ai" },
    ]);
    kvState.store.set("user:user_ai:activity_log", [
      { action: "ai_spend_tracked", costUsd: 0.03, at: now },
      { action: "ai_spend_tracked", costUsd: 0.07, at: now },
      { action: "tool_credit_consumed", creditCost: 3, at: now },
    ]);
    kvState.store.set("paypal:order:ord_1", {
      orderId: "ord_1",
      status: "COMPLETED",
      expectedAmountUsd: 6.99,
      capturedAmountUsd: 6.99,
      createdAt: now,
      capturedAt: now,
    });
    kvState.store.set("paypal:donation:order:don_1", {
      orderId: "don_1",
      status: "COMPLETED",
      expectedAmountUsd: 10,
      capturedAmountUsd: 10,
      createdAt: now,
      capturedAt: now,
    });
    kvState.store.set("paypal:subscription:payment:pay_1", {
      saleId: "pay_1",
      status: "COMPLETED",
      amountUsd: 12,
      createdAt: now,
      paidAt: now,
    });
    kvState.store.set("admin:costs", {
      aiCostPerRun: 0.002,
      monthlyInfrastructure: 25,
    });
    subscriptionFinanceState.summary = {
      available: true,
      activeSubscriptions: 2,
      mappedActiveSubscriptions: 2,
      unmappedActiveSubscriptions: 0,
      estimatedMonthlyRecurringRevenue: 20.25,
      estimatedAnnualContractValue: 243,
      activeByTier: { PRO: 1, "STUDIO PRO": 1 },
      estimatedMonthlyByTier: { PRO: 12, "STUDIO PRO": 8.25 },
      breakdown: [
        { tier: "PRO", billing: "monthly", count: 1, monthlyEquivalent: 12, annualizedValue: 144 },
        { tier: "STUDIO PRO", billing: "yearly", count: 1, monthlyEquivalent: 8.25, annualizedValue: 99 },
      ],
      unavailableReason: null,
    };

    const app = await loadApp();
    const res = await app.request("/api/admin/reports/revenue", {
      method: "GET",
      headers: { Authorization: "Bearer token-admin" },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.revenue).toMatchObject({
      totalRevenue: 28.99,
      totalTransactions: 3,
      oneTime: { totalRevenue: 6.99, totalOrders: 1 },
      donations: { totalRevenue: 10, totalOrders: 1 },
      subscriptions: {
        confirmedRevenue: 12,
        confirmedPayments: 1,
        estimatedMonthlyRecurringRevenue: 20.25,
        activeSubscriptions: 2,
      },
    });
    expect(json.revenue.revenueByMonth["2026-03"]).toBe(28.99);
    expect(json.expenses.aiCosts).toMatchObject({
      totalRuns: 2,
      trackedSpendUsd: 0.1,
      averageTrackedCostPerRun: 0.05,
      configuredCostPerRun: 0.002,
      estimatedConfiguredCost: 0.004,
      totalCost: 0.1,
    });
    expect(json.expenses.totalExpenses).toBe(25.1);
    expect(json.profit).toBe(3.89);
  });

  it("does not expose default admin costs from the limits endpoint when costs are unset", async () => {
    kvState.store.set("user:admin_user:profile", {
      id: "admin_user",
      tier: "STUDIO PRO",
      role: "superadmin",
    });

    const app = await loadApp();
    const res = await app.request("/api/admin/limits", {
      method: "GET",
      headers: { Authorization: "Bearer token-admin" },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.costs).toEqual({});
    expect(json.costsConfigured).toMatchObject({
      aiCostPerRun: false,
      monthlyInfrastructure: false,
    });
    expect(json.costSuggestions).toMatchObject({
      aiCostPerRun: 0.002,
      monthlyInfrastructure: 25,
    });
  });

  it("requires auth for rewards trigger and ignores client-provided userId", async () => {
    const app = await loadApp();

    const unauthorized = await postJson(
      app,
      "/api/rewards/trigger",
      { userId: "victim_user", action: "daily_login" }
    );
    expect(unauthorized.status).toBe(401);

    const authorized = await postJson(
      app,
      "/api/rewards/trigger",
      { userId: "victim_user", action: "daily_login" },
      "token-free"
    );
    expect(authorized.status).toBe(200);

    expect(kvState.store.get("rewards:victim_user")).toBeUndefined();
    expect(kvState.store.get("rewards:user_free")).toBeTruthy();
  });

  it("enforces ai spend tracking limits per action", async () => {
    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
      tools: {
        ai_studio: {
          label: "AI Studio",
          actions: [
            {
              actionId: "iterate",
              labelKey: "credits.ai.iterate",
              creditCost: 3,
              limits: { free: 1, pro: 20, studioPro: -1 },
              limitPeriod: "month",
            },
          ],
        },
      },
    });

    const app = await loadApp();
    const first = await postJson(
      app,
      "/api/ai/track-spend",
      { costUsd: 0.01, actionId: "iterate" },
      "token-free"
    );
    expect(first.status).toBe(200);

    const second = await postJson(
      app,
      "/api/ai/track-spend",
      { costUsd: 0.02, actionId: "iterate" },
      "token-free"
    );
    expect(second.status).toBe(402);
  });

  it("enforces BYOK access in vault endpoints via tool gating", async () => {
    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("user:user_pro:profile", { id: "user_pro", tier: "PRO", role: "user" });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
      tools: {
        ai_studio: {
          label: "AI Studio",
          actions: [
            {
              actionId: "byok",
              labelKey: "credits.ai.byok",
              creditCost: 0,
              limits: { free: null, pro: -1, studioPro: -1 },
              limitPeriod: "unlimited",
            },
          ],
        },
      },
    });

    const app = await loadApp();

    const blocked = await app.request("/api/vault/keys", {
      method: "GET",
      headers: { Authorization: "Bearer token-free" },
    });
    expect(blocked.status).toBe(403);

    const allowed = await app.request("/api/vault/keys", {
      method: "GET",
      headers: { Authorization: "Bearer token-pro" },
    });
    expect(allowed.status).toBe(200);
  });

  it("enforces relief thumbnail upload limits via server-side gating", async () => {
    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
      tools: {
        relief: {
          label: "Relief",
          actions: [
            {
              actionId: "upload_small",
              labelKey: "credits.relief.upload_small",
              creditCost: 0,
              limits: { free: 1, pro: -1, studioPro: -1 },
              limitPeriod: "day",
            },
            {
              actionId: "upload_medium",
              labelKey: "credits.relief.upload_med",
              creditCost: 1,
              limits: { free: null, pro: 10, studioPro: -1 },
              limitPeriod: "day",
            },
            {
              actionId: "upload_large",
              labelKey: "credits.relief.upload_lg",
              creditCost: 2,
              limits: { free: null, pro: null, studioPro: 5 },
              limitPeriod: "day",
            },
          ],
        },
      },
    });

    const app = await loadApp();
    const first = await postJson(
      app,
      "/api/uploads/thumbnail",
      { data: "AAAA" },
      "token-free"
    );
    expect(first.status).toBe(200);

    const second = await postJson(
      app,
      "/api/uploads/thumbnail",
      { data: "AAAA" },
      "token-free"
    );
    expect(second.status).toBe(402);
  });

  it("rejects paypal create-order when client sends mismatched price", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("admin:credit_packs", [
      { id: "pack_10", name: "Pack Starter", credits: 10, price: 2.99, pricePerCredit: 0.3 },
    ]);

    const app = await loadApp();
    const res = await postJson(
      app,
      "/api/paypal/create-order",
      { packId: "pack_10", price: 9.99 },
      "token-free"
    );

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects paypal create-order when legacy packs are paused", async () => {
    process.env.ENABLE_LEGACY_CREDIT_PACKS = "false";

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });

    const app = await loadApp();
    const res = await postJson(
      app,
      "/api/paypal/create-order",
      { packId: "pack_10", price: 2.99 },
      "token-free"
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(String(json.error)).toContain("pausadas");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails paypal capture on amount mismatch and then succeeds/idempotent on valid capture", async () => {
    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("user:user_free:credits", { freeUsed: 0, purchasedCredits: 0, totalExported: 0 });

    const app = await loadApp();

    kvState.store.set("paypal:order:ord_bad", {
      orderId: "ord_bad",
      userId: "user_free",
      packId: "pack_30",
      credits: 30,
      expectedAmountUsd: 6.99,
      expectedCurrency: "USD",
      status: "CREATED",
      createdAt: new Date().toISOString(),
    });

    const mismatchFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "paypal-token" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          status: "COMPLETED",
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: "CAP_BAD",
                    status: "COMPLETED",
                    amount: { currency_code: "USD", value: "3.00" },
                  },
                ],
              },
            },
          ],
        })
      );
    vi.stubGlobal("fetch", mismatchFetch);

    const bad = await postJson(
      app,
      "/api/paypal/capture-order",
      { orderId: "ord_bad", packId: "pack_30" },
      "token-free"
    );
    expect(bad.status).toBe(400);
    const badStored = kvState.store.get("paypal:order:ord_bad");
    expect(badStored.status).toBe("FAILED");

    kvState.store.set("paypal:order:ord_ok", {
      orderId: "ord_ok",
      userId: "user_free",
      packId: "pack_30",
      credits: 30,
      expectedAmountUsd: 6.99,
      expectedCurrency: "USD",
      status: "CREATED",
      createdAt: new Date().toISOString(),
    });

    const okFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "paypal-token" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          status: "COMPLETED",
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: "CAP_OK",
                    status: "COMPLETED",
                    amount: { currency_code: "USD", value: "6.99" },
                  },
                ],
              },
            },
          ],
        })
      );
    vi.stubGlobal("fetch", okFetch);

    const ok = await postJson(
      app,
      "/api/paypal/capture-order",
      { orderId: "ord_ok", packId: "pack_30" },
      "token-free"
    );
    expect(ok.status).toBe(200);
    const okJson = await ok.json();
    expect(okJson.success).toBe(true);
    expect(okJson.creditsAdded).toBe(30);
    expect(okJson.totalCredits).toBe(36);
    expect(okJson.toolCredits).toMatchObject({
      balance: 36,
      monthlyAllocation: 6,
      monthlyBalance: 6,
      topupBalance: 30,
      totalUsed: 0,
      tier: "FREE",
    });
    expect(kvState.store.get("user:user_free:tool_credits")).toMatchObject({
      balance: 36,
      monthlyAllocation: 6,
      topupBalance: 30,
      totalUsed: 0,
      tier: "FREE",
    });

    const again = await postJson(
      app,
      "/api/paypal/capture-order",
      { orderId: "ord_ok", packId: "pack_30" },
      "token-free"
    );
    expect(again.status).toBe(200);
    const againJson = await again.json();
    expect(againJson.alreadyProcessed).toBe(true);
    expect(againJson.creditsAdded).toBe(0);
    expect(againJson.totalCredits).toBe(36);
  });

  // ─── BG-107: Email transaccional Resend — confirmación de compra ──────────────

  it("BG-107: sends purchase confirmation email via Resend after successful PayPal capture", async () => {
    // RESEND_API_KEY must be set so sendResendEmailBestEffort() doesn't early-exit.
    // The resend module is mocked at module level via resendState (vi.hoisted).
    process.env.RESEND_API_KEY = "re_test_key_mock";

    kvState.store.set("user:user_free:profile", {
      id: "user_free",
      tier: "FREE",
      role: "user",
      email: "buyer@test.local",
    });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
      tools: {},
    });

    kvState.store.set("paypal:order:ord_email_test", {
      orderId: "ord_email_test",
      userId: "user_free",
      packId: "pack_50",
      credits: 50,
      expectedAmountUsd: 9.99,
      expectedCurrency: "USD",
      status: "CREATED",
      createdAt: new Date().toISOString(),
    });

    const okFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "paypal-token" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          status: "COMPLETED",
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: "CAP_EMAIL_OK",
                    status: "COMPLETED",
                    amount: { currency_code: "USD", value: "9.99" },
                  },
                ],
              },
            },
          ],
        })
      );
    vi.stubGlobal("fetch", okFetch);

    const app = await loadApp();

    // Act
    const res = await postJson(
      app,
      "/api/paypal/capture-order",
      { orderId: "ord_email_test", packId: "pack_50" },
      "token-free"
    );

    // Assert — capture succeeds
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.creditsAdded).toBe(50);

    // Assert — email was attempted (best-effort, fire-and-forget — flush microtasks)
    await new Promise((r) => setTimeout(r, 50));
    expect(resendState.emailsSend).toHaveBeenCalledOnce();

    const emailCall = resendState.emailsSend.mock.calls[0][0];
    expect(emailCall.to).toBe("buyer@test.local");
    expect(emailCall.subject).toContain("Confirmación de compra");
    expect(emailCall.html).toContain("50"); // credits added
    expect(emailCall.html).toContain("9.99"); // amount
    expect(emailCall.html).toContain("ord_email_test"); // order ID
    // RESEND_API_KEY cleanup is handled by beforeEach
  });

  it("BG-107: skips purchase email gracefully when RESEND_API_KEY is not set", async () => {
    delete process.env.RESEND_API_KEY;

    kvState.store.set("user:user_free:profile", {
      id: "user_free",
      tier: "FREE",
      role: "user",
      email: "buyer@test.local",
    });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
      tools: {},
    });
    kvState.store.set("paypal:order:ord_no_email", {
      orderId: "ord_no_email",
      userId: "user_free",
      packId: "pack_10",
      credits: 10,
      expectedAmountUsd: 2.99,
      expectedCurrency: "USD",
      status: "CREATED",
      createdAt: new Date().toISOString(),
    });

    const okFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "paypal-token" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          status: "COMPLETED",
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: "CAP_NO_EMAIL",
                    status: "COMPLETED",
                    amount: { currency_code: "USD", value: "2.99" },
                  },
                ],
              },
            },
          ],
        })
      );
    vi.stubGlobal("fetch", okFetch);

    const app = await loadApp();
    const res = await postJson(
      app,
      "/api/paypal/capture-order",
      { orderId: "ord_no_email", packId: "pack_10" },
      "token-free"
    );

    // Capture must still succeed even without Resend configured
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.creditsAdded).toBe(10);
  });
});
