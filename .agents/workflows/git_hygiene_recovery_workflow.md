---
id: git-hygiene-recovery
kind: workflow
title: Limpieza segura de ramas, worktrees y bloqueos git
description: Workflow operativo para limpiar ramas en curso, resolver bloqueos de git y sincronizar `develop` sin perder avances
when_to_use:
  - Cuando git pull, merge o switch fallen por cambios locales o worktrees mezclados.
inputs:
  - git status --short
  - git branch -vv
  - git worktree list
outputs:
  - Plan seguro para proteger WIP, sincronizar develop y rescatar cambios útiles.
validations:
  - git status --short
  - git worktree list
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - git
  - governance
  - safety
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
  - workflow:git-branching
  - workflow:post-commit-review
---

# Git Hygiene & Recovery Workflow

## Objetivo

Mantener una linea estable en `develop`, evitar perdida de trabajo local y resolver conflictos de sincronizacion sin usar comandos destructivos.

## Cuándo aplicar

- Cuando `git pull`, `git merge` o `git switch` fallan por cambios locales.
- Cuando hay ramas temporales ya absorbidas que conviene limpiar.
- Cuando un worktree auxiliar o una rama vieja generan confusion visual en el IDE.
- Cuando se necesita rescatar avances utiles desde una rama backup o WIP.

Atajo seguro repo-local:

```bash
pnpm agent:git-recover --dry-run
```

## Principios

1. No perder avances locales.
2. No pisar trabajo ajeno con `reset --hard`, `checkout --`, `clean -fd` o similares.
3. No mergear una rama backup completa sin inspeccionarla primero.
4. `develop` debe quedar limpio y alineado con `origin/develop`.
5. Las ramas `codex/rollback/*` son inmutables y no se tocan.

## Paso 1 - Diagnostico inicial

Ejecutar:

```bash
git status --short
git branch --show-current
git branch -vv
git fetch origin --prune
git worktree list
```

O usar:

```bash
pnpm agent:preflight
pnpm agent:git-recover --dry-run
```

Clasificar lo que aparezca en 3 grupos:

1. cambios tracked del bloque actual;
2. untracked del usuario o material auxiliar;
3. ramas/worktrees temporales ya absorbidos.

## Paso 2 - Si `develop` esta sucio, proteger el WIP antes de sincronizar

Regla por defecto: crear rama de backup, no `stash`, cuando el bloque local tenga varios archivos o el valor del trabajo no sea trivial.

```bash
git switch -c wip/<fecha>-<descripcion-corta>
git add -A
git commit -m "wip: backup local workspace before syncing develop"
```

Usar `stash` solo si el cambio es pequeno, claramente descartable o puramente transitorio:

```bash
git stash push -u -m "wip before syncing develop"
```

## Paso 3 - Sincronizar `develop` sin mezclar basura

Una vez protegido el WIP:

```bash
git switch develop
git pull --ff-only origin develop
```

Si `develop` local queda behind y el pull falla por archivos ya existentes:

1. mover esos cambios a la rama backup;
2. reintentar `pull --ff-only`;
3. confirmar que `git status --short` quede limpio.

## Paso 4 - Rescate selectivo desde backups o ramas viejas

No mergear una rama WIP entera por defecto.

Primero inspeccionar:

```bash
git diff develop...wip/<rama>
git log --oneline develop..wip/<rama>
```

Luego decidir uno de estos caminos:

1. `cherry-pick` de commits limpios;
2. copia selectiva de archivos puntuales;
3. reimplementacion controlada del fix si el backup mezcla cambios obsoletos con avances utiles.

Objetivo: rescatar solo trabajo valido sin revertir avances nuevos de `develop`.

## Paso 5 - Limpieza de ramas y worktrees

### Ramas locales

Eliminar solo ramas ya absorbidas o explicitamente obsoletas:

```bash
git branch --merged develop
git branch -d <rama>
```

Usar `-D` solo si la rama es temporal, ya esta empujada o ya se documento su descarte.

### Ramas remotas

Prunear referencias viejas:

```bash
git fetch origin --prune
```

### Worktrees

Si existe un worktree auxiliar ya absorbido:

```bash
git worktree list
git worktree remove <ruta-del-worktree>
```

Si quedo carpeta residual, verificar que no contenga trabajo nuevo antes de borrarla.

## Paso 6 - Resolver errores de git mas comunes

### Error: "Your local changes would be overwritten by merge"

Accion:

1. crear rama backup o `stash -u`;
2. dejar limpio `develop`;
3. hacer `git pull --ff-only origin develop`.

### Error: untracked file would be overwritten

Accion:

1. mover ese archivo a la rama backup o commitearlo ahi;
2. limpiar `develop`;
3. reintentar el pull.

### IDE muestra varios repositorios o ramas fantasmas

Accion:

1. revisar `git worktree list`;
2. eliminar worktrees absorbidos;
3. recargar la ventana del IDE.

### Backup contiene trabajo valioso y trabajo obsoleto mezclado

Accion:

1. no mergear la rama completa;
2. rescatar por archivo/commit;
3. documentar que se recupero y que se descarto.

## Paso 7 - Criterio de cierre

El workflow queda completo cuando:

1. `develop` esta limpio y alineado con `origin/develop`;
2. los avances locales no se perdieron y siguen resguardados o integrados;
3. no quedan worktrees auxiliares confusos;
4. las ramas temporales ya absorbidas fueron podadas;
5. el handoff explica:
   - que se respaldo;
   - que se integro;
   - que se dejo aparte;
   - que ramas quedaron activas.

## Notas del repo

- No tocar `docs/marketing/` ni otros untracked del usuario sin permiso explicito.
- No usar ramas `codex/rollback/*` como ramas de trabajo.
- Si el rescate de una rama vieja implica riesgo de revertir avances nuevos, priorizar rescate selectivo sobre merge directo.
