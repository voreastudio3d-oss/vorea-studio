---
id: ai-traceability
kind: rule
title: Trazabilidad y handoff entre IAs
description: Regla obligatoria de trazabilidad entre IAs y agentes para cambios funcionales o de comportamiento
when_to_use:
  - Cuando el cambio tenga impacto funcional, de comportamiento, API o flujo de usuario.
inputs:
  - ai_shared_plan.md
  - project_backlog.md
  - ai_handoff_YYYY-MM-DD.md
outputs:
  - Trazabilidad mínima consistente entre plan activo, backlog y handoff.
validations:
  - Revisar que las tres superficies estén alineadas sin duplicación obvia.
docs_to_update:
  - ai_shared_plan.md
  - project_backlog.md
  - ai_handoff_YYYY-MM-DD.md
tags:
  - base-required
  - governance
  - docs
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
  - workflow:agent-handoff-evidence
  - workflow:skill-review-upgrade
---

# Regla Obligatoria — Trazabilidad y Handoff entre IAs

## Alcance
Aplica a toda tarea con impacto funcional, de comportamiento de negocio, contrato API o flujo de usuario.

## Actualizaciones documentales obligatorias

1. `ai_shared_plan.md`
   - Registrar bloque ejecutado, estado y siguiente hito.

2. `project_backlog.md`
   - Reflejar estado real de ítems impactados y riesgos abiertos.

3. `ai_handoff_YYYY-MM-DD.md`
   - Registrar cambios concretos, validaciones, riesgos y siguiente paso recomendado.

## Condiciones de cierre

1. No cerrar la tarea sin actualización documental cuando haya impacto funcional.
2. Toda evidencia debe ser comprensible para otra IA sin contexto previo.
3. Mantener consistencia entre plan, backlog y handoff del día.

## Evidencia mínima en entrega

1. Qué cambió y por qué.
2. Qué se validó y con qué resultado.
3. Qué quedó pendiente o riesgoso.
4. Qué debe hacer la próxima IA.
