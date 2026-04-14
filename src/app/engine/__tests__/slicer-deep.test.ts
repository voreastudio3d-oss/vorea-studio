/**
 * Deep tests for slicer.ts — mesh slicing, contour assembly, infill, GCode.
 */
import { describe, it, expect } from "vitest";
import { sliceMesh, meshToGCode, DEFAULT_SLICE_CONFIG } from "../slicer";
import type { SerializedMesh, SerializedPolygon, SerializedVertex } from "../mesh-data";
import { deserializeToRenderable } from "../mesh-data";

// ── Helper: build a simple cube mesh ─────────────────────────────────────────

function vert(x: number, y: number, z: number): SerializedVertex {
  return { px: x, py: y, pz: z, nx: 0, ny: 0, nz: 0 };
}

function quad(a: SerializedVertex, b: SerializedVertex, c: SerializedVertex, d: SerializedVertex): SerializedPolygon {
  return {
    vertices: [a, b, c, d],
    planeNx: 0, planeNy: 0, planeNz: 1, planeW: 0,
  };
}

function tri(a: SerializedVertex, b: SerializedVertex, c: SerializedVertex): SerializedPolygon {
  return {
    vertices: [a, b, c],
    planeNx: 0, planeNy: 1, planeNz: 0, planeW: 0,
  };
}

/** 10×10×10 unit cube centered at origin */
function makeCube(size = 10): SerializedMesh {
  const s = size / 2;
  const v = {
    // bottom face vertices
    nbl: vert(-s, -s, -s), nbr: vert(s, -s, -s), ntr: vert(s, s, -s), ntl: vert(-s, s, -s),
    // top face vertices
    fbl: vert(-s, -s, s), fbr: vert(s, -s, s), ftr: vert(s, s, s), ftl: vert(-s, s, s),
  };

  return {
    polygons: [
      quad(v.nbl, v.nbr, v.ntr, v.ntl), // back
      quad(v.fbl, v.fbr, v.ftr, v.ftl), // front
      quad(v.nbl, v.fbl, v.ftl, v.ntl), // left
      quad(v.nbr, v.fbr, v.ftr, v.ntr), // right
      quad(v.nbl, v.nbr, v.fbr, v.fbl), // bottom
      quad(v.ntl, v.ntr, v.ftr, v.ftl), // top
    ],
    faceCount: 6,
  };
}

/** Simple pyramid (4 triangular faces + square base) */
function makePyramid(): SerializedMesh {
  const apex = vert(0, 0, 5);
  const bl = vert(-3, -3, 0);
  const br = vert(3, -3, 0);
  const tr = vert(3, 3, 0);
  const tl = vert(-3, 3, 0);

  return {
    polygons: [
      tri(bl, br, apex),
      tri(br, tr, apex),
      tri(tr, tl, apex),
      tri(tl, bl, apex),
      quad(bl, br, tr, tl), // base
    ],
    faceCount: 5,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT_SLICE_CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

describe("DEFAULT_SLICE_CONFIG", () => {
  it("has expected default values", () => {
    expect(DEFAULT_SLICE_CONFIG.layerHeight).toBe(0.2);
    expect(DEFAULT_SLICE_CONFIG.extrusionWidth).toBe(0.4);
    expect(DEFAULT_SLICE_CONFIG.infillDensity).toBe(0.2);
    expect(DEFAULT_SLICE_CONFIG.infillPattern).toBe("lines");
    expect(DEFAULT_SLICE_CONFIG.wallCount).toBe(2);
    expect(DEFAULT_SLICE_CONFIG.topLayers).toBe(3);
    expect(DEFAULT_SLICE_CONFIG.bottomLayers).toBe(3);
    expect(DEFAULT_SLICE_CONFIG.printSpeed).toBe(1200);
    expect(DEFAULT_SLICE_CONFIG.travelSpeed).toBe(3000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// sliceMesh
// ═══════════════════════════════════════════════════════════════════════════════

describe("sliceMesh", () => {
  it("slices a cube into layers", () => {
    const cube = makeCube(10);
    const result = sliceMesh(cube, { layerHeight: 1 });
    expect(result.slices.length).toBeGreaterThan(0);
    expect(result.totalLayers).toBe(result.slices.length);
    expect(result.bbox).toBeDefined();
  });

  it("returns correct bounding box for cube", () => {
    const cube = makeCube(10);
    const result = sliceMesh(cube, { layerHeight: 1 });
    expect(result.bbox.minX).toBeCloseTo(-5);
    expect(result.bbox.maxX).toBeCloseTo(5);
    expect(result.bbox.minZ).toBeCloseTo(-5);
    expect(result.bbox.maxZ).toBeCloseTo(5);
  });

  it("each slice has valid z and contours", () => {
    const cube = makeCube(10);
    const result = sliceMesh(cube, { layerHeight: 2 });
    for (const slice of result.slices) {
      expect(slice.z).not.toBeNaN();
      expect(slice.contours.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("slices a pyramid", () => {
    const pyramid = makePyramid();
    const result = sliceMesh(pyramid, { layerHeight: 1 });
    expect(result.slices.length).toBeGreaterThan(0);
    expect(result.bbox.maxZ).toBeCloseTo(5);
  });

  it("respects custom layer height", () => {
    const cube = makeCube(10);
    const fine = sliceMesh(cube, { layerHeight: 0.5 });
    const coarse = sliceMesh(cube, { layerHeight: 2 });
    expect(fine.slices.length).toBeGreaterThan(coarse.slices.length);
  });

  it("empty mesh returns no slices", () => {
    const empty: SerializedMesh = { polygons: [], faceCount: 0 };
    const result = sliceMesh(empty);
    expect(result.slices.length).toBe(0);
    expect(result.totalLayers).toBe(0);
  });

  it("uses DEFAULT_SLICE_CONFIG when no config provided", () => {
    const cube = makeCube(2);
    const result = sliceMesh(cube);
    expect(result.slices.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// meshToGCode
// ═══════════════════════════════════════════════════════════════════════════════

describe("meshToGCode", () => {
  it("generates GCode from a cube", () => {
    const cube = makeCube(4);
    const result = meshToGCode(cube, { layerHeight: 1, infillPattern: "none" });
    expect(result.gcode).toBeDefined();
    expect(typeof result.gcode).toBe("string");
    expect(result.gcode.length).toBeGreaterThan(0);
  });

  it("gcode includes layer comments", () => {
    const cube = makeCube(4);
    const result = meshToGCode(cube, { layerHeight: 1, infillPattern: "none" });
    expect(result.gcode).toContain("Layer");
  });

  it("gcode includes model info comment", () => {
    const cube = makeCube(4);
    const result = meshToGCode(cube, { layerHeight: 1 });
    expect(result.gcode).toContain("Vorea Studio");
  });

  it("generates with infill lines pattern", () => {
    const cube = makeCube(6);
    const result = meshToGCode(cube, { layerHeight: 2, infillPattern: "lines", infillDensity: 0.5 });
    expect(result.gcode.length).toBeGreaterThan(100);
  });

  it("generates with grid infill pattern", () => {
    const cube = makeCube(6);
    const result = meshToGCode(cube, { layerHeight: 2, infillPattern: "grid", infillDensity: 0.5 });
    expect(result.gcode.length).toBeGreaterThan(100);
  });

  it("handles zero infill density", () => {
    const cube = makeCube(4);
    const result = meshToGCode(cube, { layerHeight: 1, infillDensity: 0 });
    expect(result.gcode).toBeDefined();
  });

  it("returns step count in result", () => {
    const cube = makeCube(4);
    const result = meshToGCode(cube, { layerHeight: 1 });
    expect(result.lines).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// mesh-data - deserializeToRenderable
// ═══════════════════════════════════════════════════════════════════════════════

describe("deserializeToRenderable", () => {
  it("converts serialized mesh to renderable format", () => {
    const mesh = makeCube(2);
    const renderable = deserializeToRenderable(mesh);
    expect(renderable).toBeDefined();
    expect(typeof renderable.toPolygons).toBe("function");
  });

  it("preserves polygon count", () => {
    const mesh = makeCube(2);
    const renderable = deserializeToRenderable(mesh);
    const polys = renderable.toPolygons();
    expect(polys.length).toBe(mesh.polygons.length);
  });

  it("maps vertex positions correctly", () => {
    const mesh: SerializedMesh = {
      polygons: [{
        vertices: [
          { px: 1, py: 2, pz: 3, nx: 0, ny: 0, nz: 1 },
          { px: 4, py: 5, pz: 6, nx: 0, ny: 0, nz: 1 },
          { px: 7, py: 8, pz: 9, nx: 0, ny: 0, nz: 1 },
        ],
        planeNx: 0, planeNy: 0, planeNz: 1, planeW: 3,
      }],
      faceCount: 1,
    };
    const polys = deserializeToRenderable(mesh).toPolygons();
    expect(polys[0].vertices[0].pos).toEqual({ x: 1, y: 2, z: 3 });
    expect(polys[0].vertices[0].normal).toEqual({ x: 0, y: 0, z: 1 });
    expect(polys[0].plane.normal).toEqual({ x: 0, y: 0, z: 1 });
    expect(polys[0].plane.w).toBe(3);
  });

  it("handles empty mesh", () => {
    const mesh: SerializedMesh = { polygons: [], faceCount: 0 };
    const renderable = deserializeToRenderable(mesh);
    expect(renderable.toPolygons()).toEqual([]);
  });
});
