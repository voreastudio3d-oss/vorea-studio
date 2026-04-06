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
  get: async (key: string) => (kvState.store.has(key) ? clone(kvState.store.get(key)) : null),
  set: async (key: string, value: any) => {
    kvState.store.set(key, clone(value));
  },
}));

describe("subscription billing map", () => {
  beforeEach(() => {
    vi.resetModules();
    kvState.store.clear();
    delete process.env.PAYPAL_PRO_MONTHLY_PLAN_ID;
    delete process.env.PAYPAL_PRO_YEARLY_PLAN_ID;
    delete process.env.PAYPAL_STUDIOPRO_MONTHLY_PLAN_ID;
    delete process.env.PAYPAL_STUDIOPRO_YEARLY_PLAN_ID;
  });

  it("persists and resolves billing metadata by subscription id", async () => {
    const mod = await import("../subscription-billing-map.js");
    await mod.persistSubscriptionBillingMetadata({
      subscriptionId: "I-SUB-001",
      planId: "P-PLAN-001",
      tier: "studio_pro",
      billing: "yearly",
    });

    const resolved = await mod.resolveSubscriptionBillingMetadata({
      subscriptionId: "I-SUB-001",
      planId: "P-PLAN-001",
    });

    expect(resolved).toMatchObject({
      planId: "P-PLAN-001",
      billing: "yearly",
      tier: "STUDIO PRO",
      source: "kv_subscription_meta",
    });
  });

  it("falls back to env configured plan ids when kv metadata is missing", async () => {
    process.env.PAYPAL_PRO_MONTHLY_PLAN_ID = "P-ENV-PRO-M";
    const mod = await import("../subscription-billing-map.js");

    const resolved = await mod.resolveSubscriptionBillingMetadata({
      planId: "P-ENV-PRO-M",
    });

    expect(resolved).toMatchObject({
      planId: "P-ENV-PRO-M",
      billing: "monthly",
      tier: "PRO",
      source: "env",
    });
  });
});
