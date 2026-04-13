// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock Prisma + pg
vi.mock("@prisma/client", () => {
  const mockFindMany = vi.fn().mockResolvedValue([]);
  return {
    PrismaClient: vi.fn(() => ({
      payPalSubscription: { findMany: mockFindMany },
      $disconnect: vi.fn().mockResolvedValue(undefined),
      _mockFindMany: mockFindMany,
    })),
  };
});

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: vi.fn(),
}));

vi.mock("pg", () => {
  const Pool = vi.fn(() => ({
    end: vi.fn().mockResolvedValue(undefined),
  }));
  return { default: { Pool } };
});

vi.mock("../subscription-billing-map.js", () => ({
  resolveSubscriptionBillingMetadata: vi.fn().mockResolvedValue({
    billing: "monthly",
    tier: "PRO",
    source: "env",
  }),
}));

describe("subscription-finance", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns unavailable when DATABASE_URL is empty", async () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    // Need to re-import after clearing env
    const mod = await import("../subscription-finance.js");
    const result = await mod.getSubscriptionFinanceSummary([
      { tier: "PRO", price: 9.99 },
    ]);
    expect(result.available).toBe(false);
    expect(result.unavailableReason).toBeDefined();
    process.env.DATABASE_URL = original;
  });
});
