//
// Pinhole Message Generator — for "Top Secret: Zoetropic Cipher"
// ------------------------------------------------------------
// Author: Mike Brunswick / Prime Tower Designs
// Version: 1.0.5  •  Date: Nov 15, 2025
// ------------------------------------------------------------

// ------------------------------------------------------------
// CHANGELOG
// ------------------------------------------------------------
// v1.0   • Initial release.
// v1.0.1 • Fixed border behavior when border_dots_total = 0
//          (no stray dot rendered).
//        • Added small anchoring cubes along the central axis
//          to aid alignment when importing as a negative part
//          in slicer software.
// v1.0.2 • Added padding to the 'I' character to reduce blur.
// v1.0.3 • Updated param section names to match workflow steps.
// v1.0.4 • Changed the axis anchors from cubes to cones so that
//          orientation is clear after importing into slicer.
//          Only display them when generating pinhole tunnels.
// v1.0.5 • Changed default text & kerning for increased clarity.
//        • Added an informational message about blurring if
//          kerning is a low value.

// PURPOSE
//   Generate custom pinhole tunnels that reveal a hidden message
//   when spun — the signature effect used in my MakerWorld model:
//      👉 https://makerworld.com/models/1849119
//
//   This script creates the tunnel geometry used in
//   “Top Secret: Zoetropic Cipher.” It arranges your text into
//   a sequence of animation frames, each rotated evenly around
//   the central axis. Every frame forms a distinct pattern of
//   pinhole alignments, and together they produce the illusion
//   of readable motion when the top spins.
//
//   Each dot is extruded into a through-tunnel, and the combined
//   set of all rotated frames forms the full **negative part**
//   used within the spinning-top assembly.
//
//   The animation is essential to the illusion — leave
//   *Render All Frames* enabled when exporting for print.
//
// ------------------------------------------------------------
// MAKERWORLD CUSTOMIZATION WORKFLOW
// ------------------------------------------------------------
// 1) **Customize** → Open the **Message** tab.
//      • Enter up to 3 lines of text (blank lines are fine).
//      • Keep the message inside the visible border box.
// 2) **Layout** tab:
//      • Adjust *Kerning* and *Line Spacing* to fit neatly.
//        (use as much space as looks good — this reduces blur)
// 3) (Optional) **Animation** tab:
//      • To preview one frame at a time, disable *Render All Frames*
//        and change *Frame Index*.
// 4) **Output** tab (final export — animation required):
//      • Enable *Pinhole Tunnels* to stand the scene up and
//        extrude each dot into a through-tunnel.
// 5) Export the tunnels as STL and import them into the
//    “Top Secret: Zoetropic Cipher” model as a **negative part**.
//    (then adjust the position of this negative part)
//
// Notes:
// • All dimensions are in millimeters.
// • Advanced controls (dot size, grid pitch, etc.) are grouped in [Hidden].
// • Items in [Hidden] are internal and not shown in MakerWorld’s UI.
//
// ------------------------------------------------------------
// PARAMETERS — GROUPED FOR MAKERWORLD CUSTOMIZER
// ------------------------------------------------------------
// Uses standard OpenSCAD Customizer syntax:
//   [Tab Name] creates a tab.
//   [label:range:step] comments define sliders/text fields.
//
// Docs: https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Customizer
// ------------------------------------------------------------

/* [Step 1) Message] */
// Step-by-step instructions to use this tool are in the model descripton along with a short tutorial video.
line1 = "YOUR";
line2 = "CUSTOM";
line3 = "TEXT";
lines = [ for (s = [line1, line2, line3]) to_uppercase(s) ];  // internal array (auto-uppercase)

/* [Step 2) Layout] */
// Adjust spacing between letters and lines
kerning      = 4;   // [0:1:12] Extra columns between characters
line_spacing = 3.5;   // [0:1:12] Extra rows between lines
border_dots_total = 10;   // [0:1:400] Total dots around perimeter (animated border)

/* [Step 3) Animation (optional)] */
// Controls for viewing animation frames
render_all_frames = true; // Show all frames together (recommended)
frame_index       = 1;    // [1:1:64] Frame to show when not overlaying

/* [Step 4) Output] */
// Render 3D pinhole tunnels
pinhole_tunnels           = false; // Stand scene up and extrude dots into tunnels

/* [Hidden] */
// Internal parameters (not shown in UI)
anim_frames       = 16;   // Total logical frames in animation loop
slices_per_frame  = 2;    // Fraction of letter dots shown per frame
dot_d             = 0.7;  // Dot (tunnel) diameter in mm
cell              = 0.4;  // Grid cell size (spacing between dots, mm)
border_width      = 33;   // Bounding box width in mm
border_height     = 17;   // Bounding box height in mm
border_inset_mm   = 0.35; // Border inset so outer dot edges stay within bounds
tunnel_len        = 30;   // Tunnel extrusion length (mm)
center_offset     = 2;    // Offset to center tunnel placement in 3D mode
preview_thickness_mm = 0.01; // Tiny Z thickness so 2D preview is valid 3D on MakerWorld
flip_pinholes_upside_down = true;  // 180° Y flip of final output
anchor_distance = 50;     // place dummy objects on axis to help center everything in the slicer
$fn               = 16;   // Circle/cylinder smoothness (higher = smoother)

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

// Converts lowercase a–z to uppercase A–Z (ASCII 97–122 → 65–90)
function _to_upper_char(c) =
    (ord(c) >= 97 && ord(c) <= 122) ? chr(ord(c) - 32) : c;

// Converts entire string to uppercase (stable OpenSCAD compatible)
function to_uppercase(str) =
    len(str) == 0 ? "" :
    let(chars = [for (i = [0 : len(str)-1]) _to_upper_char(str[i])])
    _concat_chars(chars);

function _concat_chars(a, i=0) =
    (i >= len(a)) ? "" : str(a[i], _concat_chars(a, i+1));

function _fc() = is_undef(font_chars) ? "" : font_chars;
function _fd_len() = is_undef(font_data) ? 0 : len(font_data);
function _fd(i) = (is_undef(font_data) || i < 0 || i >= _fd_len()) ? [] : font_data[i];

function _find_idx(c) =
    let(pos = search(c, _fc()))
    (len(pos) > 0 ? pos[0] : -1);

function glyph(c) = let(idx = _find_idx(c)) (idx < 0) ? [] : _fd(idx);
function glyph_w(g) = (g == []) ? 0 : max([for (row = g) len(row)]);
function glyph_h(g) = (g == []) ? 0 : len(g);

function glyph_advance(c) =
    let(g = glyph(c))
    ((glyph_w(g) > 0 ? glyph_w(g) : 5) + kerning) * cell;

function _psum(v, i) = (i < 0) ? 0 : v[i] + _psum(v, i - 1);

function line_width_mm(str) =
    (_strlen(str) == 0) ? 0 :
    let(
        adv = [for (i = safe_range(0, _strlen(str)-1)) glyph_advance(str[i])],
        total_adv = _psum(adv, len(adv)-1),
        base_w = max(0, total_adv - kerning*cell)
    ) base_w + dot_d;

function _strlen(s) = is_undef(s) ? 0 : len(s);

function safe_range(a, b) = (a <= b) ? [a:b] : [];

function _rightmost_one(row) =
    let(ix = [for (i = safe_range(0,len(row)-1)) if (row[i]==1) i])
    (len(ix)>0 ? max(ix) : -1);

function _glyph_minmax_col(g) =  // returns [minc, maxc] over all rows with 1s
    let(cols = [for (r = safe_range(0,len(g)-1))
                  let(rmax = _rightmost_one(g[r]))
                  [ // minc for this row
                    (rmax>=0) ? ( // find first 1
                      min([for (i=safe_range(0,len(g[r])-1)) if (g[r][i]==1) i])
                    ) :  1e9,
                    rmax
                  ]])
    [ min([for (p=cols) p[0]]), max([for (p=cols) p[1]]) ];

function _line_ink_bounds_mm(str) =
    (_strlen(str) == 0) ? [1e9, -1e9] :  // sentinel “no-ink” bounds
    let(
        advances = [for (i = safe_range(0, _strlen(str)-1)) glyph_advance(str[i])],
        offs     = [for (i = safe_range(0, _strlen(str)-1)) _psum(advances, i-1)],
        bounds   = [ for (i = safe_range(0, _strlen(str)-1))
                       let(g = glyph(str[i]),
                           mm = (g==[]) ? [1e9,-1e9] : _glyph_minmax_col(g))
                       [ (mm[0]==1e9) ? 1e9 : (offs[i] + mm[0]*cell),
                         (mm[1]<0)    ? -1e9: (offs[i] + mm[1]*cell) ] ]
    ) [ min([for (b=bounds) b[0]]), max([for (b=bounds) b[1]]) ];


// ------------------------------------------------------------
// Low-clump letter-dot assignment (frame-based visibility)
// ------------------------------------------------------------

function glyph_positions(g) =
    [ for (r = safe_range(0, glyph_h(g)-1))
        for (c = safe_range(0, glyph_w(g)-1))
          if (g[r][c] == 1) [r,c]
    ];

function _bucket_for_dot(r, c, glyph_idx, m) =
    let(h = r*73856093 + c*19349663 + glyph_idx*83492791 + 97)
    ((h % m) + m) % m;

function _phase_for_char_idx(idx, m) = (11*idx + 7) % m;
function _gap_for_slices(m, slices) = max(1, floor(m / max(1, min(m, slices))));

function letter_dot_visible(r, c, glyph_idx, fz, m) =
    (m <= 1) ? true :
    let(
        slices = max(1, min(m, slices_per_frame)),
        gap    = _gap_for_slices(m, slices),
        start  = (fz + _phase_for_char_idx(glyph_idx, m)) % m,
        b      = _bucket_for_dot(r, c, glyph_idx, m),
        hits   = [ for (k = [0:slices-1]) if (b == ((start + k*gap) % m)) 0 ]
    )
    (len(hits) > 0);

// ------------------------------------------------------------
// Dot primitive (2D dot or 3D tunnel)
// ------------------------------------------------------------

module _dot_at(x, y) {
    if (pinhole_tunnels)
        translate([x, y, 0]) cylinder(d = dot_d, h = tunnel_len, center = true);
    else
        translate([x, y]) circle(d = dot_d);
}

// ------------------------------------------------------------
// Rendering
// ------------------------------------------------------------

module draw_glyph_anim(ch, x0=0, y0=0, fz=0) {
    g   = glyph(ch);
    idx = _find_idx(ch);
    ps  = glyph_positions(g);
    for (jj = [0:len(ps)-1]) {
        rc = ps[jj];
        r = rc[0]; ccol = rc[1];
        if (letter_dot_visible(r, ccol, idx, fz, anim_frames))
            _dot_at(x0 + ccol*cell, y0 - r*cell);
    }
}

module draw_line_anim(str, y0=0, fz=0) {
    advances = [for (i = safe_range(0, _strlen(str)-1)) glyph_advance(str[i])];
    offs     = [for (i = safe_range(0, _strlen(str)-1)) _psum(advances, i - 1)];
    for (i = safe_range(0, _strlen(str)-1)) {
        ch = str[i];
        if (glyph_w(glyph(ch)) > 0)
            translate([offs[i], y0]) draw_glyph_anim(ch, 0, 0, fz);
    }
}

// Center each line horizontally; vertically: middle line at mid-height,
// first line above, last line below, evenly spaced by `line_height`.
module draw_text_centered_anim(lines_vec, fz=0) {
    line_height = (9 + line_spacing) * cell;
    midline     = -border_height/2;
    n           = len(lines_vec);
    for (li = safe_range(0, n-1)) {
        str_i   = lines_vec[li];
        centerY = midline + (((n-1)/2) - li) * line_height;
        yline   = centerY + 4*cell;

        if (_strlen(str_i) > 0) {
            ib      = _line_ink_bounds_mm(str_i);   // [minx,maxx] of dot centers
            ink_mid = (ib[0] + ib[1]) / 2;
            xline   = (border_width / 2) - ink_mid;
            translate([xline, yline]) draw_line_anim(str_i, 0, fz);
        }
        // else: blank line—reserve vertical space but draw nothing
    }
}


// ------------------------------------------------------------
// Animated dot border (moves along the perimeter)
// ------------------------------------------------------------

function _perim_pt(d, xL, xR, yT, yB, Lx, Ly) =
    d < Lx                 ? [xL + d,             yT] :
    d < Lx + Ly            ? [xR,                 yT - (d - Lx)] :
    d < 2*Lx + Ly          ? [xR - (d - (Lx+Ly)), yB] :
                              [xL,                 yB + (d - (2*Lx + Ly))];

module _draw_dot_border_frame(fz) {
    if (border_dots_total > 0) {
        xL = border_inset_mm;
        xR = border_width  - border_inset_mm;
        yT = -border_inset_mm;
        yB = -border_height + border_inset_mm;
        Lx = xR - xL;
        Ly = (yT - yB);
        per = 2*(Lx + Ly);
        spacing = per / border_dots_total;
        shift   = spacing * (fz / anim_frames);
        for (k = [0:border_dots_total-1]) {
            d0 = k * spacing;
            d  = (d0 + shift) % per;
            pt = _perim_pt(d, xL, xR, yT, yB, Lx, Ly);
            _dot_at(pt[0], pt[1]);
        }
    }
}

// ------------------------------------------------------------
// Frame wrappers
// ------------------------------------------------------------

module _render_frame(fz) {
    draw_text_centered_anim(lines, fz);
    _draw_dot_border_frame(fz);
}

module _render_positioned_frame(fz) {
    if (pinhole_tunnels) {
        translate([0, -tunnel_len/2-center_offset, 0])
            rotate([90,0,0])
                translate([-border_width/2, +border_height/2, 0])
                    _render_frame(fz);
    } else {
        // Make preview a valid 3D object for MakerWorld
        linear_extrude(height = preview_thickness_mm)
            translate([-border_width/2, +border_height/2, 0])
                _render_frame(fz);
    }
}

// Optional final 180° Y flip
module _maybe_flip() {
    if (flip_pinholes_upside_down && pinhole_tunnels)
        rotate([0,180,0]) children();
    else
        children();
}

// ------------------------------------------------------------
// Final rendering logic
// ------------------------------------------------------------

assert(anim_frames >= 1, "anim_frames must be >= 1");
assert(frame_index >= 1, "frame_index is 1-based and must be >= 1");
assert(slices_per_frame >= 1 && slices_per_frame <= anim_frames,
       "slices_per_frame must be in [1..anim_frames]");

if (kerning < 3 && !pinhole_tunnels)
{
    color("red")
    translate([0, -border_height/2 - 3, 0])
    linear_extrude(height=preview_thickness_mm)
    text(text="FYI: Low kerning values produce blurrier results.", size=2, halign = "center");
}
       
_maybe_flip() {
    if (render_all_frames && pinhole_tunnels) {
        // Spin each frame evenly around Z (360° over anim_frames)
        for (fz = [0:anim_frames-1]) {
            rotate([0,0,360 * fz / anim_frames])
                _render_positioned_frame(fz);
        }
        // add anchors for easy alignment in slicer    
        color("red")
        {
            translate([anchor_distance, 0, 0])
            cylinder(h=1, r1=0.5, r2=0.05, center=true);
            translate([-anchor_distance, 0, 0])
            cylinder(h=1, r1=0.5, r2=0.05, center=true);
            translate([0, anchor_distance, 0])
            cylinder(h=1, r1=0.5, r2=0.05, center=true);
            translate([0, -anchor_distance, 0])
            cylinder(h=1, r1=0.5, r2=0.05, center=true);
            translate([0, 0, anchor_distance])
            cylinder(h=1, r1=0.5, r2=0.05, center=true);
            translate([0, 0, -anchor_distance])
            cylinder(h=1, r1=0.5, r2=0.05, center=true);
        }
    } else if (render_all_frames) {
        for (fz = [0:anim_frames-1])
            _render_positioned_frame(fz);
    } else {
        fz_use = ((frame_index - 1) % anim_frames + anim_frames) % anim_frames;
        _render_positioned_frame(fz_use);
    }
}

// ------------------------------------------------------------
// Font mapping
//   • `font_chars` defines the character order.
//   • `font_data` provides a 0/1 grid for each character in that order.
//   • Rows render top-to-bottom; columns left-to-right.
// ------------------------------------------------------------

font_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,-+=?()[]!.:;\"'<>/\\@#$&* ";


// Each glyph is a list of rows; each row is a list of 0/1.
// Rows render top-to-bottom; columns left-to-right.
font_data = [
  // A
  [
    [0,0,0,1,1,0,0,0],
    [0,0,1,0,0,1,0,0],
    [0,1,0,0,0,0,1,0],
    [0,1,0,0,0,0,1,0],
    [1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1]
  ],
  // B
  [
    [1,1,1,1,1,1,0,0],
    [1,0,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0],
    [1,1,1,1,1,1,0,0],
    [1,0,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0],
    [1,1,1,1,1,1,0,0]
  ],
  // C
  [
    [0,0,1,1,1,1,0,0],
    [0,1,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0],
    [1,0,0,0,0,0,0,0],
    [1,0,0,0,0,0,0,0],
    [1,0,0,0,0,0,0,1],
    [0,1,0,0,0,0,1,0],
    [0,0,1,1,1,1,0,0]
  ],
  // D
  [
    [1,1,1,1,1,1,0,0],
    [1,0,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0],
    [1,1,1,1,1,1,0,0]
  ],
  // E
  [
    [1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,1,1,1,1,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,1,1,1,1,1,1]
  ],
  // F
  [
    [1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,1,1,1,1,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0]
  ],
  // G
  [
    [0,0,1,1,1,1,0,0],
    [0,1,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0],
    [1,0,0,0,1,1,1,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [0,1,0,0,0,0,1,0],
    [0,0,1,1,1,1,0,0]
  ],
  // H
  [
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1]
  ],
  // I
  [
    [0,1,0],
    [0,1,0],
    [0,1,0],
    [0,1,0],
    [0,1,0],
    [0,1,0],
    [0,1,0],
    [0,1,0],
    [0,1,0]
  ],
  // J
  [
    [0,0,0,0,0,0,1],
    [0,0,0,0,0,0,1],
    [0,0,0,0,0,0,1],
    [0,0,0,0,0,0,1],
    [0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [0,1,0,0,0,1,0],
    [0,0,1,1,1,0,0]
  ],
  // K
  [
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0],
    [1,0,0,0,0,1,0,0],
    [1,0,0,0,1,0,0,0],
    [1,1,1,1,0,0,0,0],
    [1,0,0,0,1,0,0,0],
    [1,0,0,0,0,1,0,0],
    [1,0,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1]
  ],
  // L
  [
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,0,0,0,0,0,0],
    [1,1,1,1,1,1,1]
  ],
  // M
  [
    [1,0,0,0,0,0,0,0,1],
    [1,1,0,0,0,0,0,1,1],
    [1,0,1,0,0,0,1,0,1],
    [1,0,0,1,0,1,0,0,1],
    [1,0,0,0,1,0,0,0,1],
    [1,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,1]
  ],
  // N
  [
    [1,0,0,0,0,0,1],
    [1,1,0,0,0,0,1],
    [1,1,0,0,0,0,1],
    [1,0,1,0,0,0,1],
    [1,0,0,1,0,0,1],
    [1,0,0,0,1,0,1],
    [1,0,0,0,0,1,1],
    [1,0,0,0,0,1,1],
    [1,0,0,0,0,0,1]
  ],
  // O
  [
    [0,0,1,1,1,1,0,0],
    [0,1,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [0,1,0,0,0,0,1,0],
    [0,0,1,1,1,1,0,0]
  ],
  // P
  [
    [1,1,1,1,1,1,0,0],
    [1,0,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0],
    [1,1,1,1,1,1,0,0],
    [1,0,0,0,0,0,0,0],
    [1,0,0,0,0,0,0,0],
    [1,0,0,0,0,0,0,0],
    [1,0,0,0,0,0,0,0]
  ],
  // Q
  [
    [0,0,1,1,1,1,0,0],
    [0,1,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,1,0,0,1],
    [1,0,0,0,0,1,0,1],
    [0,1,0,0,0,0,1,0],
    [0,0,1,1,1,1,0,1]
  ],
  // R
  [
    [1,1,1,1,1,1,0,0],
    [1,0,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0],
    [1,1,1,1,1,1,0,0],
    [1,0,0,0,1,0,0,0],
    [1,0,0,0,0,1,0,0],
    [1,0,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1]
  ],
  // S
  [
    [0,0,1,1,1,1,0,0],
    [0,1,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,0],
    [1,0,0,0,0,0,0,0],
    [0,1,1,1,1,1,0,0],
    [0,0,0,0,0,0,1,0],
    [0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0],
    [0,1,1,1,1,1,0,0]
  ],
  // T
  [
    [1,1,1,1,1,1,1],
    [0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0]
  ],
  // U
  [
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [0,1,0,0,0,1,0],
    [0,0,1,1,1,0,0]
  ],
  // V
  [
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [0,1,0,0,0,0,1,0],
    [0,1,0,0,0,0,1,0],
    [0,0,1,0,0,1,0,0],
    [0,0,1,0,0,1,0,0],
    [0,0,1,0,0,1,0,0],
    [0,0,0,1,1,0,0,0],
    [0,0,0,1,1,0,0,0]
  ],
  // W
  [
    [1,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,1],
    [1,0,0,0,1,0,0,0,1],
    [1,0,0,1,0,1,0,0,1],
    [1,0,1,0,0,0,1,0,1],
    [1,1,0,0,0,0,0,1,1],
    [1,0,0,0,0,0,0,0,1]
  ],
  // X
  [
    [1,0,0,0,0,0,0,0,1],
    [0,1,0,0,0,0,0,1,0],
    [0,0,1,0,0,0,1,0,0],
    [0,0,0,1,0,1,0,0,0],
    [0,0,0,0,1,0,0,0,0],
    [0,0,0,1,0,1,0,0,0],
    [0,0,1,0,0,0,1,0,0],
    [0,1,0,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,0,1]
  ],
  // Y
  [
    [1,0,0,0,0,0,0,0,1],
    [0,1,0,0,0,0,0,1,0],
    [0,0,1,0,0,0,1,0,0],
    [0,0,0,1,0,1,0,0,0],
    [0,0,0,0,1,0,0,0,0],
    [0,0,0,0,1,0,0,0,0],
    [0,0,0,0,1,0,0,0,0],
    [0,0,0,0,1,0,0,0,0],
    [0,0,0,0,1,0,0,0,0]
  ],
  // Z
  [
    [1,1,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,1,0],
    [0,0,0,0,0,0,1,0,0],
    [0,0,0,0,0,1,0,0,0],
    [0,0,0,0,1,0,0,0,0],
    [0,0,0,1,0,0,0,0,0],
    [0,0,1,0,0,0,0,0,0],
    [0,1,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,1,1]
  ],
  // 0
  [
    [0,0,1,1,1,1,0,0],
    [0,1,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [0,1,0,0,0,0,1,0],
    [0,0,1,1,1,1,0,0]
  ],
  // 1
  [
    [0,0,1,0,0],
    [0,1,1,0,0],
    [1,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [1,1,1,1,1]
  ],
  // 2
  [
    [0,0,1,1,1,1,0,0],
    [0,1,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1],
    [0,0,0,0,0,0,1,0],
    [0,0,0,0,0,1,0,0],
    [0,0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0,0],
    [0,0,1,0,0,0,0,0],
    [1,1,1,1,1,1,1,1]
  ],
  // 3
  [
    [0,1,1,1,1,1,0,0],
    [1,0,0,0,0,0,1,0],
    [0,0,0,0,0,0,0,1],
    [0,0,0,0,0,0,1,0],
    [0,0,0,1,1,1,0,0],
    [0,0,0,0,0,0,1,0],
    [0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0],
    [0,1,1,1,1,1,0,0]
  ],
  // 4
  [
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1],
    [0,0,0,0,0,0,1],
    [0,0,0,0,0,0,1],
    [0,0,0,0,0,0,1],
    [0,0,0,0,0,0,1]
  ],
  // 5
  [
    [1,1,1,1,1,1,1,0],
    [1,0,0,0,0,0,0,0],
    [1,0,0,0,0,0,0,0],
    [1,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,0,0],
    [0,0,0,0,0,0,1,0],
    [0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,0],
    [0,1,1,1,1,1,0,0]
  ],
  // 6
  [
    [0,0,1,1,1,1,0,0],
    [0,1,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,0],
    [1,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,0,0],
    [1,0,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1],
    [0,1,0,0,0,0,1,0],
    [0,0,1,1,1,1,0,0]
  ],
  // 7
  [
    [1,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,1],
    [0,0,0,0,0,0,0,1],
    [0,0,0,0,0,0,1,0],
    [0,0,0,0,0,1,0,0],
    [0,0,0,0,0,1,0,0],
    [0,0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0,0],
    [0,0,1,0,0,0,0,0]
  ],
  // 8
  [
    [0,0,1,1,1,1,0,0],
    [0,1,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1],
    [0,1,0,0,0,0,1,0],
    [0,0,1,1,1,1,0,0],
    [0,1,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1],
    [0,1,0,0,0,0,1,0],
    [0,0,1,1,1,1,0,0]
  ],
  // 9
  [
    [0,0,1,1,1,1,0,0],
    [0,1,0,0,0,0,1,0],
    [1,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,1],
    [0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,1],
    [0,0,0,0,0,0,0,1],
    [0,1,0,0,0,0,1,0],
    [0,0,1,1,1,1,0,0]
  ],
  // ,
  [
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,1,0,0,0]
  ],
  // -
  [
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [1,1,1,1,1],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0]
  ],
  // +
  [
    [0,0,0,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [1,1,1,1,1],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,0,0,0]
  ],
  // =
  [
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [1,1,1,1,1],
    [0,0,0,0,0],
    [1,1,1,1,1],
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,0,0,0,0]
  ],
  // ?
  [
    [0,1,1,1,1,0,0],
    [1,0,0,0,0,1,0],
    [0,0,0,0,0,0,1],
    [0,0,0,0,0,0,1],
    [0,0,0,0,0,1,0],
    [0,0,0,1,1,0,0],
    [0,0,1,0,0,0,0],
    [0,0,0,0,0,0,0],
    [0,0,1,0,0,0,0]
  ],
  // (
  [
    [0,0,1],
    [0,1,0],
    [1,0,0],
    [1,0,0],
    [1,0,0],
    [1,0,0],
    [1,0,0],
    [0,1,0],
    [0,0,1]
  ],
  // )
  [
    [1,0,0],
    [0,1,0],
    [0,0,1],
    [0,0,1],
    [0,0,1],
    [0,0,1],
    [0,0,1],
    [0,1,0],
    [1,0,0]
  ],
  // [
  [
    [1,1,1,1],
    [1,0,0,0],
    [1,0,0,0],
    [1,0,0,0],
    [1,0,0,0],
    [1,0,0,0],
    [1,0,0,0],
    [1,0,0,0],
    [1,1,1,1]
  ],
  // ]
  [
    [1,1,1,1],
    [0,0,0,1],
    [0,0,0,1],
    [0,0,0,1],
    [0,0,0,1],
    [0,0,0,1],
    [0,0,0,1],
    [0,0,0,1],
    [1,1,1,1]
  ],
  // !
  [
    [1],
    [1],
    [1],
    [1],
    [1],
    [0],
    [0],
    [1],
    [1]
  ],
  // .
  [
    [0,0],
    [0,0],
    [0,0],
    [0,0],
    [0,0],
    [0,0],
    [0,0],
    [1,1],
    [1,1]
  ],
  // :
  [
    [0],
    [1],
    [1],
    [0],
    [0],
    [0],
    [1],
    [1],
    [0]
  ],
  // ;
  [
    [0,0],
    [0,1],
    [0,1],
    [0,0],
    [0,0],
    [0,0],
    [0,1],
    [0,1],
    [1,0]
  ],
  // "
  [
    [1,0,1],
    [1,0,1],
    [1,0,1],
    [0,0,0],
    [0,0,0],
    [0,0,0],
    [0,0,0],
    [0,0,0],
    [0,0,0]
  ],
  // '
  [
    [1],
    [1],
    [1],
    [0],
    [0],
    [0],
    [0],
    [0],
    [0]
  ],
  // <
  [
    [0,0,0,0,1],
    [0,0,0,1,0],
    [0,0,1,0,0],
    [0,1,0,0,0],
    [1,0,0,0,0],
    [0,1,0,0,0],
    [0,0,1,0,0],
    [0,0,0,1,0],
    [0,0,0,0,1]
  ],
  // >
  [
    [1,0,0,0,0],
    [0,1,0,0,0],
    [0,0,1,0,0],
    [0,0,0,1,0],
    [0,0,0,0,1],
    [0,0,0,1,0],
    [0,0,1,0,0],
    [0,1,0,0,0],
    [1,0,0,0,0]
  ],
  // /
  [
    [0,0,0,0,1],
    [0,0,0,1,0],
    [0,0,0,1,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,1,0,0,0],
    [0,1,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0]
  ],
  // \
  [
    [1,0,0,0,0],
    [1,0,0,0,0],
    [0,1,0,0,0],
    [0,1,0,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,0,1,0],
    [0,0,0,1,0],
    [0,0,0,0,1]
  ],
  // @
  [
    [0,0,1,1,1,1,1,0,0],
    [0,1,0,0,0,0,0,1,0],
    [1,0,0,1,1,1,0,0,1],
    [1,0,0,1,0,1,0,0,1],
    [1,0,0,1,0,1,0,0,1],
    [1,0,0,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0],
    [0,1,0,0,0,0,0,1,0],
    [0,0,1,1,1,1,1,0,0]
  ],
  // #
  [
    [0,0,1,0,1,0,0,0,0],
    [0,0,1,0,1,0,0,0,0],
    [1,1,1,1,1,1,1,0,0],
    [0,0,1,0,1,0,0,0,0],
    [0,0,1,0,1,0,0,0,0],
    [0,0,1,0,1,0,0,0,0],
    [1,1,1,1,1,1,1,0,0],
    [0,0,1,0,1,0,0,0,0],
    [0,0,1,0,1,0,0,0,0]
  ],
  // $
  [
    [0,0,0,0,1,0,0,0,0],
    [0,0,1,1,1,1,1,0,0],
    [0,1,0,0,1,0,0,1,0],
    [1,0,0,0,1,0,0,0,0],
    [0,1,1,1,1,1,1,0,0],
    [0,0,0,0,1,0,0,1,0],
    [1,0,0,0,1,0,0,0,1],
    [0,1,0,0,1,0,0,1,0],
    [0,0,1,1,1,1,1,0,0]
  ],
  // &
  [
    [0,0,1,1,1,1,0,0,0],
    [0,1,0,0,0,0,1,0,0],
    [1,0,0,0,0,0,0,1,0],
    [0,1,0,0,0,0,1,0,0],
    [0,0,1,1,1,1,0,0,0],
    [0,1,0,0,1,0,0,0,0],
    [1,0,0,0,0,1,0,0,1],
    [0,1,0,0,0,0,1,1,0],
    [0,0,1,1,1,1,0,1,0]
  ],
  // *
  [
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,1,0,1,0,0,0],
    [0,0,0,0,1,0,0,0,0],
    [0,1,0,1,1,1,0,1,0],
    [0,0,1,1,1,1,1,0,0],
    [0,1,0,1,1,1,0,1,0],
    [0,0,0,0,1,0,0,0,0],
    [0,0,0,1,0,1,0,0,0],
    [0,0,0,0,0,0,0,0,0]
  ],
  // space
  []
];