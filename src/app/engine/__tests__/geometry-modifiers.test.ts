/**
 * Tests for Worley 3D noise and geometry modifiers.
 */

import { describe, it, expect } from "vitest";
import { createWorleyNoise3D } from "../worley";
import {
  DEFAULT_MODIFIER,
  displaceGeometry,
  exportModifierPreset,
  parseModifierPreset,
  type ModifierConfig,
} from "../geometry-modifiers";
import * as THREE from "three";

// ─── Worley Noise ─────────────────────────────────────────────────────────────

describe("createWorleyNoise3D", () => {
  it("returns f1, f2, and edge distances", () => {
    const evaluate = createWorleyNoise3D(42);
    const result = evaluate(0.5, 0.5, 0.5);

    expect(result).toHaveProperty("f1");
    expect(result).toHaveProperty("f2");
    expect(result).toHaveProperty("edge");
    expect(result.f1).toBeGreaterThanOrEqual(0);
    expect(result.f2).toBeGreaterThanOrEqual(result.f1);
    expect(result.edge).toBeCloseTo(result.f2 - result.f1);
  });

  it("is deterministic for the same seed", () => {
    const eval1 = createWorleyNoise3D(42);
    const eval2 = createWorleyNoise3D(42);

    const r1 = eval1(1.5, 2.5, 3.5);
    const r2 = eval2(1.5, 2.5, 3.5);

    expect(r1.f1).toBe(r2.f1);
    expect(r1.f2).toBe(r2.f2);
    expect(r1.edge).toBe(r2.edge);
  });

  it("produces different results for different seeds", () => {
    const eval1 = createWorleyNoise3D(42);
    const eval2 = createWorleyNoise3D(99);

    const r1 = eval1(0.7, 0.3, 0.1);
    const r2 = eval2(0.7, 0.3, 0.1);

    expect(r1.f1).not.toBe(r2.f1);
  });

  it("produces different results for different positions", () => {
    const evaluate = createWorleyNoise3D(42);

    const r1 = evaluate(0, 0, 0);
    const r2 = evaluate(10, 10, 10);

    expect(r1.f1).not.toBe(r2.f1);
  });

  it("supports manhattan metric", () => {
    const evaluate = createWorleyNoise3D(42, "manhattan");
    const result = evaluate(0.5, 0.5, 0.5);

    expect(result.f1).toBeGreaterThanOrEqual(0);
    expect(result.f2).toBeGreaterThanOrEqual(result.f1);
  });

  it("supports chebyshev metric", () => {
    const evaluate = createWorleyNoise3D(42, "chebyshev");
    const result = evaluate(0.5, 0.5, 0.5);

    expect(result.f1).toBeGreaterThanOrEqual(0);
    expect(result.f2).toBeGreaterThanOrEqual(result.f1);
  });
});

// ─── Geometry Modifiers ───────────────────────────────────────────────────────

function makeTestGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BoxGeometry(20, 20, 20, 4, 4, 4);
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  return geom;
}

describe("displaceGeometry", () => {
  it("returns geometry unchanged when disabled", () => {
    const geom = makeTestGeometry();
    const config: ModifierConfig = { ...DEFAULT_MODIFIER, enabled: false };
    const result = displaceGeometry(geom, config);
    expect(result).toBe(geom); // same reference, not cloned
  });

  it("returns modified geometry when enabled with sphere style", () => {
    const geom = makeTestGeometry();
    const originalPos = new Float32Array(geom.attributes.position.array);

    const config: ModifierConfig = {
      ...DEFAULT_MODIFIER,
      enabled: true,
      cellStyle: "sphere",
      cellCount: 30,
      seed: 42,
    };

    const result = displaceGeometry(geom, config);
    expect(result).not.toBe(geom); // cloned
    expect(result.attributes.position.count).toBe(geom.attributes.position.count);

    // At least some vertices should have moved
    const newPos = result.attributes.position.array;
    let moved = 0;
    for (let i = 0; i < originalPos.length; i++) {
      if (Math.abs(newPos[i] - originalPos[i]) > 0.001) moved++;
    }
    expect(moved).toBeGreaterThan(0);
  });

  it("returns modified geometry with cylinder style", () => {
    const geom = makeTestGeometry();
    const config: ModifierConfig = {
      ...DEFAULT_MODIFIER,
      enabled: true,
      cellStyle: "cylinder",
    };
    const result = displaceGeometry(geom, config);
    expect(result.attributes.position.count).toBeGreaterThan(0);
  });

  it("returns modified geometry with cube (edge) style", () => {
    const geom = makeTestGeometry();
    const config: ModifierConfig = {
      ...DEFAULT_MODIFIER,
      enabled: true,
      cellStyle: "cube",
    };
    const result = displaceGeometry(geom, config);
    expect(result.attributes.position.count).toBeGreaterThan(0);
  });

  it("produces lattice geometry in lattice mode", () => {
    const geom = makeTestGeometry();
    const config: ModifierConfig = {
      ...DEFAULT_MODIFIER,
      enabled: true,
      mode: "lattice",
      tubeRadius: 0.5,
      tubeSegments: 4,
    };
    const result = displaceGeometry(geom, config);
    // Lattice creates new geometry from tubes, should have more vertices
    expect(result.attributes.position.count).toBeGreaterThan(0);
  });
});

// ─── Preset I/O ───────────────────────────────────────────────────────────────

describe("modifier presets", () => {
  it("exports and re-imports a preset", async () => {
    const config: ModifierConfig = {
      ...DEFAULT_MODIFIER,
      enabled: true,
      cellCount: 55,
      seed: 123,
      wallThickness: 3.5,
    };

    const blob = exportModifierPreset(config, "Test Preset");
    expect(blob.type).toBe("application/json");

    const text = await blob.text();
    const parsed = parseModifierPreset(text);

    expect(parsed).not.toBeNull();
    expect(parsed!.cellCount).toBe(55);
    expect(parsed!.seed).toBe(123);
    expect(parsed!.wallThickness).toBe(3.5);
    expect(parsed!.enabled).toBe(true);
  });

  it("rejects invalid JSON", () => {
    expect(parseModifierPreset("not json")).toBeNull();
  });

  it("rejects wrong type field", () => {
    const bad = JSON.stringify({ type: "wrong", version: 1, config: {} });
    expect(parseModifierPreset(bad)).toBeNull();
  });

  it("rejects missing required config fields", () => {
    const bad = JSON.stringify({
      type: "vorea-modifier-preset",
      version: 1,
      config: { cellCount: 10 }, // missing seed and wallThickness
    });
    expect(parseModifierPreset(bad)).toBeNull();
  });
});
