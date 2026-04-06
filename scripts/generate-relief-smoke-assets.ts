import fs from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";

import {
  generateHeightmapMesh,
  type HeightmapOptions,
  type RGB,
} from "../src/app/engine/heightmap-generator.ts";
import type { DecodedImage } from "../src/app/engine/image-registry.ts";
import {
  exportTo3MF,
  exportToSTL,
  type ThreeMFExportOptions,
} from "../src/app/engine/threemf-exporter.ts";

const FIXTURE_SVG_RELATIVE_PATH = "public/qa-assets/relief-smoke-four-zones.svg";
const OUTPUT_RELATIVE_DIR = "public/qa-assets/relief-smoke";
const RASTER_SIZE = 96;

type SmokeCaseId =
  | "plane-hybrid"
  | "cylinder-slic3r-strict"
  | "plane-split-objects";

interface SmokeCase {
  id: SmokeCaseId;
  presetId: "plane-balanced" | "cylinder-bambu";
  description: string;
  surfaceMode: "plane" | "cylinder";
  colorEncodingMode: NonNullable<ThreeMFExportOptions["colorEncodingMode"]>;
  outputBasename: string;
  options: HeightmapOptions;
}

interface SmokeManifestCase {
  id: SmokeCaseId;
  presetId: SmokeCase["presetId"];
  description: string;
  surfaceMode: SmokeCase["surfaceMode"];
  colorEncodingMode: SmokeCase["colorEncodingMode"];
  file3mf: string;
  fileStl: string;
  faceCount: number;
  generationTimeMs: number;
  palette: string[];
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
}

function toHexByte(value: number): string {
  const hex = Math.max(0, Math.min(255, Math.round(value))).toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
}

function rgbToHex(rgb: RGB): string {
  return `#${toHexByte(rgb[0] * 255)}${toHexByte(rgb[1] * 255)}${toHexByte(rgb[2] * 255)}`;
}

function roundNumber(value: number): number {
  return Number(value.toFixed(4));
}

function blendChannel(base: number, overlay: number, alpha: number): number {
  return Math.round(base * (1 - alpha) + overlay * alpha);
}

function createFixtureRaster(size: number): DecodedImage {
  const data = new Uint8ClampedArray(size * size * 4);
  const half = size / 2;
  const colors = {
    dark: [0x11, 0x11, 0x11] as const,
    red: [0xd9, 0x34, 0x2b] as const,
    green: [0x2b, 0x9d, 0x4b] as const,
    light: [0xf5, 0xf5, 0xf5] as const,
    blue: [0x2a, 0x62, 0xd5] as const,
    gold: [0xf0, 0xc9, 0x4c] as const,
  };

  const setPixel = (x: number, y: number, rgb: readonly [number, number, number]) => {
    const offset = (y * size + x) * 4;
    data[offset] = rgb[0];
    data[offset + 1] = rgb[1];
    data[offset + 2] = rgb[2];
    data[offset + 3] = 255;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let base: readonly [number, number, number];
      if (x < half && y < half) {
        base = colors.dark;
      } else if (x >= half && y < half) {
        base = colors.red;
      } else if (x < half && y >= half) {
        base = colors.green;
      } else {
        base = colors.light;
      }

      const canvasX = ((x + 0.5) / size) * 512;
      const canvasY = ((y + 0.5) / size) * 512;
      let current = [...base] as [number, number, number];

      const dx = canvasX - 256;
      const dy = canvasY - 256;
      if (Math.hypot(dx, dy) <= 86) {
        const alpha = 0.92;
        current = [
          blendChannel(current[0], colors.blue[0], alpha),
          blendChannel(current[1], colors.blue[1], alpha),
          blendChannel(current[2], colors.blue[2], alpha),
        ];
      }

      const withinRect =
        canvasX >= 60 &&
        canvasX <= 452 &&
        canvasY >= 60 &&
        canvasY <= 452;
      const strokeDistance = Math.min(
        Math.abs(canvasX - 60),
        Math.abs(canvasX - 452),
        Math.abs(canvasY - 60),
        Math.abs(canvasY - 452)
      );
      if (withinRect && strokeDistance <= 18) {
        current = [...colors.gold];
      }

      setPixel(x, y, current);
    }
  }

  return { width: size, height: size, data };
}

function buildBaseOptions(image: DecodedImage): HeightmapOptions {
  return {
    image,
    subdivisions: 600,
    maxHeight: 1.2,
    smoothing: 1,
    imageScale: 1,
    imageScaleMode: "clamp",
    imageRepeatX: true,
    imageRepeatY: true,
    gapFillMode: "color-hard",
    gapFillColor: [1, 1, 1],
    width: 100,
    depth: 100,
    surfaceMode: "plane",
    cylinderRadius: 140,
    cylinderRepeats: 4,
    cylinderHeight: 200,
    cylinderFlipH: true,
    cylinderFlipV: true,
    invert: true,
    solid: true,
    baseThickness: 2,
    colorZones: 4,
  };
}

function buildSmokeCases(image: DecodedImage): SmokeCase[] {
  const baseOptions = buildBaseOptions(image);

  return [
    {
      id: "plane-hybrid",
      presetId: "plane-balanced",
      description: "Plano balanceado en 3MF hybrid para Orca/Bambu.",
      surfaceMode: "plane",
      colorEncodingMode: "hybrid",
      outputBasename: "relief-plane-hybrid",
      options: {
        ...baseOptions,
        surfaceMode: "plane",
      },
    },
    {
      id: "cylinder-slic3r-strict",
      presetId: "cylinder-bambu",
      description: "Cilindro Bambu/Orca en 3MF slic3r-strict.",
      surfaceMode: "cylinder",
      colorEncodingMode: "slic3r-strict",
      outputBasename: "relief-cylinder-slic3r-strict",
      options: {
        ...baseOptions,
        surfaceMode: "cylinder",
        subdivisions: 750,
        maxHeight: 1,
      },
    },
    {
      id: "plane-split-objects",
      presetId: "plane-balanced",
      description: "Plano balanceado en 3MF split-objects como fallback.",
      surfaceMode: "plane",
      colorEncodingMode: "split-objects",
      outputBasename: "relief-plane-split-objects",
      options: {
        ...baseOptions,
        surfaceMode: "plane",
      },
    },
  ];
}

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main(): Promise<void> {
  const outputDir = path.resolve(import.meta.dirname, "..", OUTPUT_RELATIVE_DIR);
  await fs.mkdir(outputDir, { recursive: true });

  const image = createFixtureRaster(RASTER_SIZE);
  const smokeCases = buildSmokeCases(image);
  const manifestCases: SmokeManifestCase[] = [];

  for (const smokeCase of smokeCases) {
    const result = generateHeightmapMesh(smokeCase.options);
    result.geometry.computeBoundingBox();
    const bounds = result.geometry.boundingBox ?? new THREE.Box3();
    const selectedColorIndices = Array.from(
      { length: result.palette.length },
      (_, index) => index
    );
    const exportOptions: ThreeMFExportOptions = {
      geometry: result.geometry,
      colorZones: result.colorZones,
      zoneColors: result.palette,
      selectedColorIndices,
      colorEncodingMode: smokeCase.colorEncodingMode,
      includeSlic3rMmuSegmentation: smokeCase.colorEncodingMode !== "split-objects",
      objectName: `Relief Smoke ${smokeCase.id}`,
    };

    const threeMfBlob = exportTo3MF(exportOptions);
    const stlBlob = exportToSTL(result.geometry, `Smoke ${smokeCase.id}`);
    const threeMfBuffer = await blobToBuffer(threeMfBlob);
    const stlBuffer = await blobToBuffer(stlBlob);

    const relative3mf = `${OUTPUT_RELATIVE_DIR}/${smokeCase.outputBasename}.3mf`;
    const relativeStl = `${OUTPUT_RELATIVE_DIR}/${smokeCase.outputBasename}.stl`;

    await fs.writeFile(path.join(outputDir, `${smokeCase.outputBasename}.3mf`), threeMfBuffer);
    await fs.writeFile(path.join(outputDir, `${smokeCase.outputBasename}.stl`), stlBuffer);

    manifestCases.push({
      id: smokeCase.id,
      presetId: smokeCase.presetId,
      description: smokeCase.description,
      surfaceMode: smokeCase.surfaceMode,
      colorEncodingMode: smokeCase.colorEncodingMode,
      file3mf: relative3mf,
      fileStl: relativeStl,
      faceCount: result.faceCount,
      generationTimeMs: roundNumber(result.generationTimeMs),
      palette: result.palette.map(rgbToHex),
      bounds: {
        min: [
          roundNumber(bounds.min.x),
          roundNumber(bounds.min.y),
          roundNumber(bounds.min.z),
        ],
        max: [
          roundNumber(bounds.max.x),
          roundNumber(bounds.max.y),
          roundNumber(bounds.max.z),
        ],
      },
    });

    result.geometry.dispose();
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceFixtureSvg: FIXTURE_SVG_RELATIVE_PATH,
    rasterizedFixture: {
      size: `${RASTER_SIZE}x${RASTER_SIZE}`,
      note:
        "Synthetic raster approximating the four-quadrant SVG plus central blue circle and gold frame.",
    },
    outputDirectory: OUTPUT_RELATIVE_DIR,
    cases: manifestCases,
  };

  await fs.writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf-8"
  );

  console.log(
    `[relief-smoke-assets] generated ${manifestCases.length} cases in ${OUTPUT_RELATIVE_DIR}`
  );
}

main().catch((error) => {
  console.error(
    `[relief-smoke-assets] generation failed: ${
      error instanceof Error ? error.stack ?? error.message : String(error)
    }`
  );
  process.exitCode = 1;
});
