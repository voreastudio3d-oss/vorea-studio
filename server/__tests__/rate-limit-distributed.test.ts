import { describe, it, expect, beforeEach } from "vitest";
import {
  consumeRateLimit,
  consumeRateLimitSync,
  _resetBackendForTesting,
} from "../middleware/rate-limit.js";

describe("rate-limit (distributed + in-memory fallback)", () => {
  beforeEach(() => {
    _resetBackendForTesting();
  });

  describe("consumeRateLimitSync (in-memory)", () => {
    it("allows requests within the limit", () => {
      const result = consumeRateLimitSync("test:sync:1", 5, 60_000);
      expect(result.limited).toBe(false);
      expect(result.count).toBe(1);
      expect(result.remaining).toBe(4);
    });

    it("blocks when limit is exceeded", () => {
      for (let i = 0; i < 3; i++) {
        consumeRateLimitSync("test:sync:2", 3, 60_000);
      }
      const blocked = consumeRateLimitSync("test:sync:2", 3, 60_000);
      expect(blocked.limited).toBe(true);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });

    it("resets after window expires", () => {
      const result1 = consumeRateLimitSync("test:sync:3", 1, 1); // 1ms window
      expect(result1.limited).toBe(false);

      // Wait for window to expire
      const start = Date.now();
      while (Date.now() - start < 5) {} // busy wait 5ms

      const result2 = consumeRateLimitSync("test:sync:3", 1, 1);
      expect(result2.limited).toBe(false);
      expect(result2.count).toBe(1);
    });
  });

  describe("consumeRateLimit (async, falls back to in-memory without DATABASE_URL)", () => {
    it("allows requests within the limit", async () => {
      const result = await consumeRateLimit("test:async:1", 5, 60_000);
      expect(result.limited).toBe(false);
      expect(result.count).toBe(1);
      expect(result.remaining).toBe(4);
    });

    it("blocks when limit is exceeded", async () => {
      for (let i = 0; i < 3; i++) {
        await consumeRateLimit("test:async:2", 3, 60_000);
      }
      const blocked = await consumeRateLimit("test:async:2", 3, 60_000);
      expect(blocked.limited).toBe(true);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });

    it("different keys are independent", async () => {
      await consumeRateLimit("test:async:a", 1, 60_000);
      const resultA = await consumeRateLimit("test:async:a", 1, 60_000);
      const resultB = await consumeRateLimit("test:async:b", 1, 60_000);

      expect(resultA.limited).toBe(true);
      expect(resultB.limited).toBe(false);
    });

    it("returns correct headers shape", async () => {
      const result = await consumeRateLimit("test:async:headers", 10, 60_000);
      expect(result).toHaveProperty("count");
      expect(result).toHaveProperty("limit");
      expect(result).toHaveProperty("limited");
      expect(result).toHaveProperty("remaining");
      expect(result).toHaveProperty("resetAt");
      expect(result).toHaveProperty("retryAfter");
      expect(result.limit).toBe(10);
    });
  });

  describe("_resetBackendForTesting", () => {
    it("clears all state", async () => {
      await consumeRateLimit("test:reset:1", 1, 60_000);
      const blocked = await consumeRateLimit("test:reset:1", 1, 60_000);
      expect(blocked.limited).toBe(true);

      _resetBackendForTesting();

      const fresh = await consumeRateLimit("test:reset:1", 1, 60_000);
      expect(fresh.limited).toBe(false);
    });
  });
});
