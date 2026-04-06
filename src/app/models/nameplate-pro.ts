/** Nameplate Pro – Parametric OpenSCAD model */
export const NAMEPLATE_PRO_SCAD = `// Nameplate Pro
$fn = 48;

plate_w = 120; // [60:2:220] Plate width
plate_h = 36; // [20:1:80] Plate height
plate_d = 4.2; // [2:0.2:10] Body thickness
corner_r = 4; // [0:0.5:16] Corner radius
text_size = 14; // [6:0.5:28] Text size
text_depth = 1.2; // [0.4:0.1:4] Text depth
border_w = 2.2; // [0.8:0.2:6] Border width
stand_angle = 74; // [60:1:88] Reading angle
label_text = "VOREA";
primary_text = "VOREA";
secondary_text = "";
line_count = 1;
border = true;
base_stand = true;
engraved = false;

safe_corner_r = min(corner_r, min(plate_w, plate_h) / 2 - 0.6);
safe_border_w = min(border_w, min(plate_w, plate_h) / 3);
tilt = 90 - stand_angle;
plate_lift = plate_h / 2 * cos(tilt) + plate_d / 2 * sin(tilt);
text_h = max(0.2, text_depth);
text_max_w = max(20, plate_w - safe_border_w * 2 - safe_corner_r * 1.4 - 8);
text_max_h = max(10, plate_h - safe_border_w * 2 - 6);
line_gap = max(1.2, text_size * 0.18);
line_offset = line_count > 1 ? (text_size * 0.62 + line_gap * 0.5) : 0;
est_line_w = max(1, max(len(primary_text), len(secondary_text)) * text_size * 0.62);
text_block_h = line_count > 1 ? text_size * 2 + line_gap : text_size;
text_fit = min(1, text_max_w / est_line_w, text_max_h / max(1, text_block_h));

module rounded_plate_centered(w, d, h, r) {
    hull() {
        for (x = [-w / 2 + r, w / 2 - r]) {
            for (z = [-h / 2 + r, h / 2 - r]) {
                translate([x, 0, z])
                    rotate([90, 0, 0])
                        cylinder(r = max(0.4, r), h = d, center = true);
            }
        }
    }
}

module plate_pose() {
    translate([0, 0, plate_lift])
        rotate([tilt, 0, 0])
            children();
}

module front_text_outline() {
    if (line_count > 1) {
        translate([0, line_offset, 0])
            text(primary_text, size = text_size, halign = "center", valign = "center");
        translate([0, -line_offset, 0])
            text(secondary_text, size = text_size, halign = "center", valign = "center");
    } else {
        text(primary_text, size = text_size, halign = "center", valign = "center");
    }
}

module front_text_solid(height_override = text_h) {
    rotate([-90, 0, 0])
        linear_extrude(height = height_override)
            scale([text_fit, text_fit])
                front_text_outline();
}

module sign_plate() {
    difference() {
        rounded_plate_centered(plate_w, plate_d, plate_h, safe_corner_r);
        if (engraved) {
            translate([0, plate_d / 2 - text_h - 0.01, 0])
                front_text_solid(text_h + 0.02);
        }
    }
}

module border_frame() {
    if (border) {
        difference() {
            rounded_plate_centered(plate_w, text_depth, plate_h, safe_corner_r);
            rounded_plate_centered(
                max(12, plate_w - safe_border_w * 2),
                text_depth + 0.2,
                max(10, plate_h - safe_border_w * 2),
                max(0.4, safe_corner_r - safe_border_w)
            );
        }
    }
}

plate_pose() {
    sign_plate();

    if (!engraved) {
        translate([0, plate_d / 2, 0])
            front_text_solid();
    }

    translate([0, plate_d / 2 + text_depth / 2, 0])
        border_frame();
}

if (base_stand) {
    base_depth = max(10, plate_d * 4.5);
    base_h = max(2, plate_d * 0.8);

    translate([0, -base_depth / 2 + plate_d, base_h / 2])
        cube([plate_w, base_depth, base_h], center = true);

    hull() {
        translate([0, -plate_d * 0.5, base_h])
            cube([max(18, plate_w * 0.18), plate_d, base_h], center = true);
        translate([0, -plate_d * 0.2, plate_lift * 0.45])
            cube([max(10, plate_w * 0.12), plate_d * 0.8, base_h], center = true);
    }
}
`;
