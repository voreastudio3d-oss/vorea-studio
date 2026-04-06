---
id: multi-llm-specialization-routing
kind: workflow
title: Routing de tareas por especialización LLM
description: Workflow para asignar bloques a Gemini, Claude, OpenAI/GPT y Codex según tipo de problema, evidencia requerida y nivel de implementación.
when_to_use:
  - Cuando un bloque combine estrategia, backend, seguridad, i18n, marketing o análisis multi-área y haya que decidir qué LLM lidera cada parte.
inputs:
  - .agents/runtime/**
  - .agents/skills_catalog/**
  - .agents/workflows/**
outputs:
  - Asignación explícita por LLM con líder, apoyo y criterio de handoff.
validations:
  - Confirmar un líder por bloque y una razón explícita basada en fortalezas reales del LLM.
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - governance
  - llm
  - routing
applies_to:
  - .agents/**
  - src/**
  - server/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:subagent-routing
  - workflow:skill-review-upgrade
---

# Workflow - Multi LLM Specialization Routing

## Objetivo

Asignar cada bloque al LLM que más valor aporta, evitando delegación “por intuición” o por costumbre.

## Matriz base

### Gemini

Usar como líder cuando el bloque sea:

- infraestructura;
- bases de datos;
- storage;
- costos operativos;
- latencia, throughput y escala;
- bugs de backend profundo;
- **implementación de UX/UI en código** (React, CSS, animaciones, breakpoints).

### Claude

Usar como líder cuando el bloque sea:

- seguridad;
- auth;
- pagos;
- compliance;
- contratos backend estrictos;
- validación dura de arquitectura;
- **UX crítico con restricciones técnicas** (flows de auth, checkout, estados de error, accesibilidad, copy de alta precisión).

### OpenAI / GPT

Usar como líder cuando el bloque sea:

- estrategia de producto;
- síntesis inter-área;
- marketing;
- localización cultural;
- copy;
- definición de mercado;
- **diseño conceptual de UX/UI** (jerarquía de información, wireframing, naming, propuestas de layout, copy emocional).

### Codex

Usar como líder cuando el bloque sea:

- implementación real en repo;
- integración full-stack;
- aterrizaje técnico de decisiones;
- documentación gobernada y cierre operativo.

### Resumen — dominio UX/UI

| Fase | Líder recomendado | Motivo |
|---|---|---|
| Diseño conceptual / wireframing | GPT-4o | Síntesis visual, jerarquía, copy emocional |
| UX de auth / checkout / errores | Claude | Razona sobre fricción, consecuencias y accesibilidad |
| Implementación React/CSS | Gemini | Traduce diseño a componentes con estado, breakpoints y animaciones |
| Cierre en repo + docs | Codex | Integración, types compartidos y cierre gobernado |

## Regla práctica

1. Estrategia primero:
   - OpenAI/GPT o Gemini según el problema.
2. Riesgo técnico/security:
   - Claude o Gemini revisan.
3. Ejecución y cierre en repo:
   - Codex integra, valida y documenta.

## Criterio de cierre

No se considera buena delegación si:

- no hay líder claro;
- el motivo de elección no está documentado;
- o el handoff no deja evidencias reusables para el siguiente LLM.
