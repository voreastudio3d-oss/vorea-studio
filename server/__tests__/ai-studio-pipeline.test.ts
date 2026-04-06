import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildGenerationContract,
  buildMasterPromptEnvelope,
  buildAiStudioForecast,
  decideRouting,
  normalizePromptIngress,
  type PromptIngress,
  type RoutingDecision,
} from "../ai-studio-pipeline.js";
import type { AIProviderConfig } from "../ai-generation-engine.js";

const ENV_KEYS = [
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "DEEPSEEK_API_KEY",
  "KIMI_API_KEY",
] as const;

const DEFAULT_CONFIG: AIProviderConfig = {
  activeProvider: "openai",
  activeModel: "gpt-4o-mini",
  manualMode: false,
  alertThresholds: [50, 75, 90],
  providers: {
    gemini: {
      label: "Google Gemini",
      envKey: "GEMINI_API_KEY",
      implemented: true,
      models: [
        { id: "gemini-2.5-flash", label: "Gemini Flash", costPer1kTokens: 0.00015 },
      ],
    },
    openai: {
      label: "OpenAI GPT",
      envKey: "OPENAI_API_KEY",
      implemented: true,
      models: [
        { id: "gpt-4o", label: "GPT-4o", costPer1kTokens: 0.005 },
        { id: "gpt-4o-mini", label: "GPT-4o Mini", costPer1kTokens: 0.00015 },
      ],
    },
  },
};

function createPrismaStub() {
  return {
    aiStudioFamily: {
      findFirst: async ({ where }: any) => {
        if (where.slug === "storage-box") {
          return {
            slug: "storage-box",
            status: "active",
            nameEs: "Caja",
            nameEn: "Box",
            scadTemplate: "cube([width, depth, height]);",
            parameters: [
              { name: "width", type: "number", defaultValue: 90, min: 30, max: 220, description: "Ancho" },
              { name: "label_text", type: "string", defaultValue: "VOREA", description: "Texto" },
            ],
          };
        }

        if (where.slug === "text-keychain-tag") {
          return {
            slug: "text-keychain-tag",
            status: "active",
            nameEs: "Llavero",
            nameEn: "Keychain",
            scadTemplate: "text(label_text);",
            parameters: [
              { name: "label_text", type: "string", defaultValue: "VOREA", description: "Texto principal" },
            ],
          };
        }

        return null;
      },
    },
    aiGenerationDailyAggregate: {
      findMany: async () => [],
    },
  };
}

describe("ai studio pipeline", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      process.env[key] = "";
    }
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it("normalizes prompt ingress using real family schema and risk flags", async () => {
    const prisma = createPrismaStub() as any;
    const ingress: PromptIngress = {
      prompt: "   Caja modular con texto grabado y width 500mm   ",
      engine: "fdm",
      familySlug: "storage-box",
      quality: "draft",
      parameterOverrides: {
        width: 500,
        unknown_field: 12,
        label_text: "CLIENTE",
      },
      userId: "user-1",
      tier: "FREE",
      locale: "es",
      sourceRecipeId: "recipe-1",
    };

    const normalized = await normalizePromptIngress(prisma, ingress, 5);
    expect(normalized.promptClean).toBe("Caja modular con texto grabado y width 500mm");
    expect(normalized.intent).toBe("text_or_engraving");
    expect(normalized.resolvedFamilySlug).toBe("storage-box");
    expect(normalized.parameterOverrides.width).toBe(220);
    expect(normalized.parameterOverrides.label_text).toBe("CLIENTE");
    expect(normalized.parameterOverrides).not.toHaveProperty("unknown_field");
    expect(normalized.riskFlags).toContain("unknown_override");
    expect(normalized.riskFlags).toContain("override_clamped");
  });

  it("routes FREE draft traffic to the cheapest healthy candidate in automatic mode", async () => {
    const prisma = createPrismaStub() as any;
    const normalized = await normalizePromptIngress(prisma, {
      prompt: "Caja simple",
      engine: "fdm",
      familySlug: "storage-box",
      quality: "draft",
      userId: "user-2",
      tier: "FREE",
    }, 5);

    const routing = await decideRouting(
      prisma,
      normalized,
      {
        globalMonthlyBudgetUsd: 100,
        maxBudgetPercentOfRevenue: 100,
        currentMonthSpentUsd: 10,
        currentMonth: new Date().toISOString().slice(0, 7),
        perTierDailyLimits: { FREE: 1, PRO: 20, "STUDIO PRO": -1 },
        circuitBreakerEnabled: true,
      },
      500,
      DEFAULT_CONFIG
    );

    expect(routing.mode).toBe("automatic");
    expect(routing.lane).toBe("economy");
    expect(routing.provider).toBe("gemini");
    expect(routing.model).toBe("gemini-2.5-flash");
  });

  it("downgrades final routing lane under red forecast pressure", async () => {
    const prisma = createPrismaStub() as any;
    const normalized = await normalizePromptIngress(prisma, {
      prompt: "Caja robusta con cierre mejorado",
      engine: "fdm",
      familySlug: "storage-box",
      quality: "final",
      userId: "user-4",
      tier: "PRO",
    }, 10);

    const routing = await decideRouting(
      prisma,
      normalized,
      {
        globalMonthlyBudgetUsd: 100,
        maxBudgetPercentOfRevenue: 100,
        currentMonthSpentUsd: 75,
        currentMonth: new Date().toISOString().slice(0, 7),
        perTierDailyLimits: { FREE: 1, PRO: 20, "STUDIO PRO": -1 },
        circuitBreakerEnabled: true,
      },
      500,
      DEFAULT_CONFIG
    );

    expect(routing.mode).toBe("automatic");
    expect(routing.forecast.forecastBand).toBe("red");
    expect(routing.lane).toBe("balanced");
    expect(routing.provider).toBe("openai");
    expect(routing.model).toBe("gpt-4o");
  });

  it("falls back to automatic mode when manual provider is unhealthy", async () => {
    const prisma = createPrismaStub() as any;
    const normalized = await normalizePromptIngress(prisma, {
      prompt: "Caja simple de prueba",
      engine: "fdm",
      familySlug: "storage-box",
      quality: "draft",
      userId: "user-5",
      tier: "FREE",
    }, 5);

    process.env.OPENAI_API_KEY = "";

    const routing = await decideRouting(
      prisma,
      normalized,
      {
        globalMonthlyBudgetUsd: 100,
        maxBudgetPercentOfRevenue: 100,
        currentMonthSpentUsd: 10,
        currentMonth: new Date().toISOString().slice(0, 7),
        perTierDailyLimits: { FREE: 1, PRO: 20, "STUDIO PRO": -1 },
        circuitBreakerEnabled: true,
      },
      500,
      {
        ...DEFAULT_CONFIG,
        manualMode: true,
        activeProvider: "openai",
        activeModel: "gpt-4o-mini",
      }
    );

    expect(routing.mode).toBe("automatic");
    expect(routing.reason).toContain("manual fallback por health check");
    expect(routing.provider).toBe("gemini");
    expect(routing.model).toBe("gemini-2.5-flash");
  });

  it("builds a master prompt envelope with normalized context and routing metadata", async () => {
    const prisma = createPrismaStub() as any;
    const normalized = await normalizePromptIngress(prisma, {
      prompt: "Nombre grabado para llavero premium",
      engine: "fdm",
      familySlug: "text-keychain-tag",
      quality: "final",
      parameterOverrides: { label_text: "VOREA PRO" },
      userId: "user-3",
      tier: "STUDIO PRO",
    }, 10);

    const routing: RoutingDecision = {
      mode: "automatic",
      provider: "openai",
      model: "gpt-4o",
      lane: "premium",
      reason: "Forecast green · tier STUDIO PRO · quality final · lane premium",
      forecast: await buildAiStudioForecast(prisma, {
        globalMonthlyBudgetUsd: 100,
        maxBudgetPercentOfRevenue: 100,
        currentMonthSpentUsd: 15,
        currentMonth: new Date().toISOString().slice(0, 7),
        perTierDailyLimits: { FREE: 1, PRO: 20, "STUDIO PRO": -1 },
        circuitBreakerEnabled: true,
      }, 500),
      fallbackChain: [],
      traceId: null,
    };

    const envelope = buildMasterPromptEnvelope(normalized, routing);
    expect(envelope.systemPrompt).toContain("Intent clasificado");
    expect(envelope.systemPrompt).toContain("Template base SCAD");
    expect(envelope.userPrompt).toContain("Pedido del usuario");
    expect(envelope.analytics.lane).toBe("premium");
    expect(envelope.analytics.promptNormalized).toContain("Family=text-keychain-tag");
  });

  it("builds an editor contract with resolved family, merged parameters and warnings", async () => {
    const prisma = createPrismaStub() as any;
    const normalized = await normalizePromptIngress(prisma, {
      prompt: "Caja modular con width extrema y texto de cliente",
      engine: "fdm",
      familySlug: "storage-box",
      quality: "draft",
      parameterOverrides: {
        width: 500,
        label_text: "CLIENTE",
      },
      userId: "user-6",
      tier: "FREE",
    }, 5);

    const contract = buildGenerationContract(normalized, {
      modelName: "Caja Integrada",
      scadCode: "cube([width, 80, 50]);",
      parameters: [
        { name: "width", type: "number", value: 180, description: "Ancho final sugerido" },
        { name: "label_text", type: "string", value: "CLIENTE", description: "Texto frontal" },
        { name: "fillet", type: "number", value: 2, description: "Radio extra generado por IA" },
      ],
      reasoning: "Ajuste de ancho y texto frontal.",
    });

    expect(contract.normalized.requestedFamilySlug).toBe("storage-box");
    expect(contract.normalized.resolvedFamilySlug).toBe("storage-box");
    expect(contract.normalized.warnings.some((warning) => warning.includes("Se ajusto"))).toBe(true);
    expect(contract.editor.spec.family).toBe("storage-box");
    expect(contract.editor.spec.intent).toBe(normalized.intent);
    expect(contract.editor.spec.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "width", defaultValue: 180, max: 220 }),
        expect.objectContaining({ name: "label_text", defaultValue: "CLIENTE" }),
        expect.objectContaining({ name: "fillet", defaultValue: 2 }),
      ])
    );
    expect(contract.editor.spec.warnings.some((warning) => warning.includes("Se ajusto"))).toBe(true);
  });
});
