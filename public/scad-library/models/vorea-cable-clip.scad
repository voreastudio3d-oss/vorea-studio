// Vorea Studio — Parametric Cable Organizer Clip
// Desk-mount cable clip with adjustable channel count and sizes
// Compatible: Vorea Studio SCAD Engine

// [Section: Cable Settings]
cable_diameter = 6;    // [3:0.5:12] Diametro del cable (mm)
channels = 3;          // [1:1:6] Numero de canales
channel_gap = 3;       // [2:1:8] Espacio entre canales

// [Section: Clip Design]
wall = 2;              // [1.5:0.5:4] Grosor de pared
clip_height = 12;      // [8:2:25] Altura del clip
base_width = 8;        // [5:1:15] Extension de la base
opening_factor = 0.6;  // [0.4:0.1:0.8] Apertura del clip (0.4=cerrado, 0.8=abierto)

// [Section: Mount]
adhesive_pad = 1;      // [0:1:1] Plataforma adhesiva (0=no, 1=si)
screw_hole = 0;        // [0:1:1] Agujero para tornillo (0=no, 1=si)

$fn = 36;

r = cable_diameter / 2;
total_width = channels * (cable_diameter + wall*2) + (channels - 1) * channel_gap;

// Base plate
translate([-base_width, 0, 0])
  cube([total_width + base_width * 2, wall, clip_height]);

// Adhesive pad
if (adhesive_pad == 1) {
  translate([-base_width, -wall, 0])
    cube([total_width + base_width * 2, wall * 3, wall]);
}

// Screw hole
if (screw_hole == 1) {
  difference() {
    translate([total_width/2, -wall*2, 0])
      cylinder(r=4, h=wall);
    translate([total_width/2, -wall*2, -0.5])
      cylinder(r=1.5, h=wall+1);
  }
}

// Cable channels
for (i = [0 : channels - 1]) {
  cx = i * (cable_diameter + wall*2 + channel_gap) + r + wall;
  
  translate([cx, wall + r, clip_height/2])
    rotate([0, 0, 0])
      difference() {
        // Outer ring
        cylinder(r = r + wall, h = clip_height, center = true);
        // Inner channel
        cylinder(r = r, h = clip_height + 1, center = true);
        // Opening slot
        translate([0, r * opening_factor, 0])
          cube([r * opening_factor * 2, r * 2, clip_height + 2], center = true);
      }
}
