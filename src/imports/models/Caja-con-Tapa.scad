// --- Parámetros ---
width = 60;
depth = 40;
height = 30;
thickness = 2.0;
corner_radius = 4; // 0 para bordes angulados
is_lid = false;    // Cambiar a true para generar la tapa

$fn = 64;

module rounded_box(w, d, h, r) {
    if (r > 0) {
        hull() {
            translate([r, r, 0]) cylinder(r=r, h=h);
            translate([w-r, r, 0]) cylinder(r=r, h=h);
            translate([r, d-r, 0]) cylinder(r=r, h=h);
            translate([w-r, d-r, 0]) cylinder(r=r, h=h);
        }
    } else {
        cube([w, d, h]);
    }
}

if (!is_lid) {
    // Cuerpo de la caja
    difference() {
        rounded_box(width, depth, height, corner_radius);
        translate([thickness, thickness, thickness])
            rounded_box(width - thickness*2, depth - thickness*2, height, corner_radius - thickness);
    }
} else {
    // Tapa con tolerancia para encaje (0.2mm)
    difference() {
        rounded_box(width + 0.4, depth + 0.4, thickness * 2, corner_radius + 0.2);
        translate([thickness/2, thickness/2, thickness])
            rounded_box(width - thickness/2 + 0.4, depth - thickness/2 + 0.4, thickness + 1, corner_radius);
    }
}