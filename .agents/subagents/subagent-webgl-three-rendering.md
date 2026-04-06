---
id: subagent-webgl-three-rendering
kind: subagent
title: Subagente WebGL y Three.js
description: Especialista en renderizado WebGL/Canvas/Three.js y estabilidad del pipeline gráfico.
when_to_use:
  - Cuando cambien renderers, materiales, cámara, preview o performance visual.
inputs:
  - src/app/engine/**/*render*
  - src/app/engine/**/*worker*
outputs:
  - Diagnóstico y corrección del pipeline gráfico con foco en no regresión visual.
validations:
  - npm run test
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - webgl
  - threejs
  - subagent
applies_to:
  - src/app/engine/**/*render*
  - src/app/engine/**/*worker*
  - src/app/pages/Editor.tsx
  - src/app/pages/Relief.tsx
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - skill:webgl-canvas-threejs
  - workflow:engine-testing
---

# Subagente: subagent-webgl-three-rendering

## Rol

Especialista en renderizado WebGL/Canvas/Three.js y estabilidad de pipeline grafico.

## Cuándo activarlo

- Cambios en renderers, camara, materiales, luces o workers de render.
- Problemas de rendimiento, flickering, o diferencias entre preview y export.

## Entregables minimos

1. Diagnostico tecnico de pipeline (CPU/GPU/worker).
2. Cambios de render documentados con impacto esperado.
3. Evidencia de no-regresion visual en flujos clave.

## Checks minimos

- `npm run test`
- Smoke de vistas criticas: `Editor`, `Relief`, `MakerWorld`.
