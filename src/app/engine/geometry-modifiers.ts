/**
 * Geometry Modifiers — Post-compilation surface effects for 3D meshes.
 *
 * Applies Worley-based displacement or lattice conversion to any
 * Three.js BufferGeometry after CSG compilation. Works as a cross-model
 * modifier: design a Voronoi preset, export it, apply to any base shape.
 *
 * Modifier pipeline:
 *   CSG compile → BufferGeometry → displaceGeometry() → render
 *
 * Ported & enhanced from Vorea Parametrics 3D.
 *
 * Vorea Studio — voreastudio.com
 */

import * as THREE from "three";
import { createWorleyNoise3D, type WorleyMetric } from "./worley";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Distance interpretation for surface displacement. */
export type CellStyle = "sphere" | "cylinder" | "cube";

/** Output mode for the modifier. */
export type ModifierMode = "surface" | "lattice";

/** Full modifier configuration (serializable to/from JSON). */
export interface ModifierConfig {
  /** Whether the modifier is enabled. */
  enabled: boolean;
  /** Output mode: surface displacement or lattice wireframe. */
  mode: ModifierMode;
  /** Worley distance interpretation. */
  cellStyle: CellStyle;
  /** Number of Voronoi cells (affects noise frequency). */
  cellCount: number;
  /** Random seed for reproducible patterns. */
  seed: number;
  /** Wall thickness / displacement amplitude (mm). */
  wallThickness: number;
  /** Reference diameter for frequency scaling (mm). */
  diameter: number;
  /** Distance metric for Worley evaluation. */
  metric: WorleyMetric;
  /** Tube radius for lattice mode (mm). */
  tubeRadius: number;
  /** Number of radial segments per tube in lattice mode. */
  tubeSegments: number;
}

/** Serializable preset format for import/export. */
export interface ModifierPreset {
  /** Identifier for validation. */
  type: "vorea-modifier-preset";
  /** Preset format version. */
  version: 1;
  /** ISO date of export. */
  exportDate: string;
  /** Human-readable name. */
  name: string;
  /** The modifier configuration. */
  config: ModifierConfig;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_MODIFIER: ModifierConfig = {
  enabled: false,
  mode: "surface",
  cellStyle: "sphere",
  cellCount: 40,
  seed: 42,
  wallThickness: 2.0,
  diameter: 80,
  metric: "euclidean",
  tubeRadius: 0.8,
  tubeSegments: 6,
};

// ─── Quick Presets ────────────────────────────────────────────────────────────

export const MODIFIER_PRESETS: Record<string, { label: string; config: Partial<ModifierConfig> }> = {
  organic_cells: {
    label: "Organic Cells",
    config: {
      enabled: true, mode: "surface", cellStyle: "sphere",
      cellCount: 35, seed: 42, wallThickness: 2.5, diameter: 80,
    },
  },
  cracked_surface: {
    label: "Cracked Surface",
    config: {
      enabled: true, mode: "surface", cellStyle: "cube",
      cellCount: 50, seed: 17, wallThickness: 1.8, diameter: 80,
    },
  },
  faceted_bumps: {
    label: "Faceted Bumps",
    config: {
      enabled: true, mode: "surface", cellStyle: "cylinder",
      cellCount: 25, seed: 99, wallThickness: 3.0, diameter: 80,
    },
  },
  fine_lattice: {
    label: "Fine Lattice",
    config: {
      enabled: true, mode: "lattice", cellStyle: "sphere",
      cellCount: 60, seed: 55, wallThickness: 2.0, diameter: 80,
      tubeRadius: 0.5, tubeSegments: 4,
    },
  },
  bold_lattice: {
    label: "Bold Lattice",
    config: {
      enabled: true, mode: "lattice", cellStyle: "cube",
      cellCount: 30, seed: 77, wallThickness: 3.0, diameter: 80,
      tubeRadius: 1.2, tubeSegments: 6,
    },
  },
};

// ─── Core: displaceGeometry ───────────────────────────────────────────────────

/**
 * Apply Worley-noise surface displacement or lattice conversion to a geometry.
 *
 * @param geom   Source BufferGeometry (not mutated — cloned internally).
 * @param config Modifier configuration.
 * @returns      New BufferGeometry with the modifier applied.
 */
export function displaceGeometry(
  geom: THREE.BufferGeometry,
  config: ModifierConfig,
): THREE.BufferGeometry {
  if (!config.enabled) return geom;

  // Frequency: more cells = higher frequency, larger diameter = lower
  const freq =
    Math.pow(config.cellCount / 100, 0.4) * (150 / config.diameter);

  const evaluate = createWorleyNoise3D(config.seed, config.metric);

  if (config.mode === "lattice") {
    return buildLattice(geom, config, freq, evaluate);
  }

  return applySurfaceDisplacement(geom, config, freq, evaluate);
}

// ─── Surface Displacement ─────────────────────────────────────────────────────

function applySurfaceDisplacement(
  geom: THREE.BufferGeometry,
  config: ModifierConfig,
  freq: number,
  evaluate: ReturnType<typeof createWorleyNoise3D>,
): THREE.BufferGeometry {
  const displaced = geom.clone();
  const pos = displaced.attributes.position as THREE.BufferAttribute;
  const norm = displaced.attributes.normal as THREE.BufferAttribute;

  if (!norm) {
    displaced.computeVertexNormals();
  }
  const nAttr = (displaced.attributes.normal as THREE.BufferAttribute);

  // Boundary Y for flat top/bottom preservation
  displaced.computeBoundingBox();
  const minY = displaced.boundingBox?.min.y ?? 0;
  const maxY = displaced.boundingBox?.max.y ?? 0;

  const wt = config.wallThickness;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const nx = nAttr.getX(i);
    const ny = nAttr.getY(i);
    const nz = nAttr.getZ(i);

    const w = evaluate(x * freq, y * freq, z * freq);

    let d = 0;
    if (config.cellStyle === "sphere") {
      d = -w.f1 * wt * 2; // F1 dimples
    } else if (config.cellStyle === "cylinder") {
      d = w.f2 * wt; // F2 bumps
    } else {
      d = w.edge * wt * 1.5; // Edge cracks
    }

    let dx = nx * d;
    let dy = ny * d;
    let dz = nz * d;

    // Keep top/bottom faces flat (boolean-cut appearance)
    if (Math.abs(y - minY) < 0.1 || Math.abs(y - maxY) < 0.1) {
      dy = 0;
    }

    pos.setXYZ(i, x + dx, y + dy, z + dz);
  }

  displaced.computeVertexNormals();
  return displaced;
}

// ─── Lattice Mode ─────────────────────────────────────────────────────────────

function buildLattice(
  geom: THREE.BufferGeometry,
  config: ModifierConfig,
  freq: number,
  evaluate: ReturnType<typeof createWorleyNoise3D>,
): THREE.BufferGeometry {
  // Extract wireframe edges
  const edges = new THREE.WireframeGeometry(geom);
  const edgePos = edges.attributes.position as THREE.BufferAttribute;
  const wt = config.wallThickness;

  // Displace edge vertices with Worley
  for (let i = 0; i < edgePos.count; i++) {
    const x = edgePos.getX(i);
    const y = edgePos.getY(i);
    const z = edgePos.getZ(i);

    const w = evaluate(x * freq, y * freq, z * freq);

    let d = 0;
    if (config.cellStyle === "sphere") {
      d = -w.f1 * wt * 2;
    } else if (config.cellStyle === "cylinder") {
      d = w.f2 * wt;
    } else {
      d = w.edge * wt * 1.5;
    }

    // Simplified radial normal (expand from Y axis)
    const len = Math.sqrt(x * x + z * z) || 1;
    edgePos.setXYZ(i, x + (x / len) * d, y, z + (z / len) * d);
  }

  // Convert line segments to 3D-printable tubes
  const positions: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  const tubeRadius = Math.max(0.3, config.tubeRadius);
  const radialSegs = Math.max(3, config.tubeSegments);

  for (let i = 0; i < edgePos.count; i += 2) {
    const p1 = new THREE.Vector3().fromBufferAttribute(edgePos, i);
    const p2 = new THREE.Vector3().fromBufferAttribute(edgePos, i + 1);

    // Skip degenerate segments
    if (p1.distanceToSquared(p2) < 0.01) continue;

    const path = new THREE.LineCurve3(p1, p2);
    const tube = new THREE.TubeGeometry(path, 1, tubeRadius, radialSegs, false);

    const tubePosArr = tube.attributes.position.array;
    const tubeIdxArr = tube.index?.array;

    for (let v = 0; v < tubePosArr.length; v++) {
      positions.push(tubePosArr[v]);
    }
    if (tubeIdxArr) {
      for (let id = 0; id < tubeIdxArr.length; id++) {
        indices.push(tubeIdxArr[id] + vertexOffset);
      }
    }
    vertexOffset += tubePosArr.length / 3;

    tube.dispose();
  }

  edges.dispose();

  const lattice = new THREE.BufferGeometry();
  lattice.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  if (indices.length > 0) {
    lattice.setIndex(indices);
  }
  lattice.computeVertexNormals();
  return lattice;
}

// ─── Preset I/O ───────────────────────────────────────────────────────────────

/** Export a modifier config as a JSON preset blob. */
export function exportModifierPreset(
  config: ModifierConfig,
  name: string = "Custom Preset",
): Blob {
  const preset: ModifierPreset = {
    type: "vorea-modifier-preset",
    version: 1,
    exportDate: new Date().toISOString(),
    name,
    config,
  };
  return new Blob([JSON.stringify(preset, null, 2)], {
    type: "application/json",
  });
}

/** Parse a JSON preset file. Returns null if invalid. */
export function parseModifierPreset(json: string): ModifierConfig | null {
  try {
    const data = JSON.parse(json);
    if (data?.type !== "vorea-modifier-preset" || data?.version !== 1) {
      return null;
    }
    const c = data.config;
    if (
      typeof c?.cellCount !== "number" ||
      typeof c?.seed !== "number" ||
      typeof c?.wallThickness !== "number"
    ) {
      return null;
    }
    // Merge with defaults for forward-compatibility
    return { ...DEFAULT_MODIFIER, ...c, enabled: true };
  } catch {
    return null;
  }
}
