import * as kv from "./kv.js";

export type SubscriptionBillingCycle = "monthly" | "yearly";

type EnvPlanEntry = {
  planId: string;
  tier: string;
  billing: SubscriptionBillingCycle;
};

type PersistedSubscriptionBilling = {
  subscriptionId?: string;
  planId: string;
  tier?: string;
  billing: SubscriptionBillingCycle;
  updatedAt: string;
};

export type ResolvedSubscriptionBilling = {
  planId: string;
  billing: SubscriptionBillingCycle;
  tier?: string;
  source: "kv_subscription_meta" | "kv_plan_map" | "env";
};

function normalizeTier(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizePlanId(value: unknown): string {
  return String(value || "").trim();
}

function buildEnvPlanEntries(): EnvPlanEntry[] {
  const entries: EnvPlanEntry[] = [
    { planId: normalizePlanId(process.env.PAYPAL_PRO_MONTHLY_PLAN_ID), tier: "PRO", billing: "monthly" },
    { planId: normalizePlanId(process.env.PAYPAL_PRO_YEARLY_PLAN_ID), tier: "PRO", billing: "yearly" },
    { planId: normalizePlanId(process.env.PAYPAL_STUDIOPRO_MONTHLY_PLAN_ID), tier: "STUDIO PRO", billing: "monthly" },
    { planId: normalizePlanId(process.env.PAYPAL_STUDIOPRO_YEARLY_PLAN_ID), tier: "STUDIO PRO", billing: "yearly" },
  ];
  return entries.filter((entry) => entry.planId.length > 0);
}

export async function persistSubscriptionBillingMetadata(input: {
  subscriptionId?: string | null;
  planId?: string | null;
  tier?: string | null;
  billing: SubscriptionBillingCycle;
}): Promise<void> {
  const planId = normalizePlanId(input.planId);
  if (!planId) return;

  const payload: PersistedSubscriptionBilling = {
    subscriptionId: normalizePlanId(input.subscriptionId) || undefined,
    planId,
    tier: normalizeTier(input.tier) || undefined,
    billing: input.billing,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(`paypal:subscription:plan-map:${planId}`, payload);

  if (payload.subscriptionId) {
    await kv.set(`paypal:subscription:meta:${payload.subscriptionId}`, payload);
  }
}

export async function resolveSubscriptionBillingMetadata(input: {
  subscriptionId?: string | null;
  planId?: string | null;
}): Promise<ResolvedSubscriptionBilling | null> {
  const subscriptionId = normalizePlanId(input.subscriptionId);
  const planId = normalizePlanId(input.planId);

  if (subscriptionId) {
    const subscriptionMeta = (await kv.get(`paypal:subscription:meta:${subscriptionId}`)) as PersistedSubscriptionBilling | null;
    if (subscriptionMeta?.planId && subscriptionMeta?.billing) {
      return {
        planId: normalizePlanId(subscriptionMeta.planId),
        billing: subscriptionMeta.billing,
        tier: normalizeTier(subscriptionMeta.tier),
        source: "kv_subscription_meta",
      };
    }
  }

  if (planId) {
    const planMap = (await kv.get(`paypal:subscription:plan-map:${planId}`)) as PersistedSubscriptionBilling | null;
    if (planMap?.planId && planMap?.billing) {
      return {
        planId,
        billing: planMap.billing,
        tier: normalizeTier(planMap.tier),
        source: "kv_plan_map",
      };
    }
  }

  const envEntry = buildEnvPlanEntries().find((entry) => entry.planId === planId);
  if (envEntry) {
    return {
      planId: envEntry.planId,
      billing: envEntry.billing,
      tier: envEntry.tier,
      source: "env",
    };
  }

  return null;
}
