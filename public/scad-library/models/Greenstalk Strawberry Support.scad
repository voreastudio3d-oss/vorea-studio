/* [General Settings] */
// Resolution of curves
$fn = 100; // [20:200]

/* [Dimensions] */
// Distance from center to the outer edge
outer_radius = 204;  
// Distance from center to the inner curve
inner_radius = 120;   
// Thickness of the top mesh
platform_thickness = 3;
// The sweep of the arc in degrees
arc_angle = 30; // [5:180]

/* [Grid & Spokes] */
// Distance between the rings
ring_spacing = 6; 
// Number of radial support beams
spoke_count = 4; // [2:20]
// Width of the ribs and spokes
rib_width = 2.0;

/* [Clip & Hook] */
// Total height of the attachment clip
clip_height = 20;    
// Thickness of the clip walls
wall_thickness = 3;  
// The gap width for the rim to slot into
rim_gap = 4.5;

radial_platform();

// --- Modules ---

module radial_platform() {
    union() {
        intersection() {
            // Move the wedge down so it covers from -clip_height up to platform_thickness
            translate([0, 0, -clip_height])
                pie_wedge(outer_radius + rib_width/2, arc_angle, clip_height + platform_thickness); 
            
            grid_elements();
        }
        
        translate([0, 0, platform_thickness - clip_height])
            curved_rim_clip();
    }
}

module grid_elements() {
    union() {
        // --- FIXED RING CALCULATION ---
        // Calculate the angular "thickness" of one rib at the inner radius
        spoke_angle_offset = (rib_width/2 / inner_radius) * (180 / 3.14159);
        
        // The usable span where the spokes actually live
        usable_angle = arc_angle - (spoke_angle_offset * 2);

        // Clip the rings so they don't stick out past the spokes
        intersection() {
            pie_wedge(outer_radius + rib_width, usable_angle, platform_thickness);
            
            union() {
                for (r = [inner_radius : ring_spacing : outer_radius]) {
                    difference() {
                        cylinder(r = r + rib_width/2, h = platform_thickness);
                        translate([0, 0, -1])
                            cylinder(r = r - rib_width/2, h = platform_thickness + 2);
                    }
                }
            }
        }

        // --- SPOKES AND YOUR SPECIFIC GUSSETS ---
        spoke_length = outer_radius - inner_radius;
        
        for (i = [0 : spoke_count - 1]) {
            angle = -usable_angle/2 + (i * usable_angle / (spoke_count - 1));
            
            rotate([0, 0, angle]) {
                // 1. Horizontal Spoke
                translate([inner_radius - wall_thickness, -rib_width/2, 0])
                    cube([spoke_length + wall_thickness + rib_width, rib_width, platform_thickness]);
                
                // 2. Diagonal Gusset (PRESERVED EXACTLY)
                translate([inner_radius + rim_gap, rib_width/2, platform_thickness - clip_height])
                    rotate([90, 0, 0]) 
                        linear_extrude(height = rib_width)
                            polygon(points = [
                                [0, 0], 
                                [spoke_length/3, clip_height - platform_thickness], 
                                [0, clip_height - platform_thickness]
                            ]);
            }
        }
    }
}

module curved_rim_clip() {
    rotate([0, 0, -arc_angle/2])
    rotate_extrude(angle = arc_angle) {
        translate([inner_radius - wall_thickness, 0, 0]) {
            difference() {
                square([rim_gap + (wall_thickness * 2), clip_height]);
                translate([wall_thickness, -1])
                    square([rim_gap, clip_height - wall_thickness + 1]);
            }
        }
    }
}

module pie_wedge(r, angle, h) {
    linear_extrude(height = h) {
        polygon(points = [
            [0, 0], 
            for (i = [0 : $fn]) 
                let (a = -angle/2 + i * angle / $fn) 
                [r * cos(a), r * sin(a)], 
            [0, 0]
        ]);
    }
}