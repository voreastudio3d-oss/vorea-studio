/** Frasco roscado - Modelo OpenSCAD parametrico */
export const THREADED_JAR_SCAD = `// Frasco roscado
$fn = 48;

body_d = 74; // [36:2:140] Diametro exterior del frasco
jar_h = 82; // [30:2:180] Altura del frasco
wall = 2.4; // [1.2:0.2:6] Espesor de pared
floor = 3; // [1.2:0.2:8] Espesor de base
neck_h = 16; // [8:0.5:36] Altura de zona roscada
thread_pitch = 4; // [2:0.2:8] Paso de rosca
thread_turns = 2.5; // [1:0.25:5] Vueltas de rosca
thread_depth_nominal = 1.75; // [0.8:0.05:4] Profundidad radial visible de rosca
thread_clearance = 0.35; // [0.1:0.05:1.2] Holgura radial de rosca
fit_slop = 0.12; // [0:0.02:0.6] Compensacion extra de material/slicer
lead_in = 1.2; // [0.4:0.1:4] Entrada guiada de rosca
lid_h = 20; // [10:0.5:40] Altura de tapa
lid_clearance = 0.6; // [0.2:0.05:1.6] Holgura
lid_knurl = 18; // [0:1:36] Estriado de agarre

outer_r = body_d / 2;
inner_r = max(8, outer_r - wall);
safe_floor = min(floor, jar_h / 2 - 1);
thread_depth = min(max(0.8, thread_depth_nominal), max(1, wall * 1.18), thread_pitch * 0.72);
thread_width = max(1.2, thread_pitch * 0.48);
thread_span = min(thread_pitch * thread_turns, max(4, neck_h - 0.8));
safe_lead_in = min(lead_in, thread_span / 3, lid_h / 3, neck_h / 2);
thread_start_z = max(safe_floor + wall * 0.5, jar_h - thread_span - safe_lead_in - wall * 0.2);
thread_run = max(thread_pitch, min(thread_span, jar_h - thread_start_z - safe_lead_in * 0.35));
male_thread_r = max(1, outer_r - thread_depth * 0.2);
lid_outer_r = outer_r + wall * 0.95;
effective_thread_clearance = thread_clearance + fit_slop;
effective_lid_clearance = lid_clearance + fit_slop * 0.65;
lid_inner_r = outer_r + effective_lid_clearance;
lid_cap = max(wall, 2);
female_thread_r = max(1, lid_inner_r - 0.1);
groove_depth = thread_depth + effective_thread_clearance;
groove_width = thread_width + effective_thread_clearance * 0.65;
assembly_gap = body_d + lid_outer_r * 1.6;
knurl_depth = max(0.8, wall * 0.55);
knurl_w = max(2.4, (2 * PI * lid_outer_r) / max(10, lid_knurl * 3.2));

module helix_strip(radius, pitch, turns, depth, width) {
    linear_extrude(height = pitch * turns, twist = 360 * turns, slices = max(32, ceil(turns * 56)))
        translate([radius, 0, 0])
            polygon(points = [
                [0, -width / 2],
                [depth * 0.42, -width / 2],
                [depth, 0],
                [depth * 0.42, width / 2],
                [0, width / 2]
            ]);
}

module jar_body() {
    union() {
        difference() {
            cylinder(r = outer_r, h = jar_h);
            translate([0, 0, safe_floor])
                cylinder(r = inner_r, h = jar_h - safe_floor + 0.2);
        }

        translate([0, 0, jar_h - safe_lead_in])
            cylinder(h = safe_lead_in, r1 = outer_r, r2 = max(inner_r + wall * 0.35, outer_r - thread_depth * 0.4));
    }

    translate([0, 0, thread_start_z])
        helix_strip(male_thread_r, thread_pitch, thread_run / thread_pitch, thread_depth, thread_width);
}

module lid_shell() {
    difference() {
        union() {
            cylinder(r = lid_outer_r, h = lid_h);
            if (lid_knurl > 0) {
                for (step = [0 : lid_knurl - 1]) {
                    rotate([0, 0, step * 360 / lid_knurl])
                        translate([lid_outer_r + knurl_depth / 2 - 0.1, 0, lid_h / 2])
                            cube([knurl_depth, knurl_w, lid_h - lid_cap * 0.35], center = true);
                }
            }
        }

        translate([0, 0, -0.1])
            cylinder(r = lid_inner_r, h = lid_h - lid_cap + 0.2);

        translate([0, 0, -0.1])
            cylinder(
                h = safe_lead_in + 0.2,
                r1 = lid_inner_r + groove_depth + safe_lead_in * 0.45,
                r2 = lid_inner_r + 0.05
            );

        translate([0, 0, max(wall * 0.4, safe_lead_in * 0.55)])
            helix_strip(female_thread_r, thread_pitch, thread_run / thread_pitch, groove_depth, groove_width);
    }
}

translate([-assembly_gap / 2, 0, 0])
    jar_body();

translate([assembly_gap / 2, 0, 0])
    lid_shell();
`;
