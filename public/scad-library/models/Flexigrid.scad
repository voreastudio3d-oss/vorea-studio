/*
 Flexgrid - OpenSCAD source code © 2024 David Smith (@jetpad) - Version 1.5
 
 versions:
    1.0 - Original version
    1.1 - Added vertical movement adjustment
    1.2 - Added shapes
    1.3 - Fixed problem with non-manifold edges so individual pixels can be colored
    1.4 - Added the Checker Grid shape
    1.5 - Fixed a bug with downsizing the grid to fit on the printer plate
    
        - With animal face shape
 
 todo:
    - tab_vertical_adjustment() might need to move up by approximately .5 mm
    - Make it so shapes work with even number of row/columns
    - If size is large enough, do double sided tabs in both directions. 
    - In special cases, it can handle a size of 4 mm with 1 wall but too fragile. 
*/

include <BOSL2/std.scad> 
// Here are instructions for installing BOLS2  
// if you want to run OpenSCAD locally on your computer. 
// https://github.com/BelfrySCAD/BOSL2
// 
// https://github.com/BelfrySCAD/BOSL2/wiki/TOC
// https://github.com/BelfrySCAD/BOSL2/wiki/CheatSheet

/* [Flexigrid Options] */

// Shape of the Flexigrid
shape = 0; // [0:Retangle, 1:Heart, 2:Circle, 3:Diamond, 4:Cross, 5:Checker Grid, 36:Animal Face]

// Number of columns
grid_columns = 5; // [2:25]

// Number of rows
grid_rows = 5;  // [2:25]

// Width and depth of each piece (mm)
size = 7; // [5:40] 

// Height of each piece (mm)
height = 35; // [12:250]  

// Controls vertical movement, from minimal (50%) to full stretch (100%)
movement = 60;   // [ 50:100]

// Define a function to calculate bed size based on printer type
function calculate_bed_size(printer_type) = 
    printer_type == 1 ? [255, 255] :
    printer_type == 2 ? [180, 180] :
    printer_type == 3 ? [220, 220] :
    [0, 0]; // Default value for unknown printer type

 /* [Advanced] */   
    
// To determine the maximum grid size
printer=2; // [1:X1/P1/A1, 2:A1 mini, 3:Other]

//  Clearance between shapes (tolerance)
clearance= 0.30; // [0.25:0.05:0.75]

// Make sure this matches the slicer setting. 
line_width = 0.42;   // [0.30:0.01:0.60]

// Number of walls
walls = 2; // [2:4]

// Roundness of the grid pieces
roundness = 10; // [0:20]

/* [Hidden] */
base_size = 21;

rectangle_shape = 0;
heart_shape  = 1;
circle_shape = 2;
diamond_shape= 3;
cross_shape  = 4;
checkerboard_shape = 5;
animal_face_shape = 36;

manifold_move = 0.01; // Slide to overlap object to get rid of non-manifold errors
max_roundness = 21;   // One greater than roundness limit so we don't get divide by 0 error

/*
  Calculate the bed size needed based on the shape size, rows, and clearance.
  If greater than bed size, truncate the rows and columns to fit.  
*/
// Calculate bed size based on printer type selected in Customizer
bed_width = calculate_bed_size(printer)[0];
rows    = min( floor( (bed_width-20) / (size()+clearance)), grid_rows );
columns = min( floor( (bed_width-20) / (size()+clearance)), grid_columns );

//echo(str("rows & columns=[", rows, ",", columns, "]"));

yrot(180) {
        if (shape == rectangle_shape) {
            // Center the model
            translate([-full_x_size()/2+size()/2, -full_y_size()/2+size()/2, 0])
            makeSquarePattern(height);
        } else {
            // Make a custom shape
            zrot(-90) {
               // Center the model
                translate([-full_x_size()/2+size()/2, -full_y_size()/2+size()/2, 0])
     
                    makePattern( shape_grid_size( rows, columns) );
             //   makePattern( shape_grid_size( grid_rows, grid_columns) );
            }
        }
    }

// Function to create a shape of pixels
module makePattern(grid_size) {
    
   // echo("grid_size=", grid_size );
    
    // Iterate through the grid_size x grid_size to ensure filling the grid
    for (gy = [0 : 1: grid_size - 1]) {
        for (gx = [0 : 1: grid_size - 1]) {
          // Calculate corresponding  pattern position
          
            // Check if the pixel in the pattern is 1
          if (shape_pattern( shape, gx, gy, grid_size, grid_size, base_size ) == true) {
                // Create a pixel at the grid position
                 //pixel(gx, gy, pixel_size);
                createPrism( gx, gy, grid_size, grid_size );
            }
        }
    }
   // echo("scaled_pixel_size=", scaled_pixel_size );
}

// Returns true if the grid location scaled to the size 21 pixel grid is set to 0
function shape_pattern( shape, gx, gy, rows, columns, pixel_base_size ) = let (
           
       // Calculate pixel dimensions to fill the grid size
       scaled_pixel_size = (pixel_base_size / shape_grid_size( rows, columns)), 
 
       px = floor((pixel_base_size / 2) - ((floor(shape_grid_size( rows, columns) / 2)-gx) * scaled_pixel_size)),
       py = floor((pixel_base_size / 2) - ((floor(shape_grid_size( rows, columns) / 2)-gy) * scaled_pixel_size)),
       
       // Need to scale out from the center instead of from the left edge
       // echo(str("px,py=[", px,",", py, "]"));        

        valid = (0 <= px) && (px < pixel_base_size) && (0 <= py) && (py < pixel_base_size),
        
        valid_rectangle = (0 <= gx) && (gx < rows) && (0 <= gy) && (gy < columns)
        )

/*      o=echo(str("gx,gy=[", gx, ",", gy, 
        "] px,py=[", px, ",", py, "]=", circle_pattern[ px ][ py ] , 
        " valid=", valid, 
        " pbs=", pixel_base_size,
        " gs=", grid_size, 
        ))
        */
    
    (shape == rectangle_shape) && valid_rectangle ? 
        true :
    (shape == checkerboard_shape) && valid_rectangle ? 
        (gx % 2 == 0) || (gy % 2 == 0) : 
    (shape == heart_shape) && valid ? 
        (heart_pattern[ px ][ py ] == 0) :
    (shape == circle_shape) && valid ? 
        circle_pattern[ px ][ py ] == 0 :
    (shape == diamond_shape) && valid ? 
        diamond_pattern[ px ][ py ] == 0 :
    (shape == animal_face_shape) ? 
        animal_face_pattern[ px ][ py ] == 0 :
    (shape == cross_shape) && valid ? 
        cross_pattern[ px ][ py ] == 0 :
        false;          
        
module createPrism( row, column, rows, columns ) {
    x = row * (size() + shape_offset() );
    y = column * (size() + shape_offset() );
    
    shape_rounding = rounding(size(),roundness); 
   //echo("shape_rounding=", shape_rounding );

    //  echo("tab_vertical_adjustment=", tab_vertical_adjustment() );
   
   // Hack to force MakerWorld to orient the model in the correct direction
   hack_amount = 0.1;
   center_hack = is_center(row, column, rows, columns);
   z_move_hack = (center_hack) ? hack_amount / 2 : 0;
   
    translate([x,y,-z_move_hack])            
        difference() {
                cube_height = (center_hack) ? height + hack_amount : height;
                
                cuboid( [size(), size(), cube_height], rounding=shape_rounding) {
                
                //cuboid( [size(), size(), cube_height*.5], rounding=shape_rounding) {
                // cuboid( [size(), size(), 1], rounding=shape_rounding) {
                
                    if (hasLeftNeighbor( row, column, rows, columns ) == true ) 
                        attach ( [LEFT], FRONT )
                            translate( [0, tab_vertical_adjustment(), -manifold_move ]) 
                                shape_tab( size(), height, false );
                               
                            
                    if (hasBackwardNeighbor( row, column, rows, columns ) == true ) 
                         attach ( [BACK], FRONT ) 
                            translate( [0, tab_vertical_adjustment(), -manifold_move ]) 
                                shape_tab( size(), height, true );
                    }
                 hollow_core( row, column, rows, columns, size(), height ) {
                
            }
        }
}


module makeSquarePattern(height) {

echo("rows=", rows, " columns=", columns );

    for (row=[0:rows-1])
        for (column=[0:columns-1])
            createPrism( row, column, rows, columns );
            
}

// Hollow out the core 
module hollow_core( row, column, rows, columns, size, height ) {

    hollow_size = size - 2 * shell_width(); 
    hollow_height = height - 2 * shell_width();
    
    rounding_size =  rounding(size,roundness);  
            
    cuboid( [hollow_size, hollow_size, hollow_height], rounding=rounding_size ) {  
        
        if (hasForwardNeighbor( row, column, rows, columns ) == true )
            attach(FWD,BACK) 
                translate([0,0, -manifold_move  ])
                shape_slot( hollow_height );
         
        if (hasRightNeighbor( row, column, rows, columns ) == true )   
            attach(RIGHT,BACK) 
                translate([0,0,-manifold_move])
                    shape_slot( hollow_height );
         
            // Holes to air out some hollow peices
        if (hasLeftNeighbor( row, column, rows, columns ) == true ) 
                attach ( [LEFT], FRONT )
                    translate( [0, tab_depth()+tab_vertical_adjustment(), -manifold_move ]) 
                        color("orange")
                        cuboid( [tab_width(), slot_depth(), 0.5 ]);     
                        
           // Holes to air out some hollow peices         
        if (hasBackwardNeighbor( row, column, rows, columns ) == true ) 
                 attach ( [BACK], FRONT ) 
                    translate( [0, tab_depth()+tab_vertical_adjustment(), -manifold_move ]) 
                        color("orange")
                        cuboid( [tab_width(), slot_depth(), 0.5 ]);
                                
    }
}

// Slot  -Y
function hasForwardNeighbor( row, column, rows, columns )  = shape_pattern( shape, row, column-1, rows, columns, base_size );
// Tab   +Y
function hasBackwardNeighbor( row, column, rows, columns ) = shape_pattern( shape, row, column+1, rows, columns, base_size );
// Slot   X
function hasRightNeighbor( row, column, rows, columns )    = shape_pattern( shape, row+1, column, rows, columns, base_size );
// Tab    X
function hasLeftNeighbor( row, column, rows, columns )     = shape_pattern( shape, row-1, column, rows, columns, base_size );
 

module shape_slot( height ) {

     slot_height = movement_range(height);

     slot_width  = slot_width();
     slot_depth = slot_depth();
color("red")
     cuboid( [slot_width, slot_depth, slot_height]);
}

module shape_tab( size, height, alternate=false ) {

    tab_width  = tab_width();
    tab_depth  = tab_depth();
    
    slot_width = slot_width();
   
    wing_width = shell_width();
    tab_support = tab_depth + wing_width; 
    
    bar_width = tab_nub_width(); 
    tab_wing = (bar_width - tab_width) ; 
 
    bar_height = max( (tab_support - 2 * tab_wing) / 2, height/10);
    
    backbone_height = max(tab_support/2, bar_height+tab_wing);
    
    bar_move = - (backbone_height/2) + (bar_height/2);
    bar_move_x = wing_width/2; //bar_width / 5;
    
    /*
    echo("backbone_height=", backbone_height );
    echo("tab_width=", tab_width );
    echo("slot_width=", slot_width );
    echo("tab_wing=", tab_wing ); 
    echo("tab_support=", tab_support );
    echo("bar_height=", bar_height );
    echo("wing_width=", wing_width );
    echo("bar_move=", bar_move );
    echo("bar_move_x=", bar_move_x );
    echo("bar_width=", bar_width );    
    echo("tab_nub_width=", tab_nub_width() );
 */  
    
    wedge([tab_width, tab_support*1, tab_support], orient=UP, center=true) {
          attach( BOTTOM, TOP) 
          translate([0,0,-manifold_move])
            cuboid([ tab_width, tab_support, backbone_height ])           
                {            
                attach( BACK ) { 
               
                if (alternate == true) {
                    color("blue")
                        rotate([0,90,0])
                            translate([  wing_width/2, -(backbone_height+tab_wing)/2 + tab_wing + bar_height, (tab_wing/2 + tab_width/2)-manifold_move ])
                                wedge([ wing_width, tab_wing, tab_wing ], center=true, anchor=FRONT+BOTTOM );
            
                          color("green")
                            translate([ 0, -bar_height+backbone_height/2, (tab_support/2)-manifold_move ])
                                wedge([ wing_width, tab_support, tab_support ], center=true, anchor=FRONT+BOTTOM );
               } else {
    
                    mirror( [1,0,0] )
                        rotate([0,90,0])
                        
                          translate([ wing_width/2,  -(backbone_height+tab_wing)/2 + tab_wing + bar_height , (tab_wing/2 + tab_width/2) ])
                            wedge([ wing_width, tab_wing, tab_wing ], center=true, anchor=FRONT+BOTTOM);
  

                        rotate([0,90,0])
                          translate([ wing_width/2,  -(backbone_height+tab_wing)/2 + tab_wing + bar_height, (tab_wing/2 + tab_width/2)-manifold_move ])
                            wedge([ wing_width, tab_wing, tab_wing ], center=true, anchor=FRONT+BOTTOM);     
                }
             
                };
 
                if (alternate == true ) {
                    color("red")
                        attach( BACK, TOP ) {
                            rotate([0,90,0])
                                translate([bar_move_x,  bar_move, -manifold_move]) 
                                    cuboid([ wing_width, bar_height, tab_wing+wing_width/2]);
                                    }
                 } else {
                    attach( BACK, TOP ) {
                            rotate([0,90,0])
                                translate([bar_move_x,  bar_move, (-tab_wing-wing_width/2)+manifold_move]) 
                                    cuboid([ wing_width, bar_height, tab_wing+wing_width/2]); 
                                    }
                    attach( BACK, TOP ) {
                            rotate([0,90,0])
                                translate([bar_move_x,  bar_move, -manifold_move]) 
                                    cuboid([ wing_width, bar_height, tab_wing+wing_width/2]);
                                    }
                 }   
             
            }   
        }
}

function full_x_size() = 
    (shape == rectangle_shape) ? 
        // Rectangle
        rows * (size() + clearance) : 
        // Not a rectangle
        shape_grid_size( rows, columns ) * (size() + clearance);

function full_y_size() = 
    (shape == rectangle_shape) ? 
        // Rectangle
        columns * (size() + clearance) : 
        // Not a rectangle
        shape_grid_size( rows, columns ) * (size() + clearance);

function tab_width()    = shell_width();

function tab_depth()    = clearance + shell_width() + line_width/2;
function slot_depth()   = manifold_move + shell_width(); 

function shell_width()  = line_width * walls();
function shape_offset() = clearance;

function rounding(size,roundness) = 
    (size <= 6) ? 
            size / (max_roundness - roundness + 6) :
    (size <= 7) ? 
            size / (max_roundness - roundness + 4) :
    (size <= 9) ? 
            size / (max_roundness - roundness + 4):
    (walls() == 4) && (roundness == 20) ?   // Strange 4 wall case
            size / (max_roundness - roundness + 4) :
      // Default
            size / (max_roundness - roundness + 2); 
    
// For shorter models, the tab needs to be adjust down so it doesn't bump the top of the slot
function tab_vertical_adjustment() = 
    (height <= 15) ? 
        height / 5 : 
        height / 10;

function slot_width() =  tab_width() + clearance;

// Adjustments for increasing the size when adding more walls on small sizes
function size() = 
    (size <= 7) && (walls() == 3) ? 
        8 : 
    (size <= 9) && (walls() == 4) ? 
       10 : 
        size; // default
        
  // Function to round up to the next odd number
function next_odd(n) = (n % 2 == 1) ? n : n + 1;
        
function shape_grid_size( rows, columns ) = 
        // Only let the cross shape NOT be bumped to the next odd
//        (shape == cross_shape) ? 
//            max( rows, columns ) :
        // Default
            next_odd(max( rows, columns ));
        
function walls() = 
    (size <=15) && ( walls >=3) ? 
        //let ( e=echo(str("size=", size, " walls=", walls )) )
        2 : // Don't allow a lot of walls on smallish sizes 
    (size <=20) && ( walls >=3) ? 
        //let ( e=echo(str("size=", size, " walls=", walls )) )
        3 : // Don't allow a lot of walls on smallish sizes 
     // Default
        walls;
        
 // Controls vertical movement, from minimal (50%) to full stretch (100%)
function movement_range(height) =
    (height <= 20) ? 
        height :
    // default
        height * (movement / 100);
    
        
 // Make sure the tab width increases as the shape size increases
 function tab_nub_width() = 
    (size <= 9) ?
        let ( 
            space = (size()/2 ) - (3 * line_width),
            lines = floor( space / line_width )
            //e = echo(str("space=", space, "lines=", lines ))
        ) 
        // The nub needs to be at least ## lines wide so it won't come out of the slot
        line_width * max( lines, 4 ) :
        // default
        max( slot_width() + shell_width(), size() / 5 ); 
    
 function is_center(row, column, rows, columns) = 
    (rows % 2 == 1 && columns % 2 == 1 && row == (rows - 1) / 2 && column == (columns - 1) / 2) || 
    (rows % 2 == 0 && columns % 2 == 0 && row >= (rows / 2 - 1) && row <= (rows / 2) && column >= (columns / 2 - 1) && column <= (columns / 2)) ||
    (rows % 2 == 0 && columns % 2 == 1 && row >= (rows / 2 - 1) && row <= (rows / 2) && column == (columns - 1) / 2) ||
    (rows % 2 == 1 && columns % 2 == 0 && row == (rows - 1) / 2 && column >= (columns / 2 - 1) && column <= (columns / 2));

//echo("tab_nub_width()=", tab_nub_width());

cross_pattern = [
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1]
];


diamond_pattern = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
    [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
    [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
    [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

    // 21x21 circle pattern (0 for circle, 1 for transparent)
circle_pattern = [
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0,  0,  0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
    [1, 1, 1, 0, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
    [1, 1, 0, 0, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0],//
    
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
    [1, 1, 1, 0, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 0, 0, 0, 0, 0,  0,  0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 0, 0, 0,  0,  0, 0, 0, 1, 1, 1, 1, 1, 1, 1]
];
    
  // 21x21 heart pattern
    heart_pattern = [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1],
        [1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1],
        [1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
        [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
        [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
        [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ];
    

    // 21 x 21
animal_face_pattern = [
    [1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1],
    [1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1],
    [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
   

];
    