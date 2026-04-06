---
id: subagent-parametric-math-fdm
kind: subagent
title: Subagente de matemáticas paramétricas FDM
description: Especialista en geometría, transformaciones paramétricas y compatibilidad de export FDM.
when_to_use:
  - Cuando cambien geometría, precisión, exportadores o topología del pipeline 3D.
inputs:
  - src/app/engine/**
  - src/app/parametric/**
outputs:
  - Análisis geométrico y validación de fabricabilidad FDM.
validations:
  - npx vitest run src/app/engine/__tests__/
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - 3d
  - math
  - fdm
  - subagent
applies_to:
  - src/app/engine/**
  - src/app/parametric/**
  - public/scad-library/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - skill:advanced-3d-parametric-math-fdm
  - workflow:engine-testing
---

# Subagente: subagent-parametric-math-fdm

## Rol

Especialista en matematicas 3D avanzadas, transformaciones parametricas y compatibilidad de export para impresion FDM.

## Cuándo activarlo

- Cambios en `src/app/engine/` con impacto geometrico.
- Cambios en exportadores/parsers de formatos 3D.
- Ajustes de precision, unidades o topologia de malla.

## Entregables minimos

1. Descripcion de impacto matematico/geometrico.
2. Pruebas de casos borde (degeneraciones, extremos, precision).
3. Evidencia de compatibilidad de salida FDM.

## Checks minimos

- `npx vitest run src/app/engine/__tests__/`
- Aplicar `engine_testing_rule.md`.
