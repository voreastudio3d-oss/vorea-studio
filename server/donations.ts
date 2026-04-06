export type DonationTierId = "impulsor" | "aliado" | "patrono" | "mecenas";
export type DonationVisibility = "public" | "anonymous";

export type DonationTierConfig = {
  id: DonationTierId;
  suggestedAmountUsd: number;
  minimumTotalUsd: number;
  badgeId: string;
};

export type PublicDonationTier = Pick<
  DonationTierConfig,
  "id" | "suggestedAmountUsd" | "minimumTotalUsd" | "badgeId"
>;

export const DONATION_TIERS: DonationTierConfig[] = [
  {
    id: "impulsor",
    suggestedAmountUsd: 5,
    minimumTotalUsd: 5,
    badgeId: "contributor_impulsor",
  },
  {
    id: "aliado",
    suggestedAmountUsd: 15,
    minimumTotalUsd: 15,
    badgeId: "contributor_aliado",
  },
  {
    id: "patrono",
    suggestedAmountUsd: 35,
    minimumTotalUsd: 35,
    badgeId: "contributor_patrono",
  },
  {
    id: "mecenas",
    suggestedAmountUsd: 75,
    minimumTotalUsd: 75,
    badgeId: "contributor_mecenas",
  },
];

const TIER_ORDER = new Map<string, number>(DONATION_TIERS.map((tier, index) => [tier.id, index]));

export function getPublicDonationTiers(): PublicDonationTier[] {
  return DONATION_TIERS.map((tier) => ({
    id: tier.id,
    suggestedAmountUsd: tier.suggestedAmountUsd,
    minimumTotalUsd: tier.minimumTotalUsd,
    badgeId: tier.badgeId,
  }));
}

export function getDonationTier(id: string): DonationTierConfig | null {
  return DONATION_TIERS.find((tier) => tier.id === id) || null;
}

export function resolveContributorTier(totalDonatedUsd: number): DonationTierConfig {
  const safeTotal = Number.isFinite(totalDonatedUsd) ? totalDonatedUsd : 0;
  let selected = DONATION_TIERS[0];
  for (const tier of DONATION_TIERS) {
    if (safeTotal >= tier.minimumTotalUsd) {
      selected = tier;
    }
  }
  return selected;
}

export function sortPublicContributors<T extends { tierId?: string | null; lastDonatedAt?: string | null }>(
  items: T[]
): T[] {
  return [...items].sort((left, right) => {
    const tierDiff =
      (TIER_ORDER.get(String(right.tierId || "")) ?? -1) -
      (TIER_ORDER.get(String(left.tierId || "")) ?? -1);
    if (tierDiff !== 0) return tierDiff;

    const rightTime = new Date(String(right.lastDonatedAt || 0)).getTime();
    const leftTime = new Date(String(left.lastDonatedAt || 0)).getTime();
    return rightTime - leftTime;
  });
}

export function sanitizeDonationMessage(input: unknown): string | null {
  const value = String(input || "").replace(/\s+/g, " ").trim();
  if (!value) return null;
  return value.slice(0, 240);
}

export function replaceContributorBadge(existingBadges: unknown, nextBadgeId: string): string[] {
  const badges = Array.isArray(existingBadges) ? existingBadges.filter((badge) => typeof badge === "string") as string[] : [];
  const withoutContributorBadges = badges.filter((badge) => !badge.startsWith("contributor_"));
  return [...withoutContributorBadges, nextBadgeId];
}
