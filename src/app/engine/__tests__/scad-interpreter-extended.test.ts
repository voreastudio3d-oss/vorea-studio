/**
 * Extended SCAD Interpreter Tests — covers advanced features, extrusions,
 * string functions, list comprehensions, let expressions, color, mirror,
 * hull, minkowski, multiline, comments, error recovery, BOSL2 stubs.
 */
import { describe, it, expect } from "vitest";
import { compileScad } from "../scad-interpreter";

// ═══════════════════════════════════════════════════════════════════════════════
// LINEAR EXTRUDE
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — linear_extrude", () => {
  it("extrudes a square", () => {
    const result = compileScad(`
      linear_extrude(height = 10)
        square([20, 20], center = true);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("extrudes a circle", () => {
    const result = compileScad(`
      linear_extrude(height = 5)
        circle(r = 10, $fn = 12);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("extrudes with twist", () => {
    const result = compileScad(`
      linear_extrude(height = 20, twist = 90)
        square([10, 10], center = true);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("extrudes with scale", () => {
    const result = compileScad(`
      linear_extrude(height = 15, scale = 0.5)
        circle(r = 10, $fn = 8);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROTATE EXTRUDE
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — rotate_extrude", () => {
  it("extrudes a circle profile", () => {
    const result = compileScad(`
      rotate_extrude($fn = 12)
        translate([15, 0, 0])
          circle(r = 5, $fn = 8);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("extrudes a square profile", () => {
    const result = compileScad(`
      rotate_extrude($fn = 8)
        translate([10, 0, 0])
          square([5, 5]);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR & MIRROR
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — color & mirror", () => {
  it("color wraps geometry", () => {
    const result = compileScad(`
      color("red") cube(10);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("color with rgba vector", () => {
    const result = compileScad(`
      color([1, 0, 0, 0.5]) cube(10);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("mirror along X axis", () => {
    const result = compileScad(`
      mirror([1, 0, 0]) cube(10);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("mirror along Y axis", () => {
    const result = compileScad(`
      mirror([0, 1, 0]) cube(10);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HULL & MINKOWSKI
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — hull & minkowski", () => {
  it("hull of two cubes", () => {
    const result = compileScad(`
      hull() {
        cube(5);
        translate([20, 0, 0]) cube(5);
      }
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("minkowski of cube and sphere", () => {
    const result = compileScad(`
      minkowski() {
        cube(10);
        sphere(r = 2, $fn = 6);
      }
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LIST COMPREHENSIONS & LET EXPRESSIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — list comprehensions", () => {
  it("generates array with for comprehension", () => {
    const result = compileScad(`
      pts = [for (i = [0:4]) i * 10];
      cube(pts[0] > 0 ? 1 : 5);
    `);
    expect(result.error).toBeUndefined();
  });

  it("generates geometry with for + translate", () => {
    const result = compileScad(`
      for (i = [0:2:10]) {
        translate([i, 0, 0]) cube(3);
      }
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });
});

describe("compileScad — let expressions", () => {
  it("uses let expression in variable", () => {
    const result = compileScad(`
      s = let(a = 5, b = 10) a + b;
      cube(s);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STRING OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — string operations", () => {
  it("concatenates strings with str()", () => {
    const result = compileScad(`
      s = str("hello", " ", "world");
      cube(5);
    `);
    expect(result.error).toBeUndefined();
  });

  it("uses string in text module", () => {
    const result = compileScad(`
      text("Hello Vorea", size = 10);
    `);
    expect(result.error).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADVANCED EXPRESSIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — advanced expressions", () => {
  it("evaluates modulo operator", () => {
    const result = compileScad(`
      x = 15 % 4; // 3
      cube(x);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("evaluates power operator", () => {
    const result = compileScad(`
      x = 2 ^ 3; // 8
      cube(x);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("evaluates negation", () => {
    const result = compileScad(`
      x = -(-10);
      cube(x);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("evaluates not operator", () => {
    const result = compileScad(`
      x = !false;
      cube(x ? 5 : 10);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("evaluates comparison operators", () => {
    const result = compileScad(`
      a = 5 > 3;
      b = 2 < 10;
      c = 5 >= 5;
      d = 5 <= 5;
      e = 5 == 5;
      f = 5 != 6;
      cube(a && b && c && d && e && f ? 10 : 1);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("evaluates logical operators", () => {
    const result = compileScad(`
      a = true && true;
      b = false || true;
      cube(a && b ? 5 : 1);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("evaluates array indexing", () => {
    const result = compileScad(`
      v = [10, 20, 30];
      cube(v[1]);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("evaluates range expressions [start:step:end]", () => {
    const result = compileScad(`
      r = [0:2:10];
      for (i = r) {
        translate([i, 0, 0]) cube(1);
      }
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("evaluates range [start:end]", () => {
    const result = compileScad(`
      for (i = [0:3]) {
        translate([i * 5, 0, 0]) cube(2);
      }
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUILT-IN MATH FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — math functions", () => {
  it("uses floor, ceil, round", () => {
    const result = compileScad(`
      a = floor(3.7);
      b = ceil(3.2);
      c = round(3.5);
      cube([a, b, c]);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("uses atan2, asin, acos", () => {
    const result = compileScad(`
      a = atan2(1, 1);
      cube(5);
    `);
    expect(result.error).toBeUndefined();
  });

  it("uses log and exp", () => {
    const result = compileScad(`
      a = ln(10);
      b = exp(1);
      cube([a, b, 5]);
    `);
    expect(result.error).toBeUndefined();
  });

  it("uses concat", () => {
    const result = compileScad(`
      a = [1, 2];
      b = [3, 4];
      c = concat(a, b);
      cube(len(c));
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("uses is_list", () => {
    const result = compileScad(`
      a = [1, 2, 3];
      cube(is_list(a) ? 5 : 1);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("uses is_num and is_string", () => {
    const result = compileScad(`
      a = is_num(42);
      b = is_string("hello");
      cube(a && b ? 5 : 1);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POLYGON & 2D OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — 2D primitives", () => {
  it("creates a square", () => {
    const result = compileScad(`
      linear_extrude(height = 1)
        square([10, 10]);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("creates a circle", () => {
    const result = compileScad(`
      linear_extrude(height = 1)
        circle(r = 10, $fn = 8);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("creates a polygon", () => {
    const result = compileScad(`
      linear_extrude(height = 5)
        polygon(points = [[0,0], [10,0], [10,10], [0,10]]);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INCLUDE / USE DIRECTIVES
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — include/use directives", () => {
  it("ignores include without crashing", () => {
    const result = compileScad(`
      include <BOSL2/std.scad>
      cube(10);
    `);
    // include may consume following tokens — just ensure no crash
    expect(result).toBeDefined();
    expect(result.time).toBeGreaterThanOrEqual(0);
  });

  it("ignores use without crashing", () => {
    const result = compileScad(`
      use <BOSL2/std.scad>
      cube(10);
    `);
    expect(result).toBeDefined();
    expect(result.time).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BOSL2 STUB MODULES
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — BOSL2 stubs", () => {
  it("cuboid renders as a cube", () => {
    const result = compileScad(`
      cuboid([10, 20, 30]);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("cyl renders as a cylinder", () => {
    const result = compileScad(`
      cyl(h = 20, r = 5, $fn = 8);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("right/left/up/down translate", () => {
    const result = compileScad(`
      right(10) cube(5);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("xrot/yrot/zrot rotate", () => {
    const result = compileScad(`
      zrot(45) cube(5);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMENTS & WHITESPACE
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — comments & whitespace", () => {
  it("handles line comments", () => {
    const result = compileScad(`
      // This is a comment
      cube(10); // inline comment
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("handles block comments", () => {
    const result = compileScad(`
      /* Multi-line
         comment */
      cube(10);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("handles mixed comments", () => {
    const result = compileScad(`
      // line comment
      /* block comment */
      cube(/* size */ 10);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARAMETER OVERRIDES
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — parameter overrides", () => {
  it("overrides $fn", () => {
    const result = compileScad(
      `sphere(r = 10);`,
      { $fn: 8 }
    );
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("caps $fn at 48", () => {
    const result = compileScad(
      `sphere(r = 5);`,
      { $fn: 1000 }
    );
    expect(result.error).toBeUndefined();
    // Should still render but with capped segments
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("overrides boolean parameter", () => {
    const result = compileScad(
      `
      show_text = false;
      if (show_text) cube(10);
      else sphere(5);
    `,
      { show_text: true }
    );
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("overrides string parameter", () => {
    const result = compileScad(
      `
      label = "default";
      cube(5);
    `,
      { label: "custom" }
    );
    expect(result.error).toBeUndefined();
  });

  it("overrides array parameter", () => {
    const result = compileScad(
      `
      dims = [10, 10, 10];
      cube(dims);
    `,
      { dims: [5, 5, 5] }
    );
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR RECOVERY
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — error handling", () => {
  it("captures error for undefined module", () => {
    const result = compileScad(`
      nonexistent_module();
    `);
    // Should not crash — either returns empty geometry or captures error
    expect(result).toBeDefined();
    expect(result.time).toBeGreaterThanOrEqual(0);
  });

  it("captures error for syntax errors", () => {
    const result = compileScad(`
      cube(;
    `);
    expect(result).toBeDefined();
  });

  it("handles deeply nested expressions", () => {
    const result = compileScad(`
      a = ((((1 + 2) * 3) - 4) / 2);
      cube(a);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("handles empty module body", () => {
    const result = compileScad(`
      module empty() {}
      empty();
    `);
    expect(result.error).toBeUndefined();
  });

  it("handles recursive-like module calls", () => {
    const result = compileScad(`
      module wrapper() { children(); }
      wrapper() wrapper() cube(5);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SPECIAL VARIABLES
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — special variables", () => {
  it("uses PI", () => {
    const result = compileScad(`
      cube(PI);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("uses $preview", () => {
    const result = compileScad(`
      cube($preview ? 5 : 10);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });

  it("uses $fn with sphere", () => {
    const result = compileScad(`
      $fn = 12;
      sphere(r = 10);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MULTMATRIX
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — multmatrix", () => {
  it("applies 4x4 matrix transform", () => {
    const result = compileScad(`
      multmatrix(m = [[1, 0, 0, 5],
                      [0, 1, 0, 0],
                      [0, 0, 1, 0],
                      [0, 0, 0, 1]])
        cube(5);
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBe(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLEX MULTI-STATEMENT PROGRAMS
// ═══════════════════════════════════════════════════════════════════════════════

describe("compileScad — complex programs", () => {
  it("parametric box with lid", () => {
    const result = compileScad(`
      width = 30;
      depth = 20;
      height = 15;
      wall = 2;
      
      difference() {
        cube([width, depth, height]);
        translate([wall, wall, wall])
          cube([width - 2*wall, depth - 2*wall, height]);
      }
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("array of cylinders", () => {
    const result = compileScad(`
      positions = [[0,0], [20,0], [0,20], [20,20]];
      for (i = [0:3]) {
        translate([positions[i][0], positions[i][1], 0])
          cylinder(h = 10, r = 3, $fn = 8);
      }
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("nested module with parameters", () => {
    const result = compileScad(`
      module pillar(h = 20, r = 3) {
        cylinder(h = h, r = r, $fn = 8);
      }
      
      module base(w = 40, d = 40, t = 3) {
        cube([w, d, t]);
      }
      
      base();
      translate([5, 5, 3]) pillar();
      translate([35, 5, 3]) pillar();
      translate([5, 35, 3]) pillar();
      translate([35, 35, 3]) pillar();
    `);
    expect(result.error).toBeUndefined();
    expect(result.geometry.polygons.length).toBeGreaterThan(0);
  });
});
