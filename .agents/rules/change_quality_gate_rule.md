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
  - workflow:change-validation-master
  - workflow:agent-handoff-evidence
---

# Regla Obligatoria — Gate de Calidad por Cambio (Bloqueante Estricto)

## Alcance
Aplica a todo cambio de código, configuración, rutas backend, contenido UI o textos i18n en este repositorio.

## Política
Ninguna tarea puede marcarse como cerrada si falta cualquiera de los checks obligatorios que corresponden al tipo de cambio.

## Norma específica para LLMs

Toda IA/LLM que complete una tarea en este repositorio debe ejecutar validaciones de testing antes de marcarla como finalizada.

Obligación mínima:

1. Si el cambio toca código productivo, ejecutar pruebas unitarias o de integración existentes que cubran el área afectada.
2. Si el cambio introduce lógica nueva, corrige un bug o altera comportamiento observable, agregar o ajustar tests unitarios/integración cuando corresponda.
3. Si el cambio afecta una superficie crítica o transversal, correr cobertura además del test base.
4. Si no existe un test razonable para el cambio, la IA debe dejarlo explícito en la evidencia de cierre y justificar por qué.

Una respuesta de cierre sin evidencia de tests aplicables debe considerarse incompleta.

## Requisitos mínimos por tipo de cambio

1. Cambio de código (cualquier capa):
   - Ejecutar `npm run test`.
   - Ejecutar `npm run typecheck`.

2. Cambio frontend/UI:
   - Ejecutar `npm run test`.
   - Ejecutar `npm run typecheck`.
   - Ejecutar `npm run test:coverage` cuando el cambio agregue o modifique lógica de componentes, stores, hooks, clientes API o estados UI no triviales.
   - Ejecutar el workflow [`ux_ui_review_workflow.md`](../workflows/ux_ui_review_workflow.md).
   - Ejecutar revisión i18n usando [`i18n_locale_sync_rule.md`](../workflows/i18n_locale_sync_rule.md).

3. Cambio backend sin rutas/contrato:
   - Ejecutar `npm run test`.
   - Ejecutar `npm run typecheck`.
   - Ejecutar `npm run test:coverage` cuando el cambio modifique reglas de negocio, servicios compartidos, persistencia, créditos, cálculos, seguridad o flujos con estado.
   - Ejecutar el workflow [`endpoint_security_validation_workflow.md`](../workflows/endpoint_security_validation_workflow.md).

4. Cambio backend con rutas/contrato:
   - Ejecutar `npm run test`.
   - Ejecutar `npm run typecheck`.
   - Ejecutar `npm run test:coverage` cuando el cambio altere lógica de endpoints, contratos, validaciones, mutaciones o integraciones de negocio.
   - Ejecutar `npm run docs:api:generate`.
   - Ejecutar `npm run docs:api:check`.
   - Ejecutar el workflow [`endpoint_security_validation_workflow.md`](../workflows/endpoint_security_validation_workflow.md).

5. Cambio sensible (auth, permisos, pagos, datos):
   - Ejecutar `npm run test`.
   - Ejecutar `npm run typecheck`.
   - Ejecutar `npm run test:coverage`.
   - Aplicar [`auth_security_rule.md`](../workflows/auth_security_rule.md).
   - Ejecutar el workflow [`endpoint_security_validation_workflow.md`](../workflows/endpoint_security_validation_workflow.md).

6. Cambio en tests o infraestructura de validación:
   - Ejecutar `npm run test`.
   - Ejecutar `npm run typecheck`.
   - Ejecutar `npm run test:coverage` si se cambió la lógica de suites, helpers de test, mocks compartidos o gates de calidad.

## Evidencia obligatoria de cierre

1. Comandos corridos y resultado (pass/fail).
2. Impacto funcional/API.
3. Claves i18n agregadas o modificadas.
4. Referencia al handoff para otras IAs/agentes.
5. Tests agregados/ajustados o justificación explícita de por qué no correspondía agregar tests.
6. Si aplicó cobertura: comando corrido y resultado observado.

Formato obligatorio de evidencia:
- [`agent_handoff_evidence_workflow.md`](../workflows/agent_handoff_evidence_workflow.md)

## Incumplimiento
Si falta evidencia o falla un check obligatorio, el cambio debe permanecer en estado "En progreso" hasta completar validaciones.
