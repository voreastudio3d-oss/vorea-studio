---
id: post-commit-review
kind: workflow
title: Revisión post-commit y sincronización documental
description: Regla obligatoria de revisión post-commit para mantener trazabilidad, docs y ramas sincronizadas
when_to_use:
  - Después de cada commit antes de abrir PR o pasar a otro bloque.
inputs:
  - git status --short
  - ai_shared_plan.md
  - project_backlog.md
  - ai_handoff_YYYY-MM-DD.md
  - project_health_report.md
  - project_pending.md
outputs:
  - Bloque validado, trazabilidad actualizada y docs sincronizadas tras el commit.
validations:
  - git status --short
  - npm run test
docs_to_update:
  - ai_shared_plan.md
  - project_backlog.md
  - ai_handoff_YYYY-MM-DD.md
  - project_health_report.md
  - project_pending.md
tags:
  - git
  - docs
  - governance
applies_to:
  - src/**
  - server/**
  - scripts/**
  - .agents/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:agent-handoff-evidence
  - workflow:git-hygiene-recovery
---

# Post-Commit Review Rule

## Regla

**SIEMPRE despues de cada commit**, ejecutar este workflow antes de abrir PR o continuar con otro bloque.

## Pasos

### 1. Verificar integridad del bloque
- Confirmar que el commit corresponde a una sola unidad logica de trabajo.
- Confirmar que no hay cambios fuera de scope en `git status --short`.

### 2. Sincronización Maestra Activa (Actualizar trazabilidad)
Las IAs **están obligadas** a usar herramientas de edición para impactar el éxito/fracaso en los 4 documentos núcleo para evitar fricción de contexto:
- Actualizar `project_backlog.md`: Cambiar el ticket a `✅ Completado` o `🟡 En progreso`.
- Actualizar `project_health_report.md`: Si se arregló un bug o deuda técnica listada allí, tacharlo o marcarlo como resuelto.
- Actualizar `project_pending.md`: Si era una tarea satélite del motor 3D, removerla de pendientes.
- Actualizar `ai_shared_plan.md`: Definir claramente el nuevo `Estado:` y preparar el objetivo para la próxima IA.
- Actualizar o crear `ai_handoff_YYYY-MM-DD.md` documentando la evidencia.

### 3. Actualizar documentacion tecnica (si aplica)
- Si cambian endpoints/contratos: correr `npm run docs:api:generate` y `npm run docs:api:check`.
- Si cambia operacion/produccion: actualizar `production_deploy_guide.md`.
- Si cambia flujo visible al usuario: revisar `docs/manual-usuario.md` y `docs/profiles/*`.

### 4. Publicar en la rama activa (no en develop directamente)
```bash
git push -u origin <rama-actual>
```

### 5. Preparar PR
- Abrir PR desde la rama activa hacia `develop`.
- Incluir evidencia de validaciones y riesgos abiertos.

## Notas
- `develop` no debe recibir pushes directos desde este workflow.
- Si la documentacion genera cambios nuevos, crear commit adicional `docs(scope): ...`.
- Este workflow aplica para todos los commits con impacto funcional o tecnico.
