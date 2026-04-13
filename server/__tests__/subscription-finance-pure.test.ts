/**
 * subscription-finance pure function tests.
 */
import { describe, it, expect, vi } from "vitest";

// Mock Prisma + pg since the module imports them at top level
vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => ({
    payPalSubscription: { findMany: vi.fn(() => []) },
    $disconnect: vi.fn(),
  })),
}));
vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: vi.fn(),
}));
vi.mock("pg", () => ({
  default: { Pool: vi.fn(() => ({ end: vi.fn() })) },
  Pool: vi.fn(() => ({ end: vi.fn() })),
}));
vi.mock("../subscription-billing-map.js", () => ({
  resolveSubscriptionBillingMetadata: vi.fn(() => null),
}));

describe("subscription-finance", () => {
  it("exports getSubscriptionFinanceSummary function", async () => {
    const mod = await import("../subscription-finance.js");
    expect(mod.getSubscriptionFinanceSummary).toBeDefined();
    expect(typeof mod.getSubscriptionFinanceSummary).toBe("function");
  });

  it("returns unavailable summary when no DATABASE_URL", async () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const { getSubscriptionFinanceSummary } = await import("../subscription-finance.js");
    const result = await getSubscriptionFinanceSummary([{ tier: "PRO", price: 12, yearlyPrice: 99 }]);
    expect(result.available).toBe(false);
    expect(result.unavailableReason).toBeDefined();

    if (originalUrl) process.env.DATABASE_URL = originalUrl;
  });
});
