import { useEffect, useMemo, useState } from "react";
import { DEFAULT_PLANS, getPlans } from "./business-config";
import type { MembershipPlan } from "./types";

function findPlan(plans: MembershipPlan[], tier: MembershipPlan["tier"]): MembershipPlan {
  return plans.find((plan) => plan.tier === tier) ?? DEFAULT_PLANS.find((plan) => plan.tier === tier)!;
}

export function formatUsdPlanPrice(price: number): string {
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
}

export function getMonthlyPlanSuffix(locale: string): string {
  if (locale.toLowerCase().startsWith("en")) return "/mo";
  if (locale.toLowerCase().startsWith("pt")) return "/mês";
  return "/mes";
}

export function usePublicPlanPricing(locale: string) {
  const [plans, setPlans] = useState<MembershipPlan[]>(DEFAULT_PLANS);

  useEffect(() => {
    let active = true;

    getPlans()
      .then((nextPlans) => {
        if (active && nextPlans.length > 0) setPlans(nextPlans);
      })
      .catch(() => {
        // Defaults are already loaded and are good enough for public pricing.
      });

    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => {
    const freePlan = findPlan(plans, "FREE");
    const proPlan = findPlan(plans, "PRO");

    return {
      freePlan,
      proPlan,
      freePriceLabel: formatUsdPlanPrice(freePlan.price),
      proPriceLabel: formatUsdPlanPrice(proPlan.price),
      monthlySuffix: getMonthlyPlanSuffix(locale),
    };
  }, [locale, plans]);
}
