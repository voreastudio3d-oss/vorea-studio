import { describe, it, expect, beforeEach } from "vitest";
import { compileScad } from "../scad-interpreter";
import { registerSvg, clearSvgs } from "../svg-registry";

// Simple star SVG for testing — no fill attributes to avoid jsdom style parsing issues
const STAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M50,5 L61,35 L95,35 L68,57 L79,91 L50,70 L21,91 L32,57 L5,35 L39,35 Z"/>
</svg>`;

// Simple rectangle
const RECT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40">
  <rect x="5" y="5" width="70" height="30"/>
</svg>`;

// Path-based logo (letter V as a path)
const PATH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M20,10 L50,90 L80,10 L65,10 L50,65 L35,10 Z"/>
</svg>`;

describe("SVG import() support", () => {
  beforeEach(() => {
    clearSvgs();
  });

  it("import() with unregistered SVG returns placeholder", () => {
    const r = compileScad(`import("logo.svg");`);
    // Should return a placeholder cube, not crash
    expect(r.geometry.polygons.length).toBeGreaterThan(0);
  });

  it("import() with non-svg file returns null", () => {
    const r = compileScad(`import("model.stl");`);
    // STL not supported — returns null → no geometry
    expect(r.geometry.polygons.length).toBe(0);
  });

  it("import() star SVG produces valid 3D geometry", () => {
    registerSvg("star.svg", STAR_SVG);
    const r = compileScad(`import("star.svg");`);
    const faces = r.geometry.polygons.length;
    console.log(`Star SVG: ${faces} faces`);
    expect(faces).toBeGreaterThan(10);
  });

  it("import() rectangle SVG produces geometry", () => {
    registerSvg("rect.svg", RECT_SVG);
    const r = compileScad(`import("rect.svg");`);
    const faces = r.geometry.polygons.length;
    console.log(`Rect SVG: ${faces} faces`);
    expect(faces).toBeGreaterThan(5);
  });

  it("import() path-based SVG produces geometry", () => {
    registerSvg("v-letter.svg", PATH_SVG);
    const r = compileScad(`import("v-letter.svg");`);
    const faces = r.geometry.polygons.length;
    console.log(`Path SVG (V): ${faces} faces`);
    expect(faces).toBeGreaterThan(5);
  });

  it("SVG import works inside linear_extrude with custom height", () => {
    registerSvg("star.svg", STAR_SVG);
    const r = compileScad(`
      linear_extrude(height=5)
        import("star.svg");
    `);
    const faces = r.geometry.polygons.length;
    console.log(`Extruded star SVG: ${faces} faces`);
    expect(faces).toBeGreaterThan(10);
  });

  it("SVG import works in difference() (engraved logo)", () => {
    registerSvg("star.svg", STAR_SVG);
    const r = compileScad(`
      $fn = 24;
      difference() {
        cube([120, 120, 5]);
        translate([10, 10, 3])
          linear_extrude(height=3)
            import("star.svg");
      }
    `);
    const faces = r.geometry.polygons.length;
    console.log(`Engraved star SVG: ${faces} faces`);
    expect(faces).toBeGreaterThan(12); // More than just a cube
  });

  it("SVG filename is case-insensitive", () => {
    registerSvg("Logo.SVG", RECT_SVG);
    const r = compileScad(`import("logo.svg");`);
    expect(r.geometry.polygons.length).toBeGreaterThan(5);
  });

  it("SVG import with translate and scale", () => {
    registerSvg("star.svg", STAR_SVG);
    const r = compileScad(`
      translate([50, 50, 0])
        scale([0.5, 0.5, 1])
          import("star.svg");
    `);
    const faces = r.geometry.polygons.length;
    console.log(`Translated+scaled star: ${faces} faces`);
    expect(faces).toBeGreaterThan(10);
  });
});
