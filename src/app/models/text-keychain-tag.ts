/** Text Keychain Tag – Parametric OpenSCAD model */
export const TEXT_KEYCHAIN_TAG_SCAD = `// Text Keychain Tag
$fn = 48;

tag_w = 72; // [40:2:120] Tag width
tag_h = 28; // [18:1:54] Tag height
thick = 3.2; // [2:0.2:6] Body thickness
corner_r = 7; // [0:0.5:18] Corner radius
hole_d = 5; // [3:0.2:10] Ring hole diameter
hole_margin = 10; // [5:0.5:22] Hole margin from edge
text_size = 9; // [4:0.5:18] Text size
text_depth = 1.1; // [0.4:0.1:3] Text depth
label_text = "VOREA";
engraved = false; // false = embossed, true = engraved

safe_corner_r = min(corner_r, min(tag_w, tag_h) / 2 - 0.6);
text_h = max(0.2, text_depth);
hole_x = -tag_w / 2 + max(hole_margin, safe_corner_r + hole_d / 2 + 1.2);
text_left = hole_x + hole_d / 2 + 2.2;
text_right = tag_w / 2 - safe_corner_r - 2.2;
text_max_w = max(12, text_right - text_left);
text_max_h = max(8, tag_h - safe_corner_r * 0.9 - 4);
est_text_w = max(1, len(label_text) * text_size * 0.62);
text_fit = min(1, text_max_w / est_text_w, text_max_h / max(1, text_size));
text_x = (text_left + text_right) / 2;

module rounded_tag(w, h, z, r) {
    hull() {
        for (x = [-w / 2 + r, w / 2 - r]) {
            for (y = [-h / 2 + r, h / 2 - r]) {
                translate([x, y, 0]) cylinder(h = z, r = max(0.4, r));
            }
        }
    }
}

module tag_body() {
    difference() {
        rounded_tag(tag_w, tag_h, thick, safe_corner_r);
        translate([hole_x, 0, -0.1]) cylinder(d = hole_d, h = thick + 0.2);
        if (engraved) {
            translate([text_x, 0, thick - text_h - 0.01])
                linear_extrude(height = text_h + 0.02)
                    scale([text_fit, text_fit])
                        text(label_text, size = text_size, halign = "center", valign = "center");
        }
    }
}

tag_body();

if (!engraved) {
    translate([text_x, 0, thick])
        linear_extrude(height = text_h)
            scale([text_fit, text_fit])
                text(label_text, size = text_size, halign = "center", valign = "center");
}
`;
