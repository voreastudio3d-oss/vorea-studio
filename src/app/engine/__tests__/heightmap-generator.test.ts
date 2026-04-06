// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  generateHeightmapMesh,
  type HeightmapOptions,
} from "../heightmap-generator";
import type { DecodedImage } from "../image-registry";

function createTestImage(): DecodedImage {
  return {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 0, 0, 255,
      0, 255, 0, 255,
      255, 255, 255, 255,
    ]),
  };
}

function getBounds(positions: Float32Array) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  return { minX, minY, minZ, maxX, maxY, maxZ };
}

function buildOptions(
  overrides: Partial<HeightmapOptions> = {}
): HeightmapOptions {
  return {
    image: createTestImage(),
    subdivisions: 2,
    maxHeight: 10,
    smoothing: 0,
    width: 100,
    depth: 80,
    invert: false,
    solid: true,
    baseThickness: 2,
    colorZones: 2,
    ...overrides,
  };
}

describe("heightmap-generator", () => {
  it("generates a plane relief with expected bounds and triangle count", () => {
    const result = generateHeightmapMesh(
      buildOptions({
        surfaceMode: "plane",
      })
    );
    const positions = result.geometry.getAttribute("position").array as Float32Array;
    const bounds = getBounds(positions);

    expect(result.surfaceMode).toBe("plane");
    expect(result.gridW).toBe(2);
    expect(result.gridH).toBe(2);
    expect(result.faceCount).toBe(32);
    expect(result.hasVertexColors).toBe(true);
    expect(result.palette).toHaveLength(2);
    expect(bounds.minX).toBeCloseTo(-50, 5);
    expect(bounds.maxX).toBeCloseTo(50, 5);
    expect(bounds.minZ).toBeCloseTo(-40, 5);
    expect(bounds.maxZ).toBeCloseTo(40, 5);
    expect(bounds.minY).toBeCloseTo(-2, 5);
    expect(bounds.maxY).toBeCloseTo(10, 5);
  });

  it("generates a cylindrical relief with wrapped bounds and fewer solid triangles", () => {
    const result = generateHeightmapMesh(
      buildOptions({
        surfaceMode: "cylinder",
        cylinderRadius: 30,
        cylinderHeight: 100,
      })
    );
    const positions = result.geometry.getAttribute("position").array as Float32Array;
    const bounds = getBounds(positions);
    let maxRadius = 0;

    for (let i = 0; i < positions.length; i += 3) {
      const radius = Math.hypot(positions[i], positions[i + 2]);
      maxRadius = Math.max(maxRadius, radius);
    }

    expect(result.surfaceMode).toBe("cylinder");
    expect(result.faceCount).toBe(24);
    expect(result.hasVertexColors).toBe(true);
    expect(bounds.minY).toBeCloseTo(-50, 5);
    expect(bounds.maxY).toBeCloseTo(50, 5);
    expect(maxRadius).toBeGreaterThan(30);
    expect(maxRadius).toBeLessThanOrEqual(40.01);
    expect(Math.abs(bounds.minX)).toBeLessThanOrEqual(40.01);
    expect(Math.abs(bounds.maxX)).toBeLessThanOrEqual(40.01);
    expect(Math.abs(bounds.minZ)).toBeLessThanOrEqual(40.01);
    expect(Math.abs(bounds.maxZ)).toBeLessThanOrEqual(40.01);
  });
});
