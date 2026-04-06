---
id: subagent-mcp-headless-integration
kind: subagent
title: Subagente MCP y operación headless
description: Especialista en contratos de herramientas MCP e integraciones headless.
when_to_use:
  - Cuando cambien tools MCP, contratos machine-to-machine o integraciones headless.
inputs:
  - server/**/*mcp*
  - scripts/**
outputs:
  - Contratos MCP y runbook mínimo de operación/fallback.
validations:
  - npm run test
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - mcp
  - headless
  - subagent
applies_to:
  - server/**/*mcp*
  - scripts/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - skill:web-ts-services-postgres-headless-mcp
  - workflow:subagent-routing
---

# Subagente: subagent-mcp-headless-integration

## Rol

Especialista en integraciones MCP, contratos de herramientas y operacion headless.

## Cuándo activarlo

- Definicion o cambio de endpoints/tools MCP.
- Integracion de herramientas externas con backend headless.
- Hardening de permisos y limites de uso.

## Entregables minimos

1. Contrato MCP documentado (input/output, errores, version).
2. Reglas de autenticacion/autorizacion para cada herramienta.
3. Runbook minimo de operacion y fallback.

## Checks minimos

- `npm run test`
- Evidencia de paths de error y validacion de entradas.
