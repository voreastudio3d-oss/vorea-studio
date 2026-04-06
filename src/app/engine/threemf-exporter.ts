/**
 * 3MF Exporter — Exports colored Three.js BufferGeometry to .3mf format.
 * Welds co-located vertices to produce a manifold mesh valid for slicers.
 * Uses the 3MF Materials & Properties extension for per-triangle coloring.
 * ZIP creation via fflate (zero-dep, ~3KB gzip).
 *
 * Vorea Studio — voreastudio.com
 */

import { zipSync, strToU8 } from "fflate";
import * as THREE from "three";

// ─── Content Types XML ────────────────────────────────────────────────────────

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/3dmodel.model" Id="rel0"/>
</Relationships>`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThreeMFExportOptions {
  geometry: THREE.BufferGeometry;
  /** Colors per zone as [r,g,b] 0-1 tuples */
  zoneColors?: Array<[number, number, number]>;
  /** Optional subset of zone color indices to keep in the export */
  selectedColorIndices?: number[];
  /**
   * Color encoding strategy for 3MF.
   * - hybrid: standard 3MF colorgroup + slic3rpe segmentation
   * - slic3r-strict: slic3rpe segmentation only (no colorgroup)
   */
  colorEncodingMode?: "hybrid" | "slic3r-strict";
  /**
   * Add slic3r/orca/bambu-style per-triangle segmentation attributes.
   * Can be combined with hybrid mode or used alone in strict mode.
   */
  includeSlic3rMmuSegmentation?: boolean;
  /** Number of color zones. 1 = single color */
  colorZones?: number;
  /** Fallback single color if zones=1 (hex string) */
  singleColor?: string;
  objectName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toHex255(v: number): string {
  const h = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16);
  return h.length === 1 ? "0" + h : h;
}

function rgbToSRGB(r: number, g: number, b: number): string {
  // Emit explicit opaque alpha to satisfy strict 8-digit color parsers.
  return `#${toHex255(r)}${toHex255(g)}${toHex255(b)}FF`;
}

function linearToSrgb(v: number): number {
  const c = Math.max(0, Math.min(1, v));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function closestColorIndex(
  color: [number, number, number],
  palette: Array<[number, number, number]>,
  allowedIndices?: Set<number>
): number {
  let bestIdx = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < palette.length; i++) {
    if (allowedIndices && !allowedIndices.has(i)) continue;
    const [pr, pg, pb] = palette[i];
    const dr = color[0] - pr;
    const dg = color[1] - pg;
    const db = color[2] - pb;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx >= 0 ? bestIdx : 0;
}

function toSlic3rMmuToken(colorIndex: number): string {
  // Prusa/Orca/Bambu ecosystem commonly stores MMU face paint as hex nibble + "C" (e.g. "0C", "1C").
  return `${Math.max(0, colorIndex).toString(16).toUpperCase()}C`;
}



// ─── Vertex Welding ───────────────────────────────────────────────────────────

const WELD_PRECISION = 4; // decimal places — 0.0001mm tolerance

interface WeldedMesh {
  /** Unique vertex positions [x,y,z][] */
  vertices: [number, number, number][];
  /** Triangle indices [v0,v1,v2][] referencing the vertices array */
  triangles: [number, number, number][];
}

/**
 * Weld co-located vertices from a non-indexed BufferGeometry.
 * Creates an indexed mesh where shared edge vertices point to the same index.
 */
function weldVertices(
  posAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute
): WeldedMesh {
  const vertexCount = posAttr.count;
  const triCount = vertexCount / 3;

  const vertexMap = new Map<string, number>();
  const vertices: [number, number, number][] = [];
  const indexRemap = new Int32Array(vertexCount);

  for (let i = 0; i < vertexCount; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const key = `${x.toFixed(WELD_PRECISION)},${y.toFixed(
      WELD_PRECISION
    )},${z.toFixed(WELD_PRECISION)}`;

    let idx = vertexMap.get(key);
    if (idx === undefined) {
      idx = vertices.length;
      vertexMap.set(key, idx);
      vertices.push([x, y, z]);
    }
    indexRemap[i] = idx;
  }

  const triangles: [number, number, number][] = [];
  for (let t = 0; t < triCount; t++) {
    const base = t * 3;
    triangles.push([indexRemap[base], indexRemap[base + 1], indexRemap[base + 2]]);
  }

  return { vertices, triangles };
}

function getTriangleArea(v0: [number, number, number], v1: [number, number, number], v2: [number, number, number]): number {
  const ax = v1[0] - v0[0];
  const ay = v1[1] - v0[1];
  const az = v1[2] - v0[2];
  
  const bx = v2[0] - v0[0];
  const by = v2[1] - v0[1];
  const bz = v2[2] - v0[2];
  
  const crossX = ay * bz - az * by;
  const crossY = az * bx - ax * bz;
  const crossZ = ax * by - ay * bx;
  
  return 0.5 * Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);
}

// ─── Main Exporter ────────────────────────────────────────────────────────────

export function exportTo3MF(options: ThreeMFExportOptions): Blob {
  const {
    geometry: srcGeometry,
    zoneColors,
    selectedColorIndices,
    colorEncodingMode = "hybrid",
    includeSlic3rMmuSegmentation = true,
    colorZones = 1,
    objectName = "Vorea Relief",
  } = options;

  // Rotate from Three.js Y-up to slicer Z-up, keeping relief detail facing +Z.
  const geometry = srcGeometry.clone();
  geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));

  const posAttr = geometry.getAttribute("position");
  const colorAttr = geometry.getAttribute("color");
  const useColors = colorZones > 1 && !!colorAttr;
  const useStandardColorGroup = useColors && colorEncodingMode === "hybrid";
  const useSlic3rMmu = useColors && includeSlic3rMmuSegmentation;

  // ─── Weld vertices → indexed manifold mesh ─────────────────────
  const { vertices, triangles } = weldVertices(posAttr);

  // ─── Build <vertices> ──────────────────────────────────────────
  const vLines: string[] = [];
  for (const [x, y, z] of vertices) {
    vLines.push(
      `        <vertex x="${x.toFixed(WELD_PRECISION)}" y="${y.toFixed(
        WELD_PRECISION
      )}" z="${z.toFixed(WELD_PRECISION)}"/>`
    );
  }

  // ─── Per-triangle colors ───────────────────────────────────────
  const triColorIndices: number[] = [];
  const colorList: string[] = [];
  const colorMapDedupe = new Map<string, number>();

  const exportPalette =
    Array.isArray(zoneColors) && zoneColors.length > 0 ? zoneColors : null;
  const selectedSet =
    exportPalette &&
    Array.isArray(selectedColorIndices) &&
    selectedColorIndices.length > 0
      ? new Set(
          selectedColorIndices.filter(
            (idx) => Number.isInteger(idx) && idx >= 0 && idx < exportPalette.length
          )
        )
      : null;

  if (useColors && colorAttr) {
    for (let t = 0; t < triangles.length; t++) {
      const v0 = t * 3; // index into original non-indexed geometry
      const rLinear =
        (colorAttr.getX(v0) + colorAttr.getX(v0 + 1) + colorAttr.getX(v0 + 2)) / 3;
      const gLinear =
        (colorAttr.getY(v0) + colorAttr.getY(v0 + 1) + colorAttr.getY(v0 + 2)) / 3;
      const bLinear =
        (colorAttr.getZ(v0) + colorAttr.getZ(v0 + 1) + colorAttr.getZ(v0 + 2)) / 3;
      const r = linearToSrgb(rLinear);
      const g = linearToSrgb(gLinear);
      const b = linearToSrgb(bLinear);
      let final: [number, number, number] = [r, g, b];
      if (exportPalette) {
        const baseIdx = closestColorIndex([r, g, b], exportPalette);
        const finalIdx =
          selectedSet && selectedSet.size > 0 && !selectedSet.has(baseIdx)
            ? closestColorIndex(exportPalette[baseIdx], exportPalette, selectedSet)
            : baseIdx;
        final = exportPalette[finalIdx];
      }
      const hex = rgbToSRGB(final[0], final[1], final[2]);
      if (!colorMapDedupe.has(hex)) {
        colorMapDedupe.set(hex, colorList.length);
        colorList.push(hex);
      }
      triColorIndices.push(colorMapDedupe.get(hex)!);
    }
  }

  // ─── Build <triangles> (with welded indices) ──────────────────
  const triLines: string[] = [];
  for (let t = 0; t < triangles.length; t++) {
    const [v0, v1, v2] = triangles[t];
    
    // Exact geometric area filter for degenerate triangles warning
    if (v0 === v1 || v1 === v2 || v2 === v0) continue;
    if (getTriangleArea(vertices[v0], vertices[v1], vertices[v2]) < 1e-8) {
      continue;
    }

    if (useColors) {
      const stdColorAttrs = useStandardColorGroup
        ? ` pid="1" p1="${triColorIndices[t]}" p2="${triColorIndices[t]}" p3="${triColorIndices[t]}"`
        : "";
      const mmuAttr = useSlic3rMmu
        ? ` slic3rpe:mmu_segmentation="${toSlic3rMmuToken(triColorIndices[t])}"`
        : "";
      triLines.push(
        `        <triangle v1="${v0}" v2="${v1}" v3="${v2}"${stdColorAttrs}${mmuAttr}/>`
      );
    } else {
      triLines.push(`        <triangle v1="${v0}" v2="${v1}" v3="${v2}"/>`);
    }
  }

  // ─── Build colorgroup (if colored) ────────────────────────────
  let colorGroupXml = "";
  if (useStandardColorGroup && colorList.length > 0) {
    const colorItems = colorList
      .map((hex) => `      <m:color color="${hex}"/>`)
      .join("\n");
    colorGroupXml = `
  <resources>
    <m:colorgroup id="1">
${colorItems}
    </m:colorgroup>`;
  } else {
    colorGroupXml = `\n  <resources>`;
  }

  const slic3rMetadataXml = useSlic3rMmu
    ? `
  <metadata name="slic3rpe:Version3mf">1</metadata>
  <metadata name="slic3rpe:MmPaintingVersion">1</metadata>
  <metadata name="Application">Vorea Studio</metadata>`
    : "";

  let objectsXml = "";
  let buildItemsXml = "";

  objectsXml = `    <object id="2" name="${objectName}" type="model"${
    useStandardColorGroup ? ' pid="1" pindex="0"' : ""
  }>
    <mesh>
      <vertices>
${vLines.join("\n")}
      </vertices>
      <triangles>
${triLines.join("\n")}
      </triangles>
    </mesh>
  </object>`;
  buildItemsXml = `    <item objectid="2"/>`;

  // ─── Build model XML ───────────────────────────────────────────
  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US"
  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
  ${
    useStandardColorGroup
      ? `xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"`
      : ""
  }${
    useSlic3rMmu ? `\n  xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06"` : ""
  }${
    useStandardColorGroup ? ` requiredextensions="m"` : ""
  }>
${slic3rMetadataXml}
${colorGroupXml}
${objectsXml}
  </resources>
  <build>
${buildItemsXml}
  </build>
</model>`;

  const files = {
    "[Content_Types].xml": strToU8(CONTENT_TYPES),
    "_rels/.rels": strToU8(RELS),
    "3D/3dmodel.model": strToU8(modelXml),
  };

  const zipped = zipSync(files, { level: 6 });
  geometry.dispose();
  return new Blob([zipped.buffer.slice(0) as ArrayBuffer], {
    type: "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
  });
}

// ─── STL Export (binary, triangle soup) ──────────────────────────────────────

/**
 * Export BufferGeometry to binary STL.
 * We rotate to Z-up and emit one normal per face.
 */
export function exportToSTL(
  srcGeometry: THREE.BufferGeometry,
  headerText = "Vorea Studio Relief"
): Blob {
  const geometry = srcGeometry.clone();
  geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  geometry.computeVertexNormals();

  const posAttr = geometry.getAttribute("position");
  const triCount = posAttr.count / 3;
  const buffer = new ArrayBuffer(80 + 4 + triCount * 50);
  const view = new DataView(buffer);

  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < headerText.length ? headerText.charCodeAt(i) : 0);
  }
  view.setUint32(80, triCount, true);

  let off = 84;
  for (let t = 0; t < triCount; t++) {
    const i = t * 3;
    const ax = posAttr.getX(i);
    const ay = posAttr.getY(i);
    const az = posAttr.getZ(i);
    const bx = posAttr.getX(i + 1);
    const by = posAttr.getY(i + 1);
    const bz = posAttr.getZ(i + 1);
    const cx = posAttr.getX(i + 2);
    const cy = posAttr.getY(i + 2);
    const cz = posAttr.getZ(i + 2);

    // Normal = (B-A) × (C-A)
    const e1x = bx - ax;
    const e1y = by - ay;
    const e1z = bz - az;
    const e2x = cx - ax;
    const e2y = cy - ay;
    const e2z = cz - az;
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 1e-10) {
      nx /= len;
      ny /= len;
      nz /= len;
    }

    view.setFloat32(off, nx, true);
    off += 4;
    view.setFloat32(off, ny, true);
    off += 4;
    view.setFloat32(off, nz, true);
    off += 4;

    for (let v = 0; v < 3; v++) {
      view.setFloat32(off, posAttr.getX(i + v), true);
      off += 4;
      view.setFloat32(off, posAttr.getY(i + v), true);
      off += 4;
      view.setFloat32(off, posAttr.getZ(i + v), true);
      off += 4;
    }
    view.setUint16(off, 0, true);
    off += 2;
  }

  geometry.dispose();
  return new Blob([buffer], { type: "application/octet-stream" });
}

// ─── Download Helpers ─────────────────────────────────────────────────────────

export function download3MF(blob: Blob, filename = "relieve-vorea.3mf"): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
