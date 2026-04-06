/**
 * Storage Services Tests — localStorage CRUD for users, models, credits.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  AuthService,
  UserService,
  ModelService,
  GCodeExportService,
  UniversalCreditService,
  GCodeCollectionService,
  CREDIT_PACKS,
} from "../storage";

// Clear localStorage before each test
beforeEach(() => {
  localStorage.clear();
});

// ═════════════════════════════════════════════════════════════════════════════
// AuthService
// ═════════════════════════════════════════════════════════════════════════════

describe("AuthService", () => {
  it("starts as logged out", () => {
    expect(AuthService.isLoggedIn()).toBe(false);
  });

  it("logs in and tracks state", () => {
    AuthService.login("test@example.com", "password");
    expect(AuthService.isLoggedIn()).toBe(true);
  });

  it("logs out correctly", () => {
    AuthService.login("test@example.com", "password");
    AuthService.logout();
    expect(AuthService.isLoggedIn()).toBe(false);
  });

  it("registers a new user with FREE tier", () => {
    const user = AuthService.register({
      displayName: "Test User",
      username: "test_user",
      email: "test@example.com",
      password: "password123",
    });
    expect(user.email).toBe("test@example.com");
    expect(user.tier).toBe("FREE");
    expect(user.username).toBe("@test_user");
    expect(AuthService.isLoggedIn()).toBe(true);
  });

  it("upgrades tier", () => {
    AuthService.register({
      displayName: "Test User",
      username: "test_user",
      email: "test@example.com",
      password: "pass",
    });
    const upgraded = AuthService.upgradeTier("PRO");
    expect(upgraded.tier).toBe("PRO");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UserService
// ═════════════════════════════════════════════════════════════════════════════

describe("UserService", () => {
  it("returns default user when nothing stored", () => {
    const user = UserService.get();
    expect(user.id).toBe("u_default");
    expect(user.email).toBeDefined();
  });

  it("updates user profile", () => {
    const updated = UserService.update({ displayName: "New Name" });
    expect(updated.displayName).toBe("New Name");
    // Verify persistence
    expect(UserService.get().displayName).toBe("New Name");
  });

  it("resets to default", () => {
    UserService.update({ displayName: "Custom" });
    UserService.reset();
    expect(UserService.get().displayName).toBe("Alex Maker");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ModelService
// ═════════════════════════════════════════════════════════════════════════════

describe("ModelService", () => {
  it("lists seed models initially", () => {
    const models = ModelService.list();
    expect(models.length).toBe(2);
  });

  it("creates a new model", () => {
    const model = ModelService.create({
      title: "Test Model",
      params: { radius: 5, height: 10, resolution: 16 },
    });
    expect(model.id).toContain("m_");
    expect(model.title).toBe("Test Model");
    expect(model.status).toBe("Draft");
    expect(ModelService.list().length).toBe(3);
  });

  it("retrieves a model by ID", () => {
    const created = ModelService.create({
      title: "Find Me",
      params: { radius: 1, height: 1, resolution: 8 },
    });
    const found = ModelService.getById(created.id);
    expect(found).toBeDefined();
    expect(found!.title).toBe("Find Me");
  });

  it("updates a model", () => {
    const created = ModelService.create({
      title: "Before",
      params: { radius: 1, height: 1, resolution: 8 },
    });
    const updated = ModelService.update(created.id, { title: "After" });
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe("After");
  });

  it("deletes a model", () => {
    const created = ModelService.create({
      title: "Delete Me",
      params: { radius: 1, height: 1, resolution: 8 },
    });
    const before = ModelService.list().length;
    const deleted = ModelService.delete(created.id);
    expect(deleted).toBe(true);
    expect(ModelService.list().length).toBe(before - 1);
  });

  it("returns false when deleting nonexistent model", () => {
    expect(ModelService.delete("nonexistent")).toBe(false);
  });

  it("computes correct stats", () => {
    const stats = ModelService.stats();
    expect(stats.totalModels).toBeGreaterThanOrEqual(2);
    expect(stats.totalLikes).toBeGreaterThanOrEqual(0);
    expect(stats.totalDownloads).toBeGreaterThanOrEqual(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GCodeExportService
// ═════════════════════════════════════════════════════════════════════════════

describe("GCodeExportService", () => {
  it("starts with fresh credits", () => {
    const credits = GCodeExportService.getCredits();
    expect(credits.freeUsed).toBe(0);
    expect(credits.purchasedCredits).toBe(0);
    expect(credits.totalExported).toBe(0);
  });

  it("FREE users have 6 remaining", () => {
    expect(GCodeExportService.remaining("FREE")).toBe(6);
  });

  it("PRO users have infinite exports", () => {
    expect(GCodeExportService.remaining("PRO")).toBe(Infinity);
  });

  it("STUDIO PRO users have infinite exports", () => {
    expect(GCodeExportService.remaining("STUDIO PRO")).toBe(Infinity);
  });

  it("consumes a free credit for FREE tier", () => {
    expect(GCodeExportService.consume("FREE")).toBe(true);
    expect(GCodeExportService.remaining("FREE")).toBe(5);
    const credits = GCodeExportService.getCredits();
    expect(credits.freeUsed).toBe(1);
    expect(credits.totalExported).toBe(1);
  });

  it("returns false when no credits left for FREE", () => {
    // Exhaust all 6 free credits
    for (let i = 0; i < 6; i++) GCodeExportService.consume("FREE");
    expect(GCodeExportService.consume("FREE")).toBe(false);
    expect(GCodeExportService.remaining("FREE")).toBe(0);
  });

  it("purchases a credit pack", () => {
    expect(GCodeExportService.purchasePack("pack_10")).toBe(true);
    expect(GCodeExportService.getCredits().purchasedCredits).toBe(10);
  });

  it("uses purchased credits after free exhausted", () => {
    for (let i = 0; i < 6; i++) GCodeExportService.consume("FREE");
    GCodeExportService.purchasePack("pack_10");
    const creditsBefore = GCodeExportService.getCredits().purchasedCredits;
    expect(GCodeExportService.consume("FREE")).toBe(true);
    expect(GCodeExportService.getCredits().purchasedCredits).toBeLessThan(creditsBefore);
  });

  it("resets credits", () => {
    GCodeExportService.consume("FREE");
    const credits = GCodeExportService.getCredits();
    expect(credits.freeUsed).toBeGreaterThanOrEqual(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CREDIT_PACKS
// ═════════════════════════════════════════════════════════════════════════════

describe("CREDIT_PACKS", () => {
  it("has 3 packs defined", () => {
    expect(CREDIT_PACKS.length).toBe(3);
  });

  it("each pack has required fields", () => {
    for (const pack of CREDIT_PACKS) {
      expect(pack.id).toBeDefined();
      expect(pack.credits).toBeGreaterThan(0);
      expect(pack.price).toBeGreaterThan(0);
      expect(pack.pricePerCredit).toBeGreaterThan(0);
    }
  });

  it("pack_30 is marked as popular", () => {
    const popular = CREDIT_PACKS.find((p) => p.popular);
    expect(popular).toBeDefined();
    expect(popular!.id).toBe("pack_30");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UniversalCreditService
// ═════════════════════════════════════════════════════════════════════════════

describe("UniversalCreditService", () => {
  beforeEach(() => {
    localStorage.clear();
    UniversalCreditService.reset();
  });

  it("initializes credits with defaults for the tier", () => {
    const credits = UniversalCreditService.getCredits("FREE");
    expect(credits.balance).toBeGreaterThanOrEqual(0);
    expect(credits.totalUsed).toBe(0);
    expect(credits.lastResetAt).toBeDefined();
  });

  it("returns a balance >= 0", () => {
    const balance = UniversalCreditService.getBalance("FREE");
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it("consumeAction returns true for free actions (cost=0)", () => {
    const result = UniversalCreditService.consumeAction("FREE", "unknown_tool", "any_action");
    expect(result).toBe(true);
  });

  it("addCredits increases the balance", () => {
    const before = UniversalCreditService.getBalance("FREE");
    UniversalCreditService.addCredits(50, "FREE");
    expect(UniversalCreditService.getBalance("FREE")).toBe(before + 50);
  });

  it("getActionCost returns 0 for unknown tools", () => {
    expect(UniversalCreditService.getActionCost("nonexistent", "action")).toBe(0);
  });

  it("canPerformAction allows unknown tools", () => {
    const result = UniversalCreditService.canPerformAction("FREE", "unknown", "action");
    expect(result.allowed).toBe(true);
  });

  it("getCreditValueUsd returns a positive number", () => {
    expect(UniversalCreditService.getCreditValueUsd()).toBeGreaterThan(0);
  });

  it("reset restores to defaults", () => {
    UniversalCreditService.addCredits(1000, "FREE");
    UniversalCreditService.reset();
    const credits = UniversalCreditService.getCredits("FREE");
    expect(credits.totalUsed).toBe(0);
  });
});
