/** Rounded Box with Lid – Parametric OpenSCAD model */
export const ROUNDED_BOX_SCAD = `// Rounded Box with Snap-Fit Lid
$fn = 24;

// Box Dimensions (inner, in mm)
box_width = 60; // [20:5:150] Inner width
box_depth = 40; // [20:5:100] Inner depth
box_height = 30; // [10:5:80] Inner height

// Wall and Corner
wall = 2; // [1:0.5:5] Wall thickness
corner_r = 5; // [1:1:15] Corner radius
bottom_thickness = 2; // [1:0.5:5]

// Lid
include_lid = true;
lid_height = 8; // [4:1:20] Lid total height
lid_clearance = 0.3; // [0.1:0.05:0.6] Fit tolerance

// Snap Fit
include_snap = true;
snap_height = 3; // [2:0.5:6]
snap_depth = 1; // [0.5:0.25:2]

// Dividers
dividers_x = 1; // [0:4] Number of X dividers
dividers_y = 0; // [0:4] Number of Y dividers
divider_thickness = 1.5; // [1:0.5:3]

// Pattern
include_pattern = false; // Hexagonal vent pattern on sides

// Calculated
outer_w = box_width + wall * 2;
outer_d = box_depth + wall * 2;
outer_h = box_height + bottom_thickness;

module rounded_box(w, d, h, r) {
    hull() {
        translate([r, r, 0]) cylinder(h = h, r = r);
        translate([w - r, r, 0]) cylinder(h = h, r = r);
        translate([w - r, d - r, 0]) cylinder(h = h, r = r);
        translate([r, d - r, 0]) cylinder(h = h, r = r);
    }
}

// Main box body
module box_body() {
    difference() {
        // Outer shell
        rounded_box(outer_w, outer_d, outer_h, corner_r);

        // Inner cavity
        translate([wall, wall, bottom_thickness])
        rounded_box(box_width, box_depth, box_height + 1, corner_r - wall / 2);
    }

    // Snap-fit ridge on box (male)
    if (include_snap) {
        snap_z = outer_h - snap_height;
        difference() {
            translate([wall / 2, wall / 2, snap_z])
            rounded_box(outer_w - wall, outer_d - wall, snap_height, corner_r);

            translate([wall / 2 + snap_depth, wall / 2 + snap_depth, snap_z - 0.1])
            rounded_box(outer_w - wall - snap_depth * 2, outer_d - wall - snap_depth * 2, snap_height + 0.2, corner_r - snap_depth);
        }
    }

    // Dividers X
    if (dividers_x > 0) {
        spacing_x = box_width / (dividers_x + 1);
        for (i = [1 : dividers_x]) {
            translate([wall + i * spacing_x - divider_thickness / 2, wall, bottom_thickness])
            cube([divider_thickness, box_depth, box_height]);
        }
    }

    // Dividers Y
    if (dividers_y > 0) {
        spacing_y = box_depth / (dividers_y + 1);
        for (i = [1 : dividers_y]) {
            translate([wall, wall + i * spacing_y - divider_thickness / 2, bottom_thickness])
            cube([box_width, divider_thickness, box_height]);
        }
    }
}

// Lid
module box_lid() {
    lid_w = outer_w + lid_clearance * 2;
    lid_d = outer_d + lid_clearance * 2;

    translate([outer_w + 10, 0, 0]) {
        difference() {
            rounded_box(lid_w, lid_d, lid_height, corner_r + lid_clearance);

            // Inner recess to sit on box
            translate([wall, wall, wall])
            rounded_box(lid_w - wall * 2, lid_d - wall * 2, lid_height, corner_r);
        }
    }
}

// Center the model
translate([-outer_w / 2, -outer_d / 2, 0]) {
    box_body();
    if (include_lid) box_lid();
}
`;
