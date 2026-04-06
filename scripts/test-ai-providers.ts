import * as kv from "../server/kv.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
  getAIProviderConfigSnapshot,
  type AIProviderConfig,
} from "../server/ai-generation-engine.js";

const execAsync = promisify(exec);

type ValidationResult = {
  provider: string;
  ok: boolean;
  detail: string;
  latencyMs: number;
};

type GenerationResult = {
  provider: string;
  model: string;
  ok: boolean;
  latencyMs: number;
  modelName?: string;
  scadLength?: number;
  parameterCount?: number;
  reasoningPreview?: string;
  error?: string;
};

const TEST_INPUT =
  "Genera un llavero rectangular imprimible en FDM de 40 mm x 20 mm x 3 mm con esquinas suavemente redondeadas, un agujero de 5 mm en la esquina superior izquierda y el texto 'VOREA' en relieve centrado. Mantenlo simple, limpio y totalmente compilable en OpenSCAD.";

function now() {
  return Date.now();
}

function preview(text: string | undefined, max = 140): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

function parseTrailingJson(text: string): GenerationResult | null {
  const start = text.lastIndexOf("{");
  if (start === -1) return null;
  const candidate = text.slice(start).trim();
  try {
    return JSON.parse(candidate) as GenerationResult;
  } catch {
    return null;
  }
}

async function validateGemini(apiKey: string): Promise<ValidationResult> {
  const start = now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  return {
    provider: "gemini",
    ok: res.ok,
    detail: res.ok ? "Gemini models endpoint respondió OK" : `HTTP ${res.status}`,
    latencyMs: now() - start,
  };
}

async function validateOpenAI(apiKey: string): Promise<ValidationResult> {
  const start = now();
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return {
    provider: "openai",
    ok: res.ok,
    detail: res.ok ? "OpenAI models endpoint respondió OK" : `HTTP ${res.status}`,
    latencyMs: now() - start,
  };
}

async function validateAnthropic(apiKey: string): Promise<ValidationResult> {
  const start = now();
  const res = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  return {
    provider: "anthropic",
    ok: res.ok,
    detail: res.ok ? "Anthropic models endpoint respondió OK" : `HTTP ${res.status}`,
    latencyMs: now() - start,
  };
}

async function validateDeepSeek(apiKey: string): Promise<ValidationResult> {
  const start = now();
  const res = await fetch("https://api.deepseek.com/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return {
    provider: "deepseek",
    ok: res.ok,
    detail: res.ok ? "DeepSeek models endpoint respondió OK" : `HTTP ${res.status}`,
    latencyMs: now() - start,
  };
}

async function validateKimi(apiKey: string): Promise<ValidationResult> {
  const start = now();
  const res = await fetch("https://api.moonshot.ai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return {
    provider: "kimi",
    ok: res.ok,
    detail: res.ok ? "Kimi models endpoint respondió OK" : `HTTP ${res.status}`,
    latencyMs: now() - start,
  };
}

async function validateProvider(provider: string, apiKey: string): Promise<ValidationResult> {
  try {
    switch (provider) {
      case "gemini":
        return await validateGemini(apiKey);
      case "openai":
        return await validateOpenAI(apiKey);
      case "anthropic":
        return await validateAnthropic(apiKey);
      case "deepseek":
        return await validateDeepSeek(apiKey);
      case "kimi":
        return await validateKimi(apiKey);
      default:
        return { provider, ok: false, detail: "Proveedor sin validador", latencyMs: 0 };
    }
  } catch (error: any) {
    return {
      provider,
      ok: false,
      detail: error?.message || "Error inesperado",
      latencyMs: 0,
    };
  }
}

async function runGeneration(provider: string, model: string): Promise<GenerationResult> {
  try {
    const { stdout } = await execAsync(
      `npx tsx --env-file=.env scripts/test-single-ai-model.ts ${provider} ${model}`,
      { cwd: process.cwd(), timeout: 600000, maxBuffer: 1024 * 1024 }
    );
    const parsed = parseTrailingJson(stdout.trim());
    if (!parsed) {
      throw new Error(`No se pudo parsear JSON del subproceso: ${stdout.trim().slice(0, 240)}`);
    }
    return parsed as GenerationResult;
  } catch (error: any) {
    const stdout = error?.stdout?.trim?.();
    if (stdout) {
      const parsed = parseTrailingJson(stdout);
      if (parsed) return parsed;
    }
    return {
      provider,
      model,
      ok: false,
      latencyMs: 0,
      error: error?.message || "Error inesperado",
    };
  }
}

async function main() {
  const snapshot = await getAIProviderConfigSnapshot();

  const validations: ValidationResult[] = [];
  const generations: GenerationResult[] = [];

  for (const [provider, def] of Object.entries(snapshot.providers)) {
    const apiKey = process.env[def.envKey] || "";
    if (!apiKey) {
      validations.push({
        provider,
        ok: false,
        detail: `Variable ${def.envKey} vacía`,
        latencyMs: 0,
      });
      continue;
    }

    const validation = await validateProvider(provider, apiKey);
    validations.push(validation);

    if (!validation.ok) continue;

    for (const model of def.models) {
      const generation = await runGeneration(provider, model.id);
      generations.push(generation);
    }
  }

  const report = {
    executedAt: new Date().toISOString(),
    testInput: TEST_INPUT,
    validations,
    generations,
  };

  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error) => {
  console.error(JSON.stringify({
    fatal: true,
    message: error?.message || "Error fatal",
    stack: error?.stack || null,
  }, null, 2));
  process.exit(1);
});
