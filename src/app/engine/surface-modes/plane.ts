/**
 * Plane Surface Strategy — Flat rectangular plate with heightmap relief.
 * Extracted from the original monolithic heightmap-generator.ts.
 *
 * Vorea Studio — voreastudio.com
 */

import type {
  SurfaceStrategy,
  PlaneConfig,
  Vec3Tuple,
  TriEmitter,
} from "./types";

export function createPlaneSurface(config: PlaneConfig): SurfaceStrategy {
  const { gridW, gridH, width, depth, baseThickness } = config;
  const offX = -width / 2;
  const offZ = -depth / 2;
  const baseY = -baseThickness;

  const getX = (ix: number) => offX + (ix / gridW) * width;
  const getZ = (iz: number) => offZ + (iz / gridH) * depth;

  return {
    mode: "plane",

    outerPoint(ix, iy, height) {
      return [getX(ix), height, getZ(iy)];
    },

    innerPoint(ix, iy) {
      return [getX(ix), baseY, getZ(iy)];
    },

    preferredNormal(_ix, _iy) {
      return [0, 1, 0];
    },

    estimateTriCount(gW, gH, solid) {
      const topTris = gW * gH * 2;
      return topTris + (solid ? topTris + (gW + gH) * 4 : 0);
    },

    generateOuterSurface(gW, gH, getHeight, getColor, emitTri) {
      for (let iz = 0; iz < gH; iz++) {
        for (let ix = 0; ix < gW; ix++) {
          const x0 = getX(ix), x1 = getX(ix + 1);
          const z0 = getZ(iz), z1 = getZ(iz + 1);
          const y00 = getHeight(ix, iz),   y10 = getHeight(ix + 1, iz);
          const y01 = getHeight(ix, iz + 1), y11 = getHeight(ix + 1, iz + 1);
          const [fr, fg, fb] = getColor(ix, iz);

          // Tri 1: CCW from +Y
          {
            const e1x = x1 - x0, e1y = y11 - y00, e1z = z1 - z0;
            const e2x = x1 - x0, e2y = y10 - y00, e2z = 0;
            let nx = e1y * e2z - e1z * e2y;
            let ny = e1z * e2x - e1x * e2z;
            let nz = e1x * e2y - e1y * e2x;
            const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (l > 1e-10) { nx /= l; ny /= l; nz /= l; } else { nx = 0; ny = 1; nz = 0; }
            emitTri(
              [x0, y00, z0], [x1, y11, z1], [x1, y10, z0],
              fr, fg, fb, [nx, ny, nz]
            );
          }
          // Tri 2: CCW from +Y
          {
            const e1x = 0, e1y = y01 - y00, e1z = z1 - z0;
            const e2x = x1 - x0, e2y = y11 - y00, e2z = z1 - z0;
            let nx = e1y * e2z - e1z * e2y;
            let ny = e1z * e2x - e1x * e2z;
            let nz = e1x * e2y - e1y * e2x;
            const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (l > 1e-10) { nx /= l; ny /= l; nz /= l; } else { nx = 0; ny = 1; nz = 0; }
            emitTri(
              [x0, y00, z0], [x0, y01, z1], [x1, y11, z1],
              fr, fg, fb, [nx, ny, nz]
            );
          }
        }
      }
    },

    generateSolidGeometry(gW, gH, getHeight, emitTri, baseColor) {
      const [br, bg, bb] = baseColor;

      // Bottom face (normal -Y)
      for (let iz = 0; iz < gH; iz++) {
        for (let ix = 0; ix < gW; ix++) {
          const x0 = getX(ix), x1 = getX(ix + 1);
          const z0 = getZ(iz), z1 = getZ(iz + 1);
          emitTri([x0, baseY, z0], [x1, baseY, z1], [x0, baseY, z1], br, bg, bb, [0, -1, 0]);
          emitTri([x0, baseY, z0], [x1, baseY, z0], [x1, baseY, z1], br, bg, bb, [0, -1, 0]);
        }
      }

      // Front wall (z_min, normal -Z)
      for (let ix = 0; ix < gW; ix++) {
        const x0 = getX(ix), x1 = getX(ix + 1);
        {
          const z = getZ(0), y0 = getHeight(ix, 0), y1 = getHeight(ix + 1, 0);
          emitTri([x0, baseY, z], [x1, y1, z], [x1, baseY, z], br, bg, bb, [0, 0, -1]);
          emitTri([x0, baseY, z], [x0, y0, z], [x1, y1, z], br, bg, bb, [0, 0, -1]);
        }
        // Back wall (z_max, normal +Z)
        {
          const z = getZ(gH), y0 = getHeight(ix, gH), y1 = getHeight(ix + 1, gH);
          emitTri([x0, baseY, z], [x1, baseY, z], [x1, y1, z], br, bg, bb, [0, 0, 1]);
          emitTri([x0, baseY, z], [x1, y1, z], [x0, y0, z], br, bg, bb, [0, 0, 1]);
        }
      }

      // Left wall (x_min, normal -X)
      for (let iz = 0; iz < gH; iz++) {
        const z0 = getZ(iz), z1 = getZ(iz + 1);
        {
          const x = getX(0), y0 = getHeight(0, iz), y1 = getHeight(0, iz + 1);
          emitTri([x, baseY, z0], [x, baseY, z1], [x, y1, z1], br, bg, bb, [-1, 0, 0]);
          emitTri([x, baseY, z0], [x, y1, z1], [x, y0, z0], br, bg, bb, [-1, 0, 0]);
        }
        // Right wall (x_max, normal +X)
        {
          const x = getX(gW), y0 = getHeight(gW, iz), y1 = getHeight(gW, iz + 1);
          emitTri([x, baseY, z0], [x, y0, z0], [x, y1, z1], br, bg, bb, [1, 0, 0]);
          emitTri([x, baseY, z0], [x, y1, z1], [x, baseY, z1], br, bg, bb, [1, 0, 0]);
        }
      }
    },
  };
}
