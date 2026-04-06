---
name: vorea-parametric-scad-surface
id: vorea-parametric-scad-surface
kind: skill
title: Vorea SCAD surfaces and fabrication
description: 'Repo-specific skill for advanced parametric SCAD authoring, mathematical 3D surface deformation, raster `surface()` and relief workflows, FDM-oriented export/slicing, and Three.js/WebGL preview code in `E:\__Vorea-Studio\__3D_parametrics\Vorea-Paramentrics-3D`. Use when Codex must create, review, or extend complex parametric objects such as vases, organic towers, Voronoi-like patterns, wood-grain or image-driven surfaces, fabrication outputs (`SCAD`, `STL`, `3MF`, `GCODE`), or rendering/tooling across `src/app/parametric/`, `src/app/engine/`, `src/app/pages/Editor.tsx`, `src/app/pages/Relief.tsx`, `src/app/pages/Organic.tsx`, and `server/mcp-tools.ts`.'
when_to_use:
  - Cuando el bloque toque relief, surface, deformaciones geométricas, export FDM o preview Three.js.
inputs:
  - src/app/parametric/**
  - src/app/engine/**
  - src/app/pages/Editor.tsx
  - src/app/pages/Relief.tsx
  - src/app/pages/Organic.tsx
  - server/mcp-tools.ts
outputs:
  - Cambios seguros en el núcleo SCAD/relief/render/export del repo.
validations:
  - npm run test
  - pnpm typecheck
docs_to_update:
  - ai_shared_plan.md
  - project_backlog.md
  - ai_handoff_YYYY-MM-DD.md
tags:
  - 3d
  - parametric
  - relief
  - render
applies_to:
  - src/app/parametric/**
  - src/app/engine/**
  - src/app/pages/Editor.tsx
  - src/app/pages/Relief.tsx
  - src/app/pages/Organic.tsx
  - server/mcp-tools.ts
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - skill:webgl-canvas-threejs
  - subagent:subagent-webgl-three-rendering
---

# Vorea Parametric Scad Surface

## Overview

Usar este skill para trabajar en el nucleo 3D del repo sin mezclar soporte real con roadmap. Cubrir la cadena hoy implementada en Vorea: `Prompt -> InstructionSpecV1 -> SCAD`, interpretacion CSG, `surface()` con imagenes raster registradas, relief/surface modes, preview Three.js, export `STL`/`3MF`, y slicing a `GCODE`.

Leer `references/capability-map.md` cuando el pedido mencione formatos (`STL`, `OBJ`, `SVG`, `F3D`, `3MF`, `GCODE`) o fuentes de textura (`PNG`, `JPG`, `WEBP`, `SVG`).

## Trigger Examples

Activar este skill ante pedidos como:

- "crear un jarron parametrico"
- "agregar deformacion tipo madera"
- "generar una variante organica o Voronoi-like"
- "aplicar una textura PNG como relief o `surface()`"
- "exportar para FDM, slicer o GCode"
- "mejorar preview o render WebGL/Three.js"

Si el usuario pide un formato no garantizado o una tecnica todavia no implementada, tratarlo como verificacion o nueva feature, nunca como capacidad ya resuelta.

## Capacidades Verificadas Del Repo

1. Pipeline prompt-to-SCAD:
   - `src/app/parametric/instruction-spec.ts`
   - `src/app/parametric/spec-builder.ts`
   - `src/app/parametric/pipeline.ts`
   - `src/app/parametric/validation.ts`
   - `src/app/parametric/compile-preview.ts`
2. Generadores SCAD actuales:
   - `src/app/parametric/generators/fdm-utility.ts`
   - `src/app/parametric/generators/organic-decorative.ts`
   - `src/app/parametric/generators/parameter-values.ts`
3. Runtime SCAD/CSG:
   - `src/app/engine/scad-interpreter.ts`
   - `src/app/engine/csg.ts`
4. Surface deformation y relief:
   - `src/app/engine/image-registry.ts`
   - `src/app/engine/heightmap-generator.ts`
   - `src/app/engine/relief-worker.ts`
   - `src/app/engine/surface-modes/*`
   - `src/app/pages/Relief.tsx`
5. Render, export y fabricacion:
   - `src/app/engine/threejs-renderer.ts`
   - `src/app/engine/mesh-renderer.ts`
   - `src/app/engine/threemf-exporter.ts`
   - `src/app/engine/slicer.ts`
   - `src/app/engine/fullcontrol.ts`
6. MCP interno para orquestacion:
   - `server/mcp-tools.ts`

Interpretar como soporte real ya verificado:

- `SCAD` como artefacto fuente del pipeline parametrico.
- `PNG`, `JPG`, `JPEG` y `WEBP` como entradas raster para Relief.
- `surface("archivo")` usando imagenes registradas en el browser-side registry.
- `STL`, `3MF` y `GCODE` como salidas del pipeline actual.

## Routing Del Pedido

Elegir uno o mas frentes principales antes de editar:

- SCAD parametrico puro:
  - cambios en `src/app/parametric/*`
  - familias `fdm` u `organic`
- Deformaciones de superficie o relief:
  - `heightmap-generator.ts`
  - `relief-worker.ts`
  - `surface-modes/*`
  - `Relief.tsx`
- Render WebGL/Three.js:
  - `threejs-renderer.ts`
  - `mesh-renderer.ts`
  - viewers y previews
- Export o fabricacion:
  - `threemf-exporter.ts`
  - `slicer.ts`
  - `fullcontrol.ts`
- Orquestacion MCP:
  - `server/mcp-tools.ts`
  - contrato del pipeline interno

Traducir intenciones ambiguas del usuario a conceptos del repo:

- `jarron`, `lampara`, `torre`, `organico`:
  - partir desde familias `organic` existentes; si falta la forma, extender generador o agregar nueva familia.
- `voronoi`, `lattice`, `celular`, `perforado matematico`:
  - verificar si ya existe una familia/generador real; si no, tratarlo como nueva implementacion parametrica o de engine.
- `madera`, `grabado`, `textura`, `mapa de altura`, `imagen`:
  - preferir Relief o `surface()` con alturas, color zones y espesores fabricables.
- `logo SVG`, `patron vectorial`, `contorno vectorial`:
  - verificar primero ingest directa; si no existe, plantear rasterizacion previa o nueva feature de import.
- `STL`, `3MF`, `GCODE`, `slicer`:
  - validar orientacion, unidades, color encoding y fabricabilidad FDM.

Si el trabajo cruza varios frentes, combinar este skill con:

- `.agents/skills_catalog/advanced-3d-parametric-math-fdm.md`
- `.agents/skills_catalog/webgl-canvas-threejs.md`
- `.agents/workflows/subagent_routing_workflow.md`

## Preservar Convenciones Del Repo

Mantener estas convenciones:

1. Motores parametricos actuales:
   - `fdm`
   - `organic`
2. Perfiles de calidad:
   - `draft`
   - `final`
3. Pipeline actual:
   - `prompt -> spec -> scad -> validate/preview`
4. Familias activas:
   - `fdm`: `storage-box`, `phone-stand`, `utility-hook`
   - `organic`: `vase-wave`, `lamp-shell`, `decorative-tower`
5. `printProfile` actual:
   - `fdm`
6. Render:
   - el engine SCAD/CSG trabaja con convencion `Z-up`
   - Three.js hace swap `Y/Z` para la escena
7. Export:
   - `3MF` y `STL` aplican rotacion para alinearse con slicers
8. Relief o surface:
   - modos vigentes: `plane`, `cylinder`, `box`, `polygon`, `lampshade`, `geodesic`

No cambiar ejes, unidades, materiales, perfiles de impresion ni modos de color de manera parcial.

## Geometria, FDM y Seguridad Del Modelo

Al crear o extender generadores, deformaciones o exportadores:

1. Definir rangos `min/max/step` y `defaultValue` seguros.
2. Mantener warnings del spec cuando:
   - el prompt es demasiado corto;
   - el `familyHint` es incompatible;
   - overrides exceden limites;
   - el perfil `final` aumenta complejidad o tiempo.
3. Preferir defaults fabricables en FDM:
   - espesores minimos razonables;
   - alturas de relieve imprimibles;
   - radios y repeticiones que no destruyan la malla.
4. Evitar:
   - self-intersections;
   - caras degeneradas;
   - booleans excesivas sin control de complejidad.
5. Mantener trabajo pesado fuera del hilo principal cuando ya exista worker apropiado.
6. Mantener `compile-preview` como heuristica mientras no exista compilacion real de OpenSCAD.

## Validacion Por Tipo De Cambio

### Cambio en `src/app/parametric/*`

- Ejecutar `npm run test`
- Ejecutar `npx vitest run src/app/parametric/__tests__/`
- Si cambia el contrato MCP asociado, ejecutar tambien:
  - `npm run docs:api:generate`
  - `npm run docs:api:check`

### Cambio en `src/app/engine/*`

- Aplicar `.agents/workflows/engine_testing_rule.md`
- Ejecutar `npx vitest run src/app/engine/__tests__/`
- Si tambien toca viewers o UI:
  - ejecutar `npm run test`
  - registrar smoke manual en `Editor`, `Relief` o `MakerWorld`

### Cambio en export, slicing o `GCODE`

- Validar orientacion, unidades y resultado fabricable.
- Ejecutar:
  - `npx vitest run src/app/engine/__tests__/`
  - `npm run test`
- Registrar evidencia funcional cuando cambie `3MF`, `STL` o `GCODE`.

### Cambio en `server/mcp-tools.ts` o contrato de tools internas

- Ejecutar:
  - `npm run test`
  - `npm run docs:api:generate`
  - `npm run docs:api:check`
- Aplicar `.agents/workflows/endpoint_security_validation_workflow.md`

## Anti-Patrones

No hacer esto:

1. Prometer `OBJ`, `SVG` o `F3D` como soportados sin codigo real.
2. Inferir soporte tecnico desde pricing copy, labels o backlog sin revisar engine o UI.
3. Cambiar convencion de ejes en un modulo sin migrar renderer, export y tests.
4. Introducir geometria con degeneraciones obvias sin agregar tests de borde.
5. Aumentar detalle (`$fn`, loops, booleans) sin respetar `draft/final`.
6. Bloquear el hilo principal con calculos pesados que ya viven mejor en worker.
7. Romper compatibilidad del pipeline `InstructionSpecV1` sin actualizar MCP, tests y handoff.

## Salidas Esperadas

Al cerrar un bloque con este skill, entregar:

1. Cambio tecnico concreto en SCAD, engine, surface, export o render.
2. Validaciones ejecutadas y resultado.
3. Impacto funcional:
   - geometria;
   - fabricacion FDM;
   - render o preview;
   - formatos;
   - MCP o API, segun aplique.
4. Riesgos abiertos:
   - performance;
   - degeneraciones;
   - soportes parciales;
   - orientacion de export;
   - deuda de formatos roadmap.
5. Proximo paso recomendado cuando el pedido requiera nueva familia, nuevo importador o hardening extra.
