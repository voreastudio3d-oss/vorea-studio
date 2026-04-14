/**
 * Polygon Surface Strategy — N-sided prism (3–12 sides) with heightmap relief.
 * Generalizes the box mode — each flat panel gets a portion of the image.
 *
 * Vorea Studio — voreastudio.com
 */

import type {
  SurfaceStrategy,
  PolygonConfig,
  Vec3Tuple,
  TriEmitter,
} from "./types";

export function createPolygonSurface(config: PolygonConfig): SurfaceStrategy {
  const {
    gridW, gridH,
    sides: rawSides,
    radius, height, baseThickness,
    capTop, capBottom,
  } = config;
  const sides = Math.max(3, Math.min(12, Math.round(rawSides)));
  const yMin = -height / 2;
  const innerRadius = Math.max(0.2, radius - Math.max(0.2, baseThickness));

  // Pre-compute polygon vertex positions (XZ plane)
  const cornerAngles: number[] = [];
  const cornerCos: number[] = [];
  const cornerSin: number[] = [];
  for (let s = 0; s <= sides; s++) {
    const angle = (s / sides) * Math.PI * 2;
    cornerAngles.push(angle);
    cornerCos.push(Math.cos(angle));
    cornerSin.push(Math.sin(angle));
  }
  // Enforce perfect mathematical closure
  cornerCos[sides] = cornerCos[0];
  cornerSin[sides] = cornerSin[0];
  cornerAngles[sides] = Math.PI * 2;

  const getCylY = (iz: number) => yMin + (iz / gridH) * height;

  /**
   * Map u (0..1) to position on polygon outer surface with height displacement.
   * u maps linearly around the N sides.
   */
  function polyOuterPoint(u: number, y: number, h: number): Vec3Tuple {
    const sideFloat = u * sides;
    const sideIdx = Math.min(sides - 1, Math.floor(sideFloat));
    const t = sideFloat - sideIdx; // 0..1 within this side

    // Interpolate between corners of this polygon side
    const x0 = cornerCos[sideIdx], z0 = cornerSin[sideIdx];
    const x1 = cornerCos[sideIdx + 1], z1 = cornerSin[sideIdx + 1];
    const px = (x0 * (1 - t) + x1 * t) * radius;
    const pz = (z0 * (1 - t) + z1 * t) * radius;

    // Normal for this face (perpendicular to the side edge)
    const midX = (x0 + x1) / 2;
    const midZ = (z0 + z1) / 2;
    const nLen = Math.sqrt(midX * midX + midZ * midZ);
    const nx = nLen > 1e-10 ? midX / nLen : 0;
    const nz = nLen > 1e-10 ? midZ / nLen : 0;

    // Displace outward along face normal
    return [px + nx * h, y, pz + nz * h];
  }

  function polyInnerPoint(u: number, y: number): Vec3Tuple {
    const sideFloat = u * sides;
    const sideIdx = Math.min(sides - 1, Math.floor(sideFloat));
    const t = sideFloat - sideIdx;

    const x0 = cornerCos[sideIdx], z0 = cornerSin[sideIdx];
    const x1 = cornerCos[sideIdx + 1], z1 = cornerSin[sideIdx + 1];
    const px = (x0 * (1 - t) + x1 * t) * innerRadius;
    const pz = (z0 * (1 - t) + z1 * t) * innerRadius;

    return [px, y, pz];
  }

  function polyNormal(u: number): Vec3Tuple {
    const sideFloat = u * sides;
    const sideIdx = Math.min(sides - 1, Math.floor(sideFloat));
    const x0 = cornerCos[sideIdx], z0 = cornerSin[sideIdx];
    const x1 = cornerCos[sideIdx + 1], z1 = cornerSin[sideIdx + 1];
    const midX = (x0 + x1) / 2;
    const midZ = (z0 + z1) / 2;
    const nLen = Math.sqrt(midX * midX + midZ * midZ);
    return nLen > 1e-10 ? [midX / nLen, 0, midZ / nLen] : [1, 0, 0];
  }

  return {
    mode: "polygon",

    outerPoint(ix, iy, h) {
      const u = ix === gridW ? 0 : (ix / gridW);
      return polyOuterPoint(u, getCylY(iy), h);
    },

    innerPoint(ix, iy) {
      const u = ix === gridW ? 0 : (ix / gridW);
      return polyInnerPoint(u, getCylY(iy));
    },

    preferredNormal(ix, _iy) {
      const u = ix === gridW ? 0 : (ix / gridW);
      return polyNormal(u);
    },

    estimateTriCount(gW, gH, solid) {
      const outerTris = gW * gH * 2;
      let solidTris = 0;
      if (solid) {
        solidTris += gW * gH * 2; // inner wall
        solidTris += gW * 4;      // ring caps (top + bottom)
      }
      let capTris = 0;
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

          const pref = polyNormal((ix + 0.5) / gW);
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
          const n = polyNormal((ix + 0.5) / gW);
          const innerN: Vec3Tuple = [-n[0], -n[1], -n[2]];
          emitTri(i00, i10, i01, br, bg, bb, innerN);
          emitTri(i10, i11, i01, br, bg, bb, innerN);
        }
      }

      // Top cap ring — explicit manifold-consistent winding (no preferredNormal)
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

      // Bottom cap ring — explicit manifold-consistent winding (no preferredNormal)
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
