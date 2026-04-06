import { Hono } from "hono";
import * as auth from "./auth.js";
import * as kv from "./kv.js";
import {
  applyRateLimitHeaders,
  consumeRateLimit,
  getClientIp,
} from "./middleware/rate-limit.js";
import {
  checkAIBudget,
  getModelCostPer1kTokens,
  recordAIUsage,
  normalizeAIProviderConfig,
  type AIProviderConfig,
} from "./ai-generation-engine.js";
import {
  buildGenerationContract,
  buildAiStudioConfigDashboard,
  executeNormalizedGeneration,
  recordGenerationTrace,
  RoutedGenerationError,
  type PromptIngress,
} from "./ai-studio-pipeline.js";
import { getPrismaClient } from "./prisma.js";
import {
  reserveCredits,
  releaseCredits,
  getIdempotencyRecord,
  markGenerationInProgress,
  markGenerationCompleted,
  clearIdempotencyRecord,
} from "./credit-ledger.js";

const app = new Hono();
const prisma = getPrismaClient();

function sanitizeAlertThresholds(values: unknown): number[] {
  if (!Array.isArray(values)) return [50, 75, 90];
  return [...new Set(values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100))]
    .sort((a, b) => a - b);
}

// Helper to get userId
async function getUserId(c: any): Promise<string | null> {
  return auth.getUserIdFromHeader(c.req.header("Authorization"));
}

async function requireAdmin(c: any): Promise<boolean> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) { console.log("[requireAdmin] Falla: Sin Auth Header"); return false; }
  const token = authHeader.split(" ")[1];
  if (!token) { console.log("[requireAdmin] Falla: Token partido vacío"); return false; }
  const payload = auth.verifyJwt(token);
  if (!payload) { console.log("[requireAdmin] Falla: JWT Invalido o Expirado"); return false; }
  
  const role = payload.role;
  if (role === "admin" || role === "superadmin") {
    return true;
  }

  const email = String(payload.email || "");
  const fallbackAdmins = ["vorea.studio3d@gmail.com", "admin@vorea.studio", "martindaguerre@gmail.com"];
  if (fallbackAdmins.includes(email)) {
    return true;
  }
  
  console.log(`[requireAdmin] Falla: Rol no admin (Rol: ${role}, Email: ${email})`);
  return false;
}

async function getCurrentMonthlyRevenue(): Promise<number> {
  const paypalOrders = (await kv.getByPrefix("paypal:order:")) as any[];
  const currentMonth = new Date().toISOString().slice(0, 7);
  return paypalOrders
    .filter((order: any) => order.status === "COMPLETED" && String(order.capturedAt || order.createdAt || "").startsWith(currentMonth))
    .reduce((sum: number, order: any) => sum + Number(order.price || 0), 0);
}

function estimateGenerationUsd(provider: string, model: string, quality: "draft" | "final"): number {
  const multiplier = quality === "final" ? 6 : 4;
  return Number((getModelCostPer1kTokens(provider, model) * multiplier).toFixed(6));
}

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
      success: false,
      error: message,
      code: "RATE_LIMITED",
      retryAfter: result.retryAfter,
    },
    429
  );
}

// ─── Admin: AI Engine Config ────────────────────────────────────────────────

app.get("/config", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "No autorizado" }, 403);

  try {
    const budget = ((await kv.get("admin:ai_budget")) as any) || {
      globalMonthlyBudgetUsd: 100,
      maxBudgetPercentOfRevenue: 100,
      currentMonthSpentUsd: 0,
      currentMonth: new Date().toISOString().slice(0, 7),
      perTierDailyLimits: { FREE: 1, PRO: 20, "STUDIO PRO": -1 },
      circuitBreakerEnabled: true,
    };
    const monthlyRevenue = await getCurrentMonthlyRevenue();
    return c.json(await buildAiStudioConfigDashboard(prisma, budget, monthlyRevenue));
  } catch (err: any) {
    console.error("GET /config error:", err);
    return c.json({ error: "Error obteniendo configuración del motor IA" }, 500);
  }
});

app.put("/config", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "No autorizado" }, 403);

  try {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "Body inválido" }, 400);
    }

    const current = (await buildAiStudioConfigDashboard(
      prisma,
      (((await kv.get("admin:ai_budget")) as any) || {
        globalMonthlyBudgetUsd: 100,
        maxBudgetPercentOfRevenue: 100,
        currentMonthSpentUsd: 0,
        currentMonth: new Date().toISOString().slice(0, 7),
        perTierDailyLimits: { FREE: 1, PRO: 20, "STUDIO PRO": -1 },
        circuitBreakerEnabled: true,
      }),
      await getCurrentMonthlyRevenue()
    )).config;
    const requestedProvider = String(body.activeProvider || current.activeProvider);
    const requestedModels = current.providers[requestedProvider]?.models || [];
    const requestedModel = String(body.activeModel || requestedModels[0]?.id || current.activeModel);

    const nextConfig = normalizeAIProviderConfig({
      activeProvider: requestedProvider,
      activeModel: requestedModel,
      manualMode: body.manualMode ?? current.manualMode,
      alertThresholds: sanitizeAlertThresholds(body.alertThresholds ?? current.alertThresholds),
    } as Partial<AIProviderConfig>);

    if (!current.providers[requestedProvider]) {
      return c.json({ error: `Proveedor no soportado: ${requestedProvider}` }, 400);
    }

    if (nextConfig.manualMode && !current._selectableProviders.includes(requestedProvider)) {
      const hasKey = current._availableProviders.includes(requestedProvider);
      return c.json({
        error: hasKey
          ? `El proveedor '${requestedProvider}' tiene API key cargada, pero su adaptador aún no está habilitado en runtime.`
          : `El proveedor '${requestedProvider}' no tiene una API key válida configurada en el servidor.`,
      }, 400);
    }

    await kv.set("admin:ai_config", nextConfig);

    return c.json(await buildAiStudioConfigDashboard(
      prisma,
      (((await kv.get("admin:ai_budget")) as any) || {
        globalMonthlyBudgetUsd: 100,
        maxBudgetPercentOfRevenue: 100,
        currentMonthSpentUsd: 0,
        currentMonth: new Date().toISOString().slice(0, 7),
        perTierDailyLimits: { FREE: 1, PRO: 20, "STUDIO PRO": -1 },
        circuitBreakerEnabled: true,
      }),
      await getCurrentMonthlyRevenue()
    ));
  } catch (err: any) {
    console.error("PUT /config error:", err);
    return c.json({ error: "Error guardando configuración del motor IA" }, 500);
  }
});

// ─── Cloud Vault (Recipes API) ─────────────────────────────────────────

app.get("/recipes", async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: "No autorizado" }, 401);
  }

  try {
    const recipes = await prisma.aiStudioRecipe.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return c.json({ recipes });
  } catch (err: any) {
    console.error("GET /recipes error:", err);
    return c.json({ error: "Error interno del servidor" }, 500);
  }
});

app.post("/recipes", async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: "No autorizado" }, 401);
  }

  try {
    const body = await c.req.json();
    const { name, engine, familyHint, quality, prompt, parameterOverrides } = body;

    const newRecipe = await prisma.aiStudioRecipe.create({
      data: {
        userId,
        name,
        engine,
        familyHint,
        quality,
        prompt,
        parameterOverrides: parameterOverrides || {},
      },
    });

    return c.json({ success: true, recipe: newRecipe });
  } catch (err: any) {
    console.error("POST /recipes error:", err);
    return c.json({ error: "Error al guardar la receta" }, 500);
  }
});

app.delete("/recipes/:id", async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: "No autorizado" }, 401);
  }

  const recipeId = c.req.param("id");
  try {
    const recipe = await prisma.aiStudioRecipe.findUnique({
      where: { id: recipeId },
    });

    if (!recipe || recipe.userId !== userId) {
      return c.json({ error: "Receta no encontrada o sin origen" }, 404);
    }

    await prisma.aiStudioRecipe.delete({ where: { id: recipeId } });
    return c.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /recipes error:", err);
    return c.json({ error: "Error al borrar receta" }, 500);
  }
});

// ─── CMS: Families ────────────────────────────────────────────────────────

app.get("/families", async (c) => {
  try {
    const families = await prisma.aiStudioFamily.findMany({
      orderBy: { priority: "desc" },
    });
    return c.json({ families });
  } catch (err: any) {
    console.error("GET /families error:", err);
    return c.json({ error: "Error fetching families" }, 500);
  }
});

app.post("/upload-image", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "No autorizado" }, 403);
  try {
    const body = await c.req.json().catch(() => null);
    const dataUrl = body?.data;
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      return c.json({ error: "Falta data (base64) o formato inválido" }, 400);
    }
    const id = `fam_img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await kv.set(`community:image:${id}`, dataUrl);
    
    // Aprovechamos la ruta de lectura estática de imágenes de la comunidad para servirla sin crear otro endpoint GET
    return c.json({ url: `/api/uploads/community-image/${id}` });
  } catch (err: any) {
    console.error("POST /upload-image admin error:", err);
    return c.json({ error: "Error interno subiendo imagen de familia" }, 500);
  }
});

app.post("/families", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "No autorizado" }, 403);
  try {
    const body = await c.req.json();
    const newFamily = await prisma.aiStudioFamily.create({ data: body });
    return c.json({ success: true, family: newFamily });
  } catch (err: any) {
    console.error("POST /families error:", err);
    return c.json({ error: "Error creating family" }, 500);
  }
});

app.put("/families/:id", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "No autorizado" }, 403);
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    // Eliminar campos de id y timestamps que no deben actualizarse directamente
    const { id: _id, createdAt, updatedAt, ...updateData } = body;
    const updatedFamily = await prisma.aiStudioFamily.update({
      where: { id },
      data: updateData,
    });
    return c.json({ success: true, family: updatedFamily });
  } catch (err: any) {
    console.error("PUT /families error:", err);
    return c.json({ error: "Error updating family" }, 500);
  }
});

app.delete("/families/:id", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "No autorizado" }, 403);
  const id = c.req.param("id");
  try {
    await prisma.aiStudioFamily.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /families error:", err);
    return c.json({ error: "Error deleting family" }, 500);
  }
});

// ─── CMS: Presets ─────────────────────────────────────────────────────────

app.get("/presets", async (c) => {
  try {
    const presets = await prisma.aiStudioPreset.findMany({
      orderBy: { priority: "desc" },
    });
    return c.json({ presets });
  } catch (err: any) {
    console.error("GET /presets error:", err);
    return c.json({ error: "Error fetching presets" }, 500);
  }
});

app.post("/presets", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "No autorizado" }, 403);
  try {
    const body = await c.req.json();
    const newPreset = await prisma.aiStudioPreset.create({ data: body });
    return c.json({ success: true, preset: newPreset });
  } catch (err: any) {
    console.error("POST /presets error:", err);
    return c.json({ error: "Error creating preset" }, 500);
  }
});

app.put("/presets/:id", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "No autorizado" }, 403);
  const id = c.req.param("id");
  try {
    const body = await c.req.json();
    // Eliminar campos de id y timestamps que no deben actualizarse directamente
    const { id: _id, createdAt, updatedAt, ...updateData } = body;
    const updatedPreset = await prisma.aiStudioPreset.update({
      where: { id },
      data: updateData,
    });
    return c.json({ success: true, preset: updatedPreset });
  } catch (err: any) {
    console.error("PUT /presets error:", err);
    return c.json({ error: "Error updating preset" }, 500);
  }
});

app.delete("/presets/:id", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ error: "No autorizado" }, 403);
  const id = c.req.param("id");
  try {
    await prisma.aiStudioPreset.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /presets error:", err);
    return c.json({ error: "Error deleting preset" }, 500);
  }
});

// ─── Result Recovery Endpoint ────────────────────────────────────────────────

app.get("/generation/:generationId", async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ success: false, error: "Autenticación requerida.", code: "AUTH_REQUIRED" }, 401);
  }

  const { generationId } = c.req.param();
  if (!generationId || generationId.length > 128) {
    return c.json({ success: false, error: "generationId inválido.", code: "INVALID_PARAM" }, 400);
  }

  const record = await getIdempotencyRecord(generationId);

  if (!record) {
    return c.json({ success: false, code: "NOT_FOUND", error: "No se encontró el resultado de esta generación." }, 404);
  }

  if (record.status === "in-progress") {
    return c.json({ success: false, code: "GENERATION_IN_PROGRESS", error: "La generación aún está en curso." }, 202);
  }

  if (record.status === "completed") {
    // Security: verify the generation belongs to this user
    if (record.userId && record.userId !== userId) {
      return c.json({ success: false, error: "Acceso denegado.", code: "AUTH_REQUIRED" }, 403);
    }
    return c.json({
      success: true,
      cached: true,
      generationId,
      result: record.result,
      contract: record.contract,
      routing: record.routing,
      usage: record.usage,
    });
  }

  return c.json({ success: false, code: "NOT_FOUND", error: "Estado de generación desconocido." }, 404);
});

// ─── LLM Generation Endpoint ─────────────────────────────────────────────────

app.post("/generate", async (c) => {
  // 1. Auth check
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ success: false, error: "Autenticación requerida.", code: "AUTH_REQUIRED" }, 401);
  }
  const ip = getClientIp(c);
  const ipRateLimit = await enforceRateLimit(
    c,
    `ai-studio:generate:ip:${ip}`,
    20,
    5 * 60 * 1000,
    "Demasiadas generaciones desde esta IP. Intenta nuevamente en unos minutos."
  );
  if (ipRateLimit) return ipRateLimit;

  const userRateLimit = await enforceRateLimit(
    c,
    `ai-studio:generate:user:${userId}`,
    6,
    5 * 60 * 1000,
    "Demasiadas generaciones para esta cuenta. Intenta nuevamente en unos minutos."
  );
  if (userRateLimit) return userRateLimit;

  // 2. Parse request body
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Body JSON inválido.", code: "GENERATION_FAILED" }, 400);
  }

  const { prompt, engine, familySlug, quality, parameterOverrides } = body;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
    return c.json({ success: false, error: "El prompt es requerido (mínimo 3 caracteres).", code: "GENERATION_FAILED" }, 400);
  }
  if (prompt.length > 4000) {
    return c.json({ success: false, error: "El prompt es demasiado largo (máximo 4000 caracteres).", code: "GENERATION_FAILED" }, 400);
  }
  if (!familySlug || typeof familySlug !== "string") {
    return c.json({ success: false, error: "Familia paramétrica requerida.", code: "GENERATION_FAILED" }, 400);
  }
  if (parameterOverrides && (typeof parameterOverrides !== "object" || Array.isArray(parameterOverrides))) {
    return c.json({ success: false, error: "parameterOverrides debe ser un objeto plano.", code: "GENERATION_FAILED" }, 400);
  }
  if (parameterOverrides && Object.keys(parameterOverrides).length > 25) {
    return c.json({ success: false, error: "Demasiados parámetros personalizados (máximo 25).", code: "GENERATION_FAILED" }, 400);
  }

  // 3. Idempotency — resolve or generate a generationId
  const rawGenId = typeof body.generationId === "string" ? body.generationId.trim() : "";
  const generationId = rawGenId.length > 0 ? rawGenId : crypto.randomUUID();

  const existing = await getIdempotencyRecord(generationId);
  if (existing) {
    if (existing.status === "completed") {
      // Idempotent replay — return cached result without charging again
      console.log(`[ai-studio/generate] ♻️  Idempotent replay for generationId=${generationId}`);
      return c.json({ success: true, cached: true, ...existing } as any);
    }
    if (existing.status === "in-progress") {
      return c.json(
        { success: false, error: "Esta generación ya está en curso.", code: "GENERATION_IN_PROGRESS" },
        409
      );
    }
  }

  // Mark as in-progress to block concurrent duplicate requests
  await markGenerationInProgress(generationId);

  // 4. Get user profile and tier
  const profile = await kv.get(`user:${userId}:profile`) as any;
  const tier = String(profile?.tier || "FREE").toUpperCase().replace(/_/g, " ");

  // 5. Budget circuit breaker
  const budgetCheck = await checkAIBudget(userId, tier);
  if (!budgetCheck.allowed) {
    await clearIdempotencyRecord(generationId);
    return c.json({
      success: false,
      error: budgetCheck.reason || "Presupuesto de IA agotado.",
      code: "BUDGET_EXHAUSTED",
    }, 429);
  }

  // 6. Determine credit cost
  const toolCredits = (await kv.get("admin:tool_credits")) as any || null;
  const aiActions = toolCredits?.tools?.ai_studio?.actions || toolCredits?.tools?.ai?.actions;
  const isComplex = prompt.length > 200 || (parameterOverrides && Object.keys(parameterOverrides).length > 5);
  const actionId = isComplex ? "text_to_3d_complex" : "text_to_3d_simple";
  const actionConfig = Array.isArray(aiActions)
    ? aiActions.find((a: any) => a.actionId === actionId)
    : null;
  const creditCost = Math.max(0, Number(actionConfig?.creditCost ?? (isComplex ? 10 : 5)));

  // 7. Reserve credits via unified helper
  const reservation = await reserveCredits(userId, creditCost);
  if (!reservation.ok) {
    await clearIdempotencyRecord(generationId);
    const { reason, code } = reservation;
    return c.json({
      success: false,
      error: reason,
      code,
    }, code === "CREDITS_INSUFFICIENT" ? 402 : 500);
  }

  const creditSnapshot = reservation.snapshot;
  const balanceAfterCharge = reservation.balanceAfter;

  const budget = ((await kv.get("admin:ai_budget")) as any) || {
    globalMonthlyBudgetUsd: 100,
    maxBudgetPercentOfRevenue: 100,
    currentMonthSpentUsd: 0,
    currentMonth: new Date().toISOString().slice(0, 7),
    perTierDailyLimits: { FREE: 1, PRO: 20, "STUDIO PRO": -1 },
    circuitBreakerEnabled: true,
  };
  const monthlyRevenue = await getCurrentMonthlyRevenue();
  const ingress: PromptIngress = {
    prompt: prompt.trim(),
    engine: engine === "organic" ? "organic" : "fdm",
    familySlug,
    quality: quality === "final" ? "final" : "draft",
    parameterOverrides: parameterOverrides || undefined,
    userId,
    tier,
    locale: String(body.locale || "").trim() || null,
    sourceRecipeId: String(body.sourceRecipeId || "").trim() || null,
  };

  // 8. Call routed LLM pipeline
  try {
    console.log(`[ai-studio/generate] 🚀 Routing generation for user=${userId}, family=${familySlug}, quality=${quality}, generationId=${generationId}`);
    const generation = await executeNormalizedGeneration(prisma, {
      ingress,
      budget,
      monthlyRevenue,
      creditCost,
    });

    await recordAIUsage(
      userId,
      estimateGenerationUsd(generation.routing.provider, generation.routing.model, ingress.quality)
    );

    const responsePayload = {
      result: generation.result,
      contract: buildGenerationContract(generation.normalized, generation.result),
      usage: {
        creditsConsumed: creditCost,
        balanceRemaining: balanceAfterCharge,
      },
      routing: {
        mode: generation.routing.mode,
        provider: generation.routing.provider,
        model: generation.routing.model,
        lane: generation.routing.lane,
        reason: generation.routing.reason,
        traceId: generation.traceId,
        generationId,
        attemptHistory: generation.routing.attemptHistory || [],
      },
    };

    // *** Persist result BEFORE responding to the client ***
    // If the client disconnects here, the result is still recoverable via idempotency replay.
    await markGenerationCompleted(generationId, { userId, ...responsePayload });

    console.log(`[ai-studio/generate] ✅ Success: model="${generation.result.modelName}", scad=${generation.result.scadCode.length} chars, generationId=${generationId}`);

    return c.json({ success: true, ...responsePayload });
  } catch (err: any) {
    console.error(`[ai-studio/generate] ❌ Error: ${err.message}`);
    const routedError = err instanceof RoutedGenerationError ? err : null;

    await recordGenerationTrace(prisma, {
      ingress,
      normalized: {
        promptRaw: ingress.prompt,
        promptClean: ingress.prompt,
        promptCanonical: ingress.prompt.toLowerCase(),
        promptNormalized: ingress.prompt,
        engine: ingress.engine,
        quality: ingress.quality,
        requestedFamilySlug: ingress.familySlug,
        resolvedFamilySlug: ingress.familySlug,
        familyDisplayName: ingress.familySlug,
        sourceRecipeId: ingress.sourceRecipeId,
        locale: ingress.locale,
        intent: "create_from_scratch",
        parameterOverrides: ingress.parameterOverrides || {},
        parameterSchema: [],
        warnings: [],
        riskFlags: ["pipeline_failed_before_normalization"],
        scadTemplate: undefined,
        monetization: { tier, creditCost, channel: ingress.quality },
      },
      decision: {
        mode: routedError?.routing.mode || "automatic",
        provider: routedError?.routing.provider || "unresolved",
        model: routedError?.routing.model || "unresolved",
        lane: routedError?.routing.lane || (ingress.quality === "draft" ? "economy" : "balanced"),
        reason: routedError?.routing.reason || err.message || "Pipeline failed before routing completed.",
        forecast: {
          currentMonth: budget.currentMonth,
          currentSpentUsd: Number(budget.currentMonthSpentUsd || 0),
          effectiveBudgetUsd: Number(budget.globalMonthlyBudgetUsd || 0),
          budgetRemainingUsd: Math.max(0, Number(budget.globalMonthlyBudgetUsd || 0) - Number(budget.currentMonthSpentUsd || 0)),
          budgetUtilizationPercent: 0,
          projectedMonthEndSpendUsd: Number(budget.currentMonthSpentUsd || 0),
          projectedUtilizationPercent: 0,
          forecastBand: "green",
          recentAverageDailySpendUsd: 0,
          previousPeriodSpendToDateUsd: 0,
          previousFullMonthSpendUsd: 0,
          daysElapsed: 1,
          daysInMonth: 30,
        },
        fallbackChain: routedError?.routing.fallbackChain || [],
        attemptHistory: routedError?.attemptHistory || [],
      },
      status: "failed",
      failureCode: "PROVIDER_EXECUTION_FAILED",
      creditCost,
      estimatedUsd: 0,
    });

    // Refund credits on LLM failure via unified helper
    await releaseCredits(userId, creditSnapshot);
    await clearIdempotencyRecord(generationId);
    console.log(`[ai-studio/generate] 💰 Credits refunded: ${creditCost} back to user=${userId}`);

    return c.json({
      success: false,
      error: err.message || "Error al generar modelo con IA.",
      code: "GENERATION_FAILED",
    }, 500);
  }
});

export default app;
