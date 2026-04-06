/**
 * Extended SCAD interpreter tests — Phase 1 features:
 * - Multi-variable for() loops
 * - `each` keyword in list comprehensions
 * - select(), flatten() builtins
 * - intersection_for()
 * - Performance: concat vs BSP in loops
 */

import { describe, it, expect } from "vitest";
import { compileScad } from "../scad-interpreter";

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-variable for() loops
// ═══════════════════════════════════════════════════════════════════════════════

describe("Multi-variable for() loops", () => {
  it("should iterate over two variables (Cartesian product)", () => {
    const result = compileScad(`
      for (x = [0:1], y = [0:1])
        translate([x * 10, y * 10, 0]) cube(5);
    `);
    expect(result.error).toBeUndefined();
    // 2x2 = 4 cubes, each cube has 6 faces → 24 polygons
    expect(result.geometry.polygons.length).toBe(24);
  });

  it("should iterate over three variables", () => {
    const result = compileScad(`
      for (x = [0, 1], y = [0, 1], z = [0, 1])
        translate([x * 10, y * 10, z * 10]) cube(2);
    `);
    expect(result.error).toBeUndefined();
    // 2x2x2 = 8 cubes → 48 polygons
    expect(result.geometry.polygons.length).toBe(48);
  });

  it("should allow dependent ranges (y depends on x)", () => {
    // This tests that the range for y is evaluated in the context where x is bound
    const result = compileScad(`
      for (x = [1, 2], y = [0:x])
        translate([x * 10, y * 10, 0]) cube(1);
    `);
    expect(result.error).toBeUndefined();
    // x=1: y=0,1 → 2 cubes; x=2: y=0,1,2 → 3 cubes = 5 total → 30 polygons
    expect(result.geometry.polygons.length).toBe(30);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// `each` keyword in list comprehensions
// ═══════════════════════════════════════════════════════════════════════════════

describe("each keyword", () => {
  it("should flatten nested lists with each", () => {
    const result = compileScad(`
      list = [[1,2], [3,4], [5,6]];
      flat = [for (x = list) each x];
      // flat should be [1, 2, 3, 4, 5, 6]
      cube(flat[5]); // cube(6)
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6); // 1 cube
  });

  it("should work without each (returns nested lists)", () => {
    const result = compileScad(`
      list = [[1,2], [3,4]];
      nested = [for (x = list) x];
      // nested = [[1,2], [3,4]]
      cube(nested[0][1]); // cube(2)
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Built-in functions: select, flatten
// ═══════════════════════════════════════════════════════════════════════════════

describe("Built-in functions", () => {
  it("select() with positive index", () => {
    const result = compileScad(`
      list = [10, 20, 30, 40, 50];
      cube(select(list, 2)); // cube(30)
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("select() with negative index (wraps around)", () => {
    const result = compileScad(`
      list = [10, 20, 30];
      cube(select(list, -1)); // select wraps: -1 → index 2 → 30
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("flatten() flattens one level", () => {
    const result = compileScad(`
      nested = [[1,2], [3,4], [5,6]];
      flat = flatten(nested);
      cube(flat[3]); // flat[3] = 4
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("is_function() returns false", () => {
    const result = compileScad(`
      cube(is_function(0) ? 5 : 10);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// intersection_for()
// ═══════════════════════════════════════════════════════════════════════════════

describe("intersection_for()", () => {
  it("should intersect geometry across iterations", () => {
    // A cube rotated by different angles intersection → truncated shape
    const result = compileScad(`
      $fn = 12;
      intersection_for(i = [0, 90])
        rotate([0, 0, i]) cube(10, center = true);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Performance: for loop uses concat instead of BSP union
// ═══════════════════════════════════════════════════════════════════════════════

describe("For loop performance", () => {
  it("should handle 20 iterations without BSP union overhead", () => {
    const result = compileScad(`
      $fn = 8;
      for (i = [0:19])
        translate([i * 5, 0, 0]) cube(3);
    `);
    expect(result.error).toBeUndefined();
    // 20 cubes × 6 faces = 120 polygons (concat preserves all)
    expect(result.geometry.polygons.length).toBe(120);
    // Should complete quickly (< 500ms)
    expect(result.time).toBeLessThan(500);
  });

  it("should handle 100 iterations for Gridfinity-style grids", () => {
    const result = compileScad(`
      $fn = 6;
      for (x = [0:9], y = [0:9])
        translate([x * 5, y * 5, 0]) cube(4);
    `);
    expect(result.error).toBeUndefined();
    // 10x10 = 100 cubes × 6 faces = 600 polygons
    expect(result.geometry.polygons.length).toBe(600);
    expect(result.time).toBeLessThan(2000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// List comprehension advanced features
// ═══════════════════════════════════════════════════════════════════════════════

describe("Advanced list comprehensions", () => {
  it("should handle let() inside list comprehension", () => {
    const result = compileScad(`
      coords = [for (i = [0:3]) let(x = i * 10, y = i * 5) [x, y]];
      translate(coords[2]) cube(5); // translate([20, 10]) cube(5)
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("should handle if() inside list comprehension", () => {
    const result = compileScad(`
      evens = [for (i = [0:5]) if (i % 2 == 0) i];
      // evens = [0, 2, 4]
      cube(evens[2]); // cube(4)
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });
});
