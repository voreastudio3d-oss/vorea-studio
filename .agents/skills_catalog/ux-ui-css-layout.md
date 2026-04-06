---
id: ux-ui-css-layout
kind: skill
title: UX/UI, CSS y maquetación
description: Skill experta para layout responsive, accesibilidad, estados de interfaz y disciplina de contenido visible.
when_to_use:
  - Cuando cambien páginas, componentes, estilos o contenido visible del frontend.
inputs:
  - src/app/pages/**
  - src/app/components/**
  - src/styles/**
outputs:
  - UX/UI consistente, accesible y responsive.
validations:
  - npm run test
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - ui
  - css
  - layout
applies_to:
  - src/app/pages/**
  - src/app/components/**
  - src/styles/**
  - src/app/locales/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:ux-ui-review
  - subagent:subagent-ux-ui-layout
---

# Skill: ux-ui-css-layout

## Objetivo

Garantizar UX/UI consistente, accesible y responsive con buen uso de CSS, maquetacion y estados de interfaz.

## Entradas tipicas

- Paginas y componentes en `src/app/pages/` y `src/app/components/`
- Estilos en `src/styles/`
- Locales i18n en `src/app/locales/`

## Salidas esperadas

1. Layout desktop/mobile sin desbordes.
2. Estados de UI completos (normal, loading, vacio, error).
3. Foco visible y navegacion por teclado en acciones criticas.
4. Textos sin hardcode y claves i18n sincronizadas.

## Validaciones obligatorias

- `npm run test`
- Aplicar `.agents/workflows/ux_ui_review_workflow.md`
- Aplicar `.agents/workflows/i18n_locale_sync_rule.md`

## Anti-patrones

- Crear componentes UI ad-hoc si ya existe patron reusable.
- Diseñar solo desktop o solo mobile.
- Introducir texto hardcodeado en nuevas vistas.
