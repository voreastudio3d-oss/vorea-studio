import * as kv from "../server/kv.js";
import {
  generateScadWithLLM,
  getAIProviderConfigSnapshot,
  type AIProviderConfig,
} from "../server/ai-generation-engine.js";

const [provider, model] = process.argv.slice(2);

if (!provider || !model) {
  console.error(JSON.stringify({ ok: false, error: "Uso: test-single-ai-model.ts <provider> <model>" }));
  process.exit(1);
}

const TEST_INPUT = {
  prompt:
    "Genera un llavero rectangular imprimible en FDM de 40 mm x 20 mm x 3 mm con esquinas suavemente redondeadas, un agujero de 5 mm en la esquina superior izquierda y el texto 'VOREA' en relieve centrado. Mantenlo simple, limpio y totalmente compilable en OpenSCAD.",
  engine: "fdm" as const,
  familySlug: "benchmark-keychain",
  familyName: "Benchmark Keychain",
  quality: "draft" as const,
  parameters: [
    { name: "width", type: "number", defaultValue: 40, min: 20, max: 80, description: "Ancho total en mm" },
    { name: "height", type: "number", defaultValue: 20, min: 10, max: 50, description: "Alto total en mm" },
    { name: "thickness", type: "number", defaultValue: 3, min: 2, max: 6, description: "Espesor total en mm" },
    { name: "hole_diameter", type: "number", defaultValue: 5, min: 3, max: 8, description: "Diámetro del agujero" },
  ],
  scadTemplate: "",
};

function preview(text: string | undefined, max = 140): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

async function main() {
  const snapshot = await getAIProviderConfigSnapshot();
  const originalConfig = (await kv.get("admin:ai_config")) as AIProviderConfig | null;
  const startedAt = Date.now();

  try {
    await kv.set("admin:ai_config", {
      activeProvider: provider,
      activeModel: model,
      manualMode: true,
      alertThresholds: snapshot.alertThresholds,
      providers: snapshot.providers,
    });

    const result = await generateScadWithLLM(TEST_INPUT);

    console.log(JSON.stringify({
      provider,
      model,
      ok: true,
      latencyMs: Date.now() - startedAt,
      modelName: result.modelName,
      scadLength: result.scadCode.length,
      parameterCount: result.parameters.length,
      reasoningPreview: preview(result.reasoning),
    }, null, 2));
  } catch (error: any) {
    console.log(JSON.stringify({
      provider,
      model,
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error?.message || "Error inesperado",
    }, null, 2));
  } finally {
    if (originalConfig) {
      await kv.set("admin:ai_config", originalConfig);
    } else {
      await kv.del("admin:ai_config");
    }
  }
}

void main();
