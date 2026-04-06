import type { QualityProfile } from "./instruction-spec";

export interface CompilePreviewResult {
  quality: QualityProfile;
  score: number;
  level: "light" | "medium" | "heavy";
  estimatedMs: number;
  metrics: {
    primitives: number;
    booleans: number;
    loops: number;
    detailHints: number;
  };
  warnings: string[];
}

export function estimateCompilePreview(scad: string, quality: QualityProfile): CompilePreviewResult {
  const primitives = (scad.match(/\bcube\b|\bcylinder\b|\bsphere\b|\bpolyhedron\b/g) || []).length;
  const booleans = (scad.match(/\bdifference\b|\bunion\b|\bintersection\b|\bhull\b|\bminkowski\b/g) || []).length;
  const loops = (scad.match(/\bfor\s*\(/g) || []).length;
  const detailHints = (scad.match(/\$fn\s*=\s*\d+/g) || []).length;

  const baseScore = primitives * 2 + booleans * 6 + loops * 8 + detailHints * 5;
  const profileMultiplier = quality === "final" ? 1.35 : 0.85;
  const score = Math.max(1, Math.round(baseScore * profileMultiplier));
  const estimatedMs = Math.max(80, score * 14);

  const level =
    score >= 120 ? "heavy" :
    score >= 60 ? "medium" :
    "light";

  const warnings: string[] = [];
  if (level === "heavy") {
    warnings.push("Modelo potencialmente costoso de compilar; considerar draft para iterar.");
  }
  if (loops > 12) {
    warnings.push("Alto numero de bucles detectado en SCAD.");
  }

  return {
    quality,
    score,
    level,
    estimatedMs,
    metrics: {
      primitives,
      booleans,
      loops,
      detailHints,
    },
    warnings,
  };
}
