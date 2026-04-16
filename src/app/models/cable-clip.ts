/** Clip para cables - Modelo OpenSCAD parametrico */
export const CABLE_CLIP_SCAD = `// Clip para cables
$fn = 24;

// Parametros de cable
cable_diameter = 6; // [2:0.5:20] Diametro del cable en mm
num_slots = 3; // [1:6] Cantidad de ranuras
slot_spacing = 4; // [2:1:12] Espacio entre ranuras

// Cuerpo del clip
clip_height = 12; // [8:1:25] Altura total
clip_depth = 8; // [5:1:15] Profundidad (frente a fondo)
wall = 2; // [1:0.5:4] Espesor de pared

// Abertura
opening_angle = 45; // [30:5:90] Angulo de apertura en grados
include_grip_ridges = true;

// Montaje
mount_type = 0; // 0=plano, 1=tornillo
screw_hole_diameter = 3.5; // [2:0.1:6]
mount_width = 10; // [6:1:20]
mount_height = 3; // [2:0.5:6]

// Calculado
cable_r = cable_diameter / 2;
total_width = num_slots * (cable_diameter + wall * 2) + (num_slots - 1) * slot_spacing;

module cable_slot(x_offset) {
    translate([x_offset, 0, 0]) {
        // Cilindro externo (cuerpo del clip)
        difference() {
            cylinder(h = clip_height, r = cable_r + wall);

            // Canal del cable
            translate([0, 0, -0.1])
            cylinder(h = clip_height + 0.2, r = cable_r);

            // Corte de abertura
            translate([0, 0, -0.1])
            rotate([0, 0, 90 - opening_angle / 2])
            cube([cable_r + wall + 1, cable_r + wall + 1, clip_height + 0.2]);
        }
    }
}

module mount_base() {
    // Base de montaje plana
    translate([-mount_width / 2, -(cable_r + wall + clip_depth), 0])
    cube([total_width + mount_width, clip_depth, mount_height]);

    if (mount_type == 1) {
        // Orificio para tornillo
        translate([total_width / 2, -(cable_r + wall + clip_depth / 2), 0])
        difference() {
            cylinder(h = mount_height, r = screw_hole_diameter);
            translate([0, 0, -0.1])
            cylinder(h = mount_height + 0.2, r = screw_hole_diameter / 2);
        }
    }
}

module grip_ridges(x_offset) {
    if (include_grip_ridges) {
        ridge_count = 3;
        ridge_spacing = clip_height / (ridge_count + 1);
        translate([x_offset, cable_r + wall - 0.5, 0])
        for (i = [1 : ridge_count]) {
            translate([0, 0, i * ridge_spacing])
            cube([1, 1, 1]);
        }
    }
}

// Construir clip
translate([-total_width / 2, 0, 0]) {
    for (i = [0 : num_slots - 1]) {
        x = i * (cable_diameter + wall * 2 + slot_spacing);
        cable_slot(x + cable_r + wall);
        grip_ridges(x + cable_r + wall);
    }
    mount_base();
}
`;
