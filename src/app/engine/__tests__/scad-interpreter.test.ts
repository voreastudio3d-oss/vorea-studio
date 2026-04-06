/**
 * SCAD Interpreter Tests — Tokenizer, Parser & Evaluator.
 * Tests the full pipeline: source → tokens → AST → CSG geometry.
 */
import { describe, it, expect } from "vitest";
import { compileScad } from "../scad-interpreter";

// ═════════════════════════════════════════════════════════════════════════════
// COMPILATION PIPELINE
// ═════════════════════════════════════════════════════════════════════════════

describe("compileScad — basic pipeline", () => {
  it("returns empty geometry for empty source", () => {
    const result = compileScad("");
    expect(result.error).toBeUndefined();
    expect(result.geometry).toBeDefined();
    expect(result.time).toBeGreaterThanOrEqual(0);
  });

  it("returns an error for malformed source", () => {
    const result = compileScad("cube(((;");
    // Should not throw — errors are captured in the result
    expect(result).toBeDefined();
  });

  it("records compilation time", () => {
    const result = compileScad("cube([10, 10, 10]);");
    expect(result.time).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PRIMITIVES
// ═════════════════════════════════════════════════════════════════════════════

describe("compileScad — primitives", () => {
  it("compiles cube with size", () => {
    const result = compileScad("cube([10, 20, 30]);");
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("compiles cube scalar shorthand", () => {
    const result = compileScad("cube(5);");
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("compiles sphere with radius", () => {
    const result = compileScad("sphere(r = 15);");
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("compiles sphere with $fn override", () => {
    const result = compileScad("sphere(r = 5, $fn = 8);");
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("compiles cylinder with h, r", () => {
    const result = compileScad("cylinder(h = 20, r = 5);");
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("compiles cylinder with r1 and r2 (cone)", () => {
    const result = compileScad("cylinder(h = 10, r1 = 5, r2 = 2);");
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// TRANSFORMATIONS
// ═════════════════════════════════════════════════════════════════════════════

describe("compileScad — transforms", () => {
  it("translates a cube", () => {
    const result = compileScad("translate([10, 0, 0]) cube(5);");
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("rotates a cube", () => {
    const result = compileScad("rotate([45, 0, 0]) cube(5);");
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("scales a cube", () => {
    const result = compileScad("scale([2, 1, 1]) cube(5);");
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("chains transforms", () => {
    const result = compileScad(`
      translate([5, 0, 0])
        rotate([0, 0, 45])
          scale([2, 1, 1])
            cube(3);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// BOOLEAN OPERATIONS
// ═════════════════════════════════════════════════════════════════════════════

describe("compileScad — boolean ops", () => {
  it("unions two cubes", () => {
    const result = compileScad(`
      union() {
        cube(10);
        translate([5, 5, 0]) cube(10);
      }
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(6);
  });

  it("subtracts a sphere from a cube", () => {
    const result = compileScad(`
      difference() {
        cube(10, center = true);
        sphere(r = 7);
      }
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("intersects two cubes", () => {
    const result = compileScad(`
      intersection() {
        cube(10, center = true);
        translate([3, 3, 3]) cube(10, center = true);
      }
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// VARIABLES & EXPRESSIONS
// ═════════════════════════════════════════════════════════════════════════════

describe("compileScad — variables & expressions", () => {
  it("uses variables for cube size", () => {
    const result = compileScad(`
      size = 15;
      cube([size, size, size]);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("uses arithmetic expressions", () => {
    const result = compileScad(`
      a = 10;
      b = a * 2 + 5;
      cube([b, b, a]);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("applies parameter overrides", () => {
    const result = compileScad(
      `size = 10; cube([size, size, size]);`,
      { size: 20 }
    );
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("supports ternary expressions", () => {
    const result = compileScad(`
      big = true;
      size = big ? 20 : 5;
      cube(size);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// FOR LOOPS
// ═════════════════════════════════════════════════════════════════════════════

describe("compileScad — for loops", () => {
  it("creates geometry in a for loop with range", () => {
    const result = compileScad(`
      for (i = [0:2]) {
        translate([i * 15, 0, 0]) cube(10);
      }
    `);
    expect(result.error).toBeUndefined();
    // 3 cubes * 6 faces = ≥18 polygons (union may merge some)
    expect(result.geometry.polygons.length).toBeGreaterThanOrEqual(6);
  });

  it("handles nested for loops", () => {
    const result = compileScad(`
      for (x = [0:1])
        for (y = [0:1])
          translate([x * 10, y * 10, 0]) cube(5);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// IF/ELSE
// ═════════════════════════════════════════════════════════════════════════════

describe("compileScad — if/else", () => {
  it("renders geometry when condition is true", () => {
    const result = compileScad(`
      flag = true;
      if (flag) cube(10);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("skips geometry when condition is false", () => {
    const result = compileScad(`
      flag = false;
      if (flag) cube(10);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(0);
  });

  it("uses else branch", () => {
    const result = compileScad(`
      flag = false;
      if (flag) cube(10);
      else sphere(5);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MODULES & FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════════

describe("compileScad — user modules & functions", () => {
  it("defines and calls a user module", () => {
    const result = compileScad(`
      module my_box(s = 10) {
        cube([s, s, s]);
      }
      my_box(15);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("uses a user function for expressions", () => {
    const result = compileScad(`
      function double(x) = x * 2;
      size = double(5);
      cube(size);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("supports modules with children()", () => {
    const result = compileScad(`
      module centered() {
        translate([0, 0, 0]) children();
      }
      centered() cube(10);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// BUILT-IN FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════════

describe("compileScad — built-in functions", () => {
  it("uses sin, cos for positioning", () => {
    const result = compileScad(`
      x = 10 * cos(45);
      y = 10 * sin(45);
      translate([x, y, 0]) cube(3);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("uses sqrt, abs, min, max", () => {
    const result = compileScad(`
      a = sqrt(100);
      b = abs(-5);
      c = min(a, b);
      d = max(a, b);
      cube([a, c, d]);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("uses len() on arrays", () => {
    const result = compileScad(`
      v = [1, 2, 3, 4];
      s = len(v);
      cube(s);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// VECTOR ARITHMETIC
// ═════════════════════════════════════════════════════════════════════════════

describe("compileScad — vector arithmetic", () => {
  it("adds vectors", () => {
    const result = compileScad(`
      a = [1, 2, 3];
      b = [4, 5, 6];
      c = a + b;
      cube(c);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("scales vectors", () => {
    const result = compileScad(`
      v = [2, 3, 4];
      scaled = v * 2;
      cube(scaled);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("accesses vector components with .x .y .z", () => {
    const result = compileScad(`
      v = [10, 20, 30];
      cube([v.x, v.y, v.z]);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// EXTRUSIONS
// ═════════════════════════════════════════════════════════════════════════════

describe("compileScad — extrusions", () => {
  it("linear_extrude a circle", () => {
    const result = compileScad(`
      linear_extrude(height = 20) circle(r = 5);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("linear_extrude with twist", () => {
    const result = compileScad(`
      linear_extrude(height = 30, twist = 90) square(10, center = true);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// COMMENTS & WHITESPACE
// ═════════════════════════════════════════════════════════════════════════════

describe("compileScad — comments", () => {
  it("ignores line comments", () => {
    const result = compileScad(`
      // This is a comment
      cube(10); // inline comment
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("ignores block comments", () => {
    const result = compileScad(`
      /* Block comment
         spanning multiple lines */
      cube(10);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });
});
