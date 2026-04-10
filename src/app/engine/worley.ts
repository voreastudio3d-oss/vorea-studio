/**
 * Worley / Cellular Noise 3D
 *
 * Deterministic procedural noise based on random feature points in a 3D grid.
 * Returns F1 (closest), F2 (second closest), and edge (F2−F1) distances.
 *
 * Used by the geometry modifier system to create organic surface patterns:
 *  - F1 → dimples / spherical dents
 *  - F2 → faceted bumps
 *  - Edge → cracked surface / scales
 *
 * Ported from Vorea Parametrics 3D (old project) with optimizations.
 *
 * Vorea Studio — voreastudio.com
 */

/** Deterministic PRNG — mulberry32 (fast, 32-bit, uniform distribution). */
function mulberry32(a: number): () => number {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Result of a Worley evaluation at a single 3D point. */
export interface WorleyResult {
  /** Distance to closest feature point */
  f1: number;
  /** Distance to second closest feature point */
  f2: number;
  /** Edge distance (f2 − f1) — useful for cell boundaries */
  edge: number;
}

/** Distance metric for Worley evaluation. */
export type WorleyMetric = "euclidean" | "manhattan" | "chebyshev";

/**
 * Create a Worley noise evaluator seeded with a deterministic value.
 *
 * @param seed  Integer seed for reproducible patterns.
 * @param metric  Distance metric (default: euclidean).
 * @returns  A function `(x, y, z) => WorleyResult`.
 */
export function createWorleyNoise3D(
  seed: number = 42,
  metric: WorleyMetric = "euclidean",
): (px: number, py: number, pz: number) => WorleyResult {
  // Pre-compute distance function
  const dist =
    metric === "manhattan"
      ? (dx: number, dy: number, dz: number) =>
          Math.abs(dx) + Math.abs(dy) + Math.abs(dz)
      : metric === "chebyshev"
        ? (dx: number, dy: number, dz: number) =>
            Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz))
        : // euclidean (squared, sqrt later)
          null;

  function getFeaturePoint(
    cx: number,
    cy: number,
    cz: number,
  ): [number, number, number] {
    const cellHash = Math.abs(
      (Math.imul(cx, 73856093) ^
        Math.imul(cy, 19349663) ^
        Math.imul(cz, 83492791)) ^
        seed,
    );
    const prng = mulberry32(cellHash);
    return [cx + prng(), cy + prng(), cz + prng()];
  }

  return function evaluate(px: number, py: number, pz: number): WorleyResult {
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    const cz = Math.floor(pz);

    let f1 = Infinity;
    let f2 = Infinity;

    // Search 3×3×3 neighborhood
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (let k = -1; k <= 1; k++) {
          const feat = getFeaturePoint(cx + i, cy + j, cz + k);
          const dx = feat[0] - px;
          const dy = feat[1] - py;
          const dz = feat[2] - pz;

          let d: number;
          if (dist) {
            d = dist(dx, dy, dz);
          } else {
            // Euclidean: compare squared, sqrt at exit
            d = dx * dx + dy * dy + dz * dz;
          }

          if (d < f1) {
            f2 = f1;
            f1 = d;
          } else if (d < f2) {
            f2 = d;
          }
        }
      }
    }

    // For euclidean, take sqrt now
    if (!dist) {
      f1 = Math.sqrt(f1);
      f2 = Math.sqrt(f2);
    }

    return { f1, f2, edge: f2 - f1 };
  };
}
