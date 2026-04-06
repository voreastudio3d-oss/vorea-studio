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

const aiStudioPipelineState = vi.hoisted(() => ({
  executeNormalizedGeneration: vi.fn(),
  recordGenerationTrace: vi.fn(),
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
  verifyJwt: () => null,
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

vi.mock("../prisma.js", () => ({
  getPrismaClient: () => ({}),
}));

vi.mock("../ai-generation-engine.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../ai-generation-engine.js")>();
  return {
    ...actual,
    checkAIBudget: vi.fn(async () => ({ allowed: true })),
    recordAIUsage: vi.fn(async () => {}),
    getModelCostPer1kTokens: vi.fn(() => 0.001),
  };
});

vi.mock("../ai-studio-pipeline.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../ai-studio-pipeline.js")>();
  return {
    ...actual,
    executeNormalizedGeneration: aiStudioPipelineState.executeNormalizedGeneration,
    recordGenerationTrace: aiStudioPipelineState.recordGenerationTrace,
  };
});

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

describe("app ai-studio generate integration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
    authState.tokens.set("token-free", "user_free");
    process.env.PAYPAL_CLIENT_ID = "test-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
    process.env.PAYPAL_MODE = "sandbox";
    aiStudioPipelineState.executeNormalizedGeneration.mockRejectedValue(
      new Error("forced pipeline failure")
    );
    aiStudioPipelineState.recordGenerationTrace.mockResolvedValue(undefined);
  });

  it("refunds balance, topupBalance and totalUsed when AI Studio fails after precharge", async () => {
    kvState.store.set("user:user_free:profile", {
      id: "user_free",
      tier: "FREE",
      role: "user",
    });
    kvState.store.set("user:user_free:tool_credits", {
      balance: 8,
      topupBalance: 5,
      totalUsed: 11,
      monthlyAllocation: 6,
      monthlyIssuedAt: "2026-04-01T00:00:00.000Z",
    });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
      tools: {
        ai_studio: {
          label: "AI Studio",
          actions: [
            {
              actionId: "text_to_3d_simple",
              labelKey: "credits.ai.t2d_simple",
              creditCost: 7,
              limits: { free: 1, pro: 20, studioPro: -1 },
              limitPeriod: "month",
            },
          ],
        },
      },
    });

    const app = await loadApp();
    const response = await postJson(
      app,
      "/api/ai-studio/generate",
      {
        prompt: "Caja organizadora simple",
        engine: "fdm",
        familySlug: "storage-box",
        quality: "draft",
      },
      "token-free"
    );

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toMatchObject({
      success: false,
      code: "GENERATION_FAILED",
      error: "forced pipeline failure",
    });
    expect(aiStudioPipelineState.executeNormalizedGeneration).toHaveBeenCalledOnce();
    expect(aiStudioPipelineState.recordGenerationTrace).toHaveBeenCalledOnce();
    expect(kvState.store.get("user:user_free:tool_credits")).toMatchObject({
      balance: 8,
      topupBalance: 5,
      totalUsed: 11,
      monthlyAllocation: 6,
    });
  });

  it("returns cached result without charging again on idempotent replay", async () => {
    // Pre-seed an already-completed idempotency record
    const generationId = "gen-idempotent-test-001";
    const cachedPayload = {
      status: "completed",
      createdAt: "2026-04-04T00:00:00.000Z",
      resolvedAt: "2026-04-04T00:00:01.000Z",
      result: { scadCode: "cube([10,10,10]);", modelName: "mock-model" },
      contract: {},
      routing: { traceId: "trace-001", generationId },
      usage: { creditsConsumed: 7, balanceRemaining: 1 },
    };
    kvState.store.set(`idempotency:ai-gen:${generationId}`, cachedPayload);

    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    // Balance is low — would fail if it tried to charge
    kvState.store.set("user:user_free:tool_credits", {
      balance: 0,
      topupBalance: 0,
      totalUsed: 50,
    });

    const app = await loadApp();
    const response = await postJson(
      app,
      "/api/ai-studio/generate",
      {
        generationId,
        prompt: "Caja organizadora simple",
        engine: "fdm",
        familySlug: "storage-box",
        quality: "draft",
      },
      "token-free"
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.cached).toBe(true);
    // LLM was never called
    expect(aiStudioPipelineState.executeNormalizedGeneration).not.toHaveBeenCalled();
    // Credits were not changed
    expect(kvState.store.get("user:user_free:tool_credits")).toMatchObject({
      balance: 0,
      totalUsed: 50,
    });
  });

  it("returns 409 when a generation with the same generationId is already in-progress", async () => {
    const generationId = "gen-in-progress-test-001";
    kvState.store.set(`idempotency:ai-gen:${generationId}`, {
      status: "in-progress",
      createdAt: new Date().toISOString(),
    });

    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("user:user_free:tool_credits", {
      balance: 20,
      topupBalance: 0,
      totalUsed: 0,
    });

    const app = await loadApp();
    const response = await postJson(
      app,
      "/api/ai-studio/generate",
      {
        generationId,
        prompt: "Caja organizadora simple",
        engine: "fdm",
        familySlug: "storage-box",
        quality: "draft",
      },
      "token-free"
    );

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json).toMatchObject({
      success: false,
      code: "GENERATION_IN_PROGRESS",
    });
    expect(aiStudioPipelineState.executeNormalizedGeneration).not.toHaveBeenCalled();
  });

  it("persists generation result in KV before responding 200 on success", async () => {
    const generationId = "gen-success-persist-001";
    const mockResult = {
      scadCode: "cube([20,20,20]);",
      modelName: "gemini-pro",
      description: "A 20mm cube",
      parameters: [],
      warnings: [],
    };
    aiStudioPipelineState.executeNormalizedGeneration.mockResolvedValue({
      result: mockResult,
      normalized: {
        promptRaw: "Cubo grande",
        promptClean: "Cubo grande",
        promptCanonical: "cubo grande",
        promptNormalized: "Cubo grande",
        engine: "fdm",
        quality: "draft",
        requestedFamilySlug: "storage-box",
        resolvedFamilySlug: "storage-box",
        familyDisplayName: "Storage Box",
        sourceRecipeId: null,
        locale: null,
        intent: "create_from_scratch",
        parameterOverrides: {},
        parameterSchema: [],
        warnings: [],
        riskFlags: [],
        scadTemplate: undefined,
        monetization: { tier: "FREE", creditCost: 5, channel: "draft" },
      },
      routing: {
        mode: "automatic",
        provider: "google",
        model: "gemini-pro",
        lane: "economy",
        reason: "default",
        attemptHistory: [],
      },
      traceId: "trace-persist-001",
    });

    kvState.store.set("user:user_free:profile", { id: "user_free", tier: "FREE", role: "user" });
    kvState.store.set("user:user_free:tool_credits", {
      balance: 10,
      topupBalance: 0,
      totalUsed: 0,
      monthlyAllocation: 10,
    });
    kvState.store.set("admin:tool_credits", {
      creditValueUsd: 0.05,
      monthlyCredits: { FREE: 10, PRO: 200, "STUDIO PRO": 500 },
      tools: {
        ai_studio: {
          label: "AI Studio",
          actions: [
            { actionId: "text_to_3d_simple", creditCost: 5 },
          ],
        },
      },
    });

    const app = await loadApp();
    const response = await postJson(
      app,
      "/api/ai-studio/generate",
      {
        generationId,
        prompt: "Cubo grande",
        engine: "fdm",
        familySlug: "storage-box",
        quality: "draft",
      },
      "token-free"
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);

    // Result must be persisted in KV BEFORE the response was sent
    const persisted = kvState.store.get(`idempotency:ai-gen:${generationId}`);
    expect(persisted).toBeDefined();
    expect(persisted.status).toBe("completed");
    expect(persisted.result).toMatchObject({ scadCode: mockResult.scadCode });
    expect(persisted.resolvedAt).toBeDefined();
  });
});
