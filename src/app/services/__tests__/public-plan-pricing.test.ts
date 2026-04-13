/**
 * public-plan-pricing tests — formatUsdPlanPrice, getMonthlyPlanSuffix.
 */
import { describe, it, expect } from "vitest";
import { formatUsdPlanPrice, getMonthlyPlanSuffix } from "../public-plan-pricing";

describe("public-plan-pricing", () => {
  describe("formatUsdPlanPrice", () => {
    it("formats integer prices without decimals", () => {
      expect(formatUsdPlanPrice(0)).toBe("$0");
      expect(formatUsdPlanPrice(10)).toBe("$10");
      expect(formatUsdPlanPrice(99)).toBe("$99");
    });

    it("formats decimal prices with 2 decimal places", () => {
      expect(formatUsdPlanPrice(9.99)).toBe("$9.99");
      expect(formatUsdPlanPrice(4.5)).toBe("$4.50");
    });
  });

  describe("getMonthlyPlanSuffix", () => {
    it("returns /mo for English", () => {
      expect(getMonthlyPlanSuffix("en")).toBe("/mo");
      expect(getMonthlyPlanSuffix("en-GB")).toBe("/mo");
      expect(getMonthlyPlanSuffix("EN")).toBe("/mo");
    });

    it("returns /mês for Portuguese", () => {
      expect(getMonthlyPlanSuffix("pt")).toBe("/mês");
      expect(getMonthlyPlanSuffix("pt-BR")).toBe("/mês");
    });

    it("returns /mes for Spanish (default)", () => {
      expect(getMonthlyPlanSuffix("es")).toBe("/mes");
      expect(getMonthlyPlanSuffix("es-UY")).toBe("/mes");
      expect(getMonthlyPlanSuffix("fr")).toBe("/mes");
    });
  });
});
