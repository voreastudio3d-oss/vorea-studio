// Vorea Studio — Parametric Wall Hook
// Strong wall hook with smooth curves using hull()
// Compatible: Vorea Studio SCAD Engine

// [Section: Dimensions]
hook_width = 25;       // [15:5:50] Ancho del gancho (mm)
hook_depth = 30;       // [15:5:60] Profundidad del gancho (mm)  
hook_height = 40;      // [25:5:80] Altura total (mm)
thickness = 6;         // [3:1:12] Grosor del material

// [Section: Mount]
plate_height = 50;     // [30:5:80] Altura de la placa de montaje
plate_width = 30;      // [20:5:50] Ancho de la placa
screw_holes = 2;       // [1:1:3] Numero de agujeros para tornillos
screw_dia = 4;         // [3:0.5:6] Diametro de tornillos

// [Section: Style]
fillet = 3;            // [1:1:8] Radio de filetes

$fn = 32;

// Mounting plate
difference() {
  hull() {
    translate([fillet, fillet, 0]) cylinder(r=fillet, h=thickness);
    translate([plate_width-fillet, fillet, 0]) cylinder(r=fillet, h=thickness);
    translate([fillet, plate_height-fillet, 0]) cylinder(r=fillet, h=thickness);
    translate([plate_width-fillet, plate_height-fillet, 0]) cylinder(r=fillet, h=thickness);
  }
  
  // Screw holes
  for (i = [1 : screw_holes]) {
    y_pos = plate_height / (screw_holes + 1) * i;
    translate([plate_width/2, y_pos, -0.5])
      cylinder(r = screw_dia/2, h = thickness + 1);
    // Countersink
    translate([plate_width/2, y_pos, thickness - 1.5])
      cylinder(r1 = screw_dia/2, r2 = screw_dia, h = 2);
  }
}

// Hook arm — smooth curved shape using hull()
// Vertical section
translate([plate_width/2 - hook_width/2, 0, 0])
  hull() {
    translate([0, 0, thickness])
      cube([hook_width, thickness, 1]);
    translate([0, 0, hook_height - thickness])
      cube([hook_width, thickness, 1]);
  }

// Top curve going outward
translate([plate_width/2 - hook_width/2, 0, 0])
  hull() {
    translate([0, 0, hook_height - thickness])
      cube([hook_width, thickness, 1]);
    translate([0, -hook_depth, hook_height - thickness * 2])
      cube([hook_width, thickness, 1]);
  }

// Hook curve going down
translate([plate_width/2 - hook_width/2, 0, 0])
  hull() {
    translate([0, -hook_depth, hook_height - thickness * 2])
      cube([hook_width, thickness, 1]);
    translate([0, -hook_depth + thickness, hook_height - thickness * 4])
      cube([hook_width, thickness, 1]);
  }

// Hook tip curl
translate([plate_width/2 - hook_width/2, 0, 0])
  hull() {
    translate([0, -hook_depth + thickness, hook_height - thickness * 4])
      cube([hook_width, thickness, 1]);
    translate([0, -hook_depth/2, hook_height - thickness * 4])
      cube([hook_width, thickness, 1]);
  }
