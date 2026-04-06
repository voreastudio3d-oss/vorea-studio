---
name: vorea-parametric-scad-products
id: vorea-parametric-scad-products
kind: skill
title: Vorea SCAD product families
description: 'Repo-specific skill for designing printable SCAD product families for Vorea Studio. Use when Codex must research, define, or implement product-oriented parametric templates backed by `public/scad-library`, OpenSCAD, BOSL2, and FDM product heuristics across `src/app/parametric/*`, `src/app/pages/AIStudio.tsx`, `src/app/pages/Editor.tsx`, and `public/scad-library/*`.'
when_to_use:
  - Cuando el pedido sea diseñar o implementar familias de producto SCAD orientadas a Studio/FDM.
inputs:
  - src/app/parametric/**
  - src/app/pages/AIStudio.tsx
  - src/app/pages/Editor.tsx
  - public/scad-library/**
outputs:
  - Familias de producto imprimible parametrizadas y templates reutilizables para Studio.
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
  - products
  - bosl2
applies_to:
  - src/app/parametric/**
  - src/app/models/**
  - src/app/pages/AIStudio.tsx
  - src/app/pages/Editor.tsx
  - public/scad-library/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - skill:advanced-3d-parametric-math-fdm
  - subagent:subagent-parametric-math-fdm
---

# Vorea Parametric Scad Products

## Overview

Usar este skill cuando el pedido no sea solo "hacer geometria", sino construir o expandir una familia de producto parametrico lista para FDM y con potencial real para `Studio`.

Este skill trabaja en la interseccion de:

- diseno industrial;
- OpenSCAD parametrico;
- BOSL2 como libreria de producto;
- tendencias de catalogo imprimible;
- y templates reutilizables para `/studio`.

Leer estas referencias antes de prometer una familia nueva:

- `references/technique-map.md`
- `references/studio-template-map.md`
- `docs/research/parametric-scad-product-opportunities-2026-03.md`

## Trigger Examples

Activar este skill ante pedidos como:

- "crear nuevos templates para Studio"
- "investiga productos 3D tendencia que podamos parametrizar"
- "quiero una familia de organizers, planters o lamp shades"
- "usa BOSL2 para hacer productos mas organicos"
- "convirtamos la scad-library en seeds para el catalogo parametrico"
- "disena un producto imprimible que se pueda vender"

Si el pedido es sobre relief, `surface()` raster, preview WebGL o export FDM sin foco en producto, usar tambien o en su lugar:

- `.agents/codex-skills/vorea-parametric-scad-surface/SKILL.md`

## Capacidades y base real del repo

Semillas actuales verificadas en `public/scad-library/models/`:

- `vorea-storage-bin`
- `vorea-phone-stand`
- `vorea-nameplate`
- `vorea-cable-clip`
- `vorea-honeycomb-coaster`
- `vorea-spiral-vase`
- `vorea-wall-hook`
- `vorea-Soporte_para_macetas`

Familias parametrico-IA ya existentes:

- `fdm`: `storage-box`, `phone-stand`, `utility-hook`
- `organic`: `vase-wave`, `lamp-shell`, `decorative-tower`

Templates built-in del editor hoy:

- `gridfinity`
- `cable`
- `box`
- `phone`

Interpretar esto como una plataforma inicial ya funcional, no como catalogo terminado.

## Tesis de producto para Vorea

Priorizar familias que cumplan al menos tres condiciones:

1. Valor util inmediato:
   - organizer, stand, holder, planter, jar, lamp shell, label.
2. Parametrizacion visible:
   - tamano, slots, angulos, texto, patrones, fit, thread, kit seat.
3. Fabricabilidad FDM:
   - pocas piezas;
   - soporte minimo;
   - tolerancias razonables;
   - preview clara.

Evitar empezar por:

- criaturas artisticas complejas;
- meshes organicas que dependan de sculpting manual;
- articulados muy finos sin una gramatica modular bien controlada.

## Familias recomendadas

### Ola 1

- `drawer-organizer-tray`
- `cable-dock-strip`
- `phone-dock-pro`
- `wall-hook-plus`
- `nameplate-pro`
- `planter-drip-system`
- `lamp-shade-kit`
- `threaded-jar`

### Ola 2

- `stackable-desktop-bin`
- `coaster-diffuser`
- `ribbed-planter`
- `headphone-hanger`
- `peg-label-system`
- `kit-enclosure-shell`

### Experimental

- `metaball-diffuser`
- `organic-pen-cup`
- `articulated-desk-toy`

## Routing tecnico por tipo de producto

### Organizadores, bins y trays

Preferir:

- OpenSCAD nativo;
- `difference` para vaciados;
- `offset` y rounded corners controlados;
- BOSL2 `attachments` cuando haya modulos apilables o encastrables.

Base sugerida:

- `vorea-storage-bin`
- `vorea-cable-clip`

### Hooks, mounts, stands y holders

Preferir:

- `hull`;
- fillets fuertes;
- BOSL2 `hooks`, `attachments`, `masks`, `offset_sweep`.

Base sugerida:

- `vorea-wall-hook`
- `vorea-phone-stand`

### Planters, jars y objetos de hogar

Preferir:

- `rotate_extrude`;
- `linear_extrude` con perfiles limpios;
- BOSL2 `threading` para tapas;
- `skin()` o `path_sweep()` para ribs o shells.

Base sugerida:

- `vorea-Soporte_para_macetas`
- `vorea-spiral-vase`

### Lamp shades, diffusers y organicos controlados

Preferir:

- `skin()`;
- `path_sweep()`;
- `textures`;
- `surface()` solo cuando el efecto visual lo justifique;
- `isosurface/metaballs` para piezas de firma, no para catalogo base.

Base sugerida:

- `lamp-shell`
- `vase-wave`
- `vorea-honeycomb-coaster`

### Nameplates, labels y signage

Preferir:

- `linear_extrude`;
- texto parametrico;
- icon slots;
- bordes redondeados;
- snaps o soportes simples.

Base sugerida:

- `vorea-nameplate`

## Parametros que suelen funcionar bien

Mantener la UI entre 5 y 12 parametros visibles por template cuando sea posible.

Tipos de parametros fuertes:

- `width`, `depth`, `height`
- `wallThickness`, `floorThickness`
- `slotCount`, `cellCount`
- `angle`, `reach`, `overhangLimit`
- `diameter`, `clearance`, `fit`
- `patternDensity`, `ribCount`
- `text`, `labelStyle`, `iconSlot`
- `threadPitch`, `lidStyle`, `knurlDepth`
- `kitSeatDiameter`, `mountType`

## Heuristicas de diseno industrial

1. Disenar para una foto/listing clara:
   - escritorio;
   - hogar;
   - taller;
   - educacion;
   - regalo personalizado.
2. Exponer el beneficio en el propio nombre de la familia.
3. Separar:
   - nucleo funcional;
   - lenguaje visual.
4. Ofrecer defaults que impriman bien con boquilla `0.4`.
5. Usar BOSL2 para calidad y ensamblaje, no para inflar complejidad.
6. Si hay hardware externo, parametrizar el asiento.
7. En familias premium, invertir en fillets y tactilidad.

## Como convertir `scad-library` en templates para Studio

Al proponer o implementar una familia nueva:

1. Buscar primero si una semilla actual ya cubre el 60% del caso.
2. Definir el nuevo `familyHint` solo despues de fijar:
   - intent;
   - parametros;
   - restricciones;
   - defaults imprimibles.
3. Mantener un mapeo claro entre:
   - semilla SCAD;
   - familia parametrica;
   - preset para AI Studio;
   - template visible en Editor.
4. Si la familia todavia es exploratoria, dejarla en doc/reference y no prometerla en UI.

## Anti-patrones

No hacer esto:

1. Crear familias puramente "bonitas" sin caso de uso claro.
2. Llevar `minkowski` o metaballs a modelos grandes por defecto.
3. Hacer plantillas dependientes de un unico kit o unica impresora.
4. Mezclar demasiados parametros geometricos de bajo nivel en UI.
5. Tratar articulados complejos como primera linea del catalogo parametrico.
6. Ignorar clearances o orientacion de impresion.

## Salidas esperadas

Al cerrar un bloque con este skill, entregar:

1. Familia o grupo de familias claramente nombradas.
2. Semilla `scad-library` o base tecnica identificada.
3. Parametros minimos, defaults y constraints.
4. Tecnica recomendada:
   - OpenSCAD nativo;
   - BOSL2;
   - o mezcla.
5. Impacto en `Studio`:
   - `familyHint`;
   - generador;
   - preset;
   - template;
   - docs.
6. Validaciones o riesgos abiertos.
