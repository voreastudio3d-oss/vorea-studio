import { Hono } from "hono";
import {
  applyRateLimitHeaders,
  consumeRateLimit,
  getClientIp,
} from "./middleware/rate-limit.js";
import { createMiddleware } from "hono/factory";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import * as kv from "./kv.js";
import * as auth from "./auth.js";
import { clearSessionCookie, setSessionCookie } from "./docs-access.js";
import { createCommunityRepository } from "./community-repository.js";
import newsApp from "./news-routes.js";
import paypalSubscriptionsApp from "./paypal-subscriptions.js";
import aiStudioRoutes from "./ai-studio-routes.js";
import { executeMcpInternalTool, type McpInternalToolName } from "./mcp-tools.js";
import { fetchGa4Metrics, generateMockMetrics, isGa4Configured } from "./ga4-data.js";
import { generateInsightsWithGemini, generateFallbackInsights, type AnalyticsInsightsResponse } from "./analytics-insights.js";
import { generateQuickFixWithGemini } from "./ai-quick-fix.js";
import { buildAiBudgetAdminSnapshot, getLaneMatrixConfigForAdmin, saveLaneMatrixConfig, resetLaneMatrixConfig, setLaneMatrixKvAccessor } from "./ai-studio-pipeline.js";
import {
  buildDefaultOgSvg,
  buildOgSvg,
  OG_ROUTE_CONFIGS,
  buildRobotsTxt,
  buildSitemapSectionXml,
  buildSitemapXml,
} from "./seo.js";
import { zipSync, strToU8 } from "fflate";
import {
  amountsMatchUsd,
  extractCapturePaymentInfo,
  findCreditPackById,
  normalizeUsdAmount,
  sanitizeCreditPacks,
  type CreditPackConfig,
} from "./paypal-order-utils.js";
import {
  DONATION_TIERS,
  getDonationTier,
  getPublicDonationTiers,
  replaceContributorBadge,
  resolveContributorTier,
  sanitizeDonationMessage,
  sortPublicContributors,
  type DonationVisibility,
} from "./donations.js";
import { getSubscriptionFinanceSummary } from "./subscription-finance.js";
import { getPrismaClient } from "./prisma.js";
import {
  buildRegionPolicy,
  normalizeCountryCode,
  normalizeLocaleCode,
  normalizePhone,
  resolveRegionCode,
  sanitizeBillingProfile,
} from "./profile-region-policy.js";
import { applyToolCreditPrecharge } from "./tool-credit-state.js";
import { Resend } from "resend";

type Variables = {
  userId: string;
};
const app = new Hono<{ Variables: Variables }>();
const prisma = getPrismaClient();
const MCP_INTERNAL_SECRET = process.env.MCP_INTERNAL_SECRET || "";

const COMMUNITY_DB_MODE = (process.env.COMMUNITY_DB_MODE || "kv").toLowerCase();
const communityRepo = createCommunityRepository(COMMUNITY_DB_MODE);
console.log(`[community] repository mode: ${COMMUNITY_DB_MODE}`);

// Initialize lane matrix KV accessor for dynamic AI routing config
setLaneMatrixKvAccessor(kv);
const CONTACT_RECEIVER_EMAIL =
  process.env.CONTACT_RECEIVER_EMAIL ||
  process.env.OWNER_EMAIL ||
  "vorea.studio3d@gmail.com";

// Enable logger
app.use("*", logger(console.log));

// Enable CORS for all routes and methods
// HIGH-3 FIX: Restrict CORS to allowed origins only
const ALLOWED_ORIGINS = [
  "https://voreastudio.com",
  "https://www.voreastudio.com",
  "https://voreastudio3d.com",
  "https://www.voreastudio3d.com",
  "http://voreastudio3d.com",
  "http://www.voreastudio3d.com",
  "http://localhost:5173",
  "http://localhost:4173",
  // Dynamically add FRONTEND_URL if set
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(
  "/*",
  cors({
    origin: (origin) => {
      if (!origin) return ALLOWED_ORIGINS[0]; // server-to-server
      return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getUserId(c: any): Promise<string | null> {
  return auth.getUserIdFromHeader(c.req.header("Authorization"));
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function hasMcpInternalAccess(c: any): boolean {
  if (MCP_INTERNAL_SECRET) {
    const token = c.req.header("x-mcp-secret");
    return token === MCP_INTERNAL_SECRET;
  }
  // Allow local/dev usage when no explicit secret is configured.
  return process.env.NODE_ENV !== "production";
}

// ─── Inline rate limit helpers ──────────────────────────────────────────────

async function enforceRateLimit(
  c: any,
  key: string,
  maxRequests: number,
  windowMs: number,
  message: string
) {
  const result = await consumeRateLimit(key, maxRequests, windowMs);
  applyRateLimitHeaders(c, result);

  if (!result.limited) {
    return null;
  }

  return c.json(
    {
      error: message,
      retryAfter: result.retryAfter,
    },
    429
  );
}

// ─── MED-3 FIX: Strong password validation ────────────────────────────────────

function validatePassword(password: string): string | null {
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres";
  if (!/[A-Z]/.test(password)) return "La contraseña debe contener al menos una mayúscula";
  if (!/[0-9]/.test(password)) return "La contraseña debe contener al menos un número";
  if (!/[!@#$%^&*()_+\-=\[\]{};':",./<>?]/.test(password)) return "La contraseña debe contener al menos un carácter especial (!@#$%^&*...)";
  return null; // valid
}

async function sendResendEmailBestEffort(input: {
  to: string;
  subject: string;
  html: string;
  logLabel: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[AUTH] RESEND_API_KEY is not configured. ${input.logLabel} email was NOT sent.`);
    return false;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Vorea Studio <noreply@voreastudio3d.com>",
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    console.log(`[AUTH] ${input.logLabel} email sent securely via Resend to ${input.to}.`);
    return true;
  } catch (emailError: any) {
    console.error(`[AUTH] Failed to send ${input.logLabel} email to ${input.to} via Resend:`, emailError.message);
    return false;
  }
}

// ─── LOW-2 FIX: Secure audit logger with hash chain ──────────────────────────

let lastLogHash = "genesis";

async function auditLog(action: string, data: Record<string, unknown>): Promise<void> {
  const logId = `admin_log:${uid()}`;
  const timestamp = new Date().toISOString();
  const payload = { id: logId, action, ...data, at: timestamp, prevHash: lastLogHash };

  // Create hash chain: SHA-256(prevHash + action + timestamp)
  const encoder = new TextEncoder();
  const hashData = encoder.encode(`${lastLogHash}:${action}:${timestamp}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", hashData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  (payload as any).hash = hashHex;
  lastLogHash = hashHex;

  await kv.set(logId, payload);
}

// ─── Per-user Activity Log ────────────────────────────────────────────────────

const MAX_ACTIVITY_ENTRIES = 500;

async function userActivityLog(
  userId: string,
  action: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  try {
    const key = `user:${userId}:activity_log`;
    const log: any[] = (await kv.get(key)) || [];
    log.unshift({
      action,
      ...data,
      at: new Date().toISOString(),
    });
    // Cap at MAX_ACTIVITY_ENTRIES
    if (log.length > MAX_ACTIVITY_ENTRIES) log.length = MAX_ACTIVITY_ENTRIES;
    await kv.set(key, log);
  } catch (e: any) {
    console.log(`userActivityLog error: ${e.message}`);
  }
}

// ─── Superuser Guard ──────────────────────────────────────────────────────────

const SUPERADMIN_EMAILS = ["admin@vorea.studio", "vorea.studio3d@gmail.com", "martindaguerre@gmail.com"];

async function isSuperAdmin(c: any): Promise<{ ok: boolean; userId: string | null }> {
  const userId = await getUserId(c);
  if (!userId) return { ok: false, userId: null };
  try {
    // Check profile role in KV
    const profile = await kv.get(`user:${userId}:profile`);
    if (profile?.role === "superadmin") return { ok: true, userId };

    // Also check auth_users table for role
    const dbUser = await auth.getUserById(userId);
    if (dbUser?.role === "superadmin") return { ok: true, userId };

    // Also check email list for bootstrap
    const email = dbUser?.email || profile?.email;
    if (email && SUPERADMIN_EMAILS.includes(email)) {
      // Auto-promote in KV
      if (profile) {
        profile.role = "superadmin";
        await kv.set(`user:${userId}:profile`, profile);
      }
      // Auto-promote in auth_users
      await auth.updateUser(userId, { role: "superadmin" });
      return { ok: true, userId };
    }

    return { ok: false, userId };
  } catch {
    return { ok: false, userId: null };
  }
}

// ─── Middleware Guards ────────────────────────────────────────────────────────

export const requireAuth = createMiddleware(async (c, next) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: "No autorizado" }, 401);
  }
  c.set("userId", userId);
  await next();
});

export const requireSuperAdmin = createMiddleware(async (c, next) => {
  const { ok, userId } = await isSuperAdmin(c);
  if (!ok || !userId) {
    return c.json({ error: "Acceso denegado. Se requiere rol de superadmin." }, 403);
  }
  c.set("userId", userId);
  await next();
});

// ─── Monetization / Tier Gating Helpers ──────────────────────────────────────

type TierName = "FREE" | "PRO" | "STUDIO PRO";
type TierLimitKey = "free" | "pro" | "studioPro";
const TOOL_KEY_ALIASES: Record<string, string[]> = {
  community: ["community", "comunidad"],
  comunidad: ["comunidad", "community"],
  ai: ["ai", "ai_studio"],
  ai_studio: ["ai_studio", "ai"],
  maker_world: ["maker_world", "makerworld"],
  makerworld: ["makerworld", "maker_world"],
};

function normalizeTierName(raw: unknown): TierName {
  const tier = String(raw || "FREE").toUpperCase().replace(/_/g, " ").trim();
  if (tier === "PRO") return "PRO";
  if (tier === "STUDIO PRO" || tier === "STUDIO") return "STUDIO PRO";
  return "FREE";
}

function toTierLimitKey(tier: TierName): TierLimitKey {
  if (tier === "PRO") return "pro";
  if (tier === "STUDIO PRO") return "studioPro";
  return "free";
}

function getUsageBucket(period: string): string | null {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  if (period === "day") return `${year}-${month}-${day}`;
  if (period === "month") return `${year}-${month}`;
  if (period === "total") return "total";
  return null;
}

function getUsageCounterKey(
  userId: string,
  toolId: string,
  actionId: string,
  period: string,
  bucket: string
): string {
  return `usage:${userId}:${toolId}:${actionId}:${period}:${bucket}`;
}

function periodLabel(period: string): string {
  if (period === "day") return "día";
  if (period === "month") return "mes";
  if (period === "total") return "total";
  return period;
}

function resolveToolCandidates(toolId: string): string[] {
  const normalized = String(toolId || "").trim().toLowerCase();
  if (!normalized) return [];
  const aliased = TOOL_KEY_ALIASES[normalized] || [normalized];
  return [...new Set(aliased)];
}

type ToolActionConfigMatch = {
  action: any;
  resolvedToolId: string;
  toolCredits: any;
};

type UserToolCreditsState = {
  balance: number;
  monthlyAllocation: number;
  topupBalance: number;
  totalUsed: number;
  lastResetAt: string;
  tier: string;
  migratedLegacyCreditsAt?: string;
};

type ToolActionGateResult = {
  allowed: boolean;
  status?: number;
  error?: string;
  usageCounterKey?: string;
  creditCost?: number;
  resolvedToolId?: string;
  actionId?: string;
};

function getUserToolCreditsKey(userId: string): string {
  return `user:${userId}:tool_credits`;
}

function getLegacyCreditsKey(userId: string): string {
  return `user:${userId}:credits`;
}

function serializeLegacyCreditsState(state: any) {
  return {
    freeUsed: Math.max(0, Number(state?.freeUsed ?? 0)),
    purchasedCredits: Math.max(0, Number(state?.purchasedCredits ?? 0)),
    totalExported: Math.max(0, Number(state?.totalExported ?? 0)),
    lastExportAt: state?.lastExportAt ? String(state.lastExportAt) : undefined,
  };
}

function isStoredUserProfile(value: any): boolean {
  return Boolean(value && value.id && value.email && value.displayName !== undefined);
}

async function listStoredUserProfiles(): Promise<any[]> {
  const allData = await kv.getByPrefix("user:");
  const profiles = allData.filter((entry: any) => isStoredUserProfile(entry));

  const normalizedProfiles: any[] = [];
  for (const profile of profiles) {
    if (profile?.tier && typeof profile.tier === "string" && profile.tier.includes("_")) {
      const normalized = {
        ...profile,
        tier: profile.tier.replace(/_/g, " "),
      };
      await kv.set(`user:${normalized.id}:profile`, normalized);
      normalizedProfiles.push(normalized);
      continue;
    }
    normalizedProfiles.push(profile);
  }

  return normalizedProfiles;
}

function getMonthlyToolAllocation(toolCredits: any, tier: string): number {
  return Number(toolCredits?.monthlyCredits?.[tier] ?? 0);
}

function getMonthlyToolBalance(state: Partial<UserToolCreditsState> | null | undefined): number {
  const totalBalance = Math.max(0, Number(state?.balance ?? 0));
  const topupBalance = Math.max(0, Number(state?.topupBalance ?? 0));
  return Math.max(0, totalBalance - topupBalance);
}

function serializeToolCreditsState(state: UserToolCreditsState | null) {
  if (!state) return null;
  return {
    ...state,
    balance: Math.max(0, Number(state.balance ?? 0)),
    monthlyAllocation: Math.max(0, Number(state.monthlyAllocation ?? 0)),
    monthlyBalance: getMonthlyToolBalance(state),
    topupBalance: Math.max(0, Number(state.topupBalance ?? 0)),
    totalUsed: Math.max(0, Number(state.totalUsed ?? 0)),
    lastResetAt: String(state.lastResetAt || new Date().toISOString()),
    tier: String(state.tier || "FREE"),
  };
}

async function migrateLegacyPurchasedCreditsIntoToolBalance(
  userId: string,
  state: UserToolCreditsState
): Promise<boolean> {
  const legacyCredits = (await kv.get(getLegacyCreditsKey(userId))) as any;
  const purchasedCredits = Math.max(0, Number(legacyCredits?.purchasedCredits ?? 0));
  if (purchasedCredits <= 0) return false;

  state.topupBalance += purchasedCredits;
  state.balance += purchasedCredits;
  state.migratedLegacyCreditsAt = new Date().toISOString();

  await kv.set(getLegacyCreditsKey(userId), {
    freeUsed: Math.max(0, Number(legacyCredits?.freeUsed ?? 0)),
    purchasedCredits: 0,
    totalExported: Math.max(0, Number(legacyCredits?.totalExported ?? 0)),
    lastExportAt: legacyCredits?.lastExportAt || undefined,
  });

  await userActivityLog(userId, "tool_credit_topup_migrated", {
    creditsAdded: purchasedCredits,
    source: "legacy_export_credits",
    balanceAfter: state.balance,
    topupBalance: state.topupBalance,
  });

  return true;
}

async function addToolCreditTopUp(
  userId: string,
  userProfile: any,
  creditsToAdd: number,
  meta: Record<string, unknown> = {}
): Promise<UserToolCreditsState> {
  const topupCredits = Math.trunc(Number(creditsToAdd));
  if (!Number.isFinite(topupCredits) || topupCredits <= 0) {
    throw new Error("Cantidad de créditos inválida");
  }

  const toolCredits = await kv.get("admin:tool_credits") || DEFAULT_TOOL_CREDITS;
  const state = await getUserToolCreditsState(userId, userProfile, toolCredits);

  state.topupBalance += topupCredits;
  state.balance += topupCredits;
  await kv.set(getUserToolCreditsKey(userId), state);

  await userActivityLog(userId, "tool_credit_topped_up", {
    creditsAdded: topupCredits,
    balanceAfter: state.balance,
    topupBalance: state.topupBalance,
    ...meta,
  });

  return state;
}

async function getLegacyTopUpBackfillStatus(previewLimit = 8) {
  const profiles = await listStoredUserProfiles();
  const candidates: Array<{
    userId: string;
    email: string;
    displayName: string;
    tier: string;
    legacyPurchasedCredits: number;
    totalExported: number;
  }> = [];

  for (const profile of profiles) {
    const legacyCredits = serializeLegacyCreditsState(
      await kv.get(getLegacyCreditsKey(String(profile.id)))
    );
    if (legacyCredits.purchasedCredits <= 0) continue;

    candidates.push({
      userId: String(profile.id),
      email: String(profile.email || ""),
      displayName: String(profile.displayName || ""),
      tier: String(profile.tier || "FREE"),
      legacyPurchasedCredits: legacyCredits.purchasedCredits,
      totalExported: legacyCredits.totalExported,
    });
  }

  const lastRun = await kv.get("admin:tool_credits:legacy_backfill:last_run");
  return {
    totalUsersScanned: profiles.length,
    affectedUsers: candidates.length,
    totalLegacyPurchasedCredits: candidates.reduce(
      (sum, candidate) => sum + candidate.legacyPurchasedCredits,
      0
    ),
    preview: candidates.slice(0, previewLimit),
    lastRun,
  };
}

async function executeLegacyTopUpBackfill(actorUserId: string) {
  const profiles = await listStoredUserProfiles();
  const toolCredits = await kv.get("admin:tool_credits") || DEFAULT_TOOL_CREDITS;
  const migratedUsers: Array<{
    userId: string;
    email: string;
    displayName: string;
    tier: string;
    creditsMigrated: number;
    universalBalanceAfter: number;
    topupBalanceAfter: number;
  }> = [];

  for (const profile of profiles) {
    const legacyCredits = serializeLegacyCreditsState(
      await kv.get(getLegacyCreditsKey(String(profile.id)))
    );
    if (legacyCredits.purchasedCredits <= 0) continue;

    const migratedState = await getUserToolCreditsState(String(profile.id), profile, toolCredits);
    migratedUsers.push({
      userId: String(profile.id),
      email: String(profile.email || ""),
      displayName: String(profile.displayName || ""),
      tier: String(profile.tier || "FREE"),
      creditsMigrated: legacyCredits.purchasedCredits,
      universalBalanceAfter: Number(migratedState.balance || 0),
      topupBalanceAfter: Number(migratedState.topupBalance || 0),
    });
  }

  const runSummary = {
    executedAt: new Date().toISOString(),
    executedBy: actorUserId,
    migratedUsers: migratedUsers.length,
    totalCreditsMigrated: migratedUsers.reduce((sum, user) => sum + user.creditsMigrated, 0),
    preview: migratedUsers.slice(0, 10),
  };
  await kv.set("admin:tool_credits:legacy_backfill:last_run", runSummary);
  await auditLog("legacy_tool_credit_backfill", runSummary);

  const statusAfter = await getLegacyTopUpBackfillStatus();
  return {
    ...statusAfter,
    migratedUsers: runSummary.migratedUsers,
    totalCreditsMigrated: runSummary.totalCreditsMigrated,
    migrated: migratedUsers,
    lastRun: runSummary,
  };
}

async function getUserToolCreditsState(
  userId: string,
  userProfile: any,
  toolCredits: any
): Promise<UserToolCreditsState> {
  const tier = normalizeTierName(userProfile?.tier);
  const monthlyAllocation = getMonthlyToolAllocation(toolCredits, tier);
  const nowIso = new Date().toISOString();
  const currentMonth = nowIso.slice(0, 7);
  const storageKey = getUserToolCreditsKey(userId);

  const rawState = (await kv.get(storageKey)) as Partial<UserToolCreditsState> | null;
  const baseState: UserToolCreditsState = {
    balance: monthlyAllocation,
    monthlyAllocation,
    topupBalance: 0,
    totalUsed: 0,
    lastResetAt: nowIso,
    tier,
  };

  const state: UserToolCreditsState = {
    ...baseState,
    ...rawState,
    balance: Number(rawState?.balance ?? monthlyAllocation),
    monthlyAllocation: Number(rawState?.monthlyAllocation ?? monthlyAllocation),
    topupBalance: Math.max(0, Number(rawState?.topupBalance ?? 0)),
    totalUsed: Number(rawState?.totalUsed ?? 0),
    lastResetAt: String(rawState?.lastResetAt || nowIso),
    tier: String(rawState?.tier || tier),
    migratedLegacyCreditsAt: rawState?.migratedLegacyCreditsAt
      ? String(rawState.migratedLegacyCreditsAt)
      : undefined,
  };

  const storedMonth = state.lastResetAt.slice(0, 7);
  let mutated = !rawState;
  state.balance = Math.max(0, state.balance);
  if (state.balance < state.topupBalance) {
    state.balance = state.topupBalance;
    mutated = true;
  }

  const currentMonthlyBalance = getMonthlyToolBalance(state);

  if (storedMonth !== currentMonth) {
    state.balance = monthlyAllocation + state.topupBalance;
    state.monthlyAllocation = monthlyAllocation;
    state.lastResetAt = nowIso;
    state.tier = tier;
    mutated = true;
  } else if (state.monthlyAllocation !== monthlyAllocation || state.tier !== tier) {
    const usedFromMonthly = Math.max(0, state.monthlyAllocation - currentMonthlyBalance);
    const nextMonthlyBalance = Math.max(0, monthlyAllocation - usedFromMonthly);
    state.balance = nextMonthlyBalance + state.topupBalance;
    state.monthlyAllocation = monthlyAllocation;
    state.tier = tier;
    mutated = true;
  }

  const migratedLegacyCredits = await migrateLegacyPurchasedCreditsIntoToolBalance(userId, state);
  mutated = mutated || migratedLegacyCredits;

  if (mutated) {
    await kv.set(storageKey, state);
  }

  return state;
}

async function getToolActionConfig(
  toolId: string,
  actionId: string
): Promise<ToolActionConfigMatch | null> {
  const toolCredits = await kv.get("admin:tool_credits") || DEFAULT_TOOL_CREDITS;
  const actionIdNormalized = String(actionId || "").trim();
  const candidates = resolveToolCandidates(toolId);

  for (const candidate of candidates) {
    const actions = toolCredits?.tools?.[candidate]?.actions;
    if (!Array.isArray(actions)) continue;
    const match = actions.find((a: any) => String(a?.actionId || "").trim() === actionIdNormalized);
    if (match) {
      return { action: match, resolvedToolId: candidate, toolCredits };
    }
  }

  return null;
}

async function checkToolActionAllowed(
  userId: string,
  userProfile: any,
  toolId: string,
  actionId: string
): Promise<ToolActionGateResult> {
  if (userProfile?.role === "superadmin") {
    return { allowed: true };
  }

  const actionConfig = await getToolActionConfig(toolId, actionId);
  if (!actionConfig) {
    return { allowed: true };
  }
  const { action, resolvedToolId, toolCredits } = actionConfig;

  const tier = normalizeTierName(userProfile?.tier);
  const tierKey = toTierLimitKey(tier);
  const limit = action?.limits?.[tierKey];
  const creditCost = Math.max(0, Number(action?.creditCost ?? 0));

  // null means blocked for this tier
  if (limit === null) {
    return { allowed: false, status: 403, error: "Tu plan no incluye esta acción." };
  }

  let counterKey: string | undefined;

  // -1 means unlimited, undefined means no explicit rule
  if (limit !== -1 && limit !== undefined) {
    const period = String(action.limitPeriod || "month");
    const bucket = getUsageBucket(period);
    if (bucket) {
      counterKey = getUsageCounterKey(userId, resolvedToolId, actionId, period, bucket);
      const used = Number((await kv.get(counterKey)) || 0);
      const max = Number(limit);
      if (used >= max) {
        return {
          allowed: false,
          status: 402,
          error: `Límite alcanzado para esta acción (${max}/${periodLabel(period)}).`,
        };
      }
    }
  }

  if (creditCost > 0) {
    const credits = await getUserToolCreditsState(userId, userProfile, toolCredits);
    if (credits.balance < creditCost) {
      return {
        allowed: false,
        status: 402,
        error: `Créditos insuficientes. Necesitas ${creditCost} y tienes ${credits.balance}.`,
      };
    }
  }

  return {
    allowed: true,
    usageCounterKey: counterKey,
    creditCost,
    resolvedToolId,
    actionId,
  };
}

async function consumeToolActionUsage(
  userId: string | undefined,
  userProfile: any,
  gate?: ToolActionGateResult
): Promise<UserToolCreditsState | null> {
  if (gate?.usageCounterKey) {
    const used = Number((await kv.get(gate.usageCounterKey)) || 0);
    await kv.set(gate.usageCounterKey, used + 1);
  }

  if (!userId || !gate?.creditCost || gate.creditCost <= 0) {
    return null;
  }

  const toolCredits = await kv.get("admin:tool_credits") || DEFAULT_TOOL_CREDITS;
  const credits = await getUserToolCreditsState(userId, userProfile, toolCredits);
  if (credits.balance < gate.creditCost) {
    throw new Error(`Créditos insuficientes. Necesitas ${gate.creditCost} y tienes ${credits.balance}.`);
  }

  const { nextState, snapshot } = applyToolCreditPrecharge(credits, gate.creditCost);
  Object.assign(credits, nextState);
  await kv.set(getUserToolCreditsKey(userId), credits);
  await userActivityLog(userId, "tool_credit_consumed", {
    toolId: gate.resolvedToolId,
    actionId: gate.actionId,
    creditCost: gate.creditCost,
    balanceAfter: credits.balance,
    monthlyAllocation: credits.monthlyAllocation,
    monthlyBalanceAfter: getMonthlyToolBalance(credits),
    topupBalanceAfter: credits.topupBalance,
    creditsFromMonthly: snapshot.creditsFromMonthly,
    creditsFromTopup: snapshot.creditsFromTopup,
  });
  return credits;
}

function sanitizeCommunityModel(model: any, includeSource: boolean): any {
  if (!model || typeof model !== "object") return model;
  const sanitized = { ...model };

  const rawStatus = String(sanitized.status || "published").toLowerCase();
  const status = rawStatus === "draft" ? "draft" : rawStatus === "archived" ? "archived" : "published";
  const slug = slugifySegment(sanitized.slug || sanitized.title) || `model-${String(sanitized.id || "").slice(0, 12)}`;
  const canonicalBase = status === "draft" ? "/borrador" : "/modelo";

  sanitized.slug = slug;
  sanitized.canonicalPath = sanitized.canonicalPath || `${canonicalBase}/${sanitized.id}/${slug}`;

  if (Array.isArray(sanitized.media)) {
    const media = sanitized.media
      .filter((item: any) => item && typeof item.url === "string" && item.url.trim().length > 0)
      .map((item: any, index: number) => ({
        id: String(item.id || `mm_${index}`),
        url: String(item.url),
        order: typeof item.order === "number" ? item.order : index,
        source: item.source === "auto_capture" ? "auto_capture" : "user_upload",
        isCover: !!item.isCover,
        createdAt: item.createdAt || sanitized.createdAt || new Date().toISOString(),
      }))
      .slice(0, 24)
      .sort((a: any, b: any) => a.order - b.order);

    if (media.length > 0) {
      const coverIndex = media.findIndex((m: any) => m.isCover);
      const resolvedCoverIndex = coverIndex >= 0 ? coverIndex : 0;
      sanitized.media = media.map((m: any, index: number) => ({
        ...m,
        order: index,
        isCover: index === resolvedCoverIndex,
      }));
      sanitized.thumbnailUrl = sanitized.thumbnailUrl || sanitized.media[resolvedCoverIndex]?.url || null;
    } else {
      delete sanitized.media;
    }
  }

  if (!Array.isArray(sanitized.media) && sanitized.thumbnailUrl) {
    sanitized.media = [
      {
        id: `mm_cover_${String(sanitized.id || "model").slice(0, 16)}`,
        url: sanitized.thumbnailUrl,
        order: 0,
        source: "auto_capture",
        isCover: true,
        createdAt: sanitized.createdAt || new Date().toISOString(),
      },
    ];
  }

  if (!includeSource) {
    delete sanitized.scadSource;
    delete sanitized.reliefConfig;
  }
  return sanitized;
}

function slugifySegment(input: unknown): string {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getModelStatus(model: any): "draft" | "pendingReview" | "published" | "archived" {
  const raw = String(model?.status || "published").toLowerCase();
  if (raw === "draft") return "draft";
  if (raw === "pendingreview" || raw === "pending_review") return "pendingReview";
  if (raw === "archived") return "archived";
  return "published";
}

function canViewCommunityModel(model: any, viewerId: string | null, viewerIsAdmin: boolean): boolean {
  const status = getModelStatus(model);
  if (status === "published") return true;
  if (!viewerId) return false;
  // Admins see everything; authors see their own drafts and pending models
  if (viewerIsAdmin) return true;
  if (status === "draft" || status === "pendingReview") return model?.authorId === viewerId;
  return false;
}

function canInteractWithCommunityModel(model: any): boolean {
  return getModelStatus(model) === "published";
}

async function getViewerContext(c: any): Promise<{ viewerId: string | null; viewerIsAdmin: boolean }> {
  const viewerId = await getUserId(c).catch(() => null);
  if (!viewerId) {
    return { viewerId: null, viewerIsAdmin: false };
  }
  const { ok: viewerIsAdmin } = await isSuperAdmin(c).catch(() => ({ ok: false, userId: null }));
  return { viewerId, viewerIsAdmin: !!viewerIsAdmin };
}

function normalizeModelMedia(mediaInput: any, fallbackThumbnailUrl: string | null, nowIso: string): any[] {
  const rawItems = Array.isArray(mediaInput) ? mediaInput : [];
  const normalized = rawItems
    .filter((item: any) => item && typeof item.url === "string" && item.url.trim().length > 0)
    .map((item: any, index: number) => ({
      id: String(item.id || `mm_${uid()}`),
      url: String(item.url),
      order: typeof item.order === "number" ? item.order : index,
      source: item.source === "auto_capture" ? "auto_capture" : "user_upload",
      isCover: !!item.isCover,
      createdAt: item.createdAt || nowIso,
    }))
    .slice(0, 24)
    .sort((a: any, b: any) => a.order - b.order);

  if (fallbackThumbnailUrl) {
    const existingIndex = normalized.findIndex((item: any) => item.url === fallbackThumbnailUrl);
    if (existingIndex >= 0) {
      normalized[existingIndex].isCover = true;
    } else {
      normalized.unshift({
        id: `mm_cover_${uid()}`,
        url: fallbackThumbnailUrl,
        order: -1,
        source: "auto_capture",
        isCover: true,
        createdAt: nowIso,
      });
    }
  }

  if (normalized.length === 0) {
    return [];
  }

  const coverIndex = normalized.findIndex((item: any) => item.isCover);
  const resolvedCoverIndex = coverIndex >= 0 ? coverIndex : 0;

  return normalized.map((item: any, index: number) => ({
    ...item,
    order: index,
    isCover: index === resolvedCoverIndex,
  }));
}

function syncModelMediaAndCanonical(model: any): void {
  const nowIso = new Date().toISOString();
  const media = normalizeModelMedia(model.media, model.thumbnailUrl || null, nowIso);
  if (media.length > 0) {
    model.media = media;
    const cover = media.find((m: any) => m.isCover) || media[0];
    model.thumbnailUrl = cover?.url || model.thumbnailUrl || null;
  } else if (!model.thumbnailUrl) {
    delete model.media;
  }

  const slug = slugifySegment(model.title) || `model-${String(model.id || "").slice(0, 12)}`;
  const status = getModelStatus(model);
  const canonicalBase = status === "draft" ? "/borrador" : "/modelo";
  model.slug = slug;
  model.canonicalPath = `${canonicalBase}/${model.id}/${slug}`;
}

// ─── Health ───────────────────────────────────────────────────────────────────

app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

// GET /robots.txt – Public crawler directives and sitemap pointer
app.get("/robots.txt", (c) => {
  return c.body(buildRobotsTxt(c.req.url), 200, {
    "content-type": "text/plain; charset=utf-8",
    // Keep crawler metadata fresh and reduce the chance of stale HTML being cached at the edge.
    "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
  });
});

// GET /sitemap.xml – Public sitemap with static + dynamic SEO routes
app.get("/sitemap.xml", async (c) => {
  const xml = await buildSitemapXml(c.req.url);
  return c.body(xml, 200, {
    "content-type": "application/xml; charset=utf-8",
    "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
  });
});

app.get("/sitemaps/:section.xml", async (c) => {
  const section = c.req.param("section");
  if (section !== "core" && section !== "community" && section !== "news") {
    return c.json({ error: "Sitemap no encontrado" }, 404);
  }
  const xml = await buildSitemapSectionXml(section, c.req.url);
  return c.body(xml, 200, {
    "content-type": "application/xml; charset=utf-8",
    "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
  });
});

// GET /og/default.svg – Default Open Graph image for public routes
app.get("/og/default.svg", (c) => {
  return c.body(buildDefaultOgSvg(), 200, {
    "content-type": "image/svg+xml; charset=utf-8",
    "cache-control": "public, max-age=3600",
  });
});

// GET /og/:slug – Per-route Open Graph images with unique content
app.get("/og/:slug", (c) => {
  const rawSlug = c.req.param("slug").replace(/\.svg$/i, "");
  const config = OG_ROUTE_CONFIGS[rawSlug] || OG_ROUTE_CONFIGS["default"];
  const svg = buildOgSvg(config.title, config.subtitle, { accent: config.accent, badge: config.badge });
  return c.body(svg, 200, {
    "content-type": "image/svg+xml; charset=utf-8",
    "cache-control": "public, max-age=3600",
  });
});

// ─── Internal MCP Tools (orchestration-ready contracts) ─────────────────────

const MCP_INTERNAL_TOOLS = new Set<McpInternalToolName>([
  "generate_spec",
  "generate_scad",
  "validate_fdm",
  "compile_preview",
]);

app.post("/api/internal/mcp/tool/:tool", async (c) => {
  if (!hasMcpInternalAccess(c)) {
    return c.json(
      {
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Acceso no autorizado para herramientas MCP internas",
        },
      },
      401
    );
  }

  const tool = c.req.param("tool") as McpInternalToolName;
  if (!MCP_INTERNAL_TOOLS.has(tool)) {
    return c.json(
      {
        ok: false,
        error: {
          code: "TOOL_NOT_SUPPORTED",
          message: `Herramienta no soportada: ${tool}`,
        },
      },
      400
    );
  }

  const body = await c.req.json().catch(() => ({}));
  const input = (body?.input && typeof body.input === "object") ? body.input : {};
  const result = executeMcpInternalTool(tool, input as Record<string, unknown>);
  const status = result.ok ? 200 : result.error.code === "VALIDATION_ERROR" ? 400 : 500;
  return c.json(result, status);
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /signup – Create user with email_confirm: true
app.post("/api/auth/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, displayName, username } = body;

    if (!email || !password) {
      return c.json({ error: "Email y password son requeridos" }, 400);
    }

    // LOW-1: Rate limit signups — 5 per IP per 15 min
    const ip = getClientIp(c);
    const signupRateLimit = await enforceRateLimit(
      c,
      `signup:${ip}`,
      5,
      15 * 60 * 1000,
      "Demasiados intentos de registro. Intente nuevamente en 15 minutos."
    );
    if (signupRateLimit) {
      return signupRateLimit;
    }

    // MED-3: Validate password strength
    const pwError = validatePassword(password);
    if (pwError) {
      return c.json({ error: pwError }, 400);
    }

    // Check if user already exists
    const existing = await auth.getUserByEmail(email);
    if (existing) {
      return c.json({ error: "Ya existe una cuenta con este email" }, 400);
    }

    // Create user in auth_users table
    const newUser = await auth.createUser(email, password, {
      displayName: displayName || email.split("@")[0],
      username: username || `@${email.split("@")[0]}`,
    });

    // Initialize user profile in KV (for backward compatibility)
    const profile = {
      id: newUser.id,
      displayName: newUser.display_name,
      username: newUser.username,
      email: newUser.email,
      tier: "FREE",
      createdAt: newUser.created_at,
    };
    await kv.set(`user:${newUser.id}:profile`, profile);

    // Initialize credits
    await kv.set(`user:${newUser.id}:credits`, {
      freeUsed: 0,
      purchasedCredits: 0,
      totalExported: 0,
    });

    // Issue JWT
    const token = auth.signJwt(newUser.id, newUser.email, newUser.role);
    setSessionCookie(c, token);

    console.log(`User created successfully: ${newUser.id}`);

    // Fire-and-forget: auto-detect country from infrastructure headers
    auth.updateUserGeoFromHeaders(newUser.id, c.req.header() as any);

    return c.json({ user: auth.toPublicProfile(newUser), profile, token });
  } catch (e: any) {
    console.log(`Signup exception: ${e.message}`);
    return c.json({ error: `Error interno en signup: ${e.message}` }, 500);
  }
});

// POST /signin – Authenticate with email + password, returns JWT
app.post("/api/auth/signin", async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: "Email y password son requeridos" }, 400);
    }

    // LOW-1: Rate limit login attempts — 10 per IP per 5 min
    const ip = getClientIp(c);
    const signinRateLimit = await enforceRateLimit(
      c,
      `signin:${ip}`,
      10,
      5 * 60 * 1000,
      "Demasiados intentos de inicio de sesión. Intente en 5 minutos."
    );
    if (signinRateLimit) {
      return signinRateLimit;
    }

    const user = await auth.getUserByEmail(email);
    if (!user || !user.password_hash) {
      return c.json({ error: "Credenciales inválidas" }, 401);
    }

    if (user.banned) {
      return c.json({ error: "Cuenta suspendida" }, 403);
    }

    const valid = await auth.verifyPassword(password, user.password_hash);
    if (!valid) {
      return c.json({ error: "Credenciales inválidas" }, 401);
    }

    // Issue JWT
    const token = auth.signJwt(user.id, user.email, user.role);
    setSessionCookie(c, token);

    // Get profile from KV (may have extra fields)
    const profile = await kv.get(`user:${user.id}:profile`) || auth.toPublicProfile(user);

    console.log(`User signed in: ${user.id} (${user.email})`);
    await userActivityLog(user.id, "login", { method: "email" });

    // Fire-and-forget: auto-detect country from infrastructure headers
    auth.updateUserGeoFromHeaders(user.id, c.req.header() as any);

    return c.json({
      token,
      user: auth.toPublicProfile(user),
      profile,
    });
  } catch (e: any) {
    console.log(`Signin exception: ${e.message}`);
    return c.json({ error: `Error interno en signin: ${e.message}` }, 500);
  }
});

// POST /api/auth/request-reset – Generate a 6-digit PIN for password reset
app.post("/api/auth/request-reset", async (c) => {
  try {
    const { email } = await c.req.json();
    if (!email) return c.json({ error: "Email requerido" }, 400);

    // Rate limit
    const ip = getClientIp(c);
    const requestResetRateLimit = await enforceRateLimit(
      c,
      `request-reset:${ip}`,
      3,
      15 * 60 * 1000,
      "Demasiados intentos. Intente en 15 minutos."
    );
    if (requestResetRateLimit) {
      return requestResetRateLimit;
    }

    const user = await auth.getUserByEmail(email);
    if (!user) {
      // Return 200 to prevent email enumeration
      return c.json({ message: "Si el correo existe, se enviará un PIN de recuperación." });
    }

    // Generate 6-digit PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    
    // Store in KV valid for 15 minutes
    await kv.set(`reset_pin:${user.id}`, {
      pin,
      expiresAt,
      requestedAt: new Date().toISOString(),
    });
    
    // For local dev only — never log credentials in production.
    if (process.env.NODE_ENV !== "production") {
      console.log(`[AUTH] Password reset PIN for ${email}: ${pin}`);
    }

    // Send email using shared helper (best-effort)
    await sendResendEmailBestEffort({
      to: user.email,
      subject: "Código de recuperación de contraseña - Vorea Studio",
      logLabel: "password reset",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; background-color: #f9f9f9;">
          <h2 style="color: #333; text-align: center;">Vorea Studio</h2>
          <p style="color: #555; font-size: 16px;">Has solicitado restablecer tu contraseña. Usa el siguiente código de 6 dígitos para continuar con el proceso:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb; background: #e0e7ff; padding: 10px 20px; border-radius: 8px;">${pin}</span>
          </div>
          <p style="color: #555; font-size: 14px;">Si no solicitaste este cambio, simplemente ignora este correo. El código expirará pronto.</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} Vorea Studio. Todos los derechos reservados.</p>
        </div>
      `,
    });

    return c.json({ 
      message: "Si el correo existe, se enviará un PIN de recuperación.",
      // TEMP: returning PIN in response only for local testing/dev. Should remove in prod.
      pinDev: process.env.NODE_ENV !== "production" ? pin : undefined
    });
  } catch (e: any) {
    return c.json({ error: `Error interno: ${e.message}` }, 500);
  }
});

// POST /api/auth/reset-password – Validate PIN and set new password
app.post("/api/auth/reset-password", async (c) => {
  try {
    const { email, pin, newPassword } = await c.req.json();
    if (!email || !pin || !newPassword) {
      return c.json({ error: "Email, PIN y nueva contraseña son requeridos" }, 400);
    }

    // Rate limit
    const ip = getClientIp(c);
    const resetPasswordRateLimit = await enforceRateLimit(
      c,
      `reset-password:${ip}`,
      5,
      15 * 60 * 1000,
      "Demasiados intentos. Intente nuevamente en 15 minutos."
    );
    if (resetPasswordRateLimit) {
      return resetPasswordRateLimit;
    }

    const pwError = validatePassword(newPassword);
    if (pwError) {
      return c.json({ error: pwError }, 400);
    }

    const user = await auth.getUserByEmail(email);
    if (!user) {
      return c.json({ error: "PIN inválido o expirado." }, 400);
    }

    const resetPinKey = `reset_pin:${user.id}`;
    const storedPinRecord = await kv.get(resetPinKey);
    const storedPin =
      typeof storedPinRecord === "string"
        ? storedPinRecord
        : typeof storedPinRecord?.pin === "string"
          ? storedPinRecord.pin
          : null;
    const expiresAtMs =
      storedPinRecord && typeof storedPinRecord === "object" && typeof storedPinRecord.expiresAt === "string"
        ? Date.parse(storedPinRecord.expiresAt)
        : NaN;

    if (Number.isFinite(expiresAtMs) && Date.now() > expiresAtMs) {
      await kv.del(resetPinKey);
      return c.json({ error: "PIN inválido o expirado." }, 400);
    }

    if (!storedPin || storedPin !== pin) {
      return c.json({ error: "PIN inválido o expirado." }, 400);
    }

    // Hash and update password
    const hashedPassword = await auth.hashPassword(newPassword);
    
    // Update auth_users table
    await auth.updateUser(user.id, { password_hash: hashedPassword });
    
    // Invalidate PIN
    await kv.del(resetPinKey);

    console.log(`[AUTH] Password successfully reset for ${email}`);
    return c.json({ message: "Contraseña actualizada exitosamente." });
  } catch (e: any) {
    return c.json({ error: `Error interno: ${e.message}` }, 500);
  }
});

// POST /api/auth/request-email-verification – Send a short-lived OTP to verify current email
app.post("/api/auth/request-email-verification", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "No autorizado" }, 401);
    }

    const user = await auth.getUserById(userId);
    if (!user) {
      return c.json({ error: "Usuario no encontrado" }, 404);
    }

    if (user.banned) {
      return c.json({ error: "Cuenta suspendida" }, 403);
    }

    if (user.email_verified_at) {
      return c.json({ message: "Tu email ya está verificado." });
    }

    const ip = getClientIp(c);
    const ipRateLimit = await enforceRateLimit(
      c,
      `request-email-verification:${ip}`,
      5,
      15 * 60 * 1000,
      "Demasiadas solicitudes de verificación. Intenta nuevamente en 15 minutos."
    );
    if (ipRateLimit) {
      return ipRateLimit;
    }

    const userRateLimit = await enforceRateLimit(
      c,
      `request-email-verification-user:${userId}`,
      6,
      60 * 60 * 1000,
      "Ya solicitaste varios códigos recientemente. Espera un poco antes de pedir otro."
    );
    if (userRateLimit) {
      return userRateLimit;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await kv.set(`email_verify:${user.id}`, {
      code,
      expiresAt,
      requestedAt: new Date().toISOString(),
      email: user.email,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(`[AUTH] Email verification code for ${user.email}: ${code}`);
    }

    await sendResendEmailBestEffort({
      to: user.email,
      subject: "Verificación de correo - Vorea Studio",
      logLabel: "email verification",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; background-color: #f9f9f9;">
          <h2 style="color: #333; text-align: center;">Vorea Studio</h2>
          <p style="color: #555; font-size: 16px;">Usa el siguiente código para verificar tu dirección de correo y reforzar la seguridad de pagos y acciones sensibles.</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb; background: #e0e7ff; padding: 10px 20px; border-radius: 8px;">${code}</span>
          </div>
          <p style="color: #555; font-size: 14px;">El código expira en 15 minutos. Si no solicitaste esta verificación, ignora este correo.</p>
        </div>
      `,
    });

    return c.json({
      message: "Te enviamos un código de verificación a tu correo.",
      codeDev: process.env.NODE_ENV !== "production" ? code : undefined,
    });
  } catch (e: any) {
    return c.json({ error: `Error interno: ${e.message}` }, 500);
  }
});

// POST /api/auth/verify-email – Validate OTP for current email and mark it as verified
app.post("/api/auth/verify-email", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "No autorizado" }, 401);
    }

    const user = await auth.getUserById(userId);
    if (!user) {
      return c.json({ error: "Usuario no encontrado" }, 404);
    }

    const { code } = await c.req.json();
    if (!code || typeof code !== "string") {
      return c.json({ error: "Código requerido" }, 400);
    }

    const ip = getClientIp(c);
    const verifyRateLimit = await enforceRateLimit(
      c,
      `verify-email:${ip}`,
      8,
      15 * 60 * 1000,
      "Demasiados intentos de verificación. Intenta nuevamente en 15 minutos."
    );
    if (verifyRateLimit) {
      return verifyRateLimit;
    }

    const storedRecord = await kv.get(`email_verify:${user.id}`);
    const storedCode =
      typeof storedRecord?.code === "string" ? storedRecord.code : null;
    const expiresAtMs =
      typeof storedRecord?.expiresAt === "string" ? Date.parse(storedRecord.expiresAt) : NaN;

    if (!storedCode || !Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) {
      await kv.del(`email_verify:${user.id}`);
      return c.json({ error: "Código inválido o expirado." }, 400);
    }

    if (storedCode !== code.trim()) {
      return c.json({ error: "Código inválido o expirado." }, 400);
    }

    const verifiedAt = new Date().toISOString();
    await auth.updateUser(user.id, { email_verified_at: verifiedAt });

    const existingProfile = (await kv.get(`user:${user.id}:profile`)) as Record<string, any> | null;
    if (existingProfile) {
      await kv.set(`user:${user.id}:profile`, {
        ...existingProfile,
        emailVerifiedAt: verifiedAt,
      });
    }
    await kv.del(`email_verify:${user.id}`);

    await userActivityLog(user.id, "email_verified", {
      method: "otp",
      verifiedAt,
    });

    return c.json({
      message: "Email verificado correctamente.",
      verifiedAt,
    });
  } catch (e: any) {
    return c.json({ error: `Error interno: ${e.message}` }, 500);
  }
});

// POST /auth/refresh – Refresh JWT token
app.post("/api/auth/refresh", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "No autorizado" }, 401);

    const user = await auth.getUserById(userId);
    if (!user) return c.json({ error: "Usuario no encontrado" }, 404);
    if (user.banned) return c.json({ error: "Cuenta suspendida" }, 403);

    const token = auth.signJwt(user.id, user.email, user.role);
    setSessionCookie(c, token);
    return c.json({ token, user: auth.toPublicProfile(user) });
  } catch (e: any) {
    return c.json({ error: `Error en refresh: ${e.message}` }, 500);
  }
});

// GET /me – Get current user profile from token
app.get("/api/auth/me", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "No autorizado" }, 401);
    }

    const dbUser = await auth.getUserById(userId);
    if (!dbUser) {
      return c.json({ error: "Usuario no encontrado" }, 404);
    }

    const existingProfile = (await kv.get(`user:${userId}:profile`)) as Record<string, any> | null;
    const profile = buildCanonicalSelfProfile(dbUser, existingProfile);
    await kv.set(`user:${userId}:profile`, profile);
    const regionPolicy = buildRegionPolicy({
      countryCode: profile.countryCode,
      regionCode: profile.regionCode,
    });

    const token = c.req.header("Authorization")?.startsWith("Bearer ")
      ? c.req.header("Authorization")!.slice("Bearer ".length)
      : null;
    if (token) {
      setSessionCookie(c, token);
    }
    return c.json({ profile, regionPolicy });
  } catch (e: any) {
    console.log(`GET /me error: ${e.message}`);
    return c.json({ error: `Error al obtener perfil: ${e.message}` }, 500);
  }
});

// PUT /api/auth/me/password – Change or create a local password for the current user
app.put("/api/auth/me/password", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "No autorizado" }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword.trim() : "";

    if (!newPassword) {
      return c.json({ error: "Debes ingresar una nueva contraseña" }, 400);
    }

    const ip = getClientIp(c);
    const passwordChangeIpLimit = await enforceRateLimit(
      c,
      `auth-me-password:${ip}`,
      5,
      15 * 60 * 1000,
      "Demasiados intentos de cambio de contraseña. Intente nuevamente en 15 minutos."
    );
    if (passwordChangeIpLimit) {
      return passwordChangeIpLimit;
    }

    const passwordChangeUserLimit = await enforceRateLimit(
      c,
      `auth-me-password-user:${userId}`,
      8,
      60 * 60 * 1000,
      "Demasiados cambios de contraseña en poco tiempo. Intente nuevamente más tarde."
    );
    if (passwordChangeUserLimit) {
      return passwordChangeUserLimit;
    }

    const pwError = validatePassword(newPassword);
    if (pwError) {
      return c.json({ error: pwError }, 400);
    }

    const user = await auth.getUserById(userId);
    if (!user) {
      return c.json({ error: "Usuario no encontrado" }, 404);
    }

    if (user.banned) {
      return c.json({ error: "Cuenta suspendida" }, 403);
    }

    if (user.password_hash) {
      if (!currentPassword) {
        return c.json({ error: "Debes ingresar tu contraseña actual" }, 400);
      }

      const currentMatches = await auth.verifyPassword(currentPassword, user.password_hash);
      if (!currentMatches) {
        return c.json({ error: "La contraseña actual es incorrecta" }, 401);
      }

      const newMatchesCurrent = await auth.verifyPassword(newPassword, user.password_hash);
      if (newMatchesCurrent) {
        return c.json({ error: "La nueva contraseña debe ser distinta a la actual" }, 400);
      }
    }

    const hashedPassword = await auth.hashPassword(newPassword);
    const updatedUser = await auth.updateUser(user.id, { password_hash: hashedPassword });
    if (!updatedUser) {
      return c.json({ error: "No se pudo actualizar la contraseña" }, 500);
    }

    await userActivityLog(
      user.id,
      user.password_hash ? "password_change" : "password_create",
      {
        method: user.provider || "email",
      }
    );

    return c.json({
      message: user.password_hash
        ? "Contraseña actualizada exitosamente."
        : "Contraseña creada exitosamente para tu cuenta.",
    });
  } catch (e: any) {
    console.log(`PUT /api/auth/me/password error: ${e.message}`);
    return c.json({ error: `Error al actualizar contraseña: ${e.message}` }, 500);
  }
});

// PUT /me – Update user profile
// CRIT-2 FIX: Whitelist allowed fields — block role, tier, banned self-edit
const SELF_EDIT_ALLOWED = [
  "displayName",
  "username",
  "avatarUrl",
  "bio",
  "website",
  "phone",
  "countryCode",
  "defaultLocale",
  "billingProfile",
] as const;

function sanitizeProfileText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function sanitizeProfileUsername(value: unknown, fallbackEmail: string): string {
  const fallback = `@${fallbackEmail.split("@")[0]}`;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().replace(/\s+/g, "_");
  if (!normalized) return fallback;
  return normalized.startsWith("@") ? normalized.slice(0, 40) : `@${normalized.slice(0, 39)}`;
}

function sanitizeProfileUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  return trimmed.slice(0, 240);
}

function buildCanonicalSelfProfile(
  dbUser: auth.AuthUser,
  existingProfile: Record<string, any> | null
) {
  const countryCode =
    normalizeCountryCode(existingProfile?.countryCode ?? dbUser.country_code) ?? null;
  const persistedRegionCode =
    (typeof existingProfile?.regionCode === "string" && existingProfile.regionCode) ||
    dbUser.region_code ||
    null;
  const defaultLocale =
    normalizeLocaleCode(existingProfile?.defaultLocale ?? dbUser.default_locale) ?? null;
  const billingProfile =
    sanitizeBillingProfile(existingProfile?.billingProfile ?? dbUser.billing_profile) ?? null;

  return {
    id: dbUser.id,
    displayName:
      sanitizeProfileText(existingProfile?.displayName ?? dbUser.display_name, 80) ||
      dbUser.display_name ||
      dbUser.email.split("@")[0],
    username: sanitizeProfileUsername(existingProfile?.username ?? dbUser.username, dbUser.email),
    email: dbUser.email,
    tier: dbUser.tier || "FREE",
    role: dbUser.role,
    avatarUrl: sanitizeProfileUrl(existingProfile?.avatarUrl ?? dbUser.avatar_url),
    bio: sanitizeProfileText(existingProfile?.bio ?? dbUser.bio, 280),
    website: sanitizeProfileUrl(existingProfile?.website ?? dbUser.website),
    phone: normalizePhone(existingProfile?.phone ?? dbUser.phone),
    countryCode,
    // Country is the source of truth for runtime checkout policy.
    // This prevents stale KV profile blobs from pinning the user to a mismatched region.
    regionCode: countryCode ? resolveRegionCode(countryCode) : persistedRegionCode || "GLOBAL",
    defaultLocale,
    billingProfile,
    emailVerifiedAt:
      (typeof existingProfile?.emailVerifiedAt === "string" && existingProfile.emailVerifiedAt) ||
      dbUser.email_verified_at ||
      null,
    phoneVerifiedAt:
      (typeof existingProfile?.phoneVerifiedAt === "string" && existingProfile.phoneVerifiedAt) ||
      dbUser.phone_verified_at ||
      null,
    banned: dbUser.banned,
    createdAt:
      (typeof existingProfile?.createdAt === "string" && existingProfile.createdAt) ||
      dbUser.created_at,
  };
}

function applySelfProfilePatch(
  baseProfile: ReturnType<typeof buildCanonicalSelfProfile>,
  patch: Record<string, unknown>,
  fallbackEmail: string
) {
  const nextProfile = { ...baseProfile };

  if (Object.prototype.hasOwnProperty.call(patch, "displayName")) {
    const displayName = sanitizeProfileText(patch.displayName, 80);
    if (!displayName) {
      throw new Error("El nombre visible no puede quedar vacío.");
    }
    nextProfile.displayName = displayName;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "username")) {
    nextProfile.username = sanitizeProfileUsername(patch.username, fallbackEmail);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "avatarUrl")) {
    nextProfile.avatarUrl = sanitizeProfileUrl(patch.avatarUrl);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "bio")) {
    nextProfile.bio = sanitizeProfileText(patch.bio, 280);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "website")) {
    nextProfile.website = sanitizeProfileUrl(patch.website);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "phone")) {
    nextProfile.phone = normalizePhone(patch.phone);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "countryCode")) {
    nextProfile.countryCode = normalizeCountryCode(patch.countryCode);
    nextProfile.regionCode = resolveRegionCode(nextProfile.countryCode);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "defaultLocale")) {
    nextProfile.defaultLocale = normalizeLocaleCode(patch.defaultLocale);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "billingProfile")) {
    nextProfile.billingProfile = sanitizeBillingProfile(patch.billingProfile);
  }

  return nextProfile;
}

function toAuthProfilePatch(profile: ReturnType<typeof buildCanonicalSelfProfile>) {
  return {
    display_name: profile.displayName,
    username: profile.username,
    avatar_url: profile.avatarUrl,
    bio: profile.bio,
    website: profile.website,
    phone: profile.phone,
    country_code: profile.countryCode,
    region_code: profile.regionCode,
    default_locale: profile.defaultLocale,
    billing_profile: profile.billingProfile,
  };
}

app.put("/api/auth/me", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "No autorizado" }, 401);
    }

    const body = await c.req.json();
    const dbUser = await auth.getUserById(userId);
    if (!dbUser) {
      return c.json({ error: "Usuario no encontrado" }, 404);
    }

    const existingProfile = (await kv.get(`user:${userId}:profile`)) as Record<string, any> | null;
    const baseProfile = buildCanonicalSelfProfile(dbUser, existingProfile);

    const sanitizedPatch: Record<string, unknown> = {};
    for (const key of SELF_EDIT_ALLOWED) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        sanitizedPatch[key] = body[key];
      }
    }

    // Reject attempts to escalate privileges
    const blocked = ["role", "tier", "banned", "id", "email", "createdAt"];
    const attempted = blocked.filter((k) => body[k] !== undefined);
    if (attempted.length > 0) {
      console.log(`[SECURITY] User ${userId} attempted to self-edit restricted fields: ${attempted.join(", ")}`);
    }

    const updatedProfile = applySelfProfilePatch(baseProfile, sanitizedPatch, dbUser.email);
    const updatedUser = await auth.updateUser(userId, toAuthProfilePatch(updatedProfile));
    if (!updatedUser) {
      return c.json({ error: "No se pudo actualizar el perfil" }, 500);
    }

    await kv.set(`user:${userId}:profile`, updatedProfile);
    const regionPolicy = buildRegionPolicy({
      countryCode: updatedProfile.countryCode,
      regionCode: updatedProfile.regionCode,
    });

    return c.json({ profile: updatedProfile, regionPolicy });
  } catch (e: any) {
    if (e?.code === "23505") {
      return c.json({ error: "Ese nombre de usuario ya está en uso." }, 409);
    }
    console.log(`PUT /me error: ${e.message}`);
    return c.json({ error: `Error al actualizar perfil: ${e.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE OAUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/auth/google/config – Returns whether Google OAuth is configured
app.get("/api/auth/google/config", (c) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  return c.json({
    configured: clientId.length > 0,
    clientId: clientId || undefined,
  });
});

// POST /api/auth/google – Verify Google credential and login/register user
app.post("/api/auth/google", async (c) => {
  try {
    const { credential } = await c.req.json();
    if (!credential) {
      return c.json({ error: "Google credential requerido" }, 400);
    }

    // LOW-1: Rate limit Google login — 10 per IP per 5 min
    const ip = getClientIp(c);
    const googleRateLimit = await enforceRateLimit(
      c,
      `google-login:${ip}`,
      10,
      5 * 60 * 1000,
      "Demasiados intentos. Intente en 5 minutos."
    );
    if (googleRateLimit) {
      return googleRateLimit;
    }

    // Verify the Google ID token via Google's tokeninfo endpoint
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!verifyRes.ok) {
      return c.json({ error: "Token de Google inválido o expirado" }, 401);
    }
    const googlePayload = await verifyRes.json();

    const googleId = googlePayload.sub;
    const email = googlePayload.email;
    const name = googlePayload.name || googlePayload.given_name || email?.split("@")[0] || "User";
    const avatarUrl = googlePayload.picture || null;

    if (!email || !googleId) {
      return c.json({ error: "No se pudo obtener email/ID de Google" }, 400);
    }

    // Verify audience matches our client ID (security check)
    const expectedClientId = process.env.GOOGLE_CLIENT_ID || "";
    if (expectedClientId && googlePayload.aud !== expectedClientId) {
      console.error(`[Google Auth] Audience mismatch: expected ${expectedClientId}, got ${googlePayload.aud}`);
      return c.json({ error: "Token de Google inválido (audience mismatch)" }, 401);
    }

    // Try to find existing user by Google ID or email
    let user = await auth.getUserByGoogleId(googleId);
    if (!user) {
      user = await auth.getUserByEmail(email);
    }

    if (user) {
      // Existing user — update Google ID if missing, update avatar
      if (!user.google_id || user.google_id !== googleId) {
        await auth.updateUser(user.id, { google_id: googleId, provider: "google" });
      }
      if (avatarUrl && !user.avatar_url) {
        await auth.updateUser(user.id, { avatar_url: avatarUrl });
      }

      if (user.banned) {
        return c.json({ error: "Cuenta suspendida" }, 403);
      }

      // Issue JWT
      const token = auth.signJwt(user.id, user.email, user.role);
      setSessionCookie(c, token);

      // Get/create KV profile
      let profile = await kv.get(`user:${user.id}:profile`);
      if (!profile) {
        profile = auth.toPublicProfile(user);
        await kv.set(`user:${user.id}:profile`, profile);
      }

      await userActivityLog(user.id, "login", { method: "google" });
      console.log(`[Google Auth] Existing user signed in: ${user.id} (${email})`);

      // Fire-and-forget: auto-detect country from infrastructure headers
      auth.updateUserGeoFromHeaders(user.id, c.req.header() as any);

      return c.json({ token, user: auth.toPublicProfile(user), profile });
    }

    // New user — create account
    const newUser = await auth.createUser(email, null, {
      displayName: name,
      username: `@${email.split("@")[0]}`,
      avatarUrl,
      provider: "google",
      googleId,
    });

    // Initialize KV profile and credits
    const profile = {
      id: newUser.id,
      displayName: newUser.display_name,
      username: newUser.username,
      email: newUser.email,
      tier: "FREE",
      avatarUrl: newUser.avatar_url,
      createdAt: newUser.created_at,
    };
    await kv.set(`user:${newUser.id}:profile`, profile);
    await kv.set(`user:${newUser.id}:credits`, {
      freeUsed: 0,
      purchasedCredits: 0,
      totalExported: 0,
    });

    const token = auth.signJwt(newUser.id, newUser.email, newUser.role);
    setSessionCookie(c, token);

    await userActivityLog(newUser.id, "register", { method: "google" });
    console.log(`[Google Auth] New user created: ${newUser.id} (${email})`);

    // Fire-and-forget: auto-detect country from infrastructure headers
    auth.updateUserGeoFromHeaders(newUser.id, c.req.header() as any);

    return c.json({ user: auth.toPublicProfile(newUser), profile, token });
  } catch (e: any) {
    console.error(`[Google Auth] Error: ${e.message}`);
    return c.json({ error: `Error en Google Sign-In: ${e.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GCODE COLLECTION ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /gcode – List user's GCode collection
app.get("/api/gcode", requireAuth, async (c) => {
  try {
    const userId = c.get("userId") as string;

    const items = await kv.getByPrefix(`user:${userId}:gcode:`);
    // Sort by createdAt desc
    const sorted = (items || []).sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return c.json({ items: sorted });
  } catch (e: any) {
    console.log(`GET /gcode error: ${e.message}`);
    return c.json({ error: `Error al listar GCode: ${e.message}` }, 500);
  }
});

// POST /gcode – Save a GCode item
app.post("/api/gcode", requireAuth, async (c) => {
  try {
    const userId = c.get("userId") as string;
    const userProfile = (await kv.get(`user:${userId}:profile`)) || {};

    const body = await c.req.json();
    const { name, gcode, config } = body;

    if (!name || !gcode) {
      return c.json({ error: "name y gcode son requeridos" }, 400);
    }

    const requestedAction = String(body?.actionId || "").trim();
    const allowedActions = new Set(["view", "edit_linear", "edit_nonlinear", "deform_live", "export"]);
    if (requestedAction && !allowedActions.has(requestedAction)) {
      return c.json({ error: "actionId inválido para GCode" }, 400);
    }
    const actionId = requestedAction || "view";
    const gate = await checkToolActionAllowed(userId, userProfile, "gcode", actionId);
    if (!gate.allowed) {
      return c.json({ error: gate.error || "Acción no permitida" }, (gate.status || 403) as ContentfulStatusCode);
    }

    const itemId = `gc_${uid()}`;
    const item = {
      id: itemId,
      name,
      gcode,
      createdAt: new Date().toISOString(),
      config: config || {},
      userId,
    };

    await kv.set(`user:${userId}:gcode:${itemId}`, item);
    await consumeToolActionUsage(userId, userProfile, gate);
    await userActivityLog(userId, "gcode_saved", { itemId, actionId });
    console.log(`GCode saved: ${itemId} for user ${userId}`);
    return c.json({ item });
  } catch (e: any) {
    console.log(`POST /gcode error: ${e.message}`);
    return c.json({ error: `Error al guardar GCode: ${e.message}` }, 500);
  }
});

// DELETE /gcode/:id – Remove a GCode item
app.delete("/api/gcode/:id", requireAuth, async (c) => {
  try {
    const userId = c.get("userId") as string;

    const id = c.req.param("id");
    await kv.del(`user:${userId}:gcode:${id}`);
    console.log(`GCode deleted: ${id} for user ${userId}`);
    return c.json({ success: true });
  } catch (e: any) {
    console.log(`DELETE /gcode error: ${e.message}`);
    return c.json({ error: `Error al eliminar GCode: ${e.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// USER ACTIVITY LOG ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /activity – Get current user's activity log
app.get("/api/activity", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "No autorizado" }, 401);
    const limit = Math.min(parseInt(c.req.query("limit") || "50"), 200);
    const log: any[] = (await kv.get(`user:${userId}:activity_log`)) || [];
    return c.json({ activity: log.slice(0, limit) });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /admin/activity/:userId – Get any user's activity (admin-only)
app.get("/api/admin/activity/:userId", requireSuperAdmin, async (c) => {
  try {
    const targetUserId = c.req.param("userId");
    const limit = Math.min(parseInt(c.req.query("limit") || "100"), 500);
    const log: any[] = (await kv.get(`user:${targetUserId}:activity_log`)) || [];
    return c.json({ activity: log.slice(0, limit) });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /admin/kpi – Aggregated KPIs across all users
app.get("/api/admin/kpi", requireSuperAdmin, async (c) => {
  try {

    const users: any[] = (await kv.get("users_list")) || [];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

    let totalExports = 0;
    let totalPaidActions = 0;
    let totalToolCreditActions = 0;
    let totalAiGenerations = 0;
    let totalCreditPurchases = 0;
    let totalCreditsSpent = 0;
    let totalLegacyCreditsSpent = 0;
    let totalToolCreditsSpent = 0;
    let activeToday = 0;
    let activeWeek = 0;
    let activeMonth = 0;
    const actionCounts: Record<string, number> = {};
    const toolActionCounts: Record<string, number> = {};

    for (const u of users) {
      const log: any[] = (await kv.get(`user:${u.id}:activity_log`)) || [];
      let lastAction = "";
      for (const entry of log) {
        const action = entry.action || "";
        actionCounts[action] = (actionCounts[action] || 0) + 1;
        if (action === "credit_consumed") {
          const creditCost = Number(entry.creditCost || 1);
          totalExports++;
          totalPaidActions++;
          totalLegacyCreditsSpent += creditCost;
          totalCreditsSpent += creditCost;
        }
        if (action === "tool_credit_consumed") {
          const creditCost = Number(entry.creditCost || 0);
          const toolId = String(entry.toolId || "unknown");
          totalToolCreditActions++;
          totalPaidActions++;
          totalToolCreditsSpent += creditCost;
          totalCreditsSpent += creditCost;
          toolActionCounts[toolId] = (toolActionCounts[toolId] || 0) + 1;
        }
        if (action === "ai_generation") totalAiGenerations++;
        if (action === "credit_purchased") totalCreditPurchases++;
        if (!lastAction && entry.at) lastAction = entry.at;
      }
      if (lastAction >= todayStr) activeToday++;
      if (lastAction >= weekAgo) activeWeek++;
      if (lastAction >= monthAgo) activeMonth++;
    }

    return c.json({
      kpi: {
        totalUsers: users.length,
        activeToday,
        activeWeek,
        activeMonth,
        totalExports,
        totalPaidActions,
        totalToolCreditActions,
        totalAiGenerations,
        totalCreditPurchases,
        totalCreditsSpent,
        totalLegacyCreditsSpent,
        totalToolCreditsSpent,
        actionCounts,
        toolActionCounts,
      },
    });
  } catch (e: any) {
    return c.json({ error: `Error KPI: ${e.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CREDITS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /credits – Get export credits state
app.get("/api/credits", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "No autorizado" }, 401);
    }

    const credits = await kv.get(`user:${userId}:credits`) || {
      freeUsed: 0,
      purchasedCredits: 0,
      totalExported: 0,
    };
    return c.json({ credits });
  } catch (e: any) {
    console.log(`GET /credits error: ${e.message}`);
    return c.json({ error: `Error al obtener creditos: ${e.message}` }, 500);
  }
});

// GET /tool-credits/me – Get the authenticated user's monthly tool credit balance
app.get("/api/tool-credits/me", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "No autorizado" }, 401);
    }

    const profile = await kv.get(`user:${userId}:profile`) || {};
    const toolCredits = await kv.get("admin:tool_credits") || DEFAULT_TOOL_CREDITS;
    const credits = await getUserToolCreditsState(userId, profile, toolCredits);
    return c.json({ credits: serializeToolCreditsState(credits) });
  } catch (e: any) {
    console.log(`GET /tool-credits/me error: ${e.message}`);
    return c.json({ error: `Error al obtener créditos de herramientas: ${e.message}` }, 500);
  }
});

// POST /credits/consume – Consume one export credit
app.post("/api/credits/consume", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "No autorizado" }, 401);
    }

    const profile = await kv.get(`user:${userId}:profile`);
    const tier = profile?.tier || "FREE";
    const credits = await kv.get(`user:${userId}:credits`) || {
      freeUsed: 0,
      purchasedCredits: 0,
      totalExported: 0,
    };

    if (tier === "PRO" || tier === "STUDIO PRO") {
      credits.totalExported++;
      credits.lastExportAt = new Date().toISOString();
      await kv.set(`user:${userId}:credits`, credits);
      await userActivityLog(userId, "credit_consumed", { tier, creditCost: 0, balanceAfter: -1 });
      return c.json({ success: true, credits });
    }

    const limits = await kv.get("admin:limits") || DEFAULT_LIMITS;
    const freeLimit = Number(limits?.freeExportLimit ?? DEFAULT_LIMITS.freeExportLimit ?? 6);
    const freeRemaining = Math.max(0, freeLimit - credits.freeUsed);

    if (freeRemaining > 0) {
      credits.freeUsed++;
    } else if (credits.purchasedCredits > 0) {
      credits.purchasedCredits--;
    } else {
      return c.json({ success: false, error: "Sin creditos disponibles" }, 402);
    }

    credits.totalExported++;
    credits.lastExportAt = new Date().toISOString();
    await kv.set(`user:${userId}:credits`, credits);
    await userActivityLog(userId, "credit_consumed", { tier, creditCost: 1, freeUsed: credits.freeUsed, purchasedCredits: credits.purchasedCredits });
    return c.json({ success: true, credits });
  } catch (e: any) {
    console.log(`POST /credits/consume error: ${e.message}`);
    return c.json({ error: `Error al consumir credito: ${e.message}` }, 500);
  }
});

// POST /credits/purchase – Add universal top-up credits directly
// HIGH-2 FIX: Only superadmin can add credits directly (users must go through PayPal flow)
app.post("/api/credits/purchase", async (c) => {
  try {
    const { ok, userId } = await isSuperAdmin(c);
    if (!ok || !userId) {
      return c.json({ error: "Solo administradores pueden agregar creditos directamente. Usa el flujo de pago PayPal." }, 403);
    }

    const body = await c.req.json();
    const { packId, credits: addCredits, targetUserId } = body;
    const recipientId = targetUserId || userId;

    if (!addCredits || addCredits <= 0 || addCredits > 1000) {
      return c.json({ error: "Cantidad de creditos invalida (1-1000)" }, 400);
    }

    const recipientProfile = await kv.get(`user:${recipientId}:profile`) || {};
    const toolCreditState = await addToolCreditTopUp(recipientId, recipientProfile, addCredits, {
      source: "admin_grant",
      adminId: userId,
      packId,
    });

    // Audit log (LOW-2: hash chain)
    await auditLog("credits_added", {
      adminId: userId,
      targetUserId: recipientId,
      amount: addCredits,
      packId,
    });

    console.log(`Credits added by admin ${userId}: +${addCredits} for user ${recipientId} (pack: ${packId})`);
    return c.json({ success: true, credits: toolCreditState, toolCredits: toolCreditState });
  } catch (e: any) {
    console.log(`POST /credits/purchase error: ${e.message}`);
    return c.json({ error: `Error al comprar creditos: ${e.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.post("/api/contact", async (c) => {
  try {
    const userId = await getUserId(c);
    const body = await c.req.json();
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const subject = String(body?.subject || "").trim();
    const message = String(body?.message || "").trim();
    const pageUrl = String(body?.pageUrl || "").trim();

    if (!name || !email || !message) {
      return c.json({ error: "Nombre, email y mensaje son requeridos" }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ error: "El email no es válido" }, 400);
    }

    const contactId = `ct_${uid()}`;
    const contactEntry = {
      id: contactId,
      name,
      email,
      subject: subject || null,
      message,
      pageUrl: pageUrl || null,
      userId: userId || null,
      status: "new",
      createdAt: new Date().toISOString(),
    };

    await kv.set(`contact:${contactId}`, contactEntry);
    if (userId) {
      await userActivityLog(userId, "contact_submitted", { subject: subject || null });
    }

    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const safeSubject = subject || "Consulta general";
        await resend.emails.send({
          from: "Vorea Studio <noreply@voreastudio3d.com>",
          to: CONTACT_RECEIVER_EMAIL,
          replyTo: email,
          subject: `[Contacto Vorea] ${safeSubject}`,
          text: [
            `Nombre: ${name}`,
            `Email: ${email}`,
            `Usuario: ${userId || "anonimo"}`,
            `Pagina: ${pageUrl || "n/a"}`,
            "",
            message,
            "",
            `Referencia: ${contactId}`,
          ].join("\n"),
        });
      } catch (emailError: any) {
        console.error(`[contact] resend failed for ${contactId}:`, emailError?.message || emailError);
      }
    }

    return c.json({ success: true, contactId });
  } catch (e: any) {
    return c.json({ error: `Error al enviar contacto: ${e.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /feedback – Submit a feedback report
app.post("/api/feedback", async (c) => {
  try {
    // Feedback can be submitted by anonymous or authenticated users
    const userId = await getUserId(c);

    const body = await c.req.json();
    const { type, message, screenshot, stateSnapshot, userEmail } = body;

    if (!message) {
      return c.json({ error: "El mensaje es requerido" }, 400);
    }

    const feedbackId = `fb_${uid()}`;
    const feedback = {
      id: feedbackId,
      type: type || "bug",
      message,
      screenshot: screenshot ? "[screenshot attached]" : null,
      stateSnapshot: stateSnapshot || "{}",
      userEmail: userEmail || null,
      userId: userId || "anonymous",
      createdAt: new Date().toISOString(),
      status: "open",
      aiReview: null,
      aiReviewedAt: null,
    };

    await kv.set(`feedback:${feedbackId}`, feedback);
    console.log(`Feedback submitted: ${feedbackId} type=${type} user=${userId || "anon"}`);
    return c.json({ success: true, feedbackId });
  } catch (e: any) {
    console.log(`POST /feedback error: ${e.message}`);
    return c.json({ error: `Error al enviar feedback: ${e.message}` }, 500);
  }
});

// GET /feedback – List all feedback (superadmin only)
// HIGH-1 FIX: Require superadmin to list all feedback
app.get("/api/feedback", async (c) => {
  try {
    const { ok } = await isSuperAdmin(c);
    if (!ok) {
      return c.json({ error: "Acceso denegado: se requiere superadmin" }, 403);
    }

    const items = await kv.getByPrefix("feedback:");
    const sorted = (items || []).sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return c.json({ items: sorted });
  } catch (e: any) {
    console.log(`GET /feedback error: ${e.message}`);
    return c.json({ error: `Error al listar feedback: ${e.message}` }, 500);
  }
});

// POST /feedback/ai-review – Trigger AI review of pending feedback using Gemini
// HIGH-1 FIX: Require superadmin to trigger AI review
app.post("/api/feedback/ai-review", async (c) => {
  try {
    const { ok, userId } = await isSuperAdmin(c);
    if (!ok || !userId) {
      return c.json({ error: "Acceso denegado: se requiere superadmin" }, 403);
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return c.json({ error: "GEMINI_API_KEY no configurada en el servidor" }, 500);
    }

    // Fetch all feedback
    const allFeedback = await kv.getByPrefix("feedback:");

    // Filter only un-reviewed items
    const pending = (allFeedback || []).filter(
      (fb: any) => !fb.aiReview || fb.status === "open"
    );

    if (pending.length === 0) {
      return c.json({ success: true, reviewed: 0, message: "No hay feedback pendiente de revision" });
    }

    // Batch: take up to 20 items per run to avoid timeouts
    const batch = pending.slice(0, 20);

    // Build the prompt
    const feedbackSummary = batch.map((fb: any, i: number) => {
      return `[${i + 1}] ID: ${fb.id}
Tipo: ${fb.type}
Fecha: ${fb.createdAt}
Usuario: ${fb.userEmail || fb.userId}
Mensaje: ${fb.message}
Estado actual: ${fb.status}`;
    }).join("\n\n---\n\n");

    const systemPrompt = `Eres un analista de producto de Vorea Studio, una aplicación web de modelado 3D paramétrico con editor SCAD, slicing, y exportación GCode.

Analiza cada feedback del usuario y proporciona para CADA UNO un análisis JSON con esta estructura:
{
  "id": "el_id_del_feedback",
  "category": "bug|feature_request|ux_issue|performance|documentation|praise|spam",
  "priority": "critical|high|medium|low",
  "sentiment": "positive|neutral|negative",
  "summary": "Resumen de 1-2 líneas",
  "suggestedAction": "Acción sugerida concreta para el equipo de desarrollo",
  "affectedArea": "editor|slicer|ai_studio|makerworld|organic|parametric|auth|payments|general",
  "tags": ["tag1", "tag2"]
}

Responde SOLO con un array JSON válido, sin texto adicional ni bloques de código markdown.`;

    const userPrompt = `Analiza los siguientes ${batch.length} feedbacks de usuarios:\n\n${feedbackSummary}`;

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt + "\n\n" + userPrompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        }
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.log(`Gemini API error: ${geminiRes.status} ${errBody}`);
      return c.json({ error: `Error de Gemini API: ${geminiRes.status}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse the AI response
    let reviews: any[] = [];
    try {
      // Clean markdown code fences if present
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      reviews = JSON.parse(cleaned);
    } catch (parseErr: any) {
      console.log(`Failed to parse Gemini response: ${parseErr.message}`);
      console.log(`Raw response: ${rawText.slice(0, 500)}`);
      return c.json({
        error: "No se pudo parsear la respuesta de Gemini",
        rawPreview: rawText.slice(0, 300),
      }, 500);
    }

    // Update each feedback with AI review
    let updatedCount = 0;
    const now = new Date().toISOString();

    for (const review of reviews) {
      const fb = batch.find((f: any) => f.id === review.id);
      if (fb) {
        fb.aiReview = {
          category: review.category,
          priority: review.priority,
          sentiment: review.sentiment,
          summary: review.summary,
          suggestedAction: review.suggestedAction,
          affectedArea: review.affectedArea,
          tags: review.tags || [],
        };
        fb.aiReviewedAt = now;
        fb.status = "reviewed";
        await kv.set(`feedback:${fb.id}`, fb);
        updatedCount++;
      }
    }

    // Save a review run log
    const runId = `fbrun_${uid()}`;
    await kv.set(`feedback_run:${runId}`, {
      id: runId,
      runAt: now,
      triggeredBy: userId,
      totalPending: pending.length,
      batchSize: batch.length,
      reviewed: updatedCount,
      model: "gemini-2.0-flash",
    });

    console.log(`AI Feedback review completed: ${updatedCount}/${batch.length} reviewed`);
    return c.json({
      success: true,
      reviewed: updatedCount,
      totalPending: pending.length,
      runId,
    });
  } catch (e: any) {
    console.log(`POST /feedback/ai-review error: ${e.message}`);
    return c.json({ error: `Error en AI review: ${e.message}` }, 500);
  }
});

// GET /feedback/ai-stats – Get AI review statistics
// HIGH-1 FIX: Require superadmin for stats
app.get("/api/feedback/ai-stats", async (c) => {
  try {
    const { ok } = await isSuperAdmin(c);
    if (!ok) {
      return c.json({ error: "Acceso denegado: se requiere superadmin" }, 403);
    }

    const allFeedback = await kv.getByPrefix("feedback:");
    const runs = await kv.getByPrefix("feedback_run:");

    const total = allFeedback.length;
    const reviewed = allFeedback.filter((f: any) => f.aiReview).length;
    const open = allFeedback.filter((f: any) => f.status === "open").length;

    // Priority breakdown
    const priorities: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const categories: Record<string, number> = {};
    const sentiments: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
    const areas: Record<string, number> = {};

    allFeedback.forEach((fb: any) => {
      if (fb.aiReview) {
        priorities[fb.aiReview.priority] = (priorities[fb.aiReview.priority] || 0) + 1;
        categories[fb.aiReview.category] = (categories[fb.aiReview.category] || 0) + 1;
        sentiments[fb.aiReview.sentiment] = (sentiments[fb.aiReview.sentiment] || 0) + 1;
        areas[fb.aiReview.affectedArea] = (areas[fb.aiReview.affectedArea] || 0) + 1;
      }
    });

    const lastRun = (runs || []).sort((a: any, b: any) =>
      new Date(b.runAt).getTime() - new Date(a.runAt).getTime()
    )[0] || null;

    return c.json({
      stats: {
        total,
        reviewed,
        open,
        priorities,
        categories,
        sentiments,
        areas,
        lastRun,
        totalRuns: runs.length,
      }
    });
  } catch (e: any) {
    console.log(`GET /feedback/ai-stats error: ${e.message}`);
    return c.json({ error: `Error al obtener estadisticas: ${e.message}` }, 500);
  }
});

// PUT /feedback/:id/status – Update feedback status manually
// HIGH-1 FIX: Require superadmin to change feedback status
app.put("/api/feedback/:id/status", async (c) => {
  try {
    const { ok, userId } = await isSuperAdmin(c);
    if (!ok || !userId) {
      return c.json({ error: "Acceso denegado: se requiere superadmin" }, 403);
    }

    const id = c.req.param("id");
    const body = await c.req.json();
    const { status } = body;

    if (!status) {
      return c.json({ error: "status es requerido" }, 400);
    }

    const fb = await kv.get(`feedback:${id}`);
    if (!fb) {
      return c.json({ error: "Feedback no encontrado" }, 404);
    }

    fb.status = status;
    fb.updatedAt = new Date().toISOString();
    fb.updatedBy = userId;
    await kv.set(`feedback:${id}`, fb);

    return c.json({ success: true, feedback: fb });
  } catch (e: any) {
    console.log(`PUT /feedback/:id/status error: ${e.message}`);
    return c.json({ error: `Error al actualizar estado: ${e.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYPAL PAYMENT ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";
const PAYPAL_API = process.env.PAYPAL_MODE === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

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

// GET /paypal/client-id – Return the PayPal client ID to frontend
app.get("/api/paypal/client-id", (c) => {
  return c.json({ clientId: PAYPAL_CLIENT_ID });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SOCIAL LOGIN CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

// GET /auth/social-providers – Returns which social providers are available
app.get("/api/auth/social-providers", (c) => {
  return c.json({
    providers: ["google", "instagram"],
    note: "Providers must be configured in the active authentication provider console before enabling social login.",
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUPERADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

const OWNER_EMAIL = "vorea.studio3d@gmail.com";

// POST /admin/reset-owner-password – Reset password for OWNER_EMAIL only
// CRIT-1 FIX: Require superadmin auth OR a deployment secret
app.post("/api/admin/reset-owner-password", async (c) => {
  try {
    // Require either superadmin token OR deployment secret header
    const deploySecret = process.env.DEPLOY_SECRET;
    const headerSecret = c.req.header("X-Deploy-Secret");
    const { ok: isAdmin } = await isSuperAdmin(c);

    if (!isAdmin && !(deploySecret && headerSecret === deploySecret)) {
      return c.json({ error: "Acceso denegado: se requiere autenticación de superadmin o deploy secret" }, 403);
    }

    // LOW-1: Rate limit password reset — 3 per hour
    const ip = getClientIp(c);
    const ownerResetRateLimit = await enforceRateLimit(
      c,
      `pwd-reset:${ip}`,
      3,
      60 * 60 * 1000,
      "Demasiados intentos. Intente nuevamente en 1 hora."
    );
    if (ownerResetRateLimit) {
      return ownerResetRateLimit;
    }

    const body = await c.req.json();
    const { email, newPassword } = body;

    if (!email || !newPassword) {
      return c.json({ error: "Email y nueva contraseña son requeridos" }, 400);
    }

    // SECURITY: Only allow reset for the owner email
    if (email !== OWNER_EMAIL) {
      return c.json({ error: "Esta ruta solo permite resetear la contraseña del propietario" }, 403);
    }

    if (newPassword.length < 6) {
      return c.json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
    }

    // MED-3 FIX: Strong password policy
    const pwError = validatePassword(newPassword);
    if (pwError) {
      return c.json({ error: pwError }, 400);
    }

    // Find the owner user in auth_users
    const ownerUser = await auth.getUserByEmail(OWNER_EMAIL);

    if (!ownerUser) {
      // Owner doesn't have an account yet — create one
      try {
        const newUser = await auth.createUser(OWNER_EMAIL, newPassword, {
          displayName: "Vorea Studio Owner",
          username: "@vorea-owner",
          tier: "STUDIO PRO",
          role: "superadmin",
        });

        // Create profile in KV
        const profile = {
          id: newUser.id,
          displayName: "Vorea Studio Owner",
          username: "@vorea-owner",
          email: OWNER_EMAIL,
          tier: "STUDIO PRO",
          role: "superadmin",
          createdAt: newUser.created_at,
        };
        await kv.set(`user:${newUser.id}:profile`, profile);

        console.log(`Owner account created and promoted: ${newUser.id}`);
        return c.json({ success: true, created: true, message: "Cuenta creada y contraseña establecida" });
      } catch (createErr: any) {
        console.log(`Error creating owner user: ${createErr.message}`);
        return c.json({ error: `Error al crear cuenta: ${createErr.message}` }, 500);
      }
    }

    // Owner exists — update password
    const newHash = await auth.hashPassword(newPassword);
    await auth.updateUser(ownerUser.id, { password_hash: newHash });

    console.log(`Owner password reset successful: ${ownerUser.id}`);
    return c.json({ success: true, created: false, message: "Contraseña actualizada exitosamente" });
  } catch (e: any) {
    console.log(`POST /admin/reset-owner-password error: ${e.message}`);
    return c.json({ error: `Error al resetear contraseña: ${e.message}` }, 500);
  }
});

// POST /admin/init – Bootstrap a superadmin user (first-time setup)
app.post("/api/admin/init", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json({ error: "No autorizado" }, 401);
    }

    // Promote the requesting user
    let profile = await kv.get(`user:${userId}:profile`);
    if (!profile) {
      // Auto-create profile from auth_users table
      const dbUser = await auth.getUserById(userId);
      if (dbUser) {
        profile = {
          id: userId,
          displayName: dbUser.display_name || dbUser.email.split("@")[0],
          username: dbUser.username || `@${dbUser.email.split("@")[0]}`,
          email: dbUser.email,
          tier: dbUser.tier || "FREE",
          createdAt: dbUser.created_at,
        };
        await kv.set(`user:${userId}:profile`, profile);
        console.log(`Auto-created profile in /admin/init for user: ${userId}`);
      } else {
        return c.json({ error: "Perfil no encontrado" }, 404);
      }
    }

    // Ensure profile has email field (might be missing from older profiles)
    if (!profile.email) {
      const dbUser = await auth.getUserById(userId);
      if (dbUser?.email) {
        profile.email = dbUser.email;
        await kv.set(`user:${userId}:profile`, profile);
        console.log(`Patched missing email for user: ${userId}`);
      }
    }

    // Check if any superadmin exists
    const allProfiles = await kv.getByPrefix("user:");
    const profiles = allProfiles.filter((p: any) => p.id && p.email);
    const existingSuperadmin = profiles.find((p: any) => p.role === "superadmin");

    if (existingSuperadmin) {
      // Already exists - only allow if caller is that superadmin OR the owner email
      if (profile?.role !== "superadmin" && profile?.email !== OWNER_EMAIL) {
        return c.json({ error: "Ya existe un superadmin. Solo el superadmin actual puede promover otros." }, 403);
      }
    } else {
      // First-time setup: only the owner email can self-promote
      if (profile?.email !== OWNER_EMAIL) {
        return c.json({ error: "Solo el propietario de la plataforma puede inicializar el primer superadmin." }, 403);
      }
    }

    profile.role = "superadmin";
    profile.tier = "STUDIO PRO"; // Superadmin always gets top tier
    await kv.set(`user:${userId}:profile`, profile);

    // Update auth_users table
    await auth.updateUser(userId, { role: "superadmin", tier: "STUDIO PRO" });

    // Log the event (LOW-2: hash chain)
    await auditLog("superadmin_init", { userId, email: profile.email });

    console.log(`Superadmin initialized: ${userId} (${profile.email})`);
    return c.json({ success: true, profile });
  } catch (e: any) {
    console.log(`POST /admin/init error: ${e.message}`);
    return c.json({ error: `Error al inicializar superadmin: ${e.message}` }, 500);
  }
});

// GET /admin/analytics-insights – AI-powered analytics insights from GA4 data
app.get("/api/admin/analytics-insights", requireSuperAdmin, async (c) => {
  try {

    const period = (c.req.query("period") || "7d") as string;
    const force = c.req.query("force") === "true";
    const ga4Configured = isGa4Configured();
    const allowMockAnalytics = String(process.env.ADMIN_ANALYTICS_ALLOW_MOCK || "").toLowerCase() === "true";

    // Check cache first (6h TTL)
    const CACHE_KEY = `analytics:insights:${period}`;
    const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

    if (!force) {
      const cached = await kv.get(CACHE_KEY) as AnalyticsInsightsResponse | null;
      if (cached && cached.generatedAt) {
        const age = Date.now() - new Date(cached.generatedAt).getTime();
        if (age < CACHE_TTL_MS) {
          return c.json({
            ...cached,
            cached: true,
            configured: cached.configured ?? !cached.mock,
            available: cached.available ?? Boolean(cached.metrics),
            unavailableReason: cached.unavailableReason ?? null,
          });
        }
      }
    }

    // Fetch metrics from GA4. Mock analytics is explicit opt-in only.
    let metrics = await fetchGa4Metrics(period);
    let isMock = false;
    if (!metrics) {
      if (allowMockAnalytics) {
        console.log("[analytics-insights] GA4 unavailable, using explicit mock data");
        metrics = generateMockMetrics(period);
        isMock = true;
      } else {
        const unavailableReason = ga4Configured
          ? "No se pudieron consultar métricas GA4. Revisa permisos de la service account y acceso a la propiedad."
          : "GA4 no está configurado. Define GA4_PROPERTY_ID y GA4_SERVICE_ACCOUNT_KEY antes de usar este dashboard.";
        return c.json({
          period,
          generatedAt: new Date().toISOString(),
          metrics: null,
          insights: [],
          cached: false,
          mock: false,
          configured: ga4Configured,
          available: false,
          unavailableReason,
        });
      }
    }

    // Generate AI insights with Gemini, fall back to rule-based if unavailable
    let insights = await generateInsightsWithGemini(metrics);
    if (insights.length === 0) {
      insights = generateFallbackInsights(metrics);
    }

    const response: AnalyticsInsightsResponse = {
      period,
      generatedAt: new Date().toISOString(),
      metrics,
      insights,
      cached: false,
      mock: isMock,
      configured: ga4Configured,
      available: true,
      unavailableReason: null,
    };

    // Cache the response
    await kv.set(CACHE_KEY, response);

    return c.json(response);
  } catch (e: any) {
    console.log(`GET /admin/analytics-insights error: ${e.message}`);
    return c.json({ error: e.message }, 500);
  }
});

// GET /admin/check – Check if current user is superadmin
app.get("/api/admin/check", async (c) => {
  try {
    const { ok, userId } = await isSuperAdmin(c);
    return c.json({ isSuperAdmin: ok, userId });
  } catch (e: any) {
    return c.json({ isSuperAdmin: false, error: e.message });
  }
});

// GET /admin/users – List all users (superadmin only)
app.get("/api/admin/users", requireSuperAdmin, async (c) => {
  try {
    const profiles = await listStoredUserProfiles();

    // Enrich with credits data
    const toolCreditsConfig = await kv.get("admin:tool_credits") || DEFAULT_TOOL_CREDITS;
    const enriched = await Promise.all(
      profiles.map(async (p: any) => {
        const credits = await kv.get(`user:${p.id}:credits`);
        const toolCredits = await getUserToolCreditsState(String(p.id), p, toolCreditsConfig);
        return {
          ...p,
          credits: credits || { freeUsed: 0, purchasedCredits: 0, totalExported: 0 },
          toolCredits: serializeToolCreditsState(toolCredits),
        };
      })
    );

    const sorted = enriched.sort((a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    return c.json({ users: sorted, total: sorted.length });
  } catch (e: any) {
    console.log(`GET /admin/users error: ${e.message}`);
    return c.json({ error: `Error al listar usuarios: ${e.message}` }, 500);
  }
});

// PUT /admin/users/:id – Update a user (tier, role, ban)
app.put("/api/admin/users/:id", requireSuperAdmin, async (c) => {
  try {

    const id = c.req.param("id");
    const body = await c.req.json();
    const profile = await kv.get(`user:${id}:profile`);
    if (!profile) return c.json({ error: "Usuario no encontrado" }, 404);

    // Apply changes
    const allowed = ["tier", "role", "banned", "displayName", "username"];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        profile[key] = body[key];
      }
    }
    profile.updatedAt = new Date().toISOString();
    await kv.set(`user:${id}:profile`, profile);

    // Sync to auth_users table
    try {
      await auth.updateUser(id, {
        tier: body.tier,
        role: body.role,
        banned: body.banned,
        display_name: body.displayName,
        username: body.username,
      });
    } catch (authErr: any) {
      console.log(`Auth table sync warning: ${authErr.message}`);
    }

    // Log (LOW-2: hash chain)
    await auditLog("user_updated", { targetUserId: id, changes: body });

    return c.json({ success: true, profile });
  } catch (e: any) {
    console.log(`PUT /admin/users/:id error: ${e.message}`);
    return c.json({ error: `Error al actualizar usuario: ${e.message}` }, 500);
  }
});

// DELETE /admin/users/:id – Delete a user
app.delete("/api/admin/users/:id", requireSuperAdmin, async (c) => {
  try {
    const adminId = c.get('userId') as string;

    const id = c.req.param("id");
    if (id === adminId) return c.json({ error: "No puedes eliminar tu propia cuenta" }, 400);

    // Delete from auth_users table
    try {
      await auth.deleteUser(id);
    } catch (authErr: any) {
      console.log(`Auth delete warning: ${authErr.message}`);
    }

    // Delete KV data
    await kv.del(`user:${id}:profile`);
    await kv.del(`user:${id}:credits`);

    // Log (LOW-2: hash chain)
    await auditLog("user_deleted", { targetUserId: id, deletedBy: adminId });

    return c.json({ success: true });
  } catch (e: any) {
    console.log(`DELETE /admin/users/:id error: ${e.message}`);
    return c.json({ error: `Error al eliminar usuario: ${e.message}` }, 500);
  }
});

// GET /admin/plans – Get editable plans
// POST /admin/users/cleanup-duplicates – Find and remove duplicate emails
app.post("/api/admin/users/cleanup-duplicates", requireSuperAdmin, async (c) => {
  try {
    const adminId = c.get('userId') as string;

    const body = await c.req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default: preview only

    const profiles = await listStoredUserProfiles();

    // Group by normalized email
    const byEmail: Record<string, any[]> = {};
    for (const p of profiles) {
      const email = (p.email || "").toLowerCase().trim();
      if (!email) continue;
      if (!byEmail[email]) byEmail[email] = [];
      byEmail[email].push(p);
    }

    // Find duplicates
    const duplicates: { email: string; kept: string; removed: string[]; reason: string }[] = [];
    const toDelete: any[] = [];

    for (const [email, group] of Object.entries(byEmail)) {
      if (group.length <= 1) continue;

      // Priority: 1) superadmin, 2) oldest createdAt
      const sorted = group.sort((a: any, b: any) => {
        if (a.role === "superadmin" && b.role !== "superadmin") return -1;
        if (b.role === "superadmin" && a.role !== "superadmin") return 1;
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });

      const keep = sorted[0];
      const remove = sorted.slice(1);
      const reason = keep.role === "superadmin" ? "superadmin" : "oldest";

      duplicates.push({
        email,
        kept: `${keep.id} (${keep.displayName || "?"}, ${keep.role || "user"}, ${keep.tier || "FREE"})`,
        removed: remove.map((r: any) => `${r.id} (${r.displayName || "?"}, ${r.role || "user"}, ${r.tier || "FREE"})`),
        reason,
      });
      toDelete.push(...remove);
    }

    // Execute cleanup if not dry run
    let deleted = 0;
    if (!dryRun) {
      for (const p of toDelete) {
        if (p.id === adminId) continue; // Protect self
        await kv.del(`user:${p.id}:profile`);
        await kv.del(`user:${p.id}:credits`);
        await kv.del(`user:${p.id}:activity`);
        await kv.del(`user:${p.id}:redeemed_promos`);
        await kv.del(`user:${p.id}:rewards`);
        try { await auth.deleteUser(p.id); } catch (_) { /* may not exist */ }
        deleted++;
      }
      await auditLog("duplicate_users_cleanup", { deletedCount: deleted, duplicates: duplicates.length, dryRun: false });
    }

    return c.json({ dryRun, duplicatesFound: duplicates.length, accountsToRemove: toDelete.length, deleted: dryRun ? 0 : deleted, details: duplicates });
  } catch (e: any) {
    console.log(`POST /admin/users/cleanup-duplicates error: ${e.message}`);
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /admin/tool-credits/legacy-status – Preview pending legacy purchased credits
app.get("/api/admin/tool-credits/legacy-status", requireSuperAdmin, async (c) => {
  try {
    const status = await getLegacyTopUpBackfillStatus();
    return c.json(status);
  } catch (e: any) {
    console.log(`GET /admin/tool-credits/legacy-status error: ${e.message}`);
    return c.json({ error: `Error al obtener estado legacy: ${e.message}` }, 500);
  }
});

// POST /admin/tool-credits/legacy-migrate – Batch migrate legacy purchased credits into universal top-ups
app.post("/api/admin/tool-credits/legacy-migrate", requireSuperAdmin, async (c) => {
  try {
    const actorUserId = String(c.get("userId") || "");
    const result = await executeLegacyTopUpBackfill(actorUserId);
    return c.json({
      success: true,
      ...result,
    });
  } catch (e: any) {
    console.log(`POST /admin/tool-credits/legacy-migrate error: ${e.message}`);
    return c.json({ error: `Error al migrar créditos legacy: ${e.message}` }, 500);
  }
});

app.get("/api/admin/plans", requireSuperAdmin, async (c) => {
  try {

    let plans = await kv.get("admin:plans");
    if (!plans) {
      plans = DEFAULT_PLANS;
      await kv.set("admin:plans", plans);
    }
    return c.json({ plans });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// PUT /admin/plans – Update plans config
app.put("/api/admin/plans", requireSuperAdmin, async (c) => {
  try {

    const body = await c.req.json();
    const { plans } = body;
    if (!plans || !Array.isArray(plans)) return c.json({ error: "plans array requerido" }, 400);

    await kv.set("admin:plans", plans);
    await auditLog("plans_updated", {});

    return c.json({ success: true, plans });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUSINESS CONFIG (PUBLIC + ADMIN)
// ═══════════════════════════════════════════════════════════════════════════════

// Default values (used if KV is empty — matches previously hardcoded values)
const DEFAULT_PLANS = [
  {
    tier: "FREE", name: "Free", price: 0, yearlyPrice: 0,
    features: ["3 proyectos activos", "Exportacion STL basica", "Editor parametrico", "6 exportaciones GCode gratis", "Comunidad (solo lectura)", "1 generacion IA por mes"],
  },
  {
    tier: "PRO", name: "Pro", price: 12, yearlyPrice: 99, highlighted: true,
    features: ["Proyectos ilimitados", "Exportacion STL, OBJ, 3MF", "Editor parametrico completo", "Exportaciones GCode ilimitadas", "Deformaciones organicas (1 cr)", "20 generaciones IA por mes", "MakerWorld publish (3 cr)", "Soporte prioritario"],
  },
  {
    tier: "STUDIO PRO", name: "Studio Pro", price: 29, yearlyPrice: 249,
    features: ["Todo lo de Pro", "Exportaciones GCode ilimitadas", "Generaciones IA ilimitadas", "Modelos privados", "Exportacion SCAD editable", "Soporte dedicado 24/7"],
  },
];

const DEFAULT_CREDIT_PACKS = [
  { id: "pack_10", name: "Pack Starter", credits: 10, price: 2.99, pricePerCredit: 0.30 },
  { id: "pack_30", name: "Pack Pro", credits: 30, price: 6.99, pricePerCredit: 0.23, popular: true },
  { id: "pack_100", name: "Pack Studio", credits: 100, price: 17.99, pricePerCredit: 0.18 },
];

function parseBooleanEnvFlag(raw: string | undefined): boolean {
  const value = String(raw || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function universalTopUpsEnabled(): boolean {
  if (process.env.ENABLE_UNIVERSAL_TOPUPS !== undefined) {
    return parseBooleanEnvFlag(process.env.ENABLE_UNIVERSAL_TOPUPS);
  }
  if (process.env.ENABLE_LEGACY_CREDIT_PACKS !== undefined) {
    return parseBooleanEnvFlag(process.env.ENABLE_LEGACY_CREDIT_PACKS);
  }
  return true;
}

const DEFAULT_LIMITS = {
  freeExportLimit: 6,
  aiGenerationsPerMonth: { FREE: 1, PRO: 20, "STUDIO PRO": -1 }, // -1 = unlimited
  maxActiveProjects: { FREE: 3, PRO: -1, "STUDIO PRO": -1 },
  exportFormats: { FREE: ["STL"], PRO: ["STL", "OBJ", "3MF"], "STUDIO PRO": ["STL", "OBJ", "3MF", "SCAD"] },
};

const SUGGESTED_COSTS = {
  aiCostPerRun: 0.002,
  monthlyInfrastructure: 25,
};

// ─── Universal Credit System defaults ──────────────────────────────────────

const DEFAULT_TOOL_CREDITS = {
  creditValueUsd: 0.05,
  monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
  tools: {
    studio: {
      label: "Studio",
      actions: [
        { actionId: "open_edit", labelKey: "credits.studio.open", creditCost: 0, limits: { free: -1, pro: -1, studioPro: -1 }, limitPeriod: "unlimited" },
        { actionId: "preview_3d", labelKey: "credits.studio.preview", creditCost: 0, limits: { free: -1, pro: -1, studioPro: -1 }, limitPeriod: "unlimited" },
        { actionId: "copy_scad", labelKey: "credits.studio.copy_scad", creditCost: 0, limits: { free: -1, pro: -1, studioPro: -1 }, limitPeriod: "unlimited" },
        { actionId: "download_stl", labelKey: "credits.studio.dl_stl", creditCost: 1, limits: { free: 6, pro: -1, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "download_obj", labelKey: "credits.studio.dl_obj", creditCost: 2, limits: { free: null, pro: -1, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "download_3mf", labelKey: "credits.studio.dl_3mf", creditCost: 2, limits: { free: null, pro: -1, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "download_scad", labelKey: "credits.studio.dl_scad", creditCost: 3, limits: { free: null, pro: null, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "publish", labelKey: "credits.studio.publish", creditCost: 0, limits: { free: 3, pro: -1, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "save_cloud", labelKey: "credits.studio.save", creditCost: 0, limits: { free: 3, pro: -1, studioPro: -1 }, limitPeriod: "total" },
      ],
    },
    comunidad: {
      label: "Comunidad",
      actions: [
        { actionId: "browse", labelKey: "credits.community.browse", creditCost: 0, limits: { free: -1, pro: -1, studioPro: -1 }, limitPeriod: "unlimited" },
        { actionId: "like_follow", labelKey: "credits.community.like", creditCost: 0, limits: { free: -1, pro: -1, studioPro: -1 }, limitPeriod: "unlimited" },
        { actionId: "comment", labelKey: "credits.community.comment", creditCost: 0, limits: { free: 5, pro: -1, studioPro: -1 }, limitPeriod: "day" },
        { actionId: "fork", labelKey: "credits.community.fork", creditCost: 1, limits: { free: 3, pro: -1, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "publish", labelKey: "credits.community.publish", creditCost: 0, limits: { free: 3, pro: -1, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "download", labelKey: "credits.community.download", creditCost: 1, limits: { free: 2, pro: -1, studioPro: -1 }, limitPeriod: "month" },
      ],
    },
    relief: {
      label: "Relief",
      actions: [
        { actionId: "open", labelKey: "credits.relief.open", creditCost: 0, limits: { free: -1, pro: -1, studioPro: -1 }, limitPeriod: "unlimited" },
        { actionId: "upload_small", labelKey: "credits.relief.upload_small", creditCost: 0, limits: { free: 3, pro: -1, studioPro: -1 }, limitPeriod: "day" },
        { actionId: "upload_medium", labelKey: "credits.relief.upload_med", creditCost: 1, limits: { free: null, pro: 10, studioPro: -1 }, limitPeriod: "day" },
        { actionId: "upload_large", labelKey: "credits.relief.upload_lg", creditCost: 2, limits: { free: null, pro: null, studioPro: 5 }, limitPeriod: "day" },
        { actionId: "export_stl", labelKey: "credits.relief.export_stl", creditCost: 1, limits: { free: 3, pro: -1, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "export_3mf", labelKey: "credits.relief.export_3mf", creditCost: 3, limits: { free: null, pro: 10, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "export_hybrid", labelKey: "credits.relief.export_hybrid", creditCost: 3, limits: { free: null, pro: 10, studioPro: -1 }, limitPeriod: "month" },
      ],
    },
    organic: {
      label: "Organic",
      actions: [
        { actionId: "view_demo", labelKey: "credits.organic.view", creditCost: 0, limits: { free: -1, pro: -1, studioPro: -1 }, limitPeriod: "unlimited" },
        { actionId: "deform", labelKey: "credits.organic.deform", creditCost: 1, limits: { free: null, pro: -1, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "export_mesh", labelKey: "credits.organic.export", creditCost: 2, limits: { free: null, pro: 10, studioPro: -1 }, limitPeriod: "month" },
      ],
    },
    gcode: {
      label: "GCode Collection",
      actions: [
        { actionId: "view", labelKey: "credits.gcode.view", creditCost: 0, limits: { free: -1, pro: -1, studioPro: -1 }, limitPeriod: "unlimited" },
        { actionId: "edit_linear", labelKey: "credits.gcode.edit_linear", creditCost: 1, limits: { free: 6, pro: -1, studioPro: -1 }, limitPeriod: "total" },
        { actionId: "edit_nonlinear", labelKey: "credits.gcode.edit_nl", creditCost: 3, limits: { free: null, pro: 10, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "deform_live", labelKey: "credits.gcode.deform", creditCost: 3, limits: { free: null, pro: 5, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "export", labelKey: "credits.gcode.export", creditCost: 1, limits: { free: 6, pro: -1, studioPro: -1 }, limitPeriod: "total" },
      ],
    },
    ai_studio: {
      label: "AI Studio",
      actions: [
        { actionId: "text_to_3d_simple", labelKey: "credits.ai.t2d_simple", creditCost: 5, limits: { free: 1, pro: 20, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "text_to_3d_complex", labelKey: "credits.ai.t2d_complex", creditCost: 10, limits: { free: null, pro: 10, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "gen_scad_agent", labelKey: "credits.ai.gen_scad", creditCost: 8, limits: { free: null, pro: 10, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "gen_f3d_agent", labelKey: "credits.ai.gen_f3d", creditCost: 10, limits: { free: null, pro: 5, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "iterate", labelKey: "credits.ai.iterate", creditCost: 3, limits: { free: 1, pro: 20, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "byok", labelKey: "credits.ai.byok", creditCost: 0, limits: { free: null, pro: -1, studioPro: -1 }, limitPeriod: "unlimited" },
      ],
    },
    makerworld: {
      label: "MakerWorld",
      actions: [
        { actionId: "browse", labelKey: "credits.mw.browse", creditCost: 0, limits: { free: -1, pro: -1, studioPro: -1 }, limitPeriod: "unlimited" },
        { actionId: "upload_scad", labelKey: "credits.mw.upload", creditCost: 2, limits: { free: null, pro: 5, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "publish", labelKey: "credits.mw.publish", creditCost: 3, limits: { free: null, pro: -1, studioPro: -1 }, limitPeriod: "month" },
        { actionId: "download_prep", labelKey: "credits.mw.download", creditCost: 1, limits: { free: null, pro: -1, studioPro: -1 }, limitPeriod: "month" },
      ],
    },
    feedback: {
      label: "Feedback",
      actions: [
        { actionId: "send_report", labelKey: "credits.feedback.send", creditCost: 0, limits: { free: -1, pro: -1, studioPro: -1 }, limitPeriod: "unlimited" },
      ],
    },
  },
};

const DEFAULT_AI_BUDGET = {
  globalMonthlyBudgetUsd: 100,
  maxBudgetPercentOfRevenue: 100,
  currentMonthSpentUsd: 0,
  currentMonth: new Date().toISOString().slice(0, 7),
  perTierDailyLimits: { FREE: 1, PRO: 20, "STUDIO PRO": -1 },
  circuitBreakerEnabled: true,
};

const DEFAULT_IMAGE_LIMITS = {
  free:      { maxBytes: 2 * 1024 * 1024,  resizePx: 1024 },
  pro:       { maxBytes: 10 * 1024 * 1024, resizePx: 2048 },
  studioPro: { maxBytes: 10 * 1024 * 1024, resizePx: null },
};

// ─── Dynamic Plan Features ─────────────────────────────────────────────────
function generatePlanFeatures(tierName: string, toolCredits: any, limits: any): string[] {
  const tier = tierName.toUpperCase();
  const tk = tier === "STUDIO PRO" ? "studioPro" : tier === "PRO" ? "pro" : "free";
  const f: string[] = [];
  const mc = toolCredits?.monthlyCredits?.[tier] ?? 0;
  if (mc > 0) f.push(`${mc} créditos/mes`);
  const mp = limits?.maxActiveProjects?.[tier];
  if (mp === -1) f.push("Proyectos ilimitados");
  else if (mp > 0) f.push(`${mp} proyectos activos`);
  const fmt = limits?.exportFormats?.[tier];
  if (fmt?.length === 1) f.push(`Exportación ${fmt[0]} básica`);
  else if (fmt?.length > 1) f.push(`Exportación ${fmt.join(", ")}`);
  const ai = limits?.aiGenerationsPerMonth?.[tier] ?? limits?.aiGenerationsPerDay?.[tier];
  if (ai === -1) f.push("Generaciones IA ilimitadas");
  else if (ai > 0) f.push(`${ai} ${ai === 1 ? "generación" : "generaciones"} IA/mes`);
  const gc = toolCredits?.tools?.gcode?.actions?.find((a: any) => a.actionId === "export");
  if (gc?.limits?.[tk] === -1) f.push("Exportaciones GCode ilimitadas");
  else if (gc?.limits?.[tk] > 0) f.push(`${gc.limits[tk]} exportaciones GCode`);
  const org = toolCredits?.tools?.organic?.actions?.find((a: any) => a.actionId === "deform");
  if (org?.limits?.[tk] != null) f.push("Deformaciones orgánicas");
  const mw = toolCredits?.tools?.makerworld?.actions?.find((a: any) => a.actionId === "publish");
  if (mw?.limits?.[tk] != null) f.push("MakerWorld publish");
  const scad = toolCredits?.tools?.studio?.actions?.find((a: any) => a.actionId === "download_scad");
  if (scad?.limits?.[tk] != null) f.push("Exportación SCAD editable");
  if (tier === "STUDIO PRO") f.push("Soporte dedicado 24/7");
  else if (tier === "PRO") f.push("Soporte prioritario");
  return f;
}

// GET /config/business – Public endpoint (no auth required)
app.get("/api/config/business", async (c) => {
  try {
    const plans = (await kv.get("admin:plans") || DEFAULT_PLANS) as any[];
    const creditPacksEnabled = universalTopUpsEnabled();
    const configuredCreditPacks = await kv.get("admin:credit_packs") || DEFAULT_CREDIT_PACKS;
    const creditPacks = creditPacksEnabled ? configuredCreditPacks : [];
    const limits = await kv.get("admin:limits") || DEFAULT_LIMITS;
    const promotions = await kv.get("admin:promotions") || [];
    const toolCredits = await kv.get("admin:tool_credits") || DEFAULT_TOOL_CREDITS;
    const imageLimits = await kv.get("admin:image_limits") || DEFAULT_IMAGE_LIMITS;

    // Enrich plans with dynamically generated features
    const enrichedPlans = plans.map((plan: any) => ({
      ...plan,
      features: generatePlanFeatures(plan.tier, toolCredits, limits),
    }));

    return c.json({
      plans: enrichedPlans,
      creditPacks,
      creditPacksEnabled,
      creditPacksMode: "universal_topup",
      limits,
      toolCredits: {
        creditValueUsd: toolCredits.creditValueUsd,
        monthlyCredits: toolCredits.monthlyCredits,
        tools: toolCredits.tools,
      },
      imageLimits,
      promotions: (promotions as any[]).filter((p: any) => {
        if (!p.active) return false;
        const now = new Date().toISOString();
        if (p.conditions?.startDate && now < p.conditions.startDate) return false;
        if (p.conditions?.endDate && now > p.conditions.endDate) return false;
        return true;
      }),
      currency: "USD",
    });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /admin/credit-packs – Get editable credit packs
app.get("/api/admin/credit-packs", requireSuperAdmin, async (c) => {
  try {

    const packs = await kv.get("admin:credit_packs") || DEFAULT_CREDIT_PACKS;
    return c.json({ creditPacks: packs });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// PUT /admin/credit-packs – Update credit packs
app.put("/api/admin/credit-packs", requireSuperAdmin, async (c) => {
  try {

    const body = await c.req.json();
    const { creditPacks } = body;
    if (!creditPacks || !Array.isArray(creditPacks)) {
      return c.json({ error: "creditPacks array requerido" }, 400);
    }

    // Validate each pack
    for (const pack of creditPacks) {
      if (!pack.id || !pack.name || !pack.credits || !pack.price) {
        return c.json({ error: "Cada pack debe tener id, name, credits y price" }, 400);
      }
      pack.pricePerCredit = +(pack.price / pack.credits).toFixed(2);
    }

    await kv.set("admin:credit_packs", creditPacks);
    await auditLog("credit_packs_updated", { count: creditPacks.length });

    return c.json({ success: true, creditPacks });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /admin/limits – Get editable tier limits
app.get("/api/admin/limits", requireSuperAdmin, async (c) => {
  try {

    const limits = await kv.get("admin:limits") || DEFAULT_LIMITS;
    const costs = await kv.get("admin:costs") || {};
    return c.json({
      limits,
      costs,
      costsConfigured: {
        aiCostPerRun: Number.isFinite(Number((costs as any).aiCostPerRun)),
        monthlyInfrastructure: Number.isFinite(Number((costs as any).monthlyInfrastructure)),
      },
      costSuggestions: SUGGESTED_COSTS,
    });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// PUT /admin/limits – Update tier limits
app.put("/api/admin/limits", requireSuperAdmin, async (c) => {
  try {

    const body = await c.req.json();
    const { limits, costs } = body;

    if (limits) {
      await kv.set("admin:limits", limits);
    }
    if (costs) {
      await kv.set("admin:costs", costs);
    }

    await auditLog("limits_updated", { limits: !!limits, costs: !!costs });
    return c.json({ success: true, limits: limits || await kv.get("admin:limits"), costs: costs || await kv.get("admin:costs") });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL CREDIT CONFIG (ADMIN)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /admin/tool-credits – Get editable tool credit config
app.get("/api/admin/tool-credits", requireSuperAdmin, async (c) => {
  try {

    const toolCredits = await kv.get("admin:tool_credits") || DEFAULT_TOOL_CREDITS;
    return c.json({ toolCredits });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// PUT /admin/tool-credits – Update tool credit config
app.put("/api/admin/tool-credits", requireSuperAdmin, async (c) => {
  try {

    const body = await c.req.json();
    const { toolCredits } = body;
    if (!toolCredits || typeof toolCredits !== "object") {
      return c.json({ error: "toolCredits object requerido" }, 400);
    }

    // Validate required fields
    if (typeof toolCredits.creditValueUsd !== "number" || toolCredits.creditValueUsd <= 0) {
      return c.json({ error: "creditValueUsd debe ser un numero positivo" }, 400);
    }
    if (!toolCredits.monthlyCredits || typeof toolCredits.monthlyCredits !== "object") {
      return c.json({ error: "monthlyCredits es requerido" }, 400);
    }
    if (!toolCredits.tools || typeof toolCredits.tools !== "object") {
      return c.json({ error: "tools es requerido" }, 400);
    }

    await kv.set("admin:tool_credits", toolCredits);
    await auditLog("tool_credits_updated", { creditValueUsd: toolCredits.creditValueUsd });

    return c.json({ success: true, toolCredits });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /admin/ai-budget – Get AI budget config
app.get("/api/admin/ai-budget", requireSuperAdmin, async (c) => {
  try {
    const paypalOrders = await kv.getByPrefix("paypal:order:");
    const budget = await kv.get("admin:ai_budget") || DEFAULT_AI_BUDGET;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyRevenue = (paypalOrders as any[])
      .filter((o: any) => o.status === "COMPLETED" && (o.capturedAt || o.createdAt || "").startsWith(currentMonth))
      .reduce((sum: number, o: any) => sum + (o.price || 0), 0);

    if (budget.currentMonth !== currentMonth) {
      budget.currentMonthSpentUsd = 0;
      budget.currentMonth = currentMonth;
      await kv.set("admin:ai_budget", budget);
    }

    return c.json(await buildAiBudgetAdminSnapshot(prisma, budget as any, monthlyRevenue));
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// PUT /admin/ai-budget – Update AI budget config
app.put("/api/admin/ai-budget", requireSuperAdmin, async (c) => {
  try {

    const body = await c.req.json();
    const { budget } = body;
    if (!budget || typeof budget !== "object") {
      return c.json({ error: "budget object requerido" }, 400);
    }

    if (typeof budget.globalMonthlyBudgetUsd !== "number" || budget.globalMonthlyBudgetUsd < 0) {
      return c.json({ error: "globalMonthlyBudgetUsd debe ser >= 0" }, 400);
    }
    if (typeof budget.maxBudgetPercentOfRevenue !== "number" || budget.maxBudgetPercentOfRevenue < 0 || budget.maxBudgetPercentOfRevenue > 100) {
      return c.json({ error: "maxBudgetPercentOfRevenue debe ser 0-100" }, 400);
    }

    // Preserve runtime counter
    const existing = await kv.get("admin:ai_budget") || DEFAULT_AI_BUDGET;
    const merged = {
      ...existing,
      globalMonthlyBudgetUsd: budget.globalMonthlyBudgetUsd,
      maxBudgetPercentOfRevenue: budget.maxBudgetPercentOfRevenue,
      perTierDailyLimits: budget.perTierDailyLimits || existing.perTierDailyLimits,
      circuitBreakerEnabled: budget.circuitBreakerEnabled ?? existing.circuitBreakerEnabled,
    };

    await kv.set("admin:ai_budget", merged);
    await auditLog("ai_budget_updated", { globalMonthlyBudgetUsd: merged.globalMonthlyBudgetUsd });

    return c.json({ success: true, budget: merged });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /admin/image-limits – Get image upload limits per tier
// ─── AI Lane Matrix Admin ────────────────────────────────────────────────────

// GET /admin/ai-lane-matrix – Get current lane matrix config (defaults + overrides)
app.get("/api/admin/ai-lane-matrix", requireSuperAdmin, async (c) => {
  try {
    const config = await getLaneMatrixConfigForAdmin();
    return c.json(config);
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// PUT /admin/ai-lane-matrix – Save lane matrix overrides
app.put("/api/admin/ai-lane-matrix", requireSuperAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { config } = body;
    if (!config || typeof config !== "object") {
      return c.json({ error: "config object requerido" }, 400);
    }
    await saveLaneMatrixConfig(config);
    await auditLog("ai_lane_matrix_updated", { config });
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// DELETE /admin/ai-lane-matrix – Reset lane matrix to defaults
app.delete("/api/admin/ai-lane-matrix", requireSuperAdmin, async (c) => {
  try {
    await resetLaneMatrixConfig();
    await auditLog("ai_lane_matrix_reset", {});
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// ─── AI Budget Enforcement ────────────────────────────────────────────────────

type AiRecipeEngine = "fdm" | "organic";
type AiRecipeQuality = "draft" | "final";
type AiRecipeFamily =
  | "storage-box"
  | "drawer-organizer-tray"
  | "planter-drip-system"
  | "lamp-shade-kit"
  | "text-keychain-tag"
  | "nameplate-pro"
  | "peg-label-system"
  | "threaded-jar"
  | "phone-stand"
  | "utility-hook"
  | "vase-wave"
  | "lamp-shell"
  | "decorative-tower";

type AiStudioRecipeRecord = {
  id: string;
  version: "1.0";
  name: string;
  prompt: string;
  engine: AiRecipeEngine;
  quality: AiRecipeQuality;
  familyHint: AiRecipeFamily;
  parameterOverrides: Record<string, number | string | boolean>;
  createdAt: string;
  updatedAt: string;
};

type AiStudioSpecParameterRecord = {
  name: string;
  type: "number" | "bool" | "string";
  defaultValue: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  description: string;
};

type AiStudioSpecRecord = {
  version: "1.0";
  prompt: string;
  engine: AiRecipeEngine;
  family: AiRecipeFamily;
  intent: string;
  qualityProfile: AiRecipeQuality;
  printProfile: "fdm";
  tags: string[];
  constraints: Record<string, string | number | boolean>;
  parameters: AiStudioSpecParameterRecord[];
  warnings: string[];
};

type AiStudioValidationRecord = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

type AiStudioCompilePreviewRecord = {
  quality: AiRecipeQuality;
  score: number;
  level: "light" | "medium" | "heavy";
  estimatedMs: number;
  metrics: {
    primitives: number;
    booleans: number;
    loops: number;
    detailHints: number;
  };
  warnings: string[];
};

type AiStudioHistoryRecord = {
  id: string;
  version: "1.0" | "1.1";
  prompt: string;
  engine: AiRecipeEngine;
  quality: AiRecipeQuality;
  modelName: string;
  scadCode: string;
  familyHint?: AiRecipeFamily;
  parameterOverrides?: Record<string, number | string | boolean>;
  spec: AiStudioSpecRecord;
  validation: AiStudioValidationRecord;
  compilePreview: AiStudioCompilePreviewRecord;
  createdAt: string;
  updatedAt: string;
};

const AI_RECIPE_FAMILIES_BY_ENGINE: Record<AiRecipeEngine, AiRecipeFamily[]> = {
  fdm: ["storage-box", "drawer-organizer-tray", "planter-drip-system", "lamp-shade-kit", "text-keychain-tag", "nameplate-pro", "peg-label-system", "threaded-jar", "phone-stand", "utility-hook"],
  organic: ["vase-wave", "lamp-shell", "decorative-tower"],
};

function aiRecipeStorageKey(userId: string): string {
  return `ai:recipes:${userId}`;
}

function aiHistoryStorageKey(userId: string): string {
  return `ai:history:${userId}`;
}

function sanitizeRecipeOverrides(input: unknown): Record<string, number | string | boolean> {
  if (!input || typeof input !== "object") return {};
  const output: Record<string, number | string | boolean> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!key || typeof key !== "string") continue;
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
      output[key] = value;
    }
  }
  return output;
}

function parseRecipeInput(body: any): {
  ok: boolean;
  error?: string;
  data?: {
    id?: string;
    name: string;
    prompt: string;
    engine: AiRecipeEngine;
    quality: AiRecipeQuality;
    familyHint: AiRecipeFamily;
    parameterOverrides: Record<string, number | string | boolean>;
  };
} {
  const name = String(body?.name || "").trim();
  const prompt = String(body?.prompt || "").trim();
  const engine = body?.engine === "organic" ? "organic" : body?.engine === "fdm" ? "fdm" : null;
  const quality = body?.quality === "final" ? "final" : body?.quality === "draft" ? "draft" : null;
  const familyHint = String(body?.familyHint || "").trim() as AiRecipeFamily;
  const id = body?.id ? String(body.id) : undefined;
  const parameterOverrides = sanitizeRecipeOverrides(body?.parameterOverrides);

  if (!name) return { ok: false, error: "name es requerido" };
  if (!prompt) return { ok: false, error: "prompt es requerido" };
  if (!engine) return { ok: false, error: "engine invalido" };
  if (!quality) return { ok: false, error: "quality invalido" };
  if (!AI_RECIPE_FAMILIES_BY_ENGINE[engine].includes(familyHint)) {
    return { ok: false, error: "familyHint invalido para engine" };
  }

  return {
    ok: true,
    data: {
      id,
      name,
      prompt,
      engine,
      quality,
      familyHint,
      parameterOverrides,
    },
  };
}

function sanitizeAiStringArray(input: unknown, limit = 50): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function sanitizeAiNumber(input: unknown): number | undefined {
  const value = Number(input);
  return Number.isFinite(value) ? value : undefined;
}

function sanitizeAiScalarRecord(input: unknown): Record<string, string | number | boolean> {
  if (!input || typeof input !== "object") return {};
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!key || typeof key !== "string") continue;
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
      output[key] = value;
    }
  }
  return output;
}

function sanitizeAiHistoryParameters(input: unknown): AiStudioSpecParameterRecord[] {
  if (!Array.isArray(input)) return [];
  const parameters: AiStudioSpecParameterRecord[] = [];

  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const name = String((item as any).name || "").trim();
    const type = (item as any).type;
    const description = String((item as any).description || "").trim();
    const defaultValue = (item as any).defaultValue;
    if (!name || !description) continue;
    if (type !== "number" && type !== "bool" && type !== "string") continue;
    if (
      typeof defaultValue !== "number" &&
      typeof defaultValue !== "string" &&
      typeof defaultValue !== "boolean"
    ) {
      continue;
    }

    parameters.push({
      name,
      type,
      defaultValue,
      min: sanitizeAiNumber((item as any).min),
      max: sanitizeAiNumber((item as any).max),
      step: sanitizeAiNumber((item as any).step),
      description,
    });
  }

  return parameters.slice(0, 64);
}

function deriveAiHistoryParameterOverrides(
  spec: AiStudioSpecRecord
): Record<string, number | string | boolean> {
  const output: Record<string, number | string | boolean> = {};
  for (const parameter of spec.parameters || []) {
    if (
      parameter?.name &&
      (typeof parameter.defaultValue === "number" ||
        typeof parameter.defaultValue === "string" ||
        typeof parameter.defaultValue === "boolean")
    ) {
      output[parameter.name] = parameter.defaultValue;
    }
  }
  return output;
}

function normalizeAiHistoryRecord(input: unknown): AiStudioHistoryRecord | null {
  if (!input || typeof input !== "object") return null;
  const entry = input as Partial<AiStudioHistoryRecord>;
  const prompt = String(entry.prompt || "").trim();
  const engine =
    entry.engine === "organic" ? "organic" : entry.engine === "fdm" ? "fdm" : null;
  const quality =
    entry.quality === "final" ? "final" : entry.quality === "draft" ? "draft" : null;
  const modelName = String(entry.modelName || "").trim();
  const scadCode = String(entry.scadCode || "").trim();
  const id = String(entry.id || "").trim();

  if (!id || !prompt || !engine || !quality || !modelName || !scadCode) return null;

  const spec = sanitizeAiHistorySpec(entry.spec, prompt, engine, quality);
  const validation = sanitizeAiHistoryValidation(entry.validation);
  const compilePreview = sanitizeAiHistoryCompilePreview(entry.compilePreview, quality);
  if (!spec || !validation || !compilePreview) return null;

  const familyHint = AI_RECIPE_FAMILIES_BY_ENGINE[engine].includes(
    String(entry.familyHint || "").trim() as AiRecipeFamily
  )
    ? (String(entry.familyHint || "").trim() as AiRecipeFamily)
    : spec.family;
  const parameterOverrides = sanitizeRecipeOverrides(entry.parameterOverrides);

  return {
    id,
    version: "1.1",
    prompt,
    engine,
    quality,
    modelName,
    scadCode,
    familyHint,
    parameterOverrides:
      Object.keys(parameterOverrides).length > 0
        ? parameterOverrides
        : deriveAiHistoryParameterOverrides(spec),
    spec,
    validation,
    compilePreview,
    createdAt: String(entry.createdAt || new Date().toISOString()),
    updatedAt: String(entry.updatedAt || new Date().toISOString()),
  };
}

function sanitizeAiHistorySpec(
  input: unknown,
  prompt: string,
  engine: AiRecipeEngine,
  quality: AiRecipeQuality
): AiStudioSpecRecord | null {
  if (!input || typeof input !== "object") return null;
  const family = String((input as any).family || "").trim() as AiRecipeFamily;
  const intent = String((input as any).intent || "").trim();
  const version = (input as any).version === "1.0" ? "1.0" : null;
  const printProfile = (input as any).printProfile === "fdm" ? "fdm" : null;

  if (!version) return null;
  if (!printProfile) return null;
  if (!intent) return null;
  if (!AI_RECIPE_FAMILIES_BY_ENGINE[engine].includes(family)) return null;

  return {
    version,
    prompt,
    engine,
    family,
    intent,
    qualityProfile: quality,
    printProfile,
    tags: sanitizeAiStringArray((input as any).tags, 24),
    constraints: sanitizeAiScalarRecord((input as any).constraints),
    parameters: sanitizeAiHistoryParameters((input as any).parameters),
    warnings: sanitizeAiStringArray((input as any).warnings, 24),
  };
}

function sanitizeAiHistoryValidation(input: unknown): AiStudioValidationRecord | null {
  if (!input || typeof input !== "object") return null;
  return {
    valid: !!(input as any).valid,
    errors: sanitizeAiStringArray((input as any).errors, 24),
    warnings: sanitizeAiStringArray((input as any).warnings, 24),
  };
}

function sanitizeAiHistoryCompilePreview(
  input: unknown,
  quality: AiRecipeQuality
): AiStudioCompilePreviewRecord | null {
  if (!input || typeof input !== "object") return null;
  const level = (input as any).level;
  const metrics = (input as any).metrics;
  const score = sanitizeAiNumber((input as any).score);
  const estimatedMs = sanitizeAiNumber((input as any).estimatedMs);
  if (level !== "light" && level !== "medium" && level !== "heavy") return null;
  if (score === undefined || estimatedMs === undefined) return null;
  if (!metrics || typeof metrics !== "object") return null;

  const primitives = sanitizeAiNumber((metrics as any).primitives);
  const booleans = sanitizeAiNumber((metrics as any).booleans);
  const loops = sanitizeAiNumber((metrics as any).loops);
  const detailHints = sanitizeAiNumber((metrics as any).detailHints);

  if (
    primitives === undefined ||
    booleans === undefined ||
    loops === undefined ||
    detailHints === undefined
  ) {
    return null;
  }

  return {
    quality,
    score,
    level,
    estimatedMs,
    metrics: {
      primitives,
      booleans,
      loops,
      detailHints,
    },
    warnings: sanitizeAiStringArray((input as any).warnings, 24),
  };
}

function parseHistoryInput(body: any): {
  ok: boolean;
  error?: string;
  data?: {
    id?: string;
    prompt: string;
    engine: AiRecipeEngine;
    quality: AiRecipeQuality;
    modelName: string;
    scadCode: string;
    familyHint: AiRecipeFamily;
    parameterOverrides: Record<string, number | string | boolean>;
    spec: AiStudioSpecRecord;
    validation: AiStudioValidationRecord;
    compilePreview: AiStudioCompilePreviewRecord;
  };
} {
  const prompt = String(body?.prompt || "").trim();
  const engine = body?.engine === "organic" ? "organic" : body?.engine === "fdm" ? "fdm" : null;
  const quality = body?.quality === "final" ? "final" : body?.quality === "draft" ? "draft" : null;
  const modelName = String(body?.modelName || "").trim();
  const scadCode = String(body?.scadCode || "").trim();
  const id = body?.id ? String(body.id).trim() : undefined;
  const requestedFamilyHint = String(body?.familyHint || "").trim() as AiRecipeFamily;
  const parameterOverrides = sanitizeRecipeOverrides(body?.parameterOverrides);

  if (!prompt) return { ok: false, error: "prompt es requerido" };
  if (prompt.length > 600) return { ok: false, error: "prompt excede el maximo permitido" };
  if (!engine) return { ok: false, error: "engine invalido" };
  if (!quality) return { ok: false, error: "quality invalido" };
  if (!modelName) return { ok: false, error: "modelName es requerido" };
  if (modelName.length > 160) return { ok: false, error: "modelName excede el maximo permitido" };
  if (!scadCode) return { ok: false, error: "scadCode es requerido" };
  if (scadCode.length > 200000) return { ok: false, error: "scadCode excede el maximo permitido" };

  const spec = sanitizeAiHistorySpec(body?.spec, prompt, engine, quality);
  if (!spec) return { ok: false, error: "spec invalido" };
  const familyHint = AI_RECIPE_FAMILIES_BY_ENGINE[engine].includes(requestedFamilyHint)
    ? requestedFamilyHint
    : spec.family;

  const validation = sanitizeAiHistoryValidation(body?.validation);
  if (!validation) return { ok: false, error: "validation invalido" };

  const compilePreview = sanitizeAiHistoryCompilePreview(body?.compilePreview, quality);
  if (!compilePreview) return { ok: false, error: "compilePreview invalido" };

  return {
    ok: true,
    data: {
      id,
      prompt,
      engine,
      quality,
      modelName,
      scadCode,
      familyHint,
      parameterOverrides:
        Object.keys(parameterOverrides).length > 0
          ? parameterOverrides
          : deriveAiHistoryParameterOverrides(spec),
      spec,
      validation,
      compilePreview,
    },
  };
}

// GET /api/ai/recipes – authenticated list for current user
app.get("/api/ai/recipes", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Autenticación requerida" }, 401);

    const recipes = (await kv.get(aiRecipeStorageKey(userId))) as AiStudioRecipeRecord[] | null;
    const normalized = Array.isArray(recipes) ? recipes : [];
    normalized.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return c.json({ recipes: normalized });
  } catch (e: any) {
    return c.json({ error: e.message || "Error al listar recipes" }, 500);
  }
});

// POST /api/ai/recipes – authenticated upsert for current user
app.post("/api/ai/recipes", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Autenticación requerida" }, 401);

    const body = await c.req.json().catch(() => ({}));
    const parsed = parseRecipeInput(body);
    if (!parsed.ok || !parsed.data) {
      return c.json({ error: parsed.error || "Payload inválido" }, 400);
    }

    const key = aiRecipeStorageKey(userId);
    const current = ((await kv.get(key)) as AiStudioRecipeRecord[] | null) || [];
    const now = new Date().toISOString();
    const recipeId = parsed.data.id || `ar_${uid()}`;
    const existingIndex = current.findIndex((item) => item.id === recipeId);
    const nextRecord: AiStudioRecipeRecord = {
      id: recipeId,
      version: "1.0",
      name: parsed.data.name,
      prompt: parsed.data.prompt,
      engine: parsed.data.engine,
      quality: parsed.data.quality,
      familyHint: parsed.data.familyHint,
      parameterOverrides: parsed.data.parameterOverrides,
      createdAt: existingIndex >= 0 ? current[existingIndex].createdAt : now,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      current[existingIndex] = nextRecord;
    } else {
      current.unshift(nextRecord);
    }

    const normalized = current
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 200);

    await kv.set(key, normalized);
    await userActivityLog(userId, "ai_recipe_saved", {
      recipeId: nextRecord.id,
      engine: nextRecord.engine,
      familyHint: nextRecord.familyHint,
    });

    return c.json({ success: true, recipe: nextRecord });
  } catch (e: any) {
    return c.json({ error: e.message || "Error al guardar recipe" }, 500);
  }
});

// DELETE /api/ai/recipes/:id – authenticated delete for current user
app.delete("/api/ai/recipes/:id", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Autenticación requerida" }, 401);
    const recipeId = String(c.req.param("id") || "").trim();
    if (!recipeId) return c.json({ error: "id requerido" }, 400);

    const key = aiRecipeStorageKey(userId);
    const current = ((await kv.get(key)) as AiStudioRecipeRecord[] | null) || [];
    const filtered = current.filter((item) => item.id !== recipeId);
    if (filtered.length === current.length) {
      return c.json({ error: "Recipe no encontrada" }, 404);
    }

    await kv.set(key, filtered);
    await userActivityLog(userId, "ai_recipe_deleted", { recipeId });
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message || "Error al eliminar recipe" }, 500);
  }
});

// GET /api/ai/history – authenticated list for current user
app.get("/api/ai/history", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Autenticación requerida" }, 401);

    const history = (await kv.get(aiHistoryStorageKey(userId))) as AiStudioHistoryRecord[] | null;
    const normalized = (Array.isArray(history) ? history : [])
      .map(normalizeAiHistoryRecord)
      .filter((item): item is AiStudioHistoryRecord => !!item);
    normalized.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return c.json({ history: normalized });
  } catch (e: any) {
    return c.json({ error: e.message || "Error al listar historial AI" }, 500);
  }
});

// POST /api/ai/history – authenticated upsert for current user
app.post("/api/ai/history", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Autenticación requerida" }, 401);

    const body = await c.req.json().catch(() => ({}));
    const parsed = parseHistoryInput(body);
    if (!parsed.ok || !parsed.data) {
      return c.json({ error: parsed.error || "Payload inválido" }, 400);
    }

    const key = aiHistoryStorageKey(userId);
    const current = ((((await kv.get(key)) as AiStudioHistoryRecord[] | null) || [])
      .map(normalizeAiHistoryRecord)
      .filter((item): item is AiStudioHistoryRecord => !!item));
    const now = new Date().toISOString();
    const entryId = parsed.data.id || `ah_${uid()}`;
    const existingIndex = current.findIndex((item) => item.id === entryId);
    const nextRecord: AiStudioHistoryRecord = {
      id: entryId,
      version: "1.1",
      prompt: parsed.data.prompt,
      engine: parsed.data.engine,
      quality: parsed.data.quality,
      modelName: parsed.data.modelName,
      scadCode: parsed.data.scadCode,
      familyHint: parsed.data.familyHint,
      parameterOverrides: parsed.data.parameterOverrides,
      spec: parsed.data.spec,
      validation: parsed.data.validation,
      compilePreview: parsed.data.compilePreview,
      createdAt: existingIndex >= 0 ? current[existingIndex].createdAt : now,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      current[existingIndex] = nextRecord;
    } else {
      current.unshift(nextRecord);
    }

    const normalized = current
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 100);

    await kv.set(key, normalized);
    await userActivityLog(userId, "ai_history_saved", {
      historyId: nextRecord.id,
      engine: nextRecord.engine,
      familyHint: nextRecord.familyHint,
    });

    return c.json({ success: true, entry: nextRecord });
  } catch (e: any) {
    return c.json({ error: e.message || "Error al guardar historial AI" }, 500);
  }
});

// DELETE /api/ai/history/:id – authenticated delete for current user
app.delete("/api/ai/history/:id", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Autenticación requerida" }, 401);
    const historyId = String(c.req.param("id") || "").trim();
    if (!historyId) return c.json({ error: "id requerido" }, 400);

    const key = aiHistoryStorageKey(userId);
    const current = ((((await kv.get(key)) as AiStudioHistoryRecord[] | null) || [])
      .map(normalizeAiHistoryRecord)
      .filter((item): item is AiStudioHistoryRecord => !!item));
    const filtered = current.filter((item) => item.id !== historyId);
    if (filtered.length === current.length) {
      return c.json({ error: "Entrada de historial no encontrada" }, 404);
    }

    await kv.set(key, filtered);
    await userActivityLog(userId, "ai_history_deleted", { historyId });
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message || "Error al eliminar historial AI" }, 500);
  }
});

/**
 * checkAIBudget — Middleware-style helper.
 * Returns { allowed: true } or { allowed: false, reason } with HTTP-friendly status.
 * Call this before any AI generation endpoint.
 */
export async function checkAIBudget(tier: string): Promise<{ allowed: boolean; reason?: string }> {
  const budget = (await kv.get("admin:ai_budget") || DEFAULT_AI_BUDGET) as typeof DEFAULT_AI_BUDGET;

  // Auto-reset if month changed
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (budget.currentMonth !== currentMonth) {
    budget.currentMonthSpentUsd = 0;
    budget.currentMonth = currentMonth;
    await kv.set("admin:ai_budget", budget);
  }

  // Compute effective budget = min(globalCap, revenue × %)
  const plans = (await kv.get("admin:plans") || DEFAULT_PLANS) as any[];
  const monthlyRevenue = plans.reduce((sum: number, p: any) => sum + (p.price || 0), 0) * 10;
  const revenueBound = monthlyRevenue * (budget.maxBudgetPercentOfRevenue / 100);
  const effectiveBudget = Math.min(budget.globalMonthlyBudgetUsd, revenueBound);

  // Circuit breaker: block if spent >= effective budget
  if (budget.circuitBreakerEnabled && budget.currentMonthSpentUsd >= effectiveBudget) {
    return { allowed: false, reason: "budget_exhausted" };
  }

  // Per-tier daily limits
  const tierLimits = budget.perTierDailyLimits as Record<string, number>;
  const dailyLimit = tierLimits[tier];
  if (dailyLimit !== undefined && dailyLimit !== -1) {
    const today = new Date().toISOString().slice(0, 10);
    const dailyKey = `ai_daily:${tier}:${today}`;
    const dailyUsed = ((await kv.get(dailyKey)) as number) || 0;
    if (dailyUsed >= dailyLimit) {
      return { allowed: false, reason: "daily_limit_reached" };
    }
  }

  return { allowed: true };
}

// GET /api/ai/budget-status – Public endpoint: check if AI is available
app.get("/api/ai/budget-status", async (c) => {
  try {
    const budget = (await kv.get("admin:ai_budget") || DEFAULT_AI_BUDGET) as typeof DEFAULT_AI_BUDGET;
    const currentMonth = new Date().toISOString().slice(0, 7);

    if (budget.currentMonth !== currentMonth) {
      budget.currentMonthSpentUsd = 0;
      budget.currentMonth = currentMonth;
      await kv.set("admin:ai_budget", budget);
    }

    const plans = (await kv.get("admin:plans") || DEFAULT_PLANS) as any[];
    const monthlyRevenue = plans.reduce((sum: number, p: any) => sum + (p.price || 0), 0) * 10;
    const revenueBound = monthlyRevenue * (budget.maxBudgetPercentOfRevenue / 100);
    const effectiveBudget = Math.min(budget.globalMonthlyBudgetUsd, revenueBound);
    const tripped = budget.circuitBreakerEnabled && budget.currentMonthSpentUsd >= effectiveBudget;

    return c.json({
      available: !tripped,
      circuitBreakerTripped: tripped,
      budgetUtilization: effectiveBudget > 0 ? `${((budget.currentMonthSpentUsd / effectiveBudget) * 100).toFixed(1)}%` : "0%",
      currentMonth: budget.currentMonth,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/ai/quick-fix – Vorea Quick Fix for SCAD linter errors
app.post("/api/ai/quick-fix", async (c) => {
  try {
    const ip = getClientIp(c);
    const quickFixRateLimit = await enforceRateLimit(
      c,
      `ai_quick_fix:${ip}`,
      10,
      60 * 1000,
      "Demasiadas peticiones a Vorea Quick Fix. Intenta en un minuto."
    );
    if (quickFixRateLimit) {
      return quickFixRateLimit;
    }

    const body = await c.req.json();
    const { source, error } = body;

    if (!source || !error) {
      return c.json({ error: "Se requiere source y error" }, 400);
    }

    const fixedCode = await generateQuickFixWithGemini(source, error);
    if (!fixedCode) {
      return c.json({ error: "No se pudo generar una corrección." }, 500);
    }

    // Optional: Log action
    const userId = await getUserId(c);
    if (userId) {
      await userActivityLog(userId, "ai_quick_fix_used", { errorLength: error.length });
    }

    return c.json({ data: fixedCode });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/ai/track-spend – Record an AI cost (called after successful AI generation)
app.post("/api/ai/track-spend", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Autenticación requerida" }, 401);

    const body = await c.req.json();
    const { costUsd } = body;
    if (typeof costUsd !== "number" || costUsd < 0) {
      return c.json({ error: "Invalid costUsd" }, 400);
    }

    const userProfile = (await kv.get(`user:${userId}:profile`)) || {};
    const requestedAction = String(body?.actionId || "").trim();
    const allowedAiActions = new Set([
      "text_to_3d_simple",
      "text_to_3d_complex",
      "gen_scad_agent",
      "gen_f3d_agent",
      "iterate",
    ]);
    const actionId = allowedAiActions.has(requestedAction) ? requestedAction : "iterate";
    const aiGate = await checkToolActionAllowed(userId, userProfile, "ai_studio", actionId);
    if (!aiGate.allowed) {
      return c.json({ error: aiGate.error || "Acción no permitida" }, (aiGate.status || 403) as ContentfulStatusCode);
    }

    const budget = (await kv.get("admin:ai_budget") || DEFAULT_AI_BUDGET) as typeof DEFAULT_AI_BUDGET;
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (budget.currentMonth !== currentMonth) {
      budget.currentMonthSpentUsd = 0;
      budget.currentMonth = currentMonth;
    }
    budget.currentMonthSpentUsd += costUsd;
    await kv.set("admin:ai_budget", budget);

    const tier = normalizeTierName(userProfile?.tier);
    const today = new Date().toISOString().slice(0, 10);
    const dailyKey = `ai_daily:${tier}:${today}`;
    const dailyUsed = ((await kv.get(dailyKey)) as number) || 0;
    await kv.set(dailyKey, dailyUsed + 1);
    await consumeToolActionUsage(userId, userProfile, aiGate);
    await userActivityLog(userId, "ai_spend_tracked", { costUsd, actionId, tier });

    return c.json({ success: true, currentMonthSpentUsd: budget.currentMonthSpentUsd, actionId, tier });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /admin/image-limits – Get image upload limits per tier
app.get("/api/admin/image-limits", requireSuperAdmin, async (c) => {
  try {

    const imageLimits = await kv.get("admin:image_limits") || DEFAULT_IMAGE_LIMITS;
    return c.json({ imageLimits });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// PUT /admin/image-limits – Update image upload limits
app.put("/api/admin/image-limits", requireSuperAdmin, async (c) => {
  try {

    const body = await c.req.json();
    const { imageLimits } = body;
    if (!imageLimits || typeof imageLimits !== "object") {
      return c.json({ error: "imageLimits object requerido" }, 400);
    }

    await kv.set("admin:image_limits", imageLimits);
    await auditLog("image_limits_updated", {});

    return c.json({ success: true, imageLimits });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// POST /api/promotions/validate – Public: validate a coupon code
app.post("/api/promotions/validate", async (c) => {
  try {
    const { code, tier } = await c.req.json();
    if (!code || typeof code !== "string") {
      return c.json({ valid: false, error: "Código de cupón requerido" }, 400);
    }

    const promos = (await kv.get("admin:promotions") || []) as any[];
    const now = new Date().toISOString();
    const normalizedCode = code.trim().toUpperCase();

    // Find matching active promo with this coupon code
    const match = promos.find((p: any) => {
      if (!p.active) return false;
      if (!p.conditions?.couponCode) return false;
      if (p.conditions.couponCode.toUpperCase() !== normalizedCode) return false;
      // Check date validity
      if (p.conditions.startDate && now < p.conditions.startDate) return false;
      if (p.conditions.endDate && now > p.conditions.endDate + "T23:59:59Z") return false;
      // Check max uses
      if (p.conditions.maxUses > 0 && (p.usedCount || 0) >= p.conditions.maxUses) return false;
      // Check tier applicability
      if (tier && p.appliesTo && !p.appliesTo.includes("all") && !p.appliesTo.includes(tier)) return false;
      return true;
    });

    if (!match) {
      return c.json({ valid: false, error: "Cupón inválido o expirado" });
    }

    return c.json({
      valid: true,
      promotion: {
        id: match.id,
        name: match.name,
        type: match.type,
        value: match.value,
        appliesTo: match.appliesTo,
      },
    });
  } catch (e) {
    return c.json({ valid: false, error: "Error al validar cupón" }, 500);
  }
});

// POST /api/promotions/redeem – Redeem a coupon (increment usedCount)
app.post("/api/promotions/redeem", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "No autorizado" }, 401);

    const { promoId } = await c.req.json();
    if (!promoId) return c.json({ error: "promoId requerido" }, 400);

    const promos = (await kv.get("admin:promotions") || []) as any[];
    const promo = promos.find((p: any) => p.id === promoId);
    if (!promo) return c.json({ error: "Promoción no encontrada" }, 404);

    // Check if user already redeemed this promo
    const userRedeemed = (await kv.get(`user:${userId}:redeemed_promos`) || []) as string[];
    if (userRedeemed.includes(promoId)) {
      return c.json({ error: "Ya usaste este cupón" }, 400);
    }

    // Increment usedCount
    promo.usedCount = (promo.usedCount || 0) + 1;
    await kv.set("admin:promotions", promos);

    // Record redemption for user
    userRedeemed.push(promoId);
    await kv.set(`user:${userId}:redeemed_promos`, userRedeemed);

    // Apply bonus credits if applicable
    if (promo.type === "bonus_credits") {
      const profile = (await kv.get(`user:${userId}:profile`)) || {};
      await addToolCreditTopUp(userId, profile, Number(promo.value || 0), {
        source: "promotion_bonus",
        promoId,
        promoName: promo.name,
      });
    }

    await userActivityLog(userId, "coupon_redeemed", { promoId, promoName: promo.name, type: promo.type, value: promo.value });
    await auditLog("promo_redeemed", { userId, promoId, promoName: promo.name, type: promo.type, value: promo.value });

    return c.json({ success: true, type: promo.type, value: promo.value, name: promo.name });
  } catch (e) {
    return c.json({ error: "Error al canjear cupón" }, 500);
  }
});

// GET /admin/promotions – List all promotions (admin sees all including inactive)
// ─── Vorea Rewards System ─────────────────────────────────────────────────────

const REWARD_ACTIONS: Record<string, { xp: number; label: string; maxDaily: number }> = {
  first_model:       { xp: 50,  label: "Primer modelo creado",       maxDaily: 1 },
  publish_model:     { xp: 20,  label: "Publicar un modelo",         maxDaily: 5 },
  export_gcode:      { xp: 10,  label: "Exportar GCode",             maxDaily: 10 },
  export_stl:        { xp: 5,   label: "Exportar STL",               maxDaily: 10 },
  ai_generation:     { xp: 15,  label: "Generación con IA",          maxDaily: 5 },
  community_like:    { xp: 2,   label: "Dar like a un modelo",       maxDaily: 20 },
  receive_like:      { xp: 5,   label: "Recibir like",               maxDaily: 50 },
  receive_download:  { xp: 3,   label: "Recibir descarga",           maxDaily: 50 },
  daily_login:       { xp: 10,  label: "Login diario",               maxDaily: 1 },
  streak_7:          { xp: 50,  label: "Racha de 7 días",            maxDaily: 1 },
  streak_30:         { xp: 200, label: "Racha de 30 días",           maxDaily: 1 },
  relief_export:     { xp: 10,  label: "Exportar relieve",           maxDaily: 5 },
  feedback_sent:     { xp: 15,  label: "Enviar feedback",            maxDaily: 3 },
};

const COMMUNITY_LEVELS = [
  { level: 1, name: "Novato",     xpRequired: 0,     badge: "🌱", bonusCredits: 0 },
  { level: 2, name: "Explorador", xpRequired: 100,   badge: "🔍", bonusCredits: 5 },
  { level: 3, name: "Creador",    xpRequired: 500,   badge: "⚡", bonusCredits: 10 },
  { level: 4, name: "Artesano",   xpRequired: 1500,  badge: "🔧", bonusCredits: 20 },
  { level: 5, name: "Maestro",    xpRequired: 5000,  badge: "🏆", bonusCredits: 50 },
  { level: 6, name: "Leyenda",    xpRequired: 15000, badge: "👑", bonusCredits: 100 },
];

interface UserRewards {
  xp: number;
  level: number;
  totalActions: number;
  dailyActions: Record<string, number>;
  lastDailyReset: string;
  streak: number;
  lastLoginDate: string;
  badges: string[];
}

function getDefaultRewards(): UserRewards {
  return {
    xp: 0,
    level: 1,
    totalActions: 0,
    dailyActions: {},
    lastDailyReset: new Date().toISOString().slice(0, 10),
    streak: 0,
    lastLoginDate: "",
    badges: [],
  };
}

function computeLevel(xp: number): { level: number; name: string; badge: string; nextLevelXp: number; progress: number } {
  let current = COMMUNITY_LEVELS[0];
  for (const lvl of COMMUNITY_LEVELS) {
    if (xp >= lvl.xpRequired) current = lvl;
  }
  const nextIdx = COMMUNITY_LEVELS.findIndex((l) => l.level === current.level) + 1;
  const nextLevel = COMMUNITY_LEVELS[nextIdx] || current;
  const xpInLevel = xp - current.xpRequired;
  const xpToNext = nextLevel.xpRequired - current.xpRequired;
  return {
    level: current.level,
    name: current.name,
    badge: current.badge,
    nextLevelXp: nextLevel.xpRequired,
    progress: xpToNext > 0 ? Math.min(100, (xpInLevel / xpToNext) * 100) : 100,
  };
}

// GET /api/rewards/me – Get authenticated user's rewards
app.get("/api/rewards/me", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "No autorizado" }, 401);

    const rewards = ((await kv.get(`rewards:${userId}`)) || getDefaultRewards()) as UserRewards;
    const levelInfo = computeLevel(rewards.xp);
    return c.json({
      rewards: {
        xp: rewards.xp,
        level: levelInfo.name,
        levelNum: levelInfo.level,
        badge: levelInfo.badge,
        progress: levelInfo.progress,
        nextLevelXp: levelInfo.nextLevelXp,
        totalActions: rewards.totalActions,
        streak: rewards.streak,
        badges: rewards.badges,
      },
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/rewards/:userId – Get public rewards summary
app.get("/api/rewards/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const rewards = (await kv.get(`user:${userId}:rewards`)) || {
      points: 0,
      level: "Novice",
      badges: [],
    };
    return c.json({
      rewards: {
        points: Number(rewards.points || 0),
        level: String(rewards.level || "Novice"),
        badges: Array.isArray(rewards.badges) ? rewards.badges : [],
      },
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/rewards/trigger – Award XP for an action
app.post("/api/rewards/trigger", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "No autorizado" }, 401);

    const { action } = await c.req.json();
    if (!action) return c.json({ error: "action required" }, 400);

    const actionConfig = REWARD_ACTIONS[action];
    if (!actionConfig) return c.json({ error: `Unknown action: ${action}` }, 400);

    const rewards = ((await kv.get(`rewards:${userId}`)) || getDefaultRewards()) as UserRewards;
    const today = new Date().toISOString().slice(0, 10);

    // Reset daily counters if new day
    if (rewards.lastDailyReset !== today) {
      rewards.dailyActions = {};
      rewards.lastDailyReset = today;
    }

    // Check daily cap
    const dailyCount = rewards.dailyActions[action] || 0;
    if (dailyCount >= actionConfig.maxDaily) {
      return c.json({ success: false, reason: "daily_cap_reached", xpAwarded: 0 });
    }

    // Award XP
    const prevLevel = computeLevel(rewards.xp).level;
    rewards.xp += actionConfig.xp;
    rewards.totalActions++;
    rewards.dailyActions[action] = dailyCount + 1;

    // Check level-up
    const newLevelInfo = computeLevel(rewards.xp);
    let leveledUp = false;
    let bonusCredits = 0;
    if (newLevelInfo.level > prevLevel) {
      rewards.level = newLevelInfo.level;
      leveledUp = true;
      const levelConfig = COMMUNITY_LEVELS.find((l) => l.level === newLevelInfo.level);
      bonusCredits = levelConfig?.bonusCredits ?? 0;
      if (levelConfig?.badge && !rewards.badges.includes(levelConfig.badge)) {
        rewards.badges.push(levelConfig.badge);
      }
    }

    await kv.set(`rewards:${userId}`, rewards);

    return c.json({
      success: true,
      xpAwarded: actionConfig.xp,
      totalXp: rewards.xp,
      leveledUp,
      bonusCredits,
      ...newLevelInfo,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ─── Engine Telemetry ─────────────────────────────────────────────────────────
// Dedicated BigData pipeline: typed columns in PostgreSQL for SQL analytics.
// Binary snapshots stored in KV, referenced by ID.

const TEL_SNAPSHOT_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/;
const TEL_MAX_SNAPSHOT_BYTES = 200_000; // ~200KB max WebP

// POST /api/telemetry/snapshot – Upload a WebP snapshot, return ID
app.post("/api/telemetry/snapshot", async (c) => {
  try {
    const ip = getClientIp(c);
    const snapshotRateLimit = await enforceRateLimit(
      c,
      `telemetry-snap:${ip}`,
      30,
      10 * 60 * 1000,
      "Demasiada subida de snapshots de telemetría."
    );
    if (snapshotRateLimit) return snapshotRateLimit;

    const body = await c.req.json().catch(() => null);
    const dataUrl = body?.data;
    if (typeof dataUrl !== "string" || !TEL_SNAPSHOT_RE.test(dataUrl)) {
      return c.json({ error: "Snapshot inválido o formato no soportado" }, 400);
    }

    // Size check
    const match = dataUrl.match(TEL_SNAPSHOT_RE);
    if (match) {
      try {
        const bytes = Buffer.from(match[2], "base64").byteLength;
        if (bytes > TEL_MAX_SNAPSHOT_BYTES) {
          return c.json({ error: "Snapshot demasiado grande (máx 200KB)" }, 400);
        }
      } catch {
        return c.json({ error: "Base64 inválido" }, 400);
      }
    }

    const snapshotId = `tsnap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await kv.set(`telemetry:snapshot:${snapshotId}`, dataUrl);

    return c.json({ snapshotId });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/telemetry/snapshot/:id – Serve snapshot image with cache headers
app.get("/api/telemetry/snapshot/:id", async (c) => {
  const snapshotId = c.req.param("id");
  const data = await kv.get(`telemetry:snapshot:${snapshotId}`);
  if (!data || typeof data !== "string") return c.json({ error: "Not found" }, 404);

  const match = String(data).match(TEL_SNAPSHOT_RE);
  if (!match) return c.json({ error: "Invalid format" }, 500);

  const [, mimeType, b64] = match;
  const buffer = Buffer.from(b64, "base64");
  return new Response(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

// POST /api/telemetry/batch – Receive batched engine telemetry events
app.post("/api/telemetry/batch", async (c) => {
  try {
    const ip = getClientIp(c);
    const telemetryRateLimit = await enforceRateLimit(
      c,
      `telemetry:${ip}`,
      60,
      60 * 1000,
      "Demasiadas cargas de telemetría. Intenta nuevamente en un minuto."
    );
    if (telemetryRateLimit) return telemetryRateLimit;

    const body = await c.req.json();
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "unknown";
    const events = body.events;
    if (!Array.isArray(events) || events.length === 0) {
      return c.json({ success: true, stored: 0 });
    }

    if (events.length > 20) {
      return c.json({ error: "Batch demasiado grande (máximo 20 eventos)." }, 400);
    }

    // Resolve userId from session (optional — telemetry works for anonymous users too)
    const userId = await getUserId(c);

    // Insert into PostgreSQL via Prisma
    const prisma = getPrismaClient();
    const data = events.map((evt: any) => ({
      sessionId,
      userId: userId || null,
      trigger: String(evt.trigger || "unknown"),
      page: String(evt.page || "relief"),
      // Engine params
      surfaceMode: evt.engine?.surfaceMode ?? null,
      subdivisions: typeof evt.engine?.subdivisions === "number" ? evt.engine.subdivisions : null,
      maxHeight: typeof evt.engine?.maxHeight === "number" ? evt.engine.maxHeight : null,
      smoothing: typeof evt.engine?.smoothing === "number" ? evt.engine.smoothing : null,
      colorZones: typeof evt.engine?.colorZones === "number" ? evt.engine.colorZones : null,
      invert: typeof evt.engine?.invert === "boolean" ? evt.engine.invert : null,
      solid: typeof evt.engine?.solid === "boolean" ? evt.engine.solid : null,
      baseThickness: typeof evt.engine?.baseThickness === "number" ? evt.engine.baseThickness : null,
      // Dimensions
      plateWidth: typeof evt.engine?.plateWidth === "number" ? evt.engine.plateWidth : null,
      plateDepth: typeof evt.engine?.plateDepth === "number" ? evt.engine.plateDepth : null,
      cylinderRadius: typeof evt.engine?.cylinderRadius === "number" ? evt.engine.cylinderRadius : null,
      cylinderHeight: typeof evt.engine?.cylinderHeight === "number" ? evt.engine.cylinderHeight : null,
      polygonSides: typeof evt.engine?.polygonSides === "number" ? evt.engine.polygonSides : null,
      polygonRadius: typeof evt.engine?.polygonRadius === "number" ? evt.engine.polygonRadius : null,
      // Image
      imageFormat: evt.engine?.imageFormat ?? null,
      imageScale: typeof evt.engine?.imageScale === "number" ? evt.engine.imageScale : null,
      imageScaleMode: evt.engine?.imageScaleMode ?? null,
      // Export
      exportFormat: evt.engine?.exportFormat ?? null,
      threeMfColorMode: evt.engine?.threeMfColorMode ?? null,
      // Mesh health
      meshScore: evt.mesh?.meshScore ?? null,
      meshFaces: typeof evt.mesh?.meshFaces === "number" ? evt.mesh.meshFaces : null,
      meshVertices: typeof evt.mesh?.meshVertices === "number" ? evt.mesh.meshVertices : null,
      boundaryEdges: typeof evt.mesh?.boundaryEdges === "number" ? evt.mesh.boundaryEdges : null,
      nonManifoldEdges: typeof evt.mesh?.nonManifoldEdges === "number" ? evt.mesh.nonManifoldEdges : null,
      meshVolume: typeof evt.mesh?.meshVolume === "number" ? evt.mesh.meshVolume : null,
      // Snapshot
      snapshotId: evt.snapshotId ?? null,
      // Error / extra
      errorMessage: evt.errorMessage ?? null,
      extraParams: evt.extraParams ?? {},
      // Durations
      generationTimeMs: typeof evt.generationTimeMs === "number" ? evt.generationTimeMs : null,
      exportTimeMs: typeof evt.exportTimeMs === "number" ? evt.exportTimeMs : null,
    }));

    await prisma.telemetryEvent.createMany({ data });

    // Also update legacy KV counters for the admin analytics dashboard
    const today = new Date().toISOString().slice(0, 10);
    for (const evt of events) {
      if (evt.trigger) {
        const counterKey = `telemetry_count:${today}:engine:${evt.trigger}`;
        const count = ((await kv.get(counterKey)) as number) || 0;
        await kv.set(counterKey, count + 1);
      }
    }

    return c.json({ success: true, stored: events.length });
  } catch (e: any) {
    console.error("POST /api/telemetry/batch error:", e.message);
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/telemetry/insights – Admin-only analytics from engine telemetry
app.get("/api/telemetry/insights", async (c) => {
  try {
    const { ok } = await isSuperAdmin(c);
    if (!ok) return c.json({ error: "Acceso denegado: se requiere superadmin" }, 403);

    const daysBack = Math.min(parseInt(c.req.query("days") || "30", 10), 90);
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const prisma = getPrismaClient();

    // Total events
    const totalEvents = await prisma.telemetryEvent.count({
      where: { createdAt: { gte: since } },
    });

    // Events by trigger
    const byTrigger = await prisma.telemetryEvent.groupBy({
      by: ["trigger"],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    // Events by surfaceMode
    const bySurfaceMode = await prisma.telemetryEvent.groupBy({
      by: ["surfaceMode"],
      where: { createdAt: { gte: since }, surfaceMode: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    // Mesh health distribution
    const byMeshScore = await prisma.telemetryEvent.groupBy({
      by: ["meshScore"],
      where: { createdAt: { gte: since }, meshScore: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    // Top warning-generating surfaceMode + subdivisions combos
    const warningCombos = await prisma.telemetryEvent.groupBy({
      by: ["surfaceMode", "subdivisions"],
      where: {
        createdAt: { gte: since },
        meshScore: "warnings",
        surfaceMode: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    // Average generation time by surfaceMode
    const avgGenTime = await prisma.telemetryEvent.groupBy({
      by: ["surfaceMode"],
      where: {
        createdAt: { gte: since },
        generationTimeMs: { not: null },
        surfaceMode: { not: null },
      },
      _avg: { generationTimeMs: true },
      orderBy: { _avg: { generationTimeMs: "desc" } },
    });

    return c.json({
      daysBack,
      totalEvents,
      byTrigger: byTrigger.map((r) => ({ trigger: r.trigger, count: r._count.id })),
      bySurfaceMode: bySurfaceMode.map((r) => ({ surfaceMode: r.surfaceMode, count: r._count.id })),
      byMeshScore: byMeshScore.map((r) => ({ meshScore: r.meshScore, count: r._count.id })),
      warningCombos: warningCombos.map((r) => ({
        surfaceMode: r.surfaceMode,
        subdivisions: r.subdivisions,
        count: r._count.id,
      })),
      avgGenTime: avgGenTime.map((r) => ({
        surfaceMode: r.surfaceMode,
        avgMs: Math.round(r._avg.generationTimeMs || 0),
      })),
    });
  } catch (e: any) {
    console.error("GET /api/telemetry/insights error:", e.message);
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/admin/analytics – KPI dashboard data for SuperAdmin
app.get("/api/admin/analytics", requireSuperAdmin, async (c) => {
  try {

    // Aggregate last 7 days
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const tools = ["studio", "relief", "ai-studio", "organic", "gcode", "feedback"];
    const toolCounts: Record<string, number> = {};
    const dailyTrend: { date: string; events: number }[] = [];

    for (const day of days) {
      const dayEvents = ((await kv.get(`telemetry:${day}`)) as any[]) || [];
      dailyTrend.push({ date: day, events: dayEvents.length });

      for (const evt of dayEvents) {
        if (evt.tool) {
          toolCounts[evt.tool] = (toolCounts[evt.tool] || 0) + 1;
        }
      }
    }

    // Sort tools by count
    const topTools = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tool, count]) => ({ tool, count }));

    return c.json({
      period: { from: days[0], to: days[days.length - 1] },
      totalEvents: dailyTrend.reduce((s, d) => s + d.events, 0),
      dailyTrend,
      topTools,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get("/api/admin/promotions", requireSuperAdmin, async (c) => {
  try {

    const promos = await kv.get("admin:promotions") || [];
    return c.json({ promotions: promos });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// PUT /admin/promotions – Update all promotions (upsert array)
app.put("/api/admin/promotions", requireSuperAdmin, async (c) => {
  try {

    const body = await c.req.json();
    const { promotions } = body;
    if (!promotions || !Array.isArray(promotions)) {
      return c.json({ error: "promotions array requerido" }, 400);
    }

    // Validate and assign IDs
    for (const promo of promotions) {
      if (!promo.name || !promo.type || promo.value === undefined) {
        return c.json({ error: "Cada promocion necesita name, type y value" }, 400);
      }
      if (!["percent", "fixed", "trial", "bonus_credits"].includes(promo.type)) {
        return c.json({ error: `Tipo invalido: ${promo.type}. Usar: percent, fixed, trial, bonus_credits` }, 400);
      }
      if (!promo.id) promo.id = `promo_${crypto.randomUUID().slice(0, 8)}`;
      if (promo.usedCount === undefined) promo.usedCount = 0;
      if (promo.active === undefined) promo.active = true;
      if (!promo.conditions) promo.conditions = {};
      if (!promo.appliesTo) promo.appliesTo = ["all"];
    }

    await kv.set("admin:promotions", promotions);
    await auditLog("promotions_updated", { count: promotions.length });

    return c.json({ success: true, promotions });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// DELETE /admin/promotions/:id – Delete a single promotion
app.delete("/api/admin/promotions/:id", requireSuperAdmin, async (c) => {
  try {

    const id = c.req.param("id");
    const promos = await kv.get("admin:promotions") || [];
    const filtered = (promos as any[]).filter((p: any) => p.id !== id);

    if (filtered.length === promos.length) {
      return c.json({ error: "Promocion no encontrada" }, 404);
    }

    await kv.set("admin:promotions", filtered);
    await auditLog("promotion_deleted", { promotionId: id });

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /admin/reports/usage – Usage analytics
app.get("/api/admin/reports/usage", requireSuperAdmin, async (c) => {
  try {

    const allProfiles = await kv.getByPrefix("user:");
    const profiles = allProfiles.filter((p: any) => p.id && p.email && p.displayName !== undefined);
    const allFeedback = await kv.getByPrefix("feedback:");
    const feedbackRuns = await kv.getByPrefix("feedback_run:");
    const paypalOrders = await kv.getByPrefix("paypal:order:");

    // Tier distribution
    const tierDist: Record<string, number> = { FREE: 0, PRO: 0, "STUDIO PRO": 0 };
    profiles.forEach((p: any) => {
      // Normalize tier: STUDIO_PRO → STUDIO PRO
      const t = (p.tier || "FREE").replace(/_/g, " ");
      tierDist[t] = (tierDist[t] || 0) + 1;
    });

    // Signups over time (last 30 days)
    const now = Date.now();
    const signupsByDay: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      signupsByDay[d.toISOString().split("T")[0]] = 0;
    }
    profiles.forEach((p: any) => {
      if (p.createdAt) {
        const day = p.createdAt.split("T")[0];
        if (signupsByDay[day] !== undefined) signupsByDay[day]++;
      }
    });

    // Total GCode exports
    let totalExports = 0;
    for (const p of profiles) {
      const creds = await kv.get(`user:${p.id}:credits`);
      if (creds) totalExports += creds.totalExported || 0;
    }

    return c.json({
      usage: {
        totalUsers: profiles.length,
        tierDistribution: tierDist,
        signupsByDay,
        totalFeedback: allFeedback.length,
        totalAIRuns: feedbackRuns.length,
        totalPaypalOrders: paypalOrders.length,
        completedOrders: paypalOrders.filter((o: any) => o.status === "COMPLETED").length,
        totalGCodeExports: totalExports,
      },
    });
  } catch (e: any) {
    console.log(`GET /admin/reports/usage error: ${e.message}`);
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /admin/reports/regional-stats – Regional user distribution
app.get("/api/admin/reports/regional-stats", requireSuperAdmin, async (c) => {
  try {
    const stats = await auth.getRegionalStats();
    
    // Add regional storage usage
    const storageResult = await prisma.regionalStorageDailyAggregate.groupBy({
      by: ["regionCode"],
      _sum: {
        aiStorageBytes: true,
        aiImageBytes: true,
      },
    });

    const storageByRegion = storageResult.reduce((acc: any, curr: any) => {
      acc[curr.regionCode] = {
        aiStorageBytes: Number(curr._sum.aiStorageBytes || 0),
        aiImageBytes: Number(curr._sum.aiImageBytes || 0),
      };
      return acc;
    }, {});

    return c.json({ ...stats, storageByRegion });

  } catch (e: any) {
    console.log(`GET /admin/reports/regional-stats error: ${e.message}`);
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /admin/reports/acquisition – Weekly acquisition funnel data
app.get("/api/admin/reports/acquisition", requireSuperAdmin, async (c) => {
  try {
    const profiles = await listStoredUserProfiles();
    const now = new Date();

    // Build 8 weekly buckets (last 8 weeks)
    const weeks: { label: string; start: Date; end: Date }[] = [];
    for (let i = 7; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const label = `${start.toISOString().slice(5, 10)}`;
      weeks.push({ label, start, end });
    }

    // Count signups per week and per tier
    const weeklySignups = weeks.map((w) => {
      const inWeek = profiles.filter((p: any) => {
        const created = new Date(p.createdAt || 0);
        return created >= w.start && created <= w.end;
      });
      const tiers: Record<string, number> = {};
      for (const p of inWeek) {
        const tier = String((p as any).tier || "FREE");
        tiers[tier] = (tiers[tier] || 0) + 1;
      }
      return { week: w.label, signups: inWeek.length, tiers };
    });

    // Aggregate totals
    const totalUsers = profiles.length;
    const last7d = profiles.filter((p: any) => {
      const d = new Date(p.createdAt || 0);
      return now.getTime() - d.getTime() < 7 * 86_400_000;
    }).length;
    const prev7d = profiles.filter((p: any) => {
      const d = new Date(p.createdAt || 0);
      const age = now.getTime() - d.getTime();
      return age >= 7 * 86_400_000 && age < 14 * 86_400_000;
    }).length;

    // Tier distribution
    const tierDist: Record<string, number> = {};
    for (const p of profiles) {
      const tier = String((p as any).tier || "FREE");
      tierDist[tier] = (tierDist[tier] || 0) + 1;
    }

    // Contact submissions (leads) from last 30 days
    const contactKeys = await kv.getByPrefix("contact:");
    const recentContacts = (contactKeys as any[]).filter((c: any) => {
      const d = new Date(c.createdAt || 0);
      return now.getTime() - d.getTime() < 30 * 86_400_000;
    }).length;

    // Landing events from telemetry (last 7 days)
    const landingViews: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const day = d.toISOString().slice(0, 10);
      const events = ((await kv.get(`telemetry:${day}`)) as any[]) || [];
      for (const evt of events) {
        if (evt.event === "landing_view" && evt.intent) {
          landingViews[evt.intent] = (landingViews[evt.intent] || 0) + 1;
        }
      }
    }

    return c.json({
      totalUsers,
      signupsLast7d: last7d,
      signupsPrev7d: prev7d,
      weekOverWeekChange: prev7d > 0 ? Math.round(((last7d - prev7d) / prev7d) * 100) : null,
      weeklySignups,
      tierDistribution: tierDist,
      contactLeadsLast30d: recentContacts,
      landingViewsLast7d: landingViews,
    });
  } catch (e: any) {
    console.log(`GET /admin/reports/acquisition error: ${e.message}`);
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /admin/reports/revenue – Revenue & expense report
app.get("/api/admin/reports/revenue", requireSuperAdmin, async (c) => {
  try {
    const roundUsd = (value: number) => Number(value.toFixed(2));
    const roundCost = (value: number) => Number(value.toFixed(4));
    const resolveAmountUsd = (record: any, fields: string[]) => {
      for (const field of fields) {
        const amount = normalizeUsdAmount(record?.[field]);
        if (amount !== null) return amount;
      }
      return 0;
    };
    const resolveMonth = (record: any, fields: string[]) => {
      for (const field of fields) {
        const raw = String(record?.[field] || "").trim();
        if (raw.length >= 7) return raw.slice(0, 7);
      }
      return null;
    };
    const summarizeRevenueRecords = (records: any[], amountFields: string[], monthFields: string[]) => {
      const revenueByMonth: Record<string, number> = {};
      let totalRevenue = 0;

      for (const record of records) {
        const amount = resolveAmountUsd(record, amountFields);
        if (amount <= 0) continue;
        totalRevenue += amount;

        const month = resolveMonth(record, monthFields);
        if (month) {
          revenueByMonth[month] = roundUsd((revenueByMonth[month] || 0) + amount);
        }
      }

      const totalTransactions = records.reduce((count, record) => {
        return resolveAmountUsd(record, amountFields) > 0 ? count + 1 : count;
      }, 0);

      return {
        totalRevenue: roundUsd(totalRevenue),
        totalTransactions,
        revenueByMonth,
        avgTransactionValue: totalTransactions > 0 ? roundUsd(totalRevenue / totalTransactions) : 0,
      };
    };
    const mergeRevenueByMonth = (...sources: Array<Record<string, number>>) => {
      const merged: Record<string, number> = {};
      for (const source of sources) {
        for (const [month, amount] of Object.entries(source || {})) {
          merged[month] = roundUsd((merged[month] || 0) + Number(amount || 0));
        }
      }
      return Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
    };

    const [
      paypalOrders,
      donationOrders,
      subscriptionPaymentEntries,
      plans,
      users,
      costsRaw,
      expensesRaw,
    ] = await Promise.all([
      kv.getByPrefix("paypal:order:"),
      kv.getByPrefix("paypal:donation:order:"),
      kv.getByPrefix("paypal:subscription:payment:"),
      kv.get("admin:plans"),
      kv.get("users_list"),
      kv.get("admin:costs"),
      kv.get("admin:expenses"),
    ]);

    const configuredPlans = ((plans as any[]) || DEFAULT_PLANS) as any[];
    const completedOrders = (((paypalOrders as any[]) || []) as any[]).filter((order) => order?.status === "COMPLETED");
    const completedDonations = (((donationOrders as any[]) || []) as any[]).filter((order) => order?.status === "COMPLETED");
    const completedSubscriptionPayments = (((subscriptionPaymentEntries as any[]) || []) as any[]).filter((entry) => {
      const status = String(entry?.status || "COMPLETED").toUpperCase();
      return status === "COMPLETED";
    });

    const oneTimeRevenue = summarizeRevenueRecords(
      completedOrders,
      ["capturedAmountUsd", "expectedAmountUsd", "price"],
      ["capturedAt", "createdAt"]
    );
    const donationRevenue = summarizeRevenueRecords(
      completedDonations,
      ["capturedAmountUsd", "expectedAmountUsd"],
      ["capturedAt", "createdAt"]
    );
    const subscriptionRevenue = summarizeRevenueRecords(
      completedSubscriptionPayments,
      ["amountUsd", "capturedAmountUsd", "expectedAmountUsd"],
      ["paidAt", "capturedAt", "createdAt"]
    );
    const subscriptionSummary = await getSubscriptionFinanceSummary(configuredPlans);

    const revenueByMonth = mergeRevenueByMonth(
      oneTimeRevenue.revenueByMonth,
      donationRevenue.revenueByMonth,
      subscriptionRevenue.revenueByMonth
    );
    const totalRevenue = roundUsd(
      oneTimeRevenue.totalRevenue + donationRevenue.totalRevenue + subscriptionRevenue.totalRevenue
    );
    const totalTransactions =
      oneTimeRevenue.totalTransactions +
      donationRevenue.totalTransactions +
      subscriptionRevenue.totalTransactions;

    // AI & infra costs — read only from persisted admin config to avoid fake business KPIs.
    const costs = (costsRaw || {}) as any;
    const hasAiCostConfig = Number.isFinite(Number(costs.aiCostPerRun));
    const hasInfraCostConfig = Number.isFinite(Number(costs.monthlyInfrastructure));
    const aiCostPerRun = hasAiCostConfig ? Number(costs.aiCostPerRun) : 0;
    let totalAIRuns = 0;
    let totalAICost = 0;
    const aiSpendByMonth: Record<string, number> = {};
    for (const user of (((users as any[]) || []) as any[])) {
      const userId = String(user?.id || "").trim();
      if (!userId) continue;
      const activityLog = ((await kv.get(`user:${userId}:activity_log`)) || []) as any[];
      for (const entry of activityLog) {
        if (entry?.action !== "ai_spend_tracked") continue;
        totalAIRuns += 1;
        const costUsd = Number(entry?.costUsd || 0);
        if (Number.isFinite(costUsd) && costUsd >= 0) {
          totalAICost += costUsd;
          const month = resolveMonth(entry, ["at"]);
          if (month) {
            aiSpendByMonth[month] = roundCost((aiSpendByMonth[month] || 0) + costUsd);
          }
        }
      }
    }
    totalAICost = roundCost(totalAICost);
    const estimatedConfiguredAICost = roundCost(totalAIRuns * aiCostPerRun);
    const averageTrackedCostPerRun = totalAIRuns > 0 ? roundCost(totalAICost / totalAIRuns) : 0;

    // Infrastructure costs (Railway + services)
    const monthlyInfra = hasInfraCostConfig ? Number(costs.monthlyInfrastructure) : 0;
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Load saved expenses
    const expenses = ((expensesRaw as any[]) || []) as any[];
    const customExpenseTotal = roundUsd(
      expenses.reduce((sum: number, expense: any) => sum + Number(expense?.amount || 0), 0)
    );
    const totalExpenses = roundUsd(totalAICost + monthlyInfra + customExpenseTotal);
    const profit = roundUsd(totalRevenue - totalExpenses);

    return c.json({
      revenue: {
        totalRevenue,
        confirmedRevenue: totalRevenue,
        revenueByMonth,
        totalTransactions,
        avgTransactionValue: totalTransactions > 0 ? roundUsd(totalRevenue / totalTransactions) : 0,
        totalOrders: totalTransactions,
        avgOrderValue: totalTransactions > 0 ? roundUsd(totalRevenue / totalTransactions) : 0,
        oneTime: {
          totalRevenue: oneTimeRevenue.totalRevenue,
          totalOrders: oneTimeRevenue.totalTransactions,
          avgOrderValue: oneTimeRevenue.avgTransactionValue,
          revenueByMonth: oneTimeRevenue.revenueByMonth,
        },
        topUps: {
          totalRevenue: oneTimeRevenue.totalRevenue,
          totalOrders: oneTimeRevenue.totalTransactions,
          avgOrderValue: oneTimeRevenue.avgTransactionValue,
          revenueByMonth: oneTimeRevenue.revenueByMonth,
        },
        donations: {
          totalRevenue: donationRevenue.totalRevenue,
          totalOrders: donationRevenue.totalTransactions,
          avgOrderValue: donationRevenue.avgTransactionValue,
          revenueByMonth: donationRevenue.revenueByMonth,
        },
        subscriptions: {
          ...subscriptionSummary,
          confirmedRevenue: subscriptionRevenue.totalRevenue,
          confirmedPayments: subscriptionRevenue.totalTransactions,
          avgConfirmedPaymentValue: subscriptionRevenue.avgTransactionValue,
          revenueByMonth: subscriptionRevenue.revenueByMonth,
        },
      },
      expenses: {
        aiCosts: {
          totalRuns: totalAIRuns,
          costPerRun: aiCostPerRun,
          configuredCostPerRun: aiCostPerRun,
          trackedSpendUsd: totalAICost,
          averageTrackedCostPerRun,
          estimatedConfiguredCost: estimatedConfiguredAICost,
          totalCost: totalAICost,
          configured: hasAiCostConfig,
          spendByMonth: Object.fromEntries(Object.entries(aiSpendByMonth).sort(([a], [b]) => a.localeCompare(b))),
        },
        infrastructure: {
          monthly: monthlyInfra,
          currentMonth,
          configured: hasInfraCostConfig,
        },
        custom: expenses,
        totalExpenses,
      },
      profit,
    });
  } catch (e: any) {
    console.log(`GET /admin/reports/revenue error: ${e.message}`);
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// POST /admin/expenses – Add a custom expense entry
app.post("/api/admin/expenses", requireSuperAdmin, async (c) => {
  try {

    const body = await c.req.json();
    const { description, amount, category } = body;
    if (!description || !amount) return c.json({ error: "description y amount requeridos" }, 400);

    let expenses = await kv.get("admin:expenses") || [];
    expenses.push({ id: uid(), description, amount, category: category || "general", createdAt: new Date().toISOString() });
    await kv.set("admin:expenses", expenses);

    return c.json({ success: true, expenses });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /admin/alerts – Get spending alerts config
app.get("/api/admin/alerts", requireSuperAdmin, async (c) => {
  try {

    let alerts = await kv.get("admin:alerts") || {
      aiSpendingLimit: 10,
      monthlyBudget: 100,
      userGrowthAlert: 50,
      enabled: true,
      notifications: [],
    };
    return c.json({ alerts });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// PUT /admin/alerts – Update spending alerts
app.put("/api/admin/alerts", requireSuperAdmin, async (c) => {
  try {

    const body = await c.req.json();
    await kv.set("admin:alerts", body);
    return c.json({ success: true, alerts: body });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// POST /admin/email – Send notification (stored as notification log, mock email)
app.post("/api/admin/email", requireSuperAdmin, async (c) => {
  try {
    const userId = c.get('userId') as string;

    const body = await c.req.json();
    const { to, subject, message, recipientType } = body;

    if (!subject || !message) return c.json({ error: "subject y message requeridos" }, 400);

    let recipients: string[] = [];

    if (recipientType === "all") {
      const allProfiles = await kv.getByPrefix("user:");
      recipients = allProfiles.filter((p: any) => p.email).map((p: any) => p.email);
    } else if (recipientType === "tier") {
      const allProfiles = await kv.getByPrefix("user:");
      recipients = allProfiles.filter((p: any) => p.email && p.tier === to).map((p: any) => p.email);
    } else {
      recipients = Array.isArray(to) ? to : [to];
    }

    // Store the email log (in production, integrate with Resend/SendGrid/etc.)
    const emailId = `email_${uid()}`;
    const emailLog = {
      id: emailId,
      from: "admin@vorea.studio",
      to: recipients,
      subject,
      message,
      recipientType: recipientType || "individual",
      sentBy: userId,
      sentAt: new Date().toISOString(),
      status: "queued", // In production: "sent" after actual delivery
      recipientCount: recipients.length,
    };
    await kv.set(`admin:email:${emailId}`, emailLog);

    console.log(`Admin email queued: ${emailId} to ${recipients.length} recipients - "${subject}"`);
    return c.json({ success: true, emailId, recipientCount: recipients.length, note: "Email registrado. Integra con Resend/SendGrid para envio real." });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /admin/emails – List sent emails
app.get("/api/admin/emails", requireSuperAdmin, async (c) => {
  try {

    const emails = await kv.getByPrefix("admin:email:");
    const sorted = (emails || []).sort((a: any, b: any) =>
      new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    );
    return c.json({ emails: sorted });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /admin/logs – Activity logs
app.get("/api/admin/logs", requireSuperAdmin, async (c) => {
  try {

    const logs = await kv.getByPrefix("admin_log:");
    const sorted = (logs || []).sort((a: any, b: any) =>
      new Date(b.at).getTime() - new Date(a.at).getTime()
    );
    return c.json({ logs: sorted.slice(0, 100) });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BYOK VAULT — Securely store user AI provider API keys
// AES-256-GCM encrypted, never logged, tier-gated (PRO+ only)
// ═══════════════════════════════════════════════════════════════════════════════

import { encrypt, decrypt, maskKey, isValidProvider, SUPPORTED_PROVIDERS } from "./crypto.js";

// GET /api/vault/keys – List user's stored API keys (masked)
app.get("/api/vault/keys", requireAuth, async (c) => {
  try {
    const userId = c.get("userId") as string;

    const profile = (await kv.get(`user:${userId}:profile`)) || {};
    const byokGate = await checkToolActionAllowed(userId, profile, "ai_studio", "byok");
    if (!byokGate.allowed) {
      return c.json(
        {
          error: byokGate.error || "BYOK requiere plan PRO o superior",
          upgradeRequired: true,
        },
        (byokGate.status || 403) as ContentfulStatusCode
      );
    }

    const keys = await kv.getByPrefix(`vault:${userId}:`);
    const masked = (keys || []).map((entry: any) => ({
      provider: entry.provider,
      label: entry.label || entry.provider,
      maskedKey: entry.maskedKey || "••••••••",
      lastUsedAt: entry.lastUsedAt,
      createdAt: entry.createdAt,
    }));

    return c.json({ keys: masked, supportedProviders: SUPPORTED_PROVIDERS });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// PUT /api/vault/keys/:provider – Save or update an API key for a provider
app.put("/api/vault/keys/:provider", requireAuth, async (c) => {
  try {
    const userId = c.get("userId") as string;

    const profile = (await kv.get(`user:${userId}:profile`)) || {};
    const byokGate = await checkToolActionAllowed(userId, profile, "ai_studio", "byok");
    if (!byokGate.allowed) {
      return c.json(
        {
          error: byokGate.error || "BYOK requiere plan PRO o superior",
          upgradeRequired: true,
        },
        (byokGate.status || 403) as ContentfulStatusCode
      );
    }

    const provider = c.req.param("provider");
    if (!isValidProvider(provider)) {
      return c.json({ error: `Provider no soportado: ${provider}. Usar: ${SUPPORTED_PROVIDERS.join(", ")}` }, 400);
    }

    const { apiKey, label } = await c.req.json();
    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 8) {
      return c.json({ error: "API key inválida (mínimo 8 caracteres)" }, 400);
    }

    // Encrypt the key
    const encrypted = encrypt(apiKey.trim());

    const vaultEntry = {
      userId,
      provider,
      encryptedKey: encrypted.encryptedData,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      maskedKey: maskKey(apiKey.trim()),
      label: label || provider,
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`vault:${userId}:${provider}`, vaultEntry);
    await auditLog("vault_key_saved", { userId, provider });

    return c.json({
      success: true,
      provider,
      maskedKey: vaultEntry.maskedKey,
      label: vaultEntry.label,
    });
  } catch (e: any) {
    console.error(`PUT /vault/keys error: ${e.message}`);
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// DELETE /api/vault/keys/:provider – Remove a stored API key
app.delete("/api/vault/keys/:provider", requireAuth, async (c) => {
  try {
    const userId = c.get("userId") as string;
    const profile = (await kv.get(`user:${userId}:profile`)) || {};
    const byokGate = await checkToolActionAllowed(userId, profile, "ai_studio", "byok");
    if (!byokGate.allowed) {
      return c.json(
        {
          error: byokGate.error || "BYOK requiere plan PRO o superior",
          upgradeRequired: true,
        },
        (byokGate.status || 403) as ContentfulStatusCode
      );
    }

    const provider = c.req.param("provider");
    await kv.del(`vault:${userId}:${provider}`);
    await auditLog("vault_key_deleted", { userId, provider });

    return c.json({ success: true, provider });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// POST /api/vault/keys/:provider/test – Test if a stored key is valid
app.post("/api/vault/keys/:provider/test", requireAuth, async (c) => {
  try {
    const userId = c.get("userId") as string;
    const ip = getClientIp(c);
    const vaultTestIpLimit = await enforceRateLimit(
      c,
      `vault-key-test:ip:${ip}`,
      20,
      60 * 60 * 1000,
      "Demasiadas pruebas de claves API desde esta IP. Intenta nuevamente en 1 hora."
    );
    if (vaultTestIpLimit) {
      return vaultTestIpLimit;
    }
    const vaultTestUserLimit = await enforceRateLimit(
      c,
      `vault-key-test:user:${userId}`,
      10,
      60 * 60 * 1000,
      "Demasiadas pruebas de claves API para esta cuenta. Intenta nuevamente en 1 hora."
    );
    if (vaultTestUserLimit) {
      return vaultTestUserLimit;
    }
    const profile = (await kv.get(`user:${userId}:profile`)) || {};
    const byokGate = await checkToolActionAllowed(userId, profile, "ai_studio", "byok");
    if (!byokGate.allowed) {
      return c.json(
        {
          error: byokGate.error || "BYOK requiere plan PRO o superior",
          upgradeRequired: true,
        },
        (byokGate.status || 403) as ContentfulStatusCode
      );
    }

    const provider = c.req.param("provider");
    const entry = await kv.get(`vault:${userId}:${provider}`);
    if (!entry) return c.json({ error: "No hay key guardada para este provider" }, 404);

    // Decrypt the key
    const apiKey = decrypt({
      encryptedData: entry.encryptedKey,
      iv: entry.iv,
      authTag: entry.authTag,
    });

    // Test connectivity per provider
    let valid = false;
    let message = "";

    try {
      switch (provider) {
        case "tripo": {
          const res = await fetch("https://api.tripo3d.ai/v2/openapi/task", {
            method: "GET",
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          valid = res.status !== 401 && res.status !== 403;
          message = valid ? "Tripo AI key válida" : "Key inválida o expirada";
          break;
        }
        case "meshy": {
          const res = await fetch("https://api.meshy.ai/openapi/v2/text-to-3d", {
            method: "GET",
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          valid = res.status !== 401 && res.status !== 403;
          message = valid ? "Meshy AI key válida" : "Key inválida o expirada";
          break;
        }
        case "openai": {
          const res = await fetch("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          valid = res.ok;
          message = valid ? "OpenAI key válida" : "Key inválida";
          break;
        }
        case "gemini": {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          valid = res.ok;
          message = valid ? "Gemini key válida" : "Key inválida";
          break;
        }
        default:
          valid = true;
          message = `Key guardada para ${provider} (validación automática no disponible)`;
      }
    } catch (fetchErr: any) {
      message = `Error al conectar con ${provider}: ${fetchErr.message}`;
    }

    // Update lastUsedAt
    entry.lastUsedAt = new Date().toISOString();
    await kv.set(`vault:${userId}:${provider}`, entry);

    return c.json({ valid, message, provider });
  } catch (e: any) {
    console.error(`POST /vault/keys/test error: ${e.message}`);
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});


// Flow: frontend receives credential from Google → sends to POST /api/auth/google
//       server verifies token → creates/finds user → returns JWT
// ═══════════════════════════════════════════════════════════════════════════════

app.post("/api/auth/google", async (c) => {
  try {
    const { credential } = await c.req.json();
    if (!credential) return c.json({ error: "Missing Google credential" }, 400);

    const ip = getClientIp(c);
    const googleAuthRateLimit = await enforceRateLimit(
      c,
      `google-login:${ip}`,
      10,
      5 * 60 * 1000,
      "Demasiados intentos. Intente en 5 minutos."
    );
    if (googleAuthRateLimit) {
      return googleAuthRateLimit;
    }

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    if (!GOOGLE_CLIENT_ID) {
      return c.json({ error: "Google OAuth not configured" }, 503);
    }

    // Verify the Google ID token
    const { OAuth2Client } = await import("google-auth-library");
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);

    let payload: any;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr: any) {
      return c.json({ error: `Token inválido: ${verifyErr.message}` }, 401);
    }

    if (!payload?.email) {
      return c.json({ error: "No email in Google token" }, 400);
    }

    const { email, name, picture, sub: googleId } = payload;

    // Find or create user in auth_users
    let user = await auth.getUserByEmail(email);

    if (!user) {
      // New user — create with a random secure password (they'll use Google to login)
      const { randomBytes } = await import("node:crypto");
      const randomPwd = randomBytes(32).toString("hex");
      const username = `@${email.split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
      
      user = await auth.createUser(email, randomPwd, {
        displayName: name || email.split("@")[0],
        username,
        avatarUrl: picture,
        provider: "google",
        googleId,
      });

      // Create KV profile
      await kv.set(`user:${user.id}:profile`, {
        id: user.id,
        displayName: name || email.split("@")[0],
        username,
        email,
        tier: "FREE",
        role: "user",
        avatarUrl: picture,
        provider: "google",
        createdAt: user.created_at,
      });
      await kv.set(`user:${user.id}:credits`, { freeUsed: 0, purchasedCredits: 0, totalExported: 0 });
    } else {
      // Existing user — merge Google provider into their account
      const mergeUpdates: Record<string, string> = {};
      if (!user.provider?.includes("google")) mergeUpdates.provider = user.provider ? `${user.provider},google` : "google";
      if (!user.google_id) mergeUpdates.google_id = googleId;
      if (picture && !user.avatar_url) mergeUpdates.avatar_url = picture;
      if (Object.keys(mergeUpdates).length > 0) await auth.updateUser(user.id, mergeUpdates);

      // Update KV profile with merged provider info
      const kvMergeProfile = await kv.get(`user:${user.id}:profile`);
      if (kvMergeProfile) {
        if (!kvMergeProfile.provider?.includes("google")) kvMergeProfile.provider = kvMergeProfile.provider ? `${kvMergeProfile.provider},google` : "google";
        if (!kvMergeProfile.avatarUrl && picture) kvMergeProfile.avatarUrl = picture;
        kvMergeProfile.googleId = googleId;
        await kv.set(`user:${user.id}:profile`, kvMergeProfile);
      }
      await userActivityLog(user.id, "oauth_merge", { provider: "google", email });
    }

    // Issue JWT
    const token = auth.signJwt(user.id, user.email, user.role || "user");
    setSessionCookie(c, token);

    const profile = await kv.get(`user:${user.id}:profile`) || {
      id: user.id,
      displayName: user.display_name,
      username: user.username,
      email: user.email,
      tier: user.tier || "FREE",
      role: user.role || "user",
    };

    return c.json({ token, user: { id: user.id, email: user.email }, profile });
  } catch (e: any) {
    console.error("Google OAuth error:", e);
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /api/auth/google/config — Returns Google Client ID for frontend initialization
app.get("/api/auth/google/config", (c) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return c.json({ configured: false });
  return c.json({ configured: true, clientId });
});

// POST /api/auth/signout — clears server-side session cookie used for protected docs
app.post("/api/auth/signout", async (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYPAL — Payment processing for universal top-up packs
// ═══════════════════════════════════════════════════════════════════════════════

const PAYPAL_BASE =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getPaypalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PayPal credentials not configured");

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json() as any;
  if (!data.access_token) throw new Error(`PayPal auth failed: ${data.error_description || JSON.stringify(data)}`);
  return data.access_token;
}

async function getConfiguredCreditPacks(): Promise<CreditPackConfig[]> {
  const configured = await kv.get("admin:credit_packs");
  return sanitizeCreditPacks(configured, DEFAULT_CREDIT_PACKS);
}

async function getDonationProfile(userId: string) {
  const profile = (await kv.get(`user:${userId}:profile`)) || {};
  return {
    displayName: String(profile?.displayName || profile?.username || "Maker").trim(),
    username: String(profile?.username || `@${userId.slice(0, 8)}`).trim(),
    avatarUrl: profile?.avatarUrl ? String(profile.avatarUrl) : null,
  };
}

async function upsertPublicContributorIndex(summary: {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  tierId: string;
  badgeId: string;
  donationCount: number;
  lastDonatedAt: string;
  joinedAt: string;
  message?: string | null;
}) {
  const current = ((await kv.get("contributors:public")) || []) as any[];
  const next = current.filter((entry) => entry?.userId !== summary.userId);
  next.push({
    userId: summary.userId,
    displayName: summary.displayName,
    username: summary.username,
    avatarUrl: summary.avatarUrl,
    tierId: summary.tierId,
    badgeId: summary.badgeId,
    donationCount: Number(summary.donationCount || 0),
    lastDonatedAt: summary.lastDonatedAt,
    joinedAt: summary.joinedAt,
    message: summary.message || null,
  });
  await kv.set("contributors:public", sortPublicContributors(next));
}

async function removePublicContributorIndex(userId: string) {
  const current = ((await kv.get("contributors:public")) || []) as any[];
  await kv.set(
    "contributors:public",
    current.filter((entry) => entry?.userId !== userId)
  );
}

async function syncContributorRewards(userId: string, badgeId: string) {
  const rewards = ((await kv.get(`user:${userId}:rewards`)) || {
    userId,
    points: 0,
    level: "Novice",
    badges: [],
    history: [],
  }) as any;

  rewards.badges = replaceContributorBadge(rewards.badges, badgeId);
  await kv.set(`user:${userId}:rewards`, rewards);
}

async function updateContributorVisibility(userId: string, input: {
  publicContributor: boolean;
  message?: unknown;
}) {
  const existingSummary = await kv.get(`user:${userId}:contributor`) as any;
  if (!existingSummary?.userId) {
    throw new Error("contributor_not_found");
  }

  const profile = await getDonationProfile(userId);
  const updatedAt = new Date().toISOString();
  const publicContributor = Boolean(input.publicContributor);
  const nextMessage = publicContributor
    ? sanitizeDonationMessage(input.message ?? existingSummary.message)
    : null;

  const nextSummary = {
    ...existingSummary,
    userId,
    displayName: profile.displayName,
    username: profile.username,
    avatarUrl: profile.avatarUrl,
    publicContributor,
    message: nextMessage,
    updatedAt,
  };

  await kv.set(`user:${userId}:contributor`, nextSummary);

  if (publicContributor) {
    await upsertPublicContributorIndex({
      userId,
      displayName: nextSummary.displayName,
      username: nextSummary.username,
      avatarUrl: nextSummary.avatarUrl,
      tierId: String(nextSummary.tierId || "impulsor"),
      badgeId: String(nextSummary.badgeId || "contributor_impulsor"),
      donationCount: Number(nextSummary.donationCount || 0),
      lastDonatedAt: String(nextSummary.lastDonatedAt || nextSummary.joinedAt || updatedAt),
      joinedAt: String(nextSummary.joinedAt || updatedAt),
      message: nextMessage,
    });
  } else {
    await removePublicContributorIndex(userId);
  }

  return nextSummary;
}

// GET /api/paypal/client-id — Returns PayPal client ID for frontend SDK
app.get("/api/paypal/client-id", (c) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  if (!clientId) return c.json({ error: "PayPal not configured" }, 503);
  return c.json({ clientId, mode: process.env.PAYPAL_MODE || "sandbox" });
});

// POST /api/paypal/create-order — Creates a PayPal order for a universal top-up pack
app.post("/api/paypal/create-order", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Autenticación requerida" }, 401);
    if (!universalTopUpsEnabled()) {
      return c.json({
        error: "Las recargas one-time de saldo universal están pausadas temporalmente.",
      }, 409);
    }

    const body = await c.req.json().catch(() => ({}));
    const packId = String(body?.packId || "").trim();
    if (!packId) return c.json({ error: "packId es requerido" }, 400);

    const creditPacks = await getConfiguredCreditPacks();
    const pack = findCreditPackById(creditPacks, packId);
    if (!pack) {
      return c.json({ error: "Pack inválido o no disponible" }, 400);
    }

    const providedPrice = body?.price === undefined ? null : normalizeUsdAmount(body.price);
    if (body?.price !== undefined && providedPrice === null) {
      return c.json({ error: "price inválido" }, 400);
    }
    if (providedPrice !== null && !amountsMatchUsd(pack.price, providedPrice)) {
      return c.json({ error: "Monto inválido para el pack seleccionado" }, 400);
    }

    const accessToken = await getPaypalAccessToken();

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `vorea-${pack.id}-${userId}-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: pack.id,
            description: `Vorea Studio - Recarga ${pack.name}`,
            amount: {
              currency_code: "USD",
              value: pack.price.toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: "Vorea Studio",
          locale: "es-AR",
          landing_page: "BILLING",
          user_action: "PAY_NOW",
          return_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/perfil?credits=success`,
          cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/perfil?credits=cancelled`,
        },
      }),
    });

    const order = await orderRes.json() as any;
    if (!orderRes.ok || !order?.id) {
      console.error("PayPal create order error:", order);
      return c.json({ error: order.message || "Error al crear orden PayPal" }, 500);
    }

    // Cache order for later capture
    await kv.set(`paypal:order:${order.id}`, {
      orderId: order.id,
      userId,
      orderType: "tool_credit_topup",
      packId: pack.id,
      packName: pack.name,
      credits: pack.credits,
      expectedAmountUsd: pack.price,
      expectedCurrency: "USD",
      status: "CREATED",
      createdAt: new Date().toISOString(),
    });

    // Extract approval link for redirect
    const approveLink = order.links?.find((l: any) => l.rel === "approve");

    return c.json({ orderId: order.id, status: order.status, packId: pack.id, approveUrl: approveLink?.href || null });
  } catch (e: any) {
    console.error("PayPal create-order error:", e);
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// POST /api/paypal/capture-order — Captures a PayPal order after user approval
app.post("/api/paypal/capture-order", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Autenticación requerida" }, 401);

    const body = await c.req.json().catch(() => ({}));
    const orderId = String(body?.orderId || "").trim();
    const packId = String(body?.packId || "").trim();
    if (!orderId) return c.json({ error: "orderId requerido" }, 400);

    // Verify the order belongs to this user
    const storedOrder = await kv.get(`paypal:order:${orderId}`) as any;
    if (!storedOrder) return c.json({ error: "Orden no encontrada" }, 404);
    if (storedOrder.userId !== userId) return c.json({ error: "Orden no pertenece a este usuario" }, 403);
    if (packId && storedOrder.packId && packId !== storedOrder.packId) {
      return c.json({ error: "Pack no coincide con la orden creada" }, 400);
    }
    if (storedOrder.status === "COMPLETED") {
      const profile = await kv.get(`user:${userId}:profile`) || {};
      const toolCredits = await kv.get("admin:tool_credits") || DEFAULT_TOOL_CREDITS;
      const currentCredits = await getUserToolCreditsState(userId, profile, toolCredits);
      return c.json({
        success: true,
        alreadyProcessed: true,
        credits: 0,
        creditsAdded: 0,
        totalCredits: currentCredits.balance,
        toolCredits: serializeToolCreditsState(currentCredits),
        creditState: serializeToolCreditsState(currentCredits),
        message: "Orden ya procesada previamente.",
      });
    }
    if (storedOrder.status === "CAPTURING") {
      return c.json({ error: "Orden en procesamiento, reintenta en unos segundos." }, 409);
    }

    storedOrder.status = "CAPTURING";
    storedOrder.captureAttemptedAt = new Date().toISOString();
    await kv.set(`paypal:order:${orderId}`, storedOrder);

    const accessToken = await getPaypalAccessToken();
    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    let capture: any = null;
    try {
      capture = await captureRes.json() as any;
    } catch {
      capture = null;
    }

    if (!captureRes.ok || capture?.status !== "COMPLETED") {
      console.error("PayPal capture error:", capture);
      storedOrder.status = "FAILED";
      storedOrder.failedAt = new Date().toISOString();
      storedOrder.failureReason = capture?.message || `HTTP_${captureRes.status}`;
      await kv.set(`paypal:order:${orderId}`, storedOrder);
      return c.json({ error: `Error al capturar pago: ${capture?.message || "No completado"}` }, 500);
    }

    const paymentInfo = extractCapturePaymentInfo(capture);
    const expectedAmountUsd = normalizeUsdAmount(storedOrder.expectedAmountUsd);
    const expectedCurrency = String(storedOrder.expectedCurrency || "USD").toUpperCase();

    if (
      paymentInfo.amount === null ||
      expectedAmountUsd === null ||
      paymentInfo.currency !== expectedCurrency ||
      !amountsMatchUsd(expectedAmountUsd, paymentInfo.amount)
    ) {
      storedOrder.status = "FAILED";
      storedOrder.failedAt = new Date().toISOString();
      storedOrder.failureReason = "amount_or_currency_mismatch";
      storedOrder.capturedAmountUsd = paymentInfo.amount;
      storedOrder.capturedCurrency = paymentInfo.currency;
      storedOrder.captureId = paymentInfo.captureId;
      await kv.set(`paypal:order:${orderId}`, storedOrder);
      return c.json({ error: "Validación de pago rechazada (monto/moneda inválidos)." }, 400);
    }

    let creditsToAdd = Number(storedOrder.credits);
    if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
      const creditPacks = await getConfiguredCreditPacks();
      creditsToAdd = findCreditPackById(creditPacks, storedOrder.packId || packId)?.credits || 0;
    }
    creditsToAdd = Math.trunc(creditsToAdd);
    if (creditsToAdd <= 0) {
      storedOrder.status = "FAILED";
      storedOrder.failedAt = new Date().toISOString();
      storedOrder.failureReason = "invalid_pack_credits";
      await kv.set(`paypal:order:${orderId}`, storedOrder);
      return c.json({ error: "No se pudo determinar la cantidad de créditos para este pack" }, 500);
    }

    const profile = await kv.get(`user:${userId}:profile`) || {};
    const toolCreditState = await addToolCreditTopUp(userId, profile, creditsToAdd, {
      source: "paypal_topup",
      orderId,
      packId: storedOrder.packId,
      captureId: paymentInfo.captureId,
      amountUsd: paymentInfo.amount,
      currency: paymentInfo.currency,
    });

    // Mark order complete
    storedOrder.status = "COMPLETED";
    storedOrder.capturedAt = new Date().toISOString();
    storedOrder.capturedAmountUsd = paymentInfo.amount;
    storedOrder.capturedCurrency = paymentInfo.currency;
    storedOrder.captureId = paymentInfo.captureId;
    await kv.set(`paypal:order:${orderId}`, storedOrder);

    // Log
    await kv.set(`admin_log:paypal:${orderId}`, {
      at: new Date().toISOString(),
      type: "paypal_topup_capture",
      userId,
      packId: storedOrder.packId,
      credits: creditsToAdd,
      amount: paymentInfo.amount,
      currency: paymentInfo.currency,
      captureId: paymentInfo.captureId,
    });
    await auditLog("paypal_topup_capture", {
      userId,
      orderId,
      packId: storedOrder.packId,
      credits: creditsToAdd,
      amount: paymentInfo.amount,
      currency: paymentInfo.currency,
      captureId: paymentInfo.captureId,
    });

    // Send purchase confirmation email (best-effort, fire-and-forget)
    const buyerProfile = (await kv.get(`user:${userId}:profile`)) as any;
    const buyerEmail = buyerProfile?.email;
    if (buyerEmail) {
      sendResendEmailBestEffort({
        to: buyerEmail,
        subject: "Confirmación de compra - Vorea Studio",
        logLabel: "purchase confirmation",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px; background-color: #f9f9f9;">
            <h2 style="color: #333; text-align: center;">Vorea Studio</h2>
            <p style="color: #555; font-size: 16px;">¡Gracias por tu compra!</p>
            <div style="background: #e0e7ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0; color: #333;"><strong>Créditos añadidos:</strong> ${creditsToAdd}</p>
              <p style="margin: 5px 0; color: #333;"><strong>Saldo total:</strong> ${toolCreditState.balance}</p>
              <p style="margin: 5px 0; color: #333;"><strong>Monto:</strong> $${paymentInfo.amount} ${paymentInfo.currency}</p>
              <p style="margin: 5px 0; color: #333;"><strong>Orden:</strong> ${orderId}</p>
            </div>
            <p style="color: #555; font-size: 14px;">Tus créditos ya están disponibles en tu cuenta. ¡Comienza a crear!</p>
          </div>
        `,
      }).catch(() => {}); // fire-and-forget
    }

    return c.json({
      success: true,
      credits: creditsToAdd,
      creditsAdded: creditsToAdd,
      totalCredits: toolCreditState.balance,
      toolCredits: serializeToolCreditsState(toolCreditState),
      creditState: serializeToolCreditsState(toolCreditState),
      message: `¡${creditsToAdd} créditos de saldo universal agregados exitosamente!`,
    });
  } catch (e: any) {
    console.error("PayPal capture-order error:", e);
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /api/admin/donations — Superadmin donation ledger + contributor moderation view
app.get("/api/admin/donations", requireSuperAdmin, async (c) => {
  try {

    const q = String(c.req.query("q") || "").trim().toLowerCase();
    const statusFilter = String(c.req.query("status") || "all").trim().toUpperCase();
    const limit = Math.max(1, Math.min(200, Number(c.req.query("limit") || 50) || 50));

    const rawOrders = (((await kv.getByPrefix("paypal:donation:order:")) || []) as any[]).filter(
      (entry) => entry?.orderId && entry?.userId
    );
    const donationEntries = (((await kv.getByPrefix("donation:entry:")) || []) as any[]).filter(
      (entry) => entry?.id && entry?.userId
    );

    const donationEntriesById = new Map(
      donationEntries.map((entry) => [String(entry.id), entry] as const)
    );
    const donationEntriesByOrderId = new Map(
      donationEntries
        .filter((entry) => entry?.orderId)
        .map((entry) => [String(entry.orderId), entry] as const)
    );

    const userIds = Array.from(
      new Set(rawOrders.map((entry) => String(entry.userId || "")).filter(Boolean))
    );

    const profileEntries = await Promise.all(
      userIds.map(async (userId) => [userId, await getDonationProfile(userId)] as const)
    );
    const contributorEntries = await Promise.all(
      userIds.map(async (userId) => [userId, await kv.get(`user:${userId}:contributor`)] as const)
    );

    const profileByUserId = new Map(profileEntries);
    const contributorByUserId = new Map(contributorEntries);

    const donations = rawOrders
      .map((order) => {
        const userId = String(order.userId || "");
        const entry =
          (order.donationId ? donationEntriesById.get(String(order.donationId)) : null) ||
          donationEntriesByOrderId.get(String(order.orderId || "")) ||
          null;
        const profile = profileByUserId.get(userId) || {
          displayName: "Maker",
          username: `@${userId.slice(0, 8)}`,
          avatarUrl: null,
        };
        const contributor = contributorByUserId.get(userId) as any;
        const createdAt = String(order.createdAt || entry?.createdAt || new Date().toISOString());
        const completedAt =
          order.capturedAt || entry?.completedAt ? String(order.capturedAt || entry?.completedAt) : null;
        const status = String(order.status || entry?.status || "CREATED").toUpperCase();
        const amountUsd =
          normalizeUsdAmount(entry?.amountUsd) ??
          normalizeUsdAmount(order.capturedAmountUsd) ??
          normalizeUsdAmount(order.expectedAmountUsd);

        return {
          orderId: String(order.orderId),
          donationId: order.donationId ? String(order.donationId) : entry?.id ? String(entry.id) : null,
          userId,
          displayName: String(profile.displayName || "Maker"),
          username: String(profile.username || `@${userId.slice(0, 8)}`),
          avatarUrl: profile.avatarUrl ? String(profile.avatarUrl) : null,
          tierId: String(order.tierId || entry?.tierId || "impulsor"),
          awardedTierId: String(entry?.awardedTierId || contributor?.tierId || order.tierId || "impulsor"),
          badgeId: String(contributor?.badgeId || "contributor_impulsor"),
          amountUsd,
          currency: String(entry?.currency || order.capturedCurrency || order.expectedCurrency || "USD"),
          status,
          visibility: String(entry?.visibility || order.visibility || "anonymous"),
          publicContributor: Boolean(contributor?.publicContributor),
          currentMessage: contributor?.message ? String(contributor.message).slice(0, 240) : null,
          createdAt,
          completedAt,
          lastDonatedAt: contributor?.lastDonatedAt
            ? String(contributor.lastDonatedAt)
            : completedAt || createdAt,
          captureId: order.captureId ? String(order.captureId) : entry?.captureId ? String(entry.captureId) : null,
        };
      })
      .filter((entry) => {
        if (statusFilter !== "ALL" && entry.status !== statusFilter) return false;
        if (!q) return true;
        const haystack = [
          entry.orderId,
          entry.donationId || "",
          entry.userId,
          entry.displayName,
          entry.username,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((left, right) => {
        const rightTime = new Date(right.completedAt || right.createdAt).getTime();
        const leftTime = new Date(left.completedAt || left.createdAt).getTime();
        return rightTime - leftTime;
      })
      .slice(0, limit);

    const contributors = sortPublicContributors(
      userIds
        .map((userId) => {
          const summary = contributorByUserId.get(userId) as any;
          if (!summary?.userId) return null;
          const profile = profileByUserId.get(userId) || {
            displayName: "Maker",
            username: `@${userId.slice(0, 8)}`,
            avatarUrl: null,
          };
          return {
            userId,
            displayName: String(summary.displayName || profile.displayName || "Maker"),
            username: String(summary.username || profile.username || `@${userId.slice(0, 8)}`),
            avatarUrl: summary.avatarUrl ? String(summary.avatarUrl) : profile.avatarUrl ? String(profile.avatarUrl) : null,
            totalDonatedUsd: Number(summary.totalDonatedUsd || 0),
            donationCount: Number(summary.donationCount || 0),
            tierId: String(summary.tierId || "impulsor"),
            badgeId: String(summary.badgeId || "contributor_impulsor"),
            publicContributor: Boolean(summary.publicContributor),
            lastDonatedAt: String(summary.lastDonatedAt || summary.joinedAt || new Date().toISOString()),
            joinedAt: String(summary.joinedAt || summary.lastDonatedAt || new Date().toISOString()),
            message: summary.message ? String(summary.message).slice(0, 240) : null,
          };
        })
        .filter(Boolean) as any[]
    );

    return c.json({
      donations,
      contributors,
      stats: {
        totalOrders: rawOrders.length,
        completedOrders: rawOrders.filter((entry) => String(entry.status || "").toUpperCase() === "COMPLETED").length,
        failedOrders: rawOrders.filter((entry) => String(entry.status || "").toUpperCase() === "FAILED").length,
        publicContributors: contributors.filter((entry) => entry.publicContributor).length,
        uniqueContributors: contributors.length,
        totalCapturedUsd: rawOrders.reduce((sum, entry) => {
          const amount = normalizeUsdAmount(entry.capturedAmountUsd) ?? 0;
          return sum + amount;
        }, 0),
      },
    });
  } catch (e: any) {
    return c.json({ error: e.message || "Error al cargar donaciones administrativas" }, 500);
  }
});

// PUT /api/admin/contributors/:userId — Superadmin moderation for contributor visibility/message
app.put("/api/admin/contributors/:userId", requireSuperAdmin, async (c) => {
  try {
    const adminId = c.get('userId') as string;

    const targetUserId = String(c.req.param("userId") || "").trim();
    if (!targetUserId) return c.json({ error: "userId requerido" }, 400);

    const body = await c.req.json().catch(() => ({}));
    if (typeof body?.publicContributor !== "boolean" && body?.message === undefined) {
      return c.json({ error: "No hay cambios para aplicar" }, 400);
    }

    const current = await kv.get(`user:${targetUserId}:contributor`) as any;
    if (!current?.userId) return c.json({ error: "Colaborador no encontrado" }, 404);

    const nextSummary = await updateContributorVisibility(targetUserId, {
      publicContributor:
        typeof body?.publicContributor === "boolean"
          ? body.publicContributor
          : Boolean(current.publicContributor),
      message: body?.message,
    });

    await auditLog("contributor_visibility_updated", {
      targetUserId,
      updatedBy: adminId,
      publicContributor: Boolean(nextSummary.publicContributor),
    });

    return c.json({ summary: nextSummary });
  } catch (e: any) {
    const status = e?.message === "contributor_not_found" ? 404 : 500;
    return c.json({ error: e.message || "Error al actualizar colaborador" }, status);
  }
});

// GET /api/contributors — Public contributor wall (no exact amounts)
app.get("/api/contributors", async (c) => {
  try {
    const contributors = sortPublicContributors(
      (((await kv.get("contributors:public")) || []) as any[])
        .filter((entry) => entry?.userId)
        .map((entry) => ({
          userId: String(entry.userId),
          displayName: String(entry.displayName || "Maker"),
          username: String(entry.username || "@maker"),
          avatarUrl: entry.avatarUrl ? String(entry.avatarUrl) : null,
          tierId: String(entry.tierId || "impulsor"),
          badgeId: String(entry.badgeId || "contributor_impulsor"),
          donationCount: Math.max(1, Number(entry.donationCount || 1)),
          lastDonatedAt: String(entry.lastDonatedAt || entry.joinedAt || new Date().toISOString()),
          joinedAt: String(entry.joinedAt || entry.lastDonatedAt || new Date().toISOString()),
          message: entry.message ? String(entry.message).slice(0, 240) : null,
        }))
    );

    return c.json({
      tiers: getPublicDonationTiers(),
      contributors,
      stats: {
        publicContributors: contributors.length,
      },
    });
  } catch (e: any) {
    return c.json({ error: e.message || "Error al cargar colaboradores" }, 500);
  }
});

// GET /api/donations/me — Authenticated donation summary
app.get("/api/donations/me", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "No autorizado" }, 401);

    const summary = (await kv.get(`user:${userId}:contributor`)) || null;
    const donations = ((await kv.get(`user:${userId}:donations`)) || []) as any[];

    return c.json({
      tiers: getPublicDonationTiers(),
      summary,
      donations: donations.slice(0, 20),
    });
  } catch (e: any) {
    return c.json({ error: e.message || "Error al cargar donaciones" }, 500);
  }
});

// PUT /api/donations/me — Authenticated contributor visibility/message management
app.put("/api/donations/me", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "No autorizado" }, 401);

    const body = await c.req.json().catch(() => ({}));
    if (typeof body?.publicContributor !== "boolean" && body?.message === undefined) {
      return c.json({ error: "No hay cambios para aplicar" }, 400);
    }

    const current = await kv.get(`user:${userId}:contributor`) as any;
    if (!current?.userId) return c.json({ error: "Colaborador no encontrado" }, 404);

    const nextSummary = await updateContributorVisibility(userId, {
      publicContributor:
        typeof body?.publicContributor === "boolean"
          ? body.publicContributor
          : Boolean(current.publicContributor),
      message: body?.message,
    });

    await userActivityLog(userId, "contributor_visibility_updated", {
      publicContributor: Boolean(nextSummary.publicContributor),
    });
    await auditLog("donation_visibility_self_update", {
      userId,
      publicContributor: Boolean(nextSummary.publicContributor),
    });

    return c.json({ summary: nextSummary });
  } catch (e: any) {
    const status = e?.message === "contributor_not_found" ? 404 : 500;
    return c.json({ error: e.message || "Error al actualizar reconocimiento" }, status);
  }
});

// POST /api/donations/create-order — Creates a PayPal order for a donation tier
app.post("/api/donations/create-order", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Autenticación requerida" }, 401);

    const body = await c.req.json().catch(() => ({}));
    const tierId = String(body?.tierId || "").trim().toLowerCase();
    const tier = getDonationTier(tierId);
    if (!tier) {
      return c.json({ error: "Nivel de aporte inválido" }, 400);
    }

    const visibility: DonationVisibility = body?.isPublic ? "public" : "anonymous";
    const message = visibility === "public" ? sanitizeDonationMessage(body?.message) : null;
    const accessToken = await getPaypalAccessToken();

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `vorea-donation-${tier.id}-${userId}-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: `donation_${tier.id}`,
            custom_id: userId,
            description: `Vorea Studio - Aporte ${tier.id}`,
            amount: {
              currency_code: "USD",
              value: tier.suggestedAmountUsd.toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: "Vorea Studio",
          locale: "es-UY",
          landing_page: "BILLING",
          user_action: "PAY_NOW",
          return_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/colaboradores?donation=success`,
          cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/colaboradores?donation=cancelled`,
        },
      }),
    });

    const order = await orderRes.json() as any;
    if (!orderRes.ok || !order?.id) {
      console.error("PayPal create donation order error:", order);
      return c.json({ error: order?.message || "Error al crear la orden de donación" }, 500);
    }

    await kv.set(`paypal:donation:order:${order.id}`, {
      orderId: order.id,
      userId,
      tierId: tier.id,
      visibility,
      message,
      expectedAmountUsd: tier.suggestedAmountUsd,
      expectedCurrency: "USD",
      status: "CREATED",
      createdAt: new Date().toISOString(),
    });

    const approveLink = order.links?.find((link: any) => link.rel === "approve");
    return c.json({
      orderId: order.id,
      status: order.status,
      tierId: tier.id,
      amountUsd: tier.suggestedAmountUsd,
      visibility,
      approveUrl: approveLink?.href || null,
    });
  } catch (e: any) {
    console.error("PayPal donation create-order error:", e);
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// POST /api/donations/capture-order — Captures a PayPal donation order
app.post("/api/donations/capture-order", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Autenticación requerida" }, 401);

    const body = await c.req.json().catch(() => ({}));
    const orderId = String(body?.orderId || "").trim();
    if (!orderId) return c.json({ error: "orderId requerido" }, 400);

    const storedOrder = await kv.get(`paypal:donation:order:${orderId}`) as any;
    if (!storedOrder) return c.json({ error: "Orden no encontrada" }, 404);
    if (storedOrder.userId !== userId) return c.json({ error: "Orden no pertenece a este usuario" }, 403);
    if (storedOrder.status === "COMPLETED") {
      const summary = (await kv.get(`user:${userId}:contributor`)) || null;
      return c.json({
        success: true,
        alreadyProcessed: true,
        donationId: storedOrder.donationId || null,
        tierId: summary?.tierId || storedOrder.tierId,
        badgeId: summary?.badgeId || null,
        totalDonatedUsd: Number(summary?.totalDonatedUsd || 0),
        publicContributor: Boolean(summary?.publicContributor),
      });
    }
    if (storedOrder.status === "CAPTURING") {
      return c.json({ error: "Orden en procesamiento, reintenta en unos segundos." }, 409);
    }

    storedOrder.status = "CAPTURING";
    storedOrder.captureAttemptedAt = new Date().toISOString();
    await kv.set(`paypal:donation:order:${orderId}`, storedOrder);

    const accessToken = await getPaypalAccessToken();
    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    let capture: any = null;
    try {
      capture = await captureRes.json() as any;
    } catch {
      capture = null;
    }

    if (!captureRes.ok || capture?.status !== "COMPLETED") {
      console.error("PayPal donation capture error:", capture);
      storedOrder.status = "FAILED";
      storedOrder.failedAt = new Date().toISOString();
      storedOrder.failureReason = capture?.message || `HTTP_${captureRes.status}`;
      await kv.set(`paypal:donation:order:${orderId}`, storedOrder);
      return c.json({ error: `Error al capturar aporte: ${capture?.message || "No completado"}` }, 500);
    }

    const paymentInfo = extractCapturePaymentInfo(capture);
    const expectedAmountUsd = normalizeUsdAmount(storedOrder.expectedAmountUsd);
    const expectedCurrency = String(storedOrder.expectedCurrency || "USD").toUpperCase();

    if (
      paymentInfo.amount === null ||
      expectedAmountUsd === null ||
      paymentInfo.currency !== expectedCurrency ||
      !amountsMatchUsd(expectedAmountUsd, paymentInfo.amount)
    ) {
      storedOrder.status = "FAILED";
      storedOrder.failedAt = new Date().toISOString();
      storedOrder.failureReason = "amount_or_currency_mismatch";
      storedOrder.capturedAmountUsd = paymentInfo.amount;
      storedOrder.capturedCurrency = paymentInfo.currency;
      storedOrder.captureId = paymentInfo.captureId;
      await kv.set(`paypal:donation:order:${orderId}`, storedOrder);
      return c.json({ error: "Validación de aporte rechazada (monto/moneda inválidos)." }, 400);
    }

    const completedAt = new Date().toISOString();
    const existingSummary = ((await kv.get(`user:${userId}:contributor`)) || {
      userId,
      totalDonatedUsd: 0,
      donationCount: 0,
      publicContributor: false,
      joinedAt: completedAt,
      message: null,
    }) as any;
    const totalDonatedUsd = Number(existingSummary.totalDonatedUsd || 0) + expectedAmountUsd;
    const donationCount = Number(existingSummary.donationCount || 0) + 1;
    const resolvedTier = resolveContributorTier(totalDonatedUsd);
    const donationId = storedOrder.donationId || `don_${uid()}`;
    const visibility = storedOrder.visibility === "public" ? "public" : "anonymous";
    const publicContributor = Boolean(existingSummary.publicContributor || visibility === "public");
    const profile = await getDonationProfile(userId);
    const latestMessage =
      publicContributor && visibility === "public"
        ? sanitizeDonationMessage(storedOrder.message)
        : existingSummary.message || null;

    const donationEntry = {
      id: donationId,
      userId,
      orderId,
      captureId: paymentInfo.captureId,
      amountUsd: expectedAmountUsd,
      currency: expectedCurrency,
      tierId: storedOrder.tierId,
      awardedTierId: resolvedTier.id,
      visibility,
      message: visibility === "public" ? sanitizeDonationMessage(storedOrder.message) : null,
      createdAt: storedOrder.createdAt || completedAt,
      completedAt,
      status: "COMPLETED",
    };
    await kv.set(`donation:entry:${donationId}`, donationEntry);

    const userDonations = (((await kv.get(`user:${userId}:donations`)) || []) as any[]).filter(Boolean);
    userDonations.unshift({
      id: donationId,
      orderId,
      amountUsd: expectedAmountUsd,
      currency: expectedCurrency,
      tierId: storedOrder.tierId,
      awardedTierId: resolvedTier.id,
      visibility,
      createdAt: storedOrder.createdAt || completedAt,
      completedAt,
      status: "COMPLETED",
    });
    if (userDonations.length > 50) userDonations.length = 50;
    await kv.set(`user:${userId}:donations`, userDonations);

    const contributorSummary = {
      userId,
      displayName: profile.displayName,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      totalDonatedUsd,
      donationCount,
      tierId: resolvedTier.id,
      badgeId: resolvedTier.badgeId,
      publicContributor,
      lastDonatedAt: completedAt,
      joinedAt: existingSummary.joinedAt || completedAt,
      message: latestMessage,
      updatedAt: completedAt,
    };
    await kv.set(`user:${userId}:contributor`, contributorSummary);

    if (publicContributor) {
      await upsertPublicContributorIndex({
        userId,
        displayName: profile.displayName,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
        tierId: resolvedTier.id,
        badgeId: resolvedTier.badgeId,
        donationCount,
        lastDonatedAt: completedAt,
        joinedAt: contributorSummary.joinedAt,
        message: latestMessage,
      });
    } else {
      await removePublicContributorIndex(userId);
    }

    await syncContributorRewards(userId, resolvedTier.badgeId);
    await userActivityLog(userId, "donation_completed", {
      donationId,
      amountUsd: expectedAmountUsd,
      tierId: storedOrder.tierId,
      awardedTierId: resolvedTier.id,
      visibility,
    });
    await auditLog("donation_capture", {
      userId,
      donationId,
      orderId,
      amountUsd: expectedAmountUsd,
      currency: expectedCurrency,
      tierId: storedOrder.tierId,
      awardedTierId: resolvedTier.id,
      visibility,
      captureId: paymentInfo.captureId,
    });

    storedOrder.status = "COMPLETED";
    storedOrder.capturedAt = completedAt;
    storedOrder.capturedAmountUsd = paymentInfo.amount;
    storedOrder.capturedCurrency = paymentInfo.currency;
    storedOrder.captureId = paymentInfo.captureId;
    storedOrder.donationId = donationId;
    await kv.set(`paypal:donation:order:${orderId}`, storedOrder);

    return c.json({
      success: true,
      donationId,
      tierId: resolvedTier.id,
      badgeId: resolvedTier.badgeId,
      totalDonatedUsd,
      publicContributor,
      message: "Gracias por apoyar la evolución de Vorea Studio.",
    });
  } catch (e: any) {
    console.error("PayPal donation capture-order error:", e);
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});
// ═══════════════════════════════════════════════════════════════════════════════
// THUMBNAIL UPLOAD
// ═══════════════════════════════════════════════════════════════════════════════

const IMAGE_DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/;
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

function normalizeImageDataUrl(input: unknown): { dataUrl: string; mimeType: string; byteLength: number } | null {
  if (typeof input !== "string" || input.trim().length === 0) {
    return null;
  }
  const dataUrl = input.startsWith("data:") ? input : `data:image/webp;base64,${input}`;
  const match = dataUrl.match(IMAGE_DATA_URL_RE);
  if (!match) return null;
  const mimeType = String(match[1] || "").toLowerCase();
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) return null;
  let byteLength = 0;
  try {
    byteLength = Buffer.from(match[2], "base64").byteLength;
  } catch {
    return null;
  }
  return { dataUrl, mimeType, byteLength };
}

async function getTierImageLimitBytes(profile: any): Promise<number> {
  const tier = normalizeTierName(profile?.tier);
  const tierKey = toTierLimitKey(tier);
  const imageLimits = (await kv.get("admin:image_limits")) || DEFAULT_IMAGE_LIMITS;
  const maxBytes = Number((imageLimits as any)?.[tierKey]?.maxBytes || DEFAULT_IMAGE_LIMITS[tierKey].maxBytes);
  return Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : DEFAULT_IMAGE_LIMITS[tierKey].maxBytes;
}

function imageResponseFromDataUrl(data: string): Response | null {
  const match = String(data || "").match(IMAGE_DATA_URL_RE);
  if (!match) return null;
  const [, mimeType, b64] = match;
  const buffer = Buffer.from(b64, "base64");
  return new Response(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

app.post("/api/uploads/thumbnail", async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);
  const ip = getClientIp(c);
  const thumbnailIpLimit = await enforceRateLimit(
    c,
    `upload-thumbnail:ip:${ip}`,
    30,
    10 * 60 * 1000,
    "Demasiadas subidas de thumbnails. Intenta nuevamente en unos minutos."
  );
  if (thumbnailIpLimit) return thumbnailIpLimit;
  const thumbnailUserLimit = await enforceRateLimit(
    c,
    `upload-thumbnail:user:${userId}`,
    15,
    10 * 60 * 1000,
    "Demasiadas subidas de thumbnails para esta cuenta. Intenta nuevamente en unos minutos."
  );
  if (thumbnailUserLimit) return thumbnailUserLimit;
  const body = await c.req.json().catch(() => null);
  const image = normalizeImageDataUrl(body?.data);
  if (!image) return c.json({ error: "Falta data (base64) o formato inválido" }, 400);

  // Limit size (~2MB in base64 envelope)
  if (image.dataUrl.length > 2_800_000) {
    return c.json({ error: "Thumbnail demasiado grande (max 2MB)" }, 400);
  }

  const profile = (await kv.get(`user:${userId}:profile`)) || {};
  let reliefActionId: "upload_small" | "upload_medium" | "upload_large" = "upload_small";
  if (image.dataUrl.length > 1_200_000) reliefActionId = "upload_large";
  else if (image.dataUrl.length > 500_000) reliefActionId = "upload_medium";

  const reliefGate = await checkToolActionAllowed(userId, profile, "relief", reliefActionId);
  if (!reliefGate.allowed) {
    return c.json({ error: reliefGate.error || "Acción no permitida" }, (reliefGate.status || 403) as ContentfulStatusCode);
  }

  const thumbId = `thumb_${uid()}`;
  await kv.set(`thumbnail:${thumbId}`, image.dataUrl);
  await consumeToolActionUsage(userId, profile, reliefGate);
  await userActivityLog(userId, "relief_thumbnail_uploaded", {
    thumbId,
    actionId: reliefActionId,
    mimeType: image.mimeType,
    bytes: image.byteLength,
  });

  return c.json({ thumbnailId: thumbId, url: `/api/uploads/thumbnail/${thumbId}` });
});

// POST /api/uploads/community-image - Upload user images for model galleries
app.post("/api/uploads/community-image", async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);
  const ip = getClientIp(c);
  const communityImageIpLimit = await enforceRateLimit(
    c,
    `upload-community-image:ip:${ip}`,
    30,
    10 * 60 * 1000,
    "Demasiadas subidas de imágenes. Intenta nuevamente en unos minutos."
  );
  if (communityImageIpLimit) return communityImageIpLimit;
  const communityImageUserLimit = await enforceRateLimit(
    c,
    `upload-community-image:user:${userId}`,
    20,
    10 * 60 * 1000,
    "Demasiadas subidas de imágenes para esta cuenta. Intenta nuevamente en unos minutos."
  );
  if (communityImageUserLimit) return communityImageUserLimit;

  const body = await c.req.json().catch(() => null);
  const image = normalizeImageDataUrl(body?.data);
  if (!image) return c.json({ error: "Falta data (base64) o formato inválido" }, 400);

  const profile = (await kv.get(`user:${userId}:profile`)) || {};
  const maxBytes = await getTierImageLimitBytes(profile);
  if (image.byteLength > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(1);
    return c.json({ error: `Imagen demasiado grande para tu plan (máx ${maxMb} MB)` }, 400);
  }

  const imageId = `img_${uid()}`;
  await kv.set(`community:image:${imageId}`, image.dataUrl);
  await userActivityLog(userId, "community_image_uploaded", {
    imageId,
    mimeType: image.mimeType,
    bytes: image.byteLength,
  });

  return c.json({
    imageId,
    url: `/api/uploads/community-image/${imageId}`,
    mimeType: image.mimeType,
    bytes: image.byteLength,
  });
});

app.get("/api/uploads/thumbnail/:id", async (c) => {
  const thumbId = c.req.param("id");
  const data = await kv.get(`thumbnail:${thumbId}`);
  if (!data || typeof data !== "string") return c.json({ error: "Not found" }, 404);
  const response = imageResponseFromDataUrl(data);
  if (!response) return c.json({ error: "Invalid format" }, 500);
  return response;
});

app.get("/api/uploads/community-image/:id", async (c) => {
  const imageId = c.req.param("id");
  const data = await kv.get(`community:image:${imageId}`);
  if (!data || typeof data !== "string") return c.json({ error: "Not found" }, 404);
  const response = imageResponseFromDataUrl(data);
  if (!response) return c.json({ error: "Invalid format" }, 500);
  return response;
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Reward constants ─────────────────────────────────────────────────────────

const REWARD_POINTS: Record<string, number> = {
  MODEL_PUBLISHED: 50,
  MODEL_LIKED: 5,
  MODEL_DOWNLOADED: 2,
  MODEL_FEATURED: 200,
  FIRST_MODEL: 100,
  TEN_MODELS: 500,
  HUNDRED_LIKES: 300,
  THOUSAND_DOWNLOADS: 500,
  // Fork rewards
  FORK_PUBLISHED: 15,       // author of the fork
  FORK_CREDIT: 5,           // original author gets this when someone forks
  FORK_LIKE_ROYALTY: 1,     // original author gets this when fork is liked
  FORK_DOWNLOAD_ROYALTY: 1, // original author when fork is downloaded
  FORK_FEATURED_ROYALTY: 10,// original author when fork is featured
  DEEP_FORK_CREDIT: 2,      // original when a fork-of-fork is published
  // Fork badges
  FORKED_5: 0,   // badge only, no extra points
  FORKED_25: 0,
  FORKED_100: 0,
};

function getRewardLevel(points: number): string {
  if (points >= 5000) return "Master";
  if (points >= 2000) return "Expert";
  if (points >= 500) return "Creator";
  if (points >= 100) return "Maker";
  return "Novice";
}

async function addRewardPoints(
  userId: string,
  event: string,
  meta?: Record<string, unknown>
): Promise<void> {
  const key = `user:${userId}:rewards`;
  const rewards = (await kv.get(key)) || {
    userId,
    points: 0,
    level: "Novice",
    badges: [],
    history: [],
  };

  const pts = REWARD_POINTS[event] || 0;
  if (pts > 0) {
    rewards.points += pts;
    rewards.level = getRewardLevel(rewards.points);
    rewards.history.push({
      event,
      points: pts,
      at: new Date().toISOString(),
      ...meta,
    });
  }

  // Check badge milestones
  if (event === "MODEL_PUBLISHED" || event === "FORK_PUBLISHED") {
    const models = await communityRepo.getAllModels();
    const userModels = models.filter((m: any) => m.authorId === userId && m.status === "published");
    if (userModels.length === 1 && !rewards.badges.includes("first_model")) {
      rewards.badges.push("first_model");
      rewards.points += REWARD_POINTS.FIRST_MODEL;
      rewards.history.push({ event: "FIRST_MODEL", points: REWARD_POINTS.FIRST_MODEL, at: new Date().toISOString() });
    }
    if (userModels.length >= 10 && !rewards.badges.includes("ten_models")) {
      rewards.badges.push("ten_models");
      rewards.points += REWARD_POINTS.TEN_MODELS;
      rewards.history.push({ event: "TEN_MODELS", points: REWARD_POINTS.TEN_MODELS, at: new Date().toISOString() });
    }
  }

  rewards.level = getRewardLevel(rewards.points);
  await kv.set(key, rewards);
}

/**
 * Propagate fork royalties up the chain.
 * When a fork receives a like/download, the original creator(s) get rewards.
 */
async function addForkRoyalty(
  model: any,
  royaltyEvent: string,
  meta?: Record<string, unknown>
): Promise<void> {
  if (!model.forkedFromId) return;

  // Credit the direct parent author
  const parent = await communityRepo.getModel(model.forkedFromId);
  if (parent && parent.authorId) {
    await addRewardPoints(parent.authorId, royaltyEvent, {
      ...meta,
      forkModelId: model.id,
      originalModelId: parent.id,
    });
  }

  // If the parent is also a fork, credit the grandparent with DEEP_FORK_CREDIT
  if (parent?.forkedFromId) {
    const grandparent = await communityRepo.getModel(parent.forkedFromId);
    if (grandparent && grandparent.authorId) {
      await addRewardPoints(grandparent.authorId, "DEEP_FORK_CREDIT", {
        ...meta,
        forkModelId: model.id,
        originalModelId: grandparent.id,
      });
    }
  }
}

/**
 * Check and award fork-related badges to a user.
 */
async function checkForkBadges(userId: string): Promise<void> {
  const allModels = await communityRepo.getAllModels();
  const userModels = allModels.filter((m: any) => m.authorId === userId && m.status === "published");
  const totalForks = userModels.reduce((sum: number, m: any) => sum + (m.forkCount || 0), 0);

  const key = `user:${userId}:rewards`;
  const rewards = (await kv.get(key)) || { userId, points: 0, level: "Novice", badges: [], history: [] };

  if (totalForks >= 5 && !rewards.badges.includes("forked_5")) {
    rewards.badges.push("forked_5");
    rewards.history.push({ event: "FORKED_5", points: 0, at: new Date().toISOString() });
  }
  if (totalForks >= 25 && !rewards.badges.includes("forked_25")) {
    rewards.badges.push("forked_25");
    rewards.history.push({ event: "FORKED_25", points: 0, at: new Date().toISOString() });
  }
  if (totalForks >= 100 && !rewards.badges.includes("forked_100")) {
    rewards.badges.push("forked_100");
    rewards.history.push({ event: "FORKED_100", points: 0, at: new Date().toISOString() });
  }

  await kv.set(key, rewards);
}

// GET /community/models – List community models (paginated, filterable)
app.get("/api/community/models", async (c) => {
  try {
    const search = (c.req.query("search") || "").toLowerCase().trim();
    const tag = c.req.query("tag") || "";
    const sort = c.req.query("sort") || "recent"; // recent | popular | downloads | most_forked
    const featured = c.req.query("featured");
    const authorId = c.req.query("authorId");
    const status = c.req.query("status"); // draft | published | all
    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 50);

    const { viewerId: currentUserId, viewerIsAdmin } = await getViewerContext(c);
    const includeOwnerDrafts =
      (!!currentUserId && status === "draft") ||
      (!!currentUserId && status === "all") ||
      (!!authorId && currentUserId === authorId);
    let items = includeOwnerDrafts
      ? await communityRepo.getAllModelsRaw()
      : await communityRepo.getAllModels();

    // Visibility rules: drafts are only visible to their owner
    if (status === "draft" && currentUserId) {
      // Show only this user's drafts
      items = items.filter((m: any) => getModelStatus(m) === "draft" && m.authorId === currentUserId);
    } else if (status === "all" && currentUserId) {
      // Show all published + this user's drafts
      items = items.filter((m: any) => getModelStatus(m) === "published" || (getModelStatus(m) === "draft" && m.authorId === currentUserId));
    } else if (authorId && currentUserId === authorId) {
      // Owner viewing their own models — include drafts
      items = items.filter((m: any) => m.authorId === authorId);
    } else {
      // Default: only published
      items = items.filter((m: any) => m.status === "published");
    }

    // Filter by author
    if (authorId) {
      items = items.filter((m: any) => m.authorId === authorId);
    }

    // Filter by featured
    if (featured === "true") {
      items = items.filter((m: any) => m.featured);
    }

    // Filter by tag
    if (tag) {
      items = items.filter((m: any) =>
        m.tags?.some((t: string) => t.toLowerCase() === tag.toLowerCase())
      );
    }

    // Search by title, author, tags
    if (search) {
      items = items.filter(
        (m: any) =>
          m.id?.toLowerCase().includes(search) ||
          m.slug?.toLowerCase().includes(search) ||
          m.title?.toLowerCase().includes(search) ||
          m.authorName?.toLowerCase().includes(search) ||
          m.authorUsername?.toLowerCase().includes(search) ||
          m.tags?.some((t: string) => t.toLowerCase().includes(search))
      );
    }

    // Sort
    if (sort === "popular") {
      items.sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0));
    } else if (sort === "downloads") {
      items.sort((a: any, b: any) => (b.downloads || 0) - (a.downloads || 0));
    } else if (sort === "most_forked") {
      items.sort((a: any, b: any) => (b.forkCount || 0) - (a.forkCount || 0));
    } else {
      items.sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    // Paginate
    const total = items.length;
    const start = (page - 1) * limit;
    const paged = items.slice(start, start + limit);

    const models = paged.map((m: any) =>
      sanitizeCommunityModel(
        m,
        !!currentUserId && (viewerIsAdmin || m.authorId === currentUserId)
      )
    );

    return c.json({ models, total, page, limit });
  } catch (e: any) {
    console.log(`GET /community/models error: ${e.message}`);
    return c.json({ error: `Error al listar modelos: ${e.message}` }, 500);
  }
});

// GET /community/models/:id – Get single model detail
app.get("/api/community/models/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const model = await communityRepo.getModel(id);
    if (!model) return c.json({ error: "Modelo no encontrado" }, 404);
    const { viewerId, viewerIsAdmin } = await getViewerContext(c);
    if (!canViewCommunityModel(model, viewerId, viewerIsAdmin)) {
      return c.json({ error: "Modelo no encontrado" }, 404);
    }
    const includeSource = !!viewerId && (viewerIsAdmin || model.authorId === viewerId);
    return c.json({ model: sanitizeCommunityModel(model, includeSource) });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /community/models/:id/export-pack – Download ZIP with SCAD, params, manifest and images
app.get("/api/community/models/:id/export-pack", async (c) => {
  try {
    const id = c.req.param("id");
    const model = await communityRepo.getModel(id);
    if (!model) return c.json({ error: "Modelo no encontrado" }, 404);

    const { viewerId, viewerIsAdmin } = await getViewerContext(c);
    if (!canViewCommunityModel(model, viewerId, viewerIsAdmin)) {
      return c.json({ error: "Modelo no encontrado" }, 404);
    }

    // Only author or admin can download the SCAD source pack
    if (!viewerId || (!viewerIsAdmin && model.authorId !== viewerId)) {
      return c.json({ error: "Solo el autor o un administrador puede descargar el paquete de exportación" }, 403);
    }

    const files: Record<string, Uint8Array> = {};
    const imageLog: { file: string; url: string; status: "ok" | "skipped"; reason?: string }[] = [];

    // model.scad
    if (model.scadSource) {
      files["model.scad"] = strToU8(model.scadSource);
    }

    // params.json
    const paramsData = typeof model.params === "object" && model.params !== null
      ? model.params
      : {};
    files["params.json"] = strToU8(JSON.stringify(paramsData, null, 2));

    // relief-config.json (if applicable)
    if ((model as any).modelType === "relief" && (model as any).reliefConfig) {
      files["relief-config.json"] = strToU8(JSON.stringify((model as any).reliefConfig, null, 2));
    }

    // Collect image URLs from media array and thumbnailUrl
    const mediaItems: Array<{ url: string; label: string }> = [];
    const rawMedia = Array.isArray((model as any).media) ? (model as any).media : [];
    rawMedia.forEach((m: any, idx: number) => {
      if (m?.url && typeof m.url === "string") {
        mediaItems.push({ url: m.url, label: `images/gallery_${String(idx + 1).padStart(2, "0")}` });
      }
    });
    if ((model as any).thumbnailUrl && typeof (model as any).thumbnailUrl === "string") {
      const thumbUrl = (model as any).thumbnailUrl as string;
      if (!mediaItems.some((m) => m.url === thumbUrl)) {
        mediaItems.unshift({ url: thumbUrl, label: "images/thumbnail" });
      }
    }

    // Download images (best-effort, skip on error)
    const FETCH_TIMEOUT_MS = 10_000;
    await Promise.all(
      mediaItems.map(async ({ url, label }) => {
        try {
          // Data URLs (base64 embedded)
          if (url.startsWith("data:")) {
            const [header, b64] = url.split(",");
            if (!b64) throw new Error("Formato data URL inválido");
            const ext = header.match(/\/([a-zA-Z0-9]+)/)?.[1] || "bin";
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            files[`${label}.${ext}`] = bytes;
            imageLog.push({ file: `${label}.${ext}`, url, status: "ok" });
            return;
          }

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timer);

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const contentType = res.headers.get("content-type") || "application/octet-stream";
          const ext = contentType.includes("png") ? "png"
            : contentType.includes("webp") ? "webp"
            : contentType.includes("gif") ? "gif"
            : "jpg";
          const buf = await res.arrayBuffer();
          files[`${label}.${ext}`] = new Uint8Array(buf);
          imageLog.push({ file: `${label}.${ext}`, url, status: "ok" });
        } catch (err: any) {
          imageLog.push({ file: label, url, status: "skipped", reason: err.message });
        }
      })
    );

    // manifest.json
    const manifest = {
      exportedAt: new Date().toISOString(),
      model: {
        id: model.id,
        title: (model as any).title,
        slug: (model as any).slug ?? null,
        modelType: (model as any).modelType ?? "parametric",
        license: (model as any).license ?? "CC BY-SA 4.0",
        tags: (model as any).tags ?? [],
        authorId: model.authorId,
        authorUsername: (model as any).authorUsername ?? null,
        createdAt: (model as any).createdAt,
        updatedAt: (model as any).updatedAt,
      },
      files: Object.keys(files),
      images: imageLog,
    };
    files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));

    // Build ZIP synchronously (fflate zipSync)
    const zipBuffer = zipSync(files, { level: 6 });

    const safeTitle = ((model as any).title as string || "model")
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .slice(0, 50);
    const filename = `vorea_${safeTitle}_${model.id.slice(0, 8)}.zip`;

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zipBuffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return c.json({ error: `Error generando el paquete: ${e.message}` }, 500);
  }
});

// POST /api/tool-actions/consume – Generic server-side tool gating + optional usage consume
app.post("/api/tool-actions/consume", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Autenticación requerida" }, 401);

    const body = await c.req.json().catch(() => ({}));
    const toolId = String(body?.toolId || "").trim();
    const actionId = String(body?.actionId || "").trim();
    const shouldConsume = body?.consume !== false;

    if (!toolId || !actionId) {
      return c.json({ error: "toolId y actionId son requeridos" }, 400);
    }

    const userProfile = (await kv.get(`user:${userId}:profile`)) || {};
    const gate = await checkToolActionAllowed(userId, userProfile, toolId, actionId);
    if (!gate.allowed) {
      return c.json({ error: gate.error || "Acción no permitida" }, (gate.status || 403) as ContentfulStatusCode);
    }

    const credits = shouldConsume
      ? await consumeToolActionUsage(userId, userProfile, gate)
      : null;
    const consumed = shouldConsume && (Boolean(gate.usageCounterKey) || Number(gate.creditCost || 0) > 0);

    return c.json({
      success: true,
      allowed: true,
      toolId,
      actionId,
      consumed,
      credits: serializeToolCreditsState(credits),
    });
  } catch (e: any) {
    return c.json({ error: `Error validando acción: ${e.message}` }, 500);
  }
});

// POST /community/models – Create a new model (published or draft, optional fork)
app.post("/api/community/models", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "No autorizado" }, 401);

    // Anti-spam: publish rate limits
    const ip = getClientIp(c);
    const publishIpLimit = await enforceRateLimit(c, `community:publish:ip:${ip}`, 15, 60 * 60 * 1000, "Demasiadas publicaciones desde esta IP. Intenta más tarde.");
    if (publishIpLimit) return publishIpLimit;
    const publishUserLimit = await enforceRateLimit(c, `community:publish:user:${userId}`, 5, 60 * 1000, "Demasiadas publicaciones. Intenta más tarde.");
    if (publishUserLimit) return publishUserLimit;

    const body = await c.req.json();
    const { title, scadSource, tags, thumbnailUrl, media, forkedFromId, status: reqStatus, modelType, reliefConfig } = body;
    const modelStatus = reqStatus === "draft" ? "draft" : "pendingReview";
    const type = modelType === "relief" ? "relief" : "parametric";
    const userProfile = (await kv.get(`user:${userId}:profile`)) || {};

    if (!title || !String(title).trim()) {
      return c.json({ error: "title es requerido" }, 400);
    }
    if (type === "parametric" && !scadSource) {
      return c.json({ error: "scadSource es requerido para modelos paramétricos" }, 400);
    }
    if (type === "relief" && !reliefConfig) {
      return c.json({ error: "reliefConfig es requerido para modelos de relieve" }, 400);
    }

    // Enforce draft limit (5 for free users)
    if (modelStatus === "draft") {
      const allModels = await communityRepo.getAllModelsRaw();
      const drafts = allModels.filter((m: any) => m.authorId === userId && getModelStatus(m) === "draft");
      const maxDrafts = (userProfile.tier === "STUDIO PRO" || userProfile.tier === "ENTERPRISE") ? 999 : 5;
      if (drafts.length >= maxDrafts) {
        return c.json({ error: `Limite de borradores alcanzado (${maxDrafts})` }, 400);
      }
    }

    // Server-side monetization gating (cannot be bypassed from frontend)
    let publishGateToConsume: ToolActionGateResult | undefined;
    let forkGateToConsume: ToolActionGateResult | undefined;
    if (modelStatus === "pendingReview") {
      const publishGate = await checkToolActionAllowed(userId, userProfile, "community", "publish");
      if (!publishGate.allowed) {
        return c.json({ error: publishGate.error || "Acción no permitida" }, (publishGate.status || 403) as ContentfulStatusCode);
      }
      publishGateToConsume = publishGate;

      if (forkedFromId) {
        const forkGate = await checkToolActionAllowed(userId, userProfile, "community", "fork");
        if (!forkGate.allowed) {
          return c.json({ error: forkGate.error || "Acción no permitida" }, (forkGate.status || 403) as ContentfulStatusCode);
        }
        forkGateToConsume = forkGate;
      }
    }

    // Get author profile
    const profile = (await communityRepo.getUserProfile(userId)) || {};

    const modelId = `cm_${uid()}`;
    const now = new Date().toISOString();

    // Build fork metadata
    let forkedFromTitle: string | undefined;
    let forkedFromAuthor: string | undefined;
    let forkChain: string[] = [];

    if (forkedFromId) {
      const { ok: creatorIsAdmin } = await isSuperAdmin(c).catch(() => ({ ok: false, userId: null }));
      const original = await communityRepo.getModel(forkedFromId);
      if (!original) {
        return c.json({ error: "Modelo original no encontrado" }, 404);
      }
      if (!canViewCommunityModel(original, userId, !!creatorIsAdmin)) {
        return c.json({ error: "Modelo original no encontrado" }, 404);
      }
      if (!canInteractWithCommunityModel(original)) {
        return c.json({ error: "Solo se puede hacer fork de modelos publicados" }, 403);
      }
      forkedFromTitle = original.title;
      forkedFromAuthor = original.authorName || original.authorUsername;
      // Build chain: original's chain + original + this model
      forkChain = [...(original.forkChain || []), forkedFromId];

      // Increment fork count on the original
      original.forkCount = (original.forkCount || 0) + 1;
      await communityRepo.upsertModel(forkedFromId, original);
    }

    const model: any = {
      id: modelId,
      title: String(title).trim(),
      authorId: userId,
      authorName: profile.displayName || "Usuario",
      authorUsername: profile.username || "@user",
      authorAvatarUrl: profile.avatarUrl || null,
      scadSource: scadSource || "",
      modelType: type,
      ...(type === "relief" && reliefConfig ? { reliefConfig } : {}),
      tags: (tags || []).map((t: string) => t.toLowerCase().trim()).filter(Boolean),
      thumbnailUrl: thumbnailUrl || null,
      media: normalizeModelMedia(media, thumbnailUrl || null, now),
      likes: 0,
      downloads: 0,
      featured: false,
      forkCount: 0,
      status: modelStatus,
      license: "CC-BY-SA-4.0",
      createdAt: now,
      updatedAt: now,
    };

    // Fork-specific fields
    if (forkedFromId) {
      model.forkedFromId = forkedFromId;
      model.forkedFromTitle = forkedFromTitle;
      model.forkedFromAuthor = forkedFromAuthor;
      model.forkChain = forkChain;
    }

    syncModelMediaAndCanonical(model);

    await communityRepo.upsertModel(modelId, model);

    // Update tag counters (only for published — happens on admin approval)
    // Tag counters and rewards deferred to moderation approval

    // Consume usage counters on submission (pendingReview)
    if (modelStatus === "pendingReview") {
      await consumeToolActionUsage(userId, userProfile, publishGateToConsume);
      if (forkedFromId) {
        await consumeToolActionUsage(userId, userProfile, forkGateToConsume);
      }
    }

    console.log(`Community model ${modelStatus}: ${modelId} by ${userId}${forkedFromId ? ` (fork of ${forkedFromId})` : ""}`);
    return c.json({ model }, 201);
  } catch (e: any) {
    console.log(`POST /community/models error: ${e.message}`);
    return c.json({ error: `Error al publicar: ${e.message}` }, 500);
  }
});

// PUT /community/models/:id – Update own model
app.put("/api/community/models/:id", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "No autorizado" }, 401);

    // Anti-spam: update rate limits
    const updateUserLimit = await enforceRateLimit(c, `community:update:user:${userId}`, 10, 60 * 1000, "Demasiadas actualizaciones. Intenta más tarde.");
    if (updateUserLimit) return updateUserLimit;

    const userProfile = (await kv.get(`user:${userId}:profile`)) || {};

    const id = c.req.param("id");
    const model = await communityRepo.getModel(id);
    if (!model) return c.json({ error: "Modelo no encontrado" }, 404);
    if (model.authorId !== userId) {
      // Check superadmin
      const { ok } = await isSuperAdmin(c);
      if (!ok) return c.json({ error: "No autorizado" }, 403);
    }

    const body = await c.req.json();
    const prevStatus = getModelStatus(model);
    if (body.title !== undefined && !String(body.title || "").trim()) {
      return c.json({ error: "title no puede estar vacío" }, 400);
    }

    const allowed = ["title", "scadSource", "tags", "thumbnailUrl", "status", "reliefConfig", "media"];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        (model as any)[key] =
          key === "tags"
            ? body[key].map((t: string) => t.toLowerCase().trim()).filter(Boolean)
            : key === "title"
              ? String(body[key]).trim()
            : key === "status"
              ? (() => {
                const normalized = String(body[key] || "").toLowerCase();
                if (normalized === "draft") return "draft";
                if (normalized === "archived") return "archived";
                return "published";
              })()
            : body[key];
      }
    }

    // If transitioning from draft to published, enforce server-side gating first
    let publishGateToConsume: ToolActionGateResult | undefined;
    let forkGateToConsume: ToolActionGateResult | undefined;
    if (prevStatus === "draft" && getModelStatus(model) === "published") {
      const publishGate = await checkToolActionAllowed(userId, userProfile, "community", "publish");
      if (!publishGate.allowed) {
        return c.json({ error: publishGate.error || "Acción no permitida" }, (publishGate.status || 403) as ContentfulStatusCode);
      }
      publishGateToConsume = publishGate;

      if (model.forkedFromId) {
        const forkGate = await checkToolActionAllowed(userId, userProfile, "community", "fork");
        if (!forkGate.allowed) {
          return c.json({ error: forkGate.error || "Acción no permitida" }, (forkGate.status || 403) as ContentfulStatusCode);
        }
        forkGateToConsume = forkGate;
      }
    }

    model.updatedAt = new Date().toISOString();
    syncModelMediaAndCanonical(model);
    await communityRepo.upsertModel(id, model);

    // If transitioning from draft to published, award points & update tags
    if (prevStatus === "draft" && getModelStatus(model) === "published") {
      // Update tag counters
      for (const tag of model.tags || []) {
        const tagData = (await communityRepo.getTag(tag)) || {
          name: tag, slug: tag, modelCount: 0, createdAt: model.createdAt,
        };
        tagData.modelCount++;
        await communityRepo.upsertTag(tag, tagData);
      }
      // Award points
      if (model.forkedFromId) {
        await addRewardPoints(userId, "FORK_PUBLISHED", { modelId: id, forkedFromId: model.forkedFromId });
        await addForkRoyalty(model, "FORK_CREDIT", { forkModelId: id });
        const original = await communityRepo.getModel(model.forkedFromId);
        if (original?.authorId) await checkForkBadges(original.authorId);
      } else {
        await addRewardPoints(userId, "MODEL_PUBLISHED", { modelId: id });
      }
      await consumeToolActionUsage(userId, userProfile, publishGateToConsume);
      if (model.forkedFromId) {
        await consumeToolActionUsage(userId, userProfile, forkGateToConsume);
      }
      console.log(`Draft published: ${id} by ${userId}`);
    }

    return c.json({ model });
  } catch (e: any) {
    return c.json({ error: `Error al actualizar: ${e.message}` }, 500);
  }
});

// DELETE /community/models/:id – Delete own model
app.delete("/api/community/models/:id", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "No autorizado" }, 401);

    // Anti-spam: delete rate limits
    const deleteUserLimit = await enforceRateLimit(c, `community:delete:user:${userId}`, 5, 60 * 1000, "Demasiadas eliminaciones. Intenta más tarde.");
    if (deleteUserLimit) return deleteUserLimit;

    const id = c.req.param("id");
    const model = await communityRepo.getModel(id);
    if (!model) return c.json({ error: "Modelo no encontrado" }, 404);
    if (model.authorId !== userId) {
      const { ok } = await isSuperAdmin(c);
      if (!ok) return c.json({ error: "No autorizado" }, 403);
    }

    // Decrement tag counters
    for (const tag of model.tags || []) {
      const tagData = await communityRepo.getTag(tag);
      if (tagData) {
        tagData.modelCount = Math.max(0, tagData.modelCount - 1);
        await communityRepo.upsertTag(tag, tagData);
      }
    }

    // Remove likes for this model
    const likes = await communityRepo.listLikesByModel(id);
    if (likes.length > 0) {
      for (const like of likes) {
        await communityRepo.deleteLike(id, like.userId);
      }
    }

    await communityRepo.deleteModel(id);
    console.log(`Community model deleted: ${id} by ${userId}`);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: `Error al eliminar: ${e.message}` }, 500);
  }
});

// POST /community/models/:id/like – Toggle like
app.post("/api/community/models/:id/like", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "No autorizado" }, 401);

    // Anti-spam: like rate limits
    const likeUserLimit = await enforceRateLimit(c, `community:like:user:${userId}`, 30, 60 * 1000, "Demasiados likes. Intenta más tarde.");
    if (likeUserLimit) return likeUserLimit;

    const id = c.req.param("id");
    const model = await communityRepo.getModel(id);
    if (!model) return c.json({ error: "Modelo no encontrado" }, 404);
    if (!canInteractWithCommunityModel(model)) {
      return c.json({ error: "Solo se puede dar like a modelos publicados" }, 403);
    }

    const existing = await communityRepo.getLike(id, userId);

    if (existing) {
      // Unlike
      await communityRepo.deleteLike(id, userId);
      model.likes = Math.max(0, (model.likes || 0) - 1);
      await communityRepo.upsertModel(id, model);
      return c.json({ liked: false, likes: model.likes });
    } else {
      // Like
      await communityRepo.upsertLike(id, userId, {
        userId,
        modelId: id,
        at: new Date().toISOString(),
      });
      model.likes = (model.likes || 0) + 1;
      await communityRepo.upsertModel(id, model);

      // Award points to the author
      if (model.authorId !== userId) {
        await addRewardPoints(model.authorId, "MODEL_LIKED", {
          modelId: id,
          likedBy: userId,
        });

        // Fork royalty: credit original author when a fork receives a like
        await addForkRoyalty(model, "FORK_LIKE_ROYALTY", { modelId: id, likedBy: userId });

        // Check 100 likes badge
        if (model.likes >= 100) {
          const authorRewards = (await kv.get(`user:${model.authorId}:rewards`)) || { badges: [] };
          if (!authorRewards.badges?.includes("hundred_likes")) {
            await addRewardPoints(model.authorId, "HUNDRED_LIKES");
          }
        }
      }

      return c.json({ liked: true, likes: model.likes });
    }
  } catch (e: any) {
    return c.json({ error: `Error en like: ${e.message}` }, 500);
  }
});

// POST /community/models/:id/download – Track download + return SCAD source
app.post("/api/community/models/:id/download", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Autenticación requerida" }, 401);

    // Anti-spam: download rate limits
    const downloadUserLimit = await enforceRateLimit(c, `community:download:user:${userId}`, 20, 60 * 1000, "Demasiadas descargas. Intenta más tarde.");
    if (downloadUserLimit) return downloadUserLimit;

    const userProfile = (await kv.get(`user:${userId}:profile`)) || {};
    const downloadGate = await checkToolActionAllowed(userId, userProfile, "community", "download");
    if (!downloadGate.allowed) {
      return c.json({ error: downloadGate.error || "Acción no permitida" }, (downloadGate.status || 403) as ContentfulStatusCode);
    }

    const id = c.req.param("id");
    const model = await communityRepo.getModel(id);
    if (!model) return c.json({ error: "Modelo no encontrado" }, 404);
    if (!canInteractWithCommunityModel(model)) {
      return c.json({ error: "Solo se puede descargar modelos publicados" }, 403);
    }

    model.downloads = (model.downloads || 0) + 1;
    await communityRepo.upsertModel(id, model);

    // Award points to author
    if (model.authorId && model.authorId !== userId) {
      await addRewardPoints(model.authorId, "MODEL_DOWNLOADED", { modelId: id });

      // Fork royalty: credit original author when a fork is downloaded
      await addForkRoyalty(model, "FORK_DOWNLOAD_ROYALTY", { modelId: id });

      // Check 1000 downloads badge
      if (model.downloads >= 1000) {
        const authorRewards = (await kv.get(`user:${model.authorId}:rewards`)) || { badges: [] };
        if (!authorRewards.badges?.includes("thousand_downloads")) {
          await addRewardPoints(model.authorId, "THOUSAND_DOWNLOADS");
        }
      }
    }

    await consumeToolActionUsage(userId, userProfile, downloadGate);

    return c.json({
      scadSource: model.scadSource,
      downloads: model.downloads,
      modelType: model.modelType || "parametric",
      reliefConfig: model.reliefConfig || null,
    });
  } catch (e: any) {
    return c.json({ error: `Error en download: ${e.message}` }, 500);
  }
});

// GET /community/models/:id/forks – List forks of a model
app.get("/api/community/models/:id/forks", async (c) => {
  try {
    const id = c.req.param("id");
    const { viewerId, viewerIsAdmin } = await getViewerContext(c);
    const parent = await communityRepo.getModel(id);
    if (!parent) return c.json({ error: "Modelo no encontrado" }, 404);
    if (!canViewCommunityModel(parent, viewerId, viewerIsAdmin)) {
      return c.json({ error: "Modelo no encontrado" }, 404);
    }
    const allModels = await communityRepo.getAllModels();
    const forks = allModels
      .filter((m: any) => m.forkedFromId === id && getModelStatus(m) === "published")
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((m: any) =>
        sanitizeCommunityModel(
          m,
          !!viewerId && (viewerIsAdmin || m.authorId === viewerId)
        )
      );
    return c.json({ forks, total: forks.length });
  } catch (e: any) {
    return c.json({ error: `Error al listar forks: ${e.message}` }, 500);
  }
});

// GET /community/tags – List all tags with model counts
app.get("/api/community/tags", async (c) => {
  try {
    const models = await communityRepo.getAllModels();
    const counts = new Map<string, number>();

    for (const model of models) {
      if (model?.status !== "published") continue;
      const tags = Array.isArray(model?.tags) ? model.tags : [];
      const unique = new Set(
        tags
          .map((t: any) => String(t || "").toLowerCase().trim())
          .filter(Boolean)
      );
      for (const tag of unique) {
        counts.set(tag as string, (counts.get(tag as string) || 0) + 1);
      }
    }

    const sorted = [...counts.entries()]
      .map(([name, modelCount]) => ({ name, slug: name, modelCount }))
      .sort((a, b) => b.modelCount - a.modelCount);
    return c.json({ tags: sorted });
  } catch (e: any) {
    return c.json({ error: `Error al listar tags: ${e.message}` }, 500);
  }
});

// GET /community/users/:id – Public user profile with their models
app.get("/api/community/users/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { viewerId, viewerIsAdmin } = await getViewerContext(c);
    const includeSource = !!viewerId && (viewerIsAdmin || viewerId === id);

    // Get user profile
    const profile = await communityRepo.getUserProfile(id);
    if (!profile) return c.json({ error: "Usuario no encontrado" }, 404);

    // Get their published models
    const allModels = await communityRepo.getAllModels();
    const userModels = allModels
      .filter((m: any) => m.authorId === id && getModelStatus(m) === "published")
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .map((m: any) => sanitizeCommunityModel(m, includeSource));

    // Aggregate stats
    const totalLikes = userModels.reduce(
      (sum: number, m: any) => sum + (m.likes || 0),
      0
    );
    const totalDownloads = userModels.reduce(
      (sum: number, m: any) => sum + (m.downloads || 0),
      0
    );

    // Get rewards
    const rewards = (await kv.get(`user:${id}:rewards`)) || {
      points: 0,
      level: "Novice",
      badges: [],
    };

    const userSlug = slugifySegment(profile.username || profile.displayName || id) || id;
    return c.json({
      user: {
        id: profile.id,
        displayName: profile.displayName,
        username: profile.username,
        slug: userSlug,
        canonicalPath: `/user/${profile.id}/${userSlug}/modelos`,
        avatarUrl: profile.avatarUrl || null,
        tier: profile.tier,
        createdAt: profile.createdAt,
      },
      stats: {
        totalModels: userModels.length,
        totalLikes,
        totalDownloads,
      },
      rewards: {
        points: rewards.points,
        level: rewards.level,
        badges: rewards.badges,
      },
      models: userModels,
    });
  } catch (e: any) {
    return c.json(
      { error: `Error al obtener perfil público: ${e.message}` },
      500
    );
  }
});

// POST /community/models/:id/feature – Toggle featured (superadmin only)
app.post("/api/community/models/:id/feature", async (c) => {
  try {
    const { ok, userId } = await isSuperAdmin(c);
    if (!ok) return c.json({ error: "Acceso denegado" }, 403);

    const id = c.req.param("id");
    const model = await communityRepo.getModel(id);
    if (!model) return c.json({ error: "Modelo no encontrado" }, 404);
    if (getModelStatus(model) !== "published") {
      return c.json({ error: "Solo modelos publicados pueden destacarse" }, 400);
    }

    model.featured = !model.featured;
    model.updatedAt = new Date().toISOString();
    await communityRepo.upsertModel(id, model);

    // Award points to author if newly featured
    if (model.featured && model.authorId) {
      await addRewardPoints(model.authorId, "MODEL_FEATURED", {
        modelId: id,
        featuredBy: userId,
      });
    }

    await auditLog("model_feature_toggle", {
      adminId: userId,
      modelId: id,
      featured: model.featured,
    });

    return c.json({ model });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /admin/community/models – List all community models for superadmin
app.get("/api/admin/community/models", requireSuperAdmin, async (c) => {
  try {

    const q = (c.req.query("q") || "").toLowerCase().trim();
    const id = (c.req.query("id") || "").toLowerCase().trim();
    const authorId = c.req.query("authorId") || "";
    const authorUsername = (c.req.query("authorUsername") || "").toLowerCase().trim();
    const status = (c.req.query("status") || "all").toLowerCase();
    const modelType = (c.req.query("modelType") || "all").toLowerCase();
    const featured = c.req.query("featured"); // true | false | undefined
    const from = c.req.query("from");
    const to = c.req.query("to");
    const sort = (c.req.query("sort") || "updated_desc").toLowerCase();
    const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
    const limit = Math.min(Math.max(1, parseInt(c.req.query("limit") || "20", 10)), 100);
    const includeSource = c.req.query("includeSource") === "true";

    let items = await communityRepo.getAllModelsRaw();

    if (id) {
      items = items.filter((m: any) => String(m.id || "").toLowerCase().includes(id));
    }
    if (authorId) {
      items = items.filter((m: any) => m.authorId === authorId);
    }
    if (authorUsername) {
      items = items.filter((m: any) =>
        String(m.authorUsername || "").toLowerCase().includes(authorUsername)
      );
    }
    if (status !== "all") {
      items = items.filter((m: any) => getModelStatus(m) === status);
    }
    if (modelType !== "all") {
      items = items.filter((m: any) => String(m.modelType || "parametric").toLowerCase() === modelType);
    }
    if (featured === "true") {
      items = items.filter((m: any) => !!m.featured);
    } else if (featured === "false") {
      items = items.filter((m: any) => !m.featured);
    }
    if (from) {
      const fromMs = new Date(from).getTime();
      if (Number.isFinite(fromMs)) {
        items = items.filter((m: any) => new Date(m.createdAt || 0).getTime() >= fromMs);
      }
    }
    if (to) {
      const toMs = new Date(to).getTime();
      if (Number.isFinite(toMs)) {
        items = items.filter((m: any) => new Date(m.createdAt || 0).getTime() <= toMs);
      }
    }
    if (q) {
      items = items.filter((m: any) =>
        String(m.id || "").toLowerCase().includes(q) ||
        String(m.title || "").toLowerCase().includes(q) ||
        String(m.authorId || "").toLowerCase().includes(q) ||
        String(m.authorName || "").toLowerCase().includes(q) ||
        String(m.authorUsername || "").toLowerCase().includes(q) ||
        String(m.slug || "").toLowerCase().includes(q) ||
        (Array.isArray(m.tags) && m.tags.some((t: string) => String(t).toLowerCase().includes(q)))
      );
    }

    if (sort === "created_asc") {
      items.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sort === "created_desc") {
      items.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sort === "likes_desc") {
      items.sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0));
    } else if (sort === "downloads_desc") {
      items.sort((a: any, b: any) => (b.downloads || 0) - (a.downloads || 0));
    } else {
      items.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    const total = items.length;
    const start = (page - 1) * limit;
    const models = items
      .slice(start, start + limit)
      .map((m: any) => sanitizeCommunityModel(m, includeSource));

    return c.json({ models, total, page, limit });
  } catch (e: any) {
    return c.json({ error: `Error al listar modelos (admin): ${e.message}` }, 500);
  }
});

// POST /admin/community/cleanup – Find and remove fake/test models
app.post("/api/admin/community/cleanup", requireSuperAdmin, async (c) => {
  try {

    const body = await c.req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false;

    const allModels = await communityRepo.getAllModelsRaw();
    const FAKE_PATTERNS = /^(test|fake|prueba|ejemplo|demo|sample|placeholder)/i;
    const GENERIC_SCAD = /^(cube|sphere|cylinder)\s*\(/;

    const suspicious: any[] = [];
    for (const m of allModels) {
      const reasons: string[] = [];
      if (FAKE_PATTERNS.test(m.title || "")) reasons.push("fake_title");
      if (!m.scadSource && !m.reliefConfig) reasons.push("no_source");
      if (m.scadSource && GENERIC_SCAD.test(m.scadSource.trim())) reasons.push("generic_scad");
      if (!m.thumbnailUrl && !m.scadSource && !m.reliefConfig) reasons.push("empty_model");
      if (reasons.length > 0) {
        suspicious.push({
          id: m.id,
          title: m.title,
          author: m.authorName || m.authorUsername,
          featured: m.featured,
          reasons,
        });
      }
    }

    let deleted = 0;
    if (!dryRun) {
      for (const s of suspicious) {
        await communityRepo.deleteModel(s.id);
        deleted++;
      }
      await auditLog("community_cleanup", { deletedCount: deleted, dryRun: false });
    }

    return c.json({ dryRun, suspiciousCount: suspicious.length, deleted: dryRun ? 0 : deleted, models: suspicious });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// PUT /admin/community/models/:id/moderate – Approve or reject a pending model
app.put("/api/admin/community/models/:id/moderate", requireSuperAdmin, async (c) => {
  try {
    const id = c.req.param("id");
    const model = await communityRepo.getModel(id);
    if (!model) return c.json({ error: "Modelo no encontrado" }, 404);

    const currentStatus = getModelStatus(model);
    if (currentStatus !== "pendingReview") {
      return c.json({ error: `Solo se pueden moderar modelos en revisión (estado actual: ${currentStatus})` }, 400);
    }

    const body = await c.req.json();
    const { action, rejectionReason } = body;
    if (action !== "approve" && action !== "reject") {
      return c.json({ error: "action debe ser 'approve' o 'reject'" }, 400);
    }

    const now = new Date().toISOString();
    const { userId: adminId } = await isSuperAdmin(c);

    if (action === "approve") {
      model.status = "published";
      model.moderatedAt = now;
      model.rejectionReason = null;

      // Award tag counters now that model is published
      if (Array.isArray(model.tags)) {
        for (const tag of model.tags) {
          const tagData = (await communityRepo.getTag(tag)) || {
            name: tag,
            slug: tag,
            modelCount: 0,
            createdAt: now,
          };
          tagData.modelCount++;
          await communityRepo.upsertTag(tag, tagData);
        }
      }

      // Award points
      if (model.forkedFromId) {
        await addRewardPoints(model.authorId, "FORK_PUBLISHED", { modelId: id, forkedFromId: model.forkedFromId });
        await addForkRoyalty(model, "FORK_CREDIT", { forkModelId: id });
        const original = await communityRepo.getModel(model.forkedFromId);
        if (original?.authorId) await checkForkBadges(original.authorId);
      } else {
        await addRewardPoints(model.authorId, "MODEL_PUBLISHED", { modelId: id });
      }
    } else {
      // reject
      if (!rejectionReason || !String(rejectionReason).trim()) {
        return c.json({ error: "rejectionReason es requerido al rechazar" }, 400);
      }
      model.status = "draft";
      model.moderatedAt = now;
      model.rejectionReason = String(rejectionReason).trim();
    }

    model.updatedAt = now;
    await communityRepo.upsertModel(id, model);
    await auditLog("community_moderate", { modelId: id, action, adminId, rejectionReason: rejectionReason || null });

    console.log(`Community model ${action}d: ${id} by admin ${adminId}`);
    return c.json({ model: sanitizeCommunityModel(model, false), action });
  } catch (e: any) {
    return c.json({ error: `Error al moderar: ${e.message}` }, 500);
  }
});

// ─── COMMENTS ────────────────────────────────────────────────────────────────

// GET /community/models/:id/comments – List comments (public)
app.get("/api/community/models/:id/comments", async (c) => {
  try {
    const id = c.req.param("id");
    const model = await communityRepo.getModel(id);
    if (!model) return c.json({ error: "Modelo no encontrado" }, 404);
    const { viewerId, viewerIsAdmin } = await getViewerContext(c);
    if (!canViewCommunityModel(model, viewerId, viewerIsAdmin)) {
      return c.json({ error: "Modelo no encontrado" }, 404);
    }
    const comments = await kv.get(`community:model:${id}:comments`) || [];
    return c.json({ comments });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// POST /community/models/:id/comments – Add comment (auth required)
app.post("/api/community/models/:id/comments", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Autenticación requerida" }, 401);

    // Anti-spam: comment rate limits
    const ip = getClientIp(c);
    const commentIpLimit = await enforceRateLimit(c, `community:comment:ip:${ip}`, 30, 60 * 60 * 1000, "Demasiados comentarios desde esta IP. Intenta más tarde.");
    if (commentIpLimit) return commentIpLimit;
    const commentUserLimit = await enforceRateLimit(c, `community:comment:user:${userId}`, 10, 60 * 1000, "Demasiados comentarios. Intenta más tarde.");
    if (commentUserLimit) return commentUserLimit;

    const userProfile = (await kv.get(`user:${userId}:profile`)) || {};
    const commentGate = await checkToolActionAllowed(userId, userProfile, "community", "comment");
    if (!commentGate.allowed) {
      return c.json({ error: commentGate.error || "Acción no permitida" }, (commentGate.status || 403) as ContentfulStatusCode);
    }

    const id = c.req.param("id");
    const model = await communityRepo.getModel(id);
    if (!model) return c.json({ error: "Modelo no encontrado" }, 404);
    if (!canInteractWithCommunityModel(model)) {
      return c.json({ error: "Solo se puede comentar modelos publicados" }, 403);
    }

    const { text } = await c.req.json();
    if (!text?.trim()) return c.json({ error: "Comentario vacío" }, 400);
    if (text.length > 1000) return c.json({ error: "Comentario muy largo (máx 1000 caracteres)" }, 400);

    const profile = await kv.get(`user:${userId}:profile`) || {};
    const comment = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId,
      username: (profile as any).username || (profile as any).displayName || "Anon",
      avatarUrl: (profile as any).avatarUrl || null,
      displayName: (profile as any).displayName || "Anon",
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    const comments = await kv.get(`community:model:${id}:comments`) || [];
    (comments as any[]).push(comment);
    await kv.set(`community:model:${id}:comments`, comments);

    // Update model comment count
    model.commentCount = (model.commentCount || 0) + 1;
    await communityRepo.upsertModel(id, model);

    await userActivityLog(userId, "comment_added", { modelId: id, commentId: comment.id });
    await consumeToolActionUsage(userId, userProfile, commentGate);

    return c.json({ comment, totalComments: (comments as any[]).length });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// DELETE /community/models/:id/comments/:commentId – Delete own comment or admin
app.delete("/api/community/models/:id/comments/:commentId", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Autenticación requerida" }, 401);

    const modelId = c.req.param("id");
    const commentId = c.req.param("commentId");
    const model = await communityRepo.getModel(modelId);
    if (!model) return c.json({ error: "Modelo no encontrado" }, 404);
    const { viewerIsAdmin } = await getViewerContext(c);
    if (!canViewCommunityModel(model, userId, viewerIsAdmin)) {
      return c.json({ error: "Modelo no encontrado" }, 404);
    }
    const comments = (await kv.get(`community:model:${modelId}:comments`) || []) as any[];

    const idx = comments.findIndex((cm: any) => cm.id === commentId);
    if (idx === -1) return c.json({ error: "Comentario no encontrado" }, 404);

    // Only author or superadmin can delete
    if (comments[idx].userId !== userId && !viewerIsAdmin) {
      return c.json({ error: "No puedes eliminar este comentario" }, 403);
    }

    comments.splice(idx, 1);
    await kv.set(`community:model:${modelId}:comments`, comments);

    // Update model comment count
    model.commentCount = Math.max(0, (model.commentCount || 1) - 1);
    await communityRepo.upsertModel(modelId, model);

    return c.json({ success: true, totalComments: comments.length });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// REWARDS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /rewards/me – Get current user's reward status
app.get("/api/rewards/me", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "No autorizado" }, 401);

    const rewards = (await kv.get(`user:${userId}:rewards`)) || {
      userId,
      points: 0,
      level: "Novice",
      badges: [],
      history: [],
    };

    return c.json({ rewards });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// GET /rewards/leaderboard – Top creators by points
app.get("/api/rewards/leaderboard", async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 50);
    const allRewards = await kv.getByPrefix("user:");
    // Filter only rewards entries
    const rewardEntries = allRewards.filter(
      (r: any) => r.points !== undefined && r.userId
    );

    // Sort by points desc
    rewardEntries.sort((a: any, b: any) => (b.points || 0) - (a.points || 0));
    const top = rewardEntries.slice(0, limit);

    // Enrich with user profile data
    const leaderboard = [];
    for (const entry of top) {
      const profile = await kv.get(`user:${entry.userId}:profile`);
      leaderboard.push({
        userId: entry.userId,
        displayName: profile?.displayName || "Usuario",
        username: profile?.username || "@user",
        avatarUrl: profile?.avatarUrl || null,
        points: entry.points,
        level: entry.level,
        badges: entry.badges || [],
      });
    }

    return c.json({ leaderboard });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SITE CONTENT MANAGEMENT (CMS) ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /content/hero-banner – Public: returns the hero banner configuration
app.get("/api/content/hero-banner", async (c) => {
  try {
    const config = await kv.get("site_content:hero_banner");
    return c.json({ config: config || null });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// PUT /content/hero-banner – Superadmin only: update hero banner content
app.put("/api/content/hero-banner", async (c) => {
  try {
    const { ok, userId } = await isSuperAdmin(c);
    if (!ok || !userId) {
      return c.json({ error: "Acceso denegado: se requiere superadmin" }, 403);
    }

    const body = await c.req.json();
    const { config } = body;
    if (!config) {
      return c.json({ error: "El campo 'config' es requerido" }, 400);
    }

    // Save hero banner config
    const saved = {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };
    await kv.set("site_content:hero_banner", saved);

    // Audit log
    await auditLog("hero_banner_updated", { adminId: userId });

    console.log(`[CMS] Hero banner updated by ${userId}`);
    return c.json({ success: true, config: saved });
  } catch (e: any) {
    return c.json({ error: `Error: ${e.message}` }, 500);
  }
});

// ── Admin News Source Management (Superadmin only) ──
import { newsRepository } from "./news-repository.js";

app.get("/api/admin/news/sources", requireSuperAdmin, async (c) => {
  try {
    const sources = await newsRepository.listSources();
    return c.json({ sources });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.put("/api/admin/news/sources/:id", requireSuperAdmin, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const updated = await newsRepository.updateSource(id, body);
    if (!updated) return c.json({ error: "Fuente no encontrada" }, 404);
    return c.json({ source: updated });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post("/api/admin/news/sources", requireSuperAdmin, async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name || !body.baseUrl || !body.fetchMode || !body.language) {
      return c.json({ error: "Campos requeridos: name, baseUrl, fetchMode, language" }, 400);
    }
    const created = await newsRepository.createSource(body);
    return c.json({ source: created }, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.delete("/api/admin/news/sources/:id", requireSuperAdmin, async (c) => {
  try {
    const id = c.req.param("id");
    const deleted = await newsRepository.deleteSource(id);
    if (!deleted) return c.json({ error: "Fuente no encontrada" }, 404);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get("/api/admin/news/source-stats", requireSuperAdmin, async (c) => {
  try {
    const stats = await newsRepository.getArticleStatsBySource();
    return c.json({ stats });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post("/api/admin/news/ingest", requireSuperAdmin, async (c) => {
  try {
    const result = await ingestNews();
    return c.json({ success: true, ...result });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Mount PayPal Subscriptions API
app.route("/api/subscriptions", paypalSubscriptionsApp);
app.route("/api/ai-studio", aiStudioRoutes);
app.route("/", newsApp);

// ── Auto-ingest news on server startup (non-blocking) ──
import { ingestNews, seedDefaultNewsSources } from "./news-service.js";
setTimeout(async () => {
  try {
    console.log("[news] Auto-seeding sources & starting initial ingestion...");
    await seedDefaultNewsSources();
    const result = await ingestNews();
    console.log(
      `[news] Initial ingestion done: ${result.insertedCount} inserted, ${result.updatedCount} updated, ${result.skippedCount} skipped`
    );
  } catch (err) {
    console.error("[news] Auto-ingestion failed:", err);
  }
}, 10_000); // 10s delay to let server finish booting

// Re-ingest every 6 hours
setInterval(async () => {
  try {
    console.log("[news] Scheduled re-ingestion starting...");
    const result = await ingestNews();
    console.log(
      `[news] Re-ingestion done: ${result.insertedCount} inserted, ${result.updatedCount} updated, ${result.skippedCount} skipped`
    );
  } catch (err) {
    console.error("[news] Scheduled re-ingestion failed:", err);
  }
}, 6 * 60 * 60 * 1000);

export default app;
