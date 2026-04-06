---
id: webgl-canvas-threejs
kind: skill
title: Render WebGL, Canvas y Three.js
description: Skill experta para renderizado 2D/3D, workers y rendimiento visual con WebGL, Canvas y Three.js.
when_to_use:
  - Cuando cambien renderers, previews o problemas de performance gráfica.
inputs:
  - src/app/engine/**
  - src/app/pages/**
outputs:
  - Pipeline visual estable y fiel entre preview y export.
validations:
  - npm run test
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - webgl
  - threejs
  - render
applies_to:
  - src/app/engine/**/*render*
  - src/app/engine/**/*worker*
  - src/app/pages/Editor.tsx
  - src/app/pages/Relief.tsx
  - src/app/pages/MakerWorld.tsx
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:engine-testing
  - subagent:subagent-webgl-three-rendering
---

# Skill: webgl-canvas-threejs

## Objetivo

Desarrollar y optimizar renderizado 3D/2D con WebGL, Canvas y Three.js para una experiencia fluida y fiel al modelo.

## Entradas tipicas

- `src/app/engine/threejs-renderer.ts`
- `src/app/engine/mesh-renderer.ts`
- Workers de procesamiento (`csg-worker.ts`, `relief-worker.ts`)

## Salidas esperadas

1. Pipeline de render estable en desktop y mobile.
2. Controles de camara/escena coherentes.
3. Uso correcto de workers para cargas pesadas.
4. Export/preview sin desalineacion visual.

## Validaciones obligatorias

- `npm run test`
- Pruebas de smoke visual en vistas criticas (`Editor`, `Relief`, `MakerWorld`)
- Evidencia de no-regresion funcional en render/export

## Anti-patrones

- Bloquear hilo principal con calculos pesados.
- Cambiar convenciones de ejes sin migracion completa.
- Introducir regresiones de performance sin medir impacto.
