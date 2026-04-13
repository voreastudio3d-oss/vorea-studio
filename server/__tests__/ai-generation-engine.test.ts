/**
 * AI Generation Engine tests — pure functions, config normalization,
 * budget logic, prompt building, parse helpers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock kv module
const mockKvStore = new Map<string, unknown>();
vi.mock("../kv.js", () => ({
  get: vi.fn((key: string) => mockKvStore.get(key) ?? null),
  set: vi.fn((key: string, value: unknown) => { mockKvStore.set(key, value); }),
}));

import {
  buildScadSystemPrompt,
  checkAIBudget,
  recordAIUsage,
  normalizeAIProviderConfig,
  getModelCostPer1kTokens,
  getAIProviderModelCandidates,
  type LLMGenerationInput,
  type AIProviderConfig,
} from "../ai-generation-engine";

describe("ai-generation-engine", () => {
  beforeEach(() => {
    mockKvStore.clear();
    vi.clearAllMocks();
  });

  // ── buildScadSystemPrompt ─────────────────────────────────────────────
  describe("buildScadSystemPrompt", () => {
    it("builds a prompt for draft fdm quality", () => {
      const prompt = buildScadSystemPrompt(
        "rounded-box",
        "Rounded Box",
        [{ name: "width", type: "number", defaultValue: 50, min: 10, max: 200, step: 1, description: "Box width" }],
        "cube([width, width, width]);",
        "draft",
        "fdm"
      );
      expect(prompt).toContain("rounded-box");
      expect(prompt).toContain("Rounded Box");
      expect(prompt).toContain("width");
      expect(prompt).toContain("$fn bajo");
      expect(prompt).toContain("FDM");
      expect(prompt).toContain("cube([width, width, width])");
    });

    it("builds a prompt for final organic quality", () => {
      const prompt = buildScadSystemPrompt(
        "vase",
        "Organic Vase",
        [],
        undefined,
        "final",
        "organic"
      );
      expect(prompt).toContain("$fn alto");
      expect(prompt).toContain("orgánico");
      expect(prompt).toContain("No hay template base");
    });

    it("includes parameter docs when provided", () => {
      const prompt = buildScadSystemPrompt(
        "jar",
        "Jar",
        [
          { name: "radius", type: "number", defaultValue: 20, min: 5, max: 100, step: 1, description: "Jar radius" },
          { name: "height", type: "number", defaultValue: 50, description: "Jar height" },
        ],
        undefined,
        "draft",
        "fdm"
      );
      expect(prompt).toContain("radius");
      expect(prompt).toContain("Jar radius");
      expect(prompt).toContain("Default: 20");
      expect(prompt).toContain("min: 5");
    });

    it("omits parameters section when empty", () => {
      const prompt = buildScadSystemPrompt("box", "Box", [], undefined, "draft", "fdm");
      expect(prompt).not.toContain("Parámetros disponibles");
    });
  });

  // ── checkAIBudget ─────────────────────────────────────────────────────
  describe("checkAIBudget", () => {
    it("allows when no budget state set (uses defaults)", async () => {
      const result = await checkAIBudget("user1", "FREE");
      expect(result.allowed).toBe(true);
    });

    it("blocks when budget exhausted", async () => {
      mockKvStore.set("admin:ai_budget", {
        globalMonthlyBudgetUsd: 100,
        maxBudgetPercentOfRevenue: 100,
        currentMonthSpentUsd: 100,
        currentMonth: new Date().toISOString().slice(0, 7),
        perTierDailyLimits: { FREE: 1, PRO: 20, "STUDIO PRO": -1 },
        circuitBreakerEnabled: true,
      });

      const result = await checkAIBudget("user1", "FREE");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("agotado");
    });

    it("allows when circuit breaker disabled", async () => {
      mockKvStore.set("admin:ai_budget", {
        globalMonthlyBudgetUsd: 0,
        currentMonthSpentUsd: 999,
        currentMonth: new Date().toISOString().slice(0, 7),
        perTierDailyLimits: {},
        circuitBreakerEnabled: false,
      });

      const result = await checkAIBudget("user1", "FREE");
      expect(result.allowed).toBe(true);
    });

    it("blocks when daily limit reached for FREE tier", async () => {
      const today = new Date().toISOString().slice(0, 10);
      mockKvStore.set(`ai_usage:user1:${today}`, 1);
      mockKvStore.set("admin:ai_budget", {
        globalMonthlyBudgetUsd: 100,
        currentMonthSpentUsd: 0,
        currentMonth: new Date().toISOString().slice(0, 7),
        perTierDailyLimits: { FREE: 1, PRO: 20, "STUDIO PRO": -1 },
        circuitBreakerEnabled: true,
      });

      const result = await checkAIBudget("user1", "FREE");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Límite diario");
    });

    it("allows STUDIO PRO with unlimited daily (-1)", async () => {
      mockKvStore.set("admin:ai_budget", {
        globalMonthlyBudgetUsd: 100,
        currentMonthSpentUsd: 0,
        currentMonth: new Date().toISOString().slice(0, 7),
        perTierDailyLimits: { FREE: 1, PRO: 20, "STUDIO PRO": -1 },
        circuitBreakerEnabled: true,
      });

      const result = await checkAIBudget("user1", "STUDIO PRO");
      expect(result.allowed).toBe(true);
    });

    it("resets counter on new month", async () => {
      mockKvStore.set("admin:ai_budget", {
        globalMonthlyBudgetUsd: 100,
        currentMonthSpentUsd: 99,
        currentMonth: "2020-01", // old month
        perTierDailyLimits: { FREE: 1 },
        circuitBreakerEnabled: true,
      });

      const result = await checkAIBudget("user1", "STUDIO PRO");
      expect(result.allowed).toBe(true);
    });
  });

  // ── recordAIUsage ─────────────────────────────────────────────────────
  describe("recordAIUsage", () => {
    it("increments monthly spend", async () => {
      await recordAIUsage("user1", 0.01);
      const budget = mockKvStore.get("admin:ai_budget") as any;
      expect(budget.currentMonthSpentUsd).toBeGreaterThan(0);
    });

    it("increments daily counter", async () => {
      await recordAIUsage("user1", 0.005);
      const today = new Date().toISOString().slice(0, 10);
      const dailyCount = mockKvStore.get(`ai_usage:user1:${today}`);
      expect(dailyCount).toBe(1);
    });
  });

  // ── normalizeAIProviderConfig ─────────────────────────────────────────
  describe("normalizeAIProviderConfig", () => {
    it("returns full config from null input", () => {
      const config = normalizeAIProviderConfig(null);
      expect(config.activeProvider).toBe("gemini");
      expect(config.providers).toBeDefined();
      expect(config.alertThresholds).toEqual([50, 75, 90]);
    });

    it("preserves valid stored values", () => {
      const config = normalizeAIProviderConfig({
        activeProvider: "gemini",
        activeModel: "gemini-2.5-flash",
        manualMode: true,
        alertThresholds: [25, 50, 90],
      });
      expect(config.activeModel).toBe("gemini-2.5-flash");
      expect(config.manualMode).toBe(true);
      expect(config.alertThresholds).toEqual([25, 50, 90]);
    });

    it("falls back to default for invalid provider", () => {
      const config = normalizeAIProviderConfig({
        activeProvider: "nonexistent",
      });
      // Should fallback to a valid provider
      expect(config.providers[config.activeProvider]).toBeDefined();
    });

    it("deduplicates and sorts alert thresholds", () => {
      const config = normalizeAIProviderConfig({
        alertThresholds: [90, 50, 50, 25],
      });
      expect(config.alertThresholds).toEqual([25, 50, 90]);
    });

    it("filters invalid alert threshold values", () => {
      const config = normalizeAIProviderConfig({
        alertThresholds: [-10, 50, 150, NaN],
      });
      expect(config.alertThresholds).toEqual([50]);
    });
  });

  // ── getModelCostPer1kTokens ───────────────────────────────────────────
  describe("getModelCostPer1kTokens", () => {
    it("returns cost for known model", () => {
      const cost = getModelCostPer1kTokens("gemini", "gemini-2.5-pro");
      expect(cost).toBe(0.00125);
    });

    it("returns cost for flash model", () => {
      const cost = getModelCostPer1kTokens("gemini", "gemini-2.5-flash");
      expect(cost).toBe(0.00015);
    });

    it("returns default cost for unknown model", () => {
      const cost = getModelCostPer1kTokens("gemini", "nonexistent-model");
      expect(cost).toBeGreaterThan(0);
    });

    it("returns cost for OpenAI models", () => {
      const cost = getModelCostPer1kTokens("openai", "gpt-4o");
      expect(cost).toBe(0.005);
    });

    it("returns cost for Anthropic models", () => {
      const cost = getModelCostPer1kTokens("anthropic", "claude-sonnet-4-20250514");
      expect(cost).toBe(0.003);
    });

    it("returns cost for DeepSeek models", () => {
      const cost = getModelCostPer1kTokens("deepseek", "deepseek-chat");
      expect(cost).toBe(0.00014);
    });
  });

  // ── getAIProviderModelCandidates ──────────────────────────────────────
  describe("getAIProviderModelCandidates", () => {
    it("returns candidates for all providers", () => {
      const candidates = getAIProviderModelCandidates();
      expect(candidates.length).toBeGreaterThan(5);
      
      const providers = [...new Set(candidates.map((c) => c.provider))];
      expect(providers).toContain("gemini");
      expect(providers).toContain("openai");
      expect(providers).toContain("anthropic");
      expect(providers).toContain("deepseek");
      expect(providers).toContain("kimi");
    });

    it("each candidate has required fields", () => {
      const candidates = getAIProviderModelCandidates();
      for (const c of candidates) {
        expect(c.provider).toBeTruthy();
        expect(c.model).toBeTruthy();
        expect(c.modelLabel).toBeTruthy();
        expect(typeof c.costPer1kTokens).toBe("number");
        expect(typeof c.available).toBe("boolean");
        expect(typeof c.implemented).toBe("boolean");
        expect(typeof c.healthy).toBe("boolean");
      }
    });

    it("all providers are marked as implemented", () => {
      const candidates = getAIProviderModelCandidates();
      for (const c of candidates) {
        expect(c.implemented).toBe(true);
      }
    });
  });
});
