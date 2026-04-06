---
id: ai-orchestration
kind: skill
title: Orquestación de IA, costos y fallback
description: Skill experta para routing de IA, control de presupuesto, trazabilidad, seguridad y fallback operativo.
when_to_use:
  - Cuando cambien endpoints IA, budgets, vaults o políticas de fallback/costo.
inputs:
  - server/**
  - src/app/services/**
outputs:
  - Flujo de IA gobernado por costos, límites y fallback observable.
validations:
  - npm run test
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - ai
  - orchestration
  - backend
  - governance
applies_to:
  - .agents/**
  - scripts/agents/**
  - server/**/*ai*
  - server/**/*vault*
  - src/app/services/**/*ai*
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:skill-review-upgrade
  - subagent:subagent-ai-orchestrator
---

# Skill: ai-orchestration

## Objetivo

Orquestar flujos de IA con control de costos, presupuesto, trazabilidad, seguridad y fallback operativo.

## Entradas tipicas

- Endpoints `/api/ai/*`, `/api/vault/*`
- Config de costos/creditos y limites por tier
- Integraciones con proveedores (Gemini, OpenAI, BYOK)

## Salidas esperadas

1. Flujo de ejecucion claro por etapa (input -> provider -> salida -> tracking).
2. Metricas y auditoria de uso/costo por usuario y sistema.
3. Guardrails para cuota y saturacion.
4. Fallbacks definidos para evitar corte de servicio.

## Validaciones obligatorias

- `npm run test`
- Validar no exponer secretos ni claves planas.
- Evidencia de costos, limites y comportamiento ante error.

## Anti-patrones

- Dependencia de un solo proveedor sin fallback.
- Cost tracking no atomico o sin auditoria.
- Mezclar UI de IA con logica critica de presupuesto en cliente.
