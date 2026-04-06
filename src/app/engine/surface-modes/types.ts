/**
 * Surface Strategy Interface — Defines how image heightmap data is mapped
 * onto different 3D surface topologies (plane, cylinder, box, polygon, etc.).
 *
 * Each strategy converts a 2D grid (u,v ∈ [0,1]) into 3D world positions,
 * handles solid inner walls, and generates caps/bases as needed.
 *
 * Vorea Studio — voreastudio.com
 */

// ─── Shared Primitive Types ──────────────────────────────────────────────────

export type Vec3Tuple = [number, number, number];

// ─── Triangle Emitter ────────────────────────────────────────────────────────
// Callback used by strategies to emit triangles into the shared buffer.

export type TriEmitter = (
  p0: Vec3Tuple,
  p1: Vec3Tuple,
  p2: Vec3Tuple,
  cr: number,
  cg: number,
  cb: number,
  preferredNormal?: Vec3Tuple
) => void;

// ─── Surface Strategy Interface ──────────────────────────────────────────────

export interface SurfaceStrategy {
  /** Human-readable mode identifier */
  readonly mode: string;

  /**
   * Map a grid point (ix, iy) on the relief surface to a 3D world position.
   * @param ix Grid column index (0..gridW)
   * @param iy Grid row index    (0..gridH)
   * @param height Displacement height at this grid point
   * @returns World-space [x, y, z]
   */
  outerPoint(ix: number, iy: number, height: number): Vec3Tuple;

  /**
   * Map a grid point on the inner support wall (solid mode).
   * For hollow shapes (cylinder, lampshade), this is the inner radius wall.
   * For flat shapes (plane), this is the base plane.
   */
  innerPoint(ix: number, iy: number): Vec3Tuple;

  /**
   * Preferred outward normal direction at a grid cell center.
   * Used for winding-order correction in addTriAuto.
   * @param ix Grid column index of the cell (0..gridW-1)
   * @param iy Grid row index of the cell (0..gridH-1)
   */
  preferredNormal(ix: number, iy: number): Vec3Tuple;

  /**
   * Estimate total triangle count for buffer pre-allocation.
   * Includes top surface, inner wall, caps, and side walls.
   */
  estimateTriCount(gridW: number, gridH: number, solid: boolean): number;

  /**
   * Generate the top (outer relief) surface triangles.
   * Called once per frame with the full grid.
   */
  generateOuterSurface(
    gridW: number,
    gridH: number,
    getHeight: (ix: number, iy: number) => number,
    getColor: (ix: number, iy: number) => Vec3Tuple,
    emitTri: TriEmitter
  ): void;

  /**
   * Generate inner wall + caps/bases (solid mode only).
   * Called only when solid=true.
   */
  generateSolidGeometry(
    gridW: number,
    gridH: number,
    getHeight: (ix: number, iy: number) => number,
    emitTri: TriEmitter,
    baseColor: Vec3Tuple,
    getColor?: (ix: number, iy: number) => Vec3Tuple
  ): void;
}

// ─── Surface Mode Registry ───────────────────────────────────────────────────

export type ReliefSurfaceMode =
  | "plane"
  | "cylinder"
  | "box"
  | "polygon"
  | "lampshade"
  | "geodesic"
  | "stl";

// ─── Common Config ───────────────────────────────────────────────────────────
// Shared parameters that multiple surface modes may use.

export interface SurfaceCommonConfig {
  gridW: number;
  gridH: number;
  /** Base thickness for solid mode (mm) */
  baseThickness: number;
}

export interface PlaneConfig extends SurfaceCommonConfig {
  width: number;
  depth: number;
}

export interface CylinderConfig extends SurfaceCommonConfig {
  radius: number;
  height: number;
}

export interface BoxConfig extends SurfaceCommonConfig {
  width: number;
  depth: number;
  height: number;
  capTop: boolean;
  capBottom: boolean;
}

export interface PolygonConfig extends SurfaceCommonConfig {
  sides: number; // 3–12
  radius: number;
  height: number;
  capTop: boolean;
  capBottom: boolean;
}

export interface LampshadeConfig extends SurfaceCommonConfig {
  /** Outer radius at the bottom of the lampshade (mm) */
  outerRadiusBottom: number;
  /** Outer radius at the top of the lampshade (mm). Different from bottom → cone shape */
  outerRadiusTop: number;
  /** Radius of the hole if a cap is active (mm) */
  holeRadius: number;
  height: number;
  capPosition: "top" | "bottom" | "both" | "none";
  /** Optional: use polygon sides instead of smooth cylinder (0 = smooth) */
  sides: number;
}

export interface GeodesicConfig extends SurfaceCommonConfig {
  /** Sphere base radius (mm) */
  radius: number;
}
