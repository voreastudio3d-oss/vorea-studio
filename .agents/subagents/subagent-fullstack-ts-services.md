---
id: subagent-fullstack-ts-services
kind: subagent
title: Subagente fullstack TS y servicios
description: Líder técnico para cambios frontend/backend TypeScript, servicios y contratos API.
when_to_use:
  - Cuando el bloque toque flujo completo cliente-servidor o contratos compartidos.
inputs:
  - server/**
  - src/app/services/**
outputs:
  - Integración fullstack consistente entre request, response y tipos compartidos.
validations:
  - npm run test
  - npm run docs:api:generate
  - npm run docs:api:check
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - fullstack
  - backend
  - subagent
applies_to:
  - server/**
  - src/app/services/**
  - prisma/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - skill:web-ts-services-postgres-headless-mcp
  - workflow:subagent-routing
---

# Subagente: subagent-fullstack-ts-services

## Rol

Lider tecnico para cambios de frontend/backend TypeScript y servicios compartidos.

## Cuándo activarlo

- Cambios en `src/app/services/`, `server/`, contratos API o tipos compartidos.
- Refactors que toquen flujo completo cliente-servidor.

## Entregables minimos

1. Contrato consistente entre request/response y tipos TS.
2. Riesgos de regresion listados por endpoint/flujo.
3. Resultado de tests y validaciones aplicables.

## Checks minimos

- `npm run test`
- `npm run docs:api:generate` + `npm run docs:api:check` si aplica.
