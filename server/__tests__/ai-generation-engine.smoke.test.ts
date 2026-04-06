/**
 * ai-generation-engine.smoke.test.ts
 *
 * Live integration smoke tests against real LLM providers.
 * These tests are SKIPPED in CI unless the env var is present.
 *
 * Run manually:
 *   npx vitest run server/__tests__/ai-generation-engine.smoke.test.ts
 *
 * Results from 2026-04-05:
 *   ✅ openai/gpt-4o-mini  — OK (~2600ms, generates valid SCAD)
 *   ✅ openai/gpt-4o       — OK (~2700ms, generates valid SCAD)
 *   ✅ deepseek/deepseek-chat — OK (~720ms, generates valid SCAD)
 *   ❌ gemini/gemini-2.5-pro  — 429 quota exhausted (free tier limit)
 *   ❌ gemini/gemini-2.5-flash — 429 quota exhausted (free tier limit)
 *   ❌ anthropic/claude-3-5-haiku — 404 model not found (deprecated ID)
 */

import { describe, it, expect } from "vitest";
import { executeScadGenerationRoute } from "../ai-generation-engine.js";
import { validateScadGeometry } from "../ai-studio-pipeline.js";


const SIMPLE_SYSTEM = "Eres el motor IA de Vorea Studio. Responde SOLO en JSON con: modelName, scadCode, parameters, reasoning.";
const SIMPLE_USER = "Genera una caja 30x20x10mm en OpenSCAD. Sin bibliotecas externas.";

function smokeDescribe(providerLabel: string, envKey: string) {
  const apiKey = process.env[envKey];
  return apiKey ? describe : describe.skip;
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

smokeDescribe("openai smoke", "OPENAI_API_KEY")("openai/gpt-4o-mini live generation", () => {
  it("generates valid SCAD code", { timeout: 30_000 }, async () => {
    const result = await executeScadGenerationRoute({
      provider: "openai",
      model: "gpt-4o-mini",
      systemPrompt: SIMPLE_SYSTEM,
      userPrompt: SIMPLE_USER,
    });

    expect(result.scadCode).toBeTruthy();
    expect(result.scadCode.length).toBeGreaterThan(5);

    const validation = validateScadGeometry(result.scadCode);
    expect(validation.isValid).toBe(true);

    console.log(`[smoke:openai] modelName=${result.modelName}, scad=${result.scadCode.length}chars`);
  });
});

// ─── DeepSeek ─────────────────────────────────────────────────────────────────

smokeDescribe("deepseek smoke", "DEEPSEEK_API_KEY")("deepseek/deepseek-chat live generation", () => {
  it("generates valid SCAD code", { timeout: 30_000 }, async () => {
    const result = await executeScadGenerationRoute({
      provider: "deepseek",
      model: "deepseek-chat",
      systemPrompt: SIMPLE_SYSTEM,
      userPrompt: SIMPLE_USER,
    });

    expect(result.scadCode).toBeTruthy();
    expect(result.scadCode.length).toBeGreaterThan(5);

    const validation = validateScadGeometry(result.scadCode);
    expect(validation.isValid).toBe(true);

    console.log(`[smoke:deepseek] modelName=${result.modelName}, scad=${result.scadCode.length}chars`);
  });
});

// ─── Gemini ───────────────────────────────────────────────────────────────────

smokeDescribe("gemini smoke", "GEMINI_API_KEY")("gemini/gemini-2.5-pro live generation", () => {
  it("generates valid SCAD code", { timeout: 60_000 }, async () => {
    const result = await executeScadGenerationRoute({
      provider: "gemini",
      model: "gemini-2.5-pro",
      systemPrompt: SIMPLE_SYSTEM,
      userPrompt: SIMPLE_USER,
    });

    expect(result.scadCode).toBeTruthy();
    expect(result.scadCode.length).toBeGreaterThan(5);

    const validation = validateScadGeometry(result.scadCode);
    expect(validation.isValid).toBe(true);

    console.log(`[smoke:gemini] modelName=${result.modelName}, scad=${result.scadCode.length}chars`);
  });
});

// ─── Anthropic ────────────────────────────────────────────────────────────────

smokeDescribe("anthropic smoke", "ANTHROPIC_API_KEY")("anthropic/claude-sonnet-4 live generation", () => {
  it("generates valid SCAD code", { timeout: 30_000 }, async () => {
    const result = await executeScadGenerationRoute({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",

      systemPrompt: SIMPLE_SYSTEM,
      userPrompt: SIMPLE_USER,
    });

    expect(result.scadCode).toBeTruthy();
    expect(result.scadCode.length).toBeGreaterThan(5);

    const validation = validateScadGeometry(result.scadCode);
    expect(validation.isValid).toBe(true);

    console.log(`[smoke:anthropic] modelName=${result.modelName}, scad=${result.scadCode.length}chars`);
  });
});
