/**
 * Analytics Insights — Gemini-powered analysis of GA4 metrics.
 * Generates actionable suggestions for product decisions.
 */

import type { Ga4MetricsBundle } from "./ga4-data.js";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// ─── Types ───────────────────────────────────────────────────────────────────

export type InsightCategory = "activation" | "conversion" | "retention" | "growth" | "risk" | "trend_discovery";
export type InsightPriority = "high" | "medium" | "low";

export interface AnalyticsInsight {
  category: InsightCategory;
  priority: InsightPriority;
  title: string;
  insight: string;
  action: string;
  metric_reference: string;
}

export interface AnalyticsInsightsResponse {
  period: string;
  generatedAt: string;
  metrics: Ga4MetricsBundle | null;
  insights: AnalyticsInsight[];
  cached: boolean;
  mock: boolean;
  configured: boolean;
  available: boolean;
  unavailableReason?: string | null;
}

export interface InternalTrends {
  totalRecipes: number;
  topFamilies: string[];
  popularKeywords: string[];
  scadSamples?: string[];
}

// ─── Gemini prompt builder ───────────────────────────────────────────────────

const GEMINI_MODEL = "gemini-1.5-pro"; // Forced Gemini Pro for heavy induction (Market Analytics & Code Parsing)

function buildInsightsPrompt(metrics: Ga4MetricsBundle, internalTrends?: InternalTrends | null): string {
  const metricsJson = JSON.stringify(
    {
      period: metrics.period,
      overview: metrics.overview,
      topEvents: metrics.topEvents.slice(0, 10),
      toolUsage: metrics.toolUsage,
      exportEvents: metrics.exportEvents,
      signupFunnel: metrics.signupFunnel,
      topPages: metrics.topPages.slice(0, 8),
      pricingClicks: metrics.pricingClicks,
    },
    null,
    2
  );

  let trendsText = "";
  if (internalTrends) {
    trendsText = `
Además, nuestro pipeline ha extraído las rutinas de código paramétrico (SCAD) generadas por los usuarios recientemente. Esto demuestra lo que nuestra base de usuarios está intentando fabricar:
- Total Generaciones de IA recientes: ${internalTrends.totalRecipes}
- Familias Paramétricas más buscadas: ${internalTrends.topFamilies.join(", ")}
- Palabras clave populares en Prompts: ${internalTrends.popularKeywords.join(", ")}
- Snapshots de Código Estructural (Módulos SCAD recurrentes):
${internalTrends.popularKeywords.slice(0, 3).map((w, i) => `   Muestra de Código [${i}]: \n   ${internalTrends.scadSamples?.[i] || 'N/A'}`).join("\n")}

`;
  }

  return `Eres un analista senior de producto y un Analizador de Tendencias 3D de Vorea Studio, una plataforma web de diseño 3D paramétrico para impresión 3D.

Vorea Studio tiene estas herramientas:
- Studio: editor paramétrico SCAD
- Relief: mapas de altura → superficies 3D
- Organic: deformaciones orgánicas
- AI Studio: prompt → SCAD generado por IA
- MakerWorld: publicación directa a MakerWorld de Bambu Lab
- GCode Collection: colección personal de GCodes
- Comunidad/Explore: galería pública

Modelo de negocio: freemium con planes PRO ($4/mes) y STUDIO PRO ($14.5/mes). Los exports consumen créditos.

Aquí están los datos de GA4 de los últimos ${metrics.period}:
${metricsJson}
${trendsText}

Instrucción especial de Tendencias (Exploración de Competencias & Código):
Usa tu profundo razonamiento deductivo para cruzar los "Snapshots de Código Estructural" de SCAD con el meta actual de repositorios 3D (MakerWorld de Bambu Lab, Creality Cloud, Printables). Esfuerzate en encontrar patrones matemáticos o geométricos en el código SCAD que nos indiquen qué piezas están de moda (ej. cajas apilables, bisagras print-in-place, organizadores de escritorio).
Recomienda proactivamente qué nuevas "Familias" paramétricas o Templates exactos el equipo de desarrollo debe codificar internamente en Vorea Studio para robar o ganar tráfico de estos portales. Tu inferencia DEBE justificar su respuesta técnica basándose en la geometría del SCAD y cómo compite con MakerWorld.

Genera exactamente 5 sugerencias accionables. Obligatoriamente 1 o 2 de estas sugerencias DEBERÁN ser de la categoría "trend_discovery" guiadas por la instrucción especial. Responde SOLO con un JSON array válido, sin markdown:

[
  {
    "category": "activation|conversion|retention|growth|risk|trend_discovery",
    "priority": "high|medium|low",
    "title": "Título corto en español (max 60 chars)",
    "insight": "Observación concreta elaborada (max 150 chars)",
    "action": "Acción específica y ejecutable recomendada (max 200 chars)",
    "metric_reference": "Métrica, patrón de palabras clave, o tendencia que sustenta la sugerencia"
  }
]

Reglas:
- Cada sugerencia debe tener una categoría diferente.
- Asegura que exista al menos un insight de "trend_discovery" detallando tendencias populares externas para justificar qué template deben desarrollar localmente en Vorea.
- Prioriza insights accionables, innovadores y nada obvios.
- Referencia métricas reales o palabras clave de los datos provistos.
- Sé extremadamente conciso pero incisivo con el descubrimiento de productos en 3D.`;
}

// ─── Database Trends ─────────────────────────────────────────────────────────

export async function getInternalDbTrends(): Promise<InternalTrends | null> {
  let pool, prisma;
  try {
    const connectionString = process.env.DATABASE_URL || "postgresql://vorea:vorea_dev@localhost:5432/vorea_studio?schema=public";
    pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    const totalRecipes = await (prisma as any).aiStudioRecipe.count();

    const groups = await (prisma as any).aiStudioRecipe.groupBy({
      by: ['familyHint'],
      _count: { familyHint: true },
      orderBy: { _count: { familyHint: 'desc' } },
      take: 5
    });
    
    const samples = await (prisma as any).aiStudioRecipe.findMany({
      select: { prompt: true, parameterOverrides: true },
      take: 50,
      orderBy: { createdAt: 'desc' }
    });
    
    // Extraer SCAD simulado u override keys relevantes para insights
    const scadSamples = samples
      .map((r: any) => typeof r.parameterOverrides === 'object' && r.parameterOverrides !== null ? r.parameterOverrides._simulatedScad : null)
      .filter(Boolean)
      .slice(0, 3);

    const words = samples
      .map((r: any) => r.prompt.toLowerCase())
      .join(" ")
      .split(/\W+/)
      .filter((w: string) => w.length > 4); // Filter very common short words

    const wordCounts = words.reduce((acc: any, w: string) => { acc[w] = (acc[w] || 0) + 1; return acc; }, {} as Record<string, number>);
    const popularKeywords = Object.entries(wordCounts)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 8)
      .map((entry) => entry[0] as string);

    return {
      totalRecipes,
      topFamilies: groups.map((g: any) => g.familyHint).filter(Boolean),
      popularKeywords,
      scadSamples
    };
  } catch(e) {
    console.warn("[analytics-insights] Error getting DB trends:", e);
    return null;
  } finally {
    if (prisma) await prisma.$disconnect();
    if (pool) await pool.end();
  }
}

// ─── Gemini caller ───────────────────────────────────────────────────────────

let geminiCooldownUntil = 0;

function parseInsightsJson(raw: string): AnalyticsInsight[] | null {
  try {
    // Strip markdown fences if present
    let clean = raw.trim();
    if (clean.startsWith("\`\`\`")) {
      clean = clean.replace(/^\`\`\`(?:json)?\n?/, "").replace(/\n?\`\`\`$/, "");
    }
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed)) return null;

    const validCategories = new Set(["activation", "conversion", "retention", "growth", "risk", "trend_discovery"]);
    const validPriorities = new Set(["high", "medium", "low"]);

    return parsed
      .filter(
        (item: any) =>
          item &&
          typeof item.title === "string" &&
          typeof item.insight === "string" &&
          typeof item.action === "string" &&
          validCategories.has(item.category) &&
          validPriorities.has(item.priority)
      )
      .slice(0, 5);
  } catch {
    return null;
  }
}

export async function generateInsightsWithGemini(
  metrics: Ga4MetricsBundle
): Promise<AnalyticsInsight[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("[analytics-insights] GEMINI_API_KEY not configured");
    return [];
  }

  if (Date.now() < geminiCooldownUntil) {
    console.log("[analytics-insights] Gemini in cooldown");
    return [];
  }

  const internalTrends = await getInternalDbTrends();
  const prompt = buildInsightsPrompt(metrics, internalTrends);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7, // Add a bit of creativity for trend discovery
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.log(`[analytics-insights] Gemini error ${res.status}: ${body.slice(0, 300)}`);
      if (res.status === 429) {
        geminiCooldownUntil = Date.now() + 30 * 60 * 1000;
      }
      return [];
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const insights = parseInsightsJson(rawText);

    if (!insights || insights.length === 0) {
      console.log("[analytics-insights] Failed to parse Gemini response");
      return [];
    }

    return insights;
  } catch (err: any) {
    console.log(`[analytics-insights] Gemini error: ${err?.message}`);
    return [];
  }
}

/**
 * Generate fallback insights when Gemini is unavailable.
 */
export function generateFallbackInsights(metrics: Ga4MetricsBundle): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];

  // Activation check
  const toolEvents = metrics.toolUsage.reduce((sum, r) => sum + (r.metrics.eventCount || 0), 0);
  const exportEvents = metrics.exportEvents.reduce((sum, r) => sum + (r.metrics.eventCount || 0), 0);
  if (toolEvents > 0 && exportEvents / toolEvents < 0.1) {
    insights.push({
      category: "activation",
      priority: "high",
      title: "Baja conversión de herramienta a export",
      insight: `Solo ${Math.round((exportEvents / toolEvents) * 100)}% de los usuarios que abren herramientas llegan a exportar`,
      action: "Mejorar onboarding con tutorial inline o modelo de ejemplo preconfigurado",
      metric_reference: `${exportEvents} exports / ${toolEvents} open_tool`,
    });
  }

  // Conversion check
  const signupStart = metrics.signupFunnel.find(r => r.dimensions.eventName === "sign_up_start")?.metrics.eventCount || 0;
  const signupComplete = metrics.signupFunnel.find(r => r.dimensions.eventName === "sign_up_complete")?.metrics.eventCount || 0;
  if (signupStart > 0) {
    const rate = signupComplete / signupStart;
    insights.push({
      category: "conversion",
      priority: rate < 0.3 ? "high" : "medium",
      title: `Funnel de signup: ${Math.round(rate * 100)}% completa`,
      insight: `${signupStart} usuarios inician signup pero solo ${signupComplete} completan`,
      action: rate < 0.3 ? "Simplificar formulario de registro o ofrecer signup con Google más prominente" : "Revisar fricción en el paso de registro",
      metric_reference: `sign_up_start: ${signupStart}, sign_up_complete: ${signupComplete}`,
    });
  }

  // Growth check
  if (metrics.overview.newUsers > 0) {
    const newUserRate = metrics.overview.newUsers / metrics.overview.activeUsers;
    insights.push({
      category: "growth",
      priority: newUserRate > 0.4 ? "low" : "medium",
      title: `${Math.round(newUserRate * 100)}% usuarios nuevos`,
      insight: `${metrics.overview.newUsers} nuevos de ${metrics.overview.activeUsers} activos en ${metrics.period}`,
      action: newUserRate > 0.4 ? "Buen flujo de nuevos usuarios, mantener SEO y contenido" : "Ampliar canales de adquisición: SEO, redes, partnerships",
      metric_reference: `newUsers: ${metrics.overview.newUsers}, activeUsers: ${metrics.overview.activeUsers}`,
    });
  }

  // Risk — bounce rate
  if (metrics.overview.bounceRate > 0.6) {
    insights.push({
      category: "risk",
      priority: "high",
      title: `Bounce rate alto: ${Math.round(metrics.overview.bounceRate * 100)}%`,
      insight: "Más de la mitad de las visitas abandonan sin interactuar",
      action: "Revisar landing hero, velocidad de carga, y CTA visible above-the-fold",
      metric_reference: `bounceRate: ${Math.round(metrics.overview.bounceRate * 100)}%`,
    });
  }

  // Retention — top tool
  const topTool = metrics.toolUsage[0];
  if (topTool) {
    insights.push({
      category: "retention",
      priority: "medium",
      title: `${topTool.dimensions["customEvent:tool"] || "Herramienta top"} es la más usada`,
      insight: `${topTool.metrics.eventCount} activaciones, domina el uso de herramientas`,
      action: "Profundizar esta herramienta con más familias/templates y contenido tutorial",
      metric_reference: `open_tool[${topTool.dimensions["customEvent:tool"]}]: ${topTool.metrics.eventCount}`,
    });
  }

  return insights.slice(0, 5);
}
