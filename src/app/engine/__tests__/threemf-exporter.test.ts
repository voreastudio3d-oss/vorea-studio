// @vitest-environment node

import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import * as THREE from "three";

import { exportTo3MF, exportToSTL } from "../threemf-exporter";

function buildTriangleGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
      ],
      3
    )
  );
  return geometry;
}

function buildTwoTriangleGeometry() {
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
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      [
        1, 0, 0,
        1, 0, 0,
        1, 0, 0,
        0, 1, 0,
        0, 1, 0,
        0, 1, 0,
      ],
      3
    )
  );
  return geometry;
}

describe("threemf-exporter", () => {
  it("exports a binary STL with the expected header and triangle count", async () => {
    const blob = exportToSTL(buildTriangleGeometry(), "Unit STL");
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);

    expect(blob.type).toBe("application/octet-stream");
    expect(buffer.byteLength).toBe(84 + 50);
    expect(view.getUint32(80, true)).toBe(1);

    const header = String.fromCharCode(
      ...Array.from({ length: 8 }, (_, index) => view.getUint8(index))
    );
    expect(header).toBe("Unit STL");

    // The third vertex should rotate from +Y to +Z.
    expect(view.getFloat32(120, true)).toBeCloseTo(0, 5);
    expect(view.getFloat32(124, true)).toBeCloseTo(0, 5);
    expect(view.getFloat32(128, true)).toBeCloseTo(1, 5);
  });

  it("exports a valid 3MF package with the mandatory files", async () => {
    const blob = exportTo3MF({
      geometry: buildTriangleGeometry(),
      objectName: "Test Relief",
    });
    const archive = unzipSync(new Uint8Array(await blob.arrayBuffer()));

    expect(blob.type).toBe("application/vnd.ms-package.3dmanufacturing-3dmodel+xml");
    expect(Object.keys(archive)).toEqual(
      expect.arrayContaining([
        "[Content_Types].xml",
        "_rels/.rels",
        "3D/3dmodel.model",
      ])
    );

    const modelXml = strFromU8(archive["3D/3dmodel.model"]);
    expect(modelXml).toContain('name="Test Relief"');
    expect(modelXml).toContain('<triangle v1="0" v2="1" v3="2"/>');
  });

  it("includes colorgroup and slic3r segmentation metadata for colored exports", async () => {
    const geometry = buildTriangleGeometry();
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(
        [
          1, 0, 0,
          1, 0, 0,
          1, 0, 0,
        ],
        3
      )
    );

    const blob = exportTo3MF({
      geometry,
      colorZones: 2,
      zoneColors: [
        [1, 0, 0],
        [0, 1, 0],
      ],
      colorEncodingMode: "hybrid",
      objectName: "Colored Relief",
    });
    const archive = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const modelXml = strFromU8(archive["3D/3dmodel.model"]);

    expect(modelXml).toContain('requiredextensions="m"');
    expect(modelXml).toContain('xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06"');
    expect(modelXml).toContain('<m:colorgroup id="1">');
    expect(modelXml.toLowerCase()).toContain('<m:color color="#ff0000ff"/>');
    expect(modelXml).toContain('slic3rpe:mmu_segmentation="0C"');
  });


});
