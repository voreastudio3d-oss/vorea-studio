/** Gridfinity Baseplate – Parametric OpenSCAD model */
export const GRIDFINITY_BASE_SCAD = `// Gridfinity Baseplate Generator
$fn = 32;

// Grid Configuration
grid_x = 3; // [1:8] Number of units in X
grid_y = 2; // [1:6] Number of units in Y

// Unit Dimensions (mm)
unit_size = 42; // Standard gridfinity unit
base_height = 5; // [3:0.5:10] Base plate height

// Corner and Edge
corner_radius = 4; // [1:0.5:8]
wall_thickness = 2; // [1:0.5:4]

// Magnet Holes
include_magnets = true;
magnet_diameter = 6.2; // [5:0.1:8]
magnet_depth = 2.4; // [1:0.1:4]

// Screw Holes
include_screws = false;
screw_diameter = 3.2; // [2:0.1:5]
screw_depth = 4; // [2:0.1:8]

// Lip Profile
lip_height = 2.6;
lip_width = 1.2;

// Calculated
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

        // Lip profile
        translate([0, 0, base_height])
        difference() {
            rounded_plate(unit_size, unit_size, lip_height, corner_radius);
            translate([lip_width, lip_width, 0])
            rounded_plate(unit_size - lip_width * 2, unit_size - lip_width * 2, lip_height, corner_radius - lip_width / 2);
        }

        // Magnet holes
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

        // Screw holes
        if (include_screws) {
            screw_r = screw_diameter / 2;
            translate([unit_size / 2, unit_size / 2, 0])
            cylinder(h = screw_depth, r = screw_r);
        }
    }
}

// Generate grid
for (ix = [0 : grid_x - 1]) {
    for (iy = [0 : grid_y - 1]) {
        single_base_unit(ix, iy);
    }
}

translate([-total_x / 2, -total_y / 2, 0])
rounded_plate(total_x, total_y, wall_thickness, corner_radius);
`;
