/** Planter with Drip Tray – Parametric OpenSCAD model */
export const PLANTER_DRIP_SYSTEM_SCAD = `// Planter with Drip Tray
$fn = 48;

top_d = 128; // [60:2:240] Top diameter
bottom_d = 88; // [40:2:200] Bottom diameter
pot_h = 96; // [40:2:220] Pot height
wall = 2.2; // [1.2:0.2:6] Wall thickness
floor = 2.4; // [1.2:0.2:6] Floor thickness
drain_holes = 5; // [1:12] Drain hole count
drain_d = 6; // [2:0.5:14] Drain hole diameter
tray_gap = 3.2; // [1:0.2:10] Clearance with tray
tray_depth = 14; // [6:1:32] Tray depth
foot_h = 4; // [0:0.5:12] Foot height

pot_outer_r_top = top_d / 2;
pot_outer_r_bottom = bottom_d / 2;
pot_inner_r_top = max(10, pot_outer_r_top - wall);
pot_inner_r_bottom = max(8, pot_outer_r_bottom - wall);
tray_outer_d = top_d + tray_gap * 2 + wall * 4;
tray_inner_d = tray_outer_d - wall * 2;
drain_ring_r = max(drain_d, pot_inner_r_bottom * 0.48);
foot_span = max(10, pot_outer_r_bottom * 0.55);

module pot_shell() {
    difference() {
        cylinder(h = pot_h, r1 = pot_outer_r_bottom, r2 = pot_outer_r_top);
        translate([0, 0, floor + foot_h])
            cylinder(
                h = max(1, pot_h - floor + 0.2),
                r1 = max(6, pot_inner_r_bottom),
                r2 = max(8, pot_inner_r_top)
            );

        for (i = [0:drain_holes - 1]) {
            angle = i * 360 / drain_holes;
            rotate([0, 0, angle])
                translate([drain_ring_r, 0, -0.1])
                    cylinder(d = drain_d, h = floor + foot_h + 0.4);
        }
    }
}

module planter_feet() {
    if (foot_h > 0) {
        for (i = [0:2]) {
            angle = i * 120;
            rotate([0, 0, angle])
                translate([foot_span, 0, 0])
                    cylinder(h = foot_h, r = max(2.5, wall * 1.3));
        }
    }
}

module drip_tray() {
    difference() {
        cylinder(h = tray_depth, d = tray_outer_d);
        translate([0, 0, wall])
            cylinder(h = tray_depth + 0.2, d = max(20, tray_inner_d));
    }
}

translate([-(tray_outer_d + top_d) / 2 - 10, 0, 0]) {
    planter_feet();
    translate([0, 0, foot_h]) pot_shell();
}

translate([(tray_outer_d + top_d) / 2 + 10, 0, 0]) {
    drip_tray();
}
`;
