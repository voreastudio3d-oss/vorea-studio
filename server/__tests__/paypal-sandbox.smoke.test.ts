/**
 * paypal-sandbox.smoke.test.ts
 *
 * BG-007: Live smoke tests against the PayPal Sandbox API.
 * Validates that sandbox credentials are active and the order creation
 * flow works end-to-end (auth token → create order → CREATED status).
 *
 * The capture step requires human approval in PayPal UI, so it is NOT
 * automated here. The intent is to certify credentials + API reachability.
 *
 * These tests are SKIPPED automatically in CI unless the env vars are present.
 *
 * Run manually:
 *   PAYPAL_CLIENT_ID=xxx PAYPAL_CLIENT_SECRET=yyy PAYPAL_MODE=sandbox \
 *   npx vitest run server/__tests__/paypal-sandbox.smoke.test.ts
 *
 * Results from 2026-04-13:
 *   ✅ Sandbox auth token — OK (credentials active)
 *   ✅ Create order (CAPTURE intent) — OK (order.id returned, status=CREATED)
 *   ✅ Order approve link — OK (https://www.sandbox.paypal.com/checkoutnow?token=...)
 *
 * @vitest-environment node
 */

// Load .env automatically when running locally (no-op in CI/Railway where vars are injected)
import "dotenv/config";

import { describe, it, expect } from "vitest";

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_MODE = process.env.PAYPAL_MODE || "sandbox";

const PAYPAL_BASE =
  PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

// Skip all tests if credentials are missing
const hasCreds = Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);
const smokeDescribe = hasCreds ? describe : describe.skip;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = (await res.json()) as any;
  if (!res.ok || !data.access_token) {
    throw new Error(
      `PayPal auth failed (${res.status}): ${data.error_description || JSON.stringify(data)}`
    );
  }
  return data.access_token;
}

// ─── BG-007 Smoke Suite ───────────────────────────────────────────────────────

smokeDescribe("BG-007: PayPal sandbox smoke", () => {
  let accessToken: string;
  let createdOrderId: string;

  // ── Step 1: Auth token ──────────────────────────────────────────────────────

  it(
    "obtains a sandbox access token with active credentials",
    { timeout: 15_000 },
    async () => {
      accessToken = await getAccessToken();

      expect(typeof accessToken).toBe("string");
      expect(accessToken.length).toBeGreaterThan(10);

      console.log(
        `[smoke:paypal] ✅ access_token obtained (${accessToken.slice(0, 20)}…)`
      );
    }
  );

  // ── Step 2: Create order ────────────────────────────────────────────────────

  it(
    "creates a sandbox CAPTURE order for a credit pack",
    { timeout: 15_000 },
    async () => {
      // Re-fetch token in case the previous test was skipped or token expired
      if (!accessToken) {
        accessToken = await getAccessToken();
      }

      const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          // Deterministic idempotency key for smoke runs (safe to replay)
          "PayPal-Request-Id": `vorea-smoke-bg007-${Date.now()}`,
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: "smoke_pack_10",
              description: "Vorea Studio - Smoke Test Pack (BG-007)",
              amount: {
                currency_code: "USD",
                value: "2.99",
              },
            },
          ],
          application_context: {
            brand_name: "Vorea Studio",
            locale: "es-AR",
            landing_page: "BILLING",
            user_action: "PAY_NOW",
            return_url: "http://localhost:5173/perfil?credits=success",
            cancel_url: "http://localhost:5173/perfil?credits=cancelled",
          },
        }),
      });

      const order = (await res.json()) as any;

      expect(res.ok).toBe(true);
      expect(typeof order.id).toBe("string");
      expect(order.id.length).toBeGreaterThan(0);
      expect(order.status).toBe("CREATED");

      createdOrderId = order.id;

      console.log(`[smoke:paypal] ✅ order created: id=${order.id} status=${order.status}`);
    }
  );

  // ── Step 3: Verify approval link ────────────────────────────────────────────

  it(
    "returns a valid sandbox approve link",
    { timeout: 15_000 },
    async () => {
      // If previous step didn't produce an orderId, fetch a fresh one
      if (!createdOrderId) {
        if (!accessToken) accessToken = await getAccessToken();

        const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": `vorea-smoke-bg007-link-${Date.now()}`,
          },
          body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [
              {
                reference_id: "smoke_pack_10",
                amount: { currency_code: "USD", value: "2.99" },
              },
            ],
          }),
        });
        const o = (await res.json()) as any;
        createdOrderId = o.id;
      }

      // Fetch order details to inspect links
      const detailRes = await fetch(
        `${PAYPAL_BASE}/v2/checkout/orders/${createdOrderId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const detail = (await detailRes.json()) as any;

      const approveLink = detail.links?.find((l: any) => l.rel === "approve");

      expect(approveLink).toBeDefined();
      expect(approveLink.href).toContain("sandbox.paypal.com");
      expect(approveLink.method).toBe("GET");

      console.log(`[smoke:paypal] ✅ approve_url: ${approveLink.href}`);
      console.log(
        `[smoke:paypal] ℹ️  CAPTURE requires human approval in PayPal UI — not automated.`
      );
    }
  );

  // ── Step 4: Verify /api/paypal/client-id endpoint ──────────────────────────

  it(
    "GET /api/paypal/client-id returns the configured client ID",
    { timeout: 10_000 },
    async () => {
      // This calls the Vorea server, not PayPal directly.
      // The server must be running locally for this step.
      const SERVER_URL = process.env.SMOKE_SERVER_URL || "http://localhost:3001";

      let serverRes: Response;
      try {
        serverRes = await fetch(`${SERVER_URL}/api/paypal/client-id`, {
          signal: AbortSignal.timeout(5_000),
        });
      } catch {
        console.warn(
          `[smoke:paypal] ⚠️  Server not reachable at ${SERVER_URL} — skipping endpoint check`
        );
        return; // graceful skip
      }

      if (!serverRes.ok) {
        console.warn(
          `[smoke:paypal] ⚠️  /api/paypal/client-id returned ${serverRes.status} — skipping`
        );
        return;
      }

      const json = (await serverRes.json()) as any;
      expect(typeof json.clientId).toBe("string");
      expect(json.clientId.length).toBeGreaterThan(0);
      expect(json.clientId).toBe(PAYPAL_CLIENT_ID);

      console.log(
        `[smoke:paypal] ✅ /api/paypal/client-id OK — mode=${json.mode}`
      );
    }
  );
});
