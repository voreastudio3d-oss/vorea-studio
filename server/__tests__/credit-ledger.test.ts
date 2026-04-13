// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const kvState = vi.hoisted(() => ({
  store: new Map<string, any>(),
}));

function clone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

vi.mock("../kv.js", () => ({
  get: async (key: string) =>
    kvState.store.has(key) ? clone(kvState.store.get(key)) : null,
  set: async (key: string, value: any) => {
    kvState.store.set(key, clone(value));
  },
  del: async (key: string) => {
    kvState.store.delete(key);
  },
}));

describe("credit-ledger", () => {
  beforeEach(() => {
    vi.resetModules();
    kvState.store.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── getUserCreditBalance ─────────────────────────────────────────────────

  it("returns zeroed defaults when user has no credit state", async () => {
    const { getUserCreditBalance } = await import("../credit-ledger.js");
    const balance = await getUserCreditBalance("user-new");
    expect(balance).toEqual({
      balance: 0,
      topupBalance: 0,
      totalUsed: 0,
      monthlyAllocation: 0,
      monthlyIssuedAt: null,
    });
  });

  it("reads existing credit state from KV", async () => {
    kvState.store.set("user:u1:tool_credits", {
      balance: 50,
      topupBalance: 10,
      totalUsed: 20,
      monthlyAllocation: 30,
      monthlyIssuedAt: "2026-04-01T00:00:00Z",
    });
    const { getUserCreditBalance } = await import("../credit-ledger.js");
    const balance = await getUserCreditBalance("u1");
    expect(balance).toEqual({
      balance: 50,
      topupBalance: 10,
      totalUsed: 20,
      monthlyAllocation: 30,
      monthlyIssuedAt: "2026-04-01T00:00:00Z",
    });
  });

  it("clamps negative values to zero", async () => {
    kvState.store.set("user:u2:tool_credits", {
      balance: -5,
      topupBalance: -1,
      totalUsed: -3,
      monthlyAllocation: -2,
    });
    const { getUserCreditBalance } = await import("../credit-ledger.js");
    const balance = await getUserCreditBalance("u2");
    expect(balance.balance).toBe(0);
    expect(balance.topupBalance).toBe(0);
    expect(balance.totalUsed).toBe(0);
    expect(balance.monthlyAllocation).toBe(0);
  });

  // ── reserveCredits ──────────────────────────────────────────────────────

  it("returns a no-op snapshot when creditCost is zero", async () => {
    const { reserveCredits } = await import("../credit-ledger.js");
    const result = await reserveCredits("u1", 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.creditCost).toBe(0);
    }
  });

  it("fails with NO_CREDITS_STATE when user has no state", async () => {
    const { reserveCredits } = await import("../credit-ledger.js");
    const result = await reserveCredits("u-none", 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NO_CREDITS_STATE");
    }
  });

  it("fails with CREDITS_INSUFFICIENT when balance is too low", async () => {
    kvState.store.set("user:u3:tool_credits", {
      balance: 3,
      topupBalance: 0,
      totalUsed: 0,
      monthlyAllocation: 5,
    });
    const { reserveCredits } = await import("../credit-ledger.js");
    const result = await reserveCredits("u3", 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CREDITS_INSUFFICIENT");
    }
  });

  it("reserves credits and updates KV state", async () => {
    kvState.store.set("user:u4:tool_credits", {
      balance: 20,
      topupBalance: 5,
      totalUsed: 10,
      monthlyAllocation: 15,
    });
    const { reserveCredits } = await import("../credit-ledger.js");
    const result = await reserveCredits("u4", 8);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.creditCost).toBe(8);
      expect(result.balanceAfter).toBeLessThan(20);
    }
    // State was persisted
    const stored = kvState.store.get("user:u4:tool_credits");
    expect(stored).toBeDefined();
    expect(stored.balance).toBeLessThan(20);
  });

  // ── releaseCredits ──────────────────────────────────────────────────────

  it("is a no-op when snapshot is null", async () => {
    const { releaseCredits } = await import("../credit-ledger.js");
    await releaseCredits("u1", null);
    // Should not throw
  });

  it("restores credits after a failed operation", async () => {
    kvState.store.set("user:u5:tool_credits", {
      balance: 20,
      topupBalance: 5,
      totalUsed: 10,
      monthlyAllocation: 15,
    });
    const { reserveCredits, releaseCredits, getUserCreditBalance } =
      await import("../credit-ledger.js");

    const result = await reserveCredits("u5", 8);
    expect(result.ok).toBe(true);

    if (result.ok) {
      await releaseCredits("u5", result.snapshot);
      const restored = await getUserCreditBalance("u5");
      expect(restored.balance).toBe(20);
      expect(restored.topupBalance).toBe(5);
    }
  });

  // ── Idempotency helpers ────────────────────────────────────────────────

  it("returns null for unseen generationId", async () => {
    const { getIdempotencyRecord } = await import("../credit-ledger.js");
    const record = await getIdempotencyRecord("gen-unknown");
    expect(record).toBeNull();
  });

  it("marks generation in-progress and retrieves it", async () => {
    const { markGenerationInProgress, getIdempotencyRecord } =
      await import("../credit-ledger.js");
    await markGenerationInProgress("gen-001");
    const record = await getIdempotencyRecord("gen-001");
    expect(record).not.toBeNull();
    expect(record!.status).toBe("in-progress");
  });

  it("marks generation completed with payload", async () => {
    const { markGenerationCompleted, getIdempotencyRecord } =
      await import("../credit-ledger.js");
    await markGenerationCompleted("gen-002", {
      userId: "u1",
      result: { model: "box" },
      contract: { cost: 5 },
      routing: { provider: "openai" },
      usage: { tokens: 100 },
    });
    const record = await getIdempotencyRecord("gen-002");
    expect(record!.status).toBe("completed");
    expect(record!.userId).toBe("u1");
    expect(record!.result).toEqual({ model: "box" });
  });

  it("clears idempotency record", async () => {
    const {
      markGenerationInProgress,
      clearIdempotencyRecord,
      getIdempotencyRecord,
    } = await import("../credit-ledger.js");
    await markGenerationInProgress("gen-003");
    await clearIdempotencyRecord("gen-003");
    const record = await getIdempotencyRecord("gen-003");
    expect(record).toBeNull();
  });
});
