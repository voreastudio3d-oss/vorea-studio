---
id: engine-testing
kind: workflow
title: Testing obligatorio para el engine 3D
description: Regla obligatoria de testing para el motor 3D (src/app/engine/)
when_to_use:
  - Cuando cambien módulos del engine, exporters, parsers o workers geométricos.
inputs:
  - src/app/engine/**
outputs:
  - Cobertura mínima del engine y no regresión en edge cases geométricos.
validations:
  - npx vitest run src/app/engine/__tests__/
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - 3d
  - engine
  - validation
applies_to:
  - src/app/engine/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:subagent-routing
  - skill:advanced-3d-parametric-math-fdm
---

## Regla de Desarrollo — Testing del Motor 3D

### Alcance
Aplica a toda modificación, adición o refactor de archivos dentro de `src/app/engine/` y sus subdirectorios (surface-modes, workers, exporters, interpreters, etc.).

### Requisitos Obligatorios

1. **Test obligatorio por cambio:**
   Toda modificación a un módulo del engine **DEBE** incluir o actualizar tests correspondientes en `src/app/engine/__tests__/`.

2. **Cobertura mínima por módulo nuevo:**
   Si se crea un módulo nuevo (exportador, modo de superficie, generador), debe incluir al menos:
   - 1 test para el **happy path** (entrada válida produce salida esperada).
   - 1 test para un **caso borde** (entrada vacía, valores extremos, geometría degenerada).

3. **No romper tests existentes:**
   Antes de cerrar cualquier tarea que toque el engine, el agente **DEBE** ejecutar:
   `
   npx vitest run src/app/engine/__tests__/
   `
   Y verificar que **todos** los tests existentes pasen (actualmente: complexity, csg, llavero-debug, scad-interpreter).

4. **Workers con cobertura:**
   Los Web Workers (`csg-worker.ts`, `relief-worker.ts`) deben testearse con mocks de `postMessage`. No se permite modificar workers sin cobertura de test.

5. **Rendimiento perceptible:**
   Si un cambio en el engine afecta tiempos de renderizado o procesamiento, documentar en el PR/commit el impacto aproximado en milisegundos.

### Checklist para el Agente de IA
- [ ] ¿Se agregaron/actualizaron tests en `__tests__/`?
- [ ] ¿Se ejecutó `npx vitest run` y todos los tests pasan?
- [ ] ¿Los workers modificados tienen cobertura?
- [ ] ¿Se documentó impacto de rendimiento si aplica?
