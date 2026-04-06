import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { resolveSubscriptionBillingMetadata } from "./subscription-billing-map.js";

type BillingCycle = "monthly" | "yearly" | "unknown";

type PlanLike = {
  tier?: string;
  price?: number;
  yearlyPrice?: number;
};

export type SubscriptionFinanceBreakdown = {
  tier: string;
  billing: BillingCycle;
  count: number;
  monthlyEquivalent: number;
  annualizedValue: number;
};

export type SubscriptionFinanceSummary = {
  available: boolean;
  activeSubscriptions: number;
  mappedActiveSubscriptions: number;
  unmappedActiveSubscriptions: number;
  estimatedMonthlyRecurringRevenue: number;
  estimatedAnnualContractValue: number;
  activeByTier: Record<string, number>;
  estimatedMonthlyByTier: Record<string, number>;
  breakdown: SubscriptionFinanceBreakdown[];
  unavailableReason?: string;
};

type NormalizedPlan = {
  monthly: number;
  yearly: number;
  yearlyMonthlyEquivalent: number;
};

const EMPTY_SUMMARY: SubscriptionFinanceSummary = {
  available: true,
  activeSubscriptions: 0,
  mappedActiveSubscriptions: 0,
  unmappedActiveSubscriptions: 0,
  estimatedMonthlyRecurringRevenue: 0,
  estimatedAnnualContractValue: 0,
  activeByTier: {},
  estimatedMonthlyByTier: {},
  breakdown: [],
};

function roundUsd(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeTierName(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function toPositiveNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function buildPlanCatalog(plans: PlanLike[]): Map<string, NormalizedPlan> {
  const catalog = new Map<string, NormalizedPlan>();

  for (const plan of plans) {
    const tier = normalizeTierName(plan?.tier);
    if (!tier || tier === "FREE") continue;

    const monthly = toPositiveNumber(plan?.price);
    const yearly = toPositiveNumber(plan?.yearlyPrice);
    catalog.set(tier, {
      monthly,
      yearly,
      yearlyMonthlyEquivalent: yearly > 0 ? roundUsd(yearly / 12) : 0,
    });
  }

  return catalog;
}

function unavailableSummary(reason: string): SubscriptionFinanceSummary {
  return {
    ...EMPTY_SUMMARY,
    available: false,
    unavailableReason: reason,
  };
}

export async function getSubscriptionFinanceSummary(plans: PlanLike[]): Promise<SubscriptionFinanceSummary> {
  const connectionString = process.env.DATABASE_URL || "";
  if (!connectionString) {
    return unavailableSummary("DATABASE_URL no está configurada para leer suscripciones activas.");
  }

  const planCatalog = buildPlanCatalog(plans);

  const pool = new pg.Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 1000,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const subscriptions = await prisma.payPalSubscription.findMany({
      where: { status: "ACTIVE" },
      select: { subscriptionId: true, planId: true, tier: true },
    });

    if (!subscriptions.length) {
      return { ...EMPTY_SUMMARY };
    }

    const activeByTier: Record<string, number> = {};
    const estimatedMonthlyByTier: Record<string, number> = {};
    const breakdownMap = new Map<string, SubscriptionFinanceBreakdown>();

    let mappedActiveSubscriptions = 0;
    let unmappedActiveSubscriptions = 0;
    let estimatedMonthlyRecurringRevenue = 0;
    let estimatedAnnualContractValue = 0;

    for (const subscription of subscriptions) {
      const tier = normalizeTierName(subscription.tier);
      if (!tier) {
        unmappedActiveSubscriptions += 1;
        continue;
      }

      activeByTier[tier] = (activeByTier[tier] || 0) + 1;

      const plan = planCatalog.get(tier);
      const mappedPlan = await resolveSubscriptionBillingMetadata({
        subscriptionId: subscription.subscriptionId,
        planId: subscription.planId,
      });
      const billing = (mappedPlan?.billing || "unknown") as BillingCycle;

      let monthlyEquivalent = 0;
      let annualizedValue = 0;

      if (plan && billing === "monthly" && plan.monthly > 0) {
        monthlyEquivalent = plan.monthly;
        annualizedValue = roundUsd(plan.monthly * 12);
      } else if (plan && billing === "yearly" && plan.yearly > 0) {
        monthlyEquivalent = plan.yearlyMonthlyEquivalent;
        annualizedValue = plan.yearly;
      }

      if (monthlyEquivalent > 0 || annualizedValue > 0) {
        mappedActiveSubscriptions += 1;
        estimatedMonthlyRecurringRevenue += monthlyEquivalent;
        estimatedAnnualContractValue += annualizedValue;
        estimatedMonthlyByTier[tier] = roundUsd((estimatedMonthlyByTier[tier] || 0) + monthlyEquivalent);
      } else {
        unmappedActiveSubscriptions += 1;
      }

      const key = `${tier}:${billing}`;
      const current = breakdownMap.get(key) || {
        tier,
        billing,
        count: 0,
        monthlyEquivalent: 0,
        annualizedValue: 0,
      };
      current.count += 1;
      current.monthlyEquivalent = roundUsd(current.monthlyEquivalent + monthlyEquivalent);
      current.annualizedValue = roundUsd(current.annualizedValue + annualizedValue);
      breakdownMap.set(key, current);
    }

    return {
      available: true,
      activeSubscriptions: subscriptions.length,
      mappedActiveSubscriptions,
      unmappedActiveSubscriptions,
      estimatedMonthlyRecurringRevenue: roundUsd(estimatedMonthlyRecurringRevenue),
      estimatedAnnualContractValue: roundUsd(estimatedAnnualContractValue),
      activeByTier,
      estimatedMonthlyByTier,
      breakdown: Array.from(breakdownMap.values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.tier.localeCompare(b.tier);
      }),
    };
  } catch (error: any) {
    return unavailableSummary(`No se pudo leer suscripciones activas: ${error?.message || "error desconocido"}`);
  } finally {
    await prisma.$disconnect().catch(() => {});
    await pool.end().catch(() => {});
  }
}
