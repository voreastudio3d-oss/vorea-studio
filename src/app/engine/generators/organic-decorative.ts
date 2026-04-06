import type { InstructionSpecV1, ParametricScadResult } from "../instruction-spec";
import { formatScadNumber, getNumberParameter } from "./parameter-values";

function header(spec: InstructionSpecV1, name: string): string {
  const sourcePrompt = spec.prompt.replace(/\n+/g, " ").trim();
  return `// AI Parametric Pipeline v1.0
// Engine: ${spec.engine}
// Family: ${spec.family}
// Prompt: ${sourcePrompt}
// Model: ${name}

quality_level = ${spec.qualityProfile === "final" ? 1 : 0}; // [0:1:1] 0=draft, 1=final
$fn = quality_level == 1 ? 96 : 32;
`;
}

function generateVaseWave(spec: InstructionSpecV1): ParametricScadResult {
  const modelName = "Jarron Organico Ondulado";
  const baseR = getNumberParameter(spec, "base_r", 26);
  const topR = getNumberParameter(spec, "top_r", 38);
  const height = getNumberParameter(spec, "height", 120);
  const wall = getNumberParameter(spec, "wall", 2.1);
  const waves = getNumberParameter(spec, "waves", 8);
  const twist = getNumberParameter(spec, "twist", 26);
  return {
    modelName,
    scad: `${header(spec, modelName)}
base_r = ${formatScadNumber(baseR)};      // [12:1:80]
top_r = ${formatScadNumber(topR)};       // [12:1:90]
height = ${formatScadNumber(height)};     // [40:2:260]
wall = ${formatScadNumber(wall)};       // [1.2:0.1:5]
waves = ${formatScadNumber(waves)};        // [2:1:16]
twist = ${formatScadNumber(twist)};       // [0:1:160]
layers = quality_level == 1 ? 120 : 48;

module profile(t) {
  r = base_r + (top_r - base_r) * t + sin(t*360*waves) * (quality_level == 1 ? 2.4 : 1.4);
  [r, t * height];
}

difference() {
  for (i = [0:layers-1]) {
    t0 = i / layers;
    t1 = (i + 1) / layers;
    hull() {
      translate([0,0,profile(t0)[1]]) rotate([0,0,twist*t0]) cylinder(r=profile(t0)[0], h=0.2);
      translate([0,0,profile(t1)[1]]) rotate([0,0,twist*t1]) cylinder(r=profile(t1)[0], h=0.2);
    }
  }
  translate([0,0,wall]) {
    for (i = [0:layers-1]) {
      t0 = i / layers;
      t1 = (i + 1) / layers;
      hull() {
        translate([0,0,profile(t0)[1]]) rotate([0,0,twist*t0]) cylinder(r=max(1, profile(t0)[0]-wall), h=0.2);
        translate([0,0,profile(t1)[1]]) rotate([0,0,twist*t1]) cylinder(r=max(1, profile(t1)[0]-wall), h=0.2);
      }
    }
  }
}
`,
  };
}

function generateLampShell(spec: InstructionSpecV1): ParametricScadResult {
  const modelName = "Lampara Decorativa Perforada";
  const outerR = getNumberParameter(spec, "outer_r", 52);
  const innerR = getNumberParameter(spec, "inner_r", 47);
  const height = getNumberParameter(spec, "height", 145);
  const holes = Math.max(3, Math.round(getNumberParameter(spec, "holes", spec.qualityProfile === "final" ? 22 : 12)));
  const holeR = getNumberParameter(spec, "hole_r", 4.8);
  const twist = getNumberParameter(spec, "twist", 18);
  return {
    modelName,
    scad: `${header(spec, modelName)}
outer_r = ${formatScadNumber(outerR)};     // [20:1:120]
inner_r = ${formatScadNumber(innerR)};     // [15:1:110]
height = ${formatScadNumber(height)};     // [60:2:320]
holes = ${holes}; // [6:1:32]
hole_r = ${formatScadNumber(holeR)};     // [2:0.2:12]
twist = ${formatScadNumber(twist)};       // [0:1:80]

difference() {
  cylinder(r=outer_r, h=height);
  translate([0,0,2]) cylinder(r=inner_r, h=height);
  for (z=[12:height/(holes+1):height-12]) {
    for (a=[0:360/holes:359]) {
      rotate([0,0,a + z*twist/height])
        translate([outer_r-0.5,0,z])
          rotate([0,90,0]) cylinder(r=hole_r, h=12, center=true, $fn=quality_level == 1 ? 24 : 10);
    }
  }
}
`,
  };
}

function generateDecorativeTower(spec: InstructionSpecV1): ParametricScadResult {
  const modelName = "Torre Organica Parametrica";
  const radius = getNumberParameter(spec, "radius", 28);
  const height = getNumberParameter(spec, "height", 130);
  const lobes = Math.max(3, Math.round(getNumberParameter(spec, "lobes", 5)));
  const twist = getNumberParameter(spec, "twist", 42);
  return {
    modelName,
    scad: `${header(spec, modelName)}
radius = ${formatScadNumber(radius)};      // [10:1:80]
height = ${formatScadNumber(height)};     // [50:2:320]
lobes = ${lobes};        // [3:1:10]
twist = ${formatScadNumber(twist)};       // [0:1:180]
steps = quality_level == 1 ? 120 : 56;

for (i=[0:steps-1]) {
  t0 = i/steps;
  t1 = (i+1)/steps;
  r0 = radius + sin(t0*360*lobes) * (quality_level == 1 ? 4.2 : 2.4);
  r1 = radius + sin(t1*360*lobes) * (quality_level == 1 ? 4.2 : 2.4);
  hull() {
    translate([0,0,t0*height]) rotate([0,0,twist*t0]) cylinder(r=r0, h=0.25);
    translate([0,0,t1*height]) rotate([0,0,twist*t1]) cylinder(r=r1, h=0.25);
  }
}
`,
  };
}

export function generateOrganicDecorativeScad(spec: InstructionSpecV1): ParametricScadResult {
  switch (spec.family) {
    case "vase-wave":
      return generateVaseWave(spec);
    case "lamp-shell":
      return generateLampShell(spec);
    default:
      return generateDecorativeTower(spec);
  }
}
