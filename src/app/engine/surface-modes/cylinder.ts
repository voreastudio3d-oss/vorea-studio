/**
 * Cylinder Surface Strategy — Cylindrical shell with heightmap relief.
 * Extracted from the original monolithic heightmap-generator.ts.
 *
 * Vorea Studio — voreastudio.com
 */

import type {
  SurfaceStrategy,
  CylinderConfig,
  Vec3Tuple,
  TriEmitter,
} from "./types";

export function createCylinderSurface(config: CylinderConfig): SurfaceStrategy {
  const { gridW, gridH, radius, height, baseThickness } = config;
  const cols = gridW + 1;
  const yMin = -height / 2;
  const radiusInner = Math.max(0.2, radius - Math.max(0.2, baseThickness));

  // Pre-compute trig LUTs
  const cosLut = new Float32Array(cols);
  const sinLut = new Float32Array(cols);
  for (let ix = 0; ix < cols; ix++) {
    const theta = (ix / gridW) * Math.PI * 2;
    cosLut[ix] = Math.cos(theta);
    sinLut[ix] = Math.sin(theta);
  }
  // Enforce mathematically perfect cylinder seam
  cosLut[gridW] = cosLut[0];
  sinLut[gridW] = sinLut[0];

  const getCylY = (iz: number) => yMin + (iz / gridH) * height;

  return {
    mode: "cylinder",

    outerPoint(ix, iy, h) {
      const r = radius + h;
      return [cosLut[ix] * r, getCylY(iy), sinLut[ix] * r];
    },

    innerPoint(ix, iy) {
      return [cosLut[ix] * radiusInner, getCylY(iy), sinLut[ix] * radiusInner];
    },

    preferredNormal(ix, _iy) {
      // Radially outward
      return [cosLut[ix], 0, sinLut[ix]];
    },

    estimateTriCount(gW, gH, solid) {
      const topTris = gW * gH * 2;
      return topTris + (solid ? topTris + gW * 4 : 0);
    },

    generateOuterSurface(gW, gH, getHeight, getColor, emitTri) {
      for (let iz = 0; iz < gH; iz++) {
        for (let ix = 0; ix < gW; ix++) {
          const p00 = this.outerPoint(ix, iz, getHeight(ix, iz));
          const p10 = this.outerPoint(ix + 1, iz, getHeight(ix + 1, iz));
          const p01 = this.outerPoint(ix, iz + 1, getHeight(ix, iz + 1));
          const p11 = this.outerPoint(ix + 1, iz + 1, getHeight(ix + 1, iz + 1));
          const [fr, fg, fb] = getColor(ix, iz);

          const pref0: Vec3Tuple = [
            (p00[0] + p01[0] + p10[0]) / 3,
            0,
            (p00[2] + p01[2] + p10[2]) / 3,
          ];
          const pref1: Vec3Tuple = [
            (p10[0] + p01[0] + p11[0]) / 3,
            0,
            (p10[2] + p01[2] + p11[2]) / 3,
          ];

          emitTri(p00, p01, p10, fr, fg, fb, pref0);
          emitTri(p10, p01, p11, fr, fg, fb, pref1);
        }
      }
    },

    generateSolidGeometry(gW, gH, _getHeight, emitTri, baseColor) {
      const [br, bg, bb] = baseColor;

      // Inner support wall
      for (let iz = 0; iz < gH; iz++) {
        for (let ix = 0; ix < gW; ix++) {
          const i00 = this.innerPoint(ix, iz);
          const i10 = this.innerPoint(ix + 1, iz);
          const i01 = this.innerPoint(ix, iz + 1);
          const i11 = this.innerPoint(ix + 1, iz + 1);
          emitTri(i00, i10, i01, br, bg, bb, [-i00[0], 0, -i00[2]]);
          emitTri(i10, i11, i01, br, bg, bb, [-i10[0], 0, -i10[2]]);
        }
      }

      // Top + bottom ring caps
      // Use explicit winding (no preferredNormal) to ensure manifold-consistent
      // edge direction with the outer surface and inner wall.
      for (let ix = 0; ix < gW; ix++) {
        const oTop0 = this.outerPoint(ix, gH, _getHeight(ix, gH));
        const oTop1 = this.outerPoint(ix + 1, gH, _getHeight(ix + 1, gH));
        const iTop0 = this.innerPoint(ix, gH);
        const iTop1 = this.innerPoint(ix + 1, gH);
        emitTri(oTop0, oTop1, iTop0, br, bg, bb);
        emitTri(oTop1, iTop1, iTop0, br, bg, bb);

        const oBot0 = this.outerPoint(ix, 0, _getHeight(ix, 0));
        const oBot1 = this.outerPoint(ix + 1, 0, _getHeight(ix + 1, 0));
        const iBot0 = this.innerPoint(ix, 0);
        const iBot1 = this.innerPoint(ix + 1, 0);
        emitTri(oBot1, oBot0, iBot0, br, bg, bb);
        emitTri(oBot1, iBot0, iBot1, br, bg, bb);
      }
    },
  };
}
