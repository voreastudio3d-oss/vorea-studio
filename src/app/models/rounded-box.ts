/** Caja redondeada con tapa - Modelo OpenSCAD parametrico */
export const ROUNDED_BOX_SCAD = `// Caja redondeada con tapa a presion
$fn = 24;

// Dimensiones de caja (interior, en mm)
box_width = 60; // [20:5:150] Ancho interior
box_depth = 40; // [20:5:100] Profundidad interior
box_height = 30; // [10:5:80] Altura interior

// Pared y esquinas
wall = 2; // [1:0.5:5] Espesor de pared
corner_r = 5; // [1:1:15] Radio de esquina
bottom_thickness = 2; // [1:0.5:5] Espesor de base

// Tapa
include_lid = true;
lid_height = 8; // [4:1:20] Altura total de tapa
lid_clearance = 0.3; // [0.1:0.05:0.6] Tolerancia de ajuste

// Ajuste a presion
include_snap = true;
snap_height = 3; // [2:0.5:6]
snap_depth = 1; // [0.5:0.25:2]

// Divisores
dividers_x = 1; // [0:4] Cantidad de divisores en X
dividers_y = 0; // [0:4] Cantidad de divisores en Y
divider_thickness = 1.5; // [1:0.5:3]

// Patron
include_pattern = false; // Patron de ventilacion hexagonal en laterales

// Calculado
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

// Cuerpo principal de la caja
module box_body() {
    difference() {
        // Cascara externa
        rounded_box(outer_w, outer_d, outer_h, corner_r);

        // Cavidad interior
        translate([wall, wall, bottom_thickness])
        rounded_box(box_width, box_depth, box_height + 1, corner_r - wall / 2);
    }

    // Nervio de encastre en caja (macho)
    if (include_snap) {
        snap_z = outer_h - snap_height;
        difference() {
            translate([wall / 2, wall / 2, snap_z])
            rounded_box(outer_w - wall, outer_d - wall, snap_height, corner_r);

            translate([wall / 2 + snap_depth, wall / 2 + snap_depth, snap_z - 0.1])
            rounded_box(outer_w - wall - snap_depth * 2, outer_d - wall - snap_depth * 2, snap_height + 0.2, corner_r - snap_depth);
        }
    }

    // Divisores en X
    if (dividers_x > 0) {
        spacing_x = box_width / (dividers_x + 1);
        for (i = [1 : dividers_x]) {
            translate([wall + i * spacing_x - divider_thickness / 2, wall, bottom_thickness])
            cube([divider_thickness, box_depth, box_height]);
        }
    }

    // Divisores en Y
    if (dividers_y > 0) {
        spacing_y = box_depth / (dividers_y + 1);
        for (i = [1 : dividers_y]) {
            translate([wall, wall + i * spacing_y - divider_thickness / 2, bottom_thickness])
            cube([box_width, divider_thickness, box_height]);
        }
    }
}

// Tapa
module box_lid() {
    lid_w = outer_w + lid_clearance * 2;
    lid_d = outer_d + lid_clearance * 2;

    translate([outer_w + 10, 0, 0]) {
        difference() {
            rounded_box(lid_w, lid_d, lid_height, corner_r + lid_clearance);

            // Receso interior para apoyar en la caja
            translate([wall, wall, wall])
            rounded_box(lid_w - wall * 2, lid_d - wall * 2, lid_height, corner_r);
        }
    }
}

// Centrar modelo
translate([-outer_w / 2, -outer_d / 2, 0]) {
    box_body();
    if (include_lid) box_lid();
}
`;
