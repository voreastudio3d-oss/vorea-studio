# Studio Template Map

Mapeo entre semillas actuales de `public/scad-library` y familias recomendadas para expandir `Studio`.

## Semillas actuales

| Semilla actual | Reutilizacion inmediata | Evolucion recomendada |
|---|---|---|
| `vorea-storage-bin` | bin utilitario | `drawer-organizer-tray`, `stackable-desktop-bin` |
| `vorea-cable-clip` | clip de cable | `cable-dock-strip`, `desk-wire-comb` |
| `vorea-phone-stand` | stand basico | `phone-dock-pro`, `tablet-stand` |
| `vorea-wall-hook` | hook basico | `wall-hook-plus`, `headphone-hanger` |
| `vorea-nameplate` | desk plate | `text-keychain-tag`, `nameplate-pro`, `peg-label-system` |
| `vorea-Soporte_para_macetas` | soporte para maceta | `planter-drip-system`, `planter-stand` |
| `vorea-spiral-vase` | vaso/decorativo | `lamp-shade-kit`, `ribbed-planter`, `vase-wave-plus` |
| `vorea-honeycomb-coaster` | coaster | `coaster-diffuser`, `light-grid-disc` |

## Ola recomendada para implementar

### Ola 1

1. `drawer-organizer-tray` - implementado en `src/app/parametric/*`, `AIStudio` y template built-in de `Editor`
2. `planter-drip-system` - implementado en `src/app/parametric/*`, `AIStudio` y template built-in de `Editor`
3. `lamp-shade-kit` - implementado en `src/app/parametric/*`, `AIStudio` y template built-in de `Editor`
4. `text-keychain-tag` - implementado en `src/app/parametric/*`, `AIStudio`, `Editor` y `public/scad-library/catalog.json`
5. `nameplate-pro` - implementado en runtime, `Editor` y catalogo publico
6. `peg-label-system` - implementado en runtime, `Editor` y catalogo publico
7. `threaded-jar` - implementado en runtime, `Editor` y catalogo publico

### Ola 2

1. `phone-dock-pro`
2. `wall-hook-plus`
3. `coaster-diffuser`
4. `stackable-desktop-bin`

## Implementacion activa

- `nameplate-pro` - implementada y valida para consolidar la linea de personalizacion con texto
- `peg-label-system` - implementada como cierre funcional de la rama textual
- `threaded-jar` - implementado como siguiente salto utilitario con tapa roscada y grip exterior

## Impacto esperado en Studio

Cada nueva familia deberia generar cuatro artefactos:

1. `familyHint` nuevo o preset nuevo en AI Studio.
2. Generador SCAD o extension de generador existente.
3. Template visible o compartible en Editor.
4. Semilla reutilizable en `scad-library` o comunidad.

## Regla de priorizacion

Elegir primero familias que:

- resuelvan un problema util;
- admitan personalizacion obvia;
- impriman sin soporte en la mayoria de los casos;
- y puedan fotografiarse/listarse bien en marketing y comunidad.
