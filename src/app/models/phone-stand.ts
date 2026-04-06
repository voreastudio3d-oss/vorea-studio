/** Phone/Tablet Stand – Parametric OpenSCAD model */
export const PHONE_STAND_SCAD = `// Phone/Tablet Stand
$fn = 24;

// Device Dimensions
device_thickness = 10; // [6:0.5:20] Device thickness with case
device_width = 80; // [50:5:200] Stand opening width

// Stand Geometry
stand_angle = 65; // [30:5:85] Viewing angle from horizontal
base_depth = 80; // [50:5:120] Base depth
base_width = 100; // [60:5:200] Base width
base_height = 5; // [3:1:10] Base thickness

// Back Support
back_height = 60; // [30:5:120] Back support height
back_thickness = 4; // [3:0.5:8]

// Lip (front stopper)
lip_height = 15; // [8:1:30] Front lip height
lip_depth = 12; // [8:1:25] Front lip depth

// Slot
slot_width = 14; // [8:1:30] Cable/charger slot width
include_cable_slot = true;

// Rubber Pads
include_pads = true;
pad_diameter = 8;
pad_height = 1;

// Aesthetics
include_fillet = true;
fillet_r = 8; // [3:1:15]
corner_r = 3;

// Calculated
back_offset = base_depth - back_thickness;
slot_offset = device_thickness + 2;

module rounded_base() {
    hull() {
        translate([corner_r, corner_r, 0])
        cylinder(h = base_height, r = corner_r);
        translate([base_width - corner_r, corner_r, 0])
        cylinder(h = base_height, r = corner_r);
        translate([base_width - corner_r, base_depth - corner_r, 0])
        cylinder(h = base_height, r = corner_r);
        translate([corner_r, base_depth - corner_r, 0])
        cylinder(h = base_height, r = corner_r);
    }
}

module back_support() {
    translate([0, back_offset, base_height])
    rotate([90 - stand_angle, 0, 0])
    cube([base_width, back_height, back_thickness]);
}

module front_lip() {
    translate([0, 0, base_height])
    cube([base_width, lip_depth, lip_height]);

    // Device slot
    translate([(base_width - device_width) / 2, lip_depth - device_thickness, base_height])
    cube([device_width, device_thickness, lip_height + 5]);
}

module cable_slot() {
    if (include_cable_slot) {
        translate([(base_width - slot_width) / 2, lip_depth / 2 - slot_width / 2, -0.1])
        cube([slot_width, slot_width, base_height + lip_height + 1]);
    }
}

module support_fillet() {
    if (include_fillet) {
        translate([0, back_offset - fillet_r, base_height])
        cube([base_width, fillet_r, fillet_r]);
    }
}

module rubber_pads() {
    if (include_pads) {
        pad_inset = 10;
        translate([pad_inset, pad_inset, 0])
        cylinder(h = pad_height, r = pad_diameter / 2);
        translate([base_width - pad_inset, pad_inset, 0])
        cylinder(h = pad_height, r = pad_diameter / 2);
        translate([pad_inset, base_depth - pad_inset, 0])
        cylinder(h = pad_height, r = pad_diameter / 2);
        translate([base_width - pad_inset, base_depth - pad_inset, 0])
        cylinder(h = pad_height, r = pad_diameter / 2);
    }
}

translate([-base_width / 2, -base_depth / 2, 0]) {
    difference() {
        union() {
            rounded_base();
            back_support();
            front_lip();
            support_fillet();
        }
        cable_slot();
    }
    rubber_pads();
}
`;
