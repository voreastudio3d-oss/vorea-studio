---
id: api-docs-route-sync
kind: rule
title: Paridad de documentación API y rutas
description: Regla obligatoria para sincronizar documentación API cuando cambian rutas o contratos backend
when_to_use:
  - Cuando cambien rutas, contratos, payloads o respuestas públicas del backend.
inputs:
  - server/**
  - public/openapi.json
  - docs/api/**
outputs:
  - OpenAPI y paridad de rutas sincronizadas con el código real.
validations:
  - npm run docs:api:generate
  - npm run docs:api:check
docs_to_update:
  - public/openapi.json
  - ai_handoff_YYYY-MM-DD.md
tags:
  - backend
  - api
  - docs
applies_to:
  - server/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:endpoint-security-validation
  - workflow:change-validation-master
---

# Regla Obligatoria — Sincronización de Docs API por Cambio de Rutas

## Alcance
Aplica cuando una tarea modifica al menos uno de estos elementos:
- Alta o baja de endpoint HTTP.
- Cambio de método, path, query params, payload o response de una ruta existente.
- Cambio de validaciones/códigos de error que alteren el contrato público.

No aplica a cambios internos de backend que no alteren contrato de endpoint.

## Comandos obligatorios
Al detectar cambios de rutas/contrato, ejecutar exactamente:

```bash
npm run docs:api:generate
npm run docs:api:check
```

## Criterios de aceptación

1. Ambos comandos deben terminar en éxito.
2. La documentación generada debe quedar consistente con las rutas reales.
3. Si `docs:api:check` falla, no se puede cerrar la tarea.

## Evidencia requerida

1. Confirmación explícita de ejecución de ambos comandos.
2. Resultado de cada comando (pass/fail).
3. Resumen breve de rutas/contratos afectados.
