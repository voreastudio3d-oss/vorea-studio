/**
 * CSG Compilation Web Worker
 *
 * Runs the heavy SCAD compilation off the main thread.
 * Receives source + values, returns serialized mesh data.
 */

// Polyfill DOMParser for Web Worker context (needed by SVGLoader)
import { DOMParser as XmlDomParser } from "@xmldom/xmldom";
if (typeof globalThis.DOMParser === "undefined") {
  (globalThis as any).DOMParser = XmlDomParser;
}

import { compileScad } from "./scad-interpreter";
import { regenerateScad } from "../services/scad-parser";
import { registerSvg, clearSvgs } from "./svg-registry";
import { registerImageData, clearImages } from "./image-registry";
import type {
  WorkerCompileRequest,
  WorkerCompileResponse,
  SerializedMesh,
  SerializedPolygon,
} from "./mesh-data";

// ─── Message handler ──────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<WorkerCompileRequest>) => {
  const { type, id, source, values, svgs, images } = e.data;

  if (type !== "compile") return;

  const start = performance.now();

  try {
    // Sync SVG registry in worker context
    if (svgs) {
      clearSvgs();
      for (const [name, text] of Object.entries(svgs)) {
        registerSvg(name, text);
      }
    }

    // Sync image registry in worker context
    if (images) {
      clearImages();
      for (const [name, img] of Object.entries(images)) {
        registerImageData(name, {
          width: img.width,
          height: img.height,
          data: new Uint8ClampedArray(img.data),
        });
      }
    }

    // Regenerate source with current parameter values
    const updatedSource = regenerateScad(source, values);

    // Compile to CSG geometry
    const result = compileScad(updatedSource, values);
    const polys = result.geometry.toPolygons();

    // Serialize polygons for transfer
    const serialized: SerializedPolygon[] = [];
    for (const poly of polys) {
      if (poly.vertices.length < 3) continue;
      const sp: SerializedPolygon = {
        vertices: poly.vertices.map(v => ({
          px: v.pos.x, py: v.pos.y, pz: v.pos.z,
          nx: v.normal.x, ny: v.normal.y, nz: v.normal.z,
        })),
        planeNx: poly.plane.normal.x,
        planeNy: poly.plane.normal.y,
        planeNz: poly.plane.normal.z,
        planeW: poly.plane.w,
      };
      // Propagate color metadata from shared field
      if (poly.shared?.color) {
        sp.color = poly.shared.color;
      }
      serialized.push(sp);
    }

    const mesh: SerializedMesh = {
      polygons: serialized,
      faceCount: serialized.length,
    };

    const response: WorkerCompileResponse = {
      type: "result",
      id,
      mesh,
      time: result.time,
      faceCount: mesh.faceCount,
      error: result.error,
    };

    self.postMessage(response);
  } catch (err: any) {
    const response: WorkerCompileResponse = {
      type: "result",
      id,
      mesh: null,
      time: performance.now() - start,
      faceCount: 0,
      error: err?.message || String(err),
    };
    self.postMessage(response);
  }
};
