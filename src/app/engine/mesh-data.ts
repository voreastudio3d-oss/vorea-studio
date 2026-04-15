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
  /** Optional RGB color [0-1, 0-1, 0-1] for per-polygon coloring */
  color?: [number, number, number];
}

export interface SerializedMesh {
  polygons: SerializedPolygon[];
  faceCount: number;
}

// ─── Worker message protocol ──────────────────────────────────────────────────

/** Serialized image data for transfer to worker */
export interface SerializedImage {
  width: number;
  height: number;
  /** RGBA pixel data */
  data: ArrayBuffer;
}

export interface WorkerCompileRequest {
  type: "compile";
  id: number;
  source: string;
  values: Record<string, number | boolean | string | number[]>;
  /** SVG files keyed by filename (lowercase) for import() support */
  svgs?: Record<string, string>;
  /** Image files keyed by filename for surface() support */
  images?: Record<string, SerializedImage>;
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
  color?: [number, number, number];
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
    ...(sp.color ? { color: sp.color } : {}),
  }));

  return { toPolygons: () => polygons };
}
