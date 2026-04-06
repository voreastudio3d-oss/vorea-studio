---
id: i18n-admin-content
kind: workflow
title: Contenido administrable con i18n
description: Directriz obligatoria de contenido administrable con internacionalización (i18n)
when_to_use:
  - Cuando un contenido de marketing o negocio deba ser editable desde admin.
inputs:
  - src/app/pages/**
  - src/app/components/**
  - src/app/locales/**
outputs:
  - Contenido visible no hardcodeado, administrable y con claves i18n desde origen.
validations:
  - npm run test
  - Revisar que el contenido quede administrable y con claves sincronizadas.
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - ui
  - admin
  - i18n
applies_to:
  - src/app/pages/**
  - src/app/components/**
  - src/app/locales/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:i18n-locale-sync
  - workflow:admin-panel-ux-patterns
---

## Regla de Desarrollo — Contenido Dinámico Administrable

### Alcance
Esta directriz aplica a **toda** nueva feature, refactor o actualización que involucre contenido que cumpla alguna de las siguientes condiciones:
- Textos publicitarios, promocionales o de marketing.
- Contenido que se estima cambiará con frecuencia diaria o semanal (banners, CTAs, copys, descripciones de producto, anuncios).
- Etiquetas de UI cuyo wording pueda variar según campañas o temporadas.

### Requisitos Obligatorios

1. **Administrable desde el Admin Panel:**
   Todo contenido que cumpla el alcance anterior **NO debe estar hardcodeado** en los componentes del frontend. Debe exponerse como un campo editable desde el Panel de Administración, permitiendo al equipo de negocio actualizarlo sin intervención de desarrollo.

2. **Claves de Internacionalización (i18n):**
   Cada campo de contenido administrable debe estar asociado a una **clave de traducción i18n** desde su creación. La estructura de claves debe seguir el patrón existente del proyecto (ej: `admin.banner.title`, `promo.cta.description`).

3. **Idioma Base Primero, Réplica Asistida Después:**
   - Al crear una nueva pieza de contenido, se debe definir **primero en el idioma principal** del proyecto (español o inglés según corresponda).
   - La replicación a idiomas adicionales se realizará con asistencia de IA (el Agente puede generar las traducciones a partir del idioma base usando las claves i18n existentes).
   - Las traducciones generadas por IA deben quedar **siempre** como "borrador" para revisión humana antes de publicarse.

4. **Estructura de Archivos de Traducción:**
   Cada nuevo grupo de claves i18n debe agregarse en los archivos de locale correspondientes del proyecto, manteniendo la coherencia con la estructura existente.

### Checklist para el Agente de IA
Antes de dar por finalizada cualquier implementación que involucre contenido visual o textual orientado al usuario final:
- [ ] ¿El contenido es editable desde el Admin Panel?
- [ ] ¿Se crearon las claves i18n correspondientes?
- [ ] ¿Se definió el contenido en al menos un idioma base?
- [ ] ¿Se documentó la clave en el archivo de locale?
