/**
 * SCAD Complexity Estimator
 *
 * Analyzes SCAD source code to estimate compilation time and resource usage.
 * Returns a score and recommendation for auto-recompile suitability.
 *
 * Calibration notes (March 2026):
 * ───────────────────────────────
 * Typical user models reach 200K–800K+ polygons.  Our built-in templates
 * (Cable Clip, Gridfinity, Phone Stand, Rounded Box) are *simple* models
 * and must score as "light" or low-"medium".  Only models with deeply
 * nested loops, many boolean ops, hull/minkowski on complex geometry, or
 * very high $fn (>96) should reach "heavy".
 *
 * Weight rationale:
 *  - primitives:   cheap (1 pt each)
 *  - booleanOps:   moderate (4 pts) — normal models have 2-5
 *  - hull:         moderate (10 pts) — rounded-corner pattern is ubiquitous
 *  - minkowski:    expensive (35 pts) — real exponential cost
 *  - for loops:    cheap base (4 pts) — cost comes from the multiplier
 *  - $fn:          only above 48 matters (standard range is 24-48)
 *  - nesting:      only above 6 levels matters
 *
 * Thresholds:
 *  - light:   score < 35   (simple models, auto-recompile always)
 *  - medium:  score < 70   (moderate, auto-recompile still OK)
 *  - heavy:   score >= 70  (complex, manual compile recommended)
 */

export type ComplexityLevel = "light" | "medium" | "heavy";

export interface ComplexityEstimate {
  level: ComplexityLevel;
  score: number; // 0-100
  estimatedMs: number; // rough estimate of compile time in ms
  details: {
    primitives: number;
    booleanOps: number;
    forLoops: number;
    fnValue: number;
    hullOps: number;
    minkowskiOps: number;
    nestedDepth: number;
  };
  autoRecompileRecommended: boolean;
  warning?: string;
}

/**
 * Estimate the complexity of a SCAD source string.
 * Uses heuristic analysis (no actual parsing) for speed.
 */
export function estimateComplexity(
  source: string,
  paramValues?: Record<string, number | boolean | string | number[]>
): ComplexityEstimate {
  const s = source.toLowerCase();

  // Count primitives
  const primitives =
    countOccurrences(s, "cube(") +
    countOccurrences(s, "sphere(") +
    countOccurrences(s, "cylinder(") +
    countOccurrences(s, "polyhedron(") +
    countOccurrences(s, "linear_extrude(") +
    countOccurrences(s, "rotate_extrude(");

  // Count boolean operations
  const booleanOps =
    countOccurrences(s, "union(") +
    countOccurrences(s, "difference(") +
    countOccurrences(s, "intersection(");

  // Count expensive operations
  const hullOps = countOccurrences(s, "hull(");
  const minkowskiOps = countOccurrences(s, "minkowski(");

  // Count for loops (multiplier effect)
  const forLoops = countOccurrences(s, "for(") + countOccurrences(s, "for (");

  // Extract $fn value
  let fnValue = 24; // default
  const fnMatch = source.match(/\$fn\s*=\s*(\d+)/);
  if (fnMatch) fnValue = parseInt(fnMatch[1], 10);
  // Check paramValues override
  if (paramValues && typeof paramValues["$fn"] === "number") {
    fnValue = paramValues["$fn"] as number;
  }

  // Estimate nesting depth (rough: count max brace depth)
  let maxDepth = 0, depth = 0;
  for (const ch of source) {
    if (ch === "{") { depth++; maxDepth = Math.max(maxDepth, depth); }
    if (ch === "}") depth--;
  }

  // Estimate for-loop iteration counts
  let loopMultiplier = 1;
  const forRanges = source.matchAll(/for\s*\(\s*\w+\s*=\s*\[\s*[\d.]+\s*:\s*([\d.]+\s*:)?\s*([\d.]+)\s*\]/gi);
  for (const m of forRanges) {
    const maxVal = parseFloat(m[2]) || 10;
    loopMultiplier *= Math.min(maxVal, 100);
  }

  // ─── Calculate weighted score ─────────────────────────────────────
  let score = 0;
  score += primitives * 1;        // cheap – a dozen primitives is normal
  score += booleanOps * 4;        // moderate – 2-5 is typical
  score += hullOps * 10;          // moderate – rounded corners pattern
  score += minkowskiOps * 35;     // expensive – real CSG cost
  score += forLoops * 4;          // cheap base (multiplier adds the real cost)
  score += Math.max(0, fnValue - 48) * 0.8;  // only penalize above standard $fn
  score += Math.max(0, maxDepth - 6) * 4;    // only deep nesting matters

  // Apply loop multiplier (only when significant iterations detected)
  if (loopMultiplier > 1) {
    score *= Math.log2(loopMultiplier + 1);
  }

  // Clamp to 0-100
  score = Math.min(100, Math.max(0, score));

  // ─── Determine level ──────────────────────────────────────────────
  let level: ComplexityLevel;
  let estimatedMs: number;
  let autoRecompileRecommended: boolean;
  let warning: string | undefined;

  if (score < 35) {
    level = "light";
    estimatedMs = score * 15 + 50;
    autoRecompileRecommended = true;
  } else if (score < 70) {
    level = "medium";
    estimatedMs = score * 40 + 200;
    autoRecompileRecommended = true;
    warning = "Compilacion moderada (~" + Math.round(estimatedMs / 1000 * 10) / 10 + "s)";
  } else {
    level = "heavy";
    estimatedMs = score * 120 + 1500;
    autoRecompileRecommended = false;
    warning = "Modelo complejo. Auto-recompilacion no recomendada.";
  }

  return {
    level,
    score: Math.round(score),
    estimatedMs: Math.round(estimatedMs),
    details: {
      primitives,
      booleanOps,
      forLoops,
      fnValue,
      hullOps,
      minkowskiOps,
      nestedDepth: maxDepth,
    },
    autoRecompileRecommended,
    warning,
  };
}

function countOccurrences(str: string, sub: string): number {
  let count = 0, pos = 0;
  while ((pos = str.indexOf(sub, pos)) !== -1) { count++; pos += sub.length; }
  return count;
}

/**
 * Returns a color code for the complexity level badge.
 */
export function complexityColor(level: ComplexityLevel): string {
  switch (level) {
    case "light": return "#22c55e";
    case "medium": return "#f59e0b";
    case "heavy": return "#ef4444";
  }
}