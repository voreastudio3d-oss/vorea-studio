---
id: rollback-branch-protection
kind: rule
title: Protección de ramas rollback
description: Proteccion obligatoria de ramas de rollback para evitar trabajo accidental en puntos de retorno
when_to_use:
  - Antes de bloques de alto impacto o al recuperar trabajo desde ramas backup/rollback.
inputs:
  - git status --short
  - git branch -vv
  - git worktree list
outputs:
  - Uso seguro de ramas rollback como checkpoints inmutables.
validations:
  - git branch --list codex/rollback/*
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - base-required
  - git
  - safety
applies_to:
  - .agents/**
  - src/**
  - server/**
  - scripts/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:git-branching
  - workflow:git-hygiene-recovery
---

# Regla Obligatoria - Proteccion de Ramas Rollback

## Alcance
Aplica a cualquier rama cuyo nombre comience con:

- `codex/rollback/`

## Politica

1. Las ramas de rollback son **inmutables** y solo existen como punto de retorno.
2. Queda prohibido desarrollar features, fixes o refactors en ramas rollback.
3. Queda prohibido mergear ramas rollback a `develop` o `main`.

## Procedimiento correcto

1. Crear la rama rollback desde el estado base estable.
2. Crear una rama de trabajo desde ese mismo commit (`codex/feat/...`, `codex/fix/...`).
3. Realizar todo el trabajo exclusivamente en la rama de trabajo.

## Verificacion rapida

```bash
git branch --show-current
```

Si el resultado comienza con `codex/rollback/`, detener cambios y cambiar de rama.
