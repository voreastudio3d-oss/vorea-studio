/**
 * Business Config — Credit System Tests
 * Tests the default configuration, limits, credit packs, and tier rules.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_PLANS,
  DEFAULT_CREDIT_PACKS,
  DEFAULT_LIMITS,
  DEFAULT_CONFIG,
  DEFAULT_TOOL_CREDITS,
  getBusinessConfigSync,
  invalidateBusinessConfigCache,
} from "../business-config";
import type { MembershipTier } from "../types";

// ─── Default Plans ───────────────────────────────────────────────────────────

describe("DEFAULT_PLANS", () => {
  it("should have exactly 3 tiers: FREE, PRO, STUDIO PRO", () => {
    expect(DEFAULT_PLANS).toHaveLength(3);
    const tiers = DEFAULT_PLANS.map((p) => p.tier);
    expect(tiers).toEqual(["FREE", "PRO", "STUDIO PRO"]);
  });

  it("FREE plan should have price 0", () => {
    const free = DEFAULT_PLANS.find((p) => p.tier === "FREE")!;
    expect(free.price).toBe(0);
    expect(free.yearlyPrice).toBe(0);
  });

  it("PRO plan should be highlighted", () => {
    const pro = DEFAULT_PLANS.find((p) => p.tier === "PRO")!;
    expect(pro.highlighted).toBe(true);
  });

  it("PRO price should be less than STUDIO PRO", () => {
    const pro = DEFAULT_PLANS.find((p) => p.tier === "PRO")!;
    const studioPro = DEFAULT_PLANS.find((p) => p.tier === "STUDIO PRO")!;
    expect(pro.price).toBeLessThan(studioPro.price);
    expect(pro.yearlyPrice).toBeLessThan(studioPro.yearlyPrice);
  });

  it("yearly price should be cheaper per-month than monthly", () => {
    for (const plan of DEFAULT_PLANS) {
      if (plan.price === 0) continue;
      const monthlyFromYearly = plan.yearlyPrice / 12;
      expect(monthlyFromYearly).toBeLessThan(plan.price);
    }
  });

  it("each plan should have at least 3 features", () => {
    for (const plan of DEFAULT_PLANS) {
      expect(plan.features.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("should NOT contain phantom features (API access, Team, Analytics)", () => {
    const allFeatures = DEFAULT_PLANS.flatMap((p) => p.features).join(" ");
    expect(allFeatures).not.toContain("API access");
    expect(allFeatures).not.toContain("Team collaboration");
    expect(allFeatures).not.toContain("Advanced analytics");
    expect(allFeatures).not.toContain("Colaboracion en equipo");
    expect(allFeatures).not.toContain("Analytics avanzados");
  });

  it("AI generation phrasing should be monthly (not daily) in plan features", () => {
    const allFeatures = DEFAULT_PLANS.flatMap((p) => p.features).join(" ").toLowerCase();
    expect(allFeatures).toContain("por mes");
    expect(allFeatures).not.toContain("por dia");
  });
});

// ─── Credit Packs ────────────────────────────────────────────────────────────

describe("DEFAULT_CREDIT_PACKS", () => {
  it("should have 3 packs", () => {
    expect(DEFAULT_CREDIT_PACKS).toHaveLength(3);
  });

  it("each pack should have valid pricePerCredit", () => {
    for (const pack of DEFAULT_CREDIT_PACKS) {
      expect(pack.credits).toBeGreaterThan(0);
      expect(pack.price).toBeGreaterThan(0);
      expect(pack.pricePerCredit).toBeCloseTo(pack.price / pack.credits, 1);
    }
  });

  it("larger packs should have lower per-credit cost", () => {
    const sorted = [...DEFAULT_CREDIT_PACKS].sort((a, b) => a.credits - b.credits);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].pricePerCredit).toBeLessThan(sorted[i - 1].pricePerCredit);
    }
  });

  it("exactly one pack should be marked popular", () => {
    const popular = DEFAULT_CREDIT_PACKS.filter((p) => p.popular);
    expect(popular).toHaveLength(1);
  });

  it("pack IDs should be unique", () => {
    const ids = DEFAULT_CREDIT_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── Business Limits ─────────────────────────────────────────────────────────

describe("DEFAULT_LIMITS", () => {
  const tiers: MembershipTier[] = ["FREE", "PRO", "STUDIO PRO"];

  it("freeExportLimit should be 6", () => {
    expect(DEFAULT_LIMITS.freeExportLimit).toBe(6);
  });

  it("all tiers should have AI generation limits defined", () => {
    for (const tier of tiers) {
      expect(DEFAULT_LIMITS.aiGenerationsPerMonth[tier]).toBeDefined();
    }
  });

  it("FREE AI generations should be positive and limited", () => {
    expect(DEFAULT_LIMITS.aiGenerationsPerMonth.FREE).toBeGreaterThan(0);
    expect(DEFAULT_LIMITS.aiGenerationsPerMonth.FREE).toBeLessThan(100);
  });

  it("STUDIO PRO should have unlimited AI (-1)", () => {
    expect(DEFAULT_LIMITS.aiGenerationsPerMonth["STUDIO PRO"]).toBe(-1);
  });

  it("PRO AI limit should be >= FREE AI limit", () => {
    const freeAi = DEFAULT_LIMITS.aiGenerationsPerMonth.FREE;
    const proAi = DEFAULT_LIMITS.aiGenerationsPerMonth.PRO;
    // PRO can be -1 (unlimited) which is conceptually >= any positive value
    expect(proAi === -1 || proAi >= freeAi).toBe(true);
  });

  it("FREE should only have STL export format", () => {
    expect(DEFAULT_LIMITS.exportFormats.FREE).toEqual(["STL"]);
  });

  it("PRO should include STL, OBJ, 3MF", () => {
    expect(DEFAULT_LIMITS.exportFormats.PRO).toContain("STL");
    expect(DEFAULT_LIMITS.exportFormats.PRO).toContain("OBJ");
    expect(DEFAULT_LIMITS.exportFormats.PRO).toContain("3MF");
  });

  it("STUDIO PRO should include SCAD", () => {
    expect(DEFAULT_LIMITS.exportFormats["STUDIO PRO"]).toContain("SCAD");
  });

  it("higher tiers should have >= format count", () => {
    const freeCount = DEFAULT_LIMITS.exportFormats.FREE.length;
    const proCount = DEFAULT_LIMITS.exportFormats.PRO.length;
    const studioProCount = DEFAULT_LIMITS.exportFormats["STUDIO PRO"].length;
    expect(proCount).toBeGreaterThanOrEqual(freeCount);
    expect(studioProCount).toBeGreaterThanOrEqual(proCount);
  });

  it("all tiers should have maxActiveProjects defined", () => {
    for (const tier of tiers) {
      expect(DEFAULT_LIMITS.maxActiveProjects[tier]).toBeDefined();
    }
  });

  it("FREE maxActiveProjects should be limited (>0)", () => {
    expect(DEFAULT_LIMITS.maxActiveProjects.FREE).toBeGreaterThan(0);
    expect(DEFAULT_LIMITS.maxActiveProjects.FREE).toBeLessThan(100);
  });
});

// ─── Tool Credits ────────────────────────────────────────────────────────────

describe("DEFAULT_TOOL_CREDITS", () => {
  it("creditValueUsd should be positive", () => {
    expect(DEFAULT_TOOL_CREDITS.creditValueUsd).toBeGreaterThan(0);
  });

  it("monthlyCredits should be defined for all tiers", () => {
    expect(DEFAULT_TOOL_CREDITS.monthlyCredits.FREE).toBeDefined();
    expect(DEFAULT_TOOL_CREDITS.monthlyCredits.PRO).toBeDefined();
    expect(DEFAULT_TOOL_CREDITS.monthlyCredits["STUDIO PRO"]).toBeDefined();
  });

  it("monthly credits should increase with tier", () => {
    const free = DEFAULT_TOOL_CREDITS.monthlyCredits.FREE;
    const pro = DEFAULT_TOOL_CREDITS.monthlyCredits.PRO;
    const studioPro = DEFAULT_TOOL_CREDITS.monthlyCredits["STUDIO PRO"];
    expect(pro).toBeGreaterThan(free);
    expect(studioPro).toBeGreaterThan(pro);
  });

  it("FREE monthly credits should match freeExportLimit", () => {
    expect(DEFAULT_TOOL_CREDITS.monthlyCredits.FREE).toBe(DEFAULT_LIMITS.freeExportLimit);
  });
});

// ─── Config Sync ─────────────────────────────────────────────────────────────

describe("getBusinessConfigSync", () => {
  beforeEach(() => {
    invalidateBusinessConfigCache();
  });

  it("should return default config when cache is empty", () => {
    const config = getBusinessConfigSync();
    expect(config.plans).toEqual(DEFAULT_PLANS);
    expect(config.creditPacks).toEqual(DEFAULT_CREDIT_PACKS);
    expect(config.limits).toEqual(DEFAULT_LIMITS);
    expect(config.currency).toBe("USD");
  });

  it("invalidateBusinessConfigCache should clear cache", () => {
    // After invalidation, sync should still return defaults
    invalidateBusinessConfigCache();
    const config = getBusinessConfigSync();
    expect(config).toEqual(DEFAULT_CONFIG);
  });
});

// ─── Cross-config consistency ────────────────────────────────────────────────

describe("Cross-config consistency", () => {
  it("credit pack prices should be in USD range (0.99–99.99)", () => {
    for (const pack of DEFAULT_CREDIT_PACKS) {
      expect(pack.price).toBeGreaterThanOrEqual(0.99);
      expect(pack.price).toBeLessThanOrEqual(99.99);
    }
  });

  it("plan prices should be reasonable (0–100 USD/month)", () => {
    for (const plan of DEFAULT_PLANS) {
      expect(plan.price).toBeGreaterThanOrEqual(0);
      expect(plan.price).toBeLessThanOrEqual(100);
    }
  });

  it("all tier values should use space not underscore", () => {
    const tiers = DEFAULT_PLANS.map((p) => p.tier);
    for (const tier of tiers) {
      expect(tier).not.toContain("_");
    }
  });

  it("config imageLimits should have all tiers", () => {
    const config = getBusinessConfigSync();
    expect(config.imageLimits).toHaveProperty("free");
    expect(config.imageLimits).toHaveProperty("pro");
    expect(config.imageLimits).toHaveProperty("studioPro");
  });

  it("image maxBytes should increase with tier", () => {
    const config = getBusinessConfigSync();
    const freeMax = config.imageLimits.free.maxBytes;
    const proMax = config.imageLimits.pro.maxBytes;
    const studioMax = config.imageLimits.studioPro.maxBytes;
    expect(proMax).toBeGreaterThan(freeMax);
    expect(studioMax).toBeGreaterThan(proMax);
  });
});
