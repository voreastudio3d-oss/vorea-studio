---
id: endpoint-security-validation
kind: workflow
title: Validación de endpoints y seguridad
description: Workflow obligatorio para validar endpoints, seguridad y contrato API en cambios backend
when_to_use:
  - Cuando cambien endpoints, handlers o capas que impacten el backend HTTP.
inputs:
  - server/**
outputs:
  - Contrato de endpoint, seguridad y errores revisados antes del cierre.
validations:
  - npm run test
  - npm run docs:api:generate
  - npm run docs:api:check
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - backend
  - api
  - security
applies_to:
  - server/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:auth-security
  - rule:api-docs-route-sync
---

# Workflow — Validación de Endpoints + Seguridad

## Alcance
Aplicar a cambios en `server/` o en cualquier capa que impacte endpoints.

## Paso 1 — Contrato del endpoint

1. Confirmar método y path final del endpoint.
2. Confirmar payload de entrada y response esperada.
3. Confirmar códigos de error relevantes (4xx/5xx esperables).

## Paso 2 — Seguridad server-side

1. Validar autenticación en rutas protegidas.
2. Validar autorización por rol cuando aplique.
3. Validar sanitización/whitelist de inputs.
4. Confirmar que no se expongan datos sensibles.

Referencia obligatoria:
- [`auth_security_rule.md`](./auth_security_rule.md)

## Paso 3 — Trigger de docs API
Si cambió ruta o contrato de endpoint, ejecutar:

```bash
npm run docs:api:generate
npm run docs:api:check
```

Referencia normativa:
- [`api_docs_route_sync_rule.md`](../rules/api_docs_route_sync_rule.md)

## Paso 4 — Validación mínima de backend
Ejecutar:

```bash
npm run test
```

Si hay tests específicos de integración relacionados, ejecutarlos también.

## Evidencia obligatoria

1. Endpoints tocados (método + path).
2. Resultado de validaciones de auth/roles/input.
3. Resultado de `docs:api:*` cuando aplique.
4. Resultado de pruebas corridas.
