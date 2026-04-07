/**
 * Business Config Service
 * Fetches plans, credit packs, limits, and promotions from the backend.
 * Caches data in memory with a 5-minute TTL.
 * Falls back to hardcoded defaults if the API is unreachable.
 */

import type { MembershipPlan, MembershipTier, CreditPack, ToolCreditConfig } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessLimits {
  freeExportLimit: number;
  aiGenerationsPerMonth: Record<MembershipTier, number>; // -1 = unlimited
  maxActiveProjects: Record<MembershipTier, number>;
  exportFormats: Record<MembershipTier, string[]>;
}

export interface Promotion {
  id: string;
  name: string;
  type: "percent" | "fixed" | "trial" | "bonus_credits";
  value: number;
  appliesTo: string[];
  conditions: {
    countries?: string[];
    startDate: string;
    endDate: string;
    maxUses?: number;
    couponCode?: string;
  };
  active: boolean;
  usedCount: number;
}

export interface BusinessConfig {
  plans: MembershipPlan[];
  creditPacks: CreditPack[];
  limits: BusinessLimits;
  promotions: Promotion[];
  currency: string;
  toolCredits: ToolCreditConfig;
  imageLimits: Record<string, { maxBytes: number; resizePx: number | null }>;
}

// ─── Hardcoded defaults (fallback if API unreachable) ─────────────────────────

const DEFAULT_PLANS: MembershipPlan[] = [
  {
    tier: "FREE", name: "Free", price: 0, yearlyPrice: 0,
    features: ["3 proyectos activos", "Exportacion STL (5/mes)", "Editor parametrico", "6 exportaciones GCode gratis", "Comunidad (solo lectura)", "1 generacion IA por mes"],
  },
  {
    tier: "PRO", name: "Pro", price: 12, yearlyPrice: 99, highlighted: true,
    features: ["Proyectos ilimitados", "Exportacion STL, OBJ, 3MF", "Editor parametrico completo", "Exportación GCode ilimitada (Deform/Edit limitado)", "Deformaciones organicas (1 cr)", "20 generaciones IA por mes", "MakerWorld publish (3 cr)", "Soporte prioritario"],
  },
  {
    tier: "STUDIO PRO", name: "Studio Pro", price: 29, yearlyPrice: 249,
    features: ["Todo lo de Pro", "Exportación GCode ilimitada (Deform/Edit ilimitado)", "Generaciones IA ilimitadas", "Modelos privados", "Exportacion SCAD editable", "Soporte dedicado 24/7"],
  },
];

const DEFAULT_CREDIT_PACKS: CreditPack[] = [
  { id: "pack_10", name: "Pack Starter", credits: 10, price: 2.99, pricePerCredit: 0.30 },
  { id: "pack_30", name: "Pack Pro", credits: 30, price: 6.99, pricePerCredit: 0.23, popular: true },
  { id: "pack_100", name: "Pack Studio", credits: 100, price: 17.99, pricePerCredit: 0.18 },
];

const DEFAULT_LIMITS: BusinessLimits = {
  freeExportLimit: 6,
  aiGenerationsPerMonth: { FREE: 1, PRO: 20, "STUDIO PRO": -1 },
  maxActiveProjects: { FREE: 3, PRO: -1, "STUDIO PRO": -1 },
  exportFormats: { FREE: ["STL"], PRO: ["STL", "OBJ", "3MF"], "STUDIO PRO": ["STL", "OBJ", "3MF", "SCAD"] },
};

const DEFAULT_TOOL_CREDITS: ToolCreditConfig = {
  creditValueUsd: 0.05,
  monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 },
  tools: {},
};

const DEFAULT_IMAGE_LIMITS: Record<string, { maxBytes: number; resizePx: number | null }> = {
  free: { maxBytes: 2 * 1024 * 1024, resizePx: 1024 },
  pro: { maxBytes: 10 * 1024 * 1024, resizePx: 2048 },
  studioPro: { maxBytes: 25 * 1024 * 1024, resizePx: null },
};

const DEFAULT_CONFIG: BusinessConfig = {
  plans: DEFAULT_PLANS,
  creditPacks: DEFAULT_CREDIT_PACKS,
  limits: DEFAULT_LIMITS,
  promotions: [],
  currency: "USD",
  toolCredits: DEFAULT_TOOL_CREDITS,
  imageLimits: DEFAULT_IMAGE_LIMITS,
};

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let _cache: BusinessConfig | null = null;
let _cacheExpiry = 0;
let _fetchPromise: Promise<BusinessConfig> | null = null;

// ─── Fetch ────────────────────────────────────────────────────────────────────

import { apiUrl } from "../../../utils/config/info";

async function fetchBusinessConfig(): Promise<BusinessConfig> {
  try {
    const res = await fetch(`${apiUrl}/config/business`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      plans: data.plans || DEFAULT_PLANS,
      creditPacks: data.creditPacks || DEFAULT_CREDIT_PACKS,
      limits: data.limits || DEFAULT_LIMITS,
      promotions: data.promotions || [],
      currency: data.currency || "USD",
      toolCredits: data.toolCredits || DEFAULT_TOOL_CREDITS,
      imageLimits: data.imageLimits || DEFAULT_IMAGE_LIMITS,
    };
  } catch (err) {
    console.warn("[BusinessConfig] API unreachable, using defaults:", err);
    return DEFAULT_CONFIG;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Get the full business config (cached, 5 min TTL) */
export async function getBusinessConfig(): Promise<BusinessConfig> {
  const now = Date.now();
  if (_cache && now < _cacheExpiry) return _cache;

  // Dedup concurrent fetches
  if (!_fetchPromise) {
    _fetchPromise = fetchBusinessConfig().then((config) => {
      _cache = config;
      _cacheExpiry = Date.now() + CACHE_TTL_MS;
      _fetchPromise = null;
      return config;
    });
  }
  return _fetchPromise;
}

/** Get plans (sync from cache, or fetch) */
export async function getPlans(): Promise<MembershipPlan[]> {
  return (await getBusinessConfig()).plans;
}

/** Get credit packs (sync from cache, or fetch) */
export async function getCreditPacks(): Promise<CreditPack[]> {
  return (await getBusinessConfig()).creditPacks;
}

/** Get limits (sync from cache, or fetch) */
export async function getLimits(): Promise<BusinessLimits> {
  return (await getBusinessConfig()).limits;
}

/** Get free export limit (convenience) */
export async function getFreeExportLimit(): Promise<number> {
  return (await getBusinessConfig()).limits.freeExportLimit;
}

/** Get active promotions */
export async function getActivePromotions(): Promise<Promotion[]> {
  return (await getBusinessConfig()).promotions;
}

/** Invalidate cache (call after admin saves changes) */
export function invalidateBusinessConfigCache(): void {
  _cache = null;
  _cacheExpiry = 0;
}

/** Get cached config synchronously (returns defaults if not yet fetched) */
export function getBusinessConfigSync(): BusinessConfig {
  return _cache || DEFAULT_CONFIG;
}

// Re-export defaults for fallback use
export { DEFAULT_PLANS, DEFAULT_CREDIT_PACKS, DEFAULT_LIMITS, DEFAULT_CONFIG, DEFAULT_TOOL_CREDITS };

/** Get tool credit config (async) */
export async function getToolCredits(): Promise<ToolCreditConfig> {
  return (await getBusinessConfig()).toolCredits;
}

/** Get tool credit config synchronously (cached or defaults) */
export function getToolCreditConfigSync(): ToolCreditConfig {
  return (_cache || DEFAULT_CONFIG).toolCredits;
}
