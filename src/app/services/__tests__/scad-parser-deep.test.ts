/**
 * Deep tests for scad-parser.ts — all branches of parseScad and regenerateScad.
 */
import { describe, it, expect } from "vitest";
import { parseScad, regenerateScad } from "../scad-parser";

describe("parseScad", () => {
  describe("basic variable declarations", () => {
    it("parses a simple number", () => {
      const res = parseScad("width = 50;");
      expect(res.params).toHaveLength(1);
      expect(res.params[0].name).toBe("width");
      expect(res.params[0].type).toBe("number");
      expect(res.params[0].value).toBe(50);
    });

    it("parses negative number", () => {
      const res = parseScad("offset = -10;");
      expect(res.params).toHaveLength(1);
      expect(res.params[0].value).toBe(-10);
    });

    it("parses float number", () => {
      const res = parseScad("radius = 3.14;");
      expect(res.params[0].value).toBeCloseTo(3.14);
    });

    it("parses boolean true", () => {
      const res = parseScad("rounded = true;");
      expect(res.params[0].type).toBe("bool");
      expect(res.params[0].value).toBe(true);
    });

    it("parses boolean false", () => {
      const res = parseScad("flat = false;");
      expect(res.params[0].type).toBe("bool");
      expect(res.params[0].value).toBe(false);
    });

    it("parses string literal", () => {
      const res = parseScad('label = "Hello World";');
      expect(res.params[0].type).toBe("string");
      expect(res.params[0].value).toBe("Hello World");
    });

    it("parses array of numbers", () => {
      const res = parseScad("dims = [10, 20, 30];");
      expect(res.params[0].type).toBe("array");
      expect(res.params[0].value).toEqual([10, 20, 30]);
    });

    it("parses empty array", () => {
      const res = parseScad("empty = [];");
      expect(res.params[0].value).toEqual([]);
    });

    it("skips calculated expressions", () => {
      const res = parseScad("total = width + height;");
      expect(res.params).toHaveLength(0);
    });

    it("skips function calls", () => {
      const res = parseScad("r = max(5, 10);");
      expect(res.params).toHaveLength(0);
    });

    it("skips lines without assignment", () => {
      const res = parseScad("cube([10, 10, 10]);");
      expect(res.params).toHaveLength(0);
    });
  });

  describe("special OpenSCAD variables", () => {
    it("detects $fn as special", () => {
      const res = parseScad("$fn = 32;");
      expect(res.params[0].type).toBe("special");
      expect(res.params[0].name).toBe("$fn");
    });

    it("detects $fa as special", () => {
      const res = parseScad("$fa = 12;");
      expect(res.params[0].type).toBe("special");
    });

    it("detects $fs as special", () => {
      const res = parseScad("$fs = 2;");
      expect(res.params[0].type).toBe("special");
    });
  });

  describe("range annotations", () => {
    it("parses [min:max] range", () => {
      const res = parseScad("width = 50; // [1:100]");
      expect(res.params[0].range).toBeDefined();
      expect(res.params[0].range!.min).toBe(1);
      expect(res.params[0].range!.max).toBe(100);
      expect(res.params[0].range!.step).toBe(1);
    });

    it("parses [min:step:max] range", () => {
      const res = parseScad("height = 20; // [5:5:100]");
      expect(res.params[0].range).toBeDefined();
      expect(res.params[0].range!.min).toBe(5);
      expect(res.params[0].range!.step).toBe(5);
      expect(res.params[0].range!.max).toBe(100);
    });

    it("parses range with float step", () => {
      const res = parseScad("thickness = 1.5; // [0.5:0.1:3.0]");
      expect(res.params[0].range!.step).toBeCloseTo(0.1);
    });

    it("strips range annotation from comment", () => {
      const res = parseScad("width = 50; // [1:100] base width");
      expect(res.params[0].comment).toBe("base width");
    });

    it("auto-generates range for unannounced numbers", () => {
      const res = parseScad("width = 50;");
      expect(res.params[0].range).toBeDefined();
      expect(res.params[0].range!.min).toBeGreaterThanOrEqual(0);
      expect(res.params[0].range!.max).toBeGreaterThan(50);
    });

    it("auto-generates range for zero", () => {
      const res = parseScad("offset = 0;");
      expect(res.params[0].range).toBeDefined();
      expect(res.params[0].range!.min).toBe(-100);
      expect(res.params[0].range!.max).toBe(100);
    });

    it("auto-generates range for small values < 1", () => {
      const res = parseScad("opacity = 0.5;");
      expect(res.params[0].range).toBeDefined();
      expect(res.params[0].range!.min).toBe(0);
      expect(res.params[0].range!.max).toBe(1);
    });

    it("auto-generates range for negative values", () => {
      const res = parseScad("offset = -25;");
      expect(res.params[0].range).toBeDefined();
      expect(res.params[0].range!.min).toBeLessThan(0);
    });
  });

  describe("choice annotations", () => {
    it("parses labeled numeric choices", () => {
      const res = parseScad("size = 10; // [10:Small, 20:Medium, 30:Large]");
      expect(res.params[0].choices).toBeDefined();
      expect(res.params[0].choices).toHaveLength(3);
      expect(res.params[0].choices![0]).toEqual({ value: 10, label: "Small" });
    });

    it("parses unlabeled string choices", () => {
      const res = parseScad('color = "red"; // [red, green, blue]');
      expect(res.params[0].choices).toBeDefined();
      expect(res.params[0].choices).toHaveLength(3);
    });

    it("parses numeric array choices", () => {
      const res = parseScad("n = 1; // [0, 1, 2, 3]");
      expect(res.params[0].choices).toBeDefined();
      expect(res.params[0].choices).toHaveLength(4);
    });

    it("strips choices annotation from comment", () => {
      const res = parseScad("size = 10; // [10:Small, 20:Medium] pick a size");
      expect(res.params[0].comment).toBe("pick a size");
    });
  });

  describe("section headers", () => {
    it("extracts section from preceding comment", () => {
      const res = parseScad(`// Dimensions
width = 50;
height = 30;`);
      expect(res.params[0].section).toBe("Dimensions");
      expect(res.params[1].section).toBe("Dimensions");
      expect(res.sections).toContain("Dimensions");
    });

    it("tracks multiple sections", () => {
      const res = parseScad(`// Size
width = 50;
// Style
rounded = true;`);
      expect(res.sections).toHaveLength(2);
      expect(res.params[0].section).toBe("Size");
      expect(res.params[1].section).toBe("Style");
    });

    it("ignores very short comments as sections", () => {
      const res = parseScad(`// x
width = 50;`);
      expect(res.params[0].section).toBeUndefined();
    });
  });

  describe("inline comments", () => {
    it("captures inline comment as description", () => {
      const res = parseScad('width = 50; // base width in mm');
      expect(res.params[0].comment).toBe("base width in mm");
    });

    it("no comment when none present", () => {
      const res = parseScad("width = 50;");
      expect(res.params[0].comment).toBeUndefined();
    });
  });

  describe("line numbers", () => {
    it("tracks 1-based line numbers", () => {
      const res = parseScad(`
width = 10;

height = 20;`);
      expect(res.params[0].line).toBe(2);
      expect(res.params[1].line).toBe(4);
    });
  });

  describe("empty and edge cases", () => {
    it("returns empty for empty source", () => {
      const res = parseScad("");
      expect(res.params).toEqual([]);
      expect(res.sections).toEqual([]);
    });

    it("preserves original source", () => {
      const src = "width = 10;\nheight = 20;";
      const res = parseScad(src);
      expect(res.source).toBe(src);
    });

    it("handles multiple params", () => {
      const res = parseScad(`$fn = 32;
width = 30; // [10:5:100]
height = 20; // [5:5:80]
rounded = true; // use rounded corners
label = "test";
dims = [10, 20];`);
      expect(res.params).toHaveLength(6);
    });
  });
});

describe("regenerateScad", () => {
  it("updates a number value", () => {
    const result = regenerateScad("width = 50;", { width: 100 });
    expect(result).toContain("width = 100;");
  });

  it("updates a boolean value", () => {
    const result = regenerateScad("rounded = true;", { rounded: false });
    expect(result).toContain("rounded = false;");
  });

  it("updates a string value", () => {
    const result = regenerateScad('label = "old";', { label: "new" });
    expect(result).toContain('label = "new"');
  });

  it("updates an array value", () => {
    const result = regenerateScad("dims = [10, 20];", { dims: [30, 40, 50] });
    expect(result).toContain("dims = [30,40,50];");
  });

  it("preserves trailing comment", () => {
    const result = regenerateScad("width = 50; // base width", { width: 75 });
    expect(result).toContain("// base width");
    expect(result).toContain("75");
  });

  it("preserves indentation", () => {
    const result = regenerateScad("  width = 50;", { width: 75 });
    expect(result.startsWith("  ")).toBe(true);
  });

  it("leaves unchanged vars intact", () => {
    const source = "width = 50;\nheight = 30;";
    const result = regenerateScad(source, { width: 100 });
    expect(result).toContain("width = 100;");
    expect(result).toContain("height = 30;");
  });

  it("handles non-declaration lines", () => {
    const source = "cube([10,10,10]);\nwidth = 50;";
    const result = regenerateScad(source, { width: 100 });
    expect(result).toContain("cube([10,10,10]);");
  });
});
