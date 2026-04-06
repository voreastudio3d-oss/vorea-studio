---
id: subagent-ux-ui-layout
kind: subagent
title: Subagente UX/UI y layout
description: Especialista en UX/UI, CSS, accesibilidad y maquetación multi-dispositivo.
when_to_use:
  - Cuando cambien páginas, componentes, estilos o contenido visible.
inputs:
  - src/app/pages/**
  - src/app/components/**
  - src/styles/**
outputs:
  - Validación visual y estructural del flujo UI impactado.
validations:
  - npm run test
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - ui
  - css
  - subagent
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
  - skill:ux-ui-css-layout
  - workflow:ux-ui-review
---

# Subagente: subagent-ux-ui-layout

## Rol

Especialista de UX/UI, CSS y maquetacion con foco en accesibilidad y experiencia multi-dispositivo.

## Cuándo activarlo

- Cambios en UI, paginas, componentes o estilos.
- Ajustes de layout, navegacion, estados visuales y contenido i18n.

## Entregables minimos

1. Evidencia desktop/mobile y estados de UI.
2. Reuso de componentes existentes del sistema UI.
3. Claves i18n nuevas/modificadas sincronizadas.

## Checks minimos

- `npm run test`
- Aplicar `ux_ui_review_workflow.md` e `i18n_locale_sync_rule.md`.
