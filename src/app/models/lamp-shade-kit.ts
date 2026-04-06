/** Lamp Shade Kit – Parametric OpenSCAD model */
export const LAMP_SHADE_KIT_SCAD = `// Lamp Shade Kit
$fn = 48;

top_d = 158; // [80:2:260] Top diameter
bottom_d = 92; // [50:2:180] Bottom diameter
shade_h = 148; // [60:2:280] Shade height
wall = 1.8; // [1.2:0.1:4] Wall thickness
openings = 18; // [6:36] Openings per row
vent_rows = 4; // [1:8] Vent rows
vent_d = 9; // [3:0.5:18] Opening diameter
seat_d = 42; // [20:0.5:80] Kit seat diameter
seat_h = 12; // [4:1:28] Seat collar height
fit = 0.5; // [0.1:0.1:2] Fit tolerance

outer_r_bottom = bottom_d / 2;
outer_r_top = top_d / 2;
inner_r_bottom = max(seat_d / 2 + wall + fit, outer_r_bottom - wall);
inner_r_top = max(inner_r_bottom + 8, outer_r_top - wall);
top_open_d = max(20, top_d - wall * 4);
collar_outer_d = max(seat_d + wall * 4, bottom_d - wall * 3);
vent_start_z = seat_h + 8;
vent_end_z = shade_h - max(10, vent_d * 1.2);
row_step = vent_rows > 1 ? (vent_end_z - vent_start_z) / (vent_rows - 1) : 0;

module shade_body() {
    difference() {
        cylinder(h = shade_h, r1 = outer_r_bottom, r2 = outer_r_top);

        translate([0, 0, seat_h])
            cylinder(h = shade_h - seat_h + 0.4, r1 = inner_r_bottom, r2 = inner_r_top);

        translate([0, 0, -0.1])
            cylinder(h = seat_h + 0.3, d = seat_d + fit);

        translate([0, 0, shade_h - wall])
            cylinder(h = wall + 0.3, d = top_open_d);

        for (row = [0:vent_rows - 1]) {
            z = vent_rows == 1 ? (vent_start_z + vent_end_z) / 2 : vent_start_z + row * row_step;
            ring_r = outer_r_bottom + (outer_r_top - outer_r_bottom) * (z / shade_h) - wall * 0.25;
            offset = row % 2 == 0 ? 0 : 180 / openings;
            for (i = [0:openings - 1]) {
                angle = i * 360 / openings + offset;
                rotate([0, 0, angle])
                    translate([ring_r, 0, z])
                        rotate([0, 90, 0])
                            cylinder(d = vent_d, h = max(8, wall * 8), center = true, $fn = 18);
            }
        }
    }
}

module bottom_collar() {
    difference() {
        cylinder(h = seat_h, d = collar_outer_d);
        translate([0, 0, -0.1])
            cylinder(h = seat_h + 0.2, d = seat_d + fit);
    }
}

union() {
    shade_body();
    bottom_collar();
}
`;
