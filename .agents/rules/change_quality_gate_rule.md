---
id: change-quality-gate
kind: rule
title: Gate de calidad mínimo por cambio
description: Gate central bloqueante para calidad mínima obligatoria en cada cambio de código
when_to_use:
  - Ante cualquier cambio de código, configuración, contenido UI o locales.
inputs:
  - src/**
  - server/**
  - scripts/**
outputs:
  - Matriz mínima de validación obligatoria por tipo de cambio.
validations:
  - npm run test
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
  - workflow:change-validation-master
  - workflow:agent-handoff-evidence
---

# Regla Obligatoria — Gate de Calidad por Cambio (Bloqueante Estricto)

## Alcance
Aplica a todo cambio de código, configuración, rutas backend, contenido UI o textos i18n en este repositorio.

## Política
Ninguna tarea puede marcarse como cerrada si falta cualquiera de los checks obligatorios que corresponden al tipo de cambio.

## Requisitos mínimos por tipo de cambio

1. Cambio de código (cualquier capa):
   - Ejecutar `npm run test`.

2. Cambio frontend/UI:
   - Ejecutar `npm run test`.
   - Ejecutar el workflow [`ux_ui_review_workflow.md`](../workflows/ux_ui_review_workflow.md).
   - Ejecutar revisión i18n usando [`i18n_locale_sync_rule.md`](../workflows/i18n_locale_sync_rule.md).

3. Cambio backend sin rutas/contrato:
   - Ejecutar `npm run test`.
   - Ejecutar el workflow [`endpoint_security_validation_workflow.md`](../workflows/endpoint_security_validation_workflow.md).

4. Cambio backend con rutas/contrato:
   - Ejecutar `npm run test`.
   - Ejecutar `npm run docs:api:generate`.
   - Ejecutar `npm run docs:api:check`.
   - Ejecutar el workflow [`endpoint_security_validation_workflow.md`](../workflows/endpoint_security_validation_workflow.md).

5. Cambio sensible (auth, permisos, pagos, datos):
   - Ejecutar `npm run test`.
   - Aplicar [`auth_security_rule.md`](../workflows/auth_security_rule.md).
   - Ejecutar el workflow [`endpoint_security_validation_workflow.md`](../workflows/endpoint_security_validation_workflow.md).

## Evidencia obligatoria de cierre

1. Comandos corridos y resultado (pass/fail).
2. Impacto funcional/API.
3. Claves i18n agregadas o modificadas.
4. Referencia al handoff para otras IAs/agentes.

Formato obligatorio de evidencia:
- [`agent_handoff_evidence_workflow.md`](../workflows/agent_handoff_evidence_workflow.md)

## Incumplimiento
Si falta evidencia o falla un check obligatorio, el cambio debe permanecer en estado "En progreso" hasta completar validaciones.
