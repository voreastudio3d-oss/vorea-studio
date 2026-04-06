/**
 * Unit tests for the SCAD inline validator.
 */
import { describe, it, expect } from "vitest";
import { validateScad, diagnosticsSummary } from "../scad-validator";

describe("scad-validator", () => {
  it("returns no diagnostics for valid SCAD", () => {
    const source = `
// Bin parameters
bin_width = 42;  // [10:100]
bin_depth = 42;  // [10:100]
bin_height = 50; // [10:200]

module gridfinity_bin(w, d, h) {
  difference() {
    cube([w, d, h]);
    translate([2, 2, 2])
      cube([w - 4, d - 4, h - 2]);
  }
}

gridfinity_bin(bin_width, bin_depth, bin_height);
`;
    const diags = validateScad(source);
    expect(diags).toHaveLength(0);
  });

  it("detects unclosed parenthesis", () => {
    const source = `cube([10, 20, 30);`;
    const diags = validateScad(source);
    const bracketErrors = diags.filter((d) => d.code === "mismatched_bracket" || d.code === "unclosed_bracket");
    expect(bracketErrors.length).toBeGreaterThan(0);
  });

  it("detects unclosed brace", () => {
    const source = `module test() {\n  cube([10]);\n`;
    const diags = validateScad(source);
    const unclosed = diags.filter((d) => d.code === "unclosed_bracket");
    expect(unclosed).toHaveLength(1);
    expect(unclosed[0].message).toContain("{");
  });

  it("detects missing semicolon on assignment", () => {
    const source = `x = 10\ny = 20;`;
    const diags = validateScad(source);
    const missing = diags.filter((d) => d.code === "missing_semicolon");
    expect(missing).toHaveLength(1);
    expect(missing[0].line).toBe(1);
  });

  it("detects missing semicolon on function call", () => {
    const source = `cube([10, 10, 10])`;
    const diags = validateScad(source);
    const missing = diags.filter((d) => d.code === "missing_semicolon");
    expect(missing).toHaveLength(1);
  });

  it("detects unknown module with suggestion", () => {
    const source = `sphera(10);`;
    const diags = validateScad(source);
    const unknown = diags.filter((d) => d.code === "unknown_identifier");
    expect(unknown).toHaveLength(1);
    expect(unknown[0].message).toContain("sphere");
  });

  it("detects empty include path", () => {
    const source = `include <>\ncube([10]);`;
    const diags = validateScad(source);
    const emptyInclude = diags.filter((d) => d.code === "empty_include");
    expect(emptyInclude).toHaveLength(1);
  });

  it("ignores line comments", () => {
    const source = `// this is a comment\ncube([10, 10, 10]);`;
    const diags = validateScad(source);
    expect(diags).toHaveLength(0);
  });

  it("ignores block comments", () => {
    const source = `/* sphera is not real */\ncube([10, 10, 10]);`;
    const diags = validateScad(source);
    expect(diags).toHaveLength(0);
  });

  it("handles user-defined modules without false positives", () => {
    const source = `
module my_widget(size) {
  cube([size, size, size]);
}
my_widget(10);
`;
    const diags = validateScad(source);
    const unknown = diags.filter((d) => d.code === "unknown_identifier");
    expect(unknown).toHaveLength(0);
  });

  it("handles user-defined functions without false positives", () => {
    const source = `
function double(x) = x * 2;
echo(double(5));
`;
    const diags = validateScad(source);
    const unknown = diags.filter((d) => d.code === "unknown_identifier");
    expect(unknown).toHaveLength(0);
  });

  it("diagnosticsSummary counts correctly", () => {
    const source = `sphera(10);\nx = 10\n`;
    const diags = validateScad(source);
    const summary = diagnosticsSummary(diags);
    expect(summary.errors).toBeGreaterThanOrEqual(1);
    expect(summary.warnings).toBeGreaterThanOrEqual(1);
  });

  it("performs well on 500-line file", () => {
    const lines: string[] = [];
    for (let i = 0; i < 500; i++) {
      if (i % 10 === 0) lines.push(`module m${i}() {`);
      else if (i % 10 === 9) lines.push(`}`);
      else lines.push(`  translate([${i}, 0, 0]) cube([${i}]);`);
    }
    const source = lines.join("\n");
    const start = performance.now();
    const diags = validateScad(source);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200); // should be <50ms typically
    expect(diags).toBeDefined();
  });

  it("detects unrecognized garbage text", () => {
    const source = `ME REFIERO A ESTO CODIGO MALO\ncube([10]);`;
    const diags = validateScad(source);
    const garbage = diags.filter((d) => d.code === "unrecognized_line");
    expect(garbage).toHaveLength(1);
    expect(garbage[0].line).toBe(1);
  });

  it("does not flag valid SCAD as unrecognized", () => {
    const source = `
$fn = 32;
width = 30;
difference() {
  cube([10, 10, 10]);
  translate([2, 2, 2])
    sphere(r=3);
}
`;
    const diags = validateScad(source);
    const garbage = diags.filter((d) => d.code === "unrecognized_line");
    expect(garbage).toHaveLength(0);
  });
});
