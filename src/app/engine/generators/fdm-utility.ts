import type { InstructionSpecV1, ParametricScadResult } from "../instruction-spec";
import {
  formatScadNumber,
  formatScadString,
  getBoolParameter,
  getNumberParameter,
  getStringParameter,
} from "./parameter-values";

function header(spec: InstructionSpecV1, name: string): string {
  const sourcePrompt = spec.prompt.replace(/\n+/g, " ").trim();
  return `// AI Parametric Pipeline v1.0
// Engine: ${spec.engine}
// Family: ${spec.family}
// Prompt: ${sourcePrompt}
// Model: ${name}

quality_level = ${spec.qualityProfile === "final" ? 1 : 0}; // [0:1:1] 0=draft, 1=final
$fn = quality_level == 1 ? 72 : 24;
`;
}

interface SplitLabelLayout {
  primary: string;
  secondary: string;
  lineCount: 1 | 2;
}

function normalizeLabelText(value: string, fallback: string, maxChars: number): string {
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, maxChars);
  return normalized || fallback;
}

function splitBalancedLabelText(value: string, maxSingleLineChars: number): SplitLabelLayout {
  if (value.length <= maxSingleLineChars || !value.includes(" ")) {
    return { primary: value, secondary: "", lineCount: 1 };
  }

  const words = value.split(" ");
  let bestSplit: { primary: string; secondary: string; longest: number; score: number } | null = null;

  for (let index = 1; index < words.length; index += 1) {
    const primary = words.slice(0, index).join(" ");
    const secondary = words.slice(index).join(" ");
    if (!primary || !secondary) continue;

    const longest = Math.max(primary.length, secondary.length);
    const diff = Math.abs(primary.length - secondary.length);
    const score = longest * 3 + diff;

    if (!bestSplit || score < bestSplit.score) {
      bestSplit = { primary, secondary, longest, score };
    }
  }

  if (!bestSplit) {
    return { primary: value, secondary: "", lineCount: 1 };
  }

  if (value.length < maxSingleLineChars + 4 && bestSplit.longest > Math.ceil(maxSingleLineChars * 0.92)) {
    return { primary: value, secondary: "", lineCount: 1 };
  }

  return {
    primary: bestSplit.primary,
    secondary: bestSplit.secondary,
    lineCount: 2,
  };
}

function generateStorageBox(spec: InstructionSpecV1): ParametricScadResult {
  const modelName = "Caja Utilitaria Parametrica";
  const width = getNumberParameter(spec, "width", 90);
  const depth = getNumberParameter(spec, "depth", 60);
  const height = getNumberParameter(spec, "height", 45);
  const wall = getNumberParameter(spec, "wall", 2.2);
  const cornerR = getNumberParameter(spec, "corner_r", 4);
  const lip = getNumberParameter(spec, "lip", 1.0);
  return {
    modelName,
    scad: `${header(spec, modelName)}
width = ${formatScadNumber(width)};      // [30:5:220] ancho
depth = ${formatScadNumber(depth)};      // [20:5:180] profundidad
height = ${formatScadNumber(height)};     // [15:5:140] altura
wall = ${formatScadNumber(wall)};      // [1.2:0.2:6] grosor
corner_r = ${formatScadNumber(cornerR)};    // [0:1:15] radio esquinas
lip = ${formatScadNumber(lip)};       // [0:0.2:3] labio de apoyo

module rounded_box(w, d, h, r) {
  minkowski() {
    cube([w - r*2, d - r*2, h], center=true);
    cylinder(r=r, h=0.01);
  }
}

difference() {
  rounded_box(width, depth, height, corner_r);
  translate([0,0,wall])
    rounded_box(width - wall*2, depth - wall*2, height, max(0.5, corner_r - wall));
}

if (lip > 0) {
  translate([0,0,height/2 - lip/2])
    difference() {
      rounded_box(width, depth, lip, corner_r);
      rounded_box(width - wall*2, depth - wall*2, lip + 0.4, max(0.5, corner_r - wall));
    }
}
`,
  };
}

function generatePhoneStand(spec: InstructionSpecV1): ParametricScadResult {
  const modelName = "Soporte Funcional de Telefono";
  const baseW = getNumberParameter(spec, "base_w", 82);
  const baseD = getNumberParameter(spec, "base_d", 70);
  const baseH = getNumberParameter(spec, "base_h", 6);
  const backH = getNumberParameter(spec, "back_h", 118);
  const angle = getNumberParameter(spec, "angle", 67);
  const lipH = getNumberParameter(spec, "lip_h", 12);
  const thick = getNumberParameter(spec, "thick", 4);
  return {
    modelName,
    scad: `${header(spec, modelName)}
base_w = ${formatScadNumber(baseW)};     // [45:1:140] ancho base
base_d = ${formatScadNumber(baseD)};     // [35:1:130] profundidad base
base_h = ${formatScadNumber(baseH)};      // [3:1:16] espesor base
back_h = ${formatScadNumber(backH)};    // [60:2:190] altura respaldo
angle = ${formatScadNumber(angle)};      // [45:1:82] angulo soporte
lip_h = ${formatScadNumber(lipH)};      // [6:1:28] labio frontal
thick = ${formatScadNumber(thick)};       // [2:0.5:8] grosor piezas

cube([base_w, base_d, base_h], center=true);

translate([0, -base_d/2 + thick/2, base_h/2]) {
  rotate([90 - angle, 0, 0])
    cube([base_w, back_h, thick], center=true);
}

translate([0, base_d/4, base_h/2 + lip_h/2])
  cube([base_w, thick, lip_h], center=true);

for (x = [-1,1]) {
  translate([x * (base_w/2 - thick/2), -base_d*0.15, base_h])
    cube([thick, base_d*0.55, base_h*1.8], center=true);
}
`,
  };
}

function generateDrawerOrganizerTray(spec: InstructionSpecV1): ParametricScadResult {
  const modelName = "Bandeja Organizadora Parametrica";
  const width = getNumberParameter(spec, "width", 140);
  const depth = getNumberParameter(spec, "depth", 95);
  const height = getNumberParameter(spec, "height", 34);
  const wall = getNumberParameter(spec, "wall", 2.4);
  const floor = getNumberParameter(spec, "floor", 1.8);
  const cellsX = Math.max(1, Math.round(getNumberParameter(spec, "cells_x", 3)));
  const cellsY = Math.max(1, Math.round(getNumberParameter(spec, "cells_y", 2)));
  const cornerR = getNumberParameter(spec, "corner_r", 6);
  const lip = getNumberParameter(spec, "lip", 1.2);
  return {
    modelName,
    scad: `${header(spec, modelName)}
tray_w = ${formatScadNumber(width)};      // [50:5:280] ancho exterior
tray_d = ${formatScadNumber(depth)};      // [40:5:220] profundidad exterior
tray_h = ${formatScadNumber(height)};     // [12:2:90] altura total
wall = ${formatScadNumber(wall)};        // [1.2:0.2:6] grosor pared
floor = ${formatScadNumber(floor)};       // [1:0.2:5] espesor base
cells_x = ${cellsX};     // [1:1:8] divisiones ancho
cells_y = ${cellsY};     // [1:1:6] divisiones profundidad
corner_r = ${formatScadNumber(cornerR)};    // [0:1:18] radio esquinas
lip = ${formatScadNumber(lip)};         // [0:0.2:4] refuerzo superior

outer_w = tray_w;
outer_d = tray_d;
outer_h = tray_h;
inner_w = max(10, outer_w - wall*2);
inner_d = max(10, outer_d - wall*2);
divider = max(1.2, wall*0.85);
usable_h = max(8, outer_h - floor);

module rounded_rect_prism(w, d, h, r) {
  safe_r = min(r, min(w, d) / 2 - 0.1);
  if (safe_r <= 0) {
    cube([w, d, h]);
  } else {
    hull() {
      translate([safe_r, safe_r, 0]) cylinder(h=h, r=safe_r);
      translate([w - safe_r, safe_r, 0]) cylinder(h=h, r=safe_r);
      translate([w - safe_r, d - safe_r, 0]) cylinder(h=h, r=safe_r);
      translate([safe_r, d - safe_r, 0]) cylinder(h=h, r=safe_r);
    }
  }
}

module tray_shell() {
  difference() {
    rounded_rect_prism(outer_w, outer_d, outer_h, corner_r);
    translate([wall, wall, floor])
      rounded_rect_prism(inner_w, inner_d, outer_h + 0.2, max(0.4, corner_r - wall));
  }
}

module tray_dividers() {
  divider_h = max(6, usable_h - lip);
  if (cells_x > 1) {
    pitch_x = inner_w / cells_x;
    for (ix = [1:cells_x-1]) {
      translate([wall + pitch_x*ix - divider/2, wall, floor])
        cube([divider, inner_d, divider_h]);
    }
  }

  if (cells_y > 1) {
    pitch_y = inner_d / cells_y;
    for (iy = [1:cells_y-1]) {
      translate([wall, wall + pitch_y*iy - divider/2, floor])
        cube([inner_w, divider, divider_h]);
    }
  }
}

translate([-outer_w/2, -outer_d/2, 0]) {
  tray_shell();
  tray_dividers();

  if (lip > 0) {
    translate([0, 0, outer_h - lip])
      difference() {
        rounded_rect_prism(outer_w, outer_d, lip, corner_r);
        translate([wall, wall, -0.1])
          rounded_rect_prism(inner_w, inner_d, lip + 0.2, max(0.4, corner_r - wall));
      }
  }
}
`,
  };
}

function generatePlanterDripSystem(spec: InstructionSpecV1): ParametricScadResult {
  const modelName = "Maceta con Bandeja Parametrica";
  const topD = getNumberParameter(spec, "top_d", 128);
  const bottomD = getNumberParameter(spec, "bottom_d", 88);
  const potH = getNumberParameter(spec, "pot_h", 96);
  const wall = getNumberParameter(spec, "wall", 2.2);
  const floor = getNumberParameter(spec, "floor", 2.4);
  const drainHoles = Math.max(1, Math.round(getNumberParameter(spec, "drain_holes", 5)));
  const drainD = getNumberParameter(spec, "drain_d", 6);
  const trayGap = getNumberParameter(spec, "tray_gap", 3.2);
  const trayDepth = getNumberParameter(spec, "tray_depth", 14);
  const footH = getNumberParameter(spec, "foot_h", 4);
  return {
    modelName,
    scad: `${header(spec, modelName)}
top_d = ${formatScadNumber(topD)};        // [60:2:240] diametro superior
bottom_d = ${formatScadNumber(bottomD)};   // [40:2:200] diametro inferior
pot_h = ${formatScadNumber(potH)};        // [40:2:220] altura de maceta
wall = ${formatScadNumber(wall)};         // [1.2:0.2:6] grosor pared
floor = ${formatScadNumber(floor)};        // [1.2:0.2:6] grosor base
drain_holes = ${drainHoles};  // [1:1:12] cantidad de drenajes
drain_d = ${formatScadNumber(drainD)};      // [2:0.5:14] diametro drenaje
tray_gap = ${formatScadNumber(trayGap)};    // [1:0.2:10] holgura con bandeja
tray_depth = ${formatScadNumber(trayDepth)};  // [6:1:32] profundidad bandeja
foot_h = ${formatScadNumber(footH)};       // [0:0.5:12] altura patas

pot_outer_r_top = top_d/2;
pot_outer_r_bottom = bottom_d/2;
pot_inner_r_top = max(10, pot_outer_r_top - wall);
pot_inner_r_bottom = max(8, pot_outer_r_bottom - wall);
tray_outer_d = top_d + tray_gap*2 + wall*4;
tray_inner_d = tray_outer_d - wall*2;
drain_ring_r = max(drain_d, pot_inner_r_bottom * 0.48);
foot_span = max(10, pot_outer_r_bottom * 0.55);

module pot_shell() {
  difference() {
    cylinder(h=pot_h, r1=pot_outer_r_bottom, r2=pot_outer_r_top);

    translate([0, 0, floor + foot_h])
      cylinder(
        h=max(1, pot_h - floor + 0.2),
        r1=max(6, pot_inner_r_bottom),
        r2=max(8, pot_inner_r_top)
      );

    for (i = [0:drain_holes-1]) {
      angle = i * 360 / drain_holes;
      rotate([0, 0, angle])
        translate([drain_ring_r, 0, -0.1])
          cylinder(d=drain_d, h=floor + foot_h + 0.4);
    }
  }
}

module planter_feet() {
  if (foot_h > 0) {
    for (i = [0:2]) {
      angle = i * 120;
      rotate([0,0,angle])
        translate([foot_span, 0, 0])
          cylinder(h=foot_h, r=max(2.5, wall*1.3));
    }
  }
}

module drip_tray() {
  difference() {
    cylinder(h=tray_depth, d=tray_outer_d);
    translate([0, 0, wall])
      cylinder(h=tray_depth + 0.2, d=max(20, tray_inner_d));
  }
}

translate([-(tray_outer_d + top_d)/2 - 10, 0, 0]) {
  planter_feet();
  translate([0, 0, foot_h]) pot_shell();
}

translate([(tray_outer_d + top_d)/2 + 10, 0, 0]) {
  drip_tray();
}
`,
  };
}

function generateLampShadeKit(spec: InstructionSpecV1): ParametricScadResult {
  const modelName = "Pantalla de Lampara para Kit";
  const topD = getNumberParameter(spec, "top_d", 158);
  const bottomD = getNumberParameter(spec, "bottom_d", 92);
  const shadeH = getNumberParameter(spec, "shade_h", 148);
  const wall = getNumberParameter(spec, "wall", 1.8);
  const openings = Math.max(6, Math.round(getNumberParameter(spec, "openings", 18)));
  const ventRows = Math.max(1, Math.round(getNumberParameter(spec, "vent_rows", 4)));
  const ventD = getNumberParameter(spec, "vent_d", 9);
  const seatD = getNumberParameter(spec, "seat_d", 42);
  const seatH = getNumberParameter(spec, "seat_h", 12);
  const fit = getNumberParameter(spec, "fit", 0.5);
  return {
    modelName,
    scad: `${header(spec, modelName)}
top_d = ${formatScadNumber(topD)};       // [80:2:260] diametro superior
bottom_d = ${formatScadNumber(bottomD)};    // [50:2:180] diametro inferior
shade_h = ${formatScadNumber(shadeH)};    // [60:2:280] altura de pantalla
wall = ${formatScadNumber(wall)};        // [1.2:0.1:4] grosor de pared
openings = ${openings};   // [6:1:36] aberturas por fila
vent_rows = ${ventRows};  // [1:1:8] filas de ventilacion
vent_d = ${formatScadNumber(ventD)};      // [3:0.5:18] diametro de abertura
seat_d = ${formatScadNumber(seatD)};      // [20:0.5:80] diametro del kit
seat_h = ${formatScadNumber(seatH)};      // [4:1:28] altura del collar
fit = ${formatScadNumber(fit)};         // [0.1:0.1:2] holgura

outer_r_bottom = bottom_d/2;
outer_r_top = top_d/2;
inner_r_bottom = max(seat_d/2 + wall + fit, outer_r_bottom - wall);
inner_r_top = max(inner_r_bottom + 8, outer_r_top - wall);
top_open_d = max(20, top_d - wall*4);
collar_outer_d = max(seat_d + wall*4, bottom_d - wall*3);
vent_start_z = seat_h + 8;
vent_end_z = shade_h - max(10, vent_d*1.2);
row_step = vent_rows > 1 ? (vent_end_z - vent_start_z) / (vent_rows - 1) : 0;

module shade_body() {
  difference() {
    cylinder(h=shade_h, r1=outer_r_bottom, r2=outer_r_top);

    // main cavity starts above collar to leave a printable seat for the kit
    translate([0,0,seat_h])
      cylinder(h=shade_h - seat_h + 0.4, r1=inner_r_bottom, r2=inner_r_top);

    // central opening for lamp kit / socket
    translate([0,0,-0.1])
      cylinder(h=seat_h + 0.3, d=seat_d + fit);

    // top remains open for light escape and heat
    translate([0,0,shade_h - wall])
      cylinder(h=wall + 0.3, d=top_open_d);

    for (row = [0:vent_rows-1]) {
      z = vent_rows == 1 ? (vent_start_z + vent_end_z)/2 : vent_start_z + row * row_step;
      ring_r = outer_r_bottom + (outer_r_top - outer_r_bottom) * (z / shade_h) - wall*0.25;
      offset = row % 2 == 0 ? 0 : 180 / openings;
      for (i = [0:openings-1]) {
        angle = i * 360 / openings + offset;
        rotate([0, 0, angle])
          translate([ring_r, 0, z])
            rotate([0,90,0])
              cylinder(d=vent_d, h=max(8, wall*8), center=true, $fn=quality_level == 1 ? 28 : 16);
      }
    }
  }
}

module bottom_collar() {
  difference() {
    cylinder(h=seat_h, d=collar_outer_d);
    translate([0,0,-0.1])
      cylinder(h=seat_h + 0.2, d=seat_d + fit);
  }
}

union() {
  shade_body();
  bottom_collar();
}
`,
  };
}

function generateTextKeychainTag(spec: InstructionSpecV1): ParametricScadResult {
  const modelName = "Llavero con Texto Parametrico";
  const tagW = getNumberParameter(spec, "tag_w", 72);
  const tagH = getNumberParameter(spec, "tag_h", 28);
  const thick = getNumberParameter(spec, "thick", 3.2);
  const cornerR = getNumberParameter(spec, "corner_r", 7);
  const holeD = getNumberParameter(spec, "hole_d", 5);
  const holeMargin = getNumberParameter(spec, "hole_margin", 10);
  const textSize = getNumberParameter(spec, "text_size", 9);
  const textDepth = getNumberParameter(spec, "text_depth", 1.1);
  const labelText = normalizeLabelText(getStringParameter(spec, "label_text", "VOREA"), "VOREA", 28);
  const engraved = getBoolParameter(spec, "engraved", false);
  return {
    modelName,
    scad: `${header(spec, modelName)}
tag_w = ${formatScadNumber(tagW)};        // [40:2:120] ancho total
tag_h = ${formatScadNumber(tagH)};        // [18:1:54] alto total
thick = ${formatScadNumber(thick)};        // [2:0.2:6] espesor del cuerpo
corner_r = ${formatScadNumber(cornerR)};     // [0:0.5:18] radio de esquina
hole_d = ${formatScadNumber(holeD)};       // [3:0.2:10] diametro del ojal
hole_margin = ${formatScadNumber(holeMargin)};  // [5:0.5:22] margen del ojal
text_size = ${formatScadNumber(textSize)};    // [4:0.5:18] tamano del texto
text_depth = ${formatScadNumber(textDepth)};   // [0.4:0.1:3] relieve o grabado
label_text = "${formatScadString(labelText)}";
engraved = ${engraved ? "true" : "false"};

safe_corner_r = min(corner_r, min(tag_w, tag_h) / 2 - 0.6);
text_h = max(0.2, text_depth);
hole_x = -tag_w/2 + max(hole_margin, safe_corner_r + hole_d/2 + 1.2);
text_left = hole_x + hole_d/2 + 2.2;
text_right = tag_w/2 - safe_corner_r - 2.2;
text_max_w = max(12, text_right - text_left);
text_max_h = max(8, tag_h - safe_corner_r*0.9 - 4);
est_text_w = max(1, len(label_text) * text_size * 0.62);
text_fit = min(1, text_max_w / est_text_w, text_max_h / max(1, text_size));
text_x = (text_left + text_right) / 2;
text_y = 0;

module rounded_tag(w, h, z, r) {
  hull() {
    for (x = [-w/2 + r, w/2 - r]) {
      for (y = [-h/2 + r, h/2 - r]) {
        translate([x, y, 0]) cylinder(h=z, r=max(0.4, r));
      }
    }
  }
}

module tag_body() {
  difference() {
    rounded_tag(tag_w, tag_h, thick, safe_corner_r);
    translate([hole_x, 0, -0.1]) cylinder(d=hole_d, h=thick + 0.2);
    if (engraved) {
      translate([text_x, text_y, thick - text_h - 0.01])
        linear_extrude(height = text_h + 0.02)
          scale([text_fit, text_fit])
            text(label_text, size=text_size, halign="center", valign="center");
    }
  }
}

tag_body();

if (!engraved) {
  translate([text_x, text_y, thick])
    linear_extrude(height = text_h)
      scale([text_fit, text_fit])
        text(label_text, size=text_size, halign="center", valign="center");
}
`,
  };
}

function generateNameplatePro(spec: InstructionSpecV1): ParametricScadResult {
  const modelName = "Nameplate Pro Parametrico";
  const plateW = getNumberParameter(spec, "plate_w", 120);
  const plateH = getNumberParameter(spec, "plate_h", 36);
  const plateD = getNumberParameter(spec, "plate_d", 4.2);
  const cornerR = getNumberParameter(spec, "corner_r", 4);
  const textSize = getNumberParameter(spec, "text_size", 14);
  const textDepth = getNumberParameter(spec, "text_depth", 1.2);
  const borderW = getNumberParameter(spec, "border_w", 2.2);
  const standAngle = getNumberParameter(spec, "stand_angle", 74);
  const labelText = normalizeLabelText(getStringParameter(spec, "label_text", "VOREA"), "VOREA", 42);
  const labelLayout = splitBalancedLabelText(labelText, 18);
  const border = getBoolParameter(spec, "border", true);
  const baseStand = getBoolParameter(spec, "base_stand", true);
  const engraved = getBoolParameter(spec, "engraved", false);
  return {
    modelName,
    scad: `${header(spec, modelName)}
plate_w = ${formatScadNumber(plateW)};      // [60:2:220] ancho total
plate_h = ${formatScadNumber(plateH)};      // [20:1:80] alto visible
plate_d = ${formatScadNumber(plateD)};      // [2:0.2:10] espesor del cuerpo
corner_r = ${formatScadNumber(cornerR)};     // [0:0.5:16] radio de esquina
text_size = ${formatScadNumber(textSize)};    // [6:0.5:28] tamano del texto
text_depth = ${formatScadNumber(textDepth)};   // [0.4:0.1:4] relieve o grabado
border_w = ${formatScadNumber(borderW)};     // [0.8:0.2:6] ancho del marco
stand_angle = ${formatScadNumber(standAngle)};  // [60:1:88] angulo de lectura
label_text = "${formatScadString(labelText)}";
primary_text = "${formatScadString(labelLayout.primary)}";
secondary_text = "${formatScadString(labelLayout.secondary)}";
line_count = ${labelLayout.lineCount};
border = ${border ? "true" : "false"};
base_stand = ${baseStand ? "true" : "false"};
engraved = ${engraved ? "true" : "false"};

safe_corner_r = min(corner_r, min(plate_w, plate_h) / 2 - 0.6);
safe_border_w = min(border_w, min(plate_w, plate_h) / 3);
tilt = 90 - stand_angle;
plate_lift = plate_h/2 * cos(tilt) + plate_d/2 * sin(tilt);
text_h = max(0.2, text_depth);
text_max_w = max(20, plate_w - safe_border_w*2 - safe_corner_r*1.4 - 8);
text_max_h = max(10, plate_h - safe_border_w*2 - 6);
line_gap = max(1.2, text_size * 0.18);
line_offset = line_count > 1 ? (text_size * 0.62 + line_gap * 0.5) : 0;
est_line_w = max(1, max(len(primary_text), len(secondary_text)) * text_size * 0.62);
text_block_h = line_count > 1 ? text_size * 2 + line_gap : text_size;
text_fit = min(1, text_max_w / est_line_w, text_max_h / max(1, text_block_h));

module rounded_plate_centered(w, d, h, r) {
  hull() {
    for (x = [-w/2 + r, w/2 - r]) {
      for (z = [-h/2 + r, h/2 - r]) {
        translate([x, 0, z])
          rotate([90, 0, 0])
            cylinder(r=max(0.4, r), h=d, center=true);
      }
    }
  }
}

module plate_pose() {
  translate([0, 0, plate_lift])
    rotate([tilt, 0, 0])
      children();
}

module front_text_outline() {
  if (line_count > 1) {
    translate([0, line_offset, 0])
      text(primary_text, size=text_size, halign="center", valign="center");
    translate([0, -line_offset, 0])
      text(secondary_text, size=text_size, halign="center", valign="center");
  } else {
    text(primary_text, size=text_size, halign="center", valign="center");
  }
}

module front_text_solid(height_override = text_h) {
  rotate([-90, 0, 0])
    linear_extrude(height = height_override)
      scale([text_fit, text_fit])
        front_text_outline();
}

module sign_plate() {
  difference() {
    rounded_plate_centered(plate_w, plate_d, plate_h, safe_corner_r);
    if (engraved) {
      translate([0, plate_d/2 - text_h - 0.01, 0])
        front_text_solid(text_h + 0.02);
    }
  }
}

module border_frame() {
  if (border) {
    difference() {
      rounded_plate_centered(plate_w, text_depth, plate_h, safe_corner_r);
      rounded_plate_centered(
        max(12, plate_w - safe_border_w*2),
        text_depth + 0.2,
        max(10, plate_h - safe_border_w*2),
        max(0.4, safe_corner_r - safe_border_w)
      );
    }
  }
}

plate_pose() {
  sign_plate();

  if (!engraved) {
    translate([0, plate_d/2, 0])
      front_text_solid();
  }

  translate([0, plate_d/2 + text_depth/2, 0])
    border_frame();
}

if (base_stand) {
  base_depth = max(10, plate_d * 4.5);
  base_h = max(2, plate_d * 0.8);

  translate([0, -base_depth/2 + plate_d, base_h/2])
    cube([plate_w, base_depth, base_h], center=true);

  hull() {
    translate([0, -plate_d * 0.5, base_h])
      cube([max(18, plate_w * 0.18), plate_d, base_h], center=true);
    translate([0, -plate_d * 0.2, plate_lift * 0.45])
      cube([max(10, plate_w * 0.12), plate_d * 0.8, base_h], center=true);
  }
}
`,
  };
}

function generatePegLabelSystem(spec: InstructionSpecV1): ParametricScadResult {
  const modelName = "Peg Label System Parametrico";
  const labelW = getNumberParameter(spec, "label_w", 84);
  const labelH = getNumberParameter(spec, "label_h", 24);
  const labelD = getNumberParameter(spec, "label_d", 3.2);
  const cornerR = getNumberParameter(spec, "corner_r", 4);
  const textSize = getNumberParameter(spec, "text_size", 8.5);
  const textDepth = getNumberParameter(spec, "text_depth", 1);
  const borderW = getNumberParameter(spec, "border_w", 1.6);
  const hookGap = getNumberParameter(spec, "hook_gap", 4.2);
  const hookDepth = getNumberParameter(spec, "hook_depth", 8);
  const hookDrop = getNumberParameter(spec, "hook_drop", 12);
  const hookSpacing = getNumberParameter(spec, "hook_spacing", 42);
  const labelText = normalizeLabelText(getStringParameter(spec, "label_text", "BITS"), "BITS", 34);
  const labelLayout = splitBalancedLabelText(labelText, 14);
  const border = getBoolParameter(spec, "border", true);
  const engraved = getBoolParameter(spec, "engraved", false);
  return {
    modelName,
    scad: `${header(spec, modelName)}
label_w = ${formatScadNumber(labelW)};      // [40:2:180] ancho frontal
label_h = ${formatScadNumber(labelH)};      // [16:1:60] alto frontal
label_d = ${formatScadNumber(labelD)};      // [2:0.2:8] espesor del cuerpo
corner_r = ${formatScadNumber(cornerR)};     // [0:0.5:14] radio de esquina
text_size = ${formatScadNumber(textSize)};    // [4:0.5:20] tamano del texto
text_depth = ${formatScadNumber(textDepth)};   // [0.4:0.1:3] relieve o grabado
border_w = ${formatScadNumber(borderW)};     // [0.6:0.2:5] ancho del marco
hook_gap = ${formatScadNumber(hookGap)};     // [1.5:0.2:12] espesor del soporte
hook_depth = ${formatScadNumber(hookDepth)};   // [4:0.5:20] profundidad del clip
hook_drop = ${formatScadNumber(hookDrop)};    // [6:0.5:32] caida vertical del clip
hook_spacing = ${formatScadNumber(hookSpacing)}; // [18:1:120] separacion entre clips
label_text = "${formatScadString(labelText)}";
primary_text = "${formatScadString(labelLayout.primary)}";
secondary_text = "${formatScadString(labelLayout.secondary)}";
line_count = ${labelLayout.lineCount};
border = ${border ? "true" : "false"};
engraved = ${engraved ? "true" : "false"};

safe_corner_r = min(corner_r, min(label_w, label_h) / 2 - 0.6);
safe_border_w = min(border_w, min(label_w, label_h) / 3);
text_h = max(0.2, text_depth);
text_max_w = max(20, label_w - safe_border_w*2 - safe_corner_r*1.2 - 8);
text_max_h = max(8, label_h - safe_border_w*2 - 5);
line_gap = max(1, text_size * 0.16);
line_offset = line_count > 1 ? (text_size * 0.58 + line_gap * 0.5) : 0;
est_line_w = max(1, max(len(primary_text), len(secondary_text)) * text_size * 0.62);
text_block_h = line_count > 1 ? text_size * 2 + line_gap : text_size;
text_fit = min(1, text_max_w / est_line_w, text_max_h / max(1, text_block_h));
clip_w = max(10, label_w * 0.16);
clip_body = max(1.8, label_d * 0.85);
clip_back_y = -label_d/2 - hook_gap - clip_body/2;
clip_bridge_y = -label_d/2 - (hook_gap + clip_body) / 2;
clip_top_z = label_h/2 - clip_body/2;
clip_bottom_z = label_h/2 - hook_drop;
retainer_d = min(hook_gap * 0.55, max(1.2, clip_body * 0.8));
safe_spacing = min(hook_spacing, label_w - clip_w - 8);
support_depth = max(hook_depth, hook_gap + clip_body);

module rounded_label(w, d, h, r) {
  hull() {
    for (x = [-w/2 + r, w/2 - r]) {
      for (z = [-h/2 + r, h/2 - r]) {
        translate([x, 0, z])
          rotate([90, 0, 0])
            cylinder(r=max(0.4, r), h=d, center=true);
      }
    }
  }
}

module front_text_outline() {
  if (line_count > 1) {
    translate([0, line_offset, 0])
      text(primary_text, size=text_size, halign="center", valign="center");
    translate([0, -line_offset, 0])
      text(secondary_text, size=text_size, halign="center", valign="center");
  } else {
    text(primary_text, size=text_size, halign="center", valign="center");
  }
}

module front_text_solid(height_override = text_h) {
  rotate([-90, 0, 0])
    linear_extrude(height = height_override)
      scale([text_fit, text_fit])
        front_text_outline();
}

module label_body() {
  difference() {
    rounded_label(label_w, label_d, label_h, safe_corner_r);
    if (engraved) {
      translate([0, label_d/2 - text_h - 0.01, 0])
        front_text_solid(text_h + 0.02);
    }
  }
}

module border_frame() {
  if (border) {
    difference() {
      rounded_label(label_w, text_depth, label_h, safe_corner_r);
      rounded_label(
        max(12, label_w - safe_border_w*2),
        text_depth + 0.2,
        max(8, label_h - safe_border_w*2),
        max(0.4, safe_corner_r - safe_border_w)
      );
    }
  }
}

module rear_clip() {
  translate([0, clip_bridge_y - max(0, support_depth - (hook_gap + clip_body))/2, clip_top_z])
    cube([clip_w, support_depth, clip_body], center=true);

  translate([0, clip_back_y - max(0, support_depth - clip_body)/2, label_h/2 - hook_drop/2])
    cube([clip_w, clip_body, hook_drop], center=true);

  translate([0, -label_d/2 - hook_gap + retainer_d/2, clip_bottom_z + clip_body/2])
    cube([clip_w, retainer_d, clip_body], center=true);
  }

label_body();

if (!engraved) {
  translate([0, label_d/2, 0])
    front_text_solid();
}

translate([0, label_d/2 + text_depth/2, 0])
  border_frame();

for (x = [-safe_spacing/2, safe_spacing/2]) {
  translate([x, 0, 0])
    rear_clip();
}
`,
  };
}

function generateThreadedJar(spec: InstructionSpecV1): ParametricScadResult {
  const modelName = "Frasco Roscado Parametrico";
  const bodyD = getNumberParameter(spec, "body_d", 74);
  const jarH = getNumberParameter(spec, "jar_h", 82);
  const wall = getNumberParameter(spec, "wall", 2.4);
  const floor = getNumberParameter(spec, "floor", 3);
  const neckH = getNumberParameter(spec, "neck_h", 16);
  const threadPitch = getNumberParameter(spec, "thread_pitch", 4);
  const threadTurns = getNumberParameter(spec, "thread_turns", 2.5);
  const threadDepthNominal = getNumberParameter(spec, "thread_depth", 1.75);
  const threadClearance = getNumberParameter(spec, "thread_clearance", 0.35);
  const fitSlop = getNumberParameter(spec, "fit_slop", 0.12);
  const leadIn = getNumberParameter(spec, "lead_in", 1.2);
  const lidH = getNumberParameter(spec, "lid_h", 20);
  const lidClearance = getNumberParameter(spec, "lid_clearance", 0.6);
  const lidKnurl = Math.max(0, Math.round(getNumberParameter(spec, "lid_knurl", 18)));
  return {
    modelName,
    scad: `${header(spec, modelName)}
body_d = ${formatScadNumber(bodyD)};        // [36:2:140] diametro exterior del frasco
jar_h = ${formatScadNumber(jarH)};         // [30:2:180] altura total del frasco
wall = ${formatScadNumber(wall)};          // [1.2:0.2:6] grosor de pared
floor = ${formatScadNumber(floor)};         // [1.2:0.2:8] espesor de base
neck_h = ${formatScadNumber(neckH)};        // [8:0.5:36] altura de zona roscada
thread_pitch = ${formatScadNumber(threadPitch)};  // [2:0.2:8] paso de rosca
thread_turns = ${formatScadNumber(threadTurns)};  // [1:0.25:5] vueltas de rosca
thread_depth_nominal = ${formatScadNumber(threadDepthNominal)}; // [0.8:0.05:4] altura radial de rosca
thread_clearance = ${formatScadNumber(threadClearance)}; // [0.1:0.05:1.2] holgura radial de rosca
fit_slop = ${formatScadNumber(fitSlop)};  // [0:0.02:0.6] compensacion extra por material/slicer
lead_in = ${formatScadNumber(leadIn)};   // [0.4:0.1:4] guiado de entrada
lid_h = ${formatScadNumber(lidH)};         // [10:0.5:40] altura de tapa
lid_clearance = ${formatScadNumber(lidClearance)}; // [0.2:0.05:1.6] holgura tapa/frasco
lid_knurl = ${lidKnurl};      // [0:1:36] cantidad de nervios exteriores

outer_r = body_d/2;
inner_r = max(8, outer_r - wall);
safe_floor = min(floor, jar_h/2 - 1);
thread_depth = min(max(0.8, thread_depth_nominal), max(1, wall * 1.18), thread_pitch * 0.72);
thread_width = max(1.2, thread_pitch * 0.48);
thread_span = min(thread_pitch * thread_turns, max(4, neck_h - 0.8));
safe_lead_in = min(lead_in, thread_span/3, lid_h/3, neck_h/2);
thread_start_z = max(safe_floor + wall*0.5, jar_h - thread_span - safe_lead_in - wall * 0.2);
thread_run = max(thread_pitch, min(thread_span, jar_h - thread_start_z - safe_lead_in * 0.35));
male_thread_r = max(1, outer_r - thread_depth * 0.2);
lid_outer_r = outer_r + wall * 0.95;
effective_thread_clearance = thread_clearance + fit_slop;
effective_lid_clearance = lid_clearance + fit_slop * 0.65;
lid_inner_r = outer_r + effective_lid_clearance;
lid_cap = max(wall, 2);
female_thread_r = max(1, lid_inner_r - 0.1);
groove_depth = thread_depth + effective_thread_clearance;
groove_width = thread_width + effective_thread_clearance * 0.65;
assembly_gap = body_d + lid_outer_r * 1.6;
knurl_depth = max(0.8, wall * 0.55);
knurl_w = max(2.4, (2 * PI * lid_outer_r) / max(10, lid_knurl * 3.2));

module helix_strip(radius, pitch, turns, depth, width) {
  linear_extrude(height = pitch * turns, twist = 360 * turns, slices = max(32, ceil(turns * 56)))
    translate([radius, 0, 0])
      polygon(points = [
        [0, -width/2],
        [depth * 0.42, -width/2],
        [depth, 0],
        [depth * 0.42, width/2],
        [0, width/2]
      ]);
}

module jar_body() {
  union() {
    difference() {
      cylinder(r = outer_r, h = jar_h);
      translate([0, 0, safe_floor])
        cylinder(r = inner_r, h = jar_h - safe_floor + 0.2);
    }

    translate([0, 0, jar_h - safe_lead_in])
      cylinder(h = safe_lead_in, r1 = outer_r, r2 = max(inner_r + wall*0.35, outer_r - thread_depth * 0.4));
  }

  translate([0, 0, thread_start_z])
    helix_strip(male_thread_r, thread_pitch, thread_run / thread_pitch, thread_depth, thread_width);
}

module lid_shell() {
  difference() {
    union() {
      cylinder(r = lid_outer_r, h = lid_h);
      if (lid_knurl > 0) {
        for (step = [0 : lid_knurl - 1]) {
          rotate([0, 0, step * 360 / lid_knurl])
            translate([lid_outer_r + knurl_depth/2 - 0.1, 0, lid_h/2])
              cube([knurl_depth, knurl_w, lid_h - lid_cap * 0.35], center = true);
        }
      }
    }

    translate([0, 0, -0.1])
      cylinder(r = lid_inner_r, h = lid_h - lid_cap + 0.2);

    translate([0, 0, -0.1])
      cylinder(
        h = safe_lead_in + 0.2,
        r1 = lid_inner_r + groove_depth + safe_lead_in * 0.45,
        r2 = lid_inner_r + 0.05
      );

    translate([0, 0, max(wall * 0.4, safe_lead_in * 0.55)])
      helix_strip(female_thread_r, thread_pitch, thread_run / thread_pitch, groove_depth, groove_width);
  }
}

translate([-assembly_gap/2, 0, 0])
  jar_body();

translate([assembly_gap/2, 0, 0])
  lid_shell();
`,
  };
}

function generateUtilityHook(spec: InstructionSpecV1): ParametricScadResult {
  const modelName = "Gancho Utilitario FDM";
  const hookW = getNumberParameter(spec, "hook_w", 20);
  const hookH = getNumberParameter(spec, "hook_h", 48);
  const hookD = getNumberParameter(spec, "hook_d", 26);
  const thick = getNumberParameter(spec, "thick", 4);
  const screwD = getNumberParameter(spec, "screw_d", 4.2);
  return {
    modelName,
    scad: `${header(spec, modelName)}
hook_w = ${formatScadNumber(hookW)};     // [10:1:60]
hook_h = ${formatScadNumber(hookH)};     // [20:1:120]
hook_d = ${formatScadNumber(hookD)};     // [10:1:80]
thick = ${formatScadNumber(thick)};       // [2:0.5:10]
screw_d = ${formatScadNumber(screwD)};   // [3:0.1:8]

difference() {
  union() {
    cube([hook_w, thick, hook_h], center=true);
    translate([0, hook_d/2 - thick/2, -hook_h/4])
      cube([hook_w, hook_d, thick], center=true);
    translate([0, hook_d - thick, -hook_h/4])
      rotate([90, 0, 0])
        cylinder(r=hook_w/2, h=thick, center=true);
  }

  for (z = [-hook_h/4, hook_h/4]) {
    translate([0, 0, z])
      rotate([90,0,0])
        cylinder(d=screw_d, h=thick + 2, center=true);
  }
}
`,
  };
}

export function generateFdmUtilityScad(spec: InstructionSpecV1): ParametricScadResult {
  switch (spec.family) {
    case "storage-box":
      return generateStorageBox(spec);
    case "drawer-organizer-tray":
      return generateDrawerOrganizerTray(spec);
    case "planter-drip-system":
      return generatePlanterDripSystem(spec);
    case "lamp-shade-kit":
      return generateLampShadeKit(spec);
    case "text-keychain-tag":
      return generateTextKeychainTag(spec);
    case "nameplate-pro":
      return generateNameplatePro(spec);
    case "peg-label-system":
      return generatePegLabelSystem(spec);
    case "threaded-jar":
      return generateThreadedJar(spec);
    case "phone-stand":
      return generatePhoneStand(spec);
    default:
      return generateUtilityHook(spec);
  }
}
