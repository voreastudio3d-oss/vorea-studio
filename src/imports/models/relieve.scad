// =====================================================================
// RELIEVE 3D DESDE IMAGEN — Vorea Studio
// =====================================================================
// 1. Subí una imagen usando el botón 📷 del viewport
// 2. Compilá el modelo — el relieve se genera automáticamente
// Blanco = alto, Negro = bajo (o invertí con el parámetro)

// [min:1, max:30] Altura máxima del relieve (mm)
max_h = 10;

// [min:20, max:300] Ancho de la placa (mm)
ancho = 100;

// [min:20, max:300] Largo de la placa (mm)
largo = 100;

// [min:20, max:1000] Resolución de la grilla (más = más detalle)
resolucion = 200;

// [true, false] Invertir brillo (negro = alto)
invertir = false;

// [true, false] Generar sólido cerrado (base + paredes)
solido = true;

// [min:1, max:5] Grosor de la base (mm)
base = 2;

$fn = 24;

// ─── Placa base ──────────────────────────────────────────────────────
translate([-ancho/2, -largo/2, -base])
    cube([ancho, largo, base]);

// ─── Superficie de relieve ──────────────────────────────────────────
surface("surface_image", center=true, invert=invertir, maxheight=max_h, size=[ancho, largo], samples=resolucion, solid=solido);
