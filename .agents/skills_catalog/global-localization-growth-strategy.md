---
id: global-localization-growth-strategy
kind: skill
title: Estrategia global de localización, marketing y growth
description: Skill para alinear Vorea Studio con idiomas, culturas y mercados distintos, incluyendo copy, toolstack de growth y señal analítica.
when_to_use:
  - Cuando el pedido trate marketing por región, localización profunda, campañas por idioma, CRM o analítica de crecimiento.
inputs:
  - src/app/locales/**
  - src/app/pages/**/*Landing*.tsx
  - docs/**
  - .agents/runtime/**
outputs:
  - Marco claro para adaptar copy, funnels y tooling de marketing a mercados globales.
validations:
  - Revisar consistencia entre el producto real y el copy antes de proponer campañas o claims.
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - i18n
  - growth
  - marketing
  - global
applies_to:
  - src/app/locales/**
  - src/app/pages/**/*Landing*.tsx
  - docs/**
  - .agents/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
cross_llm_notes:
  openai:
    - Lider recomendado para copy semántico, segmentación por mercado y estrategia de messaging.
  codex:
    - Muy bueno para convertir la estrategia en i18n real, componentes y docs.
  claude:
    - Fuerte para consistencia, claims y reducción de ambigüedad comercial.
  gemini:
    - Útil para conectar growth con datos, eventos y señales operativas.
related:
  - workflow:global-localization-marketing
  - workflow:i18n-locale-sync
---

# Skill: global-localization-growth-strategy

## Objetivo

Guiar a Vorea Studio desde una localización básica hacia una estrategia real de mercados globales.

## Úsalo para

- priorizar mercados e idiomas;
- adaptar copy por cultura/región;
- revisar claims de pricing y plan features;
- proponer CRM, mailing, analytics y fidelización;
- aterrizar campañas y funnels por segmento.

## Entregables esperados

1. Estado actual del i18n y del copy.
2. Riesgos de promesa comercial.
3. Matriz región/idioma/canal.
4. Backlog de tooling de growth.
