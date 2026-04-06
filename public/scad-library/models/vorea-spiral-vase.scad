// Vorea Studio — Parametric Spiral Vase
// Twisted vase with sinusoidal profile
// Compatible: Vorea Studio SCAD Engine

// [Section: Shape]
base_radius = 30;    // [15:1:50] Radio de la base (mm)
top_radius = 25;     // [10:1:50] Radio superior (mm)
height = 100;        // [40:5:180] Altura total (mm)
wall = 2;            // [1:0.5:4] Grosor de pared

// [Section: Decoration]
waves = 6;           // [0:1:12] Ondulaciones en el perfil
wave_amp = 5;        // [0:1:15] Amplitud de ondas (mm)
twist = 90;          // [0:15:360] Torsion total (grados)
slices = 60;         // [20:10:100] Resolucion vertical

$fn = 48;

// Build vase layer by layer
difference() {
  // Outer shell
  union() {
    for (i = [0 : slices - 1]) {
      z = i * height / slices;
      z_next = (i + 1) * height / slices;
      t = i / slices;
      t_next = (i + 1) / slices;
      
      // Interpolate radius with wave
      r = base_radius + (top_radius - base_radius) * t + sin(t * 360 * waves) * wave_amp;
      angle = t * twist;
      
      translate([0, 0, z])
        rotate([0, 0, angle])
          cylinder(r1 = r, r2 = r, h = height / slices + 0.1);
    }
  }
  
  // Hollow interior
  translate([0, 0, wall])
    for (i = [0 : slices - 1]) {
      z = i * height / slices;
      t = i / slices;
      r_inner = base_radius + (top_radius - base_radius) * t + sin(t * 360 * waves) * wave_amp - wall;
      angle = t * twist;
      
      translate([0, 0, z])
        rotate([0, 0, angle])
          cylinder(r = max(r_inner, 5), h = height / slices + 0.2);
    }
}
