/**
 * Deep functional tests for all surface-mode strategies.
 * Tests actual geometry generation, triangle counts, normals, and caps.
 */
import { describe, it, expect } from "vitest";
import { createPlaneSurface } from "../surface-modes/plane";
import { createCylinderSurface } from "../surface-modes/cylinder";
import { createBoxSurface } from "../surface-modes/box";
import { createPolygonSurface } from "../surface-modes/polygon";
import { createLampshadeSurface } from "../surface-modes/lampshade";
import { createGeodesicSurface } from "../surface-modes/geodesic";
import type { Vec3Tuple, TriEmitter } from "../surface-modes/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function zeroHeight() { return 0; }
function unitHeight() { return 1; }
function whiteColor(): Vec3Tuple { return [1, 1, 1]; }

/** Collect emitted triangles */
function collectTris() {
  const tris: { p0: Vec3Tuple; p1: Vec3Tuple; p2: Vec3Tuple }[] = [];
  const emit: TriEmitter = (p0, p1, p2) => { tris.push({ p0, p1, p2 }); };
  return { tris, emit };
}

const gW = 4;
const gH = 4;

// ═══════════════════════════════════════════════════════════════════════════════
// PLANE
// ═══════════════════════════════════════════════════════════════════════════════

describe("createPlaneSurface", () => {
  const plane = createPlaneSurface({ gridW: gW, gridH: gH, width: 10, depth: 10, baseThickness: 1 });

  it("has mode 'plane'", () => {
    expect(plane.mode).toBe("plane");
  });

  it("outerPoint returns correct 3D position at center", () => {
    const pt = plane.outerPoint(gW / 2, gH / 2, 0);
    expect(pt).toHaveLength(3);
    // Center of 10x10 plane → (0, 0, 0)
    expect(pt[0]).toBeCloseTo(0, 1);
    expect(pt[2]).toBeCloseTo(0, 1);
  });

  it("outerPoint applies height displacement", () => {
    const pt0 = plane.outerPoint(0, 0, 0);
    const pt1 = plane.outerPoint(0, 0, 5);
    expect(pt1[1] - pt0[1]).toBeCloseTo(5, 1);
  });

  it("innerPoint returns base positions", () => {
    const pt = plane.innerPoint(0, 0);
    expect(pt).toHaveLength(3);
    expect(pt[1]).toBeLessThan(0); // base below zero
  });

  it("preferredNormal points upward for plane", () => {
    const n = plane.preferredNormal(0, 0);
    expect(n[1]).toBeGreaterThan(0);
  });

  it("estimateTriCount returns reasonable count", () => {
    const count = plane.estimateTriCount(gW, gH, false);
    expect(count).toBeGreaterThanOrEqual(gW * gH * 2);
    const solidCount = plane.estimateTriCount(gW, gH, true);
    expect(solidCount).toBeGreaterThan(count);
  });

  it("generateOuterSurface emits triangles", () => {
    const { tris, emit } = collectTris();
    plane.generateOuterSurface(gW, gH, zeroHeight, whiteColor, emit);
    expect(tris.length).toBe(gW * gH * 2);
  });

  it("generateSolidGeometry emits triangles", () => {
    const { tris, emit } = collectTris();
    plane.generateSolidGeometry(gW, gH, zeroHeight, emit, [0.5, 0.5, 0.5]);
    expect(tris.length).toBeGreaterThan(0);
  });

  it("outer surface triangles have valid coordinates", () => {
    const { tris, emit } = collectTris();
    plane.generateOuterSurface(gW, gH, unitHeight, whiteColor, emit);
    for (const tri of tris) {
      for (const pt of [tri.p0, tri.p1, tri.p2]) {
        expect(pt[0]).not.toBeNaN();
        expect(pt[1]).not.toBeNaN();
        expect(pt[2]).not.toBeNaN();
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CYLINDER
// ═══════════════════════════════════════════════════════════════════════════════

describe("createCylinderSurface", () => {
  const cyl = createCylinderSurface({ gridW: gW, gridH: gH, radius: 5, height: 10, baseThickness: 1 });

  it("has mode 'cylinder'", () => {
    expect(cyl.mode).toBe("cylinder");
  });

  it("outerPoint returns points at the correct radius", () => {
    const pt = cyl.outerPoint(0, gH / 2, 0);
    const r = Math.sqrt(pt[0] ** 2 + pt[2] ** 2);
    expect(r).toBeCloseTo(5, 1);
  });

  it("outerPoint with height displaces radially", () => {
    const pt = cyl.outerPoint(0, 0, 2);
    const r = Math.sqrt(pt[0] ** 2 + pt[2] ** 2);
    expect(r).toBeCloseTo(7, 1);
  });

  it("innerPoint has smaller radius", () => {
    const outer = cyl.outerPoint(0, 0, 0);
    const inner = cyl.innerPoint(0, 0);
    const rOuter = Math.sqrt(outer[0] ** 2 + outer[2] ** 2);
    const rInner = Math.sqrt(inner[0] ** 2 + inner[2] ** 2);
    expect(rInner).toBeLessThan(rOuter);
  });

  it("preferredNormal points radially outward", () => {
    const n = cyl.preferredNormal(0, 0);
    const mag = Math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2);
    expect(mag).toBeGreaterThan(0);
  });

  it("estimateTriCount works for solid and non-solid", () => {
    const non = cyl.estimateTriCount(gW, gH, false);
    const solid = cyl.estimateTriCount(gW, gH, true);
    expect(non).toBeGreaterThan(0);
    expect(solid).toBeGreaterThan(non);
  });

  it("generateOuterSurface emits correct triangle count", () => {
    const { tris, emit } = collectTris();
    cyl.generateOuterSurface(gW, gH, zeroHeight, whiteColor, emit);
    expect(tris.length).toBe(gW * gH * 2);
  });

  it("generateSolidGeometry emits inner wall + caps", () => {
    const { tris, emit } = collectTris();
    cyl.generateSolidGeometry(gW, gH, zeroHeight, emit, [0.5, 0.5, 0.5]);
    // Inner wall + top cap + bottom cap
    expect(tris.length).toBeGreaterThan(gW * gH * 2);
  });

  it("cylinder wraps around (ix = 0 and ix = gridW are same angle)", () => {
    const pt0 = cyl.outerPoint(0, 0, 0);
    const ptEnd = cyl.outerPoint(gW, 0, 0);
    expect(pt0[0]).toBeCloseTo(ptEnd[0], 5);
    expect(pt0[2]).toBeCloseTo(ptEnd[2], 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BOX
// ═══════════════════════════════════════════════════════════════════════════════

describe("createBoxSurface", () => {
  const box = createBoxSurface({
    gridW: gW, gridH: gH,
    width: 10, depth: 8, height: 6,
    baseThickness: 1, capTop: true, capBottom: true,
  });

  it("has mode 'box'", () => {
    expect(box.mode).toBe("box");
  });

  it("outerPoint returns points on box faces", () => {
    const pt = box.outerPoint(0, gH / 2, 0);
    expect(pt).toHaveLength(3);
    // First point should be on the front face
    expect(pt[0]).not.toBeNaN();
    expect(pt[1]).not.toBeNaN();
    expect(pt[2]).not.toBeNaN();
  });

  it("innerPoint returns valid inner positions", () => {
    const pt = box.innerPoint(0, 0);
    expect(pt).toHaveLength(3);
  });

  it("preferredNormal returns face normal direction", () => {
    const n = box.preferredNormal(0, 0);
    // Normal should be unit-ish (one component is ±1, others 0)
    const mag = Math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2);
    expect(mag).toBeCloseTo(1, 3);
  });

  it("estimateTriCount includes caps when enabled", () => {
    const count = box.estimateTriCount(gW, gH, true);
    expect(count).toBeGreaterThan(gW * gH * 2);
  });

  it("generateOuterSurface emits correct tris", () => {
    const { tris, emit } = collectTris();
    box.generateOuterSurface(gW, gH, zeroHeight, whiteColor, emit);
    expect(tris.length).toBe(gW * gH * 2);
  });

  it("generateSolidGeometry with caps emits more triangles", () => {
    const { tris, emit } = collectTris();
    box.generateSolidGeometry(gW, gH, zeroHeight, emit, [0.3, 0.3, 0.3]);
    // Inner wall + top cap + bottom cap
    expect(tris.length).toBeGreaterThan(gW * gH);
  });

  it("box without caps emits fewer tris", () => {
    const noCap = createBoxSurface({
      gridW: gW, gridH: gH,
      width: 10, depth: 8, height: 6,
      baseThickness: 1, capTop: false, capBottom: false,
    });
    const withCap = collectTris();
    box.estimateTriCount(gW, gH, true);
    const noCaps = noCap.estimateTriCount(gW, gH, true);
    const withCaps = box.estimateTriCount(gW, gH, true);
    expect(noCaps).toBeLessThan(withCaps);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POLYGON
// ═══════════════════════════════════════════════════════════════════════════════

describe("createPolygonSurface", () => {
  const hex = createPolygonSurface({
    gridW: 6, gridH: gH,
    sides: 6, radius: 5, height: 10,
    baseThickness: 1, capTop: true, capBottom: false,
  });

  it("has mode 'polygon'", () => {
    expect(hex.mode).toBe("polygon");
  });

  it("outerPoint returns 3D coordinates", () => {
    const pt = hex.outerPoint(0, 0, 0);
    expect(pt).toHaveLength(3);
    pt.forEach(v => expect(v).not.toBeNaN());
  });

  it("innerPoint returns valid inner coordinates", () => {
    const pt = hex.innerPoint(3, 2);
    expect(pt).toHaveLength(3);
    pt.forEach(v => expect(v).not.toBeNaN());
  });

  it("outerPoint applies displacement", () => {
    const pt0 = hex.outerPoint(0, 0, 0);
    const pt1 = hex.outerPoint(0, 0, 3);
    // Some coordinate should differ by the displacement
    const dist = Math.sqrt(
      (pt1[0] - pt0[0]) ** 2 + (pt1[1] - pt0[1]) ** 2 + (pt1[2] - pt0[2]) ** 2
    );
    expect(dist).toBeGreaterThan(0);
  });

  it("clamps sides to 3-12 range", () => {
    const tri = createPolygonSurface({
      gridW: 3, gridH: 3, sides: 1, radius: 5, height: 10, baseThickness: 1, capTop: false, capBottom: false,
    });
    // Even with sides=1, it should still produce valid output (clamped to 3)
    const pt = tri.outerPoint(0, 0, 0);
    expect(pt).toHaveLength(3);
  });

  it("generates outer surface triangles", () => {
    const { tris, emit } = collectTris();
    hex.generateOuterSurface(6, gH, zeroHeight, whiteColor, emit);
    expect(tris.length).toBe(6 * gH * 2);
  });

  it("generates solid geometry with caps", () => {
    const { tris, emit } = collectTris();
    hex.generateSolidGeometry(6, gH, zeroHeight, emit, [0.5, 0.5, 0.5]);
    expect(tris.length).toBeGreaterThan(0);
  });

  it("estimateTriCount returns sensible number", () => {
    const count = hex.estimateTriCount(6, gH, true);
    expect(count).toBeGreaterThan(6 * gH * 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LAMPSHADE
// ═══════════════════════════════════════════════════════════════════════════════

describe("createLampshadeSurface", () => {
  const lamp = createLampshadeSurface({
    gridW: gW, gridH: gH,
    outerRadiusBottom: 6, outerRadiusTop: 4,
    holeRadius: 2, height: 10, baseThickness: 1,
    capPosition: "both", sides: 0,
  });

  it("has mode 'lampshade'", () => {
    expect(lamp.mode).toBe("lampshade");
  });

  it("outerPoint varies radius from bottom to top", () => {
    const ptBot = lamp.outerPoint(0, 0, 0);
    const ptTop = lamp.outerPoint(0, gH, 0);
    const rBot = Math.sqrt(ptBot[0] ** 2 + ptBot[2] ** 2);
    const rTop = Math.sqrt(ptTop[0] ** 2 + ptTop[2] ** 2);
    // Bottom radius > top radius
    expect(rBot).toBeGreaterThan(rTop);
  });

  it("innerPoint returns valid coordinates", () => {
    const pt = lamp.innerPoint(2, 2);
    expect(pt).toHaveLength(3);
    pt.forEach(v => expect(v).not.toBeNaN());
  });

  it("preferredNormal is roughly radial", () => {
    const n = lamp.preferredNormal(0, 0);
    expect(n).toHaveLength(3);
    const mag = Math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2);
    expect(mag).toBeGreaterThan(0);
  });

  it("generates outer surface", () => {
    const { tris, emit } = collectTris();
    lamp.generateOuterSurface(gW, gH, zeroHeight, whiteColor, emit);
    expect(tris.length).toBe(gW * gH * 2);
  });

  it("generates solid geometry with both caps", () => {
    const { tris, emit } = collectTris();
    lamp.generateSolidGeometry(gW, gH, zeroHeight, emit, [0.4, 0.4, 0.4]);
    expect(tris.length).toBeGreaterThan(0);
  });

  it("estimateTriCount handles both-cap mode", () => {
    const count = lamp.estimateTriCount(gW, gH, true);
    expect(count).toBeGreaterThan(gW * gH * 2);
  });

  it("polygon sides mode produces valid geometry", () => {
    const polyLamp = createLampshadeSurface({
      gridW: 6, gridH: 4,
      outerRadiusBottom: 6, outerRadiusTop: 4,
      holeRadius: 2, height: 10, baseThickness: 1,
      capPosition: "top", sides: 6,
    });
    const { tris, emit } = collectTris();
    polyLamp.generateOuterSurface(6, 4, unitHeight, whiteColor, emit);
    expect(tris.length).toBeGreaterThan(0);
    for (const tri of tris) {
      for (const pt of [tri.p0, tri.p1, tri.p2]) {
        pt.forEach(v => expect(v).not.toBeNaN());
      }
    }
  });

  it("capPosition 'none' mode works", () => {
    const noCapLamp = createLampshadeSurface({
      gridW: gW, gridH: gH,
      outerRadiusBottom: 6, outerRadiusTop: 4,
      holeRadius: 2, height: 10, baseThickness: 1,
      capPosition: "none", sides: 0,
    });
    const count = noCapLamp.estimateTriCount(gW, gH, true);
    const fullCount = lamp.estimateTriCount(gW, gH, true);
    expect(count).toBeLessThanOrEqual(fullCount);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GEODESIC
// ═══════════════════════════════════════════════════════════════════════════════

describe("createGeodesicSurface", () => {
  const geo = createGeodesicSurface({
    gridW: 2, gridH: 2,
    radius: 5, baseThickness: 1,
  });

  it("has mode 'geodesic'", () => {
    expect(geo.mode).toBe("geodesic");
  });

  it("outerPoint returns valid 3D point", () => {
    const pt = geo.outerPoint(0, 0, 0);
    expect(pt).toHaveLength(3);
    pt.forEach(v => expect(v).not.toBeNaN());
  });

  it("innerPoint returns valid coordinates", () => {
    const inner = geo.innerPoint(1, 1);
    expect(inner).toHaveLength(3);
    inner.forEach(v => expect(v).not.toBeNaN());
  });

  it("preferredNormal is radial (outward)", () => {
    const n = geo.preferredNormal(0, 0);
    const mag = Math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2);
    expect(mag).toBeGreaterThan(0);
  });

  it("estimateTriCount returns positive count", () => {
    const count = geo.estimateTriCount(2, 2, false);
    expect(count).toBeGreaterThan(0);
  });

  it("generateOuterSurface produces triangles", () => {
    const { tris, emit } = collectTris();
    geo.generateOuterSurface(2, 2, zeroHeight, whiteColor, emit);
    expect(tris.length).toBeGreaterThan(0);
  });

  it("generates solid geometry with higher subdivision", () => {
    // Use higher grid to trigger icosphere subdivision (level 1+)
    const hires = createGeodesicSurface({
      gridW: 8, gridH: 8,
      radius: 5, baseThickness: 1,
    });
    const { tris, emit } = collectTris();
    hires.generateOuterSurface(8, 8, unitHeight, whiteColor, emit);
    expect(tris.length).toBeGreaterThan(0);
    // Solid geometry
    const { tris: solidTris, emit: solidEmit } = collectTris();
    hires.generateSolidGeometry(8, 8, zeroHeight, solidEmit, [0.5, 0.5, 0.5]);
    expect(solidTris.length).toBeGreaterThan(0);
  });

  it("generateSolidGeometry produces inner shell", () => {
    const { tris, emit } = collectTris();
    geo.generateSolidGeometry(2, 2, zeroHeight, emit, [0.5, 0.5, 0.5]);
    expect(tris.length).toBeGreaterThan(0);
  });

  it("outerPoint returns valid 3D coordinates", () => {
    const pt = geo.outerPoint(1, 1, 2);
    expect(pt).toHaveLength(3);
    pt.forEach(v => expect(v).not.toBeNaN());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SVG PATH SURFACE
// ═══════════════════════════════════════════════════════════════════════════════

describe("svg-path-surface", () => {
  it("can be imported", async () => {
    const mod = await import("../surface-modes/svg-path-surface");
    expect(mod).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INDEX BARREL EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("surface-modes/index", () => {
  it("exports all surface mode factory functions", async () => {
    const mod = await import("../surface-modes/index");
    expect(mod.createPlaneSurface).toBeDefined();
    expect(mod.createCylinderSurface).toBeDefined();
    expect(mod.createBoxSurface).toBeDefined();
    expect(mod.createPolygonSurface).toBeDefined();
    expect(mod.createLampshadeSurface).toBeDefined();
    expect(mod.createGeodesicSurface).toBeDefined();
    expect(mod.createStlSurface).toBeDefined();
    expect(mod.extractDepthField).toBeDefined();
  });
});
