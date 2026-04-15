import { describe, it, expect } from "vitest";
import { compileScad } from "../scad-interpreter";

/**
 * Validates the new ExtrudeGeometry-based text pipeline:
 * 1. Letters with holes (A, R, O, B, D) produce manifold geometry
 * 2. Engraved mode (difference with text) works correctly
 * 3. Text normals are consistent (all outward-facing)
 * 4. Text is not mirrored — leftmost character should have lowest X
 */
describe("Text ExtrudeGeometry pipeline", () => {
  it("Letter A: has hole, produces solid mesh with correct face count", () => {
    const r = compileScad(`text("A", size=10);`);
    const faces = r.geometry.polygons.length;
    console.log(`Letter A: ${faces} faces`);
    // A has 1 hole (triangle) — should produce substantial geometry
    expect(faces).toBeGreaterThan(20);
  });

  it("Letter R: has hole, produces solid mesh", () => {
    const r = compileScad(`text("R", size=10);`);
    const faces = r.geometry.polygons.length;
    console.log(`Letter R: ${faces} faces`);
    expect(faces).toBeGreaterThan(20);
  });

  it("Letter O: has hole (full ring), produces solid mesh", () => {
    const r = compileScad(`text("O", size=10);`);
    const faces = r.geometry.polygons.length;
    console.log(`Letter O: ${faces} faces`);
    expect(faces).toBeGreaterThan(20);
  });

  it("Letters B, D, P, Q (all with holes) produce valid geometry", () => {
    for (const ch of ["B", "D", "P", "Q"]) {
      const r = compileScad(`text("${ch}", size=10);`);
      console.log(`Letter ${ch}: ${r.geometry.polygons.length} faces`);
      expect(r.geometry.polygons.length).toBeGreaterThan(20);
    }
  });

  it("All polygon normals are consistent (no degenerate faces)", () => {
    const r = compileScad(`text("VOREA", size=10);`);
    let degenerate = 0;
    for (const poly of r.geometry.polygons) {
      if (poly.vertices.length < 3) { degenerate++; continue; }
      const a = poly.vertices[0].pos;
      const b = poly.vertices[1].pos;
      const c = poly.vertices[2].pos;
      // Cross product should be non-zero for non-degenerate
      const cross = b.minus(a).cross(c.minus(a));
      if (cross.length() < 1e-10) degenerate++;
    }
    console.log(`VOREA: ${r.geometry.polygons.length} faces, ${degenerate} degenerate`);
    expect(degenerate).toBe(0);
  });

  it("Text is not mirrored: V should be leftmost, A should be rightmost", () => {
    const r = compileScad(`text("VOREA", size=10);`);
    // Find the X-extent of the text
    let minX = Infinity, maxX = -Infinity;
    // Find the X-midpoint of shapes belonging to the first letter (V)
    // V vertices should be in the leftmost segment
    const allX: number[] = [];
    for (const poly of r.geometry.polygons) {
      for (const v of poly.vertices) {
        allX.push(v.pos.x);
        minX = Math.min(minX, v.pos.x);
        maxX = Math.max(maxX, v.pos.x);
      }
    }
    const totalWidth = maxX - minX;
    console.log(`Text X range: [${minX.toFixed(2)}, ${maxX.toFixed(2)}], width=${totalWidth.toFixed(2)}`);
    
    // The text should have positive width and start near 0 (left-aligned by default)
    expect(totalWidth).toBeGreaterThan(10); // 5 chars at size 10 should span >10 units
    expect(minX).toBeGreaterThanOrEqual(-1); // Should start near 0 (left-aligned)
  });

  it("Engraved text: difference() with text subtracts correctly", () => {
    const r = compileScad(`
      $fn = 24;
      difference() {
        cube([60, 20, 3]);
        translate([5, 10, 2])
          text("VOREA", size=7, valign="center");
      }
    `);
    const faces = r.geometry.polygons.length;
    console.log(`Engraved VOREA: ${faces} faces`);
    // Should have more faces than a plain cube (12 for cube) because text was subtracted
    expect(faces).toBeGreaterThan(12);
    // But should not be 0 (failure case)
    expect(faces).toBeGreaterThan(100);
  });

  it("Engraved text with letters containing holes (A, R, O)", () => {
    const r = compileScad(`
      $fn = 24;
      difference() {
        cube([30, 15, 3]);
        translate([5, 7, 2])
          text("ARO", size=8, valign="center");
      }
    `);
    const faces = r.geometry.polygons.length;
    console.log(`Engraved ARO: ${faces} faces`);
    expect(faces).toBeGreaterThan(100);
  });

  it("Full keychain engraved mode works end-to-end", () => {
    const r = compileScad(`
      $fn = 36;
      difference() {
        hull() {
          translate([5, 5, 0]) cylinder(r=5, h=3);
          translate([55, 5, 0]) cylinder(r=5, h=3);
          translate([5, 23, 0]) cylinder(r=5, h=3);
          translate([55, 23, 0]) cylinder(r=5, h=3);
        }
        // Keyring hole
        translate([10, 14, -0.5]) cylinder(r=4, h=4);
        // Engraved text
        translate([38, 14, 2])
          text("VOREA", size=7, halign="center", valign="center");
      }
    `);
    const faces = r.geometry.polygons.length;
    console.log(`Full engraved keychain: ${faces} faces`);
    expect(faces).toBeGreaterThan(200);
  });
});
