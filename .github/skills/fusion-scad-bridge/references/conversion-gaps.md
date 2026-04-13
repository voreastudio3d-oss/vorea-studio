# Conversion Gaps — Fusion 360 → OpenSCAD

## Qué se puede convertir HOY (Capa 1: Parámetros)

| Feature F360 | Convertible | Método |
|-------------|-------------|--------|
| User Parameters (dimensiones) | ✅ Sí | Script Python → .scad variables |
| Unidades (cm→mm) | ✅ Sí | `value * 10` en script |
| Comentarios de parámetros | ✅ Sí | Se arrastran al .scad |
| Expresiones (fórmulas) | ⚠️ Parcial | Se exporta la expresión como string en JSON, pero el valor evaluado se usa en SCAD |
| Factor de escala | ✅ Sí | Multiplicador aplicado en script |
| Tipos de unidad (deg, mm, unitless) | ✅ Sí | Conversión inteligente en script v2 |

## Qué se podría convertir DESPUÉS (Capa 2: Geometría básica)

| Feature F360 | Dificultad | Approach |
|-------------|-----------|----------|
| Extrude (simétrico, one-side) | 🟡 Media | `linear_extrude()` con análisis de sketch |
| Revolve | 🟡 Media | `rotate_extrude()` con perfil 2D |
| Mirror / Pattern circular | 🟢 Baja | `openfusion.scad` patterns |
| Fillet / Chamfer | 🟡 Media | BOSL2 `edge_profile`, `rounding` |
| Shell | 🟠 Alta | `offset()` + `difference()` |
| Boolean (Join/Cut/Intersect) | 🟢 Baja | `union()`, `difference()`, `intersection()` |

## Qué NO se puede convertir (limitaciones fundamentales)

| Feature F360 | Razón | Workaround |
|-------------|-------|------------|
| Sketch constraints (coincident, tangent, perpendicular) | OpenSCAD no tiene solver de constraints | Exportar valores evaluados |
| B-Rep / NURBS surfaces | OpenSCAD es CSG puro | Discretizar a polígonos o usar mesh import |
| Assembly / joints | OpenSCAD no tiene assemblies nativos | Exportar bodies por separado |
| Timeline / parametric history | SCAD no tiene concept de timeline | Recrear lógica manualmente |
| Sculpt / T-Spline | Geometría subdivision no existe en SCAD | Exportar mesh y usar `surface()` |
| Sheet metal | Feature específica de F360 | Recrear como flat pattern + bend lines |

## Roadmap de capacidades

### Fase 1 (actual) — Parámetros
- ✅ Export User Parameters → .scad + .json
- ✅ Conversión de unidades
- ✅ Factor de escala
- ✅ Metadata para ingesta automática

### Fase 2 (próxima) — Geometría simple
- ⬜ Análisis de features F360 (extrude, revolve, mirror)
- ⬜ Generación de SCAD con primitivas equivalentes
- ⬜ Mapeo automático a familias Vorea

### Fase 3 (futura) — Geometría avanzada
- ⬜ Sketch profiles → polígonos 2D → `polygon()` + `linear_extrude()`
- ⬜ Fillet/chamfer → BOSL2 edge profiles
- ⬜ Pattern → `for` loops con transformaciones
- ⬜ STEP import como alternativa (via build123d/CadQuery)

### Fase 4 (investigación) — Round-trip
- ⬜ Edición de parámetros en Vorea → re-export a F360
- ⬜ Sync bidireccional de parámetros via JSON
- ⬜ Plugin Fusion 360 con webhook a Vorea API
