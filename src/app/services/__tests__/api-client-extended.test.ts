/**
 * Extended api-client tests — covers all remaining API objects & normalizer functions.
 * The base api-client.test.ts covers AuthApi, GCodeApi, CreditsApi, rate-limit.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

// Mock analytics
vi.mock("../analytics", () => ({
  trackAnalyticsEvent: vi.fn(),
}));

// Mock config
vi.mock("../../../../utils/config/info", () => ({
  apiUrl: "http://localhost:3001",
}));

import {
  FeedbackApi,
  ContactApi,
  AdminApi,
  CommunityApi,
  RewardsApi,
  PaypalApi,
  SubscriptionsApi,
  NewsApi,
  AiStudioAdminApi,
  AiStudioCMSApi,
  AiStudioRecipesApi,
  AiStudioGenerateApi,
  AiStudioHistoryApi,
  AiQuickFixApi,
  ToolCreditsApi,
  ToolActionsApi,
  ActivityApi,
  AIBudgetApi,
  ContentApi,
  ContributorsApi,
  DonationsApi,
  PromotionsApi,
  VaultApi,
  NewsAdminApi,
  TelemetryApi,
  setStoredToken,
} from "../api-client";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    clone() { return this; },
  });
}

function mockFetchError(error: string, status = 400) {
  return mockFetch({ error }, false, status);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  setStoredToken("test-token");
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ──────────────────────────────────────────────────────────────────────────────
// FeedbackApi
// ──────────────────────────────────────────────────────────────────────────────

describe("FeedbackApi", () => {
  it("submit sends POST with data", async () => {
    globalThis.fetch = mockFetch({ id: "fb1" });
    const result = await FeedbackApi.submit({ type: "bug", message: "broken" });
    expect(result.id).toBe("fb1");
  });

  it("submit throws on error", async () => {
    globalThis.fetch = mockFetchError("Error al enviar feedback");
    await expect(FeedbackApi.submit({ type: "bug", message: "x" })).rejects.toThrow();
  });

  it("list returns items on success", async () => {
    globalThis.fetch = mockFetch({ items: [{ id: "fb1" }] });
    const items = await FeedbackApi.list();
    expect(items).toHaveLength(1);
  });

  it("list returns empty on error", async () => {
    globalThis.fetch = mockFetch("Server error", false, 500);
    const items = await FeedbackApi.list();
    expect(items).toEqual([]);
  });

  it("triggerAIReview sends POST", async () => {
    globalThis.fetch = mockFetch({ success: true });
    const result = await FeedbackApi.triggerAIReview();
    expect(result.success).toBe(true);
  });

  it("getAIStats returns stats", async () => {
    globalThis.fetch = mockFetch({ stats: { total: 10 } });
    const stats = await FeedbackApi.getAIStats();
    expect(stats.total).toBe(10);
  });

  it("getAIStats returns null on error", async () => {
    globalThis.fetch = mockFetch("err", false, 500);
    const stats = await FeedbackApi.getAIStats();
    expect(stats).toBeNull();
  });

  it("updateStatus sends PUT", async () => {
    globalThis.fetch = mockFetch({ status: "resolved" });
    const result = await FeedbackApi.updateStatus("fb1", "resolved");
    expect(result.status).toBe("resolved");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ContactApi
// ──────────────────────────────────────────────────────────────────────────────

describe("ContactApi", () => {
  it("submit sends contact data", async () => {
    globalThis.fetch = mockFetch({ success: true, contactId: "c1" });
    const result = await ContactApi.submit({
      name: "Test",
      email: "t@t.com",
      message: "Hello",
    });
    expect(result.success).toBe(true);
    expect(result.contactId).toBe("c1");
  });

  it("submit throws on error", async () => {
    globalThis.fetch = mockFetchError("Error al enviar contacto");
    await expect(
      ContactApi.submit({ name: "T", email: "t@t.com", message: "x" })
    ).rejects.toThrow("Error al enviar contacto");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ToolCreditsApi
// ──────────────────────────────────────────────────────────────────────────────

describe("ToolCreditsApi", () => {
  it("getMine returns credits", async () => {
    globalThis.fetch = mockFetch({
      credits: { balance: 100, monthlyAllocation: 50, monthlyBalance: 50, topupBalance: 50, totalUsed: 0, lastResetAt: "2024-01-01", tier: "PRO" },
    });
    const credits = await ToolCreditsApi.getMine();
    expect(credits.balance).toBe(100);
    expect(credits.tier).toBe("PRO");
  });

  it("getMine throws on error", async () => {
    globalThis.fetch = mockFetchError("Unauthorized", 401);
    await expect(ToolCreditsApi.getMine()).rejects.toThrow();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ToolActionsApi
// ──────────────────────────────────────────────────────────────────────────────

describe("ToolActionsApi", () => {
  it("consume sends POST with toolId and actionId", async () => {
    globalThis.fetch = mockFetch({
      success: true,
      allowed: true,
      toolId: "editor",
      actionId: "compile",
      consumed: true,
      credits: null,
    });
    const result = await ToolActionsApi.consume("editor", "compile");
    expect(result.success).toBe(true);
    expect(result.allowed).toBe(true);
  });

  it("consume throws when not allowed", async () => {
    globalThis.fetch = mockFetchError("Acción no permitida", 403);
    await expect(ToolActionsApi.consume("editor", "compile")).rejects.toThrow();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ActivityApi
// ──────────────────────────────────────────────────────────────────────────────

describe("ActivityApi", () => {
  it("getMyActivity returns activity list", async () => {
    globalThis.fetch = mockFetch({ activity: [{ type: "compile" }] });
    const activity = await ActivityApi.getMyActivity();
    expect(activity).toHaveLength(1);
  });

  it("getMyActivity returns empty on error", async () => {
    globalThis.fetch = mockFetch({}, false, 401);
    const activity = await ActivityApi.getMyActivity();
    expect(activity).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AIBudgetApi
// ──────────────────────────────────────────────────────────────────────────────

describe("AIBudgetApi", () => {
  it("getStatus returns budget status", async () => {
    globalThis.fetch = mockFetch({
      available: true,
      circuitBreakerTripped: false,
      budgetUtilization: "45%",
    });
    const status = await AIBudgetApi.getStatus();
    expect(status.available).toBe(true);
    expect(status.budgetUtilization).toBe("45%");
  });

  it("trackSpend sends POST", async () => {
    globalThis.fetch = mockFetch({ recorded: true });
    const result = await AIBudgetApi.trackSpend(0.05, "PRO");
    expect(result.recorded).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AiStudioAdminApi
// ──────────────────────────────────────────────────────────────────────────────

describe("AiStudioAdminApi", () => {
  it("getAIConfig returns config", async () => {
    globalThis.fetch = mockFetch({ config: { activeProvider: "gemini", activeModel: "flash" } });
    const config = await AiStudioAdminApi.getAIConfig();
    expect(config.activeProvider).toBe("gemini");
  });

  it("getAIConfig throws when missing config", async () => {
    globalThis.fetch = mockFetch({});
    await expect(AiStudioAdminApi.getAIConfig()).rejects.toThrow("Respuesta inválida");
  });

  it("updateAIConfig sends PUT", async () => {
    globalThis.fetch = mockFetch({ config: { activeProvider: "openai" } });
    const config = await AiStudioAdminApi.updateAIConfig({
      activeProvider: "openai",
      activeModel: "gpt-4",
      manualMode: true,
      alertThresholds: [50, 80],
    });
    expect(config.activeProvider).toBe("openai");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AiStudioCMSApi
// ──────────────────────────────────────────────────────────────────────────────

describe("AiStudioCMSApi", () => {
  it("getFamilies returns list", async () => {
    globalThis.fetch = mockFetch({ families: [{ id: "f1", slug: "vase" }] });
    const families = await AiStudioCMSApi.getFamilies();
    expect(families).toHaveLength(1);
    expect(families[0].slug).toBe("vase");
  });

  it("createFamily sends POST", async () => {
    globalThis.fetch = mockFetch({ family: { id: "f2", slug: "lamp" } });
    const family = await AiStudioCMSApi.createFamily({ slug: "lamp" });
    expect(family.slug).toBe("lamp");
  });

  it("updateFamily sends PUT", async () => {
    globalThis.fetch = mockFetch({ family: { id: "f1", slug: "vase-v2" } });
    const family = await AiStudioCMSApi.updateFamily("f1", { slug: "vase-v2" });
    expect(family.slug).toBe("vase-v2");
  });

  it("deleteFamily sends DELETE", async () => {
    globalThis.fetch = mockFetch({});
    await AiStudioCMSApi.deleteFamily("f1");
    // No throw = success
  });

  it("getPresets returns list", async () => {
    globalThis.fetch = mockFetch({ presets: [{ id: "p1" }] });
    const presets = await AiStudioCMSApi.getPresets();
    expect(presets).toHaveLength(1);
  });

  it("createPreset sends POST", async () => {
    globalThis.fetch = mockFetch({ preset: { id: "p2" } });
    const preset = await AiStudioCMSApi.createPreset({ slug: "modern" });
    expect(preset.id).toBe("p2");
  });

  it("updatePreset sends PUT", async () => {
    globalThis.fetch = mockFetch({ preset: { id: "p1" } });
    const preset = await AiStudioCMSApi.updatePreset("p1", { slug: "classic" });
    expect(preset.id).toBe("p1");
  });

  it("deletePreset sends DELETE", async () => {
    globalThis.fetch = mockFetch({});
    await AiStudioCMSApi.deletePreset("p1");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AiStudioRecipesApi
// ──────────────────────────────────────────────────────────────────────────────

describe("AiStudioRecipesApi", () => {
  it("list returns recipes", async () => {
    globalThis.fetch = mockFetch({ recipes: [{ id: "r1", name: "Vase" }] });
    const recipes = await AiStudioRecipesApi.list();
    expect(recipes).toHaveLength(1);
  });

  it("list throws on error", async () => {
    globalThis.fetch = mockFetchError("Error al listar recipes");
    await expect(AiStudioRecipesApi.list()).rejects.toThrow();
  });

  it("save sends POST", async () => {
    globalThis.fetch = mockFetch({ recipe: { id: "r2", name: "Lamp" } });
    const recipe = await AiStudioRecipesApi.save({
      name: "Lamp",
      prompt: "A modern lamp",
      engine: "fdm",
      quality: "draft",
      familyHint: "lamp",
      parameterOverrides: {},
    });
    expect(recipe.name).toBe("Lamp");
  });

  it("remove sends DELETE", async () => {
    globalThis.fetch = mockFetch({});
    await AiStudioRecipesApi.remove("r1");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AiStudioGenerateApi
// ──────────────────────────────────────────────────────────────────────────────

describe("AiStudioGenerateApi", () => {
  it("generate sends POST and returns result", async () => {
    globalThis.fetch = mockFetch({
      success: true,
      result: { modelName: "vase", scadCode: "cube(10);", parameters: [], reasoning: "ok" },
      contract: { normalized: {}, editor: { spec: {} } },
      usage: { creditsConsumed: 1, balanceRemaining: 9 },
      routing: { mode: "automatic", provider: "gemini", model: "flash", lane: "economy", reason: "ok", traceId: null },
    });
    const result = await AiStudioGenerateApi.generate({
      prompt: "A modern vase",
      engine: "fdm",
      familySlug: "vase",
      quality: "draft",
    });
    expect(result.success).toBe(true);
    expect(result.result.scadCode).toBe("cube(10);");
  });

  it("generate throws on error response", async () => {
    globalThis.fetch = mockFetch({ success: false, error: "Budget exhausted", code: "BUDGET_EXHAUSTED" });
    await expect(
      AiStudioGenerateApi.generate({
        prompt: "test",
        engine: "fdm",
        familySlug: "vase",
        quality: "draft",
      })
    ).rejects.toThrow("Budget exhausted");
  });

  it("getGenerationResult returns null on error", async () => {
    globalThis.fetch = mockFetch({}, false, 404);
    const result = await AiStudioGenerateApi.getGenerationResult("gen-123");
    expect(result).toBeNull();
  });

  it("getGenerationResult returns null on non-success", async () => {
    globalThis.fetch = mockFetch({ success: false });
    const result = await AiStudioGenerateApi.getGenerationResult("gen-123");
    expect(result).toBeNull();
  });

  it("getGenerationResult returns null on fetch exception", async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("Network"));
    const result = await AiStudioGenerateApi.getGenerationResult("gen-123");
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AiStudioHistoryApi
// ──────────────────────────────────────────────────────────────────────────────

describe("AiStudioHistoryApi", () => {
  it("list returns history", async () => {
    globalThis.fetch = mockFetch({ history: [{ id: "h1" }] });
    const history = await AiStudioHistoryApi.list();
    expect(history).toHaveLength(1);
  });

  it("list throws on error", async () => {
    globalThis.fetch = mockFetchError("Error al listar historial AI");
    await expect(AiStudioHistoryApi.list()).rejects.toThrow();
  });

  it("save sends POST", async () => {
    globalThis.fetch = mockFetch({ entry: { id: "h2" } });
    const entry = await AiStudioHistoryApi.save({
      prompt: "test",
      engine: "fdm",
      quality: "draft",
      modelName: "vase",
      scadCode: "cube(10);",
      spec: {} as any,
      validation: {} as any,
      compilePreview: {} as any,
    });
    expect(entry.id).toBe("h2");
  });

  it("remove sends DELETE", async () => {
    globalThis.fetch = mockFetch({});
    await AiStudioHistoryApi.remove("h1");
  });

  it("remove throws on error", async () => {
    globalThis.fetch = mockFetchError("Error al eliminar historial AI");
    await expect(AiStudioHistoryApi.remove("h1")).rejects.toThrow();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AiQuickFixApi
// ──────────────────────────────────────────────────────────────────────────────

describe("AiQuickFixApi", () => {
  it("generateFix returns fixed code", async () => {
    globalThis.fetch = mockFetch({ data: "cube(10, center=true);" });
    const fix = await AiQuickFixApi.generateFix("cube(10);", "Not centered");
    expect(fix).toBe("cube(10, center=true);");
  });

  it("generateFix throws on error", async () => {
    globalThis.fetch = mockFetchError("Error al conectar con Vorea Quick Fix");
    await expect(AiQuickFixApi.generateFix("x", "err")).rejects.toThrow();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// CommunityApi
// ──────────────────────────────────────────────────────────────────────────────

describe("CommunityApi", () => {
  it("listModels returns models", async () => {
    globalThis.fetch = mockFetch({ models: [{ id: "m1" }], total: 1, page: 1, limit: 20 });
    const result = await CommunityApi.listModels();
    expect(result.models).toHaveLength(1);
  });

  it("listModels with filters appends query params", async () => {
    globalThis.fetch = mockFetch({ models: [], total: 0, page: 1, limit: 10 });
    await CommunityApi.listModels({ search: "vase", tag: "organic", sort: "popular", page: 2, limit: 10 });
    const calledUrl = (globalThis.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain("search=vase");
    expect(calledUrl).toContain("tag=organic");
    expect(calledUrl).toContain("sort=popular");
  });

  it("getModel returns model", async () => {
    globalThis.fetch = mockFetch({ model: { id: "m1", title: "Vase" } });
    const model = await CommunityApi.getModel("m1");
    expect(model.title).toBe("Vase");
  });

  it("getModel throws on not found", async () => {
    globalThis.fetch = mockFetchError("Modelo no encontrado", 404);
    await expect(CommunityApi.getModel("bad")).rejects.toThrow();
  });

  it("publishModel sends POST", async () => {
    globalThis.fetch = mockFetch({ model: { id: "m2", title: "Lamp" } });
    const model = await CommunityApi.publishModel({ title: "Lamp" });
    expect(model.title).toBe("Lamp");
  });

  it("updateModel sends PUT", async () => {
    globalThis.fetch = mockFetch({ model: { id: "m1", title: "Updated" } });
    const model = await CommunityApi.updateModel("m1", { title: "Updated" });
    expect(model.title).toBe("Updated");
  });

  it("deleteModel sends DELETE", async () => {
    globalThis.fetch = mockFetch({});
    await CommunityApi.deleteModel("m1");
  });

  it("toggleLike returns like state", async () => {
    globalThis.fetch = mockFetch({ liked: true, likes: 5 });
    const result = await CommunityApi.toggleLike("m1");
    expect(result.liked).toBe(true);
    expect(result.likes).toBe(5);
  });

  it("downloadModel returns source", async () => {
    globalThis.fetch = mockFetch({ scadSource: "cube(10);", downloads: 42 });
    const result = await CommunityApi.downloadModel("m1");
    expect(result.scadSource).toBe("cube(10);");
    expect(result.downloads).toBe(42);
  });

  it("listTags returns tags", async () => {
    globalThis.fetch = mockFetch({ tags: [{ name: "organic", slug: "organic", modelCount: 5 }] });
    const tags = await CommunityApi.listTags();
    expect(tags).toHaveLength(1);
  });

  it("listTags returns empty on error", async () => {
    globalThis.fetch = mockFetch({}, false, 500);
    const tags = await CommunityApi.listTags();
    expect(tags).toEqual([]);
  });

  it("getUserProfile returns profile", async () => {
    globalThis.fetch = mockFetch({ user: { id: "u1" }, models: [] });
    const profile = await CommunityApi.getUserProfile("u1");
    expect(profile.user.id).toBe("u1");
  });

  it("getComments returns comments", async () => {
    globalThis.fetch = mockFetch({ comments: [{ id: "c1", text: "Nice!" }] });
    const comments = await CommunityApi.getComments("m1");
    expect(comments).toHaveLength(1);
  });

  it("getComments returns empty on error", async () => {
    globalThis.fetch = mockFetch({}, false, 401);
    const comments = await CommunityApi.getComments("m1");
    expect(comments).toEqual([]);
  });

  it("addComment sends POST", async () => {
    globalThis.fetch = mockFetch({ comment: { id: "c2" } });
    const result = await CommunityApi.addComment("m1", "Great work!");
    expect(result.comment.id).toBe("c2");
  });

  it("deleteComment sends DELETE", async () => {
    globalThis.fetch = mockFetch({ success: true });
    await CommunityApi.deleteComment("m1", "c1");
  });

  it("toggleFeatured sends POST", async () => {
    globalThis.fetch = mockFetch({ model: { id: "m1", featured: true } });
    const model = await CommunityApi.toggleFeatured("m1");
    expect(model.featured).toBe(true);
  });

  it("listForks returns forks", async () => {
    globalThis.fetch = mockFetch({ forks: [{ id: "m3" }], total: 1 });
    const result = await CommunityApi.listForks("m1");
    expect(result.forks).toHaveLength(1);
  });

  it("listForks returns empty on error", async () => {
    globalThis.fetch = mockFetch({}, false, 500);
    const result = await CommunityApi.listForks("m1");
    expect(result).toEqual({ forks: [], total: 0 });
  });

  it("saveDraft calls publishModel with draft status", async () => {
    globalThis.fetch = mockFetch({ model: { id: "draft-1", status: "draft" } });
    const model = await CommunityApi.saveDraft({ title: "WIP", scadSource: "cube(5);" });
    expect(model.status).toBe("draft");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// RewardsApi
// ──────────────────────────────────────────────────────────────────────────────

describe("RewardsApi", () => {
  it("getMyRewards returns rewards", async () => {
    globalThis.fetch = mockFetch({ rewards: { xp: 100, level: 2 } });
    const rewards = await RewardsApi.getMyRewards();
    expect(rewards.xp).toBe(100);
  });

  it("getMyRewards returns null on error", async () => {
    globalThis.fetch = mockFetch({}, false, 401);
    const rewards = await RewardsApi.getMyRewards();
    expect(rewards).toBeNull();
  });

  it("getLeaderboard returns list", async () => {
    globalThis.fetch = mockFetch({ leaderboard: [{ userId: "u1", xp: 500 }] });
    const lb = await RewardsApi.getLeaderboard();
    expect(lb).toHaveLength(1);
  });

  it("getLeaderboard returns empty on error", async () => {
    globalThis.fetch = mockFetch({}, false, 500);
    const lb = await RewardsApi.getLeaderboard();
    expect(lb).toEqual([]);
  });

  it("getProfile returns profile", async () => {
    globalThis.fetch = mockFetch({ level: 3, xp: 200 });
    const profile = await RewardsApi.getProfile("u1");
    expect(profile.level).toBe(3);
  });

  it("triggerAction sends POST", async () => {
    globalThis.fetch = mockFetch({ xpGained: 10 });
    const result = await RewardsApi.triggerAction("u1", "publish_model");
    expect(result.xpGained).toBe(10);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// PaypalApi
// ──────────────────────────────────────────────────────────────────────────────

describe("PaypalApi", () => {
  it("getClientId returns config", async () => {
    globalThis.fetch = mockFetch({ clientId: "abc123", mode: "sandbox" });
    const config = await PaypalApi.getClientId();
    expect(config?.clientId).toBe("abc123");
  });

  it("getClientId returns null on error", async () => {
    globalThis.fetch = mockFetch({}, false, 500);
    const config = await PaypalApi.getClientId();
    expect(config).toBeNull();
  });

  it("getClientId returns null on fetch exception", async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("Network"));
    const config = await PaypalApi.getClientId();
    expect(config).toBeNull();
  });

  it("createOrder sends POST", async () => {
    globalThis.fetch = mockFetch({ orderId: "ord-1", status: "CREATED", approveUrl: "https://paypal.com/approve" });
    const result = await PaypalApi.createOrder("pack-1", "10 credits", 9.99);
    expect(result.orderId).toBe("ord-1");
  });

  it("captureOrder sends POST", async () => {
    globalThis.fetch = mockFetch({ success: true, credits: 10, totalCredits: 50, message: "ok" });
    const result = await PaypalApi.captureOrder("ord-1", "pack-1");
    expect(result.success).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SubscriptionsApi
// ──────────────────────────────────────────────────────────────────────────────

describe("SubscriptionsApi", () => {
  it("createSubscription sends POST", async () => {
    globalThis.fetch = mockFetch({ subscriptionId: "sub-1", status: "APPROVAL_PENDING", approveUrl: "https://paypal.com" });
    const result = await SubscriptionsApi.createSubscription("PRO");
    expect(result.subscriptionId).toBe("sub-1");
  });

  it("getMySubscription returns null when not subscribed", async () => {
    globalThis.fetch = mockFetch({}, false, 404);
    const sub = await SubscriptionsApi.getMySubscription();
    expect(sub).toBeNull();
  });

  it("getMySubscription returns subscription", async () => {
    globalThis.fetch = mockFetch({ subscription: { tier: "PRO", status: "active" } });
    const sub = await SubscriptionsApi.getMySubscription();
    expect(sub.tier).toBe("PRO");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// NewsApi
// ──────────────────────────────────────────────────────────────────────────────

describe("NewsApi", () => {
  it("list returns normalized articles", async () => {
    globalThis.fetch = mockFetch({
      articles: [
        {
          id: "n1",
          slug: "test-article",
          title: "Test Article",
          titleDisplayEs: "Artículo de prueba",
          summaryEs: "Resumen",
          detailEs: "Detalle completo",
          canonicalUrl: "https://example.com/article",
          tags: ["3dprinting", "news"],
          availableLanguages: ["es", "en"],
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    });
    const result = await NewsApi.list();
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].slug).toBe("test-article");
    expect(result.articles[0].tags).toEqual(["3dprinting", "news"]);
    expect(result.total).toBe(1);
  });

  it("list with params appends query string", async () => {
    globalThis.fetch = mockFetch({ articles: [], total: 0, page: 1, limit: 10 });
    await NewsApi.list({ source: "all3dp", category: "reviews", lang: "en", page: 2, limit: 5 });
    const calledUrl = (globalThis.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain("source=all3dp");
    expect(calledUrl).toContain("category=reviews");
    expect(calledUrl).toContain("lang=en");
  });

  it("list throws on error", async () => {
    globalThis.fetch = mockFetch({ error: "Server error" }, false, 500);
    await expect(NewsApi.list()).rejects.toThrow();
  });

  it("getBySlug returns normalized article", async () => {
    globalThis.fetch = mockFetch({
      article: {
        id: "n1",
        slug: "test",
        title: "Test",
        titleOriginal: "Original",
        canonicalUrl: "https://example.com",
        tags: [],
      },
    });
    const article = await NewsApi.getBySlug("test");
    expect(article.slug).toBe("test");
    expect(article.canonicalUrl).toBe("https://example.com");
  });

  it("getBySlug throws on not found", async () => {
    globalThis.fetch = mockFetch({ error: "Noticia no encontrada" }, false, 404);
    await expect(NewsApi.getBySlug("bad-slug")).rejects.toThrow("Noticia no encontrada");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ContentApi
// ──────────────────────────────────────────────────────────────────────────────

describe("ContentApi", () => {
  it("getHeroBanner returns config", async () => {
    globalThis.fetch = mockFetch({ config: { title: "Welcome" } });
    const config = await ContentApi.getHeroBanner();
    expect(config?.title).toBe("Welcome");
  });

  it("getHeroBanner returns null on error", async () => {
    globalThis.fetch = mockFetch({}, false, 500);
    const config = await ContentApi.getHeroBanner();
    expect(config).toBeNull();
  });

  it("getHeroBanner returns null on fetch exception", async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("Network"));
    const config = await ContentApi.getHeroBanner();
    expect(config).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ContributorsApi
// ──────────────────────────────────────────────────────────────────────────────

describe("ContributorsApi", () => {
  it("list returns tiers and contributors", async () => {
    globalThis.fetch = mockFetch({
      tiers: [{ id: "impulsor", suggestedAmountUsd: 5 }],
      contributors: [{ userId: "u1" }],
      stats: { publicContributors: 1 },
    });
    const result = await ContributorsApi.list();
    expect(result.tiers).toHaveLength(1);
    expect(result.contributors).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// DonationsApi
// ──────────────────────────────────────────────────────────────────────────────

describe("DonationsApi", () => {
  it("getMine returns donations summary", async () => {
    globalThis.fetch = mockFetch({
      tiers: [],
      summary: { totalDonatedUsd: 25 },
      donations: [{ orderId: "o1" }],
    });
    const result = await DonationsApi.getMine();
    expect(result.summary?.totalDonatedUsd).toBe(25);
    expect(result.donations).toHaveLength(1);
  });

  it("updateMine sends PUT", async () => {
    globalThis.fetch = mockFetch({ summary: { publicContributor: true } });
    const result = await DonationsApi.updateMine({ publicContributor: true });
    expect(result.summary?.publicContributor).toBe(true);
  });

  it("createOrder sends POST", async () => {
    globalThis.fetch = mockFetch({
      orderId: "ord-1",
      status: "CREATED",
      tierId: "impulsor",
      amountUsd: 5,
      visibility: "public",
      approveUrl: "https://paypal.com",
    });
    const result = await DonationsApi.createOrder({
      tierId: "impulsor",
      isPublic: true,
      message: "Thanks!",
    });
    expect(result.orderId).toBe("ord-1");
  });

  it("captureOrder sends POST", async () => {
    globalThis.fetch = mockFetch({
      success: true,
      donationId: "d1",
      tierId: "impulsor",
      badgeId: "contributor",
      totalDonatedUsd: 5,
      publicContributor: true,
    });
    const result = await DonationsApi.captureOrder("ord-1");
    expect(result.success).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// PromotionsApi
// ──────────────────────────────────────────────────────────────────────────────

describe("PromotionsApi", () => {
  it("validateCoupon sends POST", async () => {
    globalThis.fetch = mockFetch({ valid: true, discount: 20 });
    const result = await PromotionsApi.validateCoupon("SAVE20", "PRO");
    expect(result.valid).toBe(true);
  });

  it("redeemCoupon sends POST", async () => {
    globalThis.fetch = mockFetch({ redeemed: true, credits: 50 });
    const result = await PromotionsApi.redeemCoupon("promo-1");
    expect(result.redeemed).toBe(true);
  });

  it("redeemCoupon throws on error", async () => {
    globalThis.fetch = mockFetchError("Error al canjear cupón");
    await expect(PromotionsApi.redeemCoupon("bad")).rejects.toThrow();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// VaultApi
// ──────────────────────────────────────────────────────────────────────────────

describe("VaultApi", () => {
  it("listKeys returns keys and providers", async () => {
    globalThis.fetch = mockFetch({ keys: [{ provider: "openai", maskedKey: "sk-...abc" }], supportedProviders: ["openai", "anthropic"] });
    const result = await VaultApi.listKeys();
    expect(result?.keys).toHaveLength(1);
    expect(result?.supportedProviders).toContain("openai");
  });

  it("listKeys returns null on error", async () => {
    globalThis.fetch = mockFetch({}, false, 401);
    const result = await VaultApi.listKeys();
    expect(result).toBeNull();
  });

  it("saveKey sends PUT", async () => {
    globalThis.fetch = mockFetch({ success: true, provider: "openai", maskedKey: "sk-...xyz", label: "My Key" });
    const result = await VaultApi.saveKey("openai", "sk-realkey123", "My Key");
    expect(result.success).toBe(true);
  });

  it("deleteKey sends DELETE", async () => {
    globalThis.fetch = mockFetch({ success: true });
    const result = await VaultApi.deleteKey("openai");
    expect(result.success).toBe(true);
  });

  it("testKey sends POST", async () => {
    globalThis.fetch = mockFetch({ valid: true, message: "Key is valid", provider: "openai" });
    const result = await VaultApi.testKey("openai");
    expect(result.valid).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// NewsAdminApi
// ──────────────────────────────────────────────────────────────────────────────

describe("NewsAdminApi", () => {
  it("listSources returns sources", async () => {
    globalThis.fetch = mockFetch({ sources: [{ id: "s1", slug: "all3dp" }] });
    const sources = await NewsAdminApi.listSources();
    expect(sources).toHaveLength(1);
  });

  it("createSource sends POST", async () => {
    globalThis.fetch = mockFetch({ source: { id: "s2", slug: "hackaday" } });
    const source = await NewsAdminApi.createSource({ name: "Hackaday" });
    expect(source.slug).toBe("hackaday");
  });

  it("updateSource sends PUT", async () => {
    globalThis.fetch = mockFetch({ source: { id: "s1", name: "Updated" } });
    const source = await NewsAdminApi.updateSource("s1", { name: "Updated" });
    expect(source.name).toBe("Updated");
  });

  it("deleteSource sends DELETE", async () => {
    globalThis.fetch = mockFetch({ success: true });
    await NewsAdminApi.deleteSource("s1");
  });

  it("triggerIngest sends POST", async () => {
    globalThis.fetch = mockFetch({ insertedCount: 5, updatedCount: 2, skippedCount: 0 });
    const result = await NewsAdminApi.triggerIngest();
    expect(result.insertedCount).toBe(5);
  });

  it("getSourceStats returns stats", async () => {
    globalThis.fetch = mockFetch({ stats: [{ sourceId: "s1", total: 10 }] });
    const stats = await NewsAdminApi.getSourceStats();
    expect(stats).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// TelemetryApi
// ──────────────────────────────────────────────────────────────────────────────

describe("TelemetryApi", () => {
  it("getInsights returns telemetry data", async () => {
    globalThis.fetch = mockFetch({
      daysBack: 30,
      totalEvents: 100,
      byTrigger: [],
      bySurfaceMode: [],
      byMeshScore: [],
      warningCombos: [],
      avgGenTime: [],
    });
    const insights = await TelemetryApi.getInsights(30);
    expect(insights.totalEvents).toBe(100);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// AdminApi (partial — test representative methods)
// ──────────────────────────────────────────────────────────────────────────────

describe("AdminApi", () => {
  it("checkSuperAdmin returns admin status", async () => {
    globalThis.fetch = mockFetch({ isSuperAdmin: true });
    const result = await AdminApi.checkSuperAdmin();
    expect(result.isSuperAdmin).toBe(true);
  });

  it("checkSuperAdmin returns false on error", async () => {
    globalThis.fetch = mockFetch({}, false, 403);
    const result = await AdminApi.checkSuperAdmin();
    expect(result.isSuperAdmin).toBe(false);
  });

  it("listUsers returns users", async () => {
    globalThis.fetch = mockFetch({ users: [{ id: "u1" }] });
    const result = await AdminApi.listUsers();
    expect(result.users).toHaveLength(1);
  });

  it("updateUser sends PUT", async () => {
    globalThis.fetch = mockFetch({ user: { id: "u1", tier: "PRO" } });
    const result = await AdminApi.updateUser("u1", { tier: "PRO" });
    expect(result.user.tier).toBe("PRO");
  });

  it("deleteUser sends DELETE", async () => {
    globalThis.fetch = mockFetch({ success: true });
    await AdminApi.deleteUser("u1");
  });

  it("getPlans returns plans", async () => {
    globalThis.fetch = mockFetch({ plans: [{ tier: "FREE" }] });
    const plans = await AdminApi.getPlans();
    expect(plans).toHaveLength(1);
  });

  it("getUsageReport returns usage", async () => {
    globalThis.fetch = mockFetch({ usage: { totalUsers: 100 } });
    const usage = await AdminApi.getUsageReport();
    expect(usage.totalUsers).toBe(100);
  });

  it("getRevenueReport returns revenue", async () => {
    globalThis.fetch = mockFetch({ revenue: 1000 });
    const result = await AdminApi.getRevenueReport();
    expect(result.revenue).toBe(1000);
  });

  it("getRegionalStats returns stats", async () => {
    globalThis.fetch = mockFetch({
      byRegion: { LATAM: 10 },
      byCountry: [{ country: "UY", count: 5 }],
      totalWithCountry: 10,
      totalWithoutCountry: 2,
      total: 12,
    });
    const stats = await AdminApi.getRegionalStats();
    expect(stats.total).toBe(12);
  });

  it("getKPI returns KPIs", async () => {
    globalThis.fetch = mockFetch({ kpi: { dau: 50 } });
    const kpi = await AdminApi.getKPI();
    expect(kpi.dau).toBe(50);
  });

  it("getCreditPacks returns packs", async () => {
    globalThis.fetch = mockFetch({ creditPacks: [{ id: "p1" }] });
    const packs = await AdminApi.getCreditPacks();
    expect(packs).toHaveLength(1);
  });

  it("getLimits returns limits", async () => {
    globalThis.fetch = mockFetch({ limits: {}, costs: {} });
    const result = await AdminApi.getLimits();
    expect(result.limits).toBeDefined();
  });

  it("getAlerts returns alerts", async () => {
    globalThis.fetch = mockFetch({ alerts: { budget: true } });
    const alerts = await AdminApi.getAlerts();
    expect(alerts.budget).toBe(true);
  });

  it("sendEmail sends POST", async () => {
    globalThis.fetch = mockFetch({ sent: true });
    const result = await AdminApi.sendEmail({ subject: "Test", message: "Hello" });
    expect(result.sent).toBe(true);
  });

  it("getLogs returns logs", async () => {
    globalThis.fetch = mockFetch({ logs: [{ level: "info" }] });
    const logs = await AdminApi.getLogs();
    expect(logs).toHaveLength(1);
  });

  it("addExpense sends POST", async () => {
    globalThis.fetch = mockFetch({ id: "exp-1" });
    const result = await AdminApi.addExpense({ description: "Server", amount: 50 });
    expect(result.id).toBe("exp-1");
  });

  it("getAIBudget returns budget", async () => {
    globalThis.fetch = mockFetch({
      budget: { globalMonthlyBudgetUsd: 100 },
      computed: { effectiveBudget: 100 },
    });
    const budget = await AdminApi.getAIBudget();
    expect(budget.budget.globalMonthlyBudgetUsd).toBe(100);
  });

  it("getAIBudget throws on invalid response", async () => {
    globalThis.fetch = mockFetch({});
    await expect(AdminApi.getAIBudget()).rejects.toThrow("Respuesta inválida");
  });

  it("getHeroBanner returns config", async () => {
    globalThis.fetch = mockFetch({ config: { enabled: true } });
    const config = await AdminApi.getHeroBanner();
    expect(config.enabled).toBe(true);
  });

  it("updateHeroBanner sends PUT", async () => {
    globalThis.fetch = mockFetch({ config: { enabled: false } });
    const config = await AdminApi.updateHeroBanner({ enabled: false });
    expect(config.enabled).toBe(false);
  });

  it("listDonations returns donations", async () => {
    globalThis.fetch = mockFetch({
      donations: [{ orderId: "o1" }],
      contributors: [{ userId: "u1" }],
      stats: { totalOrders: 1, completedOrders: 1, failedOrders: 0, publicContributors: 1, uniqueContributors: 1, totalCapturedUsd: 5 },
    });
    const result = await AdminApi.listDonations();
    expect(result.donations).toHaveLength(1);
    expect(result.stats.totalOrders).toBe(1);
  });

  it("listCommunityModels returns models with filters", async () => {
    globalThis.fetch = mockFetch({ models: [], total: 0, page: 1, limit: 20 });
    const result = await AdminApi.listCommunityModels({ q: "vase", status: "published" });
    expect(result.total).toBe(0);
    const calledUrl = (globalThis.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain("q=vase");
    expect(calledUrl).toContain("status=published");
  });

  it("cleanupDuplicates sends POST", async () => {
    globalThis.fetch = mockFetch({ cleaned: 5 });
    const result = await AdminApi.cleanupDuplicates(true);
    expect(result.cleaned).toBe(5);
  });

  it("resetOwnerPassword sends POST", async () => {
    globalThis.fetch = mockFetch({ success: true });
    const result = await AdminApi.resetOwnerPassword("admin@vorea.com", "NewP@ss1");
    expect(result.success).toBe(true);
  });

  it("getLaneMatrixConfig returns config", async () => {
    globalThis.fetch = mockFetch({ matrix: {} });
    const result = await AdminApi.getLaneMatrixConfig();
    expect(result).toBeDefined();
  });

  it("resetLaneMatrixConfig sends DELETE", async () => {
    globalThis.fetch = mockFetch({ reset: true });
    const result = await AdminApi.resetLaneMatrixConfig();
    expect(result.reset).toBe(true);
  });

  it("getToolCredits returns tool credits", async () => {
    globalThis.fetch = mockFetch({ toolCredits: { free: 10 } });
    const result = await AdminApi.getToolCredits();
    expect(result.free).toBe(10);
  });

  it("updateToolCredits sends PUT", async () => {
    globalThis.fetch = mockFetch({ toolCredits: { free: 20 } });
    const result = await AdminApi.updateToolCredits({ free: 20 });
    expect(result.free).toBe(20);
  });

  it("getImageLimits returns limits", async () => {
    globalThis.fetch = mockFetch({ imageLimits: { maxSize: 5 } });
    const result = await AdminApi.getImageLimits();
    expect(result.maxSize).toBe(5);
  });

  it("updateImageLimits sends PUT", async () => {
    globalThis.fetch = mockFetch({ imageLimits: { maxSize: 10 } });
    const result = await AdminApi.updateImageLimits({ maxSize: 10 });
    expect(result.maxSize).toBe(10);
  });

  it("getPromotions returns promotions", async () => {
    globalThis.fetch = mockFetch({ promotions: [{ id: "p1" }] });
    const promotions = await AdminApi.getPromotions();
    expect(promotions).toHaveLength(1);
  });

  it("deletePromotion sends DELETE", async () => {
    globalThis.fetch = mockFetch({ success: true });
    await AdminApi.deletePromotion("p1");
  });

  it("listEmails returns emails", async () => {
    globalThis.fetch = mockFetch({ emails: [{ id: "e1" }] });
    const emails = await AdminApi.listEmails();
    expect(emails).toHaveLength(1);
  });

  it("getUserActivity returns activity", async () => {
    globalThis.fetch = mockFetch({ activity: [{ type: "login" }] });
    const activity = await AdminApi.getUserActivity("u1");
    expect(activity).toHaveLength(1);
  });

  it("getLegacyTopUpStatus returns status", async () => {
    globalThis.fetch = mockFetch({ totalUsersScanned: 100, affectedUsers: 5 });
    const result = await AdminApi.getLegacyTopUpStatus();
    expect(result.totalUsersScanned).toBe(100);
  });

  it("runLegacyTopUpBackfill sends POST", async () => {
    globalThis.fetch = mockFetch({ success: true, migratedUsers: 3 });
    const result = await AdminApi.runLegacyTopUpBackfill();
    expect(result.success).toBe(true);
  });

  it("updateContributorVisibility sends PUT", async () => {
    globalThis.fetch = mockFetch({ summary: { publicContributor: false } });
    const result = await AdminApi.updateContributorVisibility("u1", { publicContributor: false });
    expect(result.publicContributor).toBe(false);
  });
});
