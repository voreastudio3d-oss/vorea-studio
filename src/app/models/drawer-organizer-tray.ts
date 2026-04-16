/** Bandeja organizadora de cajon - Modelo OpenSCAD parametrico */
export const DRAWER_ORGANIZER_TRAY_SCAD = `// Bandeja organizadora de cajon
$fn = 32;

tray_w = 140; // [50:5:280] Ancho exterior
tray_d = 95; // [40:5:220] Profundidad exterior
tray_h = 34; // [12:2:90] Altura total
wall = 2.4; // [1.2:0.2:6] Espesor de pared
floor = 1.8; // [1:0.2:5] Espesor de base
cells_x = 3; // [1:8] Columnas
cells_y = 2; // [1:6] Filas
corner_r = 6; // [0:1:18] Radio de esquina
lip = 1.2; // [0:0.2:4] Refuerzo superior

outer_w = tray_w;
outer_d = tray_d;
outer_h = tray_h;
inner_w = max(10, outer_w - wall * 2);
inner_d = max(10, outer_d - wall * 2);
divider = max(1.2, wall * 0.85);
usable_h = max(8, outer_h - floor);

module rounded_rect_prism(w, d, h, r) {
    safe_r = min(r, min(w, d) / 2 - 0.1);
    if (safe_r <= 0) {
        cube([w, d, h]);
    } else {
        hull() {
            translate([safe_r, safe_r, 0]) cylinder(h = h, r = safe_r);
            translate([w - safe_r, safe_r, 0]) cylinder(h = h, r = safe_r);
            translate([w - safe_r, d - safe_r, 0]) cylinder(h = h, r = safe_r);
            translate([safe_r, d - safe_r, 0]) cylinder(h = h, r = safe_r);
        }
    }
}

module tray_shell() {
    difference() {
        rounded_rect_prism(outer_w, outer_d, outer_h, corner_r);
        translate([wall, wall, floor])
            rounded_rect_prism(inner_w, inner_d, outer_h + 0.2, max(0.4, corner_r - wall));
    }
}

module tray_dividers() {
    divider_h = max(6, usable_h - lip);

    if (cells_x > 1) {
        pitch_x = inner_w / cells_x;
        for (ix = [1:cells_x - 1]) {
            translate([wall + pitch_x * ix - divider / 2, wall, floor])
                cube([divider, inner_d, divider_h]);
        }
    }

    if (cells_y > 1) {
        pitch_y = inner_d / cells_y;
        for (iy = [1:cells_y - 1]) {
            translate([wall, wall + pitch_y * iy - divider / 2, floor])
                cube([inner_w, divider, divider_h]);
        }
    }
}

translate([-outer_w / 2, -outer_d / 2, 0]) {
    tray_shell();
    tray_dividers();

    if (lip > 0) {
        translate([0, 0, outer_h - lip])
            difference() {
                rounded_rect_prism(outer_w, outer_d, lip, corner_r);
                translate([wall, wall, -0.1])
                    rounded_rect_prism(inner_w, inner_d, lip + 0.2, max(0.4, corner_r - wall));
            }
    }
}
`;
