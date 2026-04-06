/**
 * Web Worker for STL Surface Processing
 *
 * Runs the heavy STL raycasting (extractDepthField) off the main thread
 * to keep the UI fully responsive during processing.
 *
 * Vorea Studio — voreastudio.com
 */

import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkerInput {
  stlBuffer: ArrayBuffer;
  gridW: number;
  gridH: number;
}

interface WorkerOutput {
  depthField: Float32Array;
  normalField: Float32Array;
  validMask: Uint8Array;
  width: number;
  depth: number;
  baseOffset: number;
}

// ─── extractDepthField (self-contained for worker) ───────────────────────────

function extractDepthField(
  geometry: THREE.BufferGeometry,
  gridW: number,
  gridH: number,
): WorkerOutput {
  // Clone geometry so we don't mutate
  const geo = geometry.clone();
  geo.computeBoundingBox();
  geo.computeVertexNormals();
  const origBbox = geo.boundingBox!;
  const origSize = new THREE.Vector3();
  origBbox.getSize(origSize);

  // Auto-detect optimal projection axis (largest extent → Y)
  const dims = [origSize.x, origSize.y, origSize.z];
  const maxDim = Math.max(...dims);

  if (maxDim === dims[2]) {
    geo.rotateX(-Math.PI / 2);
  } else if (maxDim === dims[0]) {
    geo.rotateZ(Math.PI / 2);
  }

  geo.computeBoundingBox();
  geo.computeVertexNormals();
  const bbox = geo.boundingBox!;
  const size = new THREE.Vector3();
  bbox.getSize(size);

  const cols = gridW + 1;
  const rows = gridH + 1;
  const depthField = new Float32Array(cols * rows);
  const normalField = new Float32Array(cols * rows * 3);
  const validMask = new Uint8Array(cols * rows);

  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, material);

  const raycaster = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3();
  const rayDir = new THREE.Vector3(0, -1, 0);

  const padX = size.x * 0.02;
  const padZ = size.z * 0.02;
  const startX = bbox.min.x - padX;
  const startZ = bbox.min.z - padZ;
  const rangeX = size.x + padX * 2;
  const rangeZ = size.z + padZ * 2;
  const rayStartY = bbox.max.y + 1;

  let minHit = Infinity;

  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const u = ix / gridW;
      const v = iy / gridH;
      rayOrigin.set(startX + u * rangeX, rayStartY, startZ + v * rangeZ);
      raycaster.set(rayOrigin, rayDir);

      const hits = raycaster.intersectObject(mesh, false);
      const idx = iy * cols + ix;

      if (hits.length > 0) {
        const hit = hits[0];
        depthField[idx] = hit.point.y;
        validMask[idx] = 1;
        if (hit.point.y < minHit) minHit = hit.point.y;
        const face = hit.face;
        if (face) {
          normalField[idx * 3]     = face.normal.x;
          normalField[idx * 3 + 1] = face.normal.y;
          normalField[idx * 3 + 2] = face.normal.z;
        } else {
          normalField[idx * 3]     = 0;
          normalField[idx * 3 + 1] = 1;
          normalField[idx * 3 + 2] = 0;
        }
      } else {
        depthField[idx] = NaN;
        validMask[idx] = 0;
        normalField[idx * 3]     = 0;
        normalField[idx * 3 + 1] = 1;
        normalField[idx * 3 + 2] = 0;
      }
    }

    // Post progress every 10 rows
    if (iy % 10 === 0) {
      self.postMessage({ type: "progress", percent: Math.round((iy / rows) * 100) });
    }
  }

  // Fix NaN entries
  if (!isFinite(minHit)) minHit = 0;
  for (let i = 0; i < depthField.length; i++) {
    if (isNaN(depthField[i])) depthField[i] = minHit;
  }

  // Normalize
  for (let i = 0; i < depthField.length; i++) {
    depthField[i] -= minHit;
  }

  // Depth discontinuity filter
  let maxDepth = 0;
  for (let i = 0; i < depthField.length; i++) {
    if (validMask[i] && depthField[i] > maxDepth) maxDepth = depthField[i];
  }
  const threshold = maxDepth * 0.12;
  if (threshold > 0) {
    const maskCopy = new Uint8Array(validMask);
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const idx = iy * cols + ix;
        if (!maskCopy[idx]) continue;
        const d = depthField[idx];
        const neighbors: number[] = [];
        if (ix > 0)     neighbors.push(depthField[idx - 1]);
        if (ix < gridW) neighbors.push(depthField[idx + 1]);
        if (iy > 0)     neighbors.push(depthField[idx - cols]);
        if (iy < gridH) neighbors.push(depthField[idx + cols]);
        for (const nd of neighbors) {
          if (Math.abs(d - nd) > threshold) {
            validMask[idx] = 0;
            break;
          }
        }
      }
    }
  }

  material.dispose();
  geo.dispose();

  return { depthField, normalField, validMask, width: rangeX, depth: rangeZ, baseOffset: minHit };
}

// ─── Worker message handler ──────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  try {
    const { stlBuffer, gridW, gridH } = e.data;

    // Parse STL
    const loader = new STLLoader();
    const geometry = loader.parse(stlBuffer);

    // Extract depth field (heavy computation)
    const result = extractDepthField(geometry, gridW, gridH);
    geometry.dispose();

    // Transfer buffers back (zero-copy)
    self.postMessage(
      { type: "result", ...result },
      // @ts-ignore — transferable list
      [result.depthField.buffer, result.normalField.buffer, result.validMask.buffer]
    );
  } catch (err: any) {
    self.postMessage({ type: "error", message: err?.message || "Unknown error" });
  }
};
