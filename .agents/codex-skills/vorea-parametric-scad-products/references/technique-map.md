# Technique Map

Usar esta referencia para elegir la tecnica correcta antes de abrir una nueva familia de producto.

## OpenSCAD nativo

| Tecnica | Usar cuando | Evitar cuando |
|---|---|---|
| `union`, `difference`, `intersection` | el modelo es utilitario o modular | nunca; es la base |
| `hull` | hace falta una transicion robusta entre apoyos o brazos | el volumen resultante se vuelve demasiado masivo |
| `minkowski` | el valor percibido depende de un redondeo premium | el objeto es grande o con muchas cavidades |
| `offset` | hay que crecer/encoger perfiles 2D antes de extruir | necesitas detalles 3D complejos |
| `linear_extrude` | labels, trays, organizers, signage | el objeto depende de perfiles 3D fluidos |
| `rotate_extrude` | jarrones, caps, shades, recipientes rotacionales | la seccion cruza el eje o requiere asimetria compleja |
| `surface()` | emboss, diffuse, relief controlado | el heightmap domina toda la fabricabilidad |

## BOSL2

| Capacidad | Usar cuando | Plantillas tipicas |
|---|---|---|
| `attachments` | hay modulos relativos, snap-ins o ensamblajes | organizers, kits, enclosures |
| `cuboid`, `tube`, `prism` | necesitas primitives mas productivas que OpenSCAD puro | bins, docks, housings |
| `offset_sweep`, `edge_profile`, masks | quieres tactilidad y bordes premium | desktop goods, holders |
| `path_sweep()` | la pieza sigue una trayectoria con seccion fija o controlada | lamp ribs, cable guides |
| `skin()` | la pieza conecta perfiles sucesivos | vases, lamp shells, organic cups |
| `threading` | necesitas tapa, jar, union mecanica | containers, caps, dispensers |
| `hooks`, `joiners`, `hinges` | el producto es funcional y repetible | wall hooks, clip systems |
| `textures` | quieres grip, knurling o emboss visible | lids, labels, diffusers |
| `isosurface` / metaballs | buscas volumen organico blando | decoracion, branding, showcase |

## Regla de seleccion

1. Empezar por OpenSCAD nativo.
2. Subir a BOSL2 cuando:
   - mejora ensamblaje;
   - mejora rounding;
   - o evita reinventar threading/hooks/skin.
3. Usar metaballs e isosurface solo cuando la forma organica sea parte del valor del producto.
