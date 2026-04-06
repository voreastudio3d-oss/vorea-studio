/** Skadis Bin – Parametric OpenSCAD model */
export const SKADIS_BIN_SCAD = `// Visualization Settings
$fn = 100;
$preview = true;

// Main Parameters (in mm)

// Bin
bin_width = 60;
bin_height = 40;
bin_depth = 20;

// Divisions

// Each element in the array represents a division. The value of it represents its relative size, so the sum of all emements in horizontal_compartments should be 1
horizontal_compartments = [0.5,0.5];
vertical_compartments = [1];

// Thickness
wall_thickness = 3; // (this value will be divided by 2)

// Corners Radius
corner_radius = 5;

// Frontal drop (percentage)
frontal_drop = 0.3;

// Type of base (rounded or curved)
rounded_base = true; // 'false' for flat

// Hook Support Parameters
include_extra_support = false;

// Skadis Parameters
hole_spacing = 40;

// Hook Parameters
hook_body_length = 30;
hook_thickness = 4.3;

hook_outer_radius = 4.7;
hook_bend_angle = 167.4;
hook_tip_length = 4.5;
inferior_hook_length = 2;
inferior_support_offset = 26.513;

// Modeling Offsets and Adjustments
model_offset = 0.1;

// Calculated Parameters
num_horizontal_compartments = len(horizontal_compartments)-1;
num_vertical_compartments = len(vertical_compartments)-1;

number_of_hooks = ceil(bin_width / (hole_spacing + hook_thickness));
adjusted_bin_width = bin_width - 2 * corner_radius;
adjusted_bin_height = bin_height - 2 * corner_radius;
adjusted_bin_depth = bin_depth - 2 * corner_radius;


// Adjust this value to avoid rendering issues
adjusted_frontal_drop = frontal_drop + 0.00001;

// Hook Module
module hook(include_support) {
    // Outer curve
    rotate([90, 0, 180])
    rotate_extrude(angle = hook_bend_angle)
    translate([hook_outer_radius, 0, 0])
    circle(hook_thickness / 2);

    // Hook body and tip
    if (include_support) {
        translate([-hook_outer_radius, 0, -hook_body_length])
        cylinder(h = hook_body_length, r = hook_thickness / 2);

        translate([-hook_outer_radius, 0, -hook_body_length])
        sphere(r = hook_thickness / 2);
    }

    // Hook tip
    rotate([0, hook_bend_angle, 0])
    translate([-hook_outer_radius, 0, 0])
    linear_extrude(height = hook_tip_length)
    circle(hook_thickness / 2);

    // Tip endpoint sphere
    x_coord = sqrt((hook_tip_length^2) + (hook_outer_radius^2)) * cos(atan(hook_tip_length / hook_outer_radius) - (180 - hook_bend_angle));
    z_coord = -sqrt((hook_tip_length^2) + (hook_outer_radius^2)) * sin(atan(hook_tip_length / hook_outer_radius) - (180 - hook_bend_angle));
    translate([x_coord, 0, z_coord])
    sphere(r = hook_thickness / 2);

    if (include_support) {
        translate([-hook_thickness, 0, -inferior_support_offset])
        rotate([0, 90, 0])
        cylinder(h = inferior_hook_length + hook_thickness / 2, r = hook_thickness / 2);

        translate([inferior_hook_length - hook_thickness / 2, 0, -inferior_support_offset])
        sphere(r = hook_thickness / 2);
    }
}

// Create Multiple Hooks
module create_hooks() {
    hook_offset = (bin_width - hole_spacing * (number_of_hooks - 1)) / 2;

    for (i = [0 : number_of_hooks - 1]) {
        translate([i * hole_spacing + hook_offset, -hook_outer_radius + hook_thickness / 2, bin_depth - hook_outer_radius - hook_thickness / 2])
        rotate([0, 0, -90])
        hook(include_extra_support);
    }
}

// Bin Modules
module rounded_corner(height, width, depth, radius) {
    if (!rounded_base){
        cylinder(h = radius, r = radius);
    }
    translate([0, 0, depth + radius])
    cylinder(h = radius, r = radius);
    translate([0, 0, radius])
    hull() {
        sphere(r = radius);
        translate([0, 0, depth])
        sphere(r = radius);
    }
}

module solid_bin(height, width, depth, radius) {
    translate([radius, radius, 0])
    hull() {
        translate([0, 0, 0])
        rounded_corner(height, width, depth, radius);

        translate([width, 0, 0])
        rounded_corner(height, width, depth, radius);

        translate([width, height, 0])
        rounded_corner(height, width, depth, radius);

        translate([0, height, 0])
        rounded_corner(height, width, depth, radius);
    }
}

module standard_bin(height, width, depth, radius, thickness) {
    difference() {
        solid_bin(height, width, depth, radius);
        translate([thickness / 2, thickness / 2, thickness / 2])
        solid_bin(height - thickness, width - thickness, depth + thickness, radius);
    }
}

module drop_bin(adjusted_height, original_height, adjusted_width, original_width, adjusted_depth, original_depth, radius, thickness, back_drop, front_drop) {

    difference() {

        create_vertical_divisions();
        translate([original_width + model_offset / 2, original_height, original_depth])
        rotate([90, 0, 0])
        rotate([0, -90, 0])
        linear_extrude(original_width + model_offset)
        polygon([
            [-model_offset, model_offset],
            [original_height - thickness / 2, model_offset],
            [original_height - thickness / 2, -original_depth * back_drop],
            [thickness / 2, -front_drop * original_depth],
            [-model_offset, -front_drop * original_depth]
        ]);
    }

    difference() {

        create_horizontal_divisions();
        translate([original_width + model_offset / 2, original_height, original_depth])
        rotate([90, 0, 0])
        rotate([0, -90, 0])
        linear_extrude(original_width + model_offset)
        polygon([
            [-model_offset, model_offset],
            [original_height - thickness / 2, model_offset],
            [original_height - thickness / 2, -original_depth * back_drop],
            [thickness / 2, -front_drop * original_depth],
            [-model_offset, -front_drop * original_depth]
        ]);
    }

    difference() {

        standard_bin(adjusted_height, adjusted_width, adjusted_depth, radius, thickness);
        translate([original_width + model_offset / 2, original_height, original_depth])
        rotate([90, 0, 0])
        rotate([0, -90, 0])
        linear_extrude(original_width + model_offset)
        polygon([
            [-model_offset, model_offset],
            [original_height - thickness / 2, model_offset],
            [original_height - thickness / 2, -original_depth * back_drop],
            [thickness / 2, -front_drop * original_depth],
            [-model_offset, -front_drop * original_depth]
        ]);
    }
}

module bin_with_hooks(){

    difference(){
        create_hooks();
        translate([wall_thickness / 2, wall_thickness / 2, wall_thickness / 2])
        solid_bin(adjusted_bin_height - wall_thickness, adjusted_bin_width - wall_thickness, adjusted_bin_depth + wall_thickness, corner_radius);
    }


    drop_bin(adjusted_bin_height, bin_height,
             adjusted_bin_width, bin_width,
             adjusted_bin_depth, bin_depth,
             corner_radius, wall_thickness, 0, adjusted_frontal_drop);
}

module create_horizontal_divisions(){

    for (i = [1 : num_horizontal_compartments]){
        intersection(){
            // Create the solid bin
            solid_bin(adjusted_bin_height, adjusted_bin_width, adjusted_bin_depth, corner_radius);

            // Create the division
            translate([sum_first(horizontal_compartments, i)*bin_width-wall_thickness/4,0,0])
            cube([wall_thickness/2,bin_height,bin_depth]);
        }
    }
}

module create_vertical_divisions(){

    for (i = [1 : num_vertical_compartments]){
        intersection(){
            // Create the solid bin
            solid_bin(adjusted_bin_height, adjusted_bin_width, adjusted_bin_depth, corner_radius);

            // Create the division
            translate([0,sum_first(vertical_compartments, i)*bin_height-wall_thickness/4,0])
            cube([bin_width,wall_thickness/2,bin_depth]);
        }
    }
}


translate([-bin_width/2,-bin_height/2,0])
bin_with_hooks();


// Helper functions
function sum_first(arr, n) =
    n == 0 ? 0 : arr[n - 1] + sum_first(arr, n - 1);
`;
