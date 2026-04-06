// ======================================================
//  PARAMETRIC 4-WAY CONNECTOR
//  Part of the Modular Connectors system by iw3d
//
//  This connector joins three horizontal rods/tubes
//  and one tilted vertical rod.
//
//  Fully customizable parameters:
//  • rod diameters
//  • arm lengths
//  • tilt angle
//  • wall thickness
//  • clearance
//
//  Designed for MakerWorld Customizer.
// ======================================================

// ======================================================
// === USER PARAMETERS (safe to edit) ===================
// ======================================================

// --> rod / pipe diameter along X axis
rod_diameter_x_mm   = 20.001;   

// --> rod / pipe diameter along Y axis
rod_diameter_y_mm   = 20.001;   

// --> rod / pipe diameter along Z axis
rod_diameter_z_mm = 20.001;

// --> clearance between rod / pipe and arm
clearance_mm      = 0.25;   

// --> largest diameter arm wall thickness
wall_thickness_mm = 3.5;    
        
// --> arm length along X axis
length_x_mm = 40.001; 

// --> arm length along Y axis
length_y_mm = 40.001; 

// --> arm length along Z axis
length_z_mm = 40.001; 

// --> angle between arms, measured from X and Z axis
angle_xz = 90; // 90° = vertical
tilt_angle = 90 - angle_xz;

// --> optional reinforcement ribs
extra_strength = true;  // add ribs

// --> rotate and flatten bottom surface for stronger and easier printing
flat_bottom    = false;  

$fn = 120;  // smoothness of curved surfaces
            // Tip:
            // For a tight press-fit reduce clearance.
            // For easier assembly increase clearance.

// ======================================================
// === DERIVED PARAMETERS (do not modify) ===============
// ======================================================

rod_diameter_mm = // largest of the 3 diameters
    (rod_diameter_x_mm > rod_diameter_y_mm)
        ? ((rod_diameter_x_mm > rod_diameter_z_mm) ? rod_diameter_x_mm : rod_diameter_z_mm)
        : ((rod_diameter_y_mm > rod_diameter_z_mm) ? rod_diameter_y_mm : rod_diameter_z_mm);

// inner radii of connector bore        
r_in  = (rod_diameter_mm + clearance_mm) / 2;
r_in_x = (rod_diameter_x_mm + clearance_mm) / 2;
r_in_y = (rod_diameter_y_mm + clearance_mm) / 2;
r_in_z = (rod_diameter_z_mm + clearance_mm) / 2;
// wall thickness
w     = wall_thickness_mm;
// outer radius of connector arm (the same for all)
r_out = r_in + w;

// arms lengths
length_mm = min(length_x_mm, length_y_mm, length_z_mm);
h_x = length_x_mm;
h_y = length_y_mm;
h_z = length_z_mm;
h = length_mm;

// rib geometry
rib_length    = h/3.5;
rib_thickness = h/64.;


// ======================================================
// === GENERIC TUBE ALONG AXIS (+ direction) ============
// Creates a hollow tube along X, Y or Z axis
// ======================================================
module tube_along(axis=[1,0,0], r=10, h=10) {

    rot =
        (axis == [1,0,0]) ? [ 90, 0, 0] :
        (axis == [0,1,0]) ? [  0,90, 0] :
                           [  0, 0, 0];   // default = Z

    rotate(rot)
    difference() {
        cylinder(h=h, r=r_out, center=false);
        translate([0,0,r_out])
            cylinder(h=h, r=r, center=false);
    }
}


// ======================================================
// === GENERIC TUBE ALONG AXIS (− direction) ============
// Same tube but extruded in negative direction
// ======================================================
module tube_along_neg(axis=[0,1,0], r=10, h=10) {

    rot =
        (axis == [1,0,0]) ? [ 90, 0, 0] :
        (axis == [0,1,0]) ? [  0,90, 0] :
                           [  0, 0, 0];

    rotate(rot)
    translate([0,0,-h])
    difference() {
        cylinder(h=h, r=r_out, center=false);
        translate([0,0,-r_out])
            cylinder(h=h, r=r, center=false);
    }
}



// ======================================================
// === MAIN CONNECTOR GEOMETRY ==========================
// Combines four tubes and reinforcement ribs
// ======================================================
module connector4_y() {

    difference() {

        union() {

            // tubes
            tube_along([1,0,0], r_in_y, h_y);      // -Y
            tube_along([0,1,0], r_in_x, h_x);      // +X
            tube_along_neg([1,0,0], r_in_y, h_y);  // +Y   
            rotate([0,tilt_angle,0])
                tube_along([0,0,1], r_in_z, h_z);      // +Z

            // center rounding
            sphere(r=r_out);

            // ==========================
            // ==== RIBS ===
            // ==========================
            if(extra_strength){

                // rib between +X and +Z
                if (tilt_angle <= 40)
                    hull(){
                rotate([0,tilt_angle,0])
                        translate([r_in, 0, r_in+w/2])
                            cylinder(h=rib_length+w/2, r=w/2);
                        translate([rib_length+r_out-w/2, 0, r_in+w/2])
                            cylinder(h=rib_thickness, r=w/2);
                    }

                // rib between +Y and +Z
                  
                rotate([0,tilt_angle,0])
                    hull(){
                        translate([0, r_in+w/2, r_in+w/2])
                            cylinder(h=rib_length, r=w/2);
                        translate([0, rib_length+r_out-w/2, r_in+w/2])
                            cylinder(h=rib_thickness, r=w/2);
                    }

                // rib between -Y and +Z
                  
                rotate([0,tilt_angle,0])
                    hull(){
                        translate([0, -r_in-w/2, r_in+w/2])
                            cylinder(h=rib_length, r=w/2);
                        translate([0, -rib_length-r_out+w/2, r_in+w/2])
                            cylinder(h=rib_thickness, r=w/2);
                    }

                // diagonal rib on +Y side
                hull(){
                    translate([r_in+w/2, r_in+w/2, 0])
                        rotate([0,90,0])
                            cylinder(h=rib_length, r=w/2);
                    translate([r_in+w/2, rib_length+r_out-w/2, 0])
                        rotate([0,90,0])
                            cylinder(h=rib_thickness, r=w/2);
                }

                // diagonal rib on -Y side
                hull(){
                    translate([r_in+w/2, -r_in-w/2, 0])
                        rotate([0,90,0])
                            cylinder(h=rib_length, r=w/2);
                    translate([r_in+w/2, -rib_length-r_out+w/2, 0])
                        rotate([0,90,0])
                            cylinder(h=rib_thickness, r=w/2);
                }
            }
        }

       // bore once more into +X to get rid of rotated XZ rib
        rotate([0,90,0])
        translate([0,0,r_out])
            cylinder(h=h_x, r=r_in_x, center=false);
            
            
       // bore once more into +Z to get rid of X tube within bore
       rotate([0,tilt_angle,0])
        translate([0,0,r_out])
            cylinder(h=h_z, r=r_in_z, center=false);
    }
}


// ======================================================
// === FINAL RENDER =====================================
// Applies optional flat bottom cut for easier printing
// ======================================================
module render_connector() {

    if(flat_bottom) {
        difference() {
            translate([0,0,r_out-wall_thickness_mm/3])
                rotate([0,-(tilt_angle/2 + 45),0])
                    connector4_y();

            translate([0,0,-r_out/2])
                cube([h*2,h*2,r_out], center=true);
        }
    } else {
        connector4_y();
    }
}

render_connector();
