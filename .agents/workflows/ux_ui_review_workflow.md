---
id: ux-ui-review
kind: workflow
title: Revisión UX/UI obligatoria
description: Workflow obligatorio de revisión UX/UI para cambios frontend con cobertura desktop, mobile y accesibilidad básica
when_to_use:
  - Cuando cambien vistas, componentes o interacciones visibles de frontend.
inputs:
  - src/app/pages/**
  - src/app/components/**
outputs:
  - Validación visual y de interacción para desktop, mobile y estados clave.
validations:
  - npm run test
  - Smoke visual desktop/mobile de la vista impactada.
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - ui
  - validation
applies_to:
  - src/app/pages/**
  - src/app/components/**
  - src/styles/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:i18n-locale-sync
  - workflow:admin-panel-ux-patterns
---

# Workflow — Revisión UX/UI

## Alcance
Aplicar en todo cambio visual o de interacción de frontend.

## Checklist obligatorio

1. Desktop + tablet + mobile:
   - Verificar layout y legibilidad en ambos tamaños.
   - Verificar que no haya desbordes ni solapamientos.

2. Estados de UI:
   - Cubrir estado normal.
   - Cubrir estado hover.
   - Cubrir estado loading.
   - Cubrir estado vacío.
   - Cubrir estado error.

3. Interacción:
   - Verificar foco visible y navegación por teclado en controles críticos.
   - Verificar que CTAs principales sean claros y consistentes.

4. Consistencia visual:
   - Confirmar tipografía, espaciado y jerarquía con patrón existente.
   - Evitar introducir componentes inconsistentes si ya existe patrón equivalente.

5. Internacionalización UX:
   - Confirmar que nuevos textos no queden hardcodeados en componentes.
   - Confirmar claves y traducciones según [`i18n_locale_sync_rule.md`](./i18n_locale_sync_rule.md).

## Validación mínima de calidad
Ejecutar:

```bash
npm run test
```

## Evidencia obligatoria

1. Lista de pantallas/flujo revisado.
2. Confirmación desktop y mobile.
3. Estados validados (normal/loading/vacío/error).
4. Claves i18n tocadas.
