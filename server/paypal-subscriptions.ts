import { Hono } from "hono";
import { PrismaClient } from "@prisma/client";
import { getUserById, verifyJwt } from "./auth.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as kv from "./kv.js";
import { buildRegionPolicy } from "./profile-region-policy.js";
import {
  persistSubscriptionBillingMetadata,
  resolveSubscriptionBillingMetadata,
  type SubscriptionBillingCycle,
} from "./subscription-billing-map.js";

const app = new Hono();
const connectionString = process.env.DATABASE_URL || "postgresql://vorea:vorea_dev@localhost:5432/vorea_studio?schema=public";
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";
const PAYPAL_API = process.env.PAYPAL_MODE === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || "";

// ─── Plan ID Mapping (tier + billing → PayPal Plan ID) ──────────────────────

type PlanKey = "PRO_monthly" | "PRO_yearly" | "STUDIO PRO_monthly" | "STUDIO PRO_yearly";

const PLAN_IDS: Record<PlanKey, string> = {
  "PRO_monthly": process.env.PAYPAL_PRO_MONTHLY_PLAN_ID || "",
  "PRO_yearly": process.env.PAYPAL_PRO_YEARLY_PLAN_ID || "",
  "STUDIO PRO_monthly": process.env.PAYPAL_STUDIOPRO_MONTHLY_PLAN_ID || "",
  "STUDIO PRO_yearly": process.env.PAYPAL_STUDIOPRO_YEARLY_PLAN_ID || "",
};

const VALID_TIERS = ["PRO", "STUDIO PRO"];
const VALID_BILLING = ["monthly", "yearly"];

function normalizeDisplayTier(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function extractSaleAmountInfo(sale: any): { amountUsd: number | null; currency: string | null } {
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

// ─── PayPal Auth ──────────────────────────────────────────────────────────────

async function getPayPalAccessToken(): Promise<string> {
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`PayPal auth failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function verifyWebhookSignature(event: unknown, c: { req: { header: (name: string) => string | undefined } }) {
  if (!PAYPAL_WEBHOOK_ID) {
    console.error("[PayPal Webhook] Missing PAYPAL_WEBHOOK_ID. Refusing unsigned webhook processing.");
    return false;
  }

  const transmissionId = c.req.header("paypal-transmission-id");
  const transmissionSig = c.req.header("paypal-transmission-sig");
  const transmissionTime = c.req.header("paypal-transmission-time");
  const authAlgo = c.req.header("paypal-auth-algo");
  const certUrl = c.req.header("paypal-cert-url");

  if (!transmissionId || !transmissionSig || !transmissionTime || !authAlgo || !certUrl) {
    console.error("[PayPal Webhook] Missing required PayPal signature headers.");
    return false;
  }

  const accessToken = await getPayPalAccessToken();
  const res = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    }),
  });

  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[PayPal Webhook] Signature verification API failed:", JSON.stringify(result));
    return false;
  }
  return result?.verification_status === "SUCCESS";
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/subscriptions/plans – Returns the plan IDs configured
app.get("/plans", (c) => {
  return c.json({ plans: PLAN_IDS });
});

// GET /api/subscriptions/client-id – Returns the PayPal Client ID for frontend SDK
app.get("/client-id", (c) => {
  return c.json({ clientId: PAYPAL_CLIENT_ID });
});

// POST /api/subscriptions/create – Create a subscription
app.post("/create", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "No autorizado" }, 401);
    }
    const token = authHeader.split(" ")[1];
    const payload = verifyJwt(token);
    if (!payload || !payload.sub) {
      return c.json({ error: "Token de sesión inválido" }, 401);
    }
    const userId = payload.sub;
    const authUser = await getUserById(userId);
    if (!authUser) {
      return c.json({ error: "Usuario no encontrado" }, 404);
    }

    const body = await c.req.json();
    let { tier, billing } = body;

    // Normalize tier name: accept both "STUDIO_PRO" and "STUDIO PRO"
    if (tier === "STUDIO_PRO") tier = "STUDIO PRO";

    billing = billing || "monthly";

    if (!VALID_TIERS.includes(tier)) {
      return c.json({ error: `Plan inválido: ${tier}. Opciones: PRO, STUDIO PRO` }, 400);
    }
    if (!VALID_BILLING.includes(billing)) {
      return c.json({ error: `Periodo inválido: ${billing}. Opciones: monthly, yearly` }, 400);
    }

    const regionPolicy = buildRegionPolicy({
      countryCode: authUser.country_code,
      regionCode: authUser.region_code,
    });
    const requiresStepUp =
      regionPolicy.requiresStepUpOnPayment &&
      !authUser.email_verified_at;
    if (requiresStepUp) {
      return c.json(
        {
          error: "Debes verificar tu correo antes de continuar con el pago en tu región.",
          verificationRequired: true,
          regionPolicy,
        },
        403
      );
    }

    const planKey = `${tier}_${billing}` as PlanKey;
    const planId = PLAN_IDS[planKey];

    if (!planId) {
      return c.json({ error: `Plan ID no configurado para ${planKey}. Configure PAYPAL_*_PLAN_ID en .env` }, 500);
    }

    console.log(`[PayPal] Creating subscription: tier=${tier}, billing=${billing}, planId=${planId}, user=${userId}`);

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_API}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: userId,
        application_context: {
          brand_name: "Vorea Studio",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/perfil?sub=success`,
          cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/perfil?sub=cancelled`
        }
      })
    });

    const subData = await response.json();

    if (!response.ok) {
      console.error("PayPal Create Subscription Error:", JSON.stringify(subData, null, 2));
      return c.json({ error: `Error PayPal: ${subData.message || "Unknown"}` }, 500);
    }

    // Save PENDING subscription in the database
    await prisma.payPalSubscription.create({
      data: {
        subscriptionId: subData.id,
        userId: userId,
        planId: planId,
        tier: tier === "STUDIO PRO" ? "STUDIO_PRO" : tier as any,
        status: subData.status
      }
    });
    await persistSubscriptionBillingMetadata({
      subscriptionId: subData.id,
      planId,
      tier,
      billing: billing as SubscriptionBillingCycle,
    });

    // Find the approval URL to redirect the user
    const approveLink = subData.links?.find((l: any) => l.rel === "approve");

    return c.json({ 
      subscriptionId: subData.id, 
      status: subData.status,
      approveUrl: approveLink ? approveLink.href : null
    });
  } catch (e: any) {
    console.error("Create subscription error:", e);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

// GET /api/subscriptions/my-subscription – Get user's active subscription
app.get("/my-subscription", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ subscription: null });
    }
    const token = authHeader.split(" ")[1];
    const payload = verifyJwt(token);
    if (!payload || !payload.sub) {
      return c.json({ subscription: null });
    }
    const userId = payload.sub;

    const sub = await prisma.payPalSubscription.findFirst({
      where: { userId: userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" }
    });

    return c.json({ subscription: sub });
  } catch (e: any) {
    return c.json({ subscription: null });
  }
});

// POST /api/subscriptions/webhook - PayPal Webhook Listener
app.post("/webhook", async (c) => {
  try {
    const bodyText = await c.req.text();
    let event: any;
    try {
      event = JSON.parse(bodyText);
    } catch {
      return c.json({ error: "Webhook payload inválido" }, 400);
    }

    const signatureVerified = await verifyWebhookSignature(event, c);
    if (!signatureVerified) {
      return c.json({ error: "Firma de webhook inválida" }, 400);
    }

    console.log(`[PayPal Webhook] Received event: ${event.event_type}`);

    if (event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED") {
      const subId = event.resource.id;
      const customId = event.resource.custom_id; // userId
      
      console.log(`[PayPal Webhook] Activating subscription ${subId} for user ${customId}`);

      const sub = await prisma.payPalSubscription.update({
        where: { subscriptionId: subId },
        data: { status: "ACTIVE" }
      });
      const resolvedBilling = await resolveSubscriptionBillingMetadata({
        subscriptionId: sub.subscriptionId,
        planId: sub.planId,
      });
      if (resolvedBilling?.billing) {
        await persistSubscriptionBillingMetadata({
          subscriptionId: sub.subscriptionId,
          planId: sub.planId,
          tier: normalizeDisplayTier(sub.tier),
          billing: resolvedBilling.billing,
        });
      }

      // Promote User tier — use the Prisma enum value directly (tier is already STUDIO_PRO or PRO)
      if (sub && sub.userId) {
        await prisma.user.update({
          where: { id: sub.userId },
          data: { tier: sub.tier }
        });
      }
    } else if (
      event.event_type === "BILLING.SUBSCRIPTION.CANCELLED" || 
      event.event_type === "BILLING.SUBSCRIPTION.EXPIRED" || 
      event.event_type === "BILLING.SUBSCRIPTION.SUSPENDED"
    ) {
      const subId = event.resource.id;
      
      console.log(`[PayPal Webhook] Subscription ${subId} marked as ${event.event_type}`);

      const sub = await prisma.payPalSubscription.update({
        where: { subscriptionId: subId },
        data: { status: event.event_type.split(".").pop() }
      });

      // Demote to FREE
      if (sub && sub.userId) {
        await prisma.user.update({
          where: { id: sub.userId },
          data: { tier: "FREE" }
        });
      }
    } else if (event.event_type === "PAYMENT.SALE.COMPLETED") {
      const sale = event.resource;
      if (sale.billing_agreement_id) {
         console.log(`[PayPal Webhook] Recurring payment collected for sub: ${sale.billing_agreement_id}`);
         const subscription = await prisma.payPalSubscription.findUnique({
           where: { subscriptionId: sale.billing_agreement_id },
         });
         const billingMeta = subscription
           ? await resolveSubscriptionBillingMetadata({
             subscriptionId: subscription.subscriptionId,
             planId: subscription.planId,
           })
           : null;

         if (subscription && billingMeta?.billing) {
           await persistSubscriptionBillingMetadata({
             subscriptionId: subscription.subscriptionId,
             planId: subscription.planId,
             tier: normalizeDisplayTier(subscription.tier),
             billing: billingMeta.billing,
           });
         }

         const saleId = String(sale?.id || "").trim();
         const paymentKey = saleId ? `paypal:subscription:payment:${saleId}` : "";
         const { amountUsd, currency } = extractSaleAmountInfo(sale);
         if (paymentKey && subscription && amountUsd !== null && currency === "USD") {
           const existing = await kv.get(paymentKey);
           if (!existing) {
             await kv.set(paymentKey, {
               saleId,
               subscriptionId: subscription.subscriptionId,
               userId: subscription.userId,
               planId: subscription.planId,
               tier: normalizeDisplayTier(subscription.tier),
               billing: billingMeta?.billing || "unknown",
               amountUsd,
               currency,
               status: "COMPLETED",
               paidAt: sale?.create_time || sale?.update_time || new Date().toISOString(),
               updatedAt: new Date().toISOString(),
             });
           }
         }
      }
    }

    return c.json({ status: "processed" });
  } catch (e: any) {
    console.error("Webhook processing error:", e);
    return c.json({ error: "Webhook error" }, 500);
  }
});

export default app;
