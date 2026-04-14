/**
 * Box Surface Strategy — Rectangular box with heightmap relief on all 4 side faces.
 * Image wraps continuously around the 4 faces (like a cylinder with 4 flat segments).
 *
 * Vorea Studio — voreastudio.com
 */

import type {
  SurfaceStrategy,
  BoxConfig,
  Vec3Tuple,
  TriEmitter,
} from "./types";

export function createBoxSurface(config: BoxConfig): SurfaceStrategy {
  const { gridW, gridH, width, depth, height, baseThickness, capTop, capBottom } = config;
  const halfW = width / 2;
  const halfD = depth / 2;
  const yMin = -height / 2;
  const radiusInner = Math.max(0.2, Math.min(halfW, halfD) - Math.max(0.2, baseThickness));

  // The perimeter of the box: W + D + W + D
  const perimeter = 2 * (width + depth);
  // Fraction of the total perimeter each segment takes
  const segW = width / perimeter;    // front/back face width fraction
  const segD = depth / perimeter;    // left/right face width fraction
  // Segment boundaries as cumulative fractions: [0, segW, segW+segD, segW+segD+segW, 1]
  const seg0 = 0;
  const seg1 = segW;
  const seg2 = segW + segD;
  const seg3 = segW + segD + segW;
  // seg4 = 1.0

  /**
   * Given a u coordinate (0..1 around the perimeter), return the
   * 3D position on the box surface at that u and given y displacement.
   */
  function boxOuterPoint(u: number, y: number, h: number): Vec3Tuple {
    if (u <= seg1) {
      // Front face: -halfD, x goes from -halfW to +halfW
      const t = u / segW;
      const x = -halfW + t * width;
      return [x, y, -halfD - h];
    } else if (u <= seg2) {
      // Right face: +halfW, z goes from -halfD to +halfD
      const t = (u - seg1) / segD;
      const z = -halfD + t * depth;
      return [halfW + h, y, z];
    } else if (u <= seg3) {
      // Back face: +halfD, x goes from +halfW to -halfW
      const t = (u - seg2) / segW;
      const x = halfW - t * width;
      return [x, y, halfD + h];
    } else {
      // Left face: -halfW, z goes from +halfD to -halfD
      const t = (u - seg3) / segD;
      const z = halfD - t * depth;
      return [-halfW - h, y, z];
    }
  }

  function boxInnerPoint(u: number, y: number): Vec3Tuple {
    // Simple inner point at reduced radius
    const innerHalfW = Math.max(0.1, halfW - Math.max(0.2, baseThickness));
    const innerHalfD = Math.max(0.1, halfD - Math.max(0.2, baseThickness));
    if (u <= seg1) {
      const t = u / segW;
      return [-innerHalfW + t * (innerHalfW * 2), y, -innerHalfD];
    } else if (u <= seg2) {
      const t = (u - seg1) / segD;
      return [innerHalfW, y, -innerHalfD + t * (innerHalfD * 2)];
    } else if (u <= seg3) {
      const t = (u - seg2) / segW;
      return [innerHalfW - t * (innerHalfW * 2), y, innerHalfD];
    } else {
      const t = (u - seg3) / segD;
      return [-innerHalfW, y, innerHalfD - t * (innerHalfD * 2)];
    }
  }

  function boxNormal(u: number): Vec3Tuple {
    if (u <= seg1) return [0, 0, -1];
    if (u <= seg2) return [1, 0, 0];
    if (u <= seg3) return [0, 0, 1];
    return [-1, 0, 0];
  }

  const getCylY = (iz: number) => yMin + (iz / gridH) * height;

  return {
    mode: "box",

    outerPoint(ix, iy, h) {
      const u = ix === gridW ? 0 : (ix / gridW);
      const y = getCylY(iy);
      return boxOuterPoint(u, y, h);
    },

    innerPoint(ix, iy) {
      const u = ix === gridW ? 0 : (ix / gridW);
      const y = getCylY(iy);
      return boxInnerPoint(u, y);
    },

    preferredNormal(ix, _iy) {
      const u = ix === gridW ? 0 : (ix / gridW);
      return boxNormal(u);
    },

    estimateTriCount(gW, gH, solid) {
      const outerTris = gW * gH * 2;
      let solidTris = 0;
      if (solid) {
        solidTris += gW * gH * 2; // inner wall
        solidTris += gW * 4;      // top + bottom ring caps
      }
      let capTris = 0;
      // Approximate cap triangulation (rectangular caps)
      if (capTop) capTris += gW * 2;
      if (capBottom) capTris += gW * 2;
      return outerTris + solidTris + capTris;
    },

    generateOuterSurface(gW, gH, getHeight, getColor, emitTri) {
      for (let iz = 0; iz < gH; iz++) {
        for (let ix = 0; ix < gW; ix++) {
          const p00 = this.outerPoint(ix, iz, getHeight(ix, iz));
          const p10 = this.outerPoint(ix + 1, iz, getHeight(ix + 1, iz));
          const p01 = this.outerPoint(ix, iz + 1, getHeight(ix, iz + 1));
          const p11 = this.outerPoint(ix + 1, iz + 1, getHeight(ix + 1, iz + 1));
          const [fr, fg, fb] = getColor(ix, iz);

          const pref = boxNormal((ix + 0.5) / gW);
          emitTri(p00, p01, p10, fr, fg, fb, pref);
          emitTri(p10, p01, p11, fr, fg, fb, pref);
        }
      }
    },

    generateSolidGeometry(gW, gH, getHeight, emitTri, baseColor) {
      const [br, bg, bb] = baseColor;

      // Inner wall
      for (let iz = 0; iz < gH; iz++) {
        for (let ix = 0; ix < gW; ix++) {
          const i00 = this.innerPoint(ix, iz);
          const i10 = this.innerPoint(ix + 1, iz);
          const i01 = this.innerPoint(ix, iz + 1);
          const i11 = this.innerPoint(ix + 1, iz + 1);
          const n = boxNormal((ix + 0.5) / gW);
          const innerN: Vec3Tuple = [-n[0], -n[1], -n[2]];
          emitTri(i00, i10, i01, br, bg, bb, innerN);
          emitTri(i10, i11, i01, br, bg, bb, innerN);
        }
      }

      // Top ring cap — explicit manifold-consistent winding (no preferredNormal)
      if (capTop) {
        for (let ix = 0; ix < gW; ix++) {
          const oTop0 = this.outerPoint(ix, gH, getHeight(ix, gH));
          const oTop1 = this.outerPoint(ix + 1, gH, getHeight(ix + 1, gH));
          const iTop0 = this.innerPoint(ix, gH);
          const iTop1 = this.innerPoint(ix + 1, gH);
          emitTri(oTop0, oTop1, iTop0, br, bg, bb);
          emitTri(oTop1, iTop1, iTop0, br, bg, bb);
        }
      }

      // Bottom ring cap — explicit manifold-consistent winding (no preferredNormal)
      if (capBottom) {
        for (let ix = 0; ix < gW; ix++) {
          const oBot0 = this.outerPoint(ix, 0, getHeight(ix, 0));
          const oBot1 = this.outerPoint(ix + 1, 0, getHeight(ix + 1, 0));
          const iBot0 = this.innerPoint(ix, 0);
          const iBot1 = this.innerPoint(ix + 1, 0);
          emitTri(oBot1, oBot0, iBot0, br, bg, bb);
          emitTri(oBot1, iBot0, iBot1, br, bg, bb);
        }
      }
    },
  };
}
