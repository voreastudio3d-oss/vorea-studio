import { describe, it, expect } from "vitest";
import { compileScad } from "../scad-interpreter";

describe("Llavero debug", () => {
  it("Test 1: Just hull", () => {
    const r = compileScad(`
      $fn = 36;
      hull() {
        translate([5, 5, 0]) cylinder(r=5, h=3);
        translate([55, 5, 0]) cylinder(r=5, h=3);
        translate([5, 23, 0]) cylinder(r=5, h=3);
        translate([55, 23, 0]) cylinder(r=5, h=3);
      }
    `);
    console.log(`Hull only: ${r.geometry.polygons.length} faces, ${r.time.toFixed(0)}ms`);
    expect(r.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("Test 2: Just text", () => {
    const r = compileScad(`text("VOREA", size=7, halign="center", valign="center");`);
    console.log(`Text only: ${r.geometry.polygons.length} faces, ${r.time.toFixed(0)}ms`);
    expect(r.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("Test 3: Hull + text (no difference)", () => {
    const r = compileScad(`
      $fn = 36;
      hull() {
        translate([5, 5, 0]) cylinder(r=5, h=3);
        translate([55, 5, 0]) cylinder(r=5, h=3);
        translate([5, 23, 0]) cylinder(r=5, h=3);
        translate([55, 23, 0]) cylinder(r=5, h=3);
      }
      translate([30, 14, 3])
        text("VOREA", size=7, halign="center", valign="center");
    `);
    console.log(`Hull+text: ${r.geometry.polygons.length} faces, ${r.time.toFixed(0)}ms`);
    expect(r.geometry.polygons.length).toBeGreaterThan(300);
  });

  it("Test 4: Full llavero with difference + text", () => {
    const r = compileScad(`
      $fn = 36;
      difference() {
        hull() {
          translate([5, 5, 0]) cylinder(r=5, h=3);
          translate([55, 5, 0]) cylinder(r=5, h=3);
          translate([5, 23, 0]) cylinder(r=5, h=3);
          translate([55, 23, 0]) cylinder(r=5, h=3);
        }
        translate([10, 14, -0.5])
          cylinder(r=4, h=4);
      }
      translate([38, 18, 3])
        text("VOREA", size=7, halign="center", valign="center");
      translate([38, 10, 3])
        text("STUDIO", size=4, halign="center", valign="center");
    `);
    console.log(`Full llavero: ${r.geometry.polygons.length} faces, ${r.time.toFixed(0)}ms`);
    expect(r.geometry.polygons.length).toBeGreaterThan(300);
  });

  it("Test 5: String variable text", () => {
    const r = compileScad(`
      linea1 = "VOREA";
      translate([0, 0, 0]) text(linea1, size=7);
    `);
    console.log(`String var text: ${r.geometry.polygons.length} faces, ${r.time.toFixed(0)}ms`);
    expect(r.geometry.polygons.length).toBeGreaterThan(0);
  });
});
