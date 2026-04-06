largo = 60;
ancho = 28;
grosor = 4;
prof_texto = 1.2;
tam_texto = 8;
radio_esquina = 5;
radio_agujero = 4;
solo_base = 0;
$fn = 48;

module rounded_rect_2d(l, a, r) {
    hull() {
        translate([r, r]) circle(r = r);
        translate([l - r, r]) circle(r = r);
        translate([r, a - r]) circle(r = r);
        translate([l - r, a - r]) circle(r = r);
    }
}

module cuerpo_llavero() {
    linear_extrude(height = grosor, center = false) {
        difference() {
            rounded_rect_2d(largo, ancho, radio_esquina);
            translate([radio_esquina + radio_agujero + 1, ancho / 2])
                circle(r = radio_agujero);
        }
    }
}

module texto_3d(txt, sz, xoff, yoff) {
    translate([xoff, yoff, grosor - prof_texto]) {
        linear_extrude(height = prof_texto + 0.1, center = false) {
            text(txt, size = sz, halign = "center", valign = "center");
        }
    }
}

module llavero_completo() {
    margen_x = radio_esquina + radio_agujero * 2 + 4;
    cx = margen_x + (largo - margen_x - radio_esquina) / 2;
    cy = ancho / 2;
    difference() {
        cuerpo_llavero();
        texto_3d("VOREA", tam_texto, cx, cy + tam_texto * 0.45);
        texto_3d("STUDIO", tam_texto * 0.6, cx, cy - tam_texto * 0.45);
    }
}

llavero_completo();