// Created by: Kopp3D   
// Link: https://makerworld.com/en/@Kopp3D 
// License: CC-Attribution-Noncommercial-Share Alike
//------------------
//------------------
// Variables for backing
Backing_height = 50;
Backing_width = 5;
Backing_length = 5; 
// Use this when you increase or decrease the angle between stand legs to match
Backing_rotation_angle = 25; 


// Variables for left leg 
Left_leg_height = 5;
Left_leg_width = 3;
Left_leg_length = 25;
//------------------
// Variables for right leg
Right_leg_height = 5;
Right_leg_width = 3;
Right_leg_length = 25;  

//------------------ 
// Variable for the angle between stand legs
Angle_between_legs = 50;

// Variables for the endcaps

Left_endcap_height = 10;
Left_endcap_length = 5;
Left_endcap_width = 3;

Right_endcap_height = 10;
Right_endcap_length = 5;
Right_endcap_width = 3;
// Use this to move endcaps in tandem to match length of the legs
Endcap_radius = 50;
// Just there to make sure everything is generated property 
Starting_stand_height = 25; 


module stand(stand_r, stand_h, red_h, red_w, red_l, blue_h, blue_w, blue_l, backing_h, backing_w, backing_l, angle_btwn, backing_a, red_sq_h, red_sq_l, red_sq_w, blue_sq_h, blue_sq_l, blue_sq_w){
    // Base of the stand (uncomment if needed)
    // translate([0, 0, -1]) cylinder(r=stand_r + 1, h=1);

    // Outer boundary of the stand (commented out)
    // difference(){
    //     cylinder(r=stand_r + 1, h=stand_h, center=true);
    //     cylinder(r=stand_r, h=stand_h, center=true);
    // }

    // Stand legs
    translate([-(red_l / 2), 0, red_h / 2]) color("red") cube([red_l, red_w, red_h], center=true);
    rotate([0, 0, angle_btwn]) translate([-(blue_l / 2), 0, blue_h / 2]) color("blue") cube([blue_l, blue_w, blue_h], center=true);
    rotate([0, 0, backing_a]) translate([-(backing_l / 2), 0, backing_h / 2]) color("green") cube([backing_l, backing_w, backing_h], center=true); // backing rotates in place

    // Squares at the outer faces of red and blue legs, starting at Y=0
    translate([-(stand_r / 2 + red_sq_l / 2), 0, red_sq_h / 2]) color("yellow") cube([red_sq_l, red_sq_w, red_sq_h], center=true);
    rotate([0, 0, angle_btwn]) translate([-(stand_r / 2 + blue_sq_l / 2), 0, blue_sq_h / 2]) color("cyan") cube([blue_sq_l, blue_sq_w, blue_sq_h], center=true);
}

// Call the stand module with variables
stand(Endcap_radius, Starting_stand_height, Left_leg_height, Left_leg_width, Left_leg_length, Right_leg_height, Right_leg_width, Right_leg_length, Backing_height, Backing_width, Backing_length, Angle_between_legs, Backing_rotation_angle, Left_endcap_height, Left_endcap_length, Left_endcap_width, Right_endcap_height, Right_endcap_length, Right_endcap_width);
