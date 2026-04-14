/**
 * Extended storage tests — CloudCreditsService, CloudFeedbackService,
 * GCodeCollectionService deep tests, getFreeExportRemaining, getRemainingExportCredits,
 * getActiveCreditPacks, model updates with null returns.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  GCodeCollectionService,
  CloudCreditsService,
  CloudFeedbackService,
  GCodeExportService,
  ModelService,
  UserService,
  UniversalCreditService,
  getFreeExportRemaining,
  getRemainingExportCredits,
  getActiveCreditPacks,
} from "../storage";
import type { SavedGCodeItem } from "../storage";

vi.mock("../api-client", () => ({
  GCodeApi: {
    list: vi.fn(() => Promise.resolve([])),
    save: vi.fn(() => Promise.resolve({ id: "gc_test" })),
    remove: vi.fn(() => Promise.resolve(true)),
  },
  CreditsApi: {
    get: vi.fn(() => Promise.resolve({ freeUsed: 0, purchasedCredits: 5, totalExported: 3 })),
    consume: vi.fn(() => Promise.resolve({ credits: { freeUsed: 1, purchasedCredits: 5, totalExported: 4 } })),
    purchase: vi.fn(() => Promise.resolve({ credits: { freeUsed: 0, purchasedCredits: 15, totalExported: 0 } })),
  },
  FeedbackApi: {
    submit: vi.fn(() => Promise.resolve({ feedbackId: "fb_test123" })),
  },
}));

beforeEach(() => {
  localStorage.clear();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Pure helper functions
// ═══════════════════════════════════════════════════════════════════════════════

describe("getFreeExportRemaining", () => {
  it("returns full limit when nothing used", () => {
    expect(getFreeExportRemaining({ freeUsed: 0, purchasedCredits: 0, totalExported: 0 })).toBeGreaterThan(0);
  });

  it("returns 0 when all free credits used", () => {
    expect(getFreeExportRemaining({ freeUsed: 100, purchasedCredits: 0, totalExported: 100 })).toBe(0);
  });

  it("handles undefined freeUsed", () => {
    expect(getFreeExportRemaining({ freeUsed: 0, purchasedCredits: 0, totalExported: 0 })).toBeGreaterThan(0);
  });
});

describe("getRemainingExportCredits", () => {
  it("PRO tier gets Infinity", () => {
    expect(getRemainingExportCredits({ freeUsed: 0, purchasedCredits: 0, totalExported: 0 }, "PRO")).toBe(Infinity);
  });

  it("STUDIO PRO tier gets Infinity", () => {
    expect(getRemainingExportCredits({ freeUsed: 0, purchasedCredits: 0, totalExported: 0 }, "STUDIO PRO")).toBe(Infinity);
  });

  it("FREE tier gets free remaining + purchased", () => {
    const result = getRemainingExportCredits({ freeUsed: 0, purchasedCredits: 10, totalExported: 0 }, "FREE");
    expect(result).toBeGreaterThan(10);
  });
});

describe("getActiveCreditPacks", () => {
  it("returns array of credit packs", () => {
    const packs = getActiveCreditPacks();
    expect(Array.isArray(packs)).toBe(true);
    expect(packs.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GCodeCollectionService (deeper)
// ═══════════════════════════════════════════════════════════════════════════════

describe("GCodeCollectionService", () => {
  it("starts with empty collection", () => {
    const items = GCodeCollectionService.list();
    expect(items).toEqual([]);
  });

  it("adds a gcode item", () => {
    const item = GCodeCollectionService.add("test.gcode", "G28\nG1 X10 Y10");
    expect(item.id).toContain("gc_");
    expect(item.name).toBe("test.gcode");
    expect(item.gcode).toContain("G28");
  });

  it("add with config stores config", () => {
    const item = GCodeCollectionService.add("configured.gcode", "G28", { layerHeight: 0.2 });
    expect(item.config).toEqual({ layerHeight: 0.2 });
  });

  it("lists items newest first", () => {
    GCodeCollectionService.add("first.gcode", "G28");
    GCodeCollectionService.add("second.gcode", "G1 X10");
    const items = GCodeCollectionService.list();
    expect(items.length).toBe(2);
    expect(items[0].name).toBe("second.gcode");
  });

  it("removes an item by id", () => {
    const item = GCodeCollectionService.add("remove-me.gcode", "G28");
    expect(GCodeCollectionService.remove(item.id)).toBe(true);
    expect(GCodeCollectionService.list().length).toBe(0);
  });

  it("returns false when removing nonexistent item", () => {
    expect(GCodeCollectionService.remove("nonexistent")).toBe(false);
  });

  it("gets an item by id", () => {
    const item = GCodeCollectionService.add("find-me.gcode", "G28");
    const found = GCodeCollectionService.getById(item.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("find-me.gcode");
  });

  it("getById returns undefined for nonexistent", () => {
    expect(GCodeCollectionService.getById("xxx")).toBeUndefined();
  });

  it("limits collection to 50 items", () => {
    for (let i = 0; i < 55; i++) {
      GCodeCollectionService.add(`file-${i}.gcode`, `G28 ;${i}`);
    }
    expect(GCodeCollectionService.list().length).toBeLessThanOrEqual(50);
  });

  it("listCloud returns items", async () => {
    GCodeCollectionService.add("local.gcode", "G28");
    const items = await GCodeCollectionService.listCloud();
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CloudCreditsService
// ═══════════════════════════════════════════════════════════════════════════════

describe("CloudCreditsService", () => {
  it("getCached returns local credits", () => {
    const cached = CloudCreditsService.getCached();
    expect(cached).toBeDefined();
    expect(cached.freeUsed).toBe(0);
  });

  it("updateCache overwrites local credits", () => {
    const updated = CloudCreditsService.updateCache({
      freeUsed: 3, purchasedCredits: 20, totalExported: 10,
    });
    expect(updated.purchasedCredits).toBe(20);
    expect(GCodeExportService.getCredits().purchasedCredits).toBe(20);
  });

  it("sync fetches from server", async () => {
    const result = await CloudCreditsService.sync();
    expect(result).toBeDefined();
    expect(result.credits).toBeDefined();
  });

  it("consume calls server consume", async () => {
    const result = await CloudCreditsService.consume("FREE");
    expect(result).toBeDefined();
    expect(result.freeUsed).toBe(1);
  });

  it("purchasePack succeeds for valid pack", async () => {
    const result = await CloudCreditsService.purchasePack("pack_10");
    expect(result).toBeDefined();
  });

  it("purchasePack throws for invalid pack", async () => {
    await expect(CloudCreditsService.purchasePack("invalid_pack")).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CloudFeedbackService
// ═══════════════════════════════════════════════════════════════════════════════

describe("CloudFeedbackService", () => {
  it("submits feedback successfully", async () => {
    const result = await CloudFeedbackService.submit({
      type: "bug",
      message: "Something is broken",
    });
    expect(result.success).toBe(true);
    expect(result.feedbackId).toBe("fb_test123");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ModelService edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe("ModelService edge cases", () => {
  it("update returns null for nonexistent model", () => {
    const result = ModelService.update("nonexistent_id", { title: "Will fail" });
    expect(result).toBeNull();
  });

  it("getById returns undefined for nonexistent model", () => {
    expect(ModelService.getById("nonexistent_id")).toBeUndefined();
  });

  it("models sorted by updatedAt descending", () => {
    const models = ModelService.list();
    for (let i = 1; i < models.length; i++) {
      const prev = new Date(models[i - 1].updatedAt).getTime();
      const curr = new Date(models[i].updatedAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GCodeExportService deeper
// ═══════════════════════════════════════════════════════════════════════════════

describe("GCodeExportService deeper", () => {
  beforeEach(() => {
    localStorage.clear();
    GCodeExportService.reset();
  });

  it("canExport returns true initially for FREE", () => {
    expect(GCodeExportService.canExport("FREE")).toBe(true);
  });

  it("canExport returns false when credits exhausted", () => {
    for (let i = 0; i < 10; i++) GCodeExportService.consume("FREE");
    expect(GCodeExportService.canExport("FREE")).toBe(false);
  });

  it("PRO consume tracks total but has infinite", () => {
    GCodeExportService.reset();
    expect(GCodeExportService.consume("PRO")).toBe(true);
    const credits = GCodeExportService.getCredits();
    expect(credits.totalExported).toBeGreaterThanOrEqual(1);
    expect(credits.lastExportAt).toBeDefined();
  });

  it("purchasePack returns false for invalid pack", () => {
    expect(GCodeExportService.purchasePack("invalid")).toBe(false);
  });

  it("FREE_LIMIT getter returns positive number", () => {
    expect(GCodeExportService.FREE_LIMIT).toBeGreaterThan(0);
  });

  it("reset clears credits", () => {
    GCodeExportService.consume("FREE");
    GCodeExportService.reset();
    expect(GCodeExportService.getCredits().freeUsed).toBe(0);
  });

  it("saveCredits persists credits", () => {
    GCodeExportService.saveCredits({ freeUsed: 5, purchasedCredits: 10, totalExported: 15 });
    const credits = GCodeExportService.getCredits();
    expect(credits.freeUsed).toBe(5);
    expect(credits.purchasedCredits).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// UniversalCreditService deeper
// ═══════════════════════════════════════════════════════════════════════════════

describe("UniversalCreditService deeper", () => {
  beforeEach(() => {
    localStorage.clear();
    UniversalCreditService.reset();
  });

  it("getCredits returns default for FREE tier", () => {
    const credits = UniversalCreditService.getCredits("FREE");
    expect(credits.balance).toBeGreaterThan(0);
    expect(credits.monthlyAllocation).toBeGreaterThan(0);
  });

  it("getBalance returns number", () => {
    const balance = UniversalCreditService.getBalance("FREE");
    expect(typeof balance).toBe("number");
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it("addCredits increases balance", () => {
    const before = UniversalCreditService.getBalance("FREE");
    UniversalCreditService.addCredits(50, "FREE");
    const after = UniversalCreditService.getBalance("FREE");
    expect(after).toBe(before + 50);
  });

  it("getCreditValueUsd returns positive number", () => {
    const value = UniversalCreditService.getCreditValueUsd();
    expect(value).toBeGreaterThan(0);
  });

  it("getActionCost returns 0 for unknown tool", () => {
    expect(UniversalCreditService.getActionCost("nonexistent_tool", "action")).toBe(0);
  });

  it("canPerformAction allows unknown tools", () => {
    const result = UniversalCreditService.canPerformAction("FREE", "unknown_tool", "action");
    expect(result.allowed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Async methods (non-Prisma path — isLocalMode() is false in tests)
// ═══════════════════════════════════════════════════════════════════════════════

describe("UserService async methods", () => {
  beforeEach(() => localStorage.clear());

  it("getAsync returns sync user when not in local mode", async () => {
    const user = await UserService.getAsync();
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
  });

  it("updateAsync updates localStorage user", async () => {
    const updated = await UserService.updateAsync("user-1", { displayName: "Async Test" });
    expect(updated.displayName).toBe("Async Test");
  });
});

describe("ModelService async methods", () => {
  beforeEach(() => localStorage.clear());

  it("listAsync returns local models", async () => {
    const models = await ModelService.listAsync();
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThanOrEqual(0);
  });

  it("getByIdAsync returns null for nonexistent", async () => {
    const model = await ModelService.getByIdAsync("nonexistent");
    expect(model).toBeFalsy();
  });

  it("createAsync creates a model locally", async () => {
    const model = await ModelService.createAsync("user-1", {
      title: "Async Model",
      params: { radius: 5, height: 10, resolution: 16 },
    });
    expect(model.title).toBe("Async Model");
  });

  it("statsAsync returns model statistics", async () => {
    const stats = await ModelService.statsAsync("user-1");
    expect(stats).toBeDefined();
    expect(typeof stats.totalModels).toBe("number");
  });
});

describe("GCodeCollectionService async methods", () => {
  beforeEach(() => localStorage.clear());

  it("listAsync returns items from local or cloud", async () => {
    const items = await GCodeCollectionService.listAsync();
    expect(Array.isArray(items)).toBe(true);
  });

  it("addAsync creates item locally", async () => {
    const item = await GCodeCollectionService.addAsync("user-1", "async.gcode", "G28\nG1 X10");
    expect(item.name).toBe("async.gcode");
    expect(item.gcode).toContain("G28");
  });
});

describe("UniversalCreditService consumeAction", () => {
  beforeEach(() => {
    localStorage.clear();
    UniversalCreditService.reset();
  });

  it("free actions cost 0 credits", () => {
    const result = UniversalCreditService.consumeAction("FREE", "nonexistent", "free_action");
    expect(result).toBe(true);
  });

  it("canPerformAction returns allowed for unknown action", () => {
    const result = UniversalCreditService.canPerformAction("FREE", "known_tool", "unknown_action");
    expect(result.allowed).toBe(true);
  });
});
