// =====================================================================
// LLAVERO PARAMETRICO CON TEXTO 3D — Vorea Studio
// =====================================================================

// [min:40, max:100] Largo del llavero (mm)
largo = 60;

// [min:20, max:50] Ancho del llavero (mm)
ancho = 28;

// [min:2, max:6] Grosor de la base (mm)
grosor = 3;

// [min:3, max:8] Radio de esquinas redondeadas (mm)
r_esq = 5;

// [min:2, max:7] Radio del agujero del arillo (mm)
r_agujero = 4;

// [min:3, max:12] Tamaño del texto (mm)
tam_texto = 7;

// Primera línea de texto
linea1 = "VOREA";

// Segunda línea de texto
linea2 = "STUDIO";

$fn = 36;

// ─── Cuerpo con agujero ───────────────────────────────────────────────
difference() {
    hull() {
        translate([r_esq,           r_esq,           0]) cylinder(r=r_esq, h=grosor);
        translate([largo - r_esq,   r_esq,           0]) cylinder(r=r_esq, h=grosor);
        translate([r_esq,           ancho - r_esq,   0]) cylinder(r=r_esq, h=grosor);
        translate([largo - r_esq,   ancho - r_esq,   0]) cylinder(r=r_esq, h=grosor);
    }
    // Agujero del arillo
    translate([r_esq + r_agujero + 1, ancho / 2, -0.5])
        cylinder(r=r_agujero, h=grosor + 1);
}

// ─── Texto en relieve ────────────────────────────────────────────────
// Centro X del llavero (todo el largo)
x_txt = largo / 2 + 5;
y_txt = ancho / 2;

// Texto justo encima de la superficie (+0.01 evita z-fighting)
translate([x_txt, y_txt + tam_texto * 0.4, grosor + 0.01])
    text(linea1, size=tam_texto, halign="center", valign="center");

translate([x_txt, y_txt - tam_texto * 0.5, grosor + 0.01])
    text(linea2, size=tam_texto * 0.55, halign="center", valign="center");