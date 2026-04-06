/// <reference lib="webworker" />

import { generateHeightmapMesh } from "./heightmap-generator";
import type { HeightmapOptions } from "./heightmap-generator";

// Infer input structure from options, omitting complex types that can't be cloned
export interface WorkerPayload extends Omit<HeightmapOptions, 'image'> {
  imageData: Uint8ClampedArray;
  imageWidth: number;
  imageHeight: number;
}

self.onmessage = (e: MessageEvent<WorkerPayload>) => {
  try {
    const payload = e.data;

    // 1. Reconstruct the DecodedImage expected by the generator
    const decodedImage = {
      data: payload.imageData,
      width: payload.imageWidth,
      height: payload.imageHeight,
    };

    // 2. Call the generator synchronously (inside this worker thread)
    const result = generateHeightmapMesh({
      ...payload,
      image: decodedImage,
    });

    // 3. Extract the raw typed arrays from the generated THREE.BufferGeometry
    // We cannot send complex class instances across the worker boundary.
    const posAttr = result.geometry.getAttribute("position");
    const normAttr = result.geometry.getAttribute("normal");
    const colAttr = result.geometry.getAttribute("color");

    const positions = posAttr ? new Float32Array(posAttr.array) : new Float32Array();
    const normals = normAttr ? new Float32Array(normAttr.array) : new Float32Array();
    const colors = colAttr ? new Float32Array(colAttr.array) : new Float32Array();

    // Do NOT send the whole geometry object. Just the arrays and scalars.
    const message = {
      status: "success",
      positions,
      normals,
      colors,
      
      // Scalars from HeightmapResult
      cols: result.cols,
      gridW: result.gridW,
      gridH: result.gridH,
      faceCount: result.faceCount,
      generationTimeMs: result.generationTimeMs,
      colorZones: result.colorZones,
      hasVertexColors: result.hasVertexColors,
      palette: result.palette,
      surfaceMode: result.surfaceMode,
    };

    // 4. Transfer the memory ownership of these large arrays to the main thread
    // This is virtually instantaneous compared to cloning.
    self.postMessage(message, {
      transfer: [positions.buffer, normals.buffer, colors.buffer]
    });

  } catch (error) {
    if (error instanceof Error) {
      self.postMessage({ status: "error", error: error.message });
    } else {
      self.postMessage({ status: "error", error: "Desconocido: Fallo en WebWorker" });
    }
  }
};
