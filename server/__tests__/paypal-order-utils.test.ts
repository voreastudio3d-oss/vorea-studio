// @vitest-environment node

import {
  amountsMatchUsd,
  extractCapturePaymentInfo,
  findCreditPackById,
  normalizeUsdAmount,
  sanitizeCreditPacks,
  type CreditPackConfig,
} from "../paypal-order-utils.js";

describe("paypal-order-utils", () => {
  const fallbackPacks: CreditPackConfig[] = [
    { id: "pack_10", name: "Pack Starter", credits: 10, price: 2.99, pricePerCredit: 0.3 },
    { id: "pack_30", name: "Pack Pro", credits: 30, price: 6.99, pricePerCredit: 0.23 },
  ];

  it("normalizes valid USD amounts and rejects invalid values", () => {
    expect(normalizeUsdAmount(2.994)).toBe(2.99);
    expect(normalizeUsdAmount("6.99")).toBe(6.99);
    expect(normalizeUsdAmount(0)).toBeNull();
    expect(normalizeUsdAmount(-1)).toBeNull();
    expect(normalizeUsdAmount("abc")).toBeNull();
  });

  it("matches close USD amounts with tolerance", () => {
    expect(amountsMatchUsd(2.99, 2.99)).toBe(true);
    expect(amountsMatchUsd(2.99, 2.995)).toBe(true);
    expect(amountsMatchUsd(2.99, 3.05)).toBe(false);
  });

  it("sanitizes pack configs and falls back when input is invalid", () => {
    const sanitized = sanitizeCreditPacks(
      [
        { id: "pack_100", name: "Pack Studio", credits: 100, price: 17.99 },
        { id: "", name: "broken", credits: 0, price: -1 },
      ],
      fallbackPacks
    );
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0].id).toBe("pack_100");
    expect(sanitized[0].pricePerCredit).toBeCloseTo(0.18, 2);

    const fallback = sanitizeCreditPacks("invalid", fallbackPacks);
    expect(fallback).toHaveLength(2);
    expect(fallback[0].id).toBe("pack_10");
  });

  it("resolves pack by id", () => {
    const pack = findCreditPackById(fallbackPacks, "pack_30");
    expect(pack?.credits).toBe(30);
    expect(findCreditPackById(fallbackPacks, "pack_999")).toBeNull();
  });

  it("extracts capture payment info from PayPal payload", () => {
    const payload = {
      status: "COMPLETED",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: "6.99" },
          payments: {
            captures: [
              {
                id: "CAPTURE123",
                status: "COMPLETED",
                amount: { currency_code: "USD", value: "6.99" },
              },
            ],
          },
        },
      ],
    };

    const info = extractCapturePaymentInfo(payload);
    expect(info.amount).toBe(6.99);
    expect(info.currency).toBe("USD");
    expect(info.captureId).toBe("CAPTURE123");
    expect(info.status).toBe("COMPLETED");
  });
});
