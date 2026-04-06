// Creado por Alberto Nicas (Abril de 2025)
// V2.1 Modificado para anilla automática
//V2.2 El agujero de la anilla atraviesa el Borde.
//V2.3 Se añade la opción de poder escribir 2 nombres en 2 filas.
//V2.4 Se añade la fuente "Noto Sans", compatible con Latino, Griego, Cirílico y Hebreo.
// Llavero Personalizado con Texto y Borde v2.4


/* [Texto / Text] */
// First line (always displayed)
linea1 = "Alberto";
// Second line OPTIONAL (leave it empty "" if you don't want a second line)
linea2 = "Nicás";
// Fuente
// Font
fuente = "DynaPuff"; // [Archivo Black, Bangers, Bungee, Changa One, Bebas Neue, Noto Sans (World), Poppins Black, Pacifico, Press Start 2P, Audiowide, DynaPuff]
// Text height
altura_texto = 1.5;
// Text size
tamanio_texto = 12;
// Line spacing
espaciado_lineas = 1.2;

/* [Borde / Edge] */
//Edge thickness
grosor_borde = 3;
//Border height
altura_borde = 3;

/* [Anilla / Ring] */
//Show ring
mostrar_anilla = true;
//external diameter
diametro_exterior = 11;
//internal diameter
diametro_interior = 4;
//ring height
altura_anilla = 3;
//x position
ajuste_x = 0;
//y position
ajuste_y = 0;

/* [Color] */
//two colors
dos_colores = true;
//single color
color_unico = "Negro / Black"; // [Rojo / Red, Rojo Oscuro / Dark Red, Verde / Green, Verde Oscuro / Dark Green, Azul / Blue, Azul Oscuro / Dark Blue, Amarillo / Yellow, Naranja / Orange, Morado / Purple, Rosa / Pink, Blanco / White, Negro / Black, Gris Claro / Light Gray, Gris Oscuro / Dark Gray, Turquesa / Turquoise]

//base color
color_base = "Negro / Black"; // [Rojo / Red, Rojo Oscuro / Dark Red, Verde / Green, Verde Oscuro / Dark Green, Azul / Blue, Azul Oscuro / Dark Blue, Amarillo / Yellow, Naranja / Orange, Morado / Purple, Rosa / Pink, Blanco / White, Negro / Black, Gris Claro / Light Gray, Gris Oscuro / Dark Gray, Turquesa / Turquoise]

//text color
color_texto = "Verde / Green"; // [Rojo / Red, Rojo Oscuro / Dark Red, Verde / Green, Verde Oscuro / Dark Green, Azul / Blue, Azul Oscuro / Dark Blue, Amarillo / Yellow, Naranja / Orange, Morado / Purple, Rosa / Pink, Blanco / White, Negro / Black, Gris Claro / Light Gray, Gris Oscuro / Dark Gray, Turquesa / Turquoise]

FACTORES_FUENTE = [
    ["Archivo Black", 0.39], ["Bangers", 0.27], ["Bungee", 0.47],
    ["Changa One", 0.33], ["Bebas Neue", 0.25], ["Noto Sans (World)", 0.35], ["Poppins Black", 0.38],
    ["Pacifico", 0.3], ["Press Start 2P", 0.69], ["Audiowide", 0.41],
    ["DynaPuff", 0.36]
];

COLORES = [
    ["Rojo / Red", [1,0,0]], ["Rojo Oscuro / Dark Red", [0.6,0,0]],
    ["Verde / Green", [0,1,0]], ["Verde Oscuro / Dark Green", [0,0.6,0]],
    ["Azul / Blue", [0,0,1]], ["Azul Oscuro / Dark Blue", [0,0,0.6]],
    ["Amarillo / Yellow", [1,1,0]], ["Naranja / Orange", [1,0.5,0]],
    ["Morado / Purple", [0.5,0,0.5]], ["Rosa / Pink", [1,0.4,0.7]],
    ["Blanco / White", [1,1,1]], ["Negro / Black", [0,0,0]],
    ["Gris Claro / Light Gray", [0.8,0.8,0.8]], 
    ["Gris Oscuro / Dark Gray", [0.3,0.3,0.3]],
    ["Turquesa / Turquoise", [0,0.8,0.8]]
];

function buscar_valor(lista, key, default = 0) = 
    len([for(item = lista) if(item[0] == key) item[1]]) > 0 
    ? [for(item = lista) if(item[0] == key) item[1]][0] 
    : default;

function factor_fuente(nombre) = buscar_valor(FACTORES_FUENTE, nombre, 0.45);
function obtener_color(nombre) = buscar_valor(COLORES, nombre, [1,1,1]);

function calcular_ancho_maximo() = 
    (linea2 != "") ? 
        max(len(linea1) * tamanio_texto * factor_fuente(fuente), 
            len(linea2) * tamanio_texto * factor_fuente(fuente)) :
        len(linea1) * tamanio_texto * factor_fuente(fuente);

function calcular_posicion_inicial_x() = 
    -(calcular_ancho_maximo() + grosor_borde + diametro_exterior/4);

// Función para calcular la posición Y de la primera línea
function calcular_posicion_primera_linea() = 
    (linea2 != "") ? tamanio_texto * espaciado_lineas / 2 : 0;

// Módulos base
module texto_multilinea() {
    if (linea2 != "") {
        // Primera línea arriba
        translate([0, tamanio_texto * espaciado_lineas / 2, 0])
            text(linea1, font = fuente, size = tamanio_texto, 
                 halign = "center", valign = "center");
        // Segunda línea abajo
        translate([0, -tamanio_texto * espaciado_lineas / 2, 0])
            text(linea2, font = fuente, size = tamanio_texto, 
                 halign = "center", valign = "center");
    } else {
        // Solo primera línea
        text(linea1, font = fuente, size = tamanio_texto, 
             halign = "center", valign = "center");
    }
}

module anilla_completa() {
    difference() {
        cylinder(h = altura_anilla, d = diametro_exterior, $fn=50);
        cylinder(h = altura_anilla + 1, d = diametro_interior, $fn=50);
    }
}

module crear_base() {
    minkowski() {
        linear_extrude(height = altura_borde) texto_multilinea();
        cylinder(r = grosor_borde, h = 0.1, $fn = 32);
    }
}

module crear_anilla() {
    if (mostrar_anilla) {
        // Alinear la anilla con la primera línea de texto
        translate([calcular_posicion_inicial_x() + ajuste_x, 
                  calcular_posicion_primera_linea() + ajuste_y, 0])
            anilla_completa();
    }
}

module agujero_anilla() {
    if (mostrar_anilla) {
        // Alinear el agujero con la primera línea de texto
        translate([calcular_posicion_inicial_x() + ajuste_x, 
                  calcular_posicion_primera_linea() + ajuste_y, -1])
            cylinder(h = altura_borde + abs(altura_texto) + 2, 
                    d = diametro_interior, $fn=50);
    }
}

// Módulo principal
module texto_con_borde() {
    color_actual_base = obtener_color(!dos_colores ? color_unico : color_base);
    color_actual_texto = obtener_color(!dos_colores ? color_unico : color_texto);

    if (altura_texto >= 0) {
        // Base y anilla
        color(color_actual_base) difference() {
            union() {
                crear_base();
                crear_anilla();
            }
            agujero_anilla();
        }
        
        // Texto elevado
        color(color_actual_texto)
        translate([0, 0, altura_borde])
            linear_extrude(height = altura_texto) texto_multilinea();
    } 
    else {
        // Caso negativo
        difference() {
            color(color_actual_base) union() {
                crear_base();
                crear_anilla();
            }
            
            union() {
                // Texto hundido
                color(color_actual_texto)
                translate([0, 0, altura_borde + altura_texto])
                    linear_extrude(height = abs(altura_texto) * 2)
                        offset(delta = -0.1) texto_multilinea();
                
                // Agujero anilla
                color(color_actual_base) agujero_anilla();
            }
        }
    }
}

texto_con_borde();