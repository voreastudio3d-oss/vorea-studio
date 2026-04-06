// Vorea Studio — Parametric Desk Nameplate
// Customizable nameplate with embossed text and decorative border
// Compatible: Vorea Studio SCAD Engine

// [Section: Text]
name_text = "VOREA";       // Text to display
font_size = 14;            // [8:1:30] Tamano de fuente (mm)
text_depth = 1.5;          // [0.5:0.5:4] Profundidad del texto (mm)

// [Section: Plate]
plate_width = 120;   // [60:5:200] Ancho de la placa (mm)
plate_height = 35;   // [20:5:60] Alto de la placa (mm)
plate_depth = 5;     // [3:1:10] Grosor de la placa (mm)
corner_r = 3;        // [0:1:10] Radio de esquinas

// [Section: Style]
border = 1;          // [0:1:1] Borde decorativo (0=no, 1=si)
border_width = 2;    // [1:0.5:5] Ancho del borde
base_stand = 1;      // [0:1:1] Base de apoyo (0=no, 1=si)
stand_angle = 75;    // [60:5:90] Angulo de inclinacion

$fn = 32;

// Rounded plate
module plate() {
  hull() {
    translate([corner_r, corner_r, 0]) cylinder(r=corner_r, h=plate_depth);
    translate([plate_width-corner_r, corner_r, 0]) cylinder(r=corner_r, h=plate_depth);
    translate([corner_r, plate_height-corner_r, 0]) cylinder(r=corner_r, h=plate_depth);
    translate([plate_width-corner_r, plate_height-corner_r, 0]) cylinder(r=corner_r, h=plate_depth);
  }
}

// Main assembly
rotate([90 - stand_angle, 0, 0]) {
  // Base plate
  plate();
  
  // Embossed text
  translate([plate_width/2, plate_height/2, plate_depth])
    linear_extrude(height = text_depth)
      text(name_text, size = font_size, halign = "center", valign = "center");
  
  // Decorative border
  if (border == 1) {
    difference() {
      translate([0, 0, plate_depth])
        plate();
      translate([border_width, border_width, plate_depth - 0.1])
        hull() {
          translate([corner_r, corner_r, 0]) cylinder(r=corner_r, h=plate_depth + 0.2);
          translate([plate_width-corner_r-border_width*2, corner_r, 0]) cylinder(r=corner_r, h=plate_depth + 0.2);
          translate([corner_r, plate_height-corner_r-border_width*2, 0]) cylinder(r=corner_r, h=plate_depth + 0.2);
          translate([plate_width-corner_r-border_width*2, plate_height-corner_r-border_width*2, 0]) cylinder(r=corner_r, h=plate_depth + 0.2);
        }
    }
  }
}

// Stand base
if (base_stand == 1) {
  translate([0, -plate_depth * 0.5, 0])
    cube([plate_width, plate_depth * 1.5, plate_depth/2]);
}
