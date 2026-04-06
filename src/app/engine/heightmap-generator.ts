/**
 * Heightmap Generator — Standalone 3D relief mesh from image data.
 * Colors derived from image pixels via k-means quantization (1–8 zones).
 *
 * Vorea Studio — voreastudio.com
 */

import * as THREE from "three";
import { type DecodedImage, sampleBrightness, sampleColor } from "./image-registry";
import type { SurfaceStrategy, Vec3Tuple, ReliefSurfaceMode, TriEmitter } from "./surface-modes/types";
import { createPlaneSurface } from "./surface-modes/plane";
import { createCylinderSurface } from "./surface-modes/cylinder";
import { createBoxSurface } from "./surface-modes/box";
import { createPolygonSurface } from "./surface-modes/polygon";
import { createLampshadeSurface } from "./surface-modes/lampshade";
import { createGeodesicSurface } from "./surface-modes/geodesic";
import { createStlSurface } from "./surface-modes/stl-surface";

// ─── K-Means color quantization ──────────────────────────────────────────────

export type RGB = [number, number, number];
export type GapFillMode =
  | "edge"
  | "color-hard"
  | "color-soft"
  // Backward-compatible values kept for old saved configs:
  | "color"
  | "white-hard"
  | "white-soft";

/** Squared RGB distance */
function colorDist2(a: RGB, b: RGB): number {
  const dr = a[0]-b[0], dg = a[1]-b[1], db = a[2]-b[2];
  return dr*dr + dg*dg + db*db;
}

/** Convert an sRGB channel (0..1) to linear space for physically-based shading. */
function srgbToLinear(v: number): number {
  const c = Math.min(1, Math.max(0, v));
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Quantize image to N colors using k-means++ initialization.
 * Returns the N centroids as RGB tuples (0–1 each), sorted by brightness.
 */
function quantizeColors(image: DecodedImage, numColors: number): RGB[] {
  if (numColors <= 1) return [[0.78, 0.89, 0.42]]; // Vorea lime default

  // Sample a dense set of pixels (max 10000) for better coverage of small regions
  const maxSamples = 10000;
  const totalPixels = image.width * image.height;
  const step = Math.max(1, Math.floor(Math.sqrt(totalPixels / maxSamples)));
  const samples: RGB[] = [];
  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) {
      const idx = (y * image.width + x) * 4;
      const a = image.data[idx + 3];
      if (a === 0) continue;
      samples.push([
        image.data[idx]     / 255,
        image.data[idx + 1] / 255,
        image.data[idx + 2] / 255,
      ]);
    }
  }
  if (samples.length === 0) return [[0.78, 0.89, 0.42]];

  // ─── k-means++ initialization ──────────────────────────────────────
  // Pick first centroid randomly (middle of samples)
  const centroids: RGB[] = [[...samples[Math.floor(samples.length / 2)]]];

  for (let c = 1; c < numColors; c++) {
    // For each sample, compute distance to nearest existing centroid
    const distances = new Float32Array(samples.length);
    let totalDist = 0;
    for (let i = 0; i < samples.length; i++) {
      let minD = Infinity;
      for (let j = 0; j < centroids.length; j++) {
        const d = colorDist2(samples[i], centroids[j]);
        if (d < minD) minD = d;
      }
      distances[i] = minD;
      totalDist += minD;
    }
    // Pick next centroid weighted by distance² (deterministic: pick the farthest)
    let bestIdx = 0, bestDist = 0;
    for (let i = 0; i < samples.length; i++) {
      if (distances[i] > bestDist) { bestDist = distances[i]; bestIdx = i; }
    }
    centroids.push([...samples[bestIdx]]);
  }

  // ─── K-means iterations (20 for good convergence) ──────────────────
  for (let iter = 0; iter < 20; iter++) {
    const sums: [number, number, number, number][] = centroids.map(() => [0, 0, 0, 0]);
    for (const [r, g, b] of samples) {
      let bestD = Infinity, bestC = 0;
      for (let c = 0; c < centroids.length; c++) {
        const dr = r - centroids[c][0], dg = g - centroids[c][1], db = b - centroids[c][2];
        const d = dr*dr + dg*dg + db*db;
        if (d < bestD) { bestD = d; bestC = c; }
      }
      sums[bestC][0] += r; sums[bestC][1] += g; sums[bestC][2] += b; sums[bestC][3]++;
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sums[c][3] > 0) {
        centroids[c] = [sums[c][0]/sums[c][3], sums[c][1]/sums[c][3], sums[c][2]/sums[c][3]];
      }
    }
  }

  // Sort by brightness for consistent palette display
  centroids.sort((a, b) => (a[0]+a[1]+a[2]) - (b[0]+b[1]+b[2]));
  return centroids;
}

/** Lightweight palette preview to show colors before full mesh generation. */
export function estimatePaletteFromImage(image: DecodedImage, colorZones: number): RGB[] {
  return quantizeColors(image, colorZones);
}

/** Find nearest centroid index for a given RGB */
function nearestCentroid(r: number, g: number, b: number, centroids: RGB[]): number {
  let bestD = Infinity, bestC = 0;
  for (let c = 0; c < centroids.length; c++) {
    const dr = r - centroids[c][0], dg = g - centroids[c][1], db = b - centroids[c][2];
    const d = dr*dr + dg*dg + db*db;
    if (d < bestD) { bestD = d; bestC = c; }
  }
  return bestC;
}

// ─── Gaussian Smoothing ───────────────────────────────────────────────────────

function smoothHeights(heights: Float32Array, cols: number, rows: number, iterations: number, wrapX: boolean = false): void {
  if (iterations <= 0) return;
  const temp = new Float32Array(heights.length);
  for (let iter = 0; iter < iterations; iter++) {
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        let sum = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            let nx = ix + dx;
            const ny = iy + dy;
            if (wrapX) {
              if (nx < 0) {
                nx = (cols - 1) + nx;
              } else if (nx >= cols) {
                nx = nx - (cols - 1);
              }
            }
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
              const w = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
              sum += heights[ny * cols + nx] * w;
              count += w;
            }
          }
        }
        temp[iy * cols + ix] = sum / count;
      }
    }
    if (wrapX) {
      for (let iy = 0; iy < rows; iy++) {
        temp[iy * cols + (cols - 1)] = temp[iy * cols + 0];
      }
    }
    heights.set(temp);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type { ReliefSurfaceMode } from "./surface-modes/types";

export interface HeightmapOptions {
  image: DecodedImage;
  subdivisions: number;
  maxHeight: number;
  smoothing: number;
  /** Image UV scaling: 1 = original fit, >1 zoom in, <1 zoom out */
  imageScale?: number;
  /** UV behavior when scaling pushes coordinates outside 0..1 */
  imageScaleMode?: "clamp" | "wrap";
  /** Allow UV tiling on each axis when imageScaleMode="wrap" */
  imageRepeatX?: boolean;
  imageRepeatY?: boolean;
  /** Fill strategy when scaled UV falls outside image bounds on non-repeated axes. */
  gapFillMode?: GapFillMode;
  /** Fill color used when gapFillMode = "color". */
  gapFillColor?: RGB;
  width: number;
  depth: number;
  /** Surface mode */
  surfaceMode?: ReliefSurfaceMode;
  /** Cylinder base radius in mm */
  cylinderRadius?: number;
  /** Number of image repeats around circumference (integer >= 1) */
  cylinderRepeats?: number;
  /** Cylinder height in mm */
  cylinderHeight?: number;
  /** Flip image horizontally in cylindrical wrapping */
  cylinderFlipH?: boolean;
  /** Flip image vertically in cylindrical wrapping */
  cylinderFlipV?: boolean;
  invert: boolean;
  solid: boolean;
  baseThickness: number;
  /** Number of color zones 1–8. 1 = monochrome Vorea lime. */
  colorZones: number;
  // ─── Box mode params ───
  boxHeight?: number;
  boxCapTop?: boolean;
  boxCapBottom?: boolean;
  // ─── Polygon mode params ───
  polygonSides?: number;
  polygonRadius?: number;
  polygonHeight?: number;
  polygonCapTop?: boolean;
  polygonCapBottom?: boolean;
  // ─── Lampshade mode params ───
  lampshadeOuterRadiusBottom?: number;
  lampshadeOuterRadiusTop?: number;
  lampshadeHoleRadius?: number;
  lampshadeHeight?: number;
  lampshadeCap?: "top" | "bottom" | "both" | "none";
  lampshadeSides?: number;
  // ─── Geodesic mode params ───
  geodesicRadius?: number;
  // ─── STL surface params ───
  stlDepthField?: Float32Array;
  stlNormalField?: Float32Array;
  stlWidth?: number;
  stlDepth?: number;
  stlBaseOffset?: number;
  stlValidMask?: Uint8Array;
}

export interface HeightmapResult {
  geometry: THREE.BufferGeometry;
  heightsRef: Float32Array;
  cols: number;
  gridW: number;
  gridH: number;
  faceCount: number;
  generationTimeMs: number;
  colorZones: number;
  hasVertexColors: boolean;
  /** Quantized palette derived from the image, as [[r,g,b], ...] 0–1 */
  palette: RGB[];
  surfaceMode: ReliefSurfaceMode;
}

// ─── Main Generator ───────────────────────────────────────────────────────────

export function generateHeightmapMesh(options: HeightmapOptions): HeightmapResult {
  const startTime = performance.now();
  const {
    image,
    subdivisions = 500,
    maxHeight = 10,
    smoothing = 2,
    imageScale = 1,
    imageScaleMode = "clamp",
    imageRepeatX = true,
    imageRepeatY = true,
    gapFillMode = "edge",
    gapFillColor = [1, 1, 1],
    width = 100,
    depth = 100,
    surfaceMode = "plane",
    cylinderRadius = 30,
    cylinderRepeats = 1,
    cylinderHeight = 100,
    cylinderFlipH = true,
    cylinderFlipV = true,
    invert = false,
    solid = true,
    baseThickness = 2,
    colorZones = 1,
  } = options;
  const resolvedSurfaceMode: ReliefSurfaceMode =
    (["plane", "cylinder", "box", "polygon", "lampshade", "geodesic", "stl"] as const).includes(
      surfaceMode as ReliefSurfaceMode
    )
      ? (surfaceMode as ReliefSurfaceMode)
      : "plane";
  const isWrappingMode = resolvedSurfaceMode !== "plane" && resolvedSurfaceMode !== "stl";
  const resolvedRepeats = Math.max(1, Math.round(cylinderRepeats));
  const resolvedCylinderRadius = Math.max(1, cylinderRadius);
  const resolvedCylinderHeight = Math.max(5, cylinderHeight);
  const resolvedImageScale = Math.max(0.2, imageScale);
  const resolvedImageScaleMode: "clamp" | "wrap" =
    imageScaleMode === "wrap" ? "wrap" : "clamp";
  const resolvedGapFillMode: "edge" | "color-hard" | "color-soft" =
    gapFillMode === "color-soft" || gapFillMode === "white-soft"
      ? "color-soft"
      : gapFillMode === "color-hard" || gapFillMode === "color" || gapFillMode === "white-hard"
        ? "color-hard"
        : "edge";
  const fillColorRaw: RGB =
    gapFillMode === "white-hard" || gapFillMode === "white-soft"
      ? [1, 1, 1]
      : gapFillColor;
  const resolvedGapFillColor: RGB = [
    Math.max(0, Math.min(1, fillColorRaw[0] ?? 1)),
    Math.max(0, Math.min(1, fillColorRaw[1] ?? 1)),
    Math.max(0, Math.min(1, fillColorRaw[2] ?? 1)),
  ];
  const resolvedFlipH = isWrappingMode ? cylinderFlipH : false;
  const resolvedFlipV = isWrappingMode ? cylinderFlipV : false;
  const scaleCoord = (coord: number) => (coord - 0.5) / resolvedImageScale + 0.5;
  const clamp01 = (coord: number) => Math.max(0, Math.min(1, coord));
  const wrap01 = (coord: number) => ((coord % 1) + 1) % 1;
  const applyScaleMode = (coord: number, repeatAxis: boolean) => {
    const scaled = scaleCoord(coord);
    if (resolvedImageScaleMode === "wrap" && repeatAxis) {
      return { coord: wrap01(scaled), overflow: 0 };
    }
    const overflow = scaled < 0 ? -scaled : scaled > 1 ? scaled - 1 : 0;
    return { coord: clamp01(scaled), overflow };
  };
  const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  // Grid resolution (respect image aspect)
  const aspect = image.width / image.height;
  let gridW: number, gridH: number;

  // For STL surface: match the depth field grid resolution
  if (resolvedSurfaceMode === "stl" && options.stlDepthField) {
    const dfLen = options.stlDepthField.length;
    const side = Math.round(Math.sqrt(dfLen)) - 1;
    gridW = Math.max(2, side);
    gridH = Math.max(2, side);
  } else if (aspect >= 1) {
    gridW = Math.min(subdivisions, image.width);
    gridH = Math.max(2, Math.round(gridW / aspect));
  } else {
    gridH = Math.min(subdivisions, image.height);
    gridW = Math.max(2, Math.round(gridH * aspect));
  }
  gridW = Math.max(2, gridW); gridH = Math.max(2, gridH);
  const cols = gridW + 1, rows = gridH + 1;

  // ─── Quantize image colors (k-means, max 8) ────────────────────────
  const palette = quantizeColors(image, colorZones);
  const paletteLinear: RGB[] = palette.map(([r, g, b]) => [
    srgbToLinear(r),
    srgbToLinear(g),
    srgbToLinear(b),
  ]);

  // ─── Sample heights and per-vertex colors ─────────────────────────
  const heights      = new Float32Array(cols * rows);
  const vertexColors = new Float32Array(cols * rows * 3); // RGB per grid point

  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const u = ix / gridW, v = iy / gridH;
      let sampledU: number;
      let sampledV: number;
      let overflowU = 0;
      let overflowV = 0;
      if (isWrappingMode) {
        const baseU = resolvedFlipH ? 1 - u : u;
        const repeatedU = wrap01(baseU * resolvedRepeats);
        const uResult = applyScaleMode(repeatedU, imageRepeatX);
        sampledU = uResult.coord;
        overflowU = uResult.overflow;
        const baseV = resolvedFlipV ? 1 - v : v;
        const vResult = applyScaleMode(baseV, imageRepeatY);
        sampledV = vResult.coord;
        overflowV = vResult.overflow;
      } else {
        const uResult = applyScaleMode(u, imageRepeatX);
        sampledU = uResult.coord;
        overflowU = uResult.overflow;
        const vResult = applyScaleMode(v, imageRepeatY);
        sampledV = vResult.coord;
        overflowV = vResult.overflow;
      }
      let b = sampleBrightness(image, sampledU, sampledV);
      let sampledColor = sampleColor(image, sampledU, sampledV);
      const outOfBounds = overflowU > 0 || overflowV > 0;
      if (outOfBounds && resolvedGapFillMode !== "edge") {
        if (resolvedGapFillMode === "color-hard") {
          sampledColor = resolvedGapFillColor;
          b = (sampledColor[0] + sampledColor[1] + sampledColor[2]) / 3;
        } else {
          const softWidth = 0.24;
          const d = Math.max(overflowU, overflowV);
          const t = smoothstep(0, softWidth, d);
          sampledColor = [
            sampledColor[0] * (1 - t) + resolvedGapFillColor[0] * t,
            sampledColor[1] * (1 - t) + resolvedGapFillColor[1] * t,
            sampledColor[2] * (1 - t) + resolvedGapFillColor[2] * t,
          ];
          const fillBrightness =
            (resolvedGapFillColor[0] + resolvedGapFillColor[1] + resolvedGapFillColor[2]) / 3;
          b = b * (1 - t) + fillBrightness * t;
        }
      }
      if (invert) b = 1 - b;
      
      if (invert && resolvedSurfaceMode === "stl") {
        sampledColor = [1 - sampledColor[0], 1 - sampledColor[1], 1 - sampledColor[2]];
      }

      heights[iy * cols + ix] = b * maxHeight;

      // Map image color → nearest quantized palette color (by position)
      const [sr, sg, sb] = sampledColor;
      const cIdx = colorZones > 1 ? nearestCentroid(sr, sg, sb, palette) : 0;
      const [pr, pg, pb] = paletteLinear[cIdx];
      const base = (iy * cols + ix) * 3;
      vertexColors[base]   = pr;
      vertexColors[base+1] = pg;
      vertexColors[base+2] = pb;
    }
  }
  smoothHeights(heights, cols, rows, smoothing, isWrappingMode);

  // ─── Create surface strategy ──────────────────────────────────────
  const commonConfig = { gridW, gridH, baseThickness };

  let strategy: SurfaceStrategy;
  switch (resolvedSurfaceMode) {
    case "cylinder":
      strategy = createCylinderSurface({
        ...commonConfig,
        radius: resolvedCylinderRadius,
        height: resolvedCylinderHeight,
      });
      break;
    case "box":
      strategy = createBoxSurface({
        ...commonConfig,
        width,
        depth,
        height: options.boxHeight ?? resolvedCylinderHeight,
        capTop: options.boxCapTop ?? true,
        capBottom: options.boxCapBottom ?? true,
      });
      break;
    case "polygon":
      strategy = createPolygonSurface({
        ...commonConfig,
        sides: options.polygonSides ?? 6,
        radius: options.polygonRadius ?? resolvedCylinderRadius,
        height: options.polygonHeight ?? resolvedCylinderHeight,
        capTop: options.polygonCapTop ?? true,
        capBottom: options.polygonCapBottom ?? true,
      });
      break;
    case "lampshade":
      strategy = createLampshadeSurface({
        ...commonConfig,
        outerRadiusBottom: options.lampshadeOuterRadiusBottom ?? resolvedCylinderRadius,
        outerRadiusTop: options.lampshadeOuterRadiusTop ?? (options.lampshadeOuterRadiusBottom ?? resolvedCylinderRadius),
        holeRadius: options.lampshadeHoleRadius ?? 25,
        height: options.lampshadeHeight ?? resolvedCylinderHeight,
        capPosition: options.lampshadeCap ?? "bottom",
        sides: options.lampshadeSides ?? 0,
      });
      break;
    case "geodesic":
      strategy = createGeodesicSurface({
        ...commonConfig,
        radius: options.geodesicRadius ?? resolvedCylinderRadius,
      });
      break;
    case "stl":
      if (options.stlDepthField && options.stlNormalField) {
        strategy = createStlSurface({
          ...commonConfig,
          depthField: options.stlDepthField,
          normalField: options.stlNormalField,
          width: options.stlWidth ?? width,
          depth: options.stlDepth ?? depth,
          baseOffset: options.stlBaseOffset ?? 0,
          validMask: options.stlValidMask ?? new Uint8Array((gridW + 1) * (gridH + 1)).fill(1),
        });
      } else {
        strategy = createPlaneSurface({ ...commonConfig, width, depth });
      }
      break;
    default: // "plane"
      strategy = createPlaneSurface({ ...commonConfig, width, depth });
      break;
  }

  // ─── Buffer sizes ─────────────────────────────────────────────────
  const totalTris = strategy.estimateTriCount(gridW, gridH, solid);
  const totalVerts = totalTris * 3;

  const positions = new Float32Array(totalVerts * 3);
  const normals   = new Float32Array(totalVerts * 3);
  const colors    = new Float32Array(totalVerts * 3);
  let vi = 0;

  const getY = (ix: number, iz: number) => heights[iz * cols + ix];
  const getC = (ix: number, iz: number): RGB => {
    const b = (iz * cols + ix) * 3;
    return [vertexColors[b], vertexColors[b+1], vertexColors[b+2]];
  };

  // Color helper: average 4 corners and snap to nearest palette color
  const getCellColor = (ix: number, iz: number): Vec3Tuple => {
    const [c00, c01v, c02] = getC(ix, iz);
    const [c10, c11v, c12] = getC(ix + 1, iz);
    const [c20, c21v, c22] = getC(ix, iz + 1);
    const [c30, c31v, c32] = getC(ix + 1, iz + 1);
    const r = (c00 + c10 + c20 + c30) / 4;
    const g = (c01v + c11v + c21v + c31v) / 4;
    const b = (c02 + c12 + c22 + c32) / 4;
    const ci = colorZones > 1 ? nearestCentroid(r, g, b, paletteLinear) : 0;
    return paletteLinear[ci] as Vec3Tuple;
  };

  const addTri = (
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number,
    nx: number, ny: number, nz: number,
    r: number, g: number, b: number
  ) => {
    for (const [px, py, pz] of [[x0,y0,z0],[x1,y1,z1],[x2,y2,z2]]) {
      positions[vi]=px; positions[vi+1]=py; positions[vi+2]=pz;
      normals[vi]=nx; normals[vi+1]=ny; normals[vi+2]=nz;
      colors[vi]=r; colors[vi+1]=g; colors[vi+2]=b;
      vi += 3;
    }
  };

  // TriEmitter adapter for strategy callbacks
  const emitTri: TriEmitter = (
    p0, p1, p2, cr, cg, cb, preferredNormal
  ) => {
    let [a0, a1, a2] = p0;
    let [b0, b1, b2] = p1;
    let [c0, c1, c2] = p2;
    const computeNormal = () => {
      const e1x = b0 - a0, e1y = b1 - a1, e1z = b2 - a2;
      const e2x = c0 - a0, e2y = c1 - a1, e2z = c2 - a2;
      let nx = e1y * e2z - e1z * e2y;
      let ny = e1z * e2x - e1x * e2z;
      let nz = e1x * e2y - e1y * e2x;
      return [nx, ny, nz] as [number, number, number];
    };

    let [nx, ny, nz] = computeNormal();
    if (preferredNormal) {
      const dot = nx * preferredNormal[0] + ny * preferredNormal[1] + nz * preferredNormal[2];
      if (dot < 0) {
        [b0, b1, b2, c0, c1, c2] = [c0, c1, c2, b0, b1, b2];
        [nx, ny, nz] = computeNormal();
      }
    }
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 1e-10) {
      nx /= len; ny /= len; nz /= len;
    } else if (preferredNormal) {
      const plen = Math.sqrt(
        preferredNormal[0] * preferredNormal[0] +
        preferredNormal[1] * preferredNormal[1] +
        preferredNormal[2] * preferredNormal[2]
      );
      if (plen > 1e-10) {
        nx = preferredNormal[0] / plen;
        ny = preferredNormal[1] / plen;
        nz = preferredNormal[2] / plen;
      } else {
        nx = 0; ny = 1; nz = 0;
      }
    } else {
      nx = 0; ny = 1; nz = 0;
    }

    addTri(a0, a1, a2, b0, b1, b2, c0, c1, c2, nx, ny, nz, cr, cg, cb);
  };

  // ─── Generate geometry via strategy ───────────────────────────────
  strategy.generateOuterSurface(gridW, gridH, getY, getCellColor, emitTri);
  if (solid) {
    const baseColor: Vec3Tuple = [0.08, 0.08, 0.12];
    strategy.generateSolidGeometry(gridW, gridH, getY, emitTri, baseColor, getCellColor);
  }

  // ─── Build geometry ───────────────────────────────────────────────
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal",   new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("color",    new THREE.BufferAttribute(colors, 3));
  // NOTE: Do NOT call computeVertexNormals() — manual normals from addTri are correct
  //       and consistent with the CCW winding order for manifold export.

  return {
    geometry,
    heightsRef: heights,
    cols,
    gridW, gridH,
    faceCount: vi / 9,
    generationTimeMs: performance.now() - startTime,
    colorZones,
    hasVertexColors: colorZones > 1,
    palette,
    surfaceMode: resolvedSurfaceMode,
  };
}

/** Export ZONE_PALETTE stub for backward compat (unused now) */
export const ZONE_PALETTE = [] as const;

