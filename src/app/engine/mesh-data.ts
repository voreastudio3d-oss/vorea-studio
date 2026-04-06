/**
 * Serializable mesh format for transferring CSG results
 * between Web Worker and main thread.
 */

// ─── Serialized types (JSON-safe, postMessage-safe) ───────────────────────────

export interface SerializedVertex {
  px: number; py: number; pz: number;
  nx: number; ny: number; nz: number;
}

export interface SerializedPolygon {
  vertices: SerializedVertex[];
  planeNx: number; planeNy: number; planeNz: number; planeW: number;
}

export interface SerializedMesh {
  polygons: SerializedPolygon[];
  faceCount: number;
}

// ─── Worker message protocol ──────────────────────────────────────────────────

export interface WorkerCompileRequest {
  type: "compile";
  id: number;
  source: string;
  values: Record<string, number | boolean | string | number[]>;
}

export interface WorkerCompileResponse {
  type: "result";
  id: number;
  mesh: SerializedMesh | null;
  time: number;
  faceCount: number;
  error?: string;
}

// ─── Renderable interface (duck-typed to match mesh-renderer expectations) ────

export interface RenderableMesh {
  toPolygons(): RenderablePolygon[];
}

export interface RenderablePolygon {
  vertices: Array<{
    pos: { x: number; y: number; z: number };
    normal: { x: number; y: number; z: number };
  }>;
  plane: {
    normal: { x: number; y: number; z: number };
    w: number;
  };
}

/**
 * Convert serialized mesh data to a renderable object.
 * Much lighter than full CSG reconstruction.
 */
export function deserializeToRenderable(mesh: SerializedMesh): RenderableMesh {
  const polygons: RenderablePolygon[] = mesh.polygons.map(sp => ({
    vertices: sp.vertices.map(sv => ({
      pos: { x: sv.px, y: sv.py, z: sv.pz },
      normal: { x: sv.nx, y: sv.ny, z: sv.nz },
    })),
    plane: {
      normal: { x: sp.planeNx, y: sp.planeNy, z: sp.planeNz },
      w: sp.planeW,
    },
  }));

  return { toPolygons: () => polygons };
}
