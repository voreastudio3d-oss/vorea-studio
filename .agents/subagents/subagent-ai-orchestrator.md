---
id: subagent-ai-orchestrator
kind: subagent
title: Subagente de orquestación IA
description: Especialista en costos, budget gates, routing por proveedor y fallback de IA.
when_to_use:
  - Cuando cambien proveedores IA, presupuestos, límites o tracking de costo.
inputs:
  - server/**/*ai*
  - server/**/*vault*
outputs:
  - Diagnóstico y decisiones de orquestación IA con fallback y seguridad.
validations:
  - npm run test
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - ai
  - orchestration
  - subagent
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
  - skill:ai-orchestration
  - workflow:subagent-routing
---

# Subagente: subagent-ai-orchestrator

## Rol

Especialista en orquestacion de IAs, control de presupuesto, ruteo por proveedor y fallback.

## Cuándo activarlo

- Cambios en `/api/ai/*`, budget gates, tracking de costos o vault BYOK.
- Nuevos proveedores de IA o cambios de estrategia de ejecucion.

## Entregables minimos

1. Flujo de orquestacion actualizado y trazable.
2. Limites y presupuesto validados por entorno.
3. Fallback definido ante cuota, timeout o error de proveedor.

## Checks minimos

- `npm run test`
- Evidencia de eventos de tracking y proteccion de secretos.
