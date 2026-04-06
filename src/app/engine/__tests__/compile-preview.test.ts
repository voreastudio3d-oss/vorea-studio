import { describe, expect, it } from "vitest";
import { estimateCompilePreview } from "../compile-preview";

describe("compile preview estimator", () => {
  it("assigns higher score to final profile for same SCAD", () => {
    const scad = `
      quality_level = 0;
      $fn = quality_level == 1 ? 72 : 24;
      difference() {
        cube([40, 30, 20]);
        translate([2,2,2]) cube([36, 26, 18]);
      }
    `;

    const draft = estimateCompilePreview(scad, "draft");
    const final = estimateCompilePreview(scad, "final");

    expect(final.score).toBeGreaterThan(draft.score);
    expect(final.estimatedMs).toBeGreaterThan(draft.estimatedMs);
  });

  it("emits loop warning for very iterative SCAD", () => {
    const manyLoops = `${"for(i=[0:10]) cube([1,1,1]);\n".repeat(13)}cube([1,1,1]);`;
    const result = estimateCompilePreview(manyLoops, "final");

    expect(result.metrics.loops).toBeGreaterThan(12);
    expect(result.warnings.some((item) => item.includes("bucles"))).toBe(true);
  });
});
