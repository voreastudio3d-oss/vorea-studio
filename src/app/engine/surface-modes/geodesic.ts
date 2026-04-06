/**
 * Geodesic (Icosphere) Surface Strategy — True geodesic sphere from
 * recursive icosahedron subdivision with heightmap relief.
 *
 * Unlike grid-based sphere mappings (equirectangular, cube sphere), an
 * icosphere has TRULY uniform triangle distribution with no pole artifacts,
 * no face seams, and no convergence issues.
 *
 * How it works:
 *   1. Build an icosahedron (12 vertices, 20 faces)
 *   2. Subdivide recursively (each level 4× the triangles)
 *   3. Normalize all vertices to the unit sphere
 *   4. For each vertex, compute equirectangular UV → sample heightmap
 *   5. Displace vertex radially by the sampled height
 *
 * Vorea Studio — voreastudio.com
 */

import type {
  SurfaceStrategy,
  Vec3Tuple,
  TriEmitter,
} from "./types";

export interface GeodesicConfig {
  gridW: number;
  gridH: number;
  /** Sphere base radius (mm) */
  radius: number;
  /** Base thickness for solid mode */
  baseThickness: number;
}

// ─── Icosphere Builder ───────────────────────────────────────────────

interface IcosphereData {
  vertices: Vec3Tuple[];
  faces: [number, number, number][];
}

function buildIcosphere(subdivisions: number): IcosphereData {
  const t = (1 + Math.sqrt(5)) / 2; // golden ratio

  const vertices: Vec3Tuple[] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];

  // Normalize initial vertices to unit sphere
  for (let i = 0; i < vertices.length; i++) {
    const [x, y, z] = vertices[i];
    const len = Math.sqrt(x * x + y * y + z * z);
    vertices[i] = [x / len, y / len, z / len];
  }

  let faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  // Recursive subdivision
  for (let level = 0; level < subdivisions; level++) {
    const midCache = new Map<string, number>();
    const newFaces: [number, number, number][] = [];

    function getMidpoint(a: number, b: number): number {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const cached = midCache.get(key);
      if (cached !== undefined) return cached;

      const [ax, ay, az] = vertices[a];
      const [bx, by, bz] = vertices[b];
      const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
      const len = Math.sqrt(mx * mx + my * my + mz * mz);
      const idx = vertices.length;
      vertices.push([mx / len, my / len, mz / len]);
      midCache.set(key, idx);
      return idx;
    }

    for (const [a, b, c] of faces) {
      const ab = getMidpoint(a, b);
      const bc = getMidpoint(b, c);
      const ca = getMidpoint(c, a);
      newFaces.push([a, ab, ca]);
      newFaces.push([b, bc, ab]);
      newFaces.push([c, ca, bc]);
      newFaces.push([ab, bc, ca]);
    }

    faces = newFaces;
  }

  return { vertices, faces };
}

// ─── Surface Strategy ────────────────────────────────────────────────

export function createGeodesicSurface(config: GeodesicConfig): SurfaceStrategy {
  const { gridW, gridH, radius, baseThickness } = config;
  const innerRadius = Math.max(0.2, radius - Math.max(0.2, baseThickness));

  // Determine subdivision level from grid resolution (approximate same face count)
  // Level 0=20, 1=80, 2=320, 3=1280, 4=5120, 5=20480, 6=81920, 7=327680
  const targetFaces = gridW * gridH * 2;
  let level = 0;
  while (20 * Math.pow(4, level + 1) < targetFaces && level < 7) level++;

  // Build the icosphere once
  const { vertices, faces } = buildIcosphere(level);
  const numVerts = vertices.length;
  const numFaces = faces.length;

  // Pre-compute equirectangular UV for each vertex
  const vertU = new Float32Array(numVerts);
  const vertV = new Float32Array(numVerts);
  for (let i = 0; i < numVerts; i++) {
    const [x, y, z] = vertices[i];
    vertU[i] = (Math.atan2(z, x) / (Math.PI * 2) + 0.5) % 1;
    const clampedY = Math.max(-1, Math.min(1, y));
    vertV[i] = 1 - (clampedY * 0.5 + 0.5); // Cylindrical Equal-Area Projection (Lambert)
  }

  /** Bilinear interpolation of height at arbitrary UV. */
  function sampleHeight(
    u: number, v: number,
    gW: number, gH: number,
    getH: (ix: number, iy: number) => number,
  ): number {
    const fx = Math.max(0, Math.min(gW, u * gW));
    const fy = Math.max(0, Math.min(gH, v * gH));
    const ix0 = Math.min(Math.floor(fx), gW - 1);
    const iy0 = Math.min(Math.floor(fy), gH - 1);
    const ix1 = Math.min(ix0 + 1, gW);
    const iy1 = Math.min(iy0 + 1, gH);
    const dx = fx - ix0, dy = fy - iy0;
    return getH(ix0, iy0) * (1 - dx) * (1 - dy)
         + getH(ix1, iy0) * dx * (1 - dy)
         + getH(ix0, iy1) * (1 - dx) * dy
         + getH(ix1, iy1) * dx * dy;
  }

  /**
   * Fix UV coordinates for faces that straddle the u=0/1 dateline seam.
   * Without this, color sampling at the seam picks the wrong grid cell.
   */
  function fixSeamU(ua: number, ub: number, uc: number): [number, number, number] {
    if (Math.abs(ua - ub) > 0.5 || Math.abs(ub - uc) > 0.5 || Math.abs(ua - uc) > 0.5) {
      if (ua < 0.25) ua += 1;
      if (ub < 0.25) ub += 1;
      if (uc < 0.25) uc += 1;
    }
    return [ua, ub, uc];
  }

  return {
    mode: "geodesic",

    // Grid-based methods — stubs (icosphere generates its own topology)
    outerPoint() { return [0, 0, 0]; },
    innerPoint() { return [0, 0, 0]; },
    preferredNormal() { return [0, 1, 0]; },

    estimateTriCount(_gW, _gH, solid) {
      return numFaces + (solid ? numFaces : 0);
    },

    generateOuterSurface(gW, gH, getHeight, getColor, emitTri) {
      // ── Displace each vertex radially by sampled height ─────
      const pos = new Float32Array(numVerts * 3);
      for (let i = 0; i < numVerts; i++) {
        const [nx, ny, nz] = vertices[i];
        const h = sampleHeight(vertU[i], vertV[i], gW, gH, getHeight);
        const r = radius + h;
        pos[i * 3] = nx * r;
        pos[i * 3 + 1] = ny * r;
        pos[i * 3 + 2] = nz * r;
      }

      // ── Emit triangles ─────────────────────────────────────
      for (let f = 0; f < numFaces; f++) {
        const [a, b, c] = faces[f];
        const pa: Vec3Tuple = [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]];
        const pb: Vec3Tuple = [pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]];
        const pc: Vec3Tuple = [pos[c * 3], pos[c * 3 + 1], pos[c * 3 + 2]];

        // Color: sample at the face centroid UV (seam-corrected)
        const [ua, ub, uc] = fixSeamU(vertU[a], vertU[b], vertU[c]);
        const cu = ((ua + ub + uc) / 3) % 1;
        const cv = (vertV[a] + vertV[b] + vertV[c]) / 3;
        const ix = Math.min(Math.floor(cu * gW), gW - 1);
        const iy = Math.min(Math.floor(cv * gH), gH - 1);
        const [cr, cg, cb] = getColor(ix, iy);

        // Preferred normal: radially outward from face centroid
        const pn: Vec3Tuple = [
          (vertices[a][0] + vertices[b][0] + vertices[c][0]) / 3,
          (vertices[a][1] + vertices[b][1] + vertices[c][1]) / 3,
          (vertices[a][2] + vertices[b][2] + vertices[c][2]) / 3,
        ];

        emitTri(pa, pb, pc, cr, cg, cb, pn);
      }
    },

    generateSolidGeometry(_gW, _gH, _getHeight, emitTri, baseColor) {
      const [br, bg, bb] = baseColor;

      // Inner shell at innerRadius — reversed winding for inward normals
      for (let f = 0; f < numFaces; f++) {
        const [a, b, c] = faces[f];
        const pa: Vec3Tuple = [
          vertices[a][0] * innerRadius,
          vertices[a][1] * innerRadius,
          vertices[a][2] * innerRadius,
        ];
        const pb: Vec3Tuple = [
          vertices[b][0] * innerRadius,
          vertices[b][1] * innerRadius,
          vertices[b][2] * innerRadius,
        ];
        const pc: Vec3Tuple = [
          vertices[c][0] * innerRadius,
          vertices[c][1] * innerRadius,
          vertices[c][2] * innerRadius,
        ];

        const pn: Vec3Tuple = [
          -(vertices[a][0] + vertices[b][0] + vertices[c][0]) / 3,
          -(vertices[a][1] + vertices[b][1] + vertices[c][1]) / 3,
          -(vertices[a][2] + vertices[b][2] + vertices[c][2]) / 3,
        ];
        emitTri(pa, pc, pb, br, bg, bb, pn);
      }
    },
  };
}
