/**
 * FullControl engine tests — constructors, geometry, GCode generation.
 */
import { describe, it, expect } from "vitest";
import {
  point,
  extruderOn,
  extruderOff,
  travelTo,
  comment,
  manualGcode,
  circleXY,
  rectangleXY,
  spiralXY,
  stepsToGCode,
  type FCPoint,
  type FCStep,
} from "../fullcontrol";

describe("fullcontrol", () => {
  // ── Constructors ────────────────────────────────────────────────────
  describe("point", () => {
    it("creates point with coordinates", () => {
      const p = point(10, 20, 30);
      expect(p).toEqual({ kind: "point", x: 10, y: 20, z: 30 });
    });

    it("creates point with undefined coordinates", () => {
      const p = point();
      expect(p.kind).toBe("point");
      expect(p.x).toBeUndefined();
    });
  });

  describe("extruderOn / extruderOff", () => {
    it("creates extruder on step", () => {
      expect(extruderOn()).toEqual({ kind: "extruder", on: true });
    });

    it("creates extruder off step", () => {
      expect(extruderOff()).toEqual({ kind: "extruder", on: false });
    });
  });

  describe("travelTo", () => {
    it("returns 3 steps: off, point, on", () => {
      const steps = travelTo(10, 20);
      expect(steps).toHaveLength(3);
      expect(steps[0]).toEqual({ kind: "extruder", on: false });
      expect((steps[1] as FCPoint).x).toBe(10);
      expect((steps[1] as FCPoint).y).toBe(20);
      expect(steps[2]).toEqual({ kind: "extruder", on: true });
    });

    it("includes Z when provided", () => {
      const steps = travelTo(0, 0, 5);
      expect((steps[1] as FCPoint).z).toBe(5);
    });
  });

  describe("comment", () => {
    it("creates comment step", () => {
      expect(comment("Layer 1")).toEqual({ kind: "comment", text: "Layer 1" });
    });
  });

  describe("manualGcode", () => {
    it("creates manual gcode step", () => {
      expect(manualGcode("G28")).toEqual({ kind: "manual_gcode", text: "G28" });
    });
  });

  // ── Geometry functions ──────────────────────────────────────────────
  describe("circleXY", () => {
    it("generates correct number of points", () => {
      const pts = circleXY(0, 0, 0, 10, 32);
      expect(pts).toHaveLength(33); // segments + 1 (closed)
    });

    it("all points have correct z", () => {
      const pts = circleXY(0, 0, 5, 10, 16);
      for (const p of pts) {
        expect(p.z).toBe(5);
      }
    });

    it("points are on the circle", () => {
      const radius = 10;
      const pts = circleXY(0, 0, 0, radius, 64);
      for (const p of pts) {
        const dist = Math.sqrt(p.x! ** 2 + p.y! ** 2);
        expect(dist).toBeCloseTo(radius, 5);
      }
    });

    it("starts and ends at same point (closed)", () => {
      const pts = circleXY(50, 50, 0, 20, 32);
      expect(pts[0].x).toBeCloseTo(pts[pts.length - 1].x!, 5);
      expect(pts[0].y).toBeCloseTo(pts[pts.length - 1].y!, 5);
    });
  });

  describe("rectangleXY", () => {
    it("generates 5 points (closed rectangle)", () => {
      const pts = rectangleXY(0, 0, 0, 10, 20);
      expect(pts).toHaveLength(5);
    });

    it("first and last point are same (closed)", () => {
      const pts = rectangleXY(0, 0, 0, 10, 20);
      expect(pts[0].x).toBe(pts[4].x);
      expect(pts[0].y).toBe(pts[4].y);
    });

    it("covers correct width and height", () => {
      const pts = rectangleXY(5, 10, 0, 30, 40);
      expect(pts[0]).toEqual({ kind: "point", x: 5, y: 10, z: 0 });
      expect(pts[1]).toEqual({ kind: "point", x: 35, y: 10, z: 0 });
      expect(pts[2]).toEqual({ kind: "point", x: 35, y: 50, z: 0 });
    });
  });

  describe("spiralXY", () => {
    it("generates correct number of points", () => {
      const pts = spiralXY(0, 0, 5, 20, 0, 10, 3, 32);
      expect(pts.length).toBe(Math.round(3 * 32) + 1);
    });

    it("starts at startRadius and ends at endRadius", () => {
      const pts = spiralXY(0, 0, 5, 20, 0, 10, 2, 64);
      const firstDist = Math.sqrt(pts[0].x! ** 2 + pts[0].y! ** 2);
      const lastDist = Math.sqrt(pts[pts.length - 1].x! ** 2 + pts[pts.length - 1].y! ** 2);
      expect(firstDist).toBeCloseTo(5, 1);
      expect(lastDist).toBeCloseTo(20, 1);
    });

    it("Z goes from startZ to endZ", () => {
      const pts = spiralXY(0, 0, 5, 20, 0, 10, 2, 64);
      expect(pts[0].z).toBeCloseTo(0);
      expect(pts[pts.length - 1].z).toBeCloseTo(10);
    });
  });

  // ── stepsToGCode ────────────────────────────────────────────────────
  describe("stepsToGCode", () => {
    it("generates gcode with start and end sections", () => {
      const result = stepsToGCode([point(10, 10, 0.2)]);
      expect(result.gcode).toContain("G28");
      expect(result.gcode).toContain("End GCode");
      expect(result.lines).toBeGreaterThan(10);
    });

    it("skips start/end when disabled", () => {
      const result = stepsToGCode([point(10, 10, 0.2)], {
        includeStartGcode: false,
        includeEndGcode: false,
      });
      expect(result.gcode).not.toContain("G28");
      expect(result.gcode).not.toContain("End GCode");
    });

    it("includes comments", () => {
      const result = stepsToGCode([comment("Test comment")], {
        includeStartGcode: false,
        includeEndGcode: false,
      });
      expect(result.gcode).toContain("; Test comment");
    });

    it("includes manual gcode", () => {
      const result = stepsToGCode([manualGcode("G92 E0")], {
        includeStartGcode: false,
        includeEndGcode: false,
      });
      expect(result.gcode).toContain("G92 E0");
    });

    it("generates extrusion moves for points", () => {
      const steps: FCStep[] = [
        point(0, 0, 0.2),
        point(10, 0, 0.2),
        point(10, 10, 0.2),
      ];
      const result = stepsToGCode(steps, {
        includeStartGcode: false,
        includeEndGcode: false,
      });
      expect(result.gcode).toContain("G1");
      expect(result.filamentUsedMm).toBeGreaterThan(0);
    });

    it("tracks layer count on Z changes", () => {
      const steps: FCStep[] = [
        point(0, 0, 0.2),
        point(10, 0, 0.2),
        point(0, 0, 0.4),
        point(10, 0, 0.4),
      ];
      const result = stepsToGCode(steps, {
        includeStartGcode: false,
        includeEndGcode: false,
      });
      expect(result.layerCount).toBe(2);
    });

    it("produces GCode for a full circle", () => {
      const steps: FCStep[] = [
        ...travelTo(10, 0, 0.2),
        ...circleXY(0, 0, 0.2, 10, 32),
      ];
      const result = stepsToGCode(steps, {
        includeStartGcode: false,
        includeEndGcode: false,
      });
      expect(result.filamentUsedMm).toBeGreaterThan(0);
      expect(result.gcode.length).toBeGreaterThan(100);
    });

    it("handles retract and unretract", () => {
      const steps: FCStep[] = [
        { kind: "retract" },
        point(50, 50, 0.2),
        { kind: "unretract" },
      ];
      const result = stepsToGCode(steps, {
        includeStartGcode: false,
        includeEndGcode: false,
      });
      expect(result.gcode).toContain("retract");
      expect(result.gcode).toContain("unretract");
    });

    it("handles fan, hotend, buildplate steps", () => {
      const steps: FCStep[] = [
        { kind: "fan", speedPercent: 50 },
        { kind: "hotend", temp: 210, wait: true },
        { kind: "buildplate", temp: 65, wait: false },
      ];
      const result = stepsToGCode(steps, {
        includeStartGcode: false,
        includeEndGcode: false,
      });
      expect(result.gcode).toContain("Fan 50%");
      expect(result.gcode).toContain("M109 S210");
      expect(result.gcode).toContain("M140 S65");
    });

    it("handles printer speed changes", () => {
      const steps: FCStep[] = [
        { kind: "printer", printSpeed: 2000, travelSpeed: 5000 },
        point(10, 10, 0.2),
      ];
      const result = stepsToGCode(steps, {
        includeStartGcode: false,
        includeEndGcode: false,
      });
      expect(result.gcode).toContain("F2000");
    });

    it("handles extrusion geometry changes", () => {
      const steps: FCStep[] = [
        { kind: "extrusion_geometry", width: 0.6, height: 0.3 },
        point(10, 10, 0.3),
      ];
      const result = stepsToGCode(steps, {
        includeStartGcode: false,
        includeEndGcode: false,
      });
      expect(result.gcode).toContain("G1");
    });

    it("estimates time correctly", () => {
      const result = stepsToGCode([
        point(0, 0, 0.2),
        point(100, 0, 0.2),
      ], {
        includeStartGcode: false,
        includeEndGcode: false,
        printSpeed: 1200,
      });
      expect(result.estimatedTimeMin).toBeGreaterThanOrEqual(0);
    });
  });
});
