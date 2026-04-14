/**
 * Lampshade Surface Strategy — Cone/cylinder/polygon hollow shell with
 * configurable top and bottom radii (cone when different), inner wall
 * derived from shell thickness, and configurable single or dual caps.
 * Ideal for LED lamp covers and decorative lighting diffusers.
 *
 * Vorea Studio — voreastudio.com
 */

import type {
  SurfaceStrategy,
  LampshadeConfig,
  Vec3Tuple,
  TriEmitter,
} from "./types";

export function createLampshadeSurface(config: LampshadeConfig): SurfaceStrategy {
  const {
    gridW, gridH,
    outerRadiusBottom, outerRadiusTop,
    height, baseThickness,
    capPosition, sides: rawSides,
  } = config;
  const usePoly = rawSides >= 3;
  const sides = usePoly ? Math.max(3, Math.min(12, Math.round(rawSides))) : 0;
  const cols = gridW + 1;
  const yMin = -height / 2;

  // Shell thickness determines the inner wall radius
  const shellThickness = Math.max(0.2, baseThickness);

  // Interpolate outer radius at a given vertical fraction t ∈ [0,1]
  // t=0 → bottom, t=1 → top
  const outerRadiusAt = (t: number) =>
    outerRadiusBottom + (outerRadiusTop - outerRadiusBottom) * t;

  const hasCapTop = capPosition === "top" || capPosition === "both";
  const hasCapBottom = capPosition === "bottom" || capPosition === "both";

  // Clamp hole radius so it doesn't cross the outer shell
  const minOuter = Math.min(outerRadiusBottom, outerRadiusTop);
  const safeHoleRadius = Math.max(0.5, Math.min(config.holeRadius, minOuter - shellThickness));

  const yInMin = yMin + (hasCapBottom ? shellThickness : 0);
  const yInMax = yMin + height - (hasCapTop ? shellThickness : 0);

  const getInnerY = (iz: number) => yInMin + (iz / gridH) * (yInMax - yInMin);
  const getInnerVFrac = (y: number) => (y - yMin) / height;

  // Inner wall perfectly parallel to the cone profile
  const innerRadiusAt = (y: number) => Math.max(0.2, outerRadiusAt(getInnerVFrac(y)) - shellThickness);

  // Trig LUTs for smooth cylinder
  const cosLut = new Float32Array(cols);
  const sinLut = new Float32Array(cols);
  for (let ix = 0; ix < cols; ix++) {
    const theta = (ix / gridW) * Math.PI * 2;
    cosLut[ix] = Math.cos(theta);
    sinLut[ix] = Math.sin(theta);
  }
  // Enforce perfect mathematical closure at the seam
  cosLut[gridW] = cosLut[0];
  sinLut[gridW] = sinLut[0];

  // Polygon corner LUTs (only if usePoly)
  let polyCornerCos: number[] = [];
  let polyCornerSin: number[] = [];
  if (usePoly) {
    for (let s = 0; s <= sides; s++) {
      const angle = (s / sides) * Math.PI * 2;
      polyCornerCos.push(Math.cos(angle));
      polyCornerSin.push(Math.sin(angle));
    }
    // Enforce perfect mathematical closure
    polyCornerCos[sides] = polyCornerCos[0];
    polyCornerSin[sides] = polyCornerSin[0];
  }

  const getCylY = (iz: number) => yMin + (iz / gridH) * height;
  const getVertFraction = (iz: number) => iz / gridH;

  function outerPointSmooth(ix: number, y: number, vFrac: number, h: number): Vec3Tuple {
    const r = outerRadiusAt(vFrac) + h;
    return [cosLut[ix] * r, y, sinLut[ix] * r];
  }

  function outerPointPoly(u: number, y: number, vFrac: number, h: number): Vec3Tuple {
    const r = outerRadiusAt(vFrac);
    const sideFloat = u * sides;
    const sideIdx = Math.min(sides - 1, Math.floor(sideFloat));
    const t = sideFloat - sideIdx;
    const x0 = polyCornerCos[sideIdx], z0 = polyCornerSin[sideIdx];
    const x1 = polyCornerCos[sideIdx + 1], z1 = polyCornerSin[sideIdx + 1];
    const px = (x0 * (1 - t) + x1 * t) * r;
    const pz = (z0 * (1 - t) + z1 * t) * r;
    const midX = (x0 + x1) / 2, midZ = (z0 + z1) / 2;
    const nLen = Math.sqrt(midX * midX + midZ * midZ);
    const nx = nLen > 1e-10 ? midX / nLen : 0;
    const nz = nLen > 1e-10 ? midZ / nLen : 0;
    return [px + nx * h, y, pz + nz * h];
  }

  function innerWallPoint(ix: number, y: number): Vec3Tuple {
    const r = innerRadiusAt(y);
    return [cosLut[ix] * r, y, sinLut[ix] * r];
  }

  function normalSmooth(ix: number): Vec3Tuple {
    return [cosLut[ix], 0, sinLut[ix]];
  }

  function normalPoly(u: number): Vec3Tuple {
    const sideFloat = u * sides;
    const sideIdx = Math.min(sides - 1, Math.floor(sideFloat));
    const x0 = polyCornerCos[sideIdx], z0 = polyCornerSin[sideIdx];
    const x1 = polyCornerCos[sideIdx + 1], z1 = polyCornerSin[sideIdx + 1];
    const midX = (x0 + x1) / 2, midZ = (z0 + z1) / 2;
    const nLen = Math.sqrt(midX * midX + midZ * midZ);
    return nLen > 1e-10 ? [midX / nLen, 0, midZ / nLen] : [1, 0, 0];
  }

  // Cap positions computed above

  return {
    mode: "lampshade",

    outerPoint(ix, iy, h) {
      const y = getCylY(iy);
      const vFrac = getVertFraction(iy);
      if (usePoly) {
        const u = ix === gridW ? 0 : (ix / gridW);
        return outerPointPoly(u, y, vFrac, h);
      }
      // For smooth cylinder, using ix directly is safe because cosLut[gridW] === cosLut[0]
      // However to guarantee normal matching exactly like poly, we use ix%gridW
      return outerPointSmooth(ix === gridW ? 0 : ix, y, vFrac, h);
    },

    innerPoint(ix, iy) {
      return innerWallPoint(ix === gridW ? 0 : ix, getInnerY(iy));
    },

    preferredNormal(ix, _iy) {
      if (usePoly) {
        const u = ix === gridW ? 0 : (ix / gridW);
        return normalPoly(u);
      }
      return normalSmooth(ix === gridW ? 0 : ix);
    },

    estimateTriCount(gW, gH, solid) {
      const outerTris = gW * gH * 2;
      let solidTris = 0;
      if (solid) {
        solidTris += gW * gH * 2; // inner wall
        solidTris += hasCapTop ? gW * 6 : gW * 2;
        solidTris += hasCapBottom ? gW * 6 : gW * 2;
      }
      return outerTris + solidTris;
    },

    generateOuterSurface(gW, gH, getHeight, getColor, emitTri) {
      for (let iz = 0; iz < gH; iz++) {
        for (let ix = 0; ix < gW; ix++) {
          const p00 = this.outerPoint(ix, iz, getHeight(ix, iz));
          const p10 = this.outerPoint(ix + 1, iz, getHeight(ix + 1, iz));
          const p01 = this.outerPoint(ix, iz + 1, getHeight(ix, iz + 1));
          const p11 = this.outerPoint(ix + 1, iz + 1, getHeight(ix + 1, iz + 1));
          const [fr, fg, fb] = getColor(ix, iz);

          const pref = usePoly
            ? normalPoly((ix + 0.5) / gW)
            : normalSmooth(ix);
          emitTri(p00, p01, p10, fr, fg, fb, pref);
          emitTri(p10, p01, p11, fr, fg, fb, pref);
        }
      }
    },

    generateSolidGeometry(gW, gH, getHeight, emitTri, baseColor) {
      const [br, bg, bb] = baseColor;

      // Inner wall (smooth cylinder perfectly parallel to cone profile)
      for (let iz = 0; iz < gH; iz++) {
        for (let ix = 0; ix < gW; ix++) {
          const y0 = getInnerY(iz);
          const y1 = getInnerY(iz + 1);
          const i00 = innerWallPoint(ix, y0);
          const i10 = innerWallPoint(ix + 1, y0);
          const i01 = innerWallPoint(ix, y1);
          const i11 = innerWallPoint(ix + 1, y1);
          // Inward-facing normal (requires inverted winding)
          emitTri(i00, i01, i10, br, bg, bb, [-cosLut[ix], 0, -sinLut[ix]]);
          emitTri(i10, i01, i11, br, bg, bb, [-cosLut[ix + 1], 0, -sinLut[ix + 1]]);
        }
      }

      // Top cap or seal
      for (let ix = 0; ix < gW; ix++) {
        const oTop0 = this.outerPoint(ix, gH, getHeight(ix, gH));
        const oTop1 = this.outerPoint(ix + 1, gH, getHeight(ix + 1, gH));
        const iTop0 = innerWallPoint(ix, yInMax);
        const iTop1 = innerWallPoint(ix + 1, yInMax);

        if (hasCapTop) {
          const holeT0: Vec3Tuple = [cosLut[ix] * safeHoleRadius, yMin + height, sinLut[ix] * safeHoleRadius];
          const holeT1: Vec3Tuple = [cosLut[ix + 1] * safeHoleRadius, yMin + height, sinLut[ix + 1] * safeHoleRadius];
          const holeB0: Vec3Tuple = [cosLut[ix] * safeHoleRadius, yInMax, sinLut[ix] * safeHoleRadius];
          const holeB1: Vec3Tuple = [cosLut[ix + 1] * safeHoleRadius, yInMax, sinLut[ix + 1] * safeHoleRadius];

          // Top face of flange (UP)
          emitTri(oTop0, holeT0, oTop1, br, bg, bb, [0, 1, 0]);
          emitTri(oTop1, holeT0, holeT1, br, bg, bb, [0, 1, 0]);

          // Hole inner wall (INWARDS)
          const n0: Vec3Tuple = [-cosLut[ix], 0, -sinLut[ix]];
          const n1: Vec3Tuple = [-cosLut[ix + 1], 0, -sinLut[ix + 1]];
          emitTri(holeB0, holeB1, holeT0, br, bg, bb, n0);
          emitTri(holeB1, holeT1, holeT0, br, bg, bb, n1);

          // Bottom face of flange (DOWN)
          emitTri(iTop0, iTop1, holeB0, br, bg, bb, [0, -1, 0]);
          emitTri(iTop1, holeB1, holeB0, br, bg, bb, [0, -1, 0]);
        } else {
          // No cap, just seal the edge — explicit manifold-consistent winding
          emitTri(oTop0, oTop1, iTop0, br, bg, bb);
          emitTri(oTop1, iTop1, iTop0, br, bg, bb);
        }
      }

      // Bottom cap or seal
      for (let ix = 0; ix < gW; ix++) {
        const oBot0 = this.outerPoint(ix, 0, getHeight(ix, 0));
        const oBot1 = this.outerPoint(ix + 1, 0, getHeight(ix + 1, 0));
        const iBot0 = innerWallPoint(ix, yInMin);
        const iBot1 = innerWallPoint(ix + 1, yInMin);

        if (hasCapBottom) {
          const holeB0: Vec3Tuple = [cosLut[ix] * safeHoleRadius, yMin, sinLut[ix] * safeHoleRadius];
          const holeB1: Vec3Tuple = [cosLut[ix + 1] * safeHoleRadius, yMin, sinLut[ix + 1] * safeHoleRadius];
          const holeT0: Vec3Tuple = [cosLut[ix] * safeHoleRadius, yInMin, sinLut[ix] * safeHoleRadius];
          const holeT1: Vec3Tuple = [cosLut[ix + 1] * safeHoleRadius, yInMin, sinLut[ix + 1] * safeHoleRadius];

          // Bottom face of flange (DOWN)
          emitTri(oBot0, oBot1, holeB0, br, bg, bb, [0, -1, 0]);
          emitTri(oBot1, holeB1, holeB0, br, bg, bb, [0, -1, 0]);

          // Hole inner wall (INWARDS)
          const n0: Vec3Tuple = [-cosLut[ix], 0, -sinLut[ix]];
          const n1: Vec3Tuple = [-cosLut[ix + 1], 0, -sinLut[ix + 1]];
          emitTri(holeB0, holeB1, holeT0, br, bg, bb, n0);
          emitTri(holeB1, holeT1, holeT0, br, bg, bb, n1);

          // Top face of flange (UP)
          emitTri(iBot0, holeT0, iBot1, br, bg, bb, [0, 1, 0]);
          emitTri(iBot1, holeT0, holeT1, br, bg, bb, [0, 1, 0]);
        } else {
          // No cap, just seal the edge — explicit manifold-consistent winding
          emitTri(oBot1, oBot0, iBot0, br, bg, bb);
          emitTri(oBot1, iBot0, iBot1, br, bg, bb);
        }
      }
    },
  };
}
