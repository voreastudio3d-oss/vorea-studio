import { describe, it, expect } from "vitest";
import {
  getPublicDonationTiers,
  getDonationTier,
  resolveContributorTier,
  sortPublicContributors,
  sanitizeDonationMessage,
  replaceContributorBadge,
  DONATION_TIERS,
} from "../donations.js";

describe("donations", () => {
  describe("DONATION_TIERS", () => {
    it("has 4 tiers in ascending order", () => {
      expect(DONATION_TIERS).toHaveLength(4);
      expect(DONATION_TIERS.map((t) => t.id)).toEqual([
        "impulsor",
        "aliado",
        "patrono",
        "mecenas",
      ]);
    });

    it("each tier has required fields", () => {
      for (const tier of DONATION_TIERS) {
        expect(tier.id).toBeTruthy();
        expect(tier.suggestedAmountUsd).toBeGreaterThan(0);
        expect(tier.minimumTotalUsd).toBeGreaterThan(0);
        expect(tier.badgeId).toMatch(/^contributor_/);
      }
    });

    it("tiers are sorted by minimumTotalUsd ascending", () => {
      for (let i = 1; i < DONATION_TIERS.length; i++) {
        expect(DONATION_TIERS[i].minimumTotalUsd).toBeGreaterThan(
          DONATION_TIERS[i - 1].minimumTotalUsd
        );
      }
    });
  });

  describe("getPublicDonationTiers", () => {
    it("returns all tiers with public fields only", () => {
      const tiers = getPublicDonationTiers();
      expect(tiers).toHaveLength(4);
      for (const tier of tiers) {
        expect(Object.keys(tier).sort()).toEqual(
          ["badgeId", "id", "minimumTotalUsd", "suggestedAmountUsd"].sort()
        );
      }
    });
  });

  describe("getDonationTier", () => {
    it("returns correct tier by id", () => {
      const tier = getDonationTier("patrono");
      expect(tier).not.toBeNull();
      expect(tier!.id).toBe("patrono");
      expect(tier!.suggestedAmountUsd).toBe(35);
    });

    it("returns null for unknown tier", () => {
      expect(getDonationTier("nonexistent")).toBeNull();
    });
  });

  describe("resolveContributorTier", () => {
    it("returns impulsor for $5", () => {
      expect(resolveContributorTier(5).id).toBe("impulsor");
    });

    it("returns aliado for $15", () => {
      expect(resolveContributorTier(15).id).toBe("aliado");
    });

    it("returns patrono for $35", () => {
      expect(resolveContributorTier(35).id).toBe("patrono");
    });

    it("returns mecenas for $75+", () => {
      expect(resolveContributorTier(75).id).toBe("mecenas");
      expect(resolveContributorTier(500).id).toBe("mecenas");
    });

    it("returns impulsor (first tier) for $0", () => {
      expect(resolveContributorTier(0).id).toBe("impulsor");
    });

    it("handles NaN gracefully", () => {
      expect(resolveContributorTier(NaN).id).toBe("impulsor");
    });

    it("handles Infinity gracefully", () => {
      expect(resolveContributorTier(Infinity).id).toBe("impulsor");
    });
  });

  describe("sortPublicContributors", () => {
    it("sorts by tier rank descending (mecenas first)", () => {
      const items = [
        { tierId: "impulsor", lastDonatedAt: "2024-01-01" },
        { tierId: "mecenas", lastDonatedAt: "2024-01-01" },
        { tierId: "aliado", lastDonatedAt: "2024-01-01" },
      ];
      const sorted = sortPublicContributors(items);
      expect(sorted[0].tierId).toBe("mecenas");
      expect(sorted[1].tierId).toBe("aliado");
      expect(sorted[2].tierId).toBe("impulsor");
    });

    it("sorts by date within same tier (most recent first)", () => {
      const items = [
        { tierId: "patrono", lastDonatedAt: "2024-01-01" },
        { tierId: "patrono", lastDonatedAt: "2024-06-15" },
      ];
      const sorted = sortPublicContributors(items);
      expect(sorted[0].lastDonatedAt).toBe("2024-06-15");
    });

    it("handles null/undefined tierId", () => {
      const items = [
        { tierId: null, lastDonatedAt: "2024-01-01" },
        { tierId: "mecenas", lastDonatedAt: "2024-01-01" },
      ];
      const sorted = sortPublicContributors(items);
      expect(sorted[0].tierId).toBe("mecenas");
    });

    it("does not mutate original array", () => {
      const items = [
        { tierId: "aliado", lastDonatedAt: "2024-01-01" },
        { tierId: "mecenas", lastDonatedAt: "2024-01-01" },
      ];
      const original = [...items];
      sortPublicContributors(items);
      expect(items).toEqual(original);
    });
  });

  describe("sanitizeDonationMessage", () => {
    it("trims and normalizes whitespace", () => {
      expect(sanitizeDonationMessage("  hello   world  ")).toBe("hello world");
    });

    it("returns null for empty/falsy input", () => {
      expect(sanitizeDonationMessage("")).toBeNull();
      expect(sanitizeDonationMessage(null)).toBeNull();
      expect(sanitizeDonationMessage(undefined)).toBeNull();
    });

    it("truncates to 240 chars", () => {
      const longMsg = "a".repeat(300);
      expect(sanitizeDonationMessage(longMsg)!.length).toBe(240);
    });
  });

  describe("replaceContributorBadge", () => {
    it("replaces existing contributor badge", () => {
      const existing = ["early_adopter", "contributor_impulsor"];
      const result = replaceContributorBadge(existing, "contributor_mecenas");
      expect(result).toContain("early_adopter");
      expect(result).toContain("contributor_mecenas");
      expect(result).not.toContain("contributor_impulsor");
    });

    it("adds badge when no contributor badge exists", () => {
      const result = replaceContributorBadge(["beta_tester"], "contributor_aliado");
      expect(result).toEqual(["beta_tester", "contributor_aliado"]);
    });

    it("handles non-array gracefully", () => {
      const result = replaceContributorBadge(null, "contributor_patrono");
      expect(result).toEqual(["contributor_patrono"]);
    });
  });
});
