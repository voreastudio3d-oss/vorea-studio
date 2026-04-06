/**
 * Surface Modes — Barrel export for all surface strategies.
 *
 * Vorea Studio — voreastudio.com
 */

export type { SurfaceStrategy, TriEmitter, Vec3Tuple, ReliefSurfaceMode } from "./types";
export type {
  SurfaceCommonConfig,
  PlaneConfig,
  CylinderConfig,
  BoxConfig,
  PolygonConfig,
  LampshadeConfig,
  GeodesicConfig,
} from "./types";
export type { StlSurfaceConfig } from "./stl-surface";

export { createPlaneSurface } from "./plane";
export { createCylinderSurface } from "./cylinder";
export { createBoxSurface } from "./box";
export { createPolygonSurface } from "./polygon";
export { createLampshadeSurface } from "./lampshade";
export { createGeodesicSurface } from "./geodesic";
export { createStlSurface, extractDepthField } from "./stl-surface";
