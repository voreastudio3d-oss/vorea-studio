---
name: fusion-scad-bridge
description: "Use when: converting Fusion 360 designs to OpenSCAD, extracting parametric data from F360, mapping F360 User Parameters to SCAD variables, generating F360 export scripts, importing external CAD parameters into Vorea pipeline, unit conversion cm→mm, scale factors for 3D printing, or bridging proprietary CAD → open parametric workflows."
argument-hint: "Describe the Fusion 360 model or parameters you want to convert to SCAD"
---

# Fusion 360 → OpenSCAD Bridge

## Overview

Skill para convertir diseños de Autodesk Fusion 360 a OpenSCAD paramétrico compatible con el pipeline de Vorea Studio. Cubre las 3 capas del flujo: extracción (F360 script), ingesta (parser en Vorea), y generación (pipeline existente).

## When to Use

- Exportar User Parameters de Fusion 360 a `.scad`
- Importar parámetros de F360 en el Editor o AI Studio de Vorea
- Generar o mejorar el script Python de extracción para F360
- Mapear geometría F360 a familias de producto Vorea existentes
- Convertir unidades cm→mm con factores de escala para impresión 3D
- Investigar técnicas de conversión CAD→SCAD

## Architecture

```
F360 Script (Python)         Vorea Ingesta            Pipeline Existente
─────────────────────        ──────────────           ──────────────────
User Parameters ──┐          Parser .scad  ──┐        InstructionSpecV1
Comments         ─┤──→ .scad + .json ──→     ├──→    spec-builder
Units (cm→mm)    ─┤          Mapper familias ─┤       generators
Scale factor     ─┘          Validador units ─┘       SCAD → preview → export
```

## Procedure

### Paso 1: Extracción desde Fusion 360

Usar el script [Fusion360_to_VoreaSCAD.py](./scripts/Fusion360_to_VoreaSCAD.py) en Fusion 360:

1. En Fusion 360: `Utilities > Scripts and Add-ins` (Shift+S)
2. `Create` → Python → nombre: `ExportToSCAD`
3. Pegar el script, guardar
4. Preparar User Parameters en `Modify > Change Parameters`
5. Ejecutar → seleccionar destino → genera `.scad` + `.json` metadata

### Paso 2: Reglas de nomenclatura F360

Para máxima compatibilidad con Vorea:

| Convención | Ejemplo | Razón |
|-----------|---------|-------|
| snake_case | `ancho_base`, `alto_pared` | OpenSCAD no acepta espacios |
| Prefijo por tipo | `dim_largo`, `tol_holgura` | Facilita mapeo automático |
| Comentarios | "Ancho de la base del soporte" | Se arrastran al .scad |
| Sin acentos | `angulo_inclinacion` | Compatibilidad ASCII |

### Paso 3: Conversión de unidades

| Origen (F360 API) | Destino (SCAD/Slicer) | Fórmula |
|-------------------|----------------------|---------|
| Centímetros (interno) | Milímetros | `valor_mm = param.value * 10` |
| Con escala | mm escalado | `valor_mm = (param.value * 10) * escala` |
| Ángulos | Grados | Sin conversión (ya en grados) |

La precisión es `.3f` (3 decimales) para evitar errores de redondeo en slicers.

### Paso 4: Integración en Vorea

Una vez generado el `.scad`:

```scad
// En el archivo de diseño OpenSCAD:
include <parametros_fusion.scad>

// Usar las variables directamente:
cube([largo_base, ancho_base, alto_pared]);
```

Para usar en el pipeline de Vorea:
1. Subir el `.scad` al Editor de Vorea
2. El intérprete SCAD (`src/app/engine/scad-interpreter.ts`) procesa las variables
3. El preview Three.js renderiza el resultado
4. Export a STL/3MF/GCODE con el pipeline existente

### Paso 5: Mapeo a familias Vorea

Consultar [family-mapping.md](./references/family-mapping.md) para mapear parámetros F360 a:
- Familias existentes (storage-bin, phone-stand, wall-hook, etc.)
- Templates del Editor (gridfinity, cable, etc.)
- Generadores del AI Studio (fdm-utility, organic-decorative)

## Key Decisions

| Decisión | Elección | Razón |
|----------|---------|-------|
| Formato de intercambio | `.scad` + `.json` sidecar | `.scad` es directamente usable; `.json` lleva metadata tipada |
| Unidades | Siempre mm en output | Estándar de slicers y OpenSCAD |
| Constraints F360 | No se preservan | Sin solver de constraints; se exportan valores finales |
| Geometría | Solo parámetros, no B-Rep | B-Rep→SCAD es investigación futura |

## Research References

- [repos-research.md](./references/repos-research.md) — Análisis de 5 repos de referencia
- [conversion-gaps.md](./references/conversion-gaps.md) — Qué se puede y qué no se puede convertir
- [family-mapping.md](./references/family-mapping.md) — Mapeo F360 params → familias Vorea

## Related Skills

- `vorea-parametric-scad-products` — Familias de producto parametrizadas
- `vorea-parametric-scad-surface` — Pipeline SCAD/CSG/export
- `advanced-3d-parametric-math-fdm` — Geometría computacional y FDM
