---
id: web-ts-services-postgres-headless-mcp
kind: skill
title: Fullstack TS, servicios, Postgres y MCP
description: Skill experta para frontend/backend TypeScript, servicios, PostgreSQL, servidores headless y contratos MCP.
when_to_use:
  - Cuando el bloque cruce cliente-servidor, contratos API, Postgres o MCP.
inputs:
  - server/**
  - src/app/services/**
  - prisma/**
outputs:
  - Contratos consistentes y capas de servicio alineadas entre frontend y backend.
validations:
  - npm run test
  - npm run docs:api:generate
  - npm run docs:api:check
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - fullstack
  - backend
  - postgres
  - mcp
applies_to:
  - server/**
  - src/app/services/**
  - prisma/**
  - scripts/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:endpoint-security-validation
  - subagent:subagent-fullstack-ts-services
---

# Skill: web-ts-services-postgres-headless-mcp

## Objetivo

Disenar, implementar y revisar cambios de arquitectura/app en TypeScript para frontend y backend con servicios, PostgreSQL, servidores headless y contratos MCP.

## Entradas tipicas

- Endpoints en `server/`
- Servicios en `src/app/services/`
- Schema y semantica de datos en `prisma/schema.prisma`
- Config de runtime/deploy (`Dockerfile`, `railway.json`, `netlify.toml`)

## Salidas esperadas

1. Contratos TS consistentes entre frontend y backend.
2. Acceso a datos alineado con Prisma/Postgres.
3. Endpoints hardenizados con auth/roles y validaciones.
4. Si hay MCP, contrato documentado y versionado.

## Validaciones obligatorias

- `npm run test`
- Si cambia contrato de rutas: `npm run docs:api:generate` + `npm run docs:api:check`
- Aplicar `.agents/workflows/endpoint_security_validation_workflow.md`

## Anti-patrones

- Importar codigo Node-only en bundle web.
- Duplicar contratos en multiples archivos sin fuente de verdad.
- Romper compatibilidad de schema sin plan de migracion.
