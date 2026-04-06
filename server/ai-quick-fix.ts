/**
 * AI Quick Fix — Gemini-powered code fixer for OpenSCAD.
 * "Vorea Quick Fix" integration.
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function buildFixPrompt(source: string, errorMessage: string): string {
  return `Eres un ingeniero experto en Mallas 3D y OpenSCAD trabajando para el editor Vorea Studio.
Tu tarea es hacer un "Quick Fix" a un código SCAD que tiene errores de sintaxis o de lógica geométrica y devolver SOLO EL CÓDIGO CORREGIDO.

### Error Reportado por el Linter o el Compilador:
${errorMessage}

### Código Fuente Actual:
\`\`\`openscad
${source}
\`\`\`

### Reglas Estrictas:
1. Resuelve el error manteniendo todo lo que no esté roto exactamente igual (no reescribas la lógica base, no modifiques variables que están bien).
2. TÚ RESPUESTA DEBE SER ÚNICAMENTE EL CÓDIGO SCAD VÁLIDO Y NADA MÁS. 
3. No envuelvas el código en bloques \`\`\`openscad ni incluyas texto explicativo antes ni después. Solo devuélveme el string de texto plano que pueda compilar directamente.`;
}

let geminiFixCooldownUntil = 0;

export async function generateQuickFixWithGemini(
  source: string,
  errorMessage: string
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("[ai-quick-fix] GEMINI_API_KEY not configured");
    return null;
  }

  if (Date.now() < geminiFixCooldownUntil) {
    console.log("[ai-quick-fix] Gemini in cooldown");
    return null;
  }

  const prompt = buildFixPrompt(source, errorMessage);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2, // Low temp for logic/code
          maxOutputTokens: 2048,
          responseMimeType: "text/plain",
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.log(`[ai-quick-fix] Gemini error ${res.status}: ${body.slice(0, 300)}`);
      if (res.status === 429) {
        geminiFixCooldownUntil = Date.now() + 5 * 60 * 1000; // 5 min cooldown on rate limits
      }
      return null;
    }

    const data = await res.json();
    let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!rawText) {
      console.log("[ai-quick-fix] Failed to parse Gemini response");
      return null;
    }

    // Clean up markdown block if present despite instructions
    rawText = rawText.trim();
    if (rawText.startsWith("\`\`\`")) {
      rawText = rawText.replace(/^\`\`\`(?:openscad)?\n/, "");
      rawText = rawText.replace(/\n\`\`\`$/, "");
    }

    return rawText;
  } catch (err: any) {
    console.log(`[ai-quick-fix] Gemini error: ${err?.message}`);
    return null;
  }
}
