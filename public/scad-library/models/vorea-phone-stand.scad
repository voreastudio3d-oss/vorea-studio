// Vorea Studio — Parametric Phone/Tablet Stand
// Adjustable angle desk stand for phones and tablets
// Compatible: Vorea Studio SCAD Engine

// [Section: Dimensions]
stand_width = 80;   // [40:5:150] Ancho del soporte (mm)
stand_depth = 60;   // [40:5:100] Profundidad de base (mm)
stand_height = 80;  // [40:5:120] Altura del respaldo (mm)
thickness = 4;      // [2:1:8] Grosor del material

// [Section: Design]
angle = 70;         // [45:5:85] Angulo de inclinacion (grados)
lip_height = 15;    // [8:1:30] Altura del labio frontal
slot_width = 12;    // [8:1:20] Ancho de la ranura para cable
cable_hole = 1;     // [0:1:1] Agujero para cable (0=no, 1=si)

$fn = 32;

// Base plate
cube([stand_width, stand_depth, thickness]);

// Front lip
translate([0, 0, 0])
  cube([stand_width, thickness, lip_height]);

// Angled backrest
translate([0, stand_depth - thickness, 0])
  rotate([90 - angle, 0, 0])
    difference() {
      cube([stand_width, stand_height, thickness]);
      
      // Cable slot
      if (cable_hole == 1) {
        translate([stand_width/2 - slot_width/2, stand_height * 0.6, -1])
          cube([slot_width, stand_height * 0.3, thickness + 2]);
      }
    }

// Side supports
for (x = [0, stand_width - thickness]) {
  translate([x, thickness, 0])
    linear_extrude(height = thickness)
      polygon([
        [0, 0],
        [0, stand_depth - thickness*2],
        [0, 0]
      ]);
}

// Reinforcement ribs
for (x = [stand_width * 0.25, stand_width * 0.75]) {
  translate([x - thickness/4, thickness, thickness])
    cube([thickness/2, stand_depth - thickness * 2, thickness]);
}
