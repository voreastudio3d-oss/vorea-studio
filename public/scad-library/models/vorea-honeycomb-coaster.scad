// Vorea Studio — Parametric Honeycomb Coaster
// Hexagonal pattern coaster with raised rim
// Compatible: Vorea Studio SCAD Engine

// [Section: Dimensions]
diameter = 90;      // [60:5:120] Diametro total (mm)
height = 4;         // [2:1:8] Altura total (mm)
rim_height = 2;     // [0:0.5:4] Altura del borde elevado
rim_width = 3;      // [2:1:6] Ancho del borde

// [Section: Pattern]
hex_size = 8;       // [4:1:15] Tamano de cada hexagono (mm)
hex_wall = 1.5;     // [0.8:0.2:3] Grosor de las paredes hexagonales
hex_depth = 2;      // [1:0.5:4] Profundidad del patron

$fn = 6;  // Hexagons!

r = diameter / 2;

// Base disc
difference() {
  // Solid base
  cylinder(r = r, h = height, $fn = 64);
  
  // Honeycomb cutouts
  dx = (hex_size + hex_wall) * 1.5;
  dy = (hex_size + hex_wall) * sin(60) * 2;
  
  for (row = [-6 : 6]) {
    for (col = [-6 : 6]) {
      x = col * dx;
      y = row * dy + (col % 2 == 0 ? 0 : dy / 2);
      dist = sqrt(x*x + y*y);
      
      if (dist < r - rim_width - hex_size) {
        translate([x, y, height - hex_depth])
          cylinder(r = hex_size / 2, h = hex_depth + 1, $fn = 6);
      }
    }
  }
}

// Raised rim
if (rim_height > 0) {
  difference() {
    cylinder(r = r, h = height + rim_height, $fn = 64);
    translate([0, 0, -0.1])
      cylinder(r = r - rim_width, h = height + rim_height + 0.2, $fn = 64);
  }
}
