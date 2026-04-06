---
id: ui-state-sync
kind: workflow
title: Reglas de transferencia de estado UI y persistencia entre vistas React
description: Reglas obligatorias para la transferencia de estado UI y persistencia entre vistas de React (AI Studio a Editor)
when_to_use:
  - Cuando se modifique la navegación entre AI Studio y Editor
  - Cuando se cambie la persistencia local o el estado global de React para modelos SCAD
inputs:
  - src/app/pages/AIStudio.tsx
  - src/app/pages/Editor.tsx
  - src/app/services/model-context.ts
outputs:
  - Estado UI consistente entre vistas sin pérdida de datos del usuario
validations:
  - npm run test
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - frontend
  - state-management
  - ux
applies_to:
  - src/app/pages/AIStudio.tsx
  - src/app/pages/Editor.tsx
  - src/app/services/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:change-validation-master
  - workflow:ux-ui-review
---

# UI State and Persistence Sync Rule

Esta regla existe para evitar la desincronización de datos entre vistas de la aplicación, un error severo causado al mezclar persistencia local (`localStorage`) con el estado global de React.

## Reglas Obligatorias:

1. **Prioridad del Contexto Global**: El Contexto Global en React (como `ModelContext`) **siempre debe tener prioridad** sobre datos almacenados localmente si los datos del contexto fueron provistos por una vista explícita (ej., `AI Studio` pasando estado al `Editor`).

2. **Supression del Scratchpad Local**: Cuando un usuario navega de una vista de generación (AI Studio) al Editor (`/studio`), el código de inicialización (`bootstrap`) del Editor **NUNCA** debe sobrescribir el estado reactivo fresco con un scratchpad persistido desde `localStorage` salvo que el estado reactivo sea explicitamente el estado por defecto o vacío (`DEFAULT_SOURCE`).

3. **Propagación Completa de Parámetros**: Nunca transfieras solo el código fuente. Ambas vistas deben compartir el modelo de datos. Al pasar de AI Studio -> Editor, asegúrate de transferir el `scadCode` (fuente) Y los `parameterOverrides` simultáneamente usando las funciones del estado global (`setScadSource` y `setParamValues`). React batchará estas actualizaciones correctamente.

4. **Trazabilidad en Modelos Generados (Traceability Injection)**: Para modelos en memoria o en tránsito, cada artefacto SCAD generado por IA debe incluir obligatoriamente comentarios de cabecera con metadatos:
   - Proveedor (Provider: Gemini, Claude, Fallback)
   - Motor (Engine ID)
   - Prompt Original

5. **No Confundir URL con Estado**: Hasta que un modelo no se pública explícitamente en la base de datos comunitaria, es un "Draft" (borrador en memoria). **No manipule URLs `/m/:id` hasta que la base de datos devuelva un registro persistente**.

*El incumplimiento de estas normas provoca pérdida del progreso del usuario y regresiones funcionales que afectan severamente la experiencia.*
