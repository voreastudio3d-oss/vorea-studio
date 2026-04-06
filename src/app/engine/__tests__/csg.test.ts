/**
 * CSG Engine Tests — Vec3, Polygon, CSG primitives & boolean ops.
 */
import { describe, it, expect } from "vitest";
import { Vec3, Vertex, Polygon, CSG, mat4Identity, mat4Translate, mat4Scale, mat4Multiply } from "../csg";

// ═════════════════════════════════════════════════════════════════════════════
// Vec3
// ═════════════════════════════════════════════════════════════════════════════

describe("Vec3", () => {
  it("adds vectors", () => {
    const a = new Vec3(1, 2, 3);
    const b = new Vec3(4, 5, 6);
    const c = a.plus(b);
    expect(c.x).toBe(5);
    expect(c.y).toBe(7);
    expect(c.z).toBe(9);
  });

  it("subtracts vectors", () => {
    const a = new Vec3(10, 20, 30);
    const b = new Vec3(1, 2, 3);
    const c = a.minus(b);
    expect(c.x).toBe(9);
    expect(c.y).toBe(18);
    expect(c.z).toBe(27);
  });

  it("computes dot product", () => {
    const a = new Vec3(1, 0, 0);
    const b = new Vec3(0, 1, 0);
    expect(a.dot(b)).toBe(0);

    const c = new Vec3(1, 2, 3);
    const d = new Vec3(4, 5, 6);
    expect(c.dot(d)).toBe(32);
  });

  it("computes cross product", () => {
    const x = new Vec3(1, 0, 0);
    const y = new Vec3(0, 1, 0);
    const z = x.cross(y);
    expect(z.x).toBeCloseTo(0);
    expect(z.y).toBeCloseTo(0);
    expect(z.z).toBeCloseTo(1);
  });

  it("computes length", () => {
    const v = new Vec3(3, 4, 0);
    expect(v.length()).toBeCloseTo(5);
  });

  it("normalizes to unit vector", () => {
    const v = new Vec3(0, 0, 5);
    const unit = v.unit();
    expect(unit.length()).toBeCloseTo(1);
    expect(unit.z).toBeCloseTo(1);
  });

  it("negates vector", () => {
    const v = new Vec3(1, -2, 3);
    const neg = v.negated();
    expect(neg.x).toBe(-1);
    expect(neg.y).toBe(2);
    expect(neg.z).toBe(-3);
  });

  it("scales vector", () => {
    const v = new Vec3(2, 3, 4);
    const scaled = v.times(3);
    expect(scaled.x).toBe(6);
    expect(scaled.y).toBe(9);
    expect(scaled.z).toBe(12);
  });

  it("clones vector", () => {
    const v = new Vec3(1, 2, 3);
    const clone = v.clone();
    expect(clone.x).toBe(1);
    expect(clone.y).toBe(2);
    expect(clone.z).toBe(3);
    expect(clone).not.toBe(v);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CSG Primitives
// ═════════════════════════════════════════════════════════════════════════════

describe("CSG primitives", () => {
  it("creates a cube with 6 faces", () => {
    const cube = CSG.cube();
    expect(cube.polygons.length).toBe(6);
  });

  it("creates a cube with custom radius", () => {
    const cube = CSG.cube({ radius: new Vec3(5, 5, 5) });
    expect(cube.polygons.length).toBe(6);
    // Check that vertices span -5..5 on each axis
    const allX = new Set<number>();
    for (const p of cube.polygons) {
      for (const v of p.vertices) allX.add(Math.round(v.pos.x));
    }
    expect(allX.has(-5)).toBe(true);
    expect(allX.has(5)).toBe(true);
  });

  it("creates a sphere with correct polygon count", () => {
    const sphere = CSG.sphere({ slices: 8, stacks: 4 });
    expect(sphere.polygons.length).toBeGreaterThan(0);
    // 8 slices × 4 stacks = 32 polygons
    expect(sphere.polygons.length).toBe(32);
  });

  it("creates a cylinder", () => {
    const cyl = CSG.cylinder({ radius: 2, slices: 8 });
    expect(cyl.polygons.length).toBeGreaterThan(0);
    // 8 slices × 3 (top cap + side + bottom cap) = 24
    expect(cyl.polygons.length).toBe(24);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Boolean Operations
// ═════════════════════════════════════════════════════════════════════════════

describe("CSG boolean operations", () => {
  it("union produces more or equal polygons", () => {
    const a = CSG.cube({ center: new Vec3(0, 0, 0) });
    const b = CSG.cube({ center: new Vec3(1, 0, 0) });
    const result = a.union(b);
    expect(result.polygons.length).toBeGreaterThanOrEqual(6);
  });

  it("subtract produces geometry", () => {
    const a = CSG.cube({ radius: new Vec3(5, 5, 5) });
    const b = CSG.sphere({ radius: 6 });
    const result = a.subtract(b);
    expect(result.polygons.length).toBeGreaterThan(0);
  });

  it("intersect produces geometry", () => {
    const a = CSG.cube({ radius: new Vec3(5, 5, 5) });
    const b = CSG.cube({ center: new Vec3(3, 3, 3), radius: new Vec3(5, 5, 5) });
    const result = a.intersect(b);
    expect(result.polygons.length).toBeGreaterThan(0);
  });

  it("union with empty CSG returns original", () => {
    const cube = CSG.cube();
    const empty = new CSG();
    const result = cube.union(empty);
    expect(result.polygons.length).toBe(6);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Transforms
// ═════════════════════════════════════════════════════════════════════════════

describe("CSG transforms", () => {
  it("identity transform preserves geometry", () => {
    const cube = CSG.cube({ radius: new Vec3(5, 5, 5) });
    const transformed = cube.transform(mat4Identity());
    expect(transformed.polygons.length).toBe(6);
    // Positions should be approximately unchanged
    for (let i = 0; i < cube.polygons.length; i++) {
      for (let j = 0; j < cube.polygons[i].vertices.length; j++) {
        expect(transformed.polygons[i].vertices[j].pos.x).toBeCloseTo(cube.polygons[i].vertices[j].pos.x);
      }
    }
  });

  it("translate moves geometry", () => {
    const cube = CSG.cube({ center: new Vec3(0, 0, 0), radius: new Vec3(1, 1, 1) });
    const translated = cube.transform(mat4Translate(10, 0, 0));
    // Verify polygon count is preserved
    expect(translated.polygons.length).toBe(6);
    // Verify all x positions are shifted by 10
    const allX = new Set<number>();
    for (const p of translated.polygons) {
      for (const v of p.vertices) {
        allX.add(Math.round(v.pos.x));
      }
    }
    expect(allX.has(9)).toBe(true);  // 10 - 1 = 9
    expect(allX.has(11)).toBe(true); // 10 + 1 = 11
  });

  it("scale changes size", () => {
    const cube = CSG.cube({ radius: new Vec3(1, 1, 1) });
    const scaled = cube.transform(mat4Scale(2, 2, 2));
    // Vertices should span -2..2 instead of -1..1
    for (const p of scaled.polygons) {
      for (const v of p.vertices) {
        expect(Math.abs(v.pos.x)).toBeCloseTo(2, 0);
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Matrix Operations
// ═════════════════════════════════════════════════════════════════════════════

describe("Matrix utilities", () => {
  it("identity × identity = identity", () => {
    const id = mat4Identity();
    const result = mat4Multiply(id, id);
    expect(result).toEqual(id);
  });

  it("mat4Translate produces correct matrix", () => {
    const m = mat4Translate(5, 10, 15);
    expect(m[12]).toBe(5);
    expect(m[13]).toBe(10);
    expect(m[14]).toBe(15);
  });
});
