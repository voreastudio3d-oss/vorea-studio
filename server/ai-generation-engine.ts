/**
 * AI Generation Engine — Vorea Studio
 *
 * Core module for LLM-powered SCAD generation.
 * Uses Gemini API to dynamically generate or adapt OpenSCAD code
 * based on user prompts, family templates, and parameter constraints.
 *
 * Budget circuit breaker prevents overspending on API calls.
 */

import * as kv from "./kv.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LLMGenerationInput {
  prompt: string;
  engine: "fdm" | "organic";
  familySlug: string;
  quality: "draft" | "final";
  parameterOverrides?: Record<string, number | string | boolean>;
  /** The SCAD template from the CMS family record */
  scadTemplate?: string;
  /** Parameter definitions from the CMS family record */
  parameters?: Array<{
    name: string;
    type: string;
    defaultValue: any;
    min?: number;
    max?: number;
    step?: number;
    description: string;
  }>;
  /** Family display name for context */
  familyName?: string;
}

export interface LLMGenerationResult {
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

export interface AIBudgetCheckResult {
  allowed: boolean;
  reason?: string;
}

interface AIBudgetState {
  globalMonthlyBudgetUsd: number;
  maxBudgetPercentOfRevenue: number;
  currentMonthSpentUsd: number;
  currentMonth: string;
  perTierDailyLimits: Record<string, number>;
  circuitBreakerEnabled: boolean;
}

/** Admin-configurable AI provider settings (stored in KV as admin:ai_config) */
export interface AIProviderConfig {
  /** Active provider: gemini | openai | anthropic | deepseek | kimi */
  activeProvider: string;
  /** Active model ID for the selected provider */
  activeModel: string;
  /** Manual override mode — when true, uses admin-selected model instead of auto */
  manualMode: boolean;
  /** Consumption alert thresholds (% of monthly budget) */
  alertThresholds: number[];
  /** Available providers with their env key requirements */
  providers: Record<string, {
    label: string;
    models: Array<{ id: string; label: string; costPer1kTokens: number }>;
    envKey: string;
    implemented?: boolean;
  }>;
}

export interface AIProviderRuntimeInfo {
  availableProviders: string[];
  implementedProviders: string[];
  selectableProviders: string[];
}

export interface AIProviderModelCandidate {
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
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Env-based defaults (overridden by admin:ai_config in KV) */
const ENV_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

const DEFAULT_AI_CONFIG: AIProviderConfig = {
  activeProvider: "gemini",
  activeModel: ENV_GEMINI_MODEL,
  manualMode: false,
  alertThresholds: [50, 75, 90],
  providers: {
    gemini: {
      label: "Google Gemini",
      models: [
        { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Preciso)", costPer1kTokens: 0.00125 },
        { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Rápido)", costPer1kTokens: 0.00015 },
      ],
      envKey: "GEMINI_API_KEY",
      implemented: true,
    },
    openai: {
      label: "OpenAI GPT",
      models: [
        { id: "gpt-4o", label: "GPT-4o (Balanced)", costPer1kTokens: 0.005 },
        { id: "gpt-4o-mini", label: "GPT-4o Mini (Económico)", costPer1kTokens: 0.00015 },
      ],
      envKey: "OPENAI_API_KEY",
      implemented: true,
    },
    anthropic: {
      label: "Anthropic Claude",
      models: [
        { id: "claude-opus-4-20250514", label: "Claude Opus 4 (Flagship)", costPer1kTokens: 0.015 },
        { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (Balanceado)", costPer1kTokens: 0.003 },
      ],
      envKey: "ANTHROPIC_API_KEY",
      implemented: true,
    },
    deepseek: {
      label: "DeepSeek",
      models: [
        { id: "deepseek-chat", label: "DeepSeek Chat", costPer1kTokens: 0.00014 },
        { id: "deepseek-reasoner", label: "DeepSeek Reasoner", costPer1kTokens: 0.00028 },
      ],
      envKey: "DEEPSEEK_API_KEY",
      implemented: true,
    },
    kimi: {
      label: "Moonshot Kimi",
      models: [
        { id: "kimi-k2.5", label: "Kimi K2.5", costPer1kTokens: 0.0002 },
        { id: "kimi-k2-thinking", label: "Kimi K2 Thinking", costPer1kTokens: 0.00035 },
      ],
      envKey: "KIMI_API_KEY",
      implemented: true,
    },
  },
};

const DEFAULT_AI_BUDGET: AIBudgetState = {
  globalMonthlyBudgetUsd: 100,
  maxBudgetPercentOfRevenue: 100,
  currentMonthSpentUsd: 0,
  currentMonth: new Date().toISOString().slice(0, 7),
  perTierDailyLimits: { FREE: 1, PRO: 20, "STUDIO PRO": -1 },
  circuitBreakerEnabled: true,
};

/** Estimated cost per call — updated dynamically based on active model */
const ESTIMATED_COST_PER_CALL_USD = 0.005;

interface ProviderHealthState {
  cooldownUntil: number;
  consecutiveFailures: number;
  lastFailureAt: number;
}

// Cooldown on 429 rate limits and recent repeated failures
const providerHealthState: Record<string, ProviderHealthState> = {};

// ─── System Prompt Builder ────────────────────────────────────────────────────

export function buildScadSystemPrompt(
  familySlug: string,
  familyName: string,
  parameters: LLMGenerationInput["parameters"],
  scadTemplate: string | undefined,
  quality: "draft" | "final",
  engine: "fdm" | "organic"
): string {
  const qualityGuidance =
    quality === "draft"
      ? "Usa $fn bajo (entre 16-32) para renders rápidos. Prioriza velocidad de compilación."
      : "Usa $fn alto (entre 64-128) para calidad final de impresión. Prioriza detalle y suavidad.";

  const engineGuidance =
    engine === "fdm"
      ? "El modelo será impreso en FDM. Asegúrate de que sea manifold, tenga paredes mínimas de 1.2mm, y sea imprimible sin soportes complejos cuando sea posible."
      : "El modelo es orgánico/decorativo. Puedes usar geometrías más complejas y curvadas.";

  const parametersSection = parameters?.length
    ? `\n### Parámetros disponibles de la familia "${familyName}" (${familySlug}):\n${parameters
        .map(
          (p) =>
            `- **${p.name}** (${p.type}): ${p.description}. Default: ${p.defaultValue}${p.min !== undefined ? `, min: ${p.min}` : ""}${p.max !== undefined ? `, max: ${p.max}` : ""}`
        )
        .join("\n")}\n`
    : "";

  const templateSection = scadTemplate
    ? `\n### Template SCAD base de la familia:\n\`\`\`openscad\n${scadTemplate}\n\`\`\`\nPuedes usar este template como punto de partida y modificarlo según la instrucción del usuario, o reescribirlo completamente si el usuario pide algo diferente.\n`
    : "\nNo hay template base. Genera el código SCAD desde cero.\n";

  return `Eres un ingeniero experto en OpenSCAD y diseño paramétrico 3D trabajando para **Vorea Studio** (voreastudio.com).

Tu ÚNICA TAREA es generar código OpenSCAD válido y compilable basándote en la instrucción del usuario.

## Reglas Estrictas

1. **Responde SIEMPRE en formato JSON** con exactamente esta estructura:
\`\`\`json
{
  "modelName": "nombre_descriptivo_del_modelo",
  "scadCode": "// código OpenSCAD completo aquí",
  "parameters": [
    { "name": "param_name", "type": "number|bool|string", "value": <valor>, "description": "descripción" }
  ],
  "reasoning": "Explicación breve de las decisiones de diseño tomadas"
}
\`\`\`

2. El código SCAD debe ser **100% compilable** por OpenSCAD sin errores de sintaxis.
3. **NO uses bibliotecas externas** (no BOSL2, no MCAD) a menos que el template base las incluya.
4. Todos los parámetros deben tener **valores por defecto razonables** para impresión 3D.
5. ${qualityGuidance}
6. ${engineGuidance}
7. **NO incluyas texto** fuera del JSON. Tu respuesta debe ser SOLO el objeto JSON.
8. El campo \`scadCode\` debe ser un string escapado correctamente para JSON (usa \\n para saltos de línea).
${parametersSection}${templateSection}`;
}

// ─── Budget Circuit Breaker ───────────────────────────────────────────────────

export async function checkAIBudget(
  userId: string,
  tier: string
): Promise<AIBudgetCheckResult> {
  const budget = ((await kv.get("admin:ai_budget")) as AIBudgetState | null) || DEFAULT_AI_BUDGET;

  if (!budget.circuitBreakerEnabled) {
    return { allowed: true };
  }

  const currentMonth = new Date().toISOString().slice(0, 7);

  // Reset counter if new month
  if (budget.currentMonth !== currentMonth) {
    budget.currentMonthSpentUsd = 0;
    budget.currentMonth = currentMonth;
    await kv.set("admin:ai_budget", budget);
  }

  // Check global budget cap
  if (budget.currentMonthSpentUsd >= budget.globalMonthlyBudgetUsd) {
    console.log(
      `[ai-engine] ⛔ Budget exhausted: $${budget.currentMonthSpentUsd.toFixed(2)} >= $${budget.globalMonthlyBudgetUsd}`
    );
    return {
      allowed: false,
      reason: "Presupuesto global de IA agotado para este mes. Intenta de nuevo el próximo mes.",
    };
  }

  // Check per-tier daily limits
  const normalizedTier = tier.toUpperCase().replace(/_/g, " ");
  const dailyLimit = budget.perTierDailyLimits[normalizedTier] ?? 1;

  if (dailyLimit !== -1) {
    const today = new Date().toISOString().slice(0, 10);
    const dailyKey = `ai_usage:${userId}:${today}`;
    const dailyCount = Number((await kv.get(dailyKey)) || 0);

    if (dailyCount >= dailyLimit) {
      return {
        allowed: false,
        reason: `Límite diario de generaciones IA alcanzado (${dailyLimit}/${normalizedTier === "FREE" ? "día gratis" : "día"}).`,
      };
    }
  }

  return { allowed: true };
}

export async function recordAIUsage(
  userId: string,
  costUsd: number = ESTIMATED_COST_PER_CALL_USD
): Promise<void> {
  // Increment global monthly spend
  const budget = ((await kv.get("admin:ai_budget")) as AIBudgetState | null) || { ...DEFAULT_AI_BUDGET };
  const currentMonth = new Date().toISOString().slice(0, 7);

  if (budget.currentMonth !== currentMonth) {
    budget.currentMonthSpentUsd = 0;
    budget.currentMonth = currentMonth;
  }

  budget.currentMonthSpentUsd = Number((budget.currentMonthSpentUsd + costUsd).toFixed(6));
  await kv.set("admin:ai_budget", budget);

  // Increment user daily counter
  const today = new Date().toISOString().slice(0, 10);
  const dailyKey = `ai_usage:${userId}:${today}`;
  const dailyCount = Number((await kv.get(dailyKey)) || 0);
  await kv.set(dailyKey, dailyCount + 1);

  console.log(
    `[ai-engine] 📊 Usage recorded: user=${userId}, cost=$${costUsd.toFixed(4)}, monthTotal=$${budget.currentMonthSpentUsd.toFixed(4)}`
  );
}

// ─── LLM Generation ───────────────────────────────────────────────────────────

/** Calls the Gemini REST API. Isolated for future multi-provider support. */
async function callGeminiAPI(
  model: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    }),
  });
}

async function callOpenAIAPI(
  model: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<Response> {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
}

async function callOpenAICompatibleAPI(
  baseUrl: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  options?: { jsonMode?: "json_object" | "json_schema" | "none" }
): Promise<Response> {
  const body: Record<string, unknown> = {
    model,
    temperature: 0.4,
    max_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

  if (options?.jsonMode === "json_object") {
    body.response_format = { type: "json_object" };
  }

  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

async function callAnthropicAPI(
  model: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<Response> {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.4,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
}

function describeProviderError(provider: string, status: number, body: string): string {
  const lower = body.toLowerCase();

  if (
    lower.includes("insufficient_quota") ||
    lower.includes("quota exceeded") ||
    lower.includes("current quota") ||
    lower.includes("insufficient balance") ||
    lower.includes("credit balance is too low") ||
    lower.includes("insufficient balance") ||
    lower.includes("suspended due to insufficient balance") ||
    lower.includes("billing")
  ) {
    return `El proveedor '${provider}' respondió sin cuota o saldo disponible. Revisa billing/créditos antes de reintentar.`;
  }

  if (status === 429) {
    return `Límite de tasa de la API de '${provider}' alcanzado. Intenta en 5 minutos.`;
  }

  return `Error del servicio de IA '${provider}' (${status}). Intenta de nuevo.`;
}

function getAIProviderRuntime(config: AIProviderConfig): AIProviderRuntimeInfo {
  const availableProviders = Object.entries(config.providers)
    .filter(([, def]) => !!process.env[def.envKey])
    .map(([key]) => key);

  const implementedProviders = Object.entries(config.providers)
    .filter(([, def]) => def.implemented !== false)
    .map(([key]) => key);

  const selectableProviders = availableProviders.filter((provider) =>
    implementedProviders.includes(provider)
  );

  return {
    availableProviders,
    implementedProviders,
    selectableProviders,
  };
}

function getProviderModels(
  config: AIProviderConfig,
  provider: string
): Array<{ id: string; label: string; costPer1kTokens: number }> {
  return config.providers[provider]?.models || DEFAULT_AI_CONFIG.providers.gemini.models;
}

function getProviderHealth(provider: string): ProviderHealthState {
  return providerHealthState[provider] || {
    cooldownUntil: 0,
    consecutiveFailures: 0,
    lastFailureAt: 0,
  };
}

function markProviderSuccess(provider: string) {
  providerHealthState[provider] = {
    cooldownUntil: providerHealthState[provider]?.cooldownUntil || 0,
    consecutiveFailures: 0,
    lastFailureAt: 0,
  };
}

function markProviderFailure(provider: string, status: number) {
  const now = Date.now();
  const current = getProviderHealth(provider);
  const withinBurstWindow = now - current.lastFailureAt < 10 * 60 * 1000;
  const consecutiveFailures = withinBurstWindow ? current.consecutiveFailures + 1 : 1;
  const cooldownUntil = status === 429
    ? now + 5 * 60 * 1000
    : consecutiveFailures >= 3
      ? now + 2 * 60 * 1000
      : current.cooldownUntil;

  providerHealthState[provider] = {
    cooldownUntil,
    consecutiveFailures,
    lastFailureAt: now,
  };
}

export function getModelCostPer1kTokens(
  provider: string,
  model: string,
  config: AIProviderConfig = DEFAULT_AI_CONFIG
): number {
  return getProviderModels(config, provider).find((entry) => entry.id === model)?.costPer1kTokens
    ?? DEFAULT_AI_CONFIG.providers.gemini.models[0].costPer1kTokens;
}

export function getAIProviderModelCandidates(
  config: AIProviderConfig = DEFAULT_AI_CONFIG
): AIProviderModelCandidate[] {
  const runtime = getAIProviderRuntime(config);

  return Object.entries(config.providers).flatMap(([providerKey, provider]) => {
    const available = runtime.availableProviders.includes(providerKey);
    const implemented = runtime.implementedProviders.includes(providerKey);
    const selectable = runtime.selectableProviders.includes(providerKey);
    const health = getProviderHealth(providerKey);
    const healthy = selectable && Date.now() >= health.cooldownUntil;

    return provider.models.map((model) => ({
      provider: providerKey,
      providerLabel: provider.label,
      model: model.id,
      modelLabel: model.label,
      costPer1kTokens: model.costPer1kTokens,
      available,
      implemented,
      selectable,
      cooldownUntil: health.cooldownUntil,
      consecutiveFailures: health.consecutiveFailures,
      healthy,
    }));
  });
}

export function normalizeAIProviderConfig(
  stored?: Partial<AIProviderConfig> | null
): AIProviderConfig {
  const config: AIProviderConfig = {
    activeProvider: stored?.activeProvider || DEFAULT_AI_CONFIG.activeProvider,
    activeModel: stored?.activeModel || DEFAULT_AI_CONFIG.activeModel,
    manualMode: stored?.manualMode ?? DEFAULT_AI_CONFIG.manualMode,
    alertThresholds:
      Array.isArray(stored?.alertThresholds) && stored?.alertThresholds.length > 0
        ? stored!.alertThresholds
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100)
        : [...DEFAULT_AI_CONFIG.alertThresholds],
    providers: DEFAULT_AI_CONFIG.providers,
  };

  const runtime = getAIProviderRuntime(config);
  const fallbackProvider =
    runtime.selectableProviders[0] ||
    runtime.availableProviders[0] ||
    DEFAULT_AI_CONFIG.activeProvider;

  if (!config.providers[config.activeProvider]) {
    config.activeProvider = fallbackProvider;
  }

  if (config.manualMode && !runtime.selectableProviders.includes(config.activeProvider)) {
    config.activeProvider = fallbackProvider;
  }

  const validModels = getProviderModels(config, config.activeProvider);
  if (!validModels.some((model) => model.id === config.activeModel)) {
    config.activeModel = validModels[0]?.id || DEFAULT_AI_CONFIG.activeModel;
  }

  config.alertThresholds = [...new Set(config.alertThresholds)]
    .sort((a, b) => a - b);

  return config;
}

/**
 * Resolves the active AI provider configuration.
 * Priority: admin:ai_config KV > env vars > defaults
 */
export async function getActiveAIConfig(): Promise<{ provider: string; model: string; apiKey: string }> {
  const config = normalizeAIProviderConfig((await kv.get("admin:ai_config")) as Partial<AIProviderConfig> | null);
  const runtime = getAIProviderRuntime(config);
  const provider =
    (config.manualMode ? config.activeProvider : runtime.selectableProviders[0]) ||
    config.activeProvider ||
    "gemini";
  const model =
    getProviderModels(config, provider).find((entry) => entry.id === config.activeModel)?.id ||
    getProviderModels(config, provider)[0]?.id ||
    ENV_GEMINI_MODEL;

  // Resolve API key from environment
  const providerDef = config.providers[provider] || DEFAULT_AI_CONFIG.providers.gemini;
  const apiKey = process.env[providerDef.envKey] || "";

  return { provider, model, apiKey };
}

/** Returns the full admin AI config (for admin panel display) */
export async function getAIProviderConfig(): Promise<AIProviderConfig> {
  return normalizeAIProviderConfig((await kv.get("admin:ai_config")) as Partial<AIProviderConfig> | null);
}

export async function getAIProviderConfigSnapshot(): Promise<AIProviderConfig & {
  _availableProviders: string[];
  _implementedProviders: string[];
  _selectableProviders: string[];
  _healthyProviders: string[];
  _healthyCandidates: AIProviderModelCandidate[];
}> {
  const config = await getAIProviderConfig();
  const runtime = getAIProviderRuntime(config);
  const candidates = getAIProviderModelCandidates(config);

  return {
    ...config,
    _availableProviders: runtime.availableProviders,
    _implementedProviders: runtime.implementedProviders,
    _selectableProviders: runtime.selectableProviders,
    _healthyProviders: [...new Set(candidates.filter((entry) => entry.healthy).map((entry) => entry.provider))],
    _healthyCandidates: candidates.filter((entry) => entry.healthy),
  };
}

export async function executeScadGenerationRoute(input: {
  provider: string;
  model: string;
  apiKey?: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<LLMGenerationResult> {
  const provider = input.provider;
  const model = input.model;
  const providerDef = DEFAULT_AI_CONFIG.providers[provider] || DEFAULT_AI_CONFIG.providers.gemini;
  const apiKey = input.apiKey || process.env[providerDef.envKey] || "";
  if (!apiKey) {
    throw new Error(`API key no configurada para el proveedor '${provider}'. Verifica las variables de entorno.`);
  }

  if (Date.now() < getProviderHealth(provider).cooldownUntil) {
    throw new Error(`El proveedor '${provider}' está temporalmente en cooldown. Intenta en unos minutos.`);
  }

  console.log(`[ai-engine] 🤖 Provider=${provider}, Model=${model}`);

  let res: Response;
  if (provider === "openai") {
    res = await callOpenAIAPI(model, apiKey, input.systemPrompt, input.userPrompt);
  } else if (provider === "anthropic") {
    res = await callAnthropicAPI(model, apiKey, input.systemPrompt, input.userPrompt);
  } else if (provider === "deepseek") {
    res = await callOpenAICompatibleAPI(
      "https://api.deepseek.com",
      model,
      apiKey,
      input.systemPrompt,
      input.userPrompt,
      { jsonMode: "json_object" }
    );
  } else if (provider === "kimi") {
    res = await callOpenAICompatibleAPI(
      "https://api.moonshot.ai/v1",
      model,
      apiKey,
      input.systemPrompt,
      input.userPrompt,
      { jsonMode: "none" }
    );
  } else if (provider === "gemini") {
    res = await callGeminiAPI(model, apiKey, input.systemPrompt, input.userPrompt);
  } else {
    throw new Error(`El proveedor '${provider}' aún no está implementado en runtime.`);
  }

  if (!res.ok) {
    const body = await res.text();
    console.error(`[ai-engine] ${provider} error ${res.status}: ${body.slice(0, 500)}`);
    markProviderFailure(provider, res.status);
    throw new Error(describeProviderError(provider, res.status, body));
  }

  const data = await res.json();
  const rawText =
    provider === "openai"
      ? data?.choices?.[0]?.message?.content
      : provider === "deepseek" || provider === "kimi"
        ? data?.choices?.[0]?.message?.content
        : provider === "anthropic"
          ? data?.content?.find((entry: any) => entry?.type === "text")?.text
      : data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    console.error(`[ai-engine] Empty response from ${provider}`, JSON.stringify(data).slice(0, 500));
    markProviderFailure(provider, 500);
    throw new Error(`La IA '${provider}' no generó una respuesta válida. Intenta reformular tu prompt.`);
  }

  markProviderSuccess(provider);
  return parseGenerationResult(rawText);
}

export async function generateScadWithLLM(
  input: LLMGenerationInput
): Promise<LLMGenerationResult> {
  const { provider, model, apiKey } = await getActiveAIConfig();

  const systemPrompt = buildScadSystemPrompt(
    input.familySlug,
    input.familyName || input.familySlug,
    input.parameters,
    input.scadTemplate,
    input.quality,
    input.engine
  );

  const userPrompt = buildUserPrompt(input);

  return executeScadGenerationRoute({
    provider,
    model,
    apiKey,
    systemPrompt,
    userPrompt,
  });
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function buildUserPrompt(input: LLMGenerationInput): string {
  let prompt = input.prompt;

  if (input.parameterOverrides && Object.keys(input.parameterOverrides).length > 0) {
    const overridesText = Object.entries(input.parameterOverrides)
      .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
      .join(", ");
    prompt += `\n\nParámetros personalizados del usuario: ${overridesText}`;
  }

  return prompt;
}

function parseGenerationResult(rawText: string): LLMGenerationResult {
  // Try direct JSON parse first
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1]);
      } catch {
        throw new Error("La IA devolvió un formato inválido. Intenta de nuevo.");
      }
    } else {
      throw new Error("La IA no devolvió JSON válido. Intenta reformular tu prompt.");
    }
  }

  // Validate required fields
  if (!parsed.scadCode || typeof parsed.scadCode !== "string") {
    throw new Error("La IA no generó código SCAD válido.");
  }

  // Clean up scadCode if it has escaped newlines
  const scadCode = parsed.scadCode
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "  ")
    .trim();

  // Basic SCAD syntax validation
  validateScadSyntax(scadCode);

  return {
    modelName: String(parsed.modelName || "vorea_ai_model"),
    scadCode,
    parameters: Array.isArray(parsed.parameters)
      ? parsed.parameters.map((p: any) => ({
          name: String(p.name || ""),
          type: String(p.type || "number"),
          value: p.value ?? p.defaultValue ?? 0,
          description: String(p.description || ""),
        }))
      : [],
    reasoning: String(parsed.reasoning || ""),
  };
}

function validateScadSyntax(code: string): void {
  // Basic bracket balance check
  let braces = 0;
  let parens = 0;
  let brackets = 0;

  for (const ch of code) {
    if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "(") parens++;
    else if (ch === ")") parens--;
    else if (ch === "[") brackets++;
    else if (ch === "]") brackets--;

    if (braces < 0 || parens < 0 || brackets < 0) {
      throw new Error("El código SCAD generado tiene errores de sintaxis (brackets desbalanceados). Intenta de nuevo.");
    }
  }

  if (braces !== 0 || parens !== 0 || brackets !== 0) {
    throw new Error("El código SCAD generado tiene brackets sin cerrar. Intenta de nuevo.");
  }

  // Check for obvious empty code
  const stripped = code.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (stripped.length < 10) {
    throw new Error("El código SCAD generado está vacío o es demasiado corto.");
  }
}
