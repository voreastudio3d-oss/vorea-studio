/**
 * Mesh Repair — Wrapper around manifold-3d WASM for auto-repair.
 *
 * Converts Three.js BufferGeometry to Manifold format, attempts repair,
 * and converts back. Uses lazy WASM initialization.
 *
 * Vorea Studio — voreastudio.com
 */

import * as THREE from "three";

// ─── Lazy WASM module loading ─────────────────────────────────────────────────

let manifoldModule: any = null;

async function getManifold(): Promise<any> {
  if (manifoldModule) return manifoldModule;
  // Dynamic import to lazy-load the ~400KB WASM module
  const mod = await import("manifold-3d");
  manifoldModule = mod;
  return mod;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RepairResult {
  /** Repaired geometry (or original if already manifold) */
  geometry: THREE.BufferGeometry;
  /** Whether repair was needed */
  wasRepaired: boolean;
  /** Human-readable summary of what was done */
  summary: string;
  /** Duration of repair in ms */
  repairTimeMs: number;
}

// ─── Vertex welding (reused from threemf-exporter logic) ──────────────────────

const WELD_PRECISION = 4;

interface WeldedData {
  vertices: Float32Array; // flat [x,y,z, x,y,z, ...]
  indices: Uint32Array;   // flat [i0,i1,i2, i0,i1,i2, ...]
  vertexCount: number;
  triCount: number;
  /** Map from welded index → list of original indices that share this position */
  mergeFrom: Uint32Array;
  mergeTo: Uint32Array;
}

function weldGeometry(
  posAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  indexAttr: THREE.BufferAttribute | null
): WeldedData {
  const srcCount = posAttr.count;
  const vertexMap = new Map<string, number>();
  const remap = new Int32Array(srcCount);
  const positions: number[] = [];
  let uniqueCount = 0;

  // Build vertex remap
  for (let i = 0; i < srcCount; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const key = `${x.toFixed(WELD_PRECISION)},${y.toFixed(WELD_PRECISION)},${z.toFixed(WELD_PRECISION)}`;

    let idx = vertexMap.get(key);
    if (idx === undefined) {
      idx = uniqueCount++;
      vertexMap.set(key, idx);
      positions.push(x, y, z);
    }
    remap[i] = idx;
  }

  // Build triangle index array
  let triCount: number;
  const indices: number[] = [];

  if (indexAttr) {
    triCount = indexAttr.count / 3;
    for (let t = 0; t < triCount; t++) {
      const i0 = indexAttr.getX(t * 3);
      const i1 = indexAttr.getX(t * 3 + 1);
      const i2 = indexAttr.getX(t * 3 + 2);
      indices.push(remap[i0], remap[i1], remap[i2]);
    }
  } else {
    triCount = srcCount / 3;
    for (let t = 0; t < triCount; t++) {
      indices.push(remap[t * 3], remap[t * 3 + 1], remap[t * 3 + 2]);
    }
  }

  // Build merge vectors for Manifold
  const mergeFrom: number[] = [];
  const mergeTo: number[] = [];
  for (let i = 0; i < srcCount; i++) {
    const target = remap[i];
    if (target !== i && !mergeFrom.includes(i)) {
      mergeFrom.push(i);
      mergeTo.push(target);
    }
  }

  return {
    vertices: new Float32Array(positions),
    indices: new Uint32Array(indices),
    vertexCount: uniqueCount,
    triCount,
    mergeFrom: new Uint32Array(mergeFrom),
    mergeTo: new Uint32Array(mergeTo),
  };
}

// ─── Main Repair Function ─────────────────────────────────────────────────────

/**
 * Attempt to repair a Three.js BufferGeometry to make it manifold.
 *
 * Strategy:
 * 1. Weld vertices and build indexed mesh
 * 2. Try Manifold.ofMesh() — if it succeeds, the mesh is already manifold
 * 3. If it fails, use importManifold() with tolerance to auto-close gaps
 * 4. Convert result back to BufferGeometry
 */
export async function repairMesh(
  srcGeometry: THREE.BufferGeometry
): Promise<RepairResult> {
  const t0 = performance.now();

  try {
    const mod = await getManifold();
    const { Manifold, Mesh: ManifoldMesh } = mod;

    const posAttr = srcGeometry.getAttribute("position") as THREE.BufferAttribute;
    const indexAttr = srcGeometry.getIndex();
    const welded = weldGeometry(posAttr, indexAttr);

    // Build Manifold Mesh: vertProperties is interleaved [x,y,z, x,y,z, ...]
    const meshOptions: any = {
      numProp: 3,
      vertProperties: welded.vertices,
      triVerts: welded.indices,
    };

    let manifold: any;
    let wasRepaired = false;

    try {
      // First try: direct construction (fast, fails if not manifold)
      const mesh = new ManifoldMesh(meshOptions);
      manifold = Manifold.ofMesh(mesh);
    } catch (_directError) {
      // Second try: use merge vectors for gap-closing
      try {
        meshOptions.mergeFromVert = welded.mergeFrom;
        meshOptions.mergeToVert = welded.mergeTo;
        const mesh = new ManifoldMesh(meshOptions);
        manifold = Manifold.ofMesh(mesh);
        wasRepaired = true;
      } catch (_mergeError) {
        // Third try: export to STL buffer and reimport with tolerance
        try {
          const { exportToSTL } = await import("./threemf-exporter");
          const stlBlob = exportToSTL(srcGeometry);
          const stlBuffer = await stlBlob.arrayBuffer();
          manifold = await mod.importManifold(stlBuffer, { tolerance: 0.1 });
          wasRepaired = true;
        } catch (importError) {
          // All repair attempts failed — return original
          return {
            geometry: srcGeometry,
            wasRepaired: false,
            summary: `Reparación fallida: ${(importError as Error)?.message || "unknown"}`,
            repairTimeMs: performance.now() - t0,
          };
        }
      }
    }

    // Extract repaired mesh
    const repairedMesh = manifold.getMesh();
    const numProp = repairedMesh.numProp;
    const verts = repairedMesh.vertProperties;
    const tris = repairedMesh.triVerts;
    const vertCount = verts.length / numProp;
    const triCount = tris.length / 3;

    // Convert back to Three.js BufferGeometry (non-indexed for compatibility)
    const positions = new Float32Array(triCount * 3 * 3);
    for (let t = 0; t < triCount; t++) {
      for (let v = 0; v < 3; v++) {
        const vertIdx = tris[t * 3 + v];
        const offset = vertIdx * numProp;
        positions[(t * 3 + v) * 3] = verts[offset];
        positions[(t * 3 + v) * 3 + 1] = verts[offset + 1];
        positions[(t * 3 + v) * 3 + 2] = verts[offset + 2];
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    geo.computeBoundingBox();

    // Transfer vertex colors from original if they exist
    const colorAttr = srcGeometry.getAttribute("color");
    if (colorAttr && colorAttr.count === posAttr.count) {
      // Colors can't be directly transferred since topology changed
      // Leave them off for now — the caller can re-apply UV mapping
    }

    // Clean up WASM memory
    manifold.delete?.();

    return {
      geometry: geo,
      wasRepaired,
      summary: wasRepaired
        ? `Reparado: ${triCount.toLocaleString()} caras, ${vertCount.toLocaleString()} vértices`
        : `Mesh ya era manifold (${triCount.toLocaleString()} caras)`,
      repairTimeMs: performance.now() - t0,
    };
  } catch (err) {
    return {
      geometry: srcGeometry,
      wasRepaired: false,
      summary: `Error: ${(err as Error)?.message || "unknown"}`,
      repairTimeMs: performance.now() - t0,
    };
  }
}
