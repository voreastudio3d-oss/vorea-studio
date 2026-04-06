// @vitest-environment node

import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { inspectMesh } from "../mesh-inspector";

function buildGeometry(vertices: Array<[number, number, number]>) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices.flat(), 3)
  );
  return geometry;
}

describe("inspectMesh", () => {
  it("flags geometries without positions as not printable", () => {
    const report = inspectMesh(new THREE.BufferGeometry());

    expect(report.score).toBe("not-printable");
    expect(report.summary).toBe("No position attribute found");
    expect(report.totalFaces).toBe(0);
  });

  it("marks a closed box as printable", () => {
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const report = inspectMesh(geometry);

    expect(report.isWatertight).toBe(true);
    expect(report.isManifold).toBe(true);
    expect(report.boundaryEdges).toBe(0);
    expect(report.nonManifoldEdges).toBe(0);
    expect(report.degenerateTriangles).toBe(0);
    expect(report.totalFaces).toBe(12);
    expect(report.totalVertices).toBe(8);
    expect(report.volumeEstimate).toBeCloseTo(8, 5);
    expect(report.score).toBe("printable");
  });

  it("detects open boundary edges on a plane", () => {
    const geometry = new THREE.PlaneGeometry(2, 2, 1, 1);
    const report = inspectMesh(geometry);

    expect(report.isWatertight).toBe(false);
    expect(report.isManifold).toBe(true);
    expect(report.boundaryEdges).toBe(4);
    expect(report.nonManifoldEdges).toBe(0);
    expect(report.score).toBe("not-printable");
    expect(report.summary).toContain("bordes abiertos");
  });

  it("detects non-manifold edges shared by more than two faces", () => {
    const geometry = buildGeometry([
      [0, 0, 0], [1, 0, 0], [0, 1, 0],
      [0, 0, 0], [1, 0, 0], [0, -1, 0],
      [0, 0, 0], [1, 0, 0], [0, 0, 1],
    ]);
    const report = inspectMesh(geometry);

    expect(report.isWatertight).toBe(false);
    expect(report.isManifold).toBe(false);
    expect(report.nonManifoldEdges).toBe(1);
    expect(report.boundaryEdges).toBe(6);
    expect(report.score).toBe("not-printable");
    expect(report.summary).toContain("bordes non-manifold");
  });

  it("keeps degenerate-only geometry in warnings instead of printable", () => {
    const geometry = buildGeometry([
      [0, 0, 0], [1, 0, 0], [2, 0, 0],
    ]);
    const report = inspectMesh(geometry);

    expect(report.degenerateTriangles).toBe(1);
    expect(report.boundaryEdges).toBe(0);
    expect(report.nonManifoldEdges).toBe(0);
    expect(report.score).toBe("warnings");
    expect(report.summary).toContain("triángulos degenerados");
  });
});
