/**
 * FullControl TypeScript Engine
 *
 * Port of FullControlXYZ's core concepts to TypeScript for browser-based
 * GCode generation. State-based approach: a design is a list of steps
 * that change the state of a 3D printer.
 *
 * Reference: https://github.com/FullControlXYZ/fullcontrol
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CORE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface FCPoint {
  kind: "point";
  x?: number;
  y?: number;
  z?: number;
  color?: [number, number, number];
}

export interface FCExtruder {
  kind: "extruder";
  on?: boolean;
  /** Filament diameter (mm) */
  diaFeed?: number;
  /** Relative extrusion mode */
  relative?: boolean;
}

export interface FCExtrusionGeometry {
  kind: "extrusion_geometry";
  areaModel?: "rectangle" | "stadium" | "circle" | "manual";
  width?: number;
  height?: number;
  diameter?: number;
  area?: number;
}

export interface FCPrinter {
  kind: "printer";
  printSpeed?: number;
  travelSpeed?: number;
}

export interface FCFan {
  kind: "fan";
  speedPercent?: number;
}

export interface FCHotend {
  kind: "hotend";
  temp?: number;
  wait?: boolean;
}

export interface FCBuildplate {
  kind: "buildplate";
  temp?: number;
  wait?: boolean;
}

export interface FCComment {
  kind: "comment";
  text: string;
}

export interface FCManualGcode {
  kind: "manual_gcode";
  text: string;
}

export interface FCRetract {
  kind: "retract";
}

export interface FCUnretract {
  kind: "unretract";
}

/** Union of all step types */
export type FCStep =
  | FCPoint
  | FCExtruder
  | FCExtrusionGeometry
  | FCPrinter
  | FCFan
  | FCHotend
  | FCBuildplate
  | FCComment
  | FCManualGcode
  | FCRetract
  | FCUnretract;

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIENCE CONSTRUCTORS
// ═══════════════════════════════════════════════════════════════════════════════

export function point(x?: number, y?: number, z?: number): FCPoint {
  return { kind: "point", x, y, z };
}

export function extruderOn(): FCExtruder {
  return { kind: "extruder", on: true };
}

export function extruderOff(): FCExtruder {
  return { kind: "extruder", on: false };
}

export function travelTo(x: number, y: number, z?: number): FCStep[] {
  return [
    extruderOff(),
    point(x, y, z),
    extruderOn(),
  ];
}

export function comment(text: string): FCComment {
  return { kind: "comment", text };
}

export function manualGcode(text: string): FCManualGcode {
  return { kind: "manual_gcode", text };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEOMETRY FUNCTIONS (FullControl-style)
// ═══════════════════════════════════════════════════════════════════════════════

export function circleXY(
  cx: number, cy: number, z: number,
  radius: number, segments = 64, startAngle = 0
): FCPoint[] {
  const points: FCPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + (i / segments) * Math.PI * 2;
    points.push(point(
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle),
      z
    ));
  }
  return points;
}

export function rectangleXY(
  x: number, y: number, z: number,
  width: number, height: number
): FCPoint[] {
  return [
    point(x, y, z),
    point(x + width, y, z),
    point(x + width, y + height, z),
    point(x, y + height, z),
    point(x, y, z),
  ];
}

export function spiralXY(
  cx: number, cy: number,
  startRadius: number, endRadius: number,
  startZ: number, endZ: number,
  turns: number, segments: number
): FCPoint[] {
  const points: FCPoint[] = [];
  const totalSegments = Math.round(turns * segments);
  for (let i = 0; i <= totalSegments; i++) {
    const t = i / totalSegments;
    const angle = t * turns * Math.PI * 2;
    const r = startRadius + (endRadius - startRadius) * t;
    const z = startZ + (endZ - startZ) * t;
    points.push(point(
      cx + r * Math.cos(angle),
      cy + r * Math.sin(angle),
      z
    ));
  }
  return points;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════════

interface PrinterState {
  x: number;
  y: number;
  z: number;
  extruding: boolean;
  printSpeed: number;
  travelSpeed: number;
  fanSpeed: number;
  hotendTemp: number;
  bedTemp: number;
  filamentDia: number;
  extrusionWidth: number;
  layerHeight: number;
  extrusionArea: number;
  totalE: number;
  relativeE: boolean;
  retracted: boolean;
  retractLength: number;
  retractSpeed: number;
}

function defaultState(): PrinterState {
  return {
    x: 0, y: 0, z: 0,
    extruding: true,
    printSpeed: 1200, // mm/min
    travelSpeed: 3000,
    fanSpeed: 0,
    hotendTemp: 200,
    bedTemp: 60,
    filamentDia: 1.75,
    extrusionWidth: 0.4,
    layerHeight: 0.2,
    extrusionArea: 0.4 * 0.2, // width * height
    totalE: 0,
    relativeE: true,
    retracted: false,
    retractLength: 1.0,
    retractSpeed: 2400,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GCODE CONTROLS
// ═══════════════════════════════════════════════════════════════════════════════

export interface GCodeControls {
  printerName?: string;
  /** Nozzle temperature */
  nozzleTemp?: number;
  /** Bed temperature */
  bedTemp?: number;
  /** Layer height (mm) */
  layerHeight?: number;
  /** Extrusion width (mm) */
  extrusionWidth?: number;
  /** Print speed (mm/min) */
  printSpeed?: number;
  /** Travel speed (mm/min) */
  travelSpeed?: number;
  /** Filament diameter (mm) */
  filamentDia?: number;
  /** Fan speed % after first layers */
  fanSpeed?: number;
  /** Number of fan ramp-up layers */
  fanRampLayers?: number;
  /** Retraction distance (mm) */
  retractLength?: number;
  /** Retraction speed (mm/min) */
  retractSpeed?: number;
  /** Include start gcode */
  includeStartGcode?: boolean;
  /** Include end gcode */
  includeEndGcode?: boolean;
}

const DEFAULT_CONTROLS: Required<GCodeControls> = {
  printerName: "generic",
  nozzleTemp: 200,
  bedTemp: 60,
  layerHeight: 0.2,
  extrusionWidth: 0.4,
  printSpeed: 1200,
  travelSpeed: 3000,
  filamentDia: 1.75,
  fanSpeed: 100,
  fanRampLayers: 3,
  retractLength: 1.0,
  retractSpeed: 2400,
  includeStartGcode: true,
  includeEndGcode: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// GCODE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export interface GCodeResult {
  gcode: string;
  lines: number;
  estimatedTimeMin: number;
  filamentUsedMm: number;
  layerCount: number;
}

/**
 * Convert a list of FullControl steps into GCode.
 */
export function stepsToGCode(
  steps: FCStep[],
  controls?: GCodeControls
): GCodeResult {
  const cfg = { ...DEFAULT_CONTROLS, ...controls };
  const state = defaultState();
  state.printSpeed = cfg.printSpeed;
  state.travelSpeed = cfg.travelSpeed;
  state.filamentDia = cfg.filamentDia;
  state.extrusionWidth = cfg.extrusionWidth;
  state.layerHeight = cfg.layerHeight;
  state.extrusionArea = cfg.extrusionWidth * cfg.layerHeight;
  state.hotendTemp = cfg.nozzleTemp;
  state.bedTemp = cfg.bedTemp;
  state.retractLength = cfg.retractLength;
  state.retractSpeed = cfg.retractSpeed;

  const output: string[] = [];
  let currentZ = 0;
  let layerCount = 0;
  let totalDistance = 0;

  // ─── Start GCode ────────────────────────────────────────────────────
  if (cfg.includeStartGcode) {
    output.push(
      `; Generated by Vorea Studio - FullControl Engine`,
      `; Printer: ${cfg.printerName}`,
      `; Layer height: ${cfg.layerHeight}mm`,
      `; Extrusion width: ${cfg.extrusionWidth}mm`,
      `; Nozzle: ${cfg.nozzleTemp}C  Bed: ${cfg.bedTemp}C`,
      ``,
      `G90 ; Absolute positioning`,
      `M82 ; Absolute extrusion`,
      `G28 ; Home all axes`,
      `M104 S${cfg.nozzleTemp} ; Set nozzle temp`,
      `M140 S${cfg.bedTemp} ; Set bed temp`,
      `M190 S${cfg.bedTemp} ; Wait for bed`,
      `M109 S${cfg.nozzleTemp} ; Wait for nozzle`,
      `G92 E0 ; Reset extruder`,
      `G1 Z5 F${cfg.travelSpeed} ; Lift nozzle`,
      `G1 X0.1 Y20 Z0.3 F${cfg.travelSpeed} ; Move to start`,
      `; Prime line`,
      `G1 X0.1 Y200 Z0.3 F1500 E15 ; Draw prime line`,
      `G1 X0.4 Y200 Z0.3 F${cfg.travelSpeed} ; Move`,
      `G1 X0.4 Y20 Z0.3 F1500 E30 ; Draw prime line`,
      `G92 E0 ; Reset extruder`,
      `G1 Z2 F${cfg.travelSpeed} ; Lift`,
      ``,
    );

    if (cfg.fanSpeed > 0) {
      output.push(`M106 S${Math.round(cfg.fanSpeed * 2.55)} ; Fan on`);
    }
    output.push(``);
  }

  // ─── Relative extrusion mode ────────────────────────────────────────
  if (state.relativeE) {
    output.push(`M83 ; Relative extrusion`);
  }

  // ─── Process steps ──────────────────────────────────────────────────
  for (const step of steps) {
    switch (step.kind) {
      case "point": {
        const nx = step.x ?? state.x;
        const ny = step.y ?? state.y;
        const nz = step.z ?? state.z;

        // Detect layer change
        if (nz !== currentZ) {
          currentZ = nz;
          layerCount++;
          output.push(`; LAYER ${layerCount} at Z=${nz.toFixed(3)}`);
        }

        const dx = nx - state.x;
        const dy = ny - state.y;
        const dz = nz - state.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 0.001) break; // Skip zero-distance moves

        if (state.extruding && dist > 0) {
          // Extrusion move
          const e = calculateE(dist, state);
          state.totalE += e;
          totalDistance += dist;

          const eStr = state.relativeE
            ? `E${e.toFixed(5)}`
            : `E${state.totalE.toFixed(5)}`;

          output.push(
            `G1 X${nx.toFixed(3)} Y${ny.toFixed(3)} Z${nz.toFixed(3)} F${state.printSpeed} ${eStr}`
          );
        } else {
          // Travel move
          if (!state.retracted && state.extruding === false) {
            // Retract before travel
            output.push(`G1 E-${state.retractLength.toFixed(3)} F${state.retractSpeed} ; retract`);
            state.retracted = true;
          }
          output.push(
            `G0 X${nx.toFixed(3)} Y${ny.toFixed(3)} Z${nz.toFixed(3)} F${state.travelSpeed}`
          );
        }

        state.x = nx;
        state.y = ny;
        state.z = nz;
        break;
      }

      case "extruder": {
        if (step.on !== undefined) {
          const wasOff = !state.extruding;
          state.extruding = step.on;
          // Unretract when turning extruder back on
          if (step.on && state.retracted) {
            output.push(`G1 E${state.retractLength.toFixed(3)} F${state.retractSpeed} ; unretract`);
            state.retracted = false;
          }
        }
        if (step.diaFeed !== undefined) state.filamentDia = step.diaFeed;
        if (step.relative !== undefined) {
          state.relativeE = step.relative;
          output.push(step.relative ? `M83 ; Relative E` : `M82 ; Absolute E`);
        }
        break;
      }

      case "extrusion_geometry": {
        if (step.width !== undefined) state.extrusionWidth = step.width;
        if (step.height !== undefined) state.layerHeight = step.height;
        if (step.area !== undefined) {
          state.extrusionArea = step.area;
        } else {
          state.extrusionArea = state.extrusionWidth * state.layerHeight;
        }
        break;
      }

      case "printer": {
        if (step.printSpeed !== undefined) state.printSpeed = step.printSpeed;
        if (step.travelSpeed !== undefined) state.travelSpeed = step.travelSpeed;
        break;
      }

      case "fan": {
        if (step.speedPercent !== undefined) {
          state.fanSpeed = step.speedPercent;
          output.push(`M106 S${Math.round(step.speedPercent * 2.55)} ; Fan ${step.speedPercent}%`);
        }
        break;
      }

      case "hotend": {
        if (step.temp !== undefined) {
          state.hotendTemp = step.temp;
          output.push(
            step.wait
              ? `M109 S${step.temp} ; Wait for nozzle`
              : `M104 S${step.temp} ; Set nozzle temp`
          );
        }
        break;
      }

      case "buildplate": {
        if (step.temp !== undefined) {
          state.bedTemp = step.temp;
          output.push(
            step.wait
              ? `M190 S${step.temp} ; Wait for bed`
              : `M140 S${step.temp} ; Set bed temp`
          );
        }
        break;
      }

      case "comment": {
        output.push(`; ${step.text}`);
        break;
      }

      case "manual_gcode": {
        output.push(step.text);
        break;
      }

      case "retract": {
        if (!state.retracted) {
          output.push(`G1 E-${state.retractLength.toFixed(3)} F${state.retractSpeed} ; retract`);
          state.retracted = true;
        }
        break;
      }

      case "unretract": {
        if (state.retracted) {
          output.push(`G1 E${state.retractLength.toFixed(3)} F${state.retractSpeed} ; unretract`);
          state.retracted = false;
        }
        break;
      }
    }
  }

  // ─── End GCode ──────────────────────────────────────────────────────
  if (cfg.includeEndGcode) {
    output.push(
      ``,
      `; End GCode`,
      `G91 ; Relative positioning`,
      `G1 E-2 F2700 ; Retract`,
      `G1 Z10 F3000 ; Lift`,
      `G90 ; Absolute positioning`,
      `G1 X0 Y200 F${cfg.travelSpeed} ; Present print`,
      `M104 S0 ; Nozzle off`,
      `M140 S0 ; Bed off`,
      `M106 S0 ; Fan off`,
      `M84 ; Motors off`,
    );
  }

  // ─── Calculate estimates ────────────────────────────────────────────
  // Rough time estimate: total distance / average speed
  const avgSpeed = (cfg.printSpeed + cfg.travelSpeed) / 2;
  const estimatedTimeMin = totalDistance / avgSpeed;

  // Filament used (mm of filament)
  const filamentUsedMm = state.totalE;

  return {
    gcode: output.join("\n"),
    lines: output.length,
    estimatedTimeMin: Math.round(estimatedTimeMin * 10) / 10,
    filamentUsedMm: Math.round(filamentUsedMm * 10) / 10,
    layerCount,
  };
}

// ─── Extrusion calculation ────────────────────────────────────────────────────

function calculateE(distance: number, state: PrinterState): number {
  // Volume of extrudate = cross-section area * distance
  const volume = state.extrusionArea * distance;
  // Filament cross-section
  const filamentArea = Math.PI * (state.filamentDia / 2) ** 2;
  // Length of filament to push
  return volume / filamentArea;
}
