// --- Parámetros Secciones [Radio, Lados] ---
sections = [
    [20, 64], // Base
    [35, 60], // Cuerpo bajo
    [15, 40], // Cuello
    [25, 30], // Boca
    [22, 64]  // Labio superior
];

total_height = 100;
steps_per_segment = 20;

module vase() {
    for (i = [0 : len(sections) - 2]) {
        h_start = i * (total_height / (len(sections)-1));
        
        for (j = [0 : steps_per_segment - 1]) {
            // Interpolación Cosenoidal para suavidad (Curva parametrizable)
            t = j / steps_per_segment;
            t_smooth = (1 - cos(t * 180)) / 2; 
            
            // LERP de radios y lados
            r_curr = sections[i][0] + (sections[i+1][0] - sections[i][0]) * t_smooth;
            r_next = sections[i][0] + (sections[i+1][0] - sections[i][0]) * ((j+1)/steps_per_segment); // Simplificado para hull
            
            s_curr = round(sections[i][1] + (sections[i+1][1] - sections[i][1]) * t_smooth);
            
            z_curr = h_start + (j * (total_height / (len(sections)-1)) / steps_per_segment);
            z_next = h_start + ((j+1) * (total_height / (len(sections)-1)) / steps_per_segment);

            // Generación de piel mediante hull de rodajas (Slices)
            hull() {
                translate([0, 0, z_curr]) cylinder(r = r_curr, h = 0.1, $fn = s_curr);
                translate([0, 0, z_next]) cylinder(r = r_next, h = 0.1, $fn = s_curr);
            }
        }
    }
}

vase();