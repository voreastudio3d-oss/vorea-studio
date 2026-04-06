---
id: i18n-locale-sync
kind: workflow
title: Sincronización obligatoria de locales i18n
description: Regla de sincronización obligatoria para archivos de internacionalización (i18n locales)
when_to_use:
  - Cuando se agreguen, modifiquen o eliminen claves en locales o UI visible.
inputs:
  - src/app/locales/**
outputs:
  - Ocho locales alineados con las claves del bloque.
validations:
  - npm run test
  - node scripts/i18n-sync-check.mjs
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - ui
  - i18n
applies_to:
  - src/app/locales/**
  - src/app/pages/**
  - src/app/components/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:ux-ui-review
  - workflow:i18n-admin-content
---

## Regla de Desarrollo — Sincronización de Locales i18n

### Alcance
Aplica a toda modificación de archivos en `src/app/locales/` y a cualquier feature o componente que agregue, modifique o elimine claves de traducción.

### Locales Activos del Proyecto
El proyecto mantiene **8 archivos de locale**:
- `es.json` (Español — **idioma base**)
- `es-AR.json` (Español Argentina)
- `es-MX.json` (Español México)
- `es-UY.json` (Español Uruguay)
- `en.json` (Inglés)
- `en-GB.json` (Inglés británico)
- `pt.json` (Portugués)
- `pt-BR.json` (Portugués Brasil)

### Requisitos Obligatorios

1. **Clave nueva = todos los locales:**
   Al agregar una nueva clave i18n en cualquier archivo, se **DEBE** agregar en **todos** los 8 archivos. Si no se tiene la traducción, usar el valor del idioma base seguido del marcador `[PENDING]` (ej: `"relief.title": "Generador de Relieve [PENDING]"`).

2. **Idioma base primero:**
   El idioma base es `es.json` (Español genérico). Toda clave nueva se define primero aquí y luego se replica.

3. **Variantes regionales:**
   Las variantes (`es-AR`, `es-MX`, `es-UY`) solo deben diferir del base `es.json` cuando existan modismos locales relevantes. Para terminología técnica 3D, usar el mismo término en todas las variantes.

4. **Asistencia IA para traducciones:**
   El agente puede generar traducciones a `en`, `pt`, etc. usando `es.json` como fuente. Las traducciones generadas por IA deben etiquetarse como borrador para revisión humana (marcador `[AI]` al final del valor).

5. **Clave eliminada = eliminar en todos:**
   Si una clave se elimina de un locale, debe eliminarse de **todos** los 8 archivos para evitar claves huérfanas.

6. **Verificación pre-cierre:**
   Antes de cerrar cualquier tarea que toque i18n, verificar que todas las claves existan en todos los archivos. Ejecutar una comparación rápida de keys entre `es.json` y los demás.

### Checklist para el Agente de IA
- [ ] ¿La clave nueva existe en los 8 archivos de locale?
- [ ] ¿Se definió primero en `es.json`?
- [ ] ¿Las traducciones IA tienen marcador `[AI]` para revisión?
- [ ] ¿No quedaron claves huérfanas si se eliminó alguna?
