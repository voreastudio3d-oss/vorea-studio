// @vitest-environment node

import { describe, expect, it, beforeEach, vi } from "vitest";

describe("ga4-data", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.GA4_PROPERTY_ID;
    delete process.env.GA4_SERVICE_ACCOUNT_KEY;
  });

  // ── isGa4Configured ──────────────────────────────────────────────────

  it("returns false when GA4 env vars are missing", async () => {
    const { isGa4Configured } = await import("../ga4-data.js");
    expect(isGa4Configured()).toBe(false);
  });

  it("returns false when GA4_PROPERTY_ID is empty string", async () => {
    process.env.GA4_PROPERTY_ID = "  ";
    process.env.GA4_SERVICE_ACCOUNT_KEY = '{"client_email":"x","private_key":"y"}';
    const { isGa4Configured } = await import("../ga4-data.js");
    expect(isGa4Configured()).toBe(false);
  });

  it("returns true when both GA4 env vars are set", async () => {
    process.env.GA4_PROPERTY_ID = "123456789";
    process.env.GA4_SERVICE_ACCOUNT_KEY = '{"client_email":"x","private_key":"y"}';
    const { isGa4Configured } = await import("../ga4-data.js");
    expect(isGa4Configured()).toBe(true);
  });

  // ── fetchGa4Metrics ──────────────────────────────────────────────────

  it("returns null when GA4 is not configured", async () => {
    const { fetchGa4Metrics } = await import("../ga4-data.js");
    const result = await fetchGa4Metrics("7d");
    expect(result).toBeNull();
  });

  // ── generateMockMetrics ──────────────────────────────────────────────

  it("generates mock metrics with correct structure", async () => {
    const { generateMockMetrics } = await import("../ga4-data.js");
    const metrics = generateMockMetrics("30d");

    expect(metrics.period).toBe("30d");
    expect(metrics.fetchedAt).toBeDefined();

    // Overview
    expect(metrics.overview).toMatchObject({
      sessions: expect.any(Number),
      activeUsers: expect.any(Number),
      newUsers: expect.any(Number),
      bounceRate: expect.any(Number),
    });

    // Arrays populated
    expect(metrics.topEvents.length).toBeGreaterThan(0);
    expect(metrics.toolUsage.length).toBeGreaterThan(0);
    expect(metrics.exportEvents.length).toBeGreaterThan(0);
    expect(metrics.signupFunnel.length).toBeGreaterThan(0);
    expect(metrics.topPages.length).toBeGreaterThan(0);
    expect(metrics.pricingClicks.length).toBeGreaterThan(0);
  });

  it("mock metrics rows have dimensions and metrics keys", async () => {
    const { generateMockMetrics } = await import("../ga4-data.js");
    const metrics = generateMockMetrics("7d");

    for (const row of metrics.topEvents) {
      expect(row.dimensions).toBeDefined();
      expect(row.metrics).toBeDefined();
      expect(typeof row.metrics.eventCount).toBe("number");
    }
  });
});
