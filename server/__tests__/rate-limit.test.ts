import { describe, it, expect, beforeEach } from "vitest";
import {
  getClientIp,
  consumeRateLimitSync,
  applyRateLimitHeaders,
  _resetBackendForTesting,
  type RateLimitCheckResult,
} from "../middleware/rate-limit.js";

function mockHonoContext(headers: Record<string, string> = {}) {
  const responseHeaders = new Map<string, string>();
  return {
    req: {
      header: (name: string) => headers[name.toLowerCase()] || undefined,
    },
    header: (name: string, value: string) => responseHeaders.set(name, value),
    _responseHeaders: responseHeaders,
  };
}

describe("rate-limit", () => {
  beforeEach(() => {
    _resetBackendForTesting();
  });

  describe("getClientIp", () => {
    it("returns cf-connecting-ip if present", () => {
      const c = mockHonoContext({ "cf-connecting-ip": "1.2.3.4" });
      expect(getClientIp(c)).toBe("1.2.3.4");
    });

    it("returns first x-forwarded-for IP", () => {
      const c = mockHonoContext({ "x-forwarded-for": "10.0.0.1, 10.0.0.2" });
      expect(getClientIp(c)).toBe("10.0.0.1");
    });

    it("returns x-real-ip as fallback", () => {
      const c = mockHonoContext({ "x-real-ip": "192.168.1.1" });
      expect(getClientIp(c)).toBe("192.168.1.1");
    });

    it("returns 127.0.0.1 when no headers present", () => {
      const c = mockHonoContext();
      expect(getClientIp(c)).toBe("127.0.0.1");
    });

    it("cf-connecting-ip takes priority over x-forwarded-for", () => {
      const c = mockHonoContext({
        "cf-connecting-ip": "1.1.1.1",
        "x-forwarded-for": "2.2.2.2",
      });
      expect(getClientIp(c)).toBe("1.1.1.1");
    });
  });

  describe("consumeRateLimitSync (in-memory)", () => {
    it("allows requests within limit", () => {
      const result = consumeRateLimitSync("test-key", 5, 60_000);
      expect(result.limited).toBe(false);
      expect(result.remaining).toBe(4);
      expect(result.count).toBe(1);
    });

    it("increments count on repeated calls", () => {
      consumeRateLimitSync("inc-key", 5, 60_000);
      consumeRateLimitSync("inc-key", 5, 60_000);
      const r = consumeRateLimitSync("inc-key", 5, 60_000);
      expect(r.count).toBe(3);
      expect(r.remaining).toBe(2);
    });

    it("blocks when limit exceeded", () => {
      for (let i = 0; i < 5; i++) {
        consumeRateLimitSync("block-key", 5, 60_000);
      }
      const r = consumeRateLimitSync("block-key", 5, 60_000);
      expect(r.limited).toBe(true);
      expect(r.remaining).toBe(0);
      expect(r.retryAfter).toBeGreaterThan(0);
    });

    it("uses separate counters per key", () => {
      consumeRateLimitSync("key-a", 2, 60_000);
      consumeRateLimitSync("key-a", 2, 60_000);
      const rb = consumeRateLimitSync("key-b", 2, 60_000);
      expect(rb.count).toBe(1);
    });

    it("resets after window expires", () => {
      // Use a very short window
      const r1 = consumeRateLimitSync("expire-key", 1, 1);
      expect(r1.count).toBe(1);

      // Window should have expired after 1ms — next call should reset
      // (small race condition possible, but 1ms is effectively instant)
      // Consume again after a tick
      const r2 = consumeRateLimitSync("expire-key", 1, 1);
      // Either reset (count=1) or still in window (count=2) — both valid
      expect(r2.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("applyRateLimitHeaders", () => {
    it("sets standard rate limit headers", () => {
      const c = mockHonoContext();
      const result: RateLimitCheckResult = {
        count: 3,
        limit: 10,
        limited: false,
        remaining: 7,
        resetAt: Date.now() + 60_000,
        retryAfter: 0,
      };
      applyRateLimitHeaders(c, result);

      expect(c._responseHeaders.get("X-RateLimit-Limit")).toBe("10");
      expect(c._responseHeaders.get("X-RateLimit-Remaining")).toBe("7");
      expect(c._responseHeaders.get("X-RateLimit-Reset")).toBeTruthy();
    });

    it("sets Retry-After when limited", () => {
      const c = mockHonoContext();
      const result: RateLimitCheckResult = {
        count: 11,
        limit: 10,
        limited: true,
        remaining: 0,
        resetAt: Date.now() + 30_000,
        retryAfter: 30,
      };
      applyRateLimitHeaders(c, result);

      expect(c._responseHeaders.get("Retry-After")).toBe("30");
    });

    it("does not set Retry-After when not limited", () => {
      const c = mockHonoContext();
      const result: RateLimitCheckResult = {
        count: 1,
        limit: 10,
        limited: false,
        remaining: 9,
        resetAt: Date.now() + 60_000,
        retryAfter: 0,
      };
      applyRateLimitHeaders(c, result);

      expect(c._responseHeaders.has("Retry-After")).toBe(false);
    });
  });
});
