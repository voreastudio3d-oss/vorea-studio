/**
 * Complexity Estimator Tests.
 */
import { describe, it, expect } from "vitest";
import { estimateComplexity, complexityColor } from "../complexity";

describe("estimateComplexity", () => {
  it("rates empty source as light", () => {
    const result = estimateComplexity("");
    expect(result.level).toBe("light");
    expect(result.score).toBe(0);
    expect(result.autoRecompileRecommended).toBe(true);
  });

  it("rates a single cube as light", () => {
    const result = estimateComplexity("cube(10);");
    expect(result.level).toBe("light");
    expect(result.details.primitives).toBe(1);
    expect(result.autoRecompileRecommended).toBe(true);
  });

  it("rates built-in templates as light", () => {
    const src = `
      // Simple rounded box
      $fn = 32;
      difference() {
        hull() {
          translate([2, 2, 0]) cylinder(r = 2, h = 10);
          translate([28, 2, 0]) cylinder(r = 2, h = 10);
          translate([2, 18, 0]) cylinder(r = 2, h = 10);
          translate([28, 18, 0]) cylinder(r = 2, h = 10);
        }
        translate([1, 1, 1]) cube([28, 18, 10]);
      }
    `;
    const result = estimateComplexity(src);
    expect(result.level === "light" || result.level === "medium").toBe(true);
    expect(result.score).toBeLessThan(70);
  });

  it("rates complex models with many loops as heavy", () => {
    const src = `
      $fn = 128;
      for (i = [0:100]) {
        for (j = [0:100]) {
          translate([i * 2, j * 2, 0])
            difference() {
              hull() {
                sphere(r = 1);
                translate([1, 1, 1]) sphere(r = 0.5);
              }
              minkowski() {
                cube(0.5);
                sphere(0.2);
              }
            }
        }
      }
    `;
    const result = estimateComplexity(src);
    expect(result.level).toBe("heavy");
    expect(result.autoRecompileRecommended).toBe(false);
    expect(result.warning).toBeDefined();
  });

  it("counts primitives correctly", () => {
    const src = `
      cube(10);
      sphere(r = 5);
      cylinder(h = 20, r = 3);
      cube(5);
    `;
    const result = estimateComplexity(src);
    expect(result.details.primitives).toBe(4);
  });

  it("detects $fn from source code", () => {
    const result = estimateComplexity("$fn = 96; sphere(10);");
    expect(result.details.fnValue).toBe(96);
  });

  it("uses $fn from param overrides", () => {
    const result = estimateComplexity("sphere(10);", { $fn: 128 });
    expect(result.details.fnValue).toBe(128);
  });

  it("returns estimated time in ms", () => {
    const result = estimateComplexity("cube(10);");
    expect(result.estimatedMs).toBeGreaterThan(0);
    expect(typeof result.estimatedMs).toBe("number");
  });
});

describe("complexityColor", () => {
  it("returns green for light", () => {
    expect(complexityColor("light")).toBe("#22c55e");
  });

  it("returns amber for medium", () => {
    expect(complexityColor("medium")).toBe("#f59e0b");
  });

  it("returns red for heavy", () => {
    expect(complexityColor("heavy")).toBe("#ef4444");
  });
});
