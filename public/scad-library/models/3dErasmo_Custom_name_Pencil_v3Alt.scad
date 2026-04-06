// CONFIG
$fn=100;

Name = "ERASMO";
Font = "Bungee"; // [Archivo Black, Bangers, Bungee, Changa One, Bebas Neue, Poppins Black, Chewy, Bagel fat one, Agbalumo, Angkor, Acme, Amaranth, Bayon, Badeen display, Arbutus, Anton sc, Adlam display, Alfa slab one, Anton, Bakbak one, Archivio black, Aoboshi one, ]
F_s = 16;

Text_height = 2;
Border_size = 3;
Base_h = 15;             
Pencil_diameter = 7.3;
Clearance = 0.6;
_r = (Pencil_diameter+Clearance)/2;
// COLOR OPTIONS
colors = ["red", "blue", "green", "yellow", "orange", "purple","pink", "gray", "black", "white"];
Base_color = "Gray";  // [Red, Green, Blue, Yellow, Orange, Purple, Pink, White, Black, Gray, Turquoise]
Text_color = "Turquoise";  // [Red, Green, Blue, Yellow, Orange, Purple, Pink, White, Black, Gray, Turquoise]

//Variables for alternating letters
/* [Settings for Alternating Letters] */
//Activate Alternated letters
activate_alternate = true; // [true,false]
spacing = 0.75; // [0.1:0.05:2]
// Height for odd letters
height_odd = 17;
// Height for even letters
height_even = 15;
/* [Individual adjustments for alternating letters] */
//Letter positions 1
pos_1 = 0; // [-8:0.1:8]
//Letter positions 2
pos_2 = 0; // [-8:0.1:8]
//Letter positions 3
pos_3 = 0; // [-8:0.1:8]
//Letter positions 4
pos_4 = 0; // [-8:0.1:8]
//Letter positions 5
pos_5 = 0; // [-8:0.1:8]
//Letter positions 6
pos_6 = 0; // [-8:0.1:8]
//Letter positions 7
pos_7 = 0; // [-8:0.1:8]
//Letter positions 8
pos_8 = 0; // [-8:0.1:8]
//Letter positions 9
pos_9 = 0; // [-8:0.1:8]
//Letter positions 10
pos_10 = 0; // [-8:0.1:8]
//Letter positions 11
pos_11 = 0; // [-8:0.1:8]
//Letter positions 12
pos_12 = 0; // [-8:0.1:8]

// MODEL
//funBasePlate();
if (activate_alternate) BasePlateALT(); else funBase();

module funBase() {
    funBasePlate();
    funText();
    }    
module funBasePlate() {
    difference() {
    color(Base_color)                         // Apply back color to base
        linear_extrude(Base_h, convexity=10){
            offset(r=Border_size) fun2DText();
        };
        translate([0, 0, Base_h/2]) rotate([0, 90, 0]) cylinder(200,r=_r, center = true, $fn=64);
    }    
}

module funText(){
    color(Text_color)                         // Apply text color
        translate([0,0,Base_h])           // Position text on top of backplate
            linear_extrude(Text_height){ 
                fun2DText();
            }
}
module fun2DText() {
    text(Name, size=F_s, font=Font, halign="center", valign="center");
}

function get_height(pos) = (pos % 2 == 0) ? height_odd : height_even;
function get_adjust(pos) = pos == 0 ? pos_1 : pos == 1 ? pos_2 : pos == 2 ? pos_3 : pos == 3 ? pos_4 : pos == 4 ? pos_5 : pos == 5 ? pos_6 : pos == 6 ? pos_7 : pos == 7 ? pos_8 : pos == 8 ? pos_9 : pos == 9 ? pos_10 : pos == 10 ? pos_11 : pos == 11 ? pos_12 : 0;
function get_TOTadjust(pos) = pos < 0 ? 0 : get_TOTadjust(pos - 1) + get_adjust(pos);
module BasePlateALT() {
    difference() {
    for (i = [0:len(Name)-1]) {
    letter = Name[i];
    letter_height = get_height(i);
    pos_x = i * (F_s * spacing) + get_TOTadjust(i);
  
    color(Base_color)
    translate([pos_x, 0, 0])
    linear_extrude(height=letter_height, convexity=10)
    text(letter, 
    font=Font, 
    size=F_s,
    valign="center"
    );
}
    translate([0, 0, Base_h/2]) rotate([0, 90, 0]) cylinder(200,r=_r, center = true, $fn=64);
    }
}