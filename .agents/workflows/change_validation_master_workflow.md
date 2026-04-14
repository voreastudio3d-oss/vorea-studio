---
id: change-validation-master
kind: workflow
title: Workflow maestro de validación por tipo de cambio
description: Workflow maestro bloqueante para seleccionar y ejecutar validaciones por tipo de cambio
when_to_use:
  - En todo bloque antes de decidir qué checks y workflows correr.
inputs:
  - src/**
  - server/**
  - scripts/**
outputs:
  - Matriz consistente de validaciones según el tipo de cambio.
validations:
  - npm run test
  - npm run typecheck
  - npm run test:coverage (cuando corresponda)
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - base-required
  - validation
  - governance
applies_to:
  - src/**
  - server/**
  - scripts/**
  - utils/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - rule:change-quality-gate
  - workflow:subagent-routing
---

# Workflow Maestro — Validación por Tipo de Cambio

## Objetivo
Aplicar un flujo único y bloqueante para decidir qué validaciones correr según el tipo de cambio.

## Paso 1 — Clasificar el cambio
Clasificar la tarea en una o más categorías:
- UI/frontend
- Backend sin cambio de rutas
- Backend con cambio de rutas/contrato
- Cambio sensible (auth/permisos/pagos/datos)
- i18n/contenido

Si la tarea cruza multiples dominios tecnicos, aplicar tambien:
- [`subagent_routing_workflow.md`](./subagent_routing_workflow.md)

## Paso 2 — Ejecutar matriz de validación

| Escenario | Validaciones obligatorias |
|---|---|
| UI/frontend | `npm run test` + `npm run typecheck` + `npm run test:coverage` cuando haya lógica no trivial + [`ux_ui_review_workflow.md`](./ux_ui_review_workflow.md) + [`i18n_locale_sync_rule.md`](./i18n_locale_sync_rule.md) |
| Backend sin rutas | `npm run test` + `npm run typecheck` + `npm run test:coverage` cuando cambie lógica de negocio/servicios + [`endpoint_security_validation_workflow.md`](./endpoint_security_validation_workflow.md) |
| Backend con rutas/contrato | `npm run test` + `npm run typecheck` + `npm run test:coverage` cuando cambie lógica/contrato + `npm run docs:api:generate` + `npm run docs:api:check` + [`endpoint_security_validation_workflow.md`](./endpoint_security_validation_workflow.md) |
| Auth/pagos/permisos/datos | `npm run test` + `npm run typecheck` + `npm run test:coverage` + [`auth_security_rule.md`](./auth_security_rule.md) + [`endpoint_security_validation_workflow.md`](./endpoint_security_validation_workflow.md) |
| i18n/contenido | `npm run test` + `npm run typecheck` + [`i18n_locale_sync_rule.md`](./i18n_locale_sync_rule.md) + [`i18n_admin_content_rule.md`](./i18n_admin_content_rule.md) |
| Feature/Flujo impactados | [`docs_update_sync_rule.md`](./docs_update_sync_rule.md) |

## Paso 2 bis — Regla de cierre para LLMs

Antes de declarar una tarea como terminada, toda IA debe responder estas preguntas:

1. ¿Corrí `npm run test`?
2. ¿Corrí `npm run typecheck`?
3. ¿Este cambio requería tests nuevos o ajuste de tests existentes?
4. ¿Este cambio requería `npm run test:coverage` por tocar lógica crítica, transversal o sensible?

Si cualquiera de las respuestas aplicables es "no", la tarea no debe cerrarse como finalizada sin justificación explícita.

## Paso 3 — Reglas normativas transversales
Aplicar siempre:
- [`change_quality_gate_rule.md`](../rules/change_quality_gate_rule.md)
- [`db_migration_rule.md`](../rules/db_migration_rule.md) al modificar esquemas o tipos de BD.
- [`api_docs_route_sync_rule.md`](../rules/api_docs_route_sync_rule.md) cuando cambien rutas/contratos
- [`ai_traceability_rule.md`](../rules/ai_traceability_rule.md)

## Paso 4 — Evidencia de cierre
Documentar resultado con plantilla de:
- [`agent_handoff_evidence_workflow.md`](./agent_handoff_evidence_workflow.md)

## Resultado esperado
La tarea queda cerrada solo si:
1. Pasan todos los checks aplicables.
2. Se entrega evidencia completa.
3. Se actualiza trazabilidad para otras IAs/agentes cuando corresponde.
4. Queda explícito si se añadieron/ajustaron tests unitarios o por qué no correspondía hacerlo.
