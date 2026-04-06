include <BOSL2/std.scad>;
include <BOSL2/screws.scad>;

/**
 * Screw Generator
 *      
 * Author: Jason Koolman  
 * Version: 1.5  
 *
 * Description:
 * This OpenSCAD script generates a variety of fully parametric  
 * ISO/DIN and UTS (inch-based) screws, nuts, and washers.  
 * It supports standard metric sizes (M2–M20) and UTS sizes  
 * (#4–1/2") with configurable head types, drive types, thread  
 * options, and rendering settings. Compatible with ISO 4017  
 * (DIN 933) for hex screws and ANSI/ASME USS & SAE washers.
 *
 * Features:
 * - Supports ISO/DIN metric and UTS inch-based screws  
 * - Configurable head types (Hex, Pan, Flat, Socket, etc.)  
 * - Selectable drive types (Slot, Phillips, Torx, Hex)  
 * - Optional fully threaded or unthreaded screws  
 * - Nuts available (Hex, Square) with DIN sizing & custom thickness  
 * - Supports ISO 7089 (standard), ISO 7093 (large), and UTS  
 *   (ANSI/ASME USS & SAE) washers  
 * - Adjustable resolution & 3D printing clearances  
 *
 * License:
 * This script is shared under the CC BY-NC-SA 4.0 license:  
 * https://creativecommons.org/licenses/by-nc-sa/4.0/
 *
 * Changelog:
 * [v1.1]:  
 * - Added support for UTS screws (inch-based #4–1/2")  
 * - Added ANSI/ASME USS & SAE washers for UTS compatibility  
 * - Added custom nut thickness option 
 * - Added new head type 'ribbed socket'
 *
 * [v1.2]
 * - Added Screw Split option (improves strength for 3D printing).
 * - Added "custom" thread type with user-defined pitch.
 *
 * [v1.3]
 * - Added support for partially threaded screws.
 * - Added support for M14, M18, M20, "1/2 and "3/4.
 * - Added M7 to the list of supported specs (special case).
 *
 * [v1.4]
 * - Added debug mode to view model information.
 * - Added parameters to control the bevel of the nut.
 *
 * [v1.5]
 * - Added support for M2.5, 5/16", 7/16" and 9/16".
 * - Added screw head 'button' type.
 * - Ensure models displayed side-by-side can't overlap.
 */
 
/* [⚙️ General] */

// Select what to display.
Display = "all"; // [all: All parts, screw: Screw, nut: Nut, washer: Washer]

// ISO metric or UTS screw specification.
Spec = "M5"; // [M2: M2, M2.5:M2.5, M3: M3, M4: M4, M5: M5, M6: M6, M7: M7 - Special Case, M8: M8, M10: M10, M12: M12, M14: M14, M16: M16, M18, M20, #4: #4, #6: #6, #8: #8, #10: #10, #12: #12, 1/4: 1/4, 5/16: 5/16, 3/8: 3/8, 7/16:7/16, 1/2: 1/2, 9/16: 9/16, 3/4: 3/4]

// Thread type (defines pitch and profile).
Thread = "coarse"; // [coarse: Coarse, fine: Fine, custom: Custom, none: None]

// Thread pitch for custom thread.  
Pitch = 1;

/* [🪛️ Screw] */

// Length of the screw (in mm).
Screw_Length = 16; // [2:1:200]

// Head type.
Screw_Head = "flat"; // [none: None, flat: Flat, button: Button, socket: Socket, ribbedsocket: Ribbed Socket, hex: Hex, pan: Pan, cheese: Cheese]

// Drive type (screwdriver recess).
Screw_Drive = "none"; // [none: None, hex: Hex, slot: Slot, phillips: Phillips, ph1: Phillips 1, ph2: Phillips 2, ph3: Phillips 3, ph4: Phillips 4, torx: Torx, t10: Torx T10, t15: Torx T15, t20: Torx T20, t25: Torx T25]

// Adjusts screw diameter (advanced).
Screw_Undersize = 0.0;

// Length of the thread (0 = auto)
Screw_Thread_Length = 0;

// Orient the screw with its head facing downward.
Screw_Reorient = true;

// Split the screw for better strength for 3d printing.
Screw_Split = false;

/* [🔩 Nut] */

// Shape of the nut.
Nut_Shape = "hex"; // [hex: Hex, square: Square]

// Thickness of the nut.
Nut_Thickness = "normal"; // [thin: Thin, normal: Regular, thick: Thick, din: DIN, custom: Custom]

// Custom thickness of the nut.
Nut_Custom_Thickness = 10;

// Across-flats width of the nut (0 = auto).
Nut_Width = 0;

// Additional spacing for 3D printing fit.
Nut_Clearance = 0.1; // [0:0.01:0.25]

// Bevel of the nut edges.
Nut_Bevel = "auto"; // [auto: Auto, none: None, inside: Inside, outside: Outside, both: Inside & Outside]

// Keep the nut bottom flat (disable bottom bevel).
Nut_Flush = false;

// Add a flange (hex only).
// Nut_Flange = false;

/* [⭕ Washer] */

// Size of the washer.
Washer_Size = "regular";  // [regular: Regular, large: Large]

// Chamfer size of the washer.
Washer_Chamfer = 0; // [0:0.1:1]

/* [📷 Render] */

// Render resolution to control detail level.
Resolution = 3; // [4: Ultra, 3: High, 2: Medium, 1: Low]

// Color of the model.
Color = "#e2dede"; // color

// Toggle debug info.
Debug = false;

// Determine face angle and size based on resolution
Face = (Resolution == 4) ? [1, 0.1]
    : (Resolution == 3) ? [2, 0.15]
    : (Resolution == 2) ? [2, 0.2]
    : [4, 0.4];

$fa = Face[0];
$fs = Face[1];

/* [Hidden] */
Screw_Head_Mapped = Screw_Head == "ribbedsocket" ? "socket ribbed" : Screw_Head;
Thread_Mapped = Thread == "custom" ? Pitch : Thread;
Nut_Inner_Bevel = Nut_Bevel == "auto" ? undef
    : Nut_Bevel == "none" || Nut_Bevel == "outside" ? false
    : true;
Nut_Outer_Bevel = Nut_Bevel == "auto" ? undef
    : Nut_Bevel == "none" || Nut_Bevel == "inside" ? false
    : true;
All_Visible = Display == "all";
Nut_Visible = All_Visible || Display == "nut";
Screw_Visible = All_Visible || Display == "screw";
Washer_Visible = All_Visible || Display == "washer";

Screw_Info = Screw_Visible ? screw_info(Spec,
    head = Screw_Head_Mapped,
    drive = Screw_Drive,
    thread = Thread_Mapped,
) : undef;

Nut_Info = Nut_Visible ? nut_info(Spec,
    shape = Nut_Shape,
    thickness = Nut_Thickness == "custom" ? Nut_Custom_Thickness : Nut_Thickness,
    width = Nut_Width > 0 ? Nut_Width : undef, 
    thread = Thread_Mapped,
) : undef;

Washer_Specs = struct_set([], [
    // Metric Washers (ISO 7089 / 7093)
    // [id, od, thickness, large_od, large_thickness]
    "M2",   [2.2,  5,   0.3,  9,   0.5],  
    "M2.5", [2.7,  6,   0.5,  10,  0.8],
    "M3",   [3.2,  7,   0.5,  12,  0.8],  
    "M4",   [4.3,  9,   0.8,  15,  1.2],  
    "M5",   [5.3,  10,  1.0,  20,  1.6],  
    "M6",   [6.4,  12,  1.6,  24,  2.0],  
    "M7",   [7.4,  14,  1.6,  22,  2.0],
    "M8",   [8.4,  16,  1.6,  30,  2.5],  
    "M10",  [10.5, 20,  2.0,  40,  3.0],  
    "M12",  [13.0, 24,  2.5,  50,  3.5],  
    "M14",  [15.0, 28,  2.5,  56,  4.0],  
    "M16",  [17.0, 30,  3.0,  60,  4.5],
    "M18",  [19.0, 34,  3.0,  56,  4.0],
    "M20",  [21.0, 37,  3.0,  60,  4.0],
    // UTS Washers (ANSI/ASME USS & SAE, converted from inches)
    "#4",   [0.125 * INCH,  0.312 * INCH,  0.036 * INCH],  
    "#6",   [0.149 * INCH,  0.375 * INCH,  0.036 * INCH],  
    "#8",   [0.174 * INCH,  0.437 * INCH,  0.050 * INCH],  
    "#10",  [0.198 * INCH,  0.500 * INCH,  0.050 * INCH],
    "#12",  [0.250 * INCH,  0.562 * INCH,  0.065 * INCH],
    "1/4",  [0.257 * INCH,  0.750 * INCH,  0.063 * INCH],
    "5/16", [0.320 * INCH,  0.875 * INCH,  0.078 * INCH],
    "3/8",  [0.385 * INCH,  1.000 * INCH,  0.083 * INCH],
    "7/16", [0.460 * INCH,  1.125 * INCH,  0.095 * INCH],   
    "1/2",  [0.5625 * INCH, 1.375 * INCH, 0.109 * INCH],
    "9/16", [0.625 * INCH,  1.500 * INCH,  0.125 * INCH],
    "3/4",  [0.8125 * INCH, 2 * INCH, 0.148 * INCH]
]);

Nut_Flanged_Specs = struct_set([], [
    // Metric Flanged Nuts (DIN 6923 / ISO 4162)
    // [S, dc, c, m]
    // M2 is not available in specs
    "M3",   [6,     7.8,    0.8,    3.7],
    "M4",   [7,     10,     0.9,    4.5],
    "M5",   [8.0,   11.8,   1,      5.0],
    "M6",   [10.0,  14.2,   1.1,    6.0],
    "M7",   [11.0,  16.6,   1.15,   7.0], // not available in specs
    "M8",   [13.0,  17.9,   1.2,    8.0],
    "M10",  [15.0,  21.8,   1.5,    10.0],
    "M12",  [18.0,  26.0,   1.8,    12.0],
    "M14",  [21.0,  29.9,   2.1,    14.0],
    "M16",  [24.0,  34.5,   2.4,    16.0],
    "M18",  [27.0,  39.9,   2.7,    18.0],
    "M20",  [30.0,  42.8,   3,      20.0],
    
     // Inch Flanged Nuts (ASME/ANSI B18.2.2)
    // #4 is not available in specs
    "#6",   [0.312 * INCH,  0.422 * INCH,  0.02 * INCH,  0.171 * INCH],
    "#8",   [0.344 * INCH,  0.469 * INCH,  0.02 * INCH,  0.203 * INCH],
    "#10",  [0.375 * INCH,  0.500 * INCH,  0.03 * INCH,  0.219 * INCH],
    "#12",  [0.438 * INCH,  0.594 * INCH,  0.04 * INCH,  0.236 * INCH],
    "1/4",  [0.438 * INCH,  0.594 * INCH,  0.04 * INCH,  0.236 * INCH],
    "5/16", [0.500 * INCH,  0.680 * INCH,  0.04 * INCH,  0.283 * INCH],
    "3/8",  [0.625 * INCH,  0.750 * INCH,  0.04 * INCH,  0.347 * INCH],
    "7/16", [0.688 * INCH,  0.937 * INCH,  0.04 * INCH,  0.395 * INCH],
    "1/2",  [0.750 * INCH,  1.031 * INCH,  0.05 * INCH,  0.458 * INCH],
    "9/16", [0.875 * INCH,  1.188 * INCH,  0.05 * INCH,  0.506 * INCH],
    "5/8",  [0.938 * INCH,  1.281 * INCH,  0.05 * INCH,  0.569 * INCH],
    "3/4",  [1.125 * INCH,  1.500 * INCH,  0.06 * INCH,  0.675 * INCH]
]);

Is_Metric = starts_with(Spec, "M");

Washer_Spec = struct_val(Washer_Specs, Spec);
Washer_Inner_Diameter = Washer_Spec[0];
Washer_Outer_Diameter = Is_Metric ? ((Washer_Size == "large") ? Washer_Spec[3] : Washer_Spec[1]) : Washer_Spec[1];
Washer_Height  = Is_Metric ? ((Washer_Size == "large") ? Washer_Spec[4] : Washer_Spec[2]) : Washer_Spec[2];
Washer_Info = [
    ["diameter", Washer_Inner_Diameter],
    ["outer_diameter", Washer_Outer_Diameter],
    ["thickness", Washer_Height],
];

Screw_Diameter = struct_val(Screw_Info, "diameter", 0);
Screw_Head_Diameter = struct_val(Screw_Info, "head_size", Screw_Diameter);
Screw_Head_Height = struct_val(Screw_Info, "head_height", 0);
Screw_Drive_Size = struct_val(Screw_Info, "drive_size", 0);

/**
 * Generates a parametric screw.
 */
module generate_screw(
    spec = Spec, 
    head = Screw_Head_Mapped, 
    drive = Screw_Drive, 
    length = Screw_Length, 
    thread = Thread_Mapped,
    thread_length = Screw_Thread_Length,
    undersize = Screw_Undersize, 
    reorient = Screw_Reorient
) {
    module render_screw(anchor, spin, orient) {
        screw(spec,
            head = head,
            drive = drive,
            length = length,
            thread = thread,
            undersize = undersize,
            thread_len = thread_length > 0 ? min(length, thread_length) : undef,
            anchor = anchor,
            spin = spin,
            orient = orient
        );
    }
    
    if (Screw_Split) {
        zrot(90)
        top_half(s = Screw_Length * 3) {
            left(0.1)
                render_screw(orient = RIGHT, anchor = "head_top");
            right(0.1)
                render_screw(orient = LEFT, anchor = "head_top");
        }
        // Bridge parts
        cube([Screw_Head_Diameter - 0.24, 0.24, 0.24], anchor = BOTTOM+CENTER);
        
    } else {
        render_screw(
            anchor = reorient ? TOP : BOTTOM,
            orient = reorient ? DOWN : UP
        );
    }
}

/**
 * Generates a parametric nut.
 */
module generate_nut(
    spec = Spec, 
    shape = Nut_Shape,
    thickness = Nut_Thickness == "custom" ? Nut_Custom_Thickness : Nut_Thickness, 
    nutwidth = Nut_Width > 0 ? Nut_Width : undef, 
    thread = Thread_Mapped, 
    clearance = Nut_Clearance
) {
    nut(spec,
        shape = shape,
        thickness = thickness,
        nutwidth = nutwidth,
        thread = thread,
        bevel = Nut_Outer_Bevel,
        bevel1 = Nut_Flush ? false : undef,
        ibevel = Nut_Inner_Bevel,
        anchor = BOTTOM,
        $slop = clearance
    );
}

/**
 * Generates a parametric washer.
 */
module generate_washer(
    spec = Spec, 
    size = Washer_Size, 
    chamfer = Washer_Chamfer
) { 
    washer(spec, 
        size = size, 
        chamfer = chamfer
    );
}

/**
 * Generates a parametric washer (ISO or UTS).
 *
 * @param spec      ISO or UTS washer spec.
 * @param size      Washer size type ("regular" = ISO 7089, "large" = ISO 7093, UTS always "regular")
 * @param chamfer   Chamfer size factor (0-1)
 */
module washer(spec = "M6", size = "regular", chamfer = 0) {
    assert(in_list(spec, struct_keys(Washer_Specs)), "Invalid spec supplied.");
    assert(in_list(size, ["regular", "large"]), "Invalid size supplied.");
    assert(chamfer >= 0 && chamfer <= 1, "Invalid chamfer size supplied.");
    
    // Retrieve washer data
    data = struct_val(Washer_Specs, spec);

    // UTS washers do not have "large" variants
    is_metric = starts_with(spec, "M");
    id = data[0];
    od = is_metric ? ((size == "large") ? data[3] : data[1]) : data[1];
    h  = is_metric ? ((size == "large") ? data[4] : data[2]) : data[2];

    tube(
        id = id,
        od = od,
        h = h,
        chamfer = h / 2 * chamfer,
        anchor = BOTTOM
    );
}

/**
 * Renders debug info by rendering key/value pairs of a struct.
 *
 * @param title     Title for the dataset.
 * @param data      Struct with info.
 * @param keys      List of keys to display
 */
module info(title, data, keys) {
    if (is_struct(data) && is_list(keys)) {
        lines = [
            title,
            for (key = struct_keys(data))
                let (value = struct_val(data, key, undef))
                if (in_list(key, keys) && !is_undef(value))
                    str(str_replace_char(key, "_", " "), ": ", value, is_num(value) ? "mm" : "")
                
        ];
    
        fwd(max(Screw_Head_Diameter / 2, Washer_Outer_Diameter / 2) + 8)
        color("#AAAAAA")
        linear_extrude(height = 0.1)
            write(lines, size = 1.4);
    }
}

module nut_info() {
    if (Debug) info("Nut", Nut_Info, [
        "shape",
        "width",
        "diameter",
        "pitch",
        "thickness"
    ]);
}

module screw_info() {
    if (Debug) info("Screw", Screw_Info, [
        "pitch",
        "diameter",
        "head",
        "head_size",
        "head_height",
        "drive",
        "drive_size",
        "drive_depth"
    ]);
}

module washer_info() {
    if (Debug) info("Washer", Washer_Info, [
        "diameter",
        "outer_diameter",
        "thickness"
    ]);
}

/**
 * Writes multiline text with proper spacing and alignment.
 *
 * @param lines       List of text strings (one per line).
 * @param font        Font name.
 * @param size        Font size.
 * @param spacing     Letter spacing.
 * @param lineheight  Line height.
 * @param halign      Horizontal alignment for each line ("left", "center", "right").
 * @param valign      Vertical alignment for the entire block ("top", "center", "bottom").
 */
module write(lines, font = "Liberation Sans", size = 4, spacing = 1, lineheight = 1, halign = "center", valign = "top") {
    // Compute font metrics and interline spacing
    fm = fontmetrics(size = size, font = font);
    interline = fm.interline * lineheight;
    n = len(lines);

    // Calculate total bounding box dimensions
    bbox = write_bounding_box(lines, font, size, spacing, interline);
    total_height = bbox[1];

    // Determine vertical offset for block alignment
    y_offset = 
        (valign == "top") ? 0 : 
        (valign == "center") ? -total_height / 2 : 
        -total_height;

    // Render text lines with appropriate alignment
    translate([0, -y_offset]) {
        for (i = [0 : n - 1]) {
            translate([0, -(interline * i + interline / 2)])
                text(
                    text = lines[i],
                    font = i == 0 ? str(font, ":style=Bold") : font,
                    size = size,
                    spacing = spacing,
                    halign = halign,
                    valign = "center"
                );
        }
    }
}

/**
 * Calculates the total bounding box for multiline text.
 *
 * @param lines       List of text strings (one per line).
 * @param font        Font name.
 * @param size        Font size.
 * @param spacing     Letter spacing.
 * @param interline   Interline spacing (height between lines).
 * @return A 2D vector containing the total width and height of the text block.
 */
function write_bounding_box(lines, font, size, spacing, interline) =
    [
        // Calculate the widest line
        max([for (line = lines) textmetrics(text = line, font = font, size = size, spacing = spacing).size.x]),
        // Calculate total height
        interline * len(lines)
    ];
   

// Render
if (Display == "nut") {
    color(Color) generate_nut();
    nut_info();
} else if (Display == "screw") {
    color(Color) generate_screw();
    screw_info();
} else if (Display == "washer") {
    color(Color) generate_washer();
    washer_info();
} else {
    color(Color)
    xdistribute(max(Washer_Outer_Diameter, Screw_Head_Diameter * 2)) {
        generate_screw();
        generate_nut();
        generate_washer();
    }
    if (Debug) {
        xdistribute(max(20, Screw_Head_Diameter * 2)) {
            screw_info();
            nut_info();
            washer_info();
        }
    }
}

// Example: different M5 fasteners
/*
ydistribute(spacing = 15) {
    // Screws (Row 1)
    xdistribute(spacing = 20) {
        generate_screw("M5", "hex", "none", 12, "coarse");
        generate_screw("M5", "flat", "phillips", 16, "coarse");
        generate_screw("M5", "socket", "hex", 20, "fine");
        generate_screw("M5", "pan", "slot", 10, "coarse");
    }

    // Nuts (Row 2)
    xdistribute(spacing = 20) {
        generate_nut("M5", "hex", "normal");
        generate_nut("M5", "square", "thin");
        generate_nut("M5", "hex", "thick");
    }

    // Washers (Row 3)
    xdistribute(spacing = 20) {
        generate_washer("M5", "regular", 0);
        generate_washer("M5", "large", 0.2);
    }
}
*/

// Example: All head types for UTS screws
/*
xdistribute(spacing=15){
  ydistribute(spacing=15){
     generate_screw("1/4", length=8, head="none", drive="hex");
     generate_screw("1/4", length=8, head="none", drive="torx");
     generate_screw("1/4", length=8, head="none", drive="slot");
     generate_screw("1/4", length=8, head="none");
  }
  generate_screw("1/4", thread=0, length=8, head="hex");
  ydistribute(spacing=15){
     generate_screw("1/4", length=8, head="socket", drive="hex");
     generate_screw("1/4", length=8, head="socket", drive="torx");
     generate_screw("1/4", length=8, head="socket");
  }
  ydistribute(spacing=15){
     generate_screw("1/4", length=8, head="socket ribbed", drive="hex",$fn=32);
     generate_screw("1/4", length=8, head="socket ribbed", drive="torx",$fn=32);
     generate_screw("1/4", length=8, head="socket ribbed",$fn=24);
  }
  ydistribute(spacing=15){
     generate_screw("1/4", length=8, head="button", drive="hex");
     generate_screw("1/4", length=8, head="button", drive="torx");
     generate_screw("1/4", length=8, head="button");
  }
  ydistribute(spacing=15){
     generate_screw("1/4", length=8, head="round", drive="slot");
     generate_screw("1/4", length=8, head="round", drive="phillips");
     generate_screw("1/4", length=8, head="round");
  }
  ydistribute(spacing=15){
     generate_screw("1/4", length=8, head="pan", drive="slot");
     generate_screw("1/4", length=8, head="pan", drive="phillips");
     generate_screw("1/4", length=8, head="pan");
  }
  ydistribute(spacing=15){
     generate_screw("1/4", length=8, head="fillister", drive="slot");
     generate_screw("1/4", length=8, head="fillister", drive="phillips");
     generate_screw("1/4", length=8, head="fillister");
  }
  ydistribute(spacing=15){
     generate_screw("1/4", length=8, head="flat", drive="slot");
     generate_screw("1/4", length=8, head="flat", drive="phillips");
     generate_screw("1/4", length=8, head="flat", drive="hex");
     generate_screw("1/4", length=8, head="flat", drive="torx");
     generate_screw("1/4", length=8, head="flat large");
     generate_screw("1/4", length=8, head="flat small");
  }
  ydistribute(spacing=15){
     generate_screw("1/4", length=8, head="flat undercut", drive="slot");
     generate_screw("1/4", length=8, head="flat undercut", drive="phillips");
     generate_screw("1/4", tlength=8, head="flat undercut");
  }
  ydistribute(spacing=15){
     generate_screw("1/4", length=8, head="flat 100", drive="slot");
     generate_screw("1/4", length=8, head="flat 100", drive="phillips");
     generate_screw("1/4", length=8, head="flat 100");
  }
}
*/

// Example: All head types for metric screws
/*
xdistribute(spacing=15){
  ydistribute(spacing=15){
    generate_screw("M6", length=8, head="none", drive="hex");
    generate_screw("M6", length=8, head="none", drive="torx");
    generate_screw("M6", length=8, head="none", drive="slot");
    generate_screw("M6", length=8);
  }
  generate_screw("M6", length=8, anchor=TOP,  head="hex");
  ydistribute(spacing=15){
    generate_screw("M6", length=8, head="socket", drive="hex");
    generate_screw("M6", length=8, head="socket", drive="torx");
    generate_screw("M6", length=8, head="socket");
  }
  ydistribute(spacing=15){
    generate_screw("M6", length=8, head="socket ribbed", drive="hex");
    generate_screw("M6", length=8, head="socket ribbed", drive="torx");
    generate_screw("M6", length=8, head="socket ribbed");
  }
  ydistribute(spacing=15){
    generate_screw("M6", length=8, head="pan", drive="slot");
    generate_screw("M6", length=8, head="pan", drive="phillips");
    generate_screw("M6", length=8, head="pan", drive="torx");
    generate_screw("M6", length=8, head="pan");
    generate_screw("M6", length=8, head="pan flat");
  }
  ydistribute(spacing=15){
    generate_screw("M6", length=8, head="button", drive="hex");
    generate_screw("M6", length=8, head="button", drive="torx");
    generate_screw("M6", length=8, head="button");
  }
  ydistribute(spacing=15){
    generate_screw("M6", length=8, head="cheese", drive="slot");
    generate_screw("M6", length=8, head="cheese", drive="phillips");
    generate_screw("M6", length=8, head="cheese", drive="torx");
    generate_screw("M6", length=8, head="cheese");
  }
  ydistribute(spacing=15){
    generate_screw("M6", length=8, head="flat", drive="phillips");
    generate_screw("M6", length=8, head="flat", drive="slot");
    generate_screw("M6", length=8, head="flat", drive="hex");
    generate_screw("M6", length=8, head="flat", drive="torx");
    generate_screw("M6", length=8, head="flat small");
    generate_screw("M6", length=8, head="flat large");
  }
}
*/
