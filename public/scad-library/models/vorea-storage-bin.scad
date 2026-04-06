// Vorea Studio — Parametric Storage Bin
// Customizable desktop organizer bin with rounded corners
// Compatible: Vorea Studio SCAD Engine

// [Section: Dimensions]
width = 42;       // [20:2:100] Ancho (mm)
depth = 42;       // [20:2:100] Profundidad (mm)
height = 50;      // [15:5:120] Altura (mm)
wall = 2;         // [1:0.5:5] Grosor de pared

// [Section: Design]
corner_r = 4;     // [1:1:15] Radio de esquinas
bottom = 2;       // [1:0.5:5] Grosor de fondo
divisions_x = 1;  // [1:1:4] Divisiones horizontales
divisions_y = 1;  // [1:1:4] Divisiones verticales

$fn = 32;

// Rounded box module
module rounded_box(w, d, h, r) {
  hull() {
    translate([r, r, 0]) cylinder(r=r, h=h);
    translate([w-r, r, 0]) cylinder(r=r, h=h);
    translate([r, d-r, 0]) cylinder(r=r, h=h);
    translate([w-r, d-r, 0]) cylinder(r=r, h=h);
  }
}

// Main bin
difference() {
  // Outer shell
  rounded_box(width, depth, height, corner_r);
  
  // Inner cavity
  translate([wall, wall, bottom])
    rounded_box(width - wall*2, depth - wall*2, height, corner_r - wall/2);
}

// Internal dividers X
if (divisions_x > 1) {
  for (i = [1 : divisions_x - 1]) {
    translate([width / divisions_x * i - wall/4, wall, bottom])
      cube([wall/2, depth - wall*2, height - bottom]);
  }
}

// Internal dividers Y
if (divisions_y > 1) {
  for (i = [1 : divisions_y - 1]) {
    translate([wall, depth / divisions_y * i - wall/4, bottom])
      cube([width - wall*2, wall/2, height - bottom]);
  }
}
