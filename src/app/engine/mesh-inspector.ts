/**
 * Mesh Inspector — Pure JS mesh health analysis for 3D printability.
 *
 * Analyzes BufferGeometry for:
 * - Non-manifold edges (shared by >2 faces)
 * - Boundary edges (holes — shared by only 1 face)
 * - Degenerate triangles (near-zero area)
 * - Watertightness and manifoldness
 * - Volume estimation (signed tetrahedron method)
 *
 * Vorea Studio — voreastudio.com
 */

import type * as THREE from "three";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MeshHealthScore = "printable" | "warnings" | "not-printable";

export interface MeshHealthReport {
  /** True if every edge is shared by exactly 2 faces */
  isWatertight: boolean;
  /** True if no edge is shared by >2 faces */
  isManifold: boolean;
  /** Edges belonging to only 1 triangle (holes) */
  boundaryEdges: number;
  /** Edges shared by >2 triangles (topological error) */
  nonManifoldEdges: number;
  /** Triangles with area < epsilon */
  degenerateTriangles: number;
  /** Total face count */
  totalFaces: number;
  /** Unique vertex count (after welding) */
  totalVertices: number;
  /** Estimated volume in mm³ (only meaningful if watertight) */
  volumeEstimate: number;
  /** Overall printability score */
  score: MeshHealthScore;
  /** Human-readable summary */
  summary: string;
  /** Duration of analysis in ms */
  analysisTimeMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum triangle area to not be considered degenerate */
const DEGENERATE_AREA_THRESHOLD = 1e-10;

/** Vertex welding precision (decimal places) for edge key generation */
const WELD_PRECISION = 4;

// ─── Edge key helper ──────────────────────────────────────────────────────────

/**
 * Create a canonical edge key from two vertex indices.
 * Always orders the pair so (a,b) and (b,a) produce the same key.
 */
function edgeKey(v1: number, v2: number): string {
  return v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;
}

/**
 * Weld vertices by snapping to a grid and return a remap array.
 * This ensures topologically shared vertices produce the same index.
 */
function buildVertexRemap(
  posAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute
): { remap: Int32Array; uniqueCount: number } {
  const count = posAttr.count;
  const vertexMap = new Map<string, number>();
  const remap = new Int32Array(count);
  let uniqueCount = 0;

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const key = `${x.toFixed(WELD_PRECISION)},${y.toFixed(WELD_PRECISION)},${z.toFixed(WELD_PRECISION)}`;

    let idx = vertexMap.get(key);
    if (idx === undefined) {
      idx = uniqueCount++;
      vertexMap.set(key, idx);
    }
    remap[i] = idx;
  }

  return { remap, uniqueCount };
}

// ─── Triangle area ────────────────────────────────────────────────────────────

function triangleArea(
  posAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  i0: number,
  i1: number,
  i2: number
): number {
  const ax = posAttr.getX(i0), ay = posAttr.getY(i0), az = posAttr.getZ(i0);
  const bx = posAttr.getX(i1), by = posAttr.getY(i1), bz = posAttr.getZ(i1);
  const cx = posAttr.getX(i2), cy = posAttr.getY(i2), cz = posAttr.getZ(i2);

  // Cross product of (B-A) × (C-A)
  const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
  const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
  const nx = e1y * e2z - e1z * e2y;
  const ny = e1z * e2x - e1x * e2z;
  const nz = e1x * e2y - e1y * e2x;

  return 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz);
}

// ─── Signed volume (tetrahedron method) ───────────────────────────────────────

/**
 * Signed volume of a tetrahedron formed by a triangle and the origin.
 * Sum over all faces → total mesh volume (if watertight & consistent normals).
 */
function signedTetraVolume(
  posAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  i0: number,
  i1: number,
  i2: number
): number {
  const ax = posAttr.getX(i0), ay = posAttr.getY(i0), az = posAttr.getZ(i0);
  const bx = posAttr.getX(i1), by = posAttr.getY(i1), bz = posAttr.getZ(i1);
  const cx = posAttr.getX(i2), cy = posAttr.getY(i2), cz = posAttr.getZ(i2);

  return (
    ax * (by * cz - bz * cy) +
    ay * (bz * cx - bx * cz) +
    az * (bx * cy - by * cx)
  ) / 6.0;
}

// ─── Main Inspector ───────────────────────────────────────────────────────────

/**
 * Analyze a Three.js BufferGeometry for printability.
 * Works on both indexed and non-indexed geometries.
 * Time complexity: O(n) where n = number of triangles.
 */
export function inspectMesh(geometry: THREE.BufferGeometry): MeshHealthReport {
  const t0 = performance.now();

  const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
  if (!posAttr) {
    return {
      isWatertight: false,
      isManifold: false,
      boundaryEdges: 0,
      nonManifoldEdges: 0,
      degenerateTriangles: 0,
      totalFaces: 0,
      totalVertices: 0,
      volumeEstimate: 0,
      score: "not-printable",
      summary: "No position attribute found",
      analysisTimeMs: performance.now() - t0,
    };
  }

  const indexAttr = geometry.getIndex();

  // Determine triangle count
  const totalFaces = indexAttr
    ? indexAttr.count / 3
    : posAttr.count / 3;

  // Weld vertices to find shared edges
  const { remap, uniqueCount } = buildVertexRemap(posAttr);

  // Build edge-to-face-count map
  const edgeFaceCount = new Map<string, number>();
  let degenerateTriangles = 0;
  let totalVolume = 0;

  for (let t = 0; t < totalFaces; t++) {
    let i0: number, i1: number, i2: number;

    if (indexAttr) {
      i0 = indexAttr.getX(t * 3);
      i1 = indexAttr.getX(t * 3 + 1);
      i2 = indexAttr.getX(t * 3 + 2);
    } else {
      i0 = t * 3;
      i1 = t * 3 + 1;
      i2 = t * 3 + 2;
    }

    // Remap to welded indices
    const w0 = remap[i0];
    const w1 = remap[i1];
    const w2 = remap[i2];

    // Skip degenerate triangles (collapsed to a point or line)
    if (w0 === w1 || w1 === w2 || w0 === w2) {
      degenerateTriangles++;
      continue;
    }

    // Check area
    const area = triangleArea(posAttr, i0, i1, i2);
    if (area < DEGENERATE_AREA_THRESHOLD) {
      degenerateTriangles++;
      continue;
    }

    // Count edges
    const e1 = edgeKey(w0, w1);
    const e2 = edgeKey(w1, w2);
    const e3 = edgeKey(w0, w2);

    edgeFaceCount.set(e1, (edgeFaceCount.get(e1) || 0) + 1);
    edgeFaceCount.set(e2, (edgeFaceCount.get(e2) || 0) + 1);
    edgeFaceCount.set(e3, (edgeFaceCount.get(e3) || 0) + 1);

    // Accumulate signed volume
    totalVolume += signedTetraVolume(posAttr, i0, i1, i2);
  }

  // Analyze edge map
  let boundaryEdges = 0;
  let nonManifoldEdges = 0;

  for (const count of edgeFaceCount.values()) {
    if (count === 1) boundaryEdges++;
    else if (count > 2) nonManifoldEdges++;
    // count === 2 is manifold (OK)
  }

  const isWatertight = boundaryEdges === 0;
  const isManifold = nonManifoldEdges === 0;
  const volumeEstimate = Math.abs(totalVolume);

  // Score
  let score: MeshHealthScore;
  if (isWatertight && isManifold && degenerateTriangles === 0) {
    score = "printable";
  } else if (!isManifold || boundaryEdges > totalFaces * 0.1) {
    score = "not-printable";
  } else {
    score = "warnings";
  }

  // Summary
  const parts: string[] = [];
  if (score === "printable") {
    parts.push(`Mesh sólido (${totalFaces.toLocaleString()} caras, ${volumeEstimate.toFixed(1)} mm³)`);
  } else {
    if (boundaryEdges > 0) parts.push(`${boundaryEdges} bordes abiertos`);
    if (nonManifoldEdges > 0) parts.push(`${nonManifoldEdges} bordes non-manifold`);
    if (degenerateTriangles > 0) parts.push(`${degenerateTriangles} triángulos degenerados`);
  }

  const analysisTimeMs = performance.now() - t0;

  return {
    isWatertight,
    isManifold,
    boundaryEdges,
    nonManifoldEdges,
    degenerateTriangles,
    totalFaces,
    totalVertices: uniqueCount,
    volumeEstimate,
    score,
    summary: parts.join(", "),
    analysisTimeMs,
  };
}
