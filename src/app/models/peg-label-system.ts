/** Sistema de etiquetas para pegboard - Modelo OpenSCAD parametrico */
export const PEG_LABEL_SYSTEM_SCAD = `// Sistema de etiquetas para pegboard
$fn = 48;

label_w = 84; // [40:2:180] Ancho frontal
label_h = 24; // [16:1:60] Alto frontal
label_d = 3.2; // [2:0.2:8] Espesor del cuerpo
corner_r = 4; // [0:0.5:14] Radio de esquina
text_size = 8.5; // [4:0.5:20] Tamano de texto
text_depth = 1; // [0.4:0.1:3] Profundidad de texto
border_w = 1.6; // [0.6:0.2:5] Ancho de borde
hook_gap = 4.2; // [1.5:0.2:12] Espesor de soporte
hook_depth = 8; // [4:0.5:20] Profundidad de clip
hook_drop = 12; // [6:0.5:32] Caida de clip
hook_spacing = 42; // [18:1:120] Separacion de clips
label_text = "BITS";
primary_text = "BITS";
secondary_text = "";
line_count = 1;
border = true;
engraved = false;

safe_corner_r = min(corner_r, min(label_w, label_h) / 2 - 0.6);
safe_border_w = min(border_w, min(label_w, label_h) / 3);
text_h = max(0.2, text_depth);
text_max_w = max(20, label_w - safe_border_w * 2 - safe_corner_r * 1.2 - 8);
text_max_h = max(8, label_h - safe_border_w * 2 - 5);
line_gap = max(1, text_size * 0.16);
line_offset = line_count > 1 ? (text_size * 0.58 + line_gap * 0.5) : 0;
est_line_w = max(1, max(len(primary_text), len(secondary_text)) * text_size * 0.62);
text_block_h = line_count > 1 ? text_size * 2 + line_gap : text_size;
text_fit = min(1, text_max_w / est_line_w, text_max_h / max(1, text_block_h));
clip_w = max(10, label_w * 0.16);
clip_body = max(1.8, label_d * 0.85);
clip_back_y = -label_d / 2 - hook_gap - clip_body / 2;
clip_bridge_y = -label_d / 2 - (hook_gap + clip_body) / 2;
clip_top_z = label_h / 2 - clip_body / 2;
clip_bottom_z = label_h / 2 - hook_drop;
retainer_d = min(hook_gap * 0.55, max(1.2, clip_body * 0.8));
safe_spacing = min(hook_spacing, label_w - clip_w - 8);
support_depth = max(hook_depth, hook_gap + clip_body);

module rounded_label(w, d, h, r) {
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

module label_body() {
    difference() {
        rounded_label(label_w, label_d, label_h, safe_corner_r);
        if (engraved) {
            translate([0, label_d / 2 - text_h - 0.01, 0])
                front_text_solid(text_h + 0.02);
        }
    }
}

module border_frame() {
    if (border) {
        difference() {
            rounded_label(label_w, text_depth, label_h, safe_corner_r);
            rounded_label(
                max(12, label_w - safe_border_w * 2),
                text_depth + 0.2,
                max(8, label_h - safe_border_w * 2),
                max(0.4, safe_corner_r - safe_border_w)
            );
        }
    }
}

module rear_clip() {
    translate([0, clip_bridge_y - max(0, support_depth - (hook_gap + clip_body)) / 2, clip_top_z])
        cube([clip_w, support_depth, clip_body], center = true);

    translate([0, clip_back_y - max(0, support_depth - clip_body) / 2, label_h / 2 - hook_drop / 2])
        cube([clip_w, clip_body, hook_drop], center = true);

    translate([0, -label_d / 2 - hook_gap + retainer_d / 2, clip_bottom_z + clip_body / 2])
        cube([clip_w, retainer_d, clip_body], center = true);
}

label_body();

if (!engraved) {
    translate([0, label_d / 2, 0])
        front_text_solid();
}

translate([0, label_d / 2 + text_depth / 2, 0])
    border_frame();

for (x = [-safe_spacing / 2, safe_spacing / 2]) {
    translate([x, 0, 0])
        rear_clip();
}
`;
