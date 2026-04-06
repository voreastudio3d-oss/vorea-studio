# Oportunidades de Producto Parametrico SCAD para Vorea

Fecha de relevamiento: 2026-03-28  
Objetivo: convertir la investigacion de BOSL2, OpenSCAD, MakerWorld/Bambu Lab, Printables y Creality Cloud en una guia operativa para crear nuevas familias de producto parametrico en `/studio` usando `public/scad-library` como base.

## Resumen ejecutivo

La oportunidad mas clara para Vorea no esta en competir con modelos hiperorganicos aislados, sino en combinar:

- objetos utiles y vendibles en FDM;
- parametrizacion real;
- personalizacion visible;
- plantillas reproducibles en `Studio`;
- y una base SCAD mantenible apoyada en OpenSCAD + BOSL2.

La inferencia principal del relevamiento es consistente entre MakerWorld, Bambu Lab, Creality Cloud y la visibilidad publica de Printables:

- organizadores modulares;
- accesorios de escritorio;
- planters con drip tray o self-watering;
- lamparas y nightlights pensados para kits;
- hooks, mounts y holders;
- contenedores roscados;
- llaveros y tags con texto;
- nameplates y signage;
- jarrones o difusores en vase mode;
- y, como familia secundaria, articulados/fidgets.

Para Vorea, las familias con mejor encaje tecnico y comercial hoy son las que se pueden resolver con:

- CSG nativo (`union`, `difference`, `intersection`);
- `linear_extrude`, `rotate_extrude`, `offset`, `hull`, `minkowski`, `surface()`;
- BOSL2 `attachments`, `path_sweep`, `skin`, `offset_sweep`, `threading`, `hooks`, `textures`, `isosurface/metaballs`.

## 1) Que muestran las plataformas

### MakerWorld y ecosistema Bambu

MakerWorld hace visibles varias senales fuertes para producto imprimible FDM:

- organizadores de escritorio y bandejas parametrizadas;
- accesorios con fit claro para cables, gadgets y cajones;
- planters con drip tray;
- colecciones enteras de articulados;
- y objetos pensados para kits o componentes fisicos.

La pieza mas valiosa para Vorea no es copiar modelos puntuales, sino el patron:

- valor de uso inmediato;
- personalizacion por medidas;
- y lenguaje visual "limpio para imprimir" en vez de complejidad por complejidad.

Ademas, Bambu Lab esta empujando el concepto de `Maker's Supply` y kits listos para integrar, lo que vuelve muy atractivas familias como:

- lamp shades;
- nightlights;
- cajas y soportes para kits;
- productos que mezclan pieza impresa + hardware simple.

### Creality Cloud

Creality Cloud refuerza una lectura similar:

- desk organizers;
- nightlights o lamp forms;
- drip trays y piezas de reposicion;
- accesorios practicos para hogar y escritorio.

Eso es importante porque marca demanda sostenida en FDM funcional, no solo decorativo.

### Printables

La exploracion de Printables confirma la misma direccion general de catalogo:

- organizers;
- planters;
- lamps;
- accesorios customizables;
- piezas practicas de hogar/oficina;
- y articulados/fidgets.

En este caso la conclusion es una inferencia de tendencia y catalogo, no una afirmacion sobre un ranking exacto del sitio.

## 2) Que significa esto para SCAD parametrico

No todas las tendencias sirven igual para SCAD parametrico.

### Encaje muy alto

- organizers de cajon, escritorio y pared;
- hooks, mounts, stands y holders;
- planters con drip tray;
- jarras y contenedores roscados;
- signage y labels;
- vase/lamp shells;
- accesorios modulares para escritorio o taller.

Son ideales porque exponen parametros claros:

- ancho, alto, profundidad;
- numero de divisiones o slots;
- diametros y holguras;
- espesor de pared;
- radios y fillets;
- angulos de apoyo;
- texto o patron.

### Encaje medio

- nightlights;
- diffusers;
- shells decorativos;
- desktop toys repetitivos;
- patrones tipo lattice o honeycomb.

Sirven bien si la geometria base se mantiene controlable y printable.

### Encaje bajo o experimental

- figuras articuladas complejas estilo criatura organica;
- modelos dependientes de sculpt o mesh artistico;
- topologias demasiado libres para un pipeline SCAD utilitario.

No es que SCAD no pueda participar, pero no deberia ser la primera oleada de templates de `Studio`.

## 3) Tecnicas clave: OpenSCAD nativo + BOSL2

## OpenSCAD nativo que Vorea debe explotar mas

| Tecnica | Para que sirve | Familia recomendada |
|---|---|---|
| `union`, `difference`, `intersection` | ensamblar, vaciar, perforar y segmentar piezas | todas |
| `hull` | transiciones suaves, bridges, hooks y agarres | hooks, handles, stands |
| `minkowski` | redondeos generosos y volumen suave | contenedores premium, agarres |
| `offset` | grow/shrink 2D antes de extruir | bandejas, labels, perfiles |
| `linear_extrude` | cuerpos prismaticos, signage, organizers | bins, labels, trays |
| `rotate_extrude` | cuerpos de revolucion | vases, lamp shades, caps |
| `surface()` | relieves o texturas por heightmap | lamparas, placas, decoracion |

Regla operativa: `minkowski` y `surface()` deben usarse con presupuesto de complejidad, no como default universal.

## BOSL2 que mas valor aporta a Vorea

| Capacidad BOSL2 | Valor para Vorea | Plantillas ideales |
|---|---|---|
| `attachments` | ensamblaje relativo robusto sin hardcodear coordenadas | organizers modulares, kits, stands |
| `cuboid`, `tube`, `prism`, `masks` | building blocks mas ricos que OpenSCAD puro | bins, docks, holders |
| `offset_sweep`, `edge_profile`, fillets | bordes premium sin reinventar rounded corners | desktop goods, product accessories |
| `path_sweep()` | perfilar una seccion a lo largo de una curva | lamp ribs, handles, cable guides |
| `skin()` | unir perfiles sucesivos y generar shells | vases, shades, organic shells |
| `threading` | tapas, contenedores, cierres y acoples imprimibles | jars, spice containers, lens caps |
| `hooks`, `joiners`, `hinges` | piezas utilitarias repetibles | wall hooks, clip systems, enclosures |
| `textures` | knurling, embossing, patrones repetidos e imagen | labels, lamp diffusers, grippy caps |
| `isosurface` / metaballs | blends organicos y volumen blando | decoracion, difusores, esculturas light |

La mejor lectura tecnica es usar BOSL2 como acelerador de producto, no como excusa para agregar complejidad sin criterio.

## 4) Base actual de `scad-library`

Hoy `public/scad-library/catalog.json` ya tiene semillas con muy buen encaje para Studio:

- `vorea-storage-bin`
- `vorea-phone-stand`
- `vorea-nameplate`
- `vorea-cable-clip`
- `vorea-honeycomb-coaster`
- `vorea-spiral-vase`
- `vorea-wall-hook`
- `vorea-Soporte_para_macetas`

Y el pipeline parametrico actual ya reconoce estas familias base:

- `fdm`: `storage-box`, `phone-stand`, `utility-hook`
- `organic`: `vase-wave`, `lamp-shell`, `decorative-tower`

Conclusion: Vorea ya no esta empezando de cero. Lo correcto ahora es expandir por olas, partiendo de familias con semilla SCAD real.

## 5) Roadmap recomendado de templates para `/studio`

## Ola 1 - maxima relacion valor/esfuerzo

| Family ID propuesta | Semilla actual | Oportunidad | Parametros minimos |
|---|---|---|---|
| `drawer-organizer-tray` | `vorea-storage-bin` | desk organization, cajones, talleres, makers | width, depth, height, cellCountX, cellCountY, wall, floor, lip |
| `cable-dock-strip` | `vorea-cable-clip` | escritorio, streaming, oficina, talleres | cableCount, cableDiameter, spacing, mountType, baseWidth, chamfer |
| `phone-dock-pro` | `vorea-phone-stand` | mobile/tablet dock, charging angle, desk setup | deviceWidth, thickness, angle, cableSlot, backHeight, lip |
| `wall-hook-plus` | `vorea-wall-hook` | hogar, taller, auriculares, cocina | loadClass, reach, thickness, screwMode, filletRadius |
| `text-keychain-tag` | `vorea-nameplate` | llaveros, bag tags, regalos, classroom | labelText, tagWidth, tagHeight, holeDiameter, textSize, engraved |
| `nameplate-pro` | `vorea-nameplate` | signage, labels, desk branding, classroom | text, fontScale, baseStyle, standAngle, border, iconSlot |
| `planter-drip-system` | `vorea-Soporte_para_macetas` | home decor, gifting, maker products | potDiameter, height, trayGap, trayDepth, wall, footStyle |
| `lamp-shade-kit` | `vorea-spiral-vase` + `lamp-shell` | nightlights y kit products | topDiameter, bottomDiameter, height, patternDensity, ventSlots, kitSeatDiameter |
| `threaded-jar` | nueva familia | cocina, taller, escritorio, travel | bodyDiameter, height, wall, threadPitch, lidKnurl, gasketSeat |

## Ola 2 - ampliar lenguaje y margen

| Family ID propuesta | Semilla actual | Oportunidad | Tecnica dominante |
|---|---|---|---|
| `stackable-desktop-bin` | `vorea-storage-bin` | storage modular visible | `attachments` + divisores |
| `coaster-diffuser` | `vorea-honeycomb-coaster` | coasters, trivets, lamp diffusers | `linear_extrude` + patterning |
| `ribbed-planter` | `vorea-spiral-vase` | home decor premium | `rotate_extrude` + `skin` |
| `headphone-hanger` | `vorea-wall-hook` | desk mount premium | `hull` + fillets + attach points |
| `peg-label-system` | `vorea-nameplate` | workshop/storage labeling | text + snap hooks |
| `kit-enclosure-shell` | `lamp-shell` | electronics + maker kits | `attachments`, vents, bosses |

## Ola 3 - experimental / firma visual

| Family ID propuesta | Uso | Comentario |
|---|---|---|
| `metaball-diffuser` | decoracion, luz ambiente | ideal para showcase, no para catalogo core |
| `organic-pen-cup` | desktop decor + utility | buena pieza de marca |
| `articulated-desk-toy` | engagement social | hacer solo si se diseña una gramatica parametricamente estable |

## 6) Principios de diseno industrial para estas familias

1. Diseñar para `no support` o `minimal support` por defecto.
2. Exponer solo parametros que el usuario entienda en lenguaje de producto.
3. Separar `fit funcional` de `piel visual`.
4. Tratar los fillets y radios como valor percibido, no solo detalle estetico.
5. Incluir tolerancias y clearances razonables para FDM desde el generador.
6. Favorecer objetos con foto/listing facil: escritorio, hogar, organizacion, luz, plantas.
7. Si una familia depende de kit externo, ofrecer al menos 2 o 3 medidas de asiento, no un unico hardware rigido.
8. Evitar families que requieran mesh artistica para verse bien.

## 7) Como bajar esto a `Studio`

### Expansion del catalogo parametrico

Siguiente paso tecnico natural:

- ampliar `src/app/parametric/instruction-spec.ts`;
- extender `spec-builder.ts`;
- y crear generadores nuevos por ola en `src/app/parametric/generators/`.

Orden sugerido:

1. `drawer-organizer-tray`
2. `planter-drip-system`
3. `lamp-shade-kit`
4. `text-keychain-tag`
5. `nameplate-pro`
6. `peg-label-system`
7. `threaded-jar`

Estado 2026-03-28:

- Los siete items de esta secuencia ya quedaron implementados en `AIStudio` + `Editor`.
- El siguiente frente recomendado pasa a ser ola 2 o la profundizacion tecnica de `BG-205`.

### Expansion de templates visibles

En paralelo, el Editor puede absorber mas semillas desde `public/scad-library/models/` para acelerar:

- preview;
- fork;
- reutilizacion por comunidad;
- y demostraciones de casos de uso.

## 8) Skill que conviene usar en el repo

Se recomienda crear y usar un skill repo-local separado del skill de `surface/relief`, orientado a:

- productos SCAD parametrico vendibles;
- BOSL2 aplicado a producto;
- lectura industrial/FDM;
- y expansion concreta de templates para `Studio`.

Ese skill no reemplaza `vorea-parametric-scad-surface`; lo complementa.

## 9) Recomendacion final

La mejor estrategia para Vorea es:

1. usar `scad-library` como banco de semillas ya probadas;
2. sumar BOSL2 como capa de producto, no solo de geometria;
3. priorizar organizers, planters, lamp shells, hooks y contenedores roscados;
4. dejar articulados complejos y formas demasiado escultoricas como ola posterior.

## Fuentes revisadas

Tecnicas y librerias:

- [BOSL2 Wiki](https://github.com/BelfrySCAD/BOSL2/wiki)
- [BOSL2 Repository](https://github.com/BelfrySCAD/BOSL2)
- [OpenSCAD User Manual - Constructed Solids](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Constructed_Solids)
- [OpenSCAD User Manual - Transformations](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Transformations)
- [OpenSCAD User Manual - 2D to 3D Extrusion](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/2D_to_3D_Extrusion)
- [OpenSCAD User Manual - Importing Geometry](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Importing_Geometry)

Tendencias y catalogo:

- [MakerWorld - Parametric Drawer Organizer Tray](https://makerworld.com/en/models/923866-parametric-drawer-organizer-tray)
- [MakerWorld - Organizer with Gadget](https://makerworld.com/en/models/140497)
- [MakerWorld - The Drip Tray](https://makerworld.com/en/models/502356-the-drip-tray)
- [MakerWorld - Articulated Dragons Collection](https://makerworld.com/en/collections/2036966-articulated-dragons)
- [Creality Cloud - Asanoha Hex Desk Organizer](https://www.crealitycloud.com/model-detail/asanoha-hex-desk-organizer)
- [Creality Cloud - Dragon Head Lamp or Nightlight](https://www.crealitycloud.com/es/model-detail/dragon-head-lamp-nightlight)
- [Creality Cloud - Nespresso Inissia D40 Drip Tray](https://www.crealitycloud.com/model-detail/nespresso-inissia-d40-drip-tray)
- [Bambu Lab - Maker's Essential Kit A](https://us.store.bambulab.com/products/makers-essential-kit-a/)
- [Printables](https://www.printables.com/)
