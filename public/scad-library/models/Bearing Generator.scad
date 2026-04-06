include <BOSL2/std.scad>;

/**
 * Bearing Generator
 *      
 * Author: Jason Koolman  
 * Version: 1.2  
 *
 * Description:
 * This OpenSCAD script generatses a variety of fully parametric  
 * ball bearings with FDM optimization and customizable options.
 *
 * License:
 * This script licensed under a Standard Digital File License.
 *
 * Changelog:
 * [v1.1]
 * - Added support for 17 more bearing types (F686ZZ-F6006ZZ).
 *
 * [v1.2]
 * - Added support for 5 more bearing type (605 & 16000-series).
 */
    
/* [🛞️️ Bearing] */

// Bearing type (standard sizes or custom).
Type = "6000"; // [custom: ⚙ Custom, R2, R3, R4, R6, R8, R10, R12, R14, R16, R18, R20, R22, R24, 605, 608, 629, 635, 6000, 6001, 6002, 6003, 6007, 6200, 6201, 6202, 6203, 6204, 6205, 6206, 6207, 6208, 6209, 6210, 6211, 6212, 6301, 6302, 6303, 6304, 6305, 6306, 6307, 6308, 6309, 6310, 6311, 6312, 6403, 6800, 6801, 6802, 6803, 6804, 6805, 6806, 6900, 6901, 6902, 6903, 6904, 6905, 6906, 6907, 6908, 16004, 16005, 16100, 16101, F686ZZ, F687ZZ, F688ZZ, F689ZZ, F6900ZZ, F6901ZZ, F6902ZZ, F6903ZZ, F6904ZZ, F6905ZZ, F6000ZZ, F6001ZZ, F6002ZZ, F6003ZZ, F6004ZZ, F6005ZZ, F6006ZZ]

// Rolling element type.
Ball = "dumbbell"; // [ball: Ball, roller: Roller, dumbbell: Dumbbell]

// Spacing between rolling elements.
Spacing = 0.05; // [0:0.01:0.5]

// Extra gap between elements and raceways.
Clearance = 0.15; // [0.05:0.01:0.4]

// Chamfer size for bearing edges.
Chamfer = 0.6;

/* [⚙️ Custom] */

// Inner diameter.
Inner_Diameter = 14;

// Outer diameter.
Outer_Diameter = 28;

// Width of the bearing.
Width = 8;

// Add a flange?
Flange = false;

// Diameter of the flange.
Flange_Diameter = 32;

// Width of the flange.
Flange_Width = 2;

/* [📷 Render] */

// Slice model in half for debugging.
Slice = false;

// Render resolution to control detail level.
Resolution = 2; // [4: Ultra, 3: High, 2: Medium, 1: Low]

// Color of the model.
Color = "#e2dede"; // color

// Determine face angle and size based on resolution
Face = (Resolution == 4) ? [1, 0.1]
    : (Resolution == 3) ? [2, 0.15]
    : (Resolution == 2) ? [2, 0.2]
    : [4, 0.4];

$fa = Face[0];
$fs = Face[1];

/* [Hidden] */

// Render
if (Slice) {
    back_half() generate();
} else {
    generate();
}

module generate() {
    color(Color)
    ball_bearing(Type == "custom" ? undef : str(Type),
        id=Inner_Diameter,
        od=Outer_Diameter,
        width=Width,
        flange=Flange,
        fd=Flange_Diameter,
        fw=Flange_Width,
        clearance=Clearance,
        ball_type=Ball,
        ball_spacing=Spacing,
        chamfer=Chamfer
    );
}

/**
 * Creates a standardized ball bearing assembly.
 *
 * @param   trade_size      Standard ball bearing size (e.g., "608", "R10"). Overrides `id`, `od`, `width`.
 * @param   id              Inner diameter (used if `trade_size` is not set).
 * @param   od              Outer diameter.
 * @param   width           Bearing width.
 * @param   flange          Enables a flanged bearing.
 * @param   fd              Flange diameter (required if `flange = true`).
 * @param   fw              Flange width.
 * @param   chamfer         Chamfer amount for smoother edges.
 * @param   rounding        Rounds inner and outer edges for printability.
 * @param   ball_spacing    Gap factor between balls (0 = touching).
 * @param   ball_type       Type of rolling element.
 * @param   anchor          Positioning anchor (default: `CTR`).
 * @param   spin            Rotation around Z-axis (degrees).
 * @param   orient          Orientation of the bearing (default: `UP`).
 */
module ball_bearing(
    trade_size,
    id, od, width,
    flange = false, fd, fw,
    chamfer, rounding,
    clearance = 0.1,
    ball_type = "ball",
    ball_spacing = 0.05,
    anchor = CTR,
    spin = 0,
    orient = UP
) {
    info = is_undef(trade_size) ? [id, od, width, flange, fd, fw] : ball_bearing_info(trade_size);
    checks =
        assert(all_defined(select(info, 0,4)), "Invalid bearing info supplied")
        assert(ball_spacing >= 0 && ball_spacing <= 0.5, "Invalid spacing supplied");
        
    if (flange) {
        assert(!is_undef(fd), "Flange requires a specified diameter");
        assert(!is_undef(fw), "Flange requires a specified width");
    }
    
    id = info[0];
    od = info[1];
    width = info[2];
    flange = info[3];
    fd = info[4];
    fw = info[5];
    mid_d = (id+od)/2;
    wall = (od-id)/2/3;
    
    ball_d = (wall*2) * (ball_type == "roller" ? 0.95 : ball_type == "dumbbell" ? 0.75 : 1);
    ball_count = floor(PI*mid_d*(1-ball_spacing) / ball_d);
    ball_elevate = (width - ball_d) / 2;
    
    // Generate rolling element shape
    ball_half_shape = [
        for (p = right_half(ball_shape(ball_type, ball_d=ball_d, width=width))[0])
            [max(0, p.x), p.y] // ensure X+ half-plane
    ];
    ball_mask_shape = ball_shape(ball_type, ball_d=ball_d, width=width, clearance=clearance);
    ball_vnf = rotate_sweep(ball_half_shape);
    
    attachable(anchor, spin, orient, d = od, l = width) {
        union() {
            // Bearing structure
            difference() {
                union() {
                    tube(id=id, wall=wall+(ball_type == "dumbbell" ? wall/4 : 0), h=width, irounding=rounding, ichamfer=chamfer);
                    tube(od=od, wall=wall+(ball_type == "dumbbell" ? wall/4 : 0), h=width, orounding1=flange ? undef : rounding, 
                         ochamfer1=flange ? undef : chamfer, orounding2=rounding, ochamfer2=chamfer);
                }
                if (ball_type == "ball") {
                    torus(r_maj = mid_d / 2, r_min = wall + clearance);
                } else {
                    rotate_sweep(right(mid_d / 2, ball_mask_shape));
                }
            }

            // Rolling elements
            for (i = [0 : ball_count - 1]) {
                zrot(i * 360 / ball_count) right(mid_d / 2) {
                    if (ball_type == "ball") {
                        sphere(d = ball_d);
                    } else {
                        vnf_polyhedron(ball_vnf);
                    }
                }
            }

            // Flange support
            if (flange) {
                down(width / 2 - fw / 2)
                    tube(id = od, od = max(od, fd), h = fw, orounding1 = rounding);
            }

            // Ball support structure
            if (ball_type == "ball") {
                down(width / 2)
                difference() {
                    support_h = ball_elevate + 0.12;
                    tube(od = mid_d + wall / 2, id = mid_d - wall / 2, l = support_h, anchor = BOTTOM);
                    zrot(180 / ball_count) right(mid_d / 2)
                        cube([wall, ball_d / 2, support_h + 0.01], anchor = BOTTOM);
                }
            }
        }
        children();
    }
}

/**
 * Generates the rolling element shape for the bearing.
 *
 * @param   type        Type of rolling element: "ball", "roller", "dumbbell".
 * @param   ball_d      Diameter of the rolling element.
 * @param   width       Width of the bearing.
 * @param   clearance   Additional spacing applied to the rolling element.
 * @return  2D shape of the rolling element.
 */
function ball_shape(type, ball_d, width, clearance = 0) =
    type == "roller" ? 
        union(
            rect([ball_d + clearance * 2, width - ball_d/2], chamfer=ball_d/4),
            rect([ball_d + clearance * 2 - (ball_d/4) * 2, width])
        ) :
    type == "dumbbell" ?
        difference(
            rect([ball_d + clearance * 2, width]),
            xflip_copy(p = right(ball_d/2 + clearance, trapezoid(h=ball_d/4, w1=ball_d/3, ang=135, spin=-90, anchor=BACK)))
        ) :
    circle(d = ball_d + clearance * 2);

/**
 * Retrieves size specifications for a standardized ball bearing.
 *
 * @param   trade_size  Standard bearing designation (e.g., "608", "R10").
 * @return  List of parameters: `[id, od, width, flange, flange_diameter, flange_width]`.
 */
function ball_bearing_info(trade_size) =
    assert(is_string(trade_size))
    let(
        IN = 25.4,
        data = [
            // trade_size, ID,     OD,      width,  flanged, fd, fw 
            [      "R2",  1/8*IN,  3/8*IN,  5/32*IN, false,   0,  0 ],
            [      "R3", 3/16*IN,  1/2*IN,  5/32*IN, false,   0,  0 ],
            [      "R4",  1/4*IN,  5/8*IN, 0.196*IN, false,   0,  0 ],
            [      "R6",  3/8*IN,  7/8*IN,  7/32*IN, false,   0,  0 ],
            [      "R8",  1/2*IN,  9/8*IN,   1/4*IN, false,   0,  0 ],
            [     "R10",  5/8*IN, 11/8*IN,  9/32*IN, false,   0,  0 ],
            [     "R12",  3/4*IN, 13/8*IN,  5/16*IN, false,   0,  0 ],
            [     "R14",  7/8*IN, 15/8*IN,   3/8*IN, false,   0,  0 ],
            [     "R16",  8/8*IN, 16/8*IN,   3/8*IN, false,   0,  0 ],
            [     "R18",  9/8*IN, 17/8*IN,   3/8*IN, false,   0,  0 ],
            [     "R20", 10/8*IN, 18/8*IN,   3/8*IN, false,   0,  0 ],
            [     "R22", 11/8*IN, 20/8*IN,  7/16*IN, false,   0,  0 ],
            [     "R24", 12/8*IN, 21/8*IN,  7/16*IN, false,   0,  0 ],

            [     "605",   5,  14,   5, false, 0, 0 ],
            [     "608",   8,  22,   7, false, 0, 0 ],
            [     "629",   9,  26,   8, false, 0, 0 ],
            [     "635",   5,  19,   6, false, 0, 0 ],
            [    "6000",  10,  26,   8, false, 0, 0 ],
            [    "6001",  12,  28,   8, false, 0, 0 ],
            [    "6002",  15,  32,   9, false, 0, 0 ],
            [    "6003",  17,  35,  10, false, 0, 0 ],
            [    "6007",  35,  62,  14, false, 0, 0 ],
            [    "6200",  10,  30,   9, false, 0, 0 ],
            [    "6201",  12,  32,  10, false, 0, 0 ],
            [    "6202",  15,  35,  11, false, 0, 0 ],
            [    "6203",  17,  40,  12, false, 0, 0 ],
            [    "6204",  20,  47,  14, false, 0, 0 ],
            [    "6205",  25,  52,  15, false, 0, 0 ],
            [    "6206",  30,  62,  16, false, 0, 0 ],
            [    "6207",  35,  72,  17, false, 0, 0 ],
            [    "6208",  40,  80,  18, false, 0, 0 ],
            [    "6209",  45,  85,  19, false, 0, 0 ],
            [    "6210",  50,  90,  20, false, 0, 0 ],
            [    "6211",  55, 100,  21, false, 0, 0 ],
            [    "6212",  60, 110,  22, false, 0, 0 ],
            [    "6301",  12,  37,  12, false, 0, 0 ],
            [    "6302",  15,  42,  13, false, 0, 0 ],
            [    "6303",  17,  47,  14, false, 0, 0 ],
            [    "6304",  20,  52,  15, false, 0, 0 ],
            [    "6305",  25,  62,  17, false, 0, 0 ],
            [    "6306",  30,  72,  19, false, 0, 0 ],
            [    "6307",  35,  80,  21, false, 0, 0 ],
            [    "6308",  40,  90,  23, false, 0, 0 ],
            [    "6309",  45, 100,  25, false, 0, 0 ],
            [    "6310",  50, 110,  27, false, 0, 0 ],
            [    "6311",  55, 120,  29, false, 0, 0 ],
            [    "6312",  60, 130,  31, false, 0, 0 ],
            [    "6403",  17,  62,  17, false, 0, 0 ],
            [    "6800",  10,  19,   5, false, 0, 0 ],
            [    "6801",  12,  21,   5, false, 0, 0 ],
            [    "6802",  15,  24,   5, false, 0, 0 ],
            [    "6803",  17,  26,   5, false, 0, 0 ],
            [    "6804",  20,  32,   7, false, 0, 0 ],
            [    "6805",  25,  37,   7, false, 0, 0 ],
            [    "6806",  30,  42,   7, false, 0, 0 ],
            [    "6900",  10,  22,   6, false, 0, 0 ],
            [    "6901",  12,  24,   6, false, 0, 0 ],
            [    "6902",  15,  28,   7, false, 0, 0 ],
            [    "6903",  17,  30,   7, false, 0, 0 ],
            [    "6904",  20,  37,   9, false, 0, 0 ],
            [    "6905",  25,  42,   9, false, 0, 0 ],
            [    "6906",  30,  47,   9, false, 0, 0 ],
            [    "6907",  35,  55,  10, false, 0, 0 ],
            [    "6908",  40,  62,  12, false, 0, 0 ],
            [   "16004",  20,  42,   8, false, 0, 0 ],
            [   "16005",  25,  47,   8, false, 0, 0 ],
            [   "16100",  10,  28,   8, false, 0, 0 ],
            [   "16101",  12,  30,   8, false, 0, 0 ],
            
            [  "F686ZZ",   6,  13,   5, true,    15,  1   ],
            [  "F687ZZ",   7,  14,   5, true,    16,  1   ],
            [  "F688ZZ",   8,  16,   5, true,    18,  1   ],
            [  "F689ZZ",   9,  17,   5, true,    19,  1   ],
            [ "F6900ZZ",  10,  22,   6, true,    25,  1.5 ],
            [ "F6901ZZ",  12,  24,   6, true,  26.5,  1.5 ],
            [ "F6902ZZ",  15,  28,   7, true,  31.5,  1.5 ],
            [ "F6903ZZ",  17,  30,   7, true,  33.5,  1.5 ],
            [ "F6904ZZ",  20,  37,   9, true,  40.5,  1.5 ],
            [ "F6905ZZ",  25,  42,   9, true,  45.5,  1.5 ],
            [ "F6000ZZ",  10,  26,   8, true,  28.5,  1.5 ],
            [ "F6001ZZ",  12,  28,   8, true,  30.5,  1.5 ],
            [ "F6002ZZ",  15,  32,   9, true,  34.5,  1.5 ],
            [ "F6003ZZ",  17,  35,  10, true,  37.5,  1.5 ],
            [ "F6004ZZ",  20,  42,  12, true,  44.5,  1.5 ],
            [ "F6005ZZ",  25,  47,  12, true,  49.5,  1.5 ],
            [ "F6006ZZ",  30,  55,  13, true,  57.5,  1.5 ],
        ],
        found = search([trade_size], data, 1)[0]
    )
    assert(found!=[], str("Unsupported ball bearing trade size: ", trade_size))
    select(data[found], 1, -1);
