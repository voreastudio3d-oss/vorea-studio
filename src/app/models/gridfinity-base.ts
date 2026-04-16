/** Base Gridfinity - Modelo OpenSCAD parametrico */
export const GRIDFINITY_BASE_SCAD = `// Generador de Base Gridfinity
$fn = 32;

// Configuracion de grilla
grid_x = 3; // [1:8] Cantidad de unidades en X
grid_y = 2; // [1:6] Cantidad de unidades en Y

// Dimensiones de unidad (mm)
unit_size = 42; // Unidad estandar Gridfinity
base_height = 5; // [3:0.5:10] Altura de la base

// Esquinas y borde
corner_radius = 4; // [1:0.5:8]
wall_thickness = 2; // [1:0.5:4]

// Orificios para imanes
include_magnets = true;
magnet_diameter = 6.2; // [5:0.1:8]
magnet_depth = 2.4; // [1:0.1:4]

// Orificios para tornillos
include_screws = false;
screw_diameter = 3.2; // [2:0.1:5]
screw_depth = 4; // [2:0.1:8]

// Perfil de labio
lip_height = 2.6;
lip_width = 1.2;

// Calculado
total_x = grid_x * unit_size;
total_y = grid_y * unit_size;

module rounded_plate(w, d, h, r) {
    hull() {
        translate([r, r, 0])
        cylinder(h = h, r = r);
        translate([w - r, r, 0])
        cylinder(h = h, r = r);
        translate([w - r, d - r, 0])
        cylinder(h = h, r = r);
        translate([r, d - r, 0])
        cylinder(h = h, r = r);
    }
}

module single_base_unit(x_pos, y_pos) {
    translate([x_pos * unit_size, y_pos * unit_size, 0]) {
        difference() {
            rounded_plate(unit_size, unit_size, base_height, corner_radius);

            translate([wall_thickness, wall_thickness, wall_thickness])
            rounded_plate(unit_size - wall_thickness * 2, unit_size - wall_thickness * 2, base_height, corner_radius - wall_thickness / 2);
        }

        // Perfil de labio
        translate([0, 0, base_height])
        difference() {
            rounded_plate(unit_size, unit_size, lip_height, corner_radius);
            translate([lip_width, lip_width, 0])
            rounded_plate(unit_size - lip_width * 2, unit_size - lip_width * 2, lip_height, corner_radius - lip_width / 2);
        }

        // Orificios para imanes
        if (include_magnets) {
            magnet_r = magnet_diameter / 2;
            magnet_inset = 8;
            translate([magnet_inset, magnet_inset, 0])
            cylinder(h = magnet_depth, r = magnet_r);
            translate([unit_size - magnet_inset, magnet_inset, 0])
            cylinder(h = magnet_depth, r = magnet_r);
            translate([unit_size - magnet_inset, unit_size - magnet_inset, 0])
            cylinder(h = magnet_depth, r = magnet_r);
            translate([magnet_inset, unit_size - magnet_inset, 0])
            cylinder(h = magnet_depth, r = magnet_r);
        }

        // Orificios para tornillos
        if (include_screws) {
            screw_r = screw_diameter / 2;
            translate([unit_size / 2, unit_size / 2, 0])
            cylinder(h = screw_depth, r = screw_r);
        }
    }
}

// Generar grilla
for (ix = [0 : grid_x - 1]) {
    for (iy = [0 : grid_y - 1]) {
        single_base_unit(ix, iy);
    }
}

translate([-total_x / 2, -total_y / 2, 0])
rounded_plate(total_x, total_y, wall_thickness, corner_radius);
`;
