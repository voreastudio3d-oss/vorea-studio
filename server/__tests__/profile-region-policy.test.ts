import { describe, expect, it } from "vitest";

import {
  buildRegionPolicy,
  normalizeCountryCode,
  normalizeLocaleCode,
  normalizePhone,
  resolveRegionCode,
  sanitizeBillingProfile,
} from "../profile-region-policy.js";

describe("profile region policy", () => {
  it("normalizes country, locale and phone inputs", () => {
    expect(normalizeCountryCode(" uy ")).toBe("UY");
    expect(normalizeLocaleCode("pt-BR")).toBe("pt");
    expect(normalizePhone(" +598 99 123 456 ")).toBe("+59899123456");
  });

  it("sanitizes billing profile and strips empty payloads", () => {
    expect(sanitizeBillingProfile({})).toBeNull();
    expect(
      sanitizeBillingProfile({
        fullName: "  Marta Daguerre  ",
        companyName: " Vorea Studio ",
        countryCode: "uy",
      })
    ).toEqual({
      fullName: "Marta Daguerre",
      companyName: "Vorea Studio",
      taxId: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      state: null,
      postalCode: null,
      countryCode: "UY",
    });
  });

  it("resolves latam policy from country and returns recommended providers", () => {
    expect(resolveRegionCode("UY")).toBe("LATAM");

    expect(buildRegionPolicy({ countryCode: "UY" })).toEqual({
      regionCode: "LATAM",
      recommendedAuthProviders: ["google", "apple", "facebook"],
      recommendedPaymentProviders: ["paypal", "stripe", "mercado_pago"],
      phoneVerificationRecommended: true,
      billingAddressRecommended: true,
      requiresStepUpOnPayment: true,
    });
  });
});
