/**
 * Mesh Slicer – Converts CSG geometry into printable toolpaths.
 *
 * Pipeline: SerializedMesh → planar slicing → contour extraction →
 *           toolpath ordering → FullControl steps → GCode
 *
 * Uses horizontal plane intersection with triangle meshes.
 */

import type { SerializedMesh } from "./mesh-data";
import type { FCStep, GCodeControls, GCodeResult } from "./fullcontrol";
import {
  point, travelTo, comment,
  stepsToGCode,
} from "./fullcontrol";

// ═══════════════════════════════════════════════════════════════════════════════
// SLICING CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface SliceConfig {
  layerHeight: number;       // mm, default 0.2
  extrusionWidth: number;    // mm, default 0.4
  infillDensity: number;     // 0-1, default 0.2
  infillPattern: "lines" | "grid" | "none";
  wallCount: number;         // number of perimeter walls, default 2
  topLayers: number;         // solid top layers, default 3
  bottomLayers: number;      // solid bottom layers, default 3
  printSpeed: number;        // mm/min
  travelSpeed: number;       // mm/min
}

export const DEFAULT_SLICE_CONFIG: SliceConfig = {
  layerHeight: 0.2,
  extrusionWidth: 0.4,
  infillDensity: 0.2,
  infillPattern: "lines",
  wallCount: 2,
  topLayers: 3,
  bottomLayers: 3,
  printSpeed: 1200,
  travelSpeed: 3000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Point2D { x: number; y: number; }
interface Segment { a: Point2D; b: Point2D; }

/** A closed contour (list of 2D points) */
type Contour = Point2D[];

/** Slice = all contours at a given Z height */
interface Slice {
  z: number;
  contours: Contour[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESH BOUNDING BOX
// ═══════════════════════════════════════════════════════════════════════════════

interface BBox {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

function meshBBox(mesh: SerializedMesh): BBox {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const poly of mesh.polygons) {
    for (const v of poly.vertices) {
      if (v.px < minX) minX = v.px;
      if (v.px > maxX) maxX = v.px;
      if (v.py < minY) minY = v.py;
      if (v.py > maxY) maxY = v.py;
      if (v.pz < minZ) minZ = v.pz;
      if (v.pz > maxZ) maxZ = v.pz;
    }
  }

  return { minX, maxX, minY, maxY, minZ, maxZ };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIANGULATE POLYGONS
// ═══════════════════════════════════════════════════════════════════════════════

interface Triangle {
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
}

function triangulateMesh(mesh: SerializedMesh): Triangle[] {
  const tris: Triangle[] = [];
  for (const poly of mesh.polygons) {
    const verts = poly.vertices;
    // Fan triangulation
    for (let i = 1; i < verts.length - 1; i++) {
      tris.push({
        a: [verts[0].px, verts[0].py, verts[0].pz],
        b: [verts[i].px, verts[i].py, verts[i].pz],
        c: [verts[i + 1].px, verts[i + 1].py, verts[i + 1].pz],
      });
    }
  }
  return tris;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLANE INTERSECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Intersect a triangle with a horizontal plane at z.
 * Returns 0 or 1 segments.
 */
function intersectTriangleZ(tri: Triangle, z: number): Segment | null {
  const pts = [tri.a, tri.b, tri.c];
  const above: number[] = [];
  const below: number[] = [];
  const on: number[] = [];

  for (let i = 0; i < 3; i++) {
    const dz = pts[i][2] - z;
    if (Math.abs(dz) < 1e-6) on.push(i);
    else if (dz > 0) above.push(i);
    else below.push(i);
  }

  // If all on same side, no intersection
  if (above.length === 3 || below.length === 3) return null;
  if (above.length === 0 && below.length === 0) return null; // all on plane

  // If 2 vertices on the plane, return that edge
  if (on.length === 2) {
    return {
      a: { x: pts[on[0]][0], y: pts[on[0]][1] },
      b: { x: pts[on[1]][0], y: pts[on[1]][1] },
    };
  }

  // Find the two intersection points
  const intersections: Point2D[] = [];

  // For each on-vertex, add it
  for (const i of on) {
    intersections.push({ x: pts[i][0], y: pts[i][1] });
  }

  // For edges that cross the plane
  for (const ai of above) {
    for (const bi of below) {
      const pa = pts[ai];
      const pb = pts[bi];
      const t = (z - pa[2]) / (pb[2] - pa[2]);
      intersections.push({
        x: pa[0] + t * (pb[0] - pa[0]),
        y: pa[1] + t * (pb[1] - pa[1]),
      });
    }
  }

  if (intersections.length >= 2) {
    return { a: intersections[0], b: intersections[1] };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTOUR ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════════════

const EPS = 1e-4;

function ptKey(p: Point2D): string {
  return `${Math.round(p.x / EPS) * EPS},${Math.round(p.y / EPS) * EPS}`;
}

function ptDist(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Assemble segments into closed contours by chaining endpoints.
 */
function assembleContours(segments: Segment[]): Contour[] {
  if (segments.length === 0) return [];

  // Build adjacency map
  const adj = new Map<string, { pt: Point2D; other: Point2D; used: boolean }[]>();

  for (const seg of segments) {
    const ka = ptKey(seg.a);
    const kb = ptKey(seg.b);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    const entryA = { pt: seg.a, other: seg.b, used: false };
    const entryB = { pt: seg.b, other: seg.a, used: false };
    adj.get(ka)!.push(entryA);
    adj.get(kb)!.push(entryB);
  }

  const contours: Contour[] = [];

  // Greedily trace contours
  for (const [startKey, entries] of adj) {
    for (const entry of entries) {
      if (entry.used) continue;
      entry.used = true;

      const contour: Point2D[] = [entry.pt];
      let current = entry.other;
      contour.push(current);

      let safety = segments.length * 2;
      while (safety-- > 0) {
        const key = ptKey(current);
        const neighbors = adj.get(key);
        if (!neighbors) break;

        let found = false;
        for (const n of neighbors) {
          if (n.used) continue;
          n.used = true;
          // Also mark reverse
          const reverseKey = ptKey(n.other);
          const reverseEntries = adj.get(reverseKey);
          if (reverseEntries) {
            for (const re of reverseEntries) {
              if (!re.used && ptDist(re.other, current) < EPS * 2) {
                re.used = true;
                break;
              }
            }
          }

          current = n.other;
          contour.push(current);
          found = true;
          break;
        }

        if (!found) break;

        // Check if we've closed the loop
        if (ptDist(current, contour[0]) < EPS * 2) break;
      }

      if (contour.length >= 3) {
        contours.push(contour);
      }
    }
  }

  return contours;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INFILL GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

function generateLineInfill(
  contours: Contour[],
  bbox: BBox,
  density: number,
  layerIdx: number,
  extrusionWidth: number
): Point2D[][] {
  if (density <= 0 || contours.length === 0) return [];

  const spacing = extrusionWidth / density;
  const lines: Point2D[][] = [];

  // Alternate direction per layer
  const vertical = layerIdx % 2 === 0;

  // Simple line-fill: cast rays and clip to contour bounds
  // (Simplified: just fill bounding box, skip precise clipping for performance)
  const margin = extrusionWidth;

  if (vertical) {
    for (let x = bbox.minX + margin; x < bbox.maxX - margin; x += spacing) {
      const pts = raycastVertical(contours, x, bbox.minY, bbox.maxY);
      for (let i = 0; i < pts.length - 1; i += 2) {
        lines.push([
          { x, y: pts[i] + margin / 2 },
          { x, y: pts[i + 1] - margin / 2 },
        ]);
      }
    }
  } else {
    for (let y = bbox.minY + margin; y < bbox.maxY - margin; y += spacing) {
      const pts = raycastHorizontal(contours, y, bbox.minX, bbox.maxX);
      for (let i = 0; i < pts.length - 1; i += 2) {
        lines.push([
          { x: pts[i] + margin / 2, y },
          { x: pts[i + 1] - margin / 2, y },
        ]);
      }
    }
  }

  return lines;
}

function raycastVertical(contours: Contour[], x: number, minY: number, maxY: number): number[] {
  const intersections: number[] = [];

  for (const contour of contours) {
    for (let i = 0; i < contour.length - 1; i++) {
      const a = contour[i];
      const b = contour[i + 1];
      if ((a.x <= x && b.x >= x) || (b.x <= x && a.x >= x)) {
        if (Math.abs(b.x - a.x) < EPS) continue;
        const t = (x - a.x) / (b.x - a.x);
        const y = a.y + t * (b.y - a.y);
        if (y >= minY && y <= maxY) intersections.push(y);
      }
    }
  }

  return intersections.sort((a, b) => a - b);
}

function raycastHorizontal(contours: Contour[], y: number, minX: number, maxX: number): number[] {
  const intersections: number[] = [];

  for (const contour of contours) {
    for (let i = 0; i < contour.length - 1; i++) {
      const a = contour[i];
      const b = contour[i + 1];
      if ((a.y <= y && b.y >= y) || (b.y <= y && a.y >= y)) {
        if (Math.abs(b.y - a.y) < EPS) continue;
        const t = (y - a.y) / (b.y - a.y);
        const x = a.x + t * (b.x - a.x);
        if (x >= minX && x <= maxX) intersections.push(x);
      }
    }
  }

  return intersections.sort((a, b) => a - b);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SLICER
// ═══════════════════════════════════════════════════════════════════════════════

export interface SliceResult {
  slices: Slice[];
  bbox: BBox;
  totalLayers: number;
}

/**
 * Slice a serialized mesh into horizontal layers.
 */
export function sliceMesh(mesh: SerializedMesh, config: Partial<SliceConfig> = {}): SliceResult {
  const cfg = { ...DEFAULT_SLICE_CONFIG, ...config };
  const bbox = meshBBox(mesh);
  const tris = triangulateMesh(mesh);

  const slices: Slice[] = [];
  const startZ = bbox.minZ + cfg.layerHeight / 2;
  const endZ = bbox.maxZ;

  for (let z = startZ; z <= endZ; z += cfg.layerHeight) {
    const segments: Segment[] = [];

    for (const tri of tris) {
      const seg = intersectTriangleZ(tri, z);
      if (seg && ptDist(seg.a, seg.b) > EPS) {
        segments.push(seg);
      }
    }

    const contours = assembleContours(segments);
    if (contours.length > 0) {
      slices.push({ z, contours });
    }
  }

  return { slices, bbox, totalLayers: slices.length };
}

/**
 * Convert sliced mesh to FullControl steps and then to GCode.
 */
export function meshToGCode(
  mesh: SerializedMesh,
  sliceConfig?: Partial<SliceConfig>,
  gcodeControls?: GCodeControls
): GCodeResult {
  const cfg = { ...DEFAULT_SLICE_CONFIG, ...sliceConfig };
  const { slices, bbox } = sliceMesh(mesh, cfg);

  const steps: FCStep[] = [];
  steps.push(comment("Vorea Studio - FullControl Slicer"));
  steps.push(comment(`Model: ${bbox.maxX - bbox.minX}x${bbox.maxY - bbox.minY}x${bbox.maxZ - bbox.minZ}mm`));
  steps.push(comment(`Layers: ${slices.length}, Layer height: ${cfg.layerHeight}mm`));

  const totalLayers = slices.length;

  for (let li = 0; li < slices.length; li++) {
    const slice = slices[li];
    const isSolid = li < cfg.bottomLayers || li >= totalLayers - cfg.topLayers;

    steps.push(comment(`Layer ${li + 1} / ${totalLayers} at Z=${slice.z.toFixed(3)}`));

    // Perimeters
    for (const contour of slice.contours) {
      if (contour.length < 3) continue;

      // Travel to start of contour
      steps.push(...travelTo(contour[0].x, contour[0].y, slice.z));

      // Trace contour (outer wall)
      for (let i = 1; i < contour.length; i++) {
        steps.push(point(contour[i].x, contour[i].y, slice.z));
      }
      // Close
      steps.push(point(contour[0].x, contour[0].y, slice.z));
    }

    // Infill
    if (cfg.infillPattern !== "none") {
      const density = isSolid ? 1.0 : cfg.infillDensity;
      if (density > 0) {
        const infillLines = generateLineInfill(
          slice.contours, bbox, density, li, cfg.extrusionWidth
        );

        for (const line of infillLines) {
          if (line.length < 2) continue;
          steps.push(...travelTo(line[0].x, line[0].y, slice.z));
          for (let i = 1; i < line.length; i++) {
            steps.push(point(line[i].x, line[i].y, slice.z));
          }
        }
      }
    }
  }

  return stepsToGCode(steps, {
    ...gcodeControls,
    layerHeight: cfg.layerHeight,
    extrusionWidth: cfg.extrusionWidth,
    printSpeed: cfg.printSpeed,
    travelSpeed: cfg.travelSpeed,
  });
}