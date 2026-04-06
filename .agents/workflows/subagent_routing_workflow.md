---
id: subagent-routing
kind: workflow
title: Selección y coordinación de subagentes
description: Workflow para seleccionar, coordinar y consolidar subagentes por dominio tecnico
when_to_use:
  - Cuando una tarea cruce varios dominios técnicos o requiera delegación controlada.
inputs:
  - .agents/subagents/**
  - .agents/skills_catalog/**
outputs:
  - Lead subagent, colaboradores y paquete de handoff bien definido.
validations:
  - Confirmar un líder y un paquete de handoff por subagente.
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - governance
  - routing
applies_to:
  - src/**
  - server/**
  - scripts/**
  - .agents/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:skill-review-upgrade
  - workflow:change-validation-master
---

# Workflow - Subagent Routing

## Objetivo

Asignar correctamente skills y subagentes para cambios complejos, reduciendo riesgo de regresion y mejorando velocidad de ejecucion.

## Paso 1 - Clasificar la tarea

Asignar uno o mas dominios:

- TS/services/API
- Postgres/Prisma/headless server
- MCP/integraciones tools
- IA/orquestacion/presupuesto
- UX/UI/CSS/i18n
- 3D parametrico/math/FDM
- WebGL/Canvas/Three.js

## Paso 2 - Elegir subagente lider

Regla:
- 1 lider obligatorio.
- 0..2 colaboradores segun impacto real.

Mapeo rapido:

1. TS/services/API -> `subagent-fullstack-ts-services`
2. MCP/headless integration -> `subagent-mcp-headless-integration`
3. IA/orquestacion -> `subagent-ai-orchestrator`
4. UX/UI/CSS -> `subagent-ux-ui-layout`
5. 3D parametric/math/FDM -> `subagent-parametric-math-fdm`
6. WebGL/Canvas/Three -> `subagent-webgl-three-rendering`

## Paso 3 - Paquete de handoff entre subagentes

Cada subagente debe entregar:

1. Contexto de entrada (archivo/ruta/flujo).
2. Decisiones tecnicas tomadas.
3. Riesgos abiertos.
4. Validaciones corridas y resultado.
5. Proximo paso recomendado.

## Paso 4 - Consolidacion final

El agente integrador debe:

1. Aplicar `.agents/rules/change_quality_gate_rule.md`.
2. Aplicar `.agents/workflows/change_validation_master_workflow.md`.
3. Registrar trazabilidad en:
   - `ai_shared_plan.md`
   - `project_backlog.md`
   - `ai_handoff_YYYY-MM-DD.md`
4. Reflejar la selección en `.agents/runtime/current_block.yaml`.

## Criterio de cierre

Sin subagente lider identificado, sin validaciones obligatorias o sin evidencia de handoff, la tarea no se considera cerrada.
