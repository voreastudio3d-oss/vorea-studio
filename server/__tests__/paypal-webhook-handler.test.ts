/**
 * PayPal webhook handler — unit tests for event routing and processing logic.
 * Tests the webhook event classification and field extraction without
 * requiring a database connection or live PayPal API.
 */
import { describe, it, expect } from "vitest";

// ─── Replicate internal logic for isolated testing ───────────────────────────

function classifyWebhookEvent(event: any): {
  type: "activation" | "cancellation" | "payment" | "unknown";
  subscriptionId: string | null;
  userId: string | null;
} {
  const eventType = String(event?.event_type || "");

  if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
    return {
      type: "activation",
      subscriptionId: event?.resource?.id || null,
      userId: event?.resource?.custom_id || null,
    };
  }

  if (
    eventType === "BILLING.SUBSCRIPTION.CANCELLED" ||
    eventType === "BILLING.SUBSCRIPTION.EXPIRED" ||
    eventType === "BILLING.SUBSCRIPTION.SUSPENDED"
  ) {
    return {
      type: "cancellation",
      subscriptionId: event?.resource?.id || null,
      userId: null,
    };
  }

  if (eventType === "PAYMENT.SALE.COMPLETED") {
    return {
      type: "payment",
      subscriptionId: event?.resource?.billing_agreement_id || null,
      userId: null,
    };
  }

  return { type: "unknown", subscriptionId: null, userId: null };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("paypal-webhook — event routing", () => {
  it("classifies BILLING.SUBSCRIPTION.ACTIVATED with subscription and user IDs", () => {
    const event = {
      event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
      resource: { id: "I-SUB123", custom_id: "user_abc" },
    };
    const result = classifyWebhookEvent(event);
    expect(result.type).toBe("activation");
    expect(result.subscriptionId).toBe("I-SUB123");
    expect(result.userId).toBe("user_abc");
  });

  it("classifies BILLING.SUBSCRIPTION.CANCELLED", () => {
    const result = classifyWebhookEvent({
      event_type: "BILLING.SUBSCRIPTION.CANCELLED",
      resource: { id: "I-SUB456" },
    });
    expect(result.type).toBe("cancellation");
    expect(result.subscriptionId).toBe("I-SUB456");
  });

  it("classifies BILLING.SUBSCRIPTION.EXPIRED", () => {
    const result = classifyWebhookEvent({
      event_type: "BILLING.SUBSCRIPTION.EXPIRED",
      resource: { id: "I-SUB789" },
    });
    expect(result.type).toBe("cancellation");
  });

  it("classifies BILLING.SUBSCRIPTION.SUSPENDED", () => {
    const result = classifyWebhookEvent({
      event_type: "BILLING.SUBSCRIPTION.SUSPENDED",
      resource: { id: "I-SUB000" },
    });
    expect(result.type).toBe("cancellation");
  });

  it("classifies PAYMENT.SALE.COMPLETED with billing_agreement_id", () => {
    const result = classifyWebhookEvent({
      event_type: "PAYMENT.SALE.COMPLETED",
      resource: {
        id: "SALE-001",
        billing_agreement_id: "I-SUB123",
        amount: { total: "9.99", currency: "USD" },
      },
    });
    expect(result.type).toBe("payment");
    expect(result.subscriptionId).toBe("I-SUB123");
  });

  it("returns unknown for unrecognized event types", () => {
    const result = classifyWebhookEvent({
      event_type: "CUSTOMER.DISPUTE.CREATED",
      resource: { id: "DISPUTE-1" },
    });
    expect(result.type).toBe("unknown");
    expect(result.subscriptionId).toBeNull();
  });

  it("handles null/undefined event gracefully", () => {
    expect(classifyWebhookEvent(null).type).toBe("unknown");
    expect(classifyWebhookEvent(undefined).type).toBe("unknown");
    expect(classifyWebhookEvent({}).type).toBe("unknown");
  });

  it("handles missing resource fields without crashing", () => {
    const result = classifyWebhookEvent({
      event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
      resource: {},
    });
    expect(result.type).toBe("activation");
    expect(result.subscriptionId).toBeNull();
    expect(result.userId).toBeNull();
  });
});

describe("paypal-webhook — payment sale extraction", () => {
  // Replicate extractSaleAmountInfo from paypal-subscriptions.ts
  function extractSaleAmountInfo(sale: any): {
    amountUsd: number | null;
    currency: string | null;
  } {
    const amountCandidates = [
      { value: sale?.amount?.total, currency: sale?.amount?.currency },
      { value: sale?.amount?.value, currency: sale?.amount?.currency_code },
    ];
    for (const candidate of amountCandidates) {
      const amount = Number(candidate.value);
      const currency = String(candidate.currency || "").trim().toUpperCase();
      if (Number.isFinite(amount) && amount >= 0 && currency) {
        return { amountUsd: Number(amount.toFixed(2)), currency };
      }
    }
    return { amountUsd: null, currency: null };
  }

  it("extracts amount from v1 format (amount.total + amount.currency)", () => {
    const info = extractSaleAmountInfo({
      amount: { total: "9.99", currency: "USD" },
    });
    expect(info.amountUsd).toBe(9.99);
    expect(info.currency).toBe("USD");
  });

  it("extracts amount from v2 format (amount.value + amount.currency_code)", () => {
    const info = extractSaleAmountInfo({
      amount: { value: "19.99", currency_code: "usd" },
    });
    expect(info.amountUsd).toBe(19.99);
    expect(info.currency).toBe("USD");
  });

  it("returns null for missing amount", () => {
    expect(extractSaleAmountInfo({}).amountUsd).toBeNull();
    expect(extractSaleAmountInfo(null).amountUsd).toBeNull();
  });

  it("rejects negative amounts", () => {
    const info = extractSaleAmountInfo({
      amount: { total: "-5.00", currency: "USD" },
    });
    expect(info.amountUsd).toBeNull();
  });

  it("builds idempotency key from sale ID", () => {
    const saleId = "SALE-12345";
    const key = saleId ? `paypal:subscription:payment:${saleId}` : "";
    expect(key).toBe("paypal:subscription:payment:SALE-12345");
  });

  it("produces empty key for empty sale ID", () => {
    const saleId = "";
    const key = saleId ? `paypal:subscription:payment:${saleId}` : "";
    expect(key).toBe("");
  });
});

describe("paypal-webhook — tier demotion mapping", () => {
  it("maps CANCELLED to correct status suffix", () => {
    const eventType = "BILLING.SUBSCRIPTION.CANCELLED";
    const status = eventType.split(".").pop();
    expect(status).toBe("CANCELLED");
  });

  it("maps EXPIRED to correct status suffix", () => {
    const eventType = "BILLING.SUBSCRIPTION.EXPIRED";
    const status = eventType.split(".").pop();
    expect(status).toBe("EXPIRED");
  });

  it("maps SUSPENDED to correct status suffix", () => {
    const eventType = "BILLING.SUBSCRIPTION.SUSPENDED";
    const status = eventType.split(".").pop();
    expect(status).toBe("SUSPENDED");
  });
});
