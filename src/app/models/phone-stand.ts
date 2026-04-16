/** Soporte para telefono/tablet - Modelo OpenSCAD parametrico */
export const PHONE_STAND_SCAD = `// Soporte para telefono/tablet
$fn = 24;

// Dimensiones del dispositivo
device_thickness = 10; // [6:0.5:20] Espesor del dispositivo con funda
device_width = 80; // [50:5:200] Ancho de abertura del soporte

// Geometria del soporte
stand_angle = 65; // [30:5:85] Angulo de vision desde la horizontal
base_depth = 80; // [50:5:120] Profundidad de base
base_width = 100; // [60:5:200] Ancho de base
base_height = 5; // [3:1:10] Espesor de base

// Respaldo
back_height = 60; // [30:5:120] Altura del respaldo
back_thickness = 4; // [3:0.5:8] Espesor del respaldo

// Labio (tope frontal)
lip_height = 15; // [8:1:30] Altura del labio frontal
lip_depth = 12; // [8:1:25] Profundidad del labio frontal

// Ranura
slot_width = 14; // [8:1:30] Ancho de ranura para cable/cargador
include_cable_slot = true;

// Patas de goma
include_pads = true;
pad_diameter = 8;
pad_height = 1;

// Estetica
include_fillet = true;
fillet_r = 8; // [3:1:15]
corner_r = 3;

// Calculado
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

    // Ranura para dispositivo
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
