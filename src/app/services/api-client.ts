/**
 * API Client – Communicates with the Vorea API server.
 * All cross-device persistence goes through this layer.
 *
 * Self-hosted auth: JWT stored in localStorage, no Supabase SDK.
 */

import { apiUrl } from "../../../utils/config/info";
import type { RegionPolicySummary } from "./types";
import type { CompilePreviewResult } from "../engine/compile-preview";
import type {
  InstructionSpecV1,
  ParametricEngine,
  ParametricFamily,
  ParametricIntent,
  QualityProfile,
} from "../engine/instruction-spec";
import type { FdmValidationResult } from "../engine/validation";
import { toast } from "sonner";

// ─── Base URL ─────────────────────────────────────────────────────────────────

const BASE_URL = apiUrl;

// ─── Token management ─────────────────────────────────────────────────────────

const TOKEN_KEY = "vorea_token";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // localStorage unavailable (SSR, sandboxed)
  }
}

// Legacy alias for auth-context compatibility
export function setCachedAccessToken(token: string | null) {
  setStoredToken(token);
}

export function getCachedAccessToken(): string | null {
  return getStoredToken();
}

async function fetchApi(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 429) {
    let errorMsg = "Peticiones excesivas. Por favor, intenta más tarde.";
    try {
      const cloned = response.clone();
      const body = await cloned.json();
      if (body.error) errorMsg = body.error;
    } catch {}
    toast.error(errorMsg);
  }

  return response;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH API
// ═══════════════════════════════════════════════════════════════════════════════

export const AuthApi = {
  async signup(data: {
    email: string;
    password: string;
    displayName?: string;
    username?: string;
  }) {
    const res = await fetchApi("/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error en signup");
    // Store JWT token
    if (json.token) {
      setStoredToken(json.token);
    }
    return json;
  },

  async signin(email: string, password: string) {
    const res = await fetchApi("/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al iniciar sesion");
    // Store JWT token
    if (json.token) {
      setStoredToken(json.token);
    }
    return {
      session: { access_token: json.token },
      user: json.user,
      profile: json.profile,
    };
  },

  async signout() {
    try {
      await fetchApi("/auth/signout", {
        method: "POST",
      });
    } catch {
      // Best-effort cookie cleanup on the server; local token still gets cleared.
    } finally {
      setStoredToken(null);
    }
  },

  async getSession() {
    const token = getStoredToken();
    if (!token) return null;
    // Verify token is still valid by calling /auth/me
    try {
      const res = await fetchApi("/auth/me");
      if (!res.ok) {
        setStoredToken(null);
        return null;
      }
      return { access_token: token };
    } catch {
      return null;
    }
  },

  async getProfile() {
    const res = await fetchApi("/auth/me");
    if (!res.ok) return null;
    const json = await res.json();
    return json.profile;
  },

  async getProfileEnvelope(): Promise<{
    profile: Record<string, unknown> | null;
    regionPolicy: RegionPolicySummary | null;
  }> {
    const res = await fetchApi("/auth/me");
    if (!res.ok) {
      return { profile: null, regionPolicy: null };
    }
    const json = await res.json();
    return {
      profile: json.profile ?? null,
      regionPolicy: json.regionPolicy ?? null,
    };
  },

  async updateProfile(patch: Record<string, unknown>) {
    const res = await fetchApi("/auth/me", {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar perfil");
    return json.profile;
  },

  async requestPasswordReset(email: string) {
    const res = await fetchApi("/auth/request-reset", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al solicitar reseteo");
    return json;
  },

  async resetPassword(email: string, pin: string, newPassword: string) {
    const res = await fetchApi("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, pin, newPassword }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al resetear contraseña");
    return json;
  },

  async requestEmailVerification() {
    const res = await fetchApi("/auth/request-email-verification", {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al solicitar verificación por email");
    return json as { message: string; codeDev?: string };
  },

  async verifyEmail(code: string) {
    const res = await fetchApi("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al verificar email");
    return json as { message: string; verifiedAt?: string };
  },

  /**
   * Google One Tap / Sign In With Google.
   * Send the credential token from the Google SDK to our server for verification.
   */
  async googleSignIn(credential: string) {
    const res = await fetch(`${BASE_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error en Google Sign-In");
    if (json.token) {
      setStoredToken(json.token);
    }
    return json;
  },

  /**
   * Returns the Google Client ID from the server config, for SDK initialization.
   */
  async getGoogleConfig(): Promise<{ configured: boolean; clientId?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/auth/google/config`);
      return await res.json();
    } catch {
      return { configured: false };
    }
  },

  /**
   * Refresh the JWT token.
   */
  async refreshToken() {
    const res = await fetchApi("/auth/refresh", { method: "POST" });
    const json = await res.json();
    if (!res.ok) return null;
    if (json.token) {
      setStoredToken(json.token);
    }
    return json;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// GCODE COLLECTION API
// ═══════════════════════════════════════════════════════════════════════════════

export const GCodeApi = {
  async list() {
    const res = await fetchApi("/gcode");
    if (!res.ok) {
      console.error("GCode list error:", await res.text());
      return [];
    }
    const json = await res.json();
    return json.items || [];
  },

  async save(
    name: string,
    gcode: string,
    config?: Record<string, unknown>,
    actionId?: string,
  ) {
    const res = await fetchApi("/gcode", {
      method: "POST",
      body: JSON.stringify({ name, gcode, config, actionId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al guardar GCode");
    return json.item;
  },

  async remove(id: string) {
    const res = await fetchApi(`/gcode/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || "Error al eliminar GCode");
    }
    return true;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CREDITS API
// ═══════════════════════════════════════════════════════════════════════════════

export const CreditsApi = {
  async get() {
    const res = await fetchApi("/credits");
    if (!res.ok) return null;
    const json = await res.json();
    return json.credits;
  },

  async consume() {
    const res = await fetchApi("/credits/consume", { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Sin creditos");
    return json;
  },

  async purchase(packId: string, credits: number, targetUserId?: string) {
    const res = await fetchApi("/credits/purchase", {
      method: "POST",
      body: JSON.stringify({ packId, credits, targetUserId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al comprar");
    return json;
  },
};

export const ToolCreditsApi = {
  async getMine() {
    const res = await fetchApi("/tool-credits/me");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener créditos de herramientas");
    return json.credits as {
      balance: number;
      monthlyAllocation: number;
      monthlyBalance: number;
      topupBalance: number;
      totalUsed: number;
      lastResetAt: string;
      tier: string;
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC TOOL ACTION GATING API
// ═══════════════════════════════════════════════════════════════════════════════

export const ToolActionsApi = {
  async consume(toolId: string, actionId: string, options?: { consume?: boolean }) {
    const res = await fetchApi("/tool-actions/consume", {
      method: "POST",
      body: JSON.stringify({
        toolId,
        actionId,
        consume: options?.consume ?? true,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Acción no permitida");
    return json as {
      success: boolean;
      allowed: boolean;
      toolId: string;
      actionId: string;
      consumed: boolean;
      credits: {
        balance: number;
        monthlyAllocation: number;
        monthlyBalance: number;
        topupBalance: number;
        totalUsed: number;
        lastResetAt: string;
        tier: string;
      } | null;
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY API
// ═══════════════════════════════════════════════════════════════════════════════

export const ActivityApi = {
  async getMyActivity(limit = 50) {
    const res = await fetchApi(`/activity?limit=${limit}`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.activity || [];
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// AI BUDGET API
// ═══════════════════════════════════════════════════════════════════════════════

export const AIBudgetApi = {
  async getStatus(): Promise<{ available: boolean; circuitBreakerTripped: boolean; budgetUtilization: string }> {
    const res = await fetchApi("/ai/budget-status");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al verificar presupuesto AI");
    return json;
  },

  async trackSpend(costUsd: number, tier: string) {
    const res = await fetchApi("/ai/track-spend", {
      method: "POST",
      body: JSON.stringify({ costUsd, tier }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al registrar gasto AI");
    return json;
  },
};

export interface AiStudioRecipeApiRecord {
  id: string;
  version: "1.0";
  name: string;
  prompt: string;
  engine: ParametricEngine;
  quality: QualityProfile;
  familyHint: string;
  parameterOverrides: Record<string, number | string | boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface AiStudioFamilyApiRecord {
  id: string;
  slug: string;
  engine: "fdm" | "organic";
  nameEs: string;
  nameEn: string;
  descriptionEs: string | null;
  descriptionEn: string | null;
  imageUrl: string | null;
  scadTemplate: string;
  parameters: Record<string, any>;
  status: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiStudioPresetApiRecord {
  id: string;
  familyId: string;
  slug: string;
  labelEs: string;
  labelEn: string;
  promptEs: string;
  promptEn: string;
  imageUrl: string | null;
  overrideValues: Record<string, any>;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiStudioProviderModelRecord {
  id: string;
  label: string;
  costPer1kTokens: number;
}

export interface AiStudioProviderRecord {
  label: string;
  envKey: string;
  implemented?: boolean;
  models: AiStudioProviderModelRecord[];
}

export interface AiStudioForecastSnapshot {
  currentMonth: string;
  currentSpentUsd: number;
  effectiveBudgetUsd: number;
  budgetRemainingUsd: number;
  budgetUtilizationPercent: number;
  projectedMonthEndSpendUsd: number;
  projectedUtilizationPercent: number;
  forecastBand: "green" | "yellow" | "red" | "blocked";
  recentAverageDailySpendUsd: number;
  previousPeriodSpendToDateUsd: number;
  previousFullMonthSpendUsd: number;
  daysElapsed: number;
  daysInMonth: number;
}

export interface AiGenerationTraceSummary {
  id: string;
  createdAt: string;
  status: string;
  provider: string;
  model: string;
  lane: "economy" | "balanced" | "premium";
  quality: QualityProfile;
  intent: string;
  reason: string | null;
  failureCode: string | null;
  attemptHistory: Array<{
    provider: string;
    model: string;
    lane: "economy" | "balanced" | "premium";
    reason: string;
    status: "succeeded" | "failed";
    error?: string | null;
  }>;
}

export interface RoutingDecisionSummary {
  mode: "manual" | "automatic";
  provider: string;
  model: string;
  lane: "economy" | "balanced" | "premium";
  reason: string;
  traceId: string | null;
  attemptHistory?: Array<{
    provider: string;
    model: string;
    lane: "economy" | "balanced" | "premium";
    reason: string;
    status: "succeeded" | "failed";
    error?: string | null;
  }>;
}

export interface AiStudioAdminConfigRecord {
  activeProvider: string;
  activeModel: string;
  manualMode: boolean;
  alertThresholds: number[];
  providers: Record<string, AiStudioProviderRecord>;
  _availableProviders: string[];
  _implementedProviders: string[];
  _selectableProviders: string[];
  _healthyProviders: string[];
  _healthyCandidates: Array<{
    provider: string;
    providerLabel: string;
    model: string;
    modelLabel: string;
    costPer1kTokens: number;
    available: boolean;
    implemented: boolean;
    selectable: boolean;
    cooldownUntil: number;
    consecutiveFailures: number;
    healthy: boolean;
  }>;
  forecast: AiStudioForecastSnapshot;
  laneMatrix: Record<string, { draft: "economy" | "balanced" | "premium"; final: "economy" | "balanced" | "premium" }>;
  recommendedFallbacks: Array<{
    provider: string;
    model: string;
    lane: "economy" | "balanced" | "premium";
    estimatedUsdPer1kTokens: number;
  }>;
  recentTraces: AiGenerationTraceSummary[];
}

export interface AdminAIBudgetRecord {
  budget: {
    globalMonthlyBudgetUsd: number;
    maxBudgetPercentOfRevenue: number;
    currentMonthSpentUsd: number;
    currentMonth: string;
    perTierDailyLimits: Record<string, number>;
    circuitBreakerEnabled: boolean;
  };
  computed: {
    monthlyRevenue: number;
    effectiveBudget: number;
    budgetRemaining: number;
    budgetUtilization: string;
    circuitBreakerTripped: boolean;
    projectedMonthEndSpendUsd: number;
    projectedUtilization: string;
    forecastBand: "green" | "yellow" | "red" | "blocked";
  };
  breakdown: {
    byQuality: Record<string, { requests: number; estimatedUsd: number }>;
    byLane: Record<string, { requests: number; estimatedUsd: number }>;
  };
}

export const AiStudioAdminApi = {
  async getAIConfig(): Promise<AiStudioAdminConfigRecord> {
    const res = await fetchApi("/ai-studio/config");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener la configuración del motor IA");
    if (!json?.config) throw new Error("Respuesta inválida: falta config del motor IA");
    return json.config as AiStudioAdminConfigRecord;
  },

  async updateAIConfig(input: {
    activeProvider: string;
    activeModel: string;
    manualMode: boolean;
    alertThresholds: number[];
  }): Promise<AiStudioAdminConfigRecord> {
    const res = await fetchApi("/ai-studio/config", {
      method: "PUT",
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar la configuración del motor IA");
    return json.config as AiStudioAdminConfigRecord;
  },
};

export const AiStudioCMSApi = {
  async uploadFamilyImage(blob: Blob): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const res = await fetchApi("/ai-studio/upload-image", {
      method: "POST",
      body: JSON.stringify({ data: dataUrl }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al subir imagen de familia");
    return json.url; // e.g. "/api/uploads/community-image/fam_img_xxx"
  },

  async getFamilies(): Promise<AiStudioFamilyApiRecord[]> {
    const res = await fetchApi("/ai-studio/families");
    if (!res.ok) throw new Error("Error obteniendo familias CMS");
    const json = await res.json();
    return json.families || [];
  },

  async createFamily(data: Partial<AiStudioFamilyApiRecord>): Promise<AiStudioFamilyApiRecord> {
    const res = await fetchApi("/ai-studio/families", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Error creando familia");
    const json = await res.json();
    return json.family;
  },

  async updateFamily(id: string, data: Partial<AiStudioFamilyApiRecord>): Promise<AiStudioFamilyApiRecord> {
    const res = await fetchApi(`/ai-studio/families/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Error actualizando familia");
    const json = await res.json();
    return json.family;
  },

  async deleteFamily(id: string): Promise<void> {
    const res = await fetchApi(`/ai-studio/families/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error eliminando familia");
  },

  async getPresets(): Promise<AiStudioPresetApiRecord[]> {
    const res = await fetchApi("/ai-studio/presets");
    if (!res.ok) throw new Error("Error obteniendo presets CMS");
    const json = await res.json();
    return json.presets || [];
  },

  async createPreset(data: Partial<AiStudioPresetApiRecord>): Promise<AiStudioPresetApiRecord> {
    const res = await fetchApi("/ai-studio/presets", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Error creando preset");
    const json = await res.json();
    return json.preset;
  },

  async updatePreset(id: string, data: Partial<AiStudioPresetApiRecord>): Promise<AiStudioPresetApiRecord> {
    const res = await fetchApi(`/ai-studio/presets/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Error actualizando preset");
    const json = await res.json();
    return json.preset;
  },

  async deletePreset(id: string): Promise<void> {
    const res = await fetchApi(`/ai-studio/presets/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error eliminando preset");
  },
};

export const AiStudioRecipesApi = {
  async list(): Promise<AiStudioRecipeApiRecord[]> {
    const res = await fetchApi("/ai-studio/recipes");
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || "Error al listar recipes");
    }
    const json = await res.json();
    return (json.recipes || []) as AiStudioRecipeApiRecord[];
  },

  async save(input: {
    id?: string;
    name: string;
    prompt: string;
    engine: "fdm" | "organic";
    quality: "draft" | "final";
    familyHint: string;
    parameterOverrides: Record<string, number | string | boolean>;
  }): Promise<AiStudioRecipeApiRecord> {
    const res = await fetchApi("/ai-studio/recipes", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al guardar recipe");
    return json.recipe as AiStudioRecipeApiRecord;
  },

  async remove(id: string): Promise<void> {
    const res = await fetchApi(`/ai-studio/recipes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || "Error al eliminar recipe");
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// AI STUDIO GENERATION API (LLM-powered SCAD generation)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AiStudioGenerateRequest {
  prompt: string;
  engine: "fdm" | "organic";
  familySlug: string;
  quality: "draft" | "final";
  parameterOverrides?: Record<string, number | string | boolean>;
  /** Idempotency key. Auto-generated client-side if omitted. Keep for retries. */
  generationId?: string;
}

export interface AiStudioGenerateResult {
  modelName: string;
  scadCode: string;
  parameters: Array<{
    name: string;
    type: string;
    value: any;
    description: string;
  }>;
  reasoning: string;
}

export interface AiStudioGenerateResponse {
  success: true;
  result: AiStudioGenerateResult;
  contract: {
    normalized: {
      prompt: string;
      requestedFamilySlug: string;
      resolvedFamilySlug: string;
      familyDisplayName: string;
      intent: ParametricIntent;
      warnings: string[];
      riskFlags: string[];
      parameterOverrides: Record<string, number | string | boolean>;
    };
    editor: {
      spec: InstructionSpecV1;
    };
  };
  usage: {
    creditsConsumed: number;
    balanceRemaining: number;
  };
  routing: RoutingDecisionSummary;
  /** True when the result was served from the idempotency cache (no new charge) */
  cached?: boolean;
  generationId?: string;
}

export interface AiStudioGenerateErrorResponse {
  success: false;
  error: string;
  code: "AUTH_REQUIRED" | "BUDGET_EXHAUSTED" | "DAILY_LIMIT" | "CREDITS_INSUFFICIENT" | "GENERATION_FAILED";
}

export const AiStudioGenerateApi = {
  async generate(input: AiStudioGenerateRequest): Promise<AiStudioGenerateResponse> {
    // Auto-generate idempotency key if not provided by the caller.
    // The caller should persist this UUID and reuse it on retries.
    const generationId = input.generationId ?? crypto.randomUUID();
    const res = await fetchApi("/ai-studio/generate", {
      method: "POST",
      body: JSON.stringify({ ...input, generationId }),
    });
    const json = await res.json();
    if (!json.success) {
      const errorJson = json as AiStudioGenerateErrorResponse;
      throw new Error(errorJson.error || "Error al generar modelo con IA");
    }
    return json as AiStudioGenerateResponse;
  },

  /**
   * Recover a completed generation result by its generationId.
   * Use this after a network failure to avoid re-charging credits.
   * Returns null if the result is not found or still in progress.
   */
  async getGenerationResult(generationId: string): Promise<AiStudioGenerateResponse | null> {
    try {
      const res = await fetchApi(`/ai-studio/generation/${generationId}`);
      if (!res.ok) return null;
      const json = await res.json();
      if (!json.success) return null;
      return json as AiStudioGenerateResponse;
    } catch {
      return null;
    }
  },
};

export interface AiStudioHistoryApiRecord {
  id: string;
  version: "1.0" | "1.1";
  prompt: string;
  engine: ParametricEngine;
  quality: QualityProfile;
  modelName: string;
  scadCode: string;
  familyHint: ParametricFamily;
  parameterOverrides: Record<string, number | string | boolean>;
  spec: InstructionSpecV1;
  validation: FdmValidationResult;
  compilePreview: CompilePreviewResult;
  createdAt: string;
  updatedAt: string;
}

export const AiQuickFixApi = {
  async generateFix(source: string, errorMsg: string): Promise<string> {
    const res = await fetchApi("/ai/quick-fix", {
      method: "POST",
      body: JSON.stringify({ source, error: errorMsg }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Error al conectar con Vorea Quick Fix");
    }
    const json = await res.json();
    return json.data;
  },
};

export const AiStudioHistoryApi = {
  async list(): Promise<AiStudioHistoryApiRecord[]> {
    const res = await fetchApi("/ai/history");
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || "Error al listar historial AI");
    }
    const json = await res.json();
    return (json.history || []) as AiStudioHistoryApiRecord[];
  },

  async save(input: {
    id?: string;
    prompt: string;
    engine: ParametricEngine;
    quality: QualityProfile;
    modelName: string;
    scadCode: string;
    familyHint?: ParametricFamily;
    parameterOverrides?: Record<string, number | string | boolean>;
    spec: InstructionSpecV1;
    validation: FdmValidationResult;
    compilePreview: CompilePreviewResult;
  }): Promise<AiStudioHistoryApiRecord> {
    const res = await fetchApi("/ai/history", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al guardar historial AI");
    return json.entry as AiStudioHistoryApiRecord;
  },

  async remove(id: string): Promise<void> {
    const res = await fetchApi(`/ai/history/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || "Error al eliminar historial AI");
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK API
// ═══════════════════════════════════════════════════════════════════════════════

export const FeedbackApi = {
  async submit(data: {
    type: string;
    message: string;
    screenshot?: string;
    stateSnapshot?: string;
    userEmail?: string;
    generationParams?: any;
    modelSnapshotUrl?: string;
  }) {
    const res = await fetchApi("/feedback", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al enviar feedback");
    return json;
  },

  async list() {
    const res = await fetchApi("/feedback");
    if (!res.ok) {
      console.error("Feedback list error:", await res.text());
      return [];
    }
    const json = await res.json();
    return json.items || [];
  },

  async triggerAIReview() {
    const res = await fetchApi("/feedback/ai-review", { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error en AI review");
    return json;
  },

  async getAIStats() {
    const res = await fetchApi("/feedback/ai-stats");
    if (!res.ok) {
      console.error("AI stats error:", await res.text());
      return null;
    }
    const json = await res.json();
    return json.stats;
  },

  async updateStatus(id: string, status: string) {
    const res = await fetchApi(`/feedback/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar estado");
    return json;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT API
// ═══════════════════════════════════════════════════════════════════════════════

export const ContactApi = {
  async submit(input: {
    name: string;
    email: string;
    subject?: string;
    message: string;
    pageUrl?: string;
  }): Promise<{ success: boolean; contactId: string }> {
    const res = await fetchApi("/contact", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al enviar contacto");
    return {
      success: !!json.success,
      contactId: String(json.contactId || ""),
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN API (Superuser only)
// ═══════════════════════════════════════════════════════════════════════════════

export const AdminApi = {

  async fetchAcquisitionReport() {
    const res = await fetchApi("/admin/reports/acquisition");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener datos de adquisición");
    return json;
  },

  async resetOwnerPassword(email: string, newPassword: string) {
    const res = await fetchApi("/admin/reset-owner-password", {
      method: "POST",
      body: JSON.stringify({ email, newPassword }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al resetear contraseña");
    return json;
  },

  async checkSuperAdmin() {
    const res = await fetchApi("/admin/check");
    if (!res.ok) return { isSuperAdmin: false };
    return await res.json();
  },

  // Users
  async listUsers() {
    const res = await fetchApi("/admin/users");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al listar usuarios");
    return json;
  },

  async updateUser(id: string, data: Record<string, unknown>) {
    const res = await fetchApi(`/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar usuario");
    return json;
  },

  async deleteUser(id: string) {
    const res = await fetchApi(`/admin/users/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al eliminar usuario");
    return json;
  },

  async cleanupDuplicates(dryRun = true) {
    const res = await fetchApi("/admin/users/cleanup-duplicates", {
      method: "POST",
      body: JSON.stringify({ dryRun }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error en limpieza");
    return json;
  },

  async getLegacyTopUpStatus() {
    const res = await fetchApi("/admin/tool-credits/legacy-status");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener estado legacy");
    return json as {
      totalUsersScanned: number;
      affectedUsers: number;
      totalLegacyPurchasedCredits: number;
      preview: Array<{
        userId: string;
        email: string;
        displayName: string;
        tier: string;
        legacyPurchasedCredits: number;
        totalExported: number;
      }>;
      lastRun?: {
        executedAt: string;
        executedBy?: string;
        migratedUsers: number;
        totalCreditsMigrated: number;
        preview?: Array<{
          userId: string;
          email: string;
          displayName: string;
          tier: string;
          creditsMigrated: number;
          universalBalanceAfter: number;
          topupBalanceAfter: number;
        }>;
      } | null;
    };
  },

  async runLegacyTopUpBackfill() {
    const res = await fetchApi("/admin/tool-credits/legacy-migrate", {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al migrar créditos legacy");
    return json as {
      success: boolean;
      totalUsersScanned: number;
      affectedUsers: number;
      totalLegacyPurchasedCredits: number;
      migratedUsers: number;
      totalCreditsMigrated: number;
      preview: Array<{
        userId: string;
        email: string;
        displayName: string;
        tier: string;
        legacyPurchasedCredits: number;
        totalExported: number;
      }>;
      migrated: Array<{
        userId: string;
        email: string;
        displayName: string;
        tier: string;
        creditsMigrated: number;
        universalBalanceAfter: number;
        topupBalanceAfter: number;
      }>;
      lastRun?: {
        executedAt: string;
        executedBy?: string;
        migratedUsers: number;
        totalCreditsMigrated: number;
      } | null;
    };
  },

  // Plans
  async getPlans() {
    const res = await fetchApi("/admin/plans");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener planes");
    return json.plans;
  },

  async updatePlans(plans: unknown[]) {
    const res = await fetchApi("/admin/plans", {
      method: "PUT",
      body: JSON.stringify({ plans }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar planes");
    return json;
  },

  // Reports
  async getUsageReport() {
    const res = await fetchApi("/admin/reports/usage");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener reporte de uso");
    return json.usage;
  },

  async getRevenueReport() {
    const res = await fetchApi("/admin/reports/revenue");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener reporte de ingresos");
    return json;
  },
  async getRegionalStats(): Promise<{
    byRegion: Record<string, number>;
    byCountry: Array<{ country: string; count: number }>;
    totalWithCountry: number;
    totalWithoutCountry: number;
    total: number;
  }> {
    const res = await fetchApi("/admin/reports/regional-stats");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener estadísticas regionales");
    return json;
  },

  async addExpense(data: { description: string; amount: number; category?: string }) {
    const res = await fetchApi("/admin/expenses", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al agregar gasto");
    return json;
  },
  // Lane Matrix Admin
  async getLaneMatrixConfig() {
    const res = await fetchApi("/admin/ai-lane-matrix");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener lane matrix");
    return json;
  },

  async saveLaneMatrixConfig(config: Record<string, unknown>) {
    const res = await fetchApi("/admin/ai-lane-matrix", {
      method: "PUT",
      body: JSON.stringify({ config }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al guardar lane matrix");
    return json;
  },

  async resetLaneMatrixConfig() {
    const res = await fetchApi("/admin/ai-lane-matrix", {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al resetear lane matrix");
    return json;
  },

  // Alerts
  async getAlerts() {
    const res = await fetchApi("/admin/alerts");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener alertas");
    return json.alerts;
  },

  async updateAlerts(alerts: Record<string, unknown>) {
    const res = await fetchApi("/admin/alerts", {
      method: "PUT",
      body: JSON.stringify(alerts),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar alertas");
    return json;
  },

  // Emails
  async sendEmail(data: { to?: string | string[]; subject: string; message: string; recipientType?: string }) {
    const res = await fetchApi("/admin/email", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al enviar email");
    return json;
  },

  async listEmails() {
    const res = await fetchApi("/admin/emails");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al listar emails");
    return json.emails;
  },

  // Logs
  async getLogs() {
    const res = await fetchApi("/admin/logs");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener logs");
    return json.logs;
  },

  // User Activity Log (admin)
  async getUserActivity(userId: string, limit = 100) {
    const res = await fetchApi(`/admin/activity/${userId}?limit=${limit}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener actividad");
    return json.activity || [];
  },

  // KPI Dashboard
  async getKPI() {
    const res = await fetchApi("/admin/kpi");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener KPIs");
    return json.kpi;
  },

  // Credit Packs
  async getCreditPacks() {
    const res = await fetchApi("/admin/credit-packs");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener packs");
    return json.creditPacks;
  },

  async updateCreditPacks(creditPacks: unknown[]) {
    const res = await fetchApi("/admin/credit-packs", {
      method: "PUT",
      body: JSON.stringify({ creditPacks }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar packs");
    return json;
  },

  // Limits & Costs
  async getLimits() {
    const res = await fetchApi("/admin/limits");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener limites");
    return json;
  },

  async updateLimits(data: { limits?: unknown; costs?: unknown }) {
    const res = await fetchApi("/admin/limits", {
      method: "PUT",
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar limites");
    return json;
  },

  // Promotions
  async getPromotions() {
    const res = await fetchApi("/admin/promotions");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener promociones");
    return json.promotions;
  },

  async updatePromotions(promotions: unknown[]) {
    const res = await fetchApi("/admin/promotions", {
      method: "PUT",
      body: JSON.stringify({ promotions }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar promociones");
    return json;
  },

  async deletePromotion(id: string) {
    const res = await fetchApi(`/admin/promotions/${id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al eliminar promocion");
    return json;
  },

  // Tool Credits
  async getToolCredits() {
    const res = await fetchApi("/admin/tool-credits");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener tool credits");
    return json.toolCredits;
  },

  async updateToolCredits(toolCredits: unknown) {
    const res = await fetchApi("/admin/tool-credits", {
      method: "PUT",
      body: JSON.stringify({ toolCredits }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar tool credits");
    return json.toolCredits;
  },

  // AI Budget
  async getAIBudget(): Promise<AdminAIBudgetRecord> {
    const res = await fetchApi("/admin/ai-budget");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener AI budget");
    if (!json?.budget || !json?.computed) throw new Error("Respuesta inválida: falta snapshot del AI budget");
    return json as AdminAIBudgetRecord;
  },

  async updateAIBudget(budget: unknown) {
    const res = await fetchApi("/admin/ai-budget", {
      method: "PUT",
      body: JSON.stringify({ budget }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar AI budget");
    return json.budget;
  },

  // Image Limits
  async getImageLimits() {
    const res = await fetchApi("/admin/image-limits");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener image limits");
    return json.imageLimits;
  },

  async updateImageLimits(imageLimits: unknown) {
    const res = await fetchApi("/admin/image-limits", {
      method: "PUT",
      body: JSON.stringify({ imageLimits }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar image limits");
    return json.imageLimits;
  },

  // Community Models (superadmin)
  async listCommunityModels(params?: {
    q?: string;
    id?: string;
    authorId?: string;
    authorUsername?: string;
    status?: "all" | "draft" | "pendingReview" | "published" | "archived";
    modelType?: "all" | "parametric" | "relief";
    featured?: boolean;
    from?: string;
    to?: string;
    sort?: "updated_desc" | "created_desc" | "created_asc" | "likes_desc" | "downloads_desc";
    page?: number;
    limit?: number;
    includeSource?: boolean;
  }): Promise<{ models: CommunityModelResponse[]; total: number; page: number; limit: number }> {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.id) qs.set("id", params.id);
    if (params?.authorId) qs.set("authorId", params.authorId);
    if (params?.authorUsername) qs.set("authorUsername", params.authorUsername);
    if (params?.status) qs.set("status", params.status);
    if (params?.modelType) qs.set("modelType", params.modelType);
    if (params?.featured !== undefined) qs.set("featured", String(params.featured));
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.sort) qs.set("sort", params.sort);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.includeSource) qs.set("includeSource", "true");
    const query = qs.toString();
    const res = await fetchApi(`/admin/community/models${query ? `?${query}` : ""}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al listar modelos de comunidad");
    return json;
  },

  /** Approve or reject a pending community model */
  async moderateModel(id: string, action: "approve" | "reject", rejectionReason?: string): Promise<{ model: CommunityModelResponse; action: string }> {
    const res = await fetchApi(`/admin/community/models/${id}/moderate`, {
      method: "PUT",
      body: JSON.stringify({ action, rejectionReason }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al moderar modelo");
    return json;
  },

  // CMS – Hero Banner
  async getHeroBanner() {
    const res = await fetchApi("/content/hero-banner");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener hero banner");
    return json.config;
  },

  async updateHeroBanner(config: Record<string, unknown>) {
    const res = await fetchApi("/content/hero-banner", {
      method: "PUT",
      body: JSON.stringify({ config }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar hero banner");
    return json.config;
  },

  async listDonations(params?: {
    q?: string;
    status?: "all" | "completed" | "created" | "capturing" | "failed";
    limit?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    const res = await fetchApi(`/admin/donations${query ? `?${query}` : ""}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al listar donaciones");
    return {
      donations: (json.donations || []) as AdminDonationRecord[],
      contributors: (json.contributors || []) as AdminContributorRecord[],
      stats: (json.stats || {
        totalOrders: 0,
        completedOrders: 0,
        failedOrders: 0,
        publicContributors: 0,
        uniqueContributors: 0,
        totalCapturedUsd: 0,
      }) as AdminDonationStats,
    };
  },

  async updateContributorVisibility(userId: string, input: {
    publicContributor?: boolean;
    message?: string | null;
  }) {
    const res = await fetchApi(`/admin/contributors/${userId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar colaborador");
    return json.summary as AdminContributorRecord;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT API (Public – no auth required)
// ═══════════════════════════════════════════════════════════════════════════════

export const ContentApi = {
  /** Get the hero banner content (public, no auth) */
  async getHeroBanner(): Promise<Record<string, any> | null> {
    try {
      const res = await fetch(`${BASE_URL}/content/hero-banner`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.config || null;
    } catch {
      return null;
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// NEWS API (Public – no auth required)
// ═══════════════════════════════════════════════════════════════════════════════

export interface NewsSourceSummary {
  id: string;
  slug: string;
  name: string;
  type?: string;
  language?: "es" | "en";
}

export interface NewsArticleResponse {
  id: string;
  slug: string;
  sourceId?: string;
  source?: NewsSourceSummary | null;
  canonicalUrl: string;
  titleOriginal: string;
  titleDisplayEs: string;
  summaryEs: string;
  detailEs: string;
  titleDisplayEn?: string | null;
  summaryEn?: string | null;
  detailEn?: string | null;
  titleDisplay: string;
  summary: string;
  detail: string;
  sourceExcerpt?: string | null;
  imageUrl?: string | null;
  author?: string | null;
  category?: string | null;
  tags: string[];
  sourceLanguage?: string | null;
  publishedAt?: string | null;
  fetchedAt?: string | null;
  expiresAt?: string | null;
  status?: string;
  editorialTier?: "brief" | "indexable" | "evergreen";
  indexable?: boolean;
  whyItMatters?: string | null;
  ctaTextEs?: string | null;
  ctaTextEn?: string | null;
  ctaUrl?: string | null;
  editorialContext?: string | null;
  requestedLanguage?: "es" | "en" | null;
  availableLanguages: Array<"es" | "en">;
}

export interface NewsListResponse {
  articles: NewsArticleResponse[];
  total: number;
  page: number;
  limit: number;
}

function normalizeNewsArticle(raw: any): NewsArticleResponse {
  const source = raw?.source ?? raw?.newsSource ?? null;
  return {
    id: String(raw?.id ?? raw?.slug ?? ""),
    slug: String(raw?.slug ?? raw?.id ?? ""),
    sourceId: raw?.sourceId ? String(raw.sourceId) : source?.id ? String(source.id) : undefined,
    source: source
      ? {
          id: String(source.id ?? source.slug ?? ""),
          slug: String(source.slug ?? source.id ?? ""),
          name: String(source.name ?? source.slug ?? "Source"),
          type: source.type ? String(source.type) : undefined,
          language: String(source.language ?? "").toLowerCase().startsWith("es") ? "es" : "en",
        }
      : null,
    canonicalUrl: String(raw?.canonicalUrl ?? raw?.url ?? ""),
    titleOriginal: String(raw?.titleOriginal ?? raw?.title ?? ""),
    titleDisplayEs: String(raw?.titleDisplayEs ?? raw?.titleDisplay ?? raw?.title ?? ""),
    summaryEs: String(raw?.summaryEs ?? raw?.summary ?? raw?.excerpt ?? ""),
    detailEs: String(raw?.detailEs ?? raw?.detail ?? raw?.body ?? ""),
    titleDisplayEn: raw?.titleDisplayEn ?? null,
    summaryEn: raw?.summaryEn ?? null,
    detailEn: raw?.detailEn ?? null,
    titleDisplay: String(raw?.titleDisplay ?? raw?.titleDisplayEs ?? raw?.titleDisplayEn ?? raw?.title ?? ""),
    summary: String(raw?.summary ?? raw?.summaryEs ?? raw?.summaryEn ?? raw?.excerpt ?? ""),
    detail: String(raw?.detail ?? raw?.detailEs ?? raw?.detailEn ?? raw?.body ?? ""),
    sourceExcerpt: raw?.sourceExcerpt ?? raw?.excerpt ?? null,
    imageUrl: raw?.imageUrl ?? raw?.image ?? null,
    author: raw?.author ?? null,
    category: raw?.category ?? null,
    tags: Array.isArray(raw?.tags) ? raw.tags.map((tag: unknown) => String(tag)).filter(Boolean) : [],
    sourceLanguage: raw?.sourceLanguage ?? null,
    publishedAt: raw?.publishedAt ?? null,
    fetchedAt: raw?.fetchedAt ?? null,
    expiresAt: raw?.expiresAt ?? null,
    status: raw?.status ? String(raw.status) : undefined,
    editorialTier:
      raw?.editorialTier === "evergreen"
        ? "evergreen"
        : raw?.editorialTier === "indexable"
          ? "indexable"
          : raw?.editorialTier === "brief"
            ? "brief"
            : undefined,
    indexable: typeof raw?.indexable === "boolean" ? raw.indexable : undefined,
    whyItMatters: raw?.whyItMatters ?? null,
    ctaTextEs: raw?.ctaTextEs ?? null,
    ctaTextEn: raw?.ctaTextEn ?? null,
    ctaUrl: raw?.ctaUrl ?? null,
    editorialContext: raw?.editorialContext ?? null,
    requestedLanguage: raw?.requestedLanguage ? (String(raw.requestedLanguage).toLowerCase().startsWith("en") ? "en" : "es") : null,
    availableLanguages: Array.isArray(raw?.availableLanguages)
      ? raw.availableLanguages
          .map((lang: unknown) => (String(lang).toLowerCase().startsWith("en") ? "en" : "es"))
          .filter((lang: "es" | "en", index: number, arr: Array<"es" | "en">) => arr.indexOf(lang) === index)
      : ["es"],
  };
}

function normalizeNewsList(json: any): NewsListResponse {
  const articlesRaw = json?.articles ?? json?.items ?? json?.news ?? [];
  const articles = Array.isArray(articlesRaw) ? articlesRaw.map(normalizeNewsArticle) : [];
  return {
    articles,
    total: Number(json?.total ?? articles.length ?? 0),
    page: Number(json?.page ?? 1),
    limit: Number(json?.limit ?? articles.length ?? 0),
  };
}

export const NewsApi = {
  async list(params?: {
    source?: string;
    category?: string;
    sourceLanguage?: "es" | "en";
    lang?: "es" | "en";
    page?: number;
    limit?: number;
  }): Promise<NewsListResponse> {
    const qs = new URLSearchParams();
    if (params?.source) qs.set("source", params.source);
    if (params?.category) qs.set("category", params.category);
    if (params?.sourceLanguage) qs.set("sourceLanguage", params.sourceLanguage);
    if (params?.lang) qs.set("lang", params.lang);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    const res = await fetch(`${BASE_URL}/news${query ? `?${query}` : ""}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || "Error al listar noticias");
    }
    return normalizeNewsList(json);
  },

  async getBySlug(slug: string, params?: { lang?: "es" | "en" }): Promise<NewsArticleResponse> {
    const qs = new URLSearchParams();
    if (params?.lang) qs.set("lang", params.lang);
    const res = await fetch(`${BASE_URL}/news/${encodeURIComponent(slug)}${qs.size ? `?${qs.toString()}` : ""}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || "Noticia no encontrada");
    }
    const item = json?.article ?? json?.news ?? json?.item ?? json;
    return normalizeNewsArticle(item);
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAYPAL API
// ═══════════════════════════════════════════════════════════════════════════════

export const PaypalApi = {
  /** Get PayPal client ID for SDK initialization */
  async getClientId(): Promise<{ clientId: string; mode: string } | null> {
    try {
      const res = await fetch(`${BASE_URL}/paypal/client-id`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  /** Create a PayPal order for a universal top-up pack */
  async createOrder(packId: string, packName: string, price: number) {
    const res = await fetchApi("/paypal/create-order", {
      method: "POST",
      body: JSON.stringify({ packId, packName, price }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al crear orden PayPal");
    return json as { orderId: string; status: string; approveUrl?: string | null };
  },

  /** Capture a PayPal order after user approves payment */
  async captureOrder(orderId: string, packId: string) {
    const res = await fetchApi("/paypal/capture-order", {
      method: "POST",
      body: JSON.stringify({ orderId, packId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al capturar pago");
    return json as {
      success: boolean;
      credits: number;
      totalCredits: number;
      message: string;
      toolCredits?: {
        balance: number;
        monthlyAllocation: number;
        monthlyBalance: number;
        topupBalance: number;
        totalUsed: number;
        lastResetAt: string;
        tier: string;
      };
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS API.
// ═══════════════════════════════════════════════════════════════════════════════

export const SubscriptionsApi = {
  /** Create a PayPal subscription and receive approval URL. */
  async createSubscription(tier: string, billing: "monthly" | "yearly" = "monthly") {
    const res = await fetchApi("/subscriptions/create", {
      method: "POST",
      body: JSON.stringify({ tier, billing }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al crear suscripción");
    return json as { subscriptionId?: string; status?: string; approveUrl?: string | null; error?: string };
  },

  /** Get current user's active subscription, if any. */
  async getMySubscription() {
    const res = await fetchApi("/subscriptions/my-subscription");
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return json.subscription ?? null;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY API
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReliefConfig {
  imageData: string;
  subdivisions: number;
  maxHeight: number;
  smoothing: number;
  imageScale?: number;
  imageScaleMode?: "clamp" | "wrap";
  imageRepeatX?: boolean;
  imageRepeatY?: boolean;
  gapFillMode?: "edge" | "color-hard" | "color-soft" | "color" | "white-hard" | "white-soft";
  gapFillColor?: string;
  plateWidth: number;
  plateDepth: number;
  lockAspect?: boolean;
  surfaceMode?: "plane" | "cylinder" | "box" | "polygon" | "lampshade" | "geodesic" | "stl";
  cylinderRadius?: number;
  cylinderHeight?: number;
  cylinderRepeats?: number;
  cylinderFlipH?: boolean;
  cylinderFlipV?: boolean;
  boxHeight?: number;
  boxCapTop?: boolean;
  boxCapBottom?: boolean;
  polygonSides?: number;
  polygonRadius?: number;
  polygonHeight?: number;
  polygonCapTop?: boolean;
  polygonCapBottom?: boolean;
  lampshadeOuterRadiusBottom?: number;
  lampshadeOuterRadiusTop?: number;
  lampshadeHoleRadius?: number;
  lampshadeHeight?: number;
  lampshadeCap?: "top" | "bottom" | "both" | "none";
  lampshadeSides?: number;
  geodesicRadius?: number;
  threeMfColorMode?: "hybrid" | "slic3r-strict" | "split-objects";
  invert: boolean;
  solid: boolean;
  baseThickness: number;
  colorZones: number;
}

export interface CommunityModelMedia {
  id?: string;
  url: string;
  order?: number;
  source?: "auto_capture" | "user_upload";
  isCover?: boolean;
  createdAt?: string;
}

export interface CommunityModelResponse {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  scadSource: string;
  modelType?: "parametric" | "relief";
  reliefConfig?: ReliefConfig;
  tags: string[];
  thumbnailUrl: string | null;
  media?: CommunityModelMedia[];
  slug?: string;
  canonicalPath?: string;
  likes: number;
  downloads: number;
  commentCount?: number;
  featured: boolean;
  status: string;
  license?: string;
  // Fork fields
  forkedFromId?: string;
  forkedFromTitle?: string;
  forkedFromAuthor?: string;
  forkChain?: string[];
  forkCount?: number;
  rejectionReason?: string | null;
  moderatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityTag {
  name: string;
  slug: string;
  modelCount: number;
}

export const CommunityApi = {
  /** List community models with optional filters */
  async listModels(params?: {
    search?: string;
    tag?: string;
    sort?: "recent" | "popular" | "downloads" | "most_forked";
    featured?: boolean;
    authorId?: string;
    status?: "draft" | "published" | "all";
    page?: number;
    limit?: number;
  }): Promise<{ models: CommunityModelResponse[]; total: number; page: number; limit: number }> {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.tag) qs.set("tag", params.tag);
    if (params?.sort) qs.set("sort", params.sort);
    if (params?.featured) qs.set("featured", "true");
    if (params?.authorId) qs.set("authorId", params.authorId);
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    const res = await fetchApi(`/community/models${query ? `?${query}` : ""}`);
    if (!res.ok) throw new Error("Error al listar modelos");
    return res.json();
  },

  /** Get single model */
  async getModel(id: string): Promise<CommunityModelResponse> {
    const res = await fetchApi(`/community/models/${id}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Modelo no encontrado");
    return json.model;
  },

  /** Publish a new community model (or save as draft) */
  async publishModel(data: {
    title: string;
    scadSource?: string;
    tags?: string[];
    thumbnailUrl?: string;
    media?: CommunityModelMedia[];
    forkedFromId?: string;
    status?: "draft" | "published" | "pendingReview";
    modelType?: "parametric" | "relief";
    reliefConfig?: ReliefConfig;
  }): Promise<CommunityModelResponse> {
    const res = await fetchApi("/community/models", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al publicar");
    return json.model;
  },

  /** Update own model */
  async updateModel(id: string, data: Partial<{
    title: string;
    scadSource: string;
    tags: string[];
    thumbnailUrl: string;
    media: CommunityModelMedia[];
    status: string;
    reliefConfig: ReliefConfig;
  }>): Promise<CommunityModelResponse> {
    const res = await fetchApi(`/community/models/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar");
    return json.model;
  },

  /** Delete own model */
  async deleteModel(id: string): Promise<void> {
    const res = await fetchApi(`/community/models/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || "Error al eliminar");
    }
  },

  /** Download export pack ZIP for own model */
  async downloadExportPack(id: string, title: string): Promise<void> {
    const res = await fetchApi(`/community/models/${id}/export-pack`);
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || "Error al descargar el paquete");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]
      ?? `vorea_${title.replace(/[^a-z0-9]/gi, "_").slice(0, 50)}_${id.slice(0, 8)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** Toggle like on a model */
  async toggleLike(id: string): Promise<{ liked: boolean; likes: number }> {
    const res = await fetchApi(`/community/models/${id}/like`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error en like");
    return json;
  },

  /** Track download and get SCAD source */
  async downloadModel(id: string): Promise<{
    scadSource: string;
    downloads: number;
    modelType?: "parametric" | "relief";
    reliefConfig?: ReliefConfig | null;
  }> {
    const res = await fetchApi(`/community/models/${id}/download`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error en download");
    return json;
  },

  /** Get all tags with counts */
  async listTags(): Promise<CommunityTag[]> {
    const res = await fetchApi("/community/tags");
    if (!res.ok) return [];
    const json = await res.json();
    return json.tags || [];
  },

  /** Get public user profile with models */
  async getUserProfile(userId: string) {
    const res = await fetchApi(`/community/users/${userId}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Usuario no encontrado");
    return json;
  },

  /** Toggle featured (superadmin) */
  async toggleFeatured(id: string): Promise<CommunityModelResponse> {
    const res = await fetchApi(`/community/models/${id}/feature`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error");
    return json.model;
  },

  /** Get comments for a model */
  async getComments(modelId: string): Promise<any[]> {
    const res = await fetchApi(`/community/models/${modelId}/comments`);
    const json = await res.json();
    if (!res.ok) return [];
    return json.comments || [];
  },

  /** Add a comment */
  async addComment(modelId: string, text: string) {
    const res = await fetchApi(`/community/models/${modelId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al comentar");
    return json;
  },

  /** Delete a comment */
  async deleteComment(modelId: string, commentId: string) {
    const res = await fetchApi(`/community/models/${modelId}/comments/${commentId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al eliminar");
    return json;
  },

  /** Admin: cleanup fake community models */
  async cleanupCommunityModels(dryRun = true) {
    const res = await fetchApi("/admin/community/cleanup", {
      method: "POST",
      body: JSON.stringify({ dryRun }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error en limpieza");
    return json;
  },

  /** Upload a thumbnail blob, returns the URL path */
  async uploadThumbnail(blob: Blob): Promise<string> {
    // Convert blob to base64 data URL
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const res = await fetchApi("/uploads/thumbnail", {
      method: "POST",
      body: JSON.stringify({ data: dataUrl }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al subir thumbnail");
    return json.url; // e.g. "/api/uploads/thumbnail/thumb_xxx"
  },

  /** Upload a user image for a community model gallery */
  async uploadCommunityImage(blob: Blob): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const res = await fetchApi("/uploads/community-image", {
      method: "POST",
      body: JSON.stringify({ data: dataUrl }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al subir imagen");
    return json.url; // e.g. "/api/uploads/community-image/img_xxx"
  },

  /** List forks of a model */
  async listForks(modelId: string): Promise<{ forks: CommunityModelResponse[]; total: number }> {
    const res = await fetchApi(`/community/models/${modelId}/forks`);
    if (!res.ok) return { forks: [], total: 0 };
    return res.json();
  },

  /** Save a model as draft (convenience wrapper) */
  async saveDraft(data: {
    title: string;
    scadSource: string;
    tags?: string[];
    thumbnailUrl?: string;
    forkedFromId?: string;
  }): Promise<CommunityModelResponse> {
    return this.publishModel({ ...data, status: "draft" });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// REWARDS API
// ═══════════════════════════════════════════════════════════════════════════════

export const RewardsApi = {
  /** Get current user's rewards */
  async getMyRewards() {
    const res = await fetchApi("/rewards/me");
    if (!res.ok) return null;
    const json = await res.json();
    return json.rewards;
  },

  /** Get leaderboard */
  async getLeaderboard(limit = 20) {
    const res = await fetchApi(`/rewards/leaderboard?limit=${limit}`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.leaderboard || [];
  },

  /** Get full rewards profile for a user */
  async getProfile(userId: string) {
    const res = await fetchApi(`/rewards/${userId}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener perfil de recompensas");
    return json;
  },

  /** Trigger a reward action (earn XP) */
  async triggerAction(userId: string, action: string) {
    void userId; // Backward compatibility: server now uses authenticated user from JWT.
    const res = await fetchApi("/rewards/trigger", {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al registrar accion");
    return json;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRIBUTORS / DONATIONS API
// ═══════════════════════════════════════════════════════════════════════════════

export type DonationTierId = "impulsor" | "aliado" | "patrono" | "mecenas";

export type DonationTierRecord = {
  id: DonationTierId;
  suggestedAmountUsd: number;
  minimumTotalUsd: number;
  badgeId: string;
};

export type PublicContributorRecord = {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  tierId: DonationTierId;
  badgeId: string;
  donationCount: number;
  joinedAt: string;
  lastDonatedAt: string;
  message: string | null;
};

export type DonationSummaryRecord = {
  userId: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string | null;
  totalDonatedUsd: number;
  donationCount: number;
  tierId: DonationTierId;
  badgeId: string;
  publicContributor: boolean;
  lastDonatedAt: string;
  joinedAt: string;
  message: string | null;
  updatedAt?: string;
};

export type AdminDonationRecord = {
  orderId: string;
  donationId: string | null;
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  tierId: DonationTierId;
  awardedTierId: DonationTierId;
  badgeId: string;
  amountUsd: number | null;
  currency: string;
  status: string;
  visibility: "public" | "anonymous";
  publicContributor: boolean;
  currentMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  lastDonatedAt: string;
  captureId: string | null;
};

export type AdminContributorRecord = DonationSummaryRecord;

export type AdminDonationStats = {
  totalOrders: number;
  completedOrders: number;
  failedOrders: number;
  publicContributors: number;
  uniqueContributors: number;
  totalCapturedUsd: number;
};

export const ContributorsApi = {
  async list() {
    const res = await fetchApi("/contributors");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al cargar colaboradores");
    return {
      tiers: (json.tiers || []) as DonationTierRecord[],
      contributors: (json.contributors || []) as PublicContributorRecord[],
      stats: json.stats || { publicContributors: 0 },
    };
  },
};

export const DonationsApi = {
  async getMine() {
    const res = await fetchApi("/donations/me");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al cargar donaciones");
    return {
      tiers: (json.tiers || []) as DonationTierRecord[],
      summary: (json.summary || null) as DonationSummaryRecord | null,
      donations: (json.donations || []) as Array<Record<string, unknown>>,
    };
  },

  async updateMine(input: {
    publicContributor?: boolean;
    message?: string | null;
  }) {
    const res = await fetchApi("/donations/me", {
      method: "PUT",
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar reconocimiento");
    return {
      summary: (json.summary || null) as DonationSummaryRecord | null,
    };
  },

  async createOrder(input: {
    tierId: DonationTierId;
    isPublic: boolean;
    message?: string;
  }) {
    const res = await fetchApi("/donations/create-order", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al crear orden de aporte");
    return json as {
      orderId: string;
      status: string;
      tierId: DonationTierId;
      amountUsd: number;
      visibility: "public" | "anonymous";
      approveUrl: string | null;
    };
  },

  async captureOrder(orderId: string) {
    const res = await fetchApi("/donations/capture-order", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al capturar aporte");
    return json as {
      success: boolean;
      alreadyProcessed?: boolean;
      donationId: string | null;
      tierId: DonationTierId;
      badgeId: string | null;
      totalDonatedUsd: number;
      publicContributor: boolean;
      message?: string;
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROMOTIONS API (Coupon validation & redemption)
// ═══════════════════════════════════════════════════════════════════════════════

export const PromotionsApi = {
  /** Validate a coupon code (public, no auth required) */
  async validateCoupon(code: string, tier?: string) {
    const res = await fetchApi("/promotions/validate", {
      method: "POST",
      body: JSON.stringify({ code, tier }),
    });
    return res.json();
  },

  /** Redeem a coupon (requires auth) */
  async redeemCoupon(promoId: string) {
    const res = await fetchApi("/promotions/redeem", {
      method: "POST",
      body: JSON.stringify({ promoId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al canjear cupón");
    return json;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// VAULT API (BYOK – Bring Your Own Key)
// ═══════════════════════════════════════════════════════════════════════════════

export interface VaultKeyEntry {
  provider: string;
  label: string;
  maskedKey: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export const VaultApi = {
  /** List user's stored API keys (masked, never exposes real key) */
  async listKeys(): Promise<{ keys: VaultKeyEntry[]; supportedProviders: string[] } | null> {
    const res = await fetchApi("/vault/keys");
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      if (json.upgradeRequired) return null; // FREE tier
      return null;
    }
    return res.json();
  },

  /** Save or update an API key for a provider */
  async saveKey(provider: string, apiKey: string, label?: string) {
    const res = await fetchApi(`/vault/keys/${provider}`, {
      method: "PUT",
      body: JSON.stringify({ apiKey, label }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al guardar key");
    return json as { success: boolean; provider: string; maskedKey: string; label: string };
  },

  /** Delete a stored API key */
  async deleteKey(provider: string) {
    const res = await fetchApi(`/vault/keys/${provider}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al eliminar key");
    return json;
  },

  /** Test if a stored key is valid by pinging the provider API */
  async testKey(provider: string): Promise<{ valid: boolean; message: string; provider: string }> {
    const res = await fetchApi(`/vault/keys/${provider}/test`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al testear key");
    return json;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// News Sources Admin API
// ═══════════════════════════════════════════════════════════════════════════════

export type NewsSourceEditorialPolicy = "standard" | "brief_only";

export interface NewsSourceAdminRecord {
  id: string;
  slug: string;
  name: string;
  type: string;
  language: "es" | "en";
  baseUrl: string;
  feedUrl: string | null;
  listingUrl: string | null;
  fetchMode: string;
  enabled: boolean;
  priority: number;
  editorialPolicy: NewsSourceEditorialPolicy;
  editorialNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewsSourceAdminInput {
  name?: string;
  type?: string;
  language?: "es" | "en";
  baseUrl?: string;
  feedUrl?: string | null;
  listingUrl?: string | null;
  fetchMode?: string;
  enabled?: boolean;
  priority?: number;
  editorialPolicy?: NewsSourceEditorialPolicy;
  editorialNotes?: string | null;
}

export const NewsAdminApi = {
  async listSources(): Promise<NewsSourceAdminRecord[]> {
    const res = await fetchApi("/admin/news/sources");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al listar fuentes");
    return (json.sources || []) as NewsSourceAdminRecord[];
  },

  async updateSource(id: string, data: NewsSourceAdminInput): Promise<NewsSourceAdminRecord> {
    const res = await fetchApi(`/admin/news/sources/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al actualizar fuente");
    return json.source as NewsSourceAdminRecord;
  },

  async createSource(data: NewsSourceAdminInput): Promise<NewsSourceAdminRecord> {
    const res = await fetchApi("/admin/news/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al crear fuente");
    return json.source as NewsSourceAdminRecord;
  },

  async deleteSource(id: string) {
    const res = await fetchApi(`/admin/news/sources/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al eliminar fuente");
    return json;
  },

  async triggerIngest(): Promise<{ insertedCount: number; updatedCount: number; skippedCount: number }> {
    const res = await fetchApi("/admin/news/ingest", { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al ingestar noticias");
    return json;
  },

  async getSourceStats(): Promise<Array<{
    sourceId: string;
    total: number;
    brief: number;
    indexable: number;
    evergreen: number;
    lastPublishedAt: string | null;
  }>> {
    const res = await fetchApi("/admin/news/source-stats");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener stats");
    return json.stats || [];
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TELEMETRY API (Engine analytics for SuperAdmin)
// ═══════════════════════════════════════════════════════════════════════════════

export interface TelemetryInsights {
  daysBack: number;
  totalEvents: number;
  byTrigger: Array<{ trigger: string; count: number }>;
  bySurfaceMode: Array<{ surfaceMode: string; count: number }>;
  byMeshScore: Array<{ meshScore: string; count: number }>;
  warningCombos: Array<{ surfaceMode: string; subdivisions: number | null; count: number }>;
  avgGenTime: Array<{ surfaceMode: string; avgMs: number }>;
}

export const TelemetryApi = {
  async getInsights(days = 30): Promise<TelemetryInsights> {
    const res = await fetchApi(`/telemetry/insights?days=${days}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Error al obtener telemetría");
    return json as TelemetryInsights;
  },
};

