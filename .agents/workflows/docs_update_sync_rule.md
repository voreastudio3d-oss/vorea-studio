---
id: docs-update-sync
kind: workflow
title: Sincronización de documentación visible
description: Regla obligatoria para mantener la documentación del proyecto sincronizada con los cambios del código
when_to_use:
  - Cuando cambien funcionalidades visibles para usuario final o contratos públicos.
inputs:
  - docs/**
  - public/docs/**
  - public/openapi.json
outputs:
  - Documentación de producto y API alineada con el comportamiento real.
validations:
  - Revisar manuales y perfiles impactados antes de cerrar la tarea.
docs_to_update:
  - docs/manual-usuario.md
  - docs/profiles/**
  - ai_handoff_YYYY-MM-DD.md
tags:
  - docs
  - ui
  - backend
applies_to:
  - src/app/pages/**
  - src/app/components/**
  - server/**
  - docs/**
  - public/docs/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - rule:ai-traceability
  - rule:api-docs-route-sync
---

# Regla Obligatoria — Sincronización de Documentación Externa

## Alcance
Aplica a cualquier tarea que introduzca, modifique o elimine funcionalidades visibles para el usuario final (Creatores, Usuarios, Administradores) o que modifique el contrato de las APIs públicas.

## Requisitos Obligatorios

1. **Paridad de Funcionalidades:**
   Cualquier feature nueva o modificada debe reflejarse en los manuales de usuario antes de cerrar la tarea.
   
2. **Archivos a revisar (según impacto):**
   - **`docs/manual-usuario.md`**: Para flujos de negocio (ej. cómo reportar un modelo, cómo publicar).
   - **`docs/profiles/*`**: Para guías específicas según tipo de usuario (creativos.md, administradores-contenido.md, desarrolladores.md).
   - **`public/openapi.json` / `docs/api/*`**: Para cambios en endpoints expuestos.

3. **Verificación Pre-Cierre:**
   Antes de marcar una tarea con impacto funcional como completa, la IA debe buscar qué secciones de `docs/manual-usuario.md` o documentación asociada requieren actualización y aplicar el cambio.

## Checklist para el Agente de IA
- [ ] ¿El cambio modifica un flujo documentado en `manual-usuario.md`? Si es así, ¿se actualizó el archivo?
- [ ] ¿Es necesario agregar una advertencia o guía en los perfiles específicos (`docs/profiles/`)?
- [ ] Si es un cambio de API, ¿se corrió `npm run docs:api:generate` y se validó la paridad?
