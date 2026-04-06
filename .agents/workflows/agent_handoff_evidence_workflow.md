---
id: agent-handoff-evidence
kind: workflow
title: Cierre documental y evidencia para IAs
description: Workflow obligatorio de evidencia y handoff para que otras IAs/agentes continúen sin pérdida de contexto
when_to_use:
  - Al cerrar cualquier bloque con impacto funcional o técnico relevante.
inputs:
  - ai_handoff_YYYY-MM-DD.md
  - ai_shared_plan.md
  - project_backlog.md
outputs:
  - Handoff reutilizable por otras IAs o agentes sin pérdida de contexto.
validations:
  - Confirmar que el handoff incluya cambios, validaciones, riesgos y siguiente paso.
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - base-required
  - docs
  - governance
applies_to:
  - src/**
  - server/**
  - scripts/**
  - .agents/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - rule:ai-traceability
  - workflow:post-commit-review
---

# Workflow — Cierre Documental y Evidencia para IAs

## Objetivo
Dejar un registro mínimo, consistente y reutilizable por otras IAs/agentes.

## Reglas de fuente de verdad

1. `project_backlog.md` solo registra estado/prioridad.
2. `ai_shared_plan.md` solo registra ejecución activa.
3. `ai_handoff_YYYY-MM-DD.md` solo registra delta, evidencia y siguiente paso del día.
4. Antes de cerrar un bloque, revisar `.agents/runtime/current_block.yaml` y usarlo como contexto mínimo del handoff.

## Plantilla obligatoria de evidencia

1. Resumen de cambios:
   - Qué se cambió.
   - Por qué se cambió.

2. Validaciones ejecutadas:
   - Comandos corridos.
   - Resultado por comando (pass/fail).

3. Impacto funcional/API:
   - Flujos o comportamiento impactado.
   - Endpoints/contratos impactados (si aplica).

4. i18n:
   - Claves agregadas/modificadas/eliminadas.
   - Confirmación de sincronización de locales.

5. Riesgos y pendientes:
   - Riesgos abiertos.
   - Siguiente paso recomendado.

6. Ruta agentica usada:
   - workflows seleccionados;
   - skills/subagentes líderes;
   - documentos de trazabilidad actualizados.

## Trazabilidad obligatoria
Cuando el cambio sea funcional o de comportamiento, actualizar:
- `ai_shared_plan.md`
- `project_backlog.md`
- `ai_handoff_YYYY-MM-DD.md`

Referencia normativa:
- [`ai_traceability_rule.md`](../rules/ai_traceability_rule.md)

## Criterio de cierre
Sin esta evidencia, la tarea no está lista para cierre.
