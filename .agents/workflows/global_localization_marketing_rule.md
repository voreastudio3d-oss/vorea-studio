---
id: global-localization-marketing
kind: workflow
title: Localización, growth y marketing por región
description: Workflow para alinear i18n, copy, cultura, analytics y growth cuando Vorea se proyecta a múltiples mercados.
when_to_use:
  - Cuando el bloque trate expansión geográfica, marketing por idioma, copy comercial, pricing visible, landings o tooling de crecimiento.
inputs:
  - src/app/locales/**
  - src/app/pages/**/*Landing*.tsx
  - src/app/pages/Landing.tsx
  - docs/**
outputs:
  - Estrategia trazable de localización y marketing que respeta idioma, cultura, promesas comerciales y analítica.
validations:
  - Revisar que no haya strings hardcodeados visibles y que el copy no prometa capacidades no soportadas.
  - Verificar consistencia mínima entre es/en/pt en superficies críticas.
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - i18n
  - marketing
  - growth
  - global
applies_to:
  - src/app/locales/**
  - src/app/pages/**/*Landing*.tsx
  - src/app/pages/Landing.tsx
  - docs/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
cross_llm_notes:
  openai:
    - Lider recomendado para estrategia de mercados, copy semántico, priorización comercial y síntesis multicultural.
  codex:
    - Muy bueno para aterrizar la estrategia en i18n real, componentes y docs.
  claude:
    - Buen revisor para consistencia, cumplimiento y precisión de claims visibles.
  gemini:
    - Útil para conectar growth con datos, eventos y señales operativas.
related:
  - workflow:i18n-locale-sync
  - workflow:docs-update-sync
  - skill:global-localization-growth-strategy
---

# Workflow - Global Localization Marketing

## Objetivo

Evitar que Vorea escale con i18n superficial o con copy que solo funciona en el mercado local.

## Reglas base

### 1. Localización real

- No basta con traducir strings; hay que revisar:
  - tono
  - promesa comercial
  - longitud
  - formato de moneda/fechas
  - referencias culturales

### 2. Copy honesto

- No prometer features “ilimitadas”, “globales” o “enterprise-ready” si el producto real no lo soporta todavía.
- Diferenciar:
  - capacidad actual
  - experimento
  - roadmap

### 3. Tooling de growth

- Eventos críticos deben poder salir hacia analytics/CRM sin reescribir la UI.
- Las decisiones de growth deben dejar claro:
  - qué se mide
  - para qué
  - en qué región/idioma importa

## Criterio de cierre

Un bloque de localización/marketing queda razonable solo si:

1. el copy visible no contradice el producto;
2. las superficies es/en/pt críticas están alineadas;
3. hay backlog claro de tooling/CRM/analytics por prioridad;
4. el aprendizaje queda documentado en runtime.

## Relacionados

- [[🧠_Cerebro_Vorea|🧠 Cerebro Colectivo Vorea]]
- [[roadmap_delegacion_abril_2026|Roadmap y Delegación Multi-LLM (Abril 2026)]]
- [[global_readiness_status_2026-04-02|Estado global actual por punto]]
- [[global-localization-growth-strategy|Skill de localización y growth global]]
