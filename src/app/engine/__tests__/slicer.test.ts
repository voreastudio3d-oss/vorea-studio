/**
 * Slicer tests — config defaults, mesh bounding box.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_SLICE_CONFIG } from "../slicer";

describe("slicer", () => {
  describe("DEFAULT_SLICE_CONFIG", () => {
    it("has reasonable layer height", () => {
      expect(DEFAULT_SLICE_CONFIG.layerHeight).toBe(0.2);
    });

    it("has reasonable extrusion width", () => {
      expect(DEFAULT_SLICE_CONFIG.extrusionWidth).toBe(0.4);
    });

    it("infill density between 0 and 1", () => {
      expect(DEFAULT_SLICE_CONFIG.infillDensity).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_SLICE_CONFIG.infillDensity).toBeLessThanOrEqual(1);
    });

    it("infill pattern is valid", () => {
      expect(["lines", "grid", "none"]).toContain(DEFAULT_SLICE_CONFIG.infillPattern);
    });

    it("wall count is positive", () => {
      expect(DEFAULT_SLICE_CONFIG.wallCount).toBeGreaterThan(0);
    });

    it("has print and travel speeds", () => {
      expect(DEFAULT_SLICE_CONFIG.printSpeed).toBeGreaterThan(0);
      expect(DEFAULT_SLICE_CONFIG.travelSpeed).toBeGreaterThan(0);
      expect(DEFAULT_SLICE_CONFIG.travelSpeed).toBeGreaterThan(DEFAULT_SLICE_CONFIG.printSpeed);
    });

    it("has top and bottom layers", () => {
      expect(DEFAULT_SLICE_CONFIG.topLayers).toBeGreaterThan(0);
      expect(DEFAULT_SLICE_CONFIG.bottomLayers).toBeGreaterThan(0);
    });
  });
});
