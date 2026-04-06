---
id: advanced-3d-parametric-math-fdm
kind: skill
title: Matemáticas 3D paramétricas y FDM avanzadas
description: Skill experta para geometría computacional, transformaciones paramétricas, validez de malla y fabricabilidad FDM.
when_to_use:
  - Cuando el bloque toque geometría, topología, exportadores o edge cases de fabricación.
inputs:
  - src/app/engine/**
  - src/app/parametric/**
outputs:
  - Decisiones geométricas y de fabricabilidad seguras para el pipeline 3D.
validations:
  - npx vitest run src/app/engine/__tests__/
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - 3d
  - math
  - fdm
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
  - workflow:engine-testing
  - subagent:subagent-parametric-math-fdm
---

# Skill: advanced-3d-parametric-math-fdm

## Objetivo

Aplicar matematicas 3D avanzadas y geometria computacional para flujos parametricos complejos y salida confiable para impresion 3D FDM.

## Entradas tipicas

- Engine en `src/app/engine/`
- Generadores/transformaciones parametricas
- Export/import de formatos `.STL`, `.SVG`, `.SCAD`, `.OBJ`, `.3MF`, `.GCODE` y roadmap para `.F3D`

## Salidas esperadas

1. Transformaciones correctas (traslacion, rotacion, escala, matrices, ejes).
2. Geometria valida para export (sin degeneraciones criticas).
3. Parametros con rangos y defaults seguros para usuario.
4. Compatibilidad de salida con slicers FDM.

## Validaciones obligatorias

- `npx vitest run src/app/engine/__tests__/`
- Aplicar `.agents/workflows/engine_testing_rule.md`
- Si cambia comportamiento exportador, registrar evidencia funcional.

## Anti-patrones

- Cambios geometricos sin pruebas de edge cases.
- Unidades/convenciones de ejes inconsistentes entre modulos.
- Prometer formato soportado sin pipeline tecnico implementado.
