// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

const mockState = vi.hoisted(() => ({
  ofMeshBehaviors: [] as Array<(mesh: { options: any }) => any>,
  ofMeshCalls: [] as Array<Record<string, unknown>>,
  importManifold: vi.fn(),
  exportToSTL: vi.fn(),
}));

vi.mock("manifold-3d", () => {
  class Mesh {
    options: any;

    constructor(options: any) {
      this.options = options;
    }
  }

  return {
    Mesh,
    Manifold: {
      ofMesh: (mesh: { options: any }) => {
        mockState.ofMeshCalls.push({
          numProp: mesh.options.numProp,
          vertProperties: Array.from(mesh.options.vertProperties ?? []),
          triVerts: Array.from(mesh.options.triVerts ?? []),
          mergeFromVert: mesh.options.mergeFromVert
            ? Array.from(mesh.options.mergeFromVert)
            : undefined,
          mergeToVert: mesh.options.mergeToVert
            ? Array.from(mesh.options.mergeToVert)
            : undefined,
        });
        const behavior = mockState.ofMeshBehaviors.shift();
        if (!behavior) throw new Error("No mock behavior configured for ofMesh");
        return behavior(mesh);
      },
    },
    importManifold: (...args: any[]) => mockState.importManifold(...args),
  };
});

vi.mock("../threemf-exporter", () => ({
  exportToSTL: (...args: any[]) => mockState.exportToSTL(...args),
}));

function buildSquareGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0,
        1, 0, 0,
        1, 1, 0,
        0, 0, 0,
        1, 1, 0,
        0, 1, 0,
      ],
      3
    )
  );
  return geometry;
}

function makeMockManifold(
  verts = [
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
  ],
  tris = [0, 1, 2]
) {
  return {
    getMesh: () => ({
      numProp: 3,
      vertProperties: new Float32Array(verts),
      triVerts: new Uint32Array(tris),
    }),
    delete: vi.fn(),
  };
}

async function loadRepairMesh() {
  const mod = await import("../mesh-repair");
  return mod.repairMesh;
}

describe("mesh-repair", () => {
  beforeEach(() => {
    vi.resetModules();
    mockState.ofMeshBehaviors = [];
    mockState.ofMeshCalls = [];
    mockState.importManifold.mockReset();
    mockState.exportToSTL.mockReset();
  });

  it("returns a new geometry without marking repair when manifold construction succeeds directly", async () => {
    mockState.ofMeshBehaviors.push(() => makeMockManifold());

    const repairMesh = await loadRepairMesh();
    const source = buildSquareGeometry();
    const result = await repairMesh(source);

    expect(result.wasRepaired).toBe(false);
    expect(result.summary).toContain("Mesh ya era manifold");
    expect(result.geometry).not.toBe(source);
    expect(result.geometry.getAttribute("position").count).toBe(3);
    expect(mockState.ofMeshCalls).toHaveLength(1);
    expect(mockState.ofMeshCalls[0].mergeFromVert).toBeUndefined();
    expect(mockState.exportToSTL).not.toHaveBeenCalled();
    expect(mockState.importManifold).not.toHaveBeenCalled();
  });

  it("uses merge vectors on the second attempt and marks the geometry as repaired", async () => {
    mockState.ofMeshBehaviors.push(
      () => {
        throw new Error("direct failed");
      },
      () => makeMockManifold()
    );

    const repairMesh = await loadRepairMesh();
    const result = await repairMesh(buildSquareGeometry());

    expect(result.wasRepaired).toBe(true);
    expect(result.summary).toContain("Reparado");
    expect(mockState.ofMeshCalls).toHaveLength(2);
    expect(mockState.ofMeshCalls[1].mergeFromVert).toEqual([3, 4, 5]);
    expect(mockState.ofMeshCalls[1].mergeToVert).toEqual([0, 2, 3]);
    expect(mockState.exportToSTL).not.toHaveBeenCalled();
    expect(mockState.importManifold).not.toHaveBeenCalled();
  });

  it("falls back to STL export and importManifold when direct repair attempts fail", async () => {
    mockState.ofMeshBehaviors.push(
      () => {
        throw new Error("direct failed");
      },
      () => {
        throw new Error("merge failed");
      }
    );
    mockState.exportToSTL.mockReturnValue(new Blob([new Uint8Array([1, 2, 3])]));
    mockState.importManifold.mockResolvedValue(makeMockManifold());

    const repairMesh = await loadRepairMesh();
    const result = await repairMesh(buildSquareGeometry());

    expect(result.wasRepaired).toBe(true);
    expect(result.summary).toContain("Reparado");
    expect(mockState.exportToSTL).toHaveBeenCalledTimes(1);
    expect(mockState.importManifold).toHaveBeenCalledWith(expect.any(ArrayBuffer), {
      tolerance: 0.1,
    });
  });

  it("returns the original geometry when all repair strategies fail", async () => {
    mockState.ofMeshBehaviors.push(
      () => {
        throw new Error("direct failed");
      },
      () => {
        throw new Error("merge failed");
      }
    );
    mockState.exportToSTL.mockImplementation(() => {
      throw new Error("stl export failed");
    });

    const repairMesh = await loadRepairMesh();
    const source = buildSquareGeometry();
    const result = await repairMesh(source);

    expect(result.wasRepaired).toBe(false);
    expect(result.geometry).toBe(source);
    expect(result.summary).toContain("Reparación fallida");
    expect(result.summary).toContain("stl export failed");
  });
});
