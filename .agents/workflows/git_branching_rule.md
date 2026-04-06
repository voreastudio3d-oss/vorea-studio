---
id: git-branching
kind: workflow
title: Ciclo de ramas y commits por bloque
description: Regla obligatoria de commits y ramas al cambiar de tarea
when_to_use:
  - Al iniciar o cerrar un bloque de trabajo con código o documentación relevante.
inputs:
  - git status --short
  - git branch --show-current
  - git fetch origin
outputs:
  - Rama de trabajo limpia y ciclo sincronizar-trabajar-commitear-push documentado.
validations:
  - git status --short
  - git branch --show-current
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - git
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
  - workflow:git-hygiene-recovery
  - rule:rollback-branch-protection
---

# Git Branching & Commit Rule

## Ciclo Completo Obligatorio

```
1. SINCRONIZAR → 2. TRABAJAR → 3. COMMITEAR → 4. PUSH + PR → 5. NUEVA RAMA
```

---

## 1. ⚠️ SINCRONIZAR (Antes de escribir código)

**BLOQUEANTE — no se procede sin completar esto.**

> **🚨 Esto aplica tanto para la IA como para el humano.**
> Antes de entregarle control a la IA para trabajar, el usuario debe asegurarse de estar en `develop` con `git pull` ya corrido.
> La IA debe verificarlo al inicio de cada sesión como primer paso.

// turbo-all

```bash
git fetch origin
git checkout develop
git pull origin develop
git rev-list --left-right --count origin/develop...HEAD
```

> Si el primer número es > 0, el merge es obligatorio antes de cualquier cambio.

### ⚠️ Archivos que siempre generan conflictos de merge

Los siguientes archivos son **auto-generados** y no deben trackearse:

| Archivo | Motivo |
|---|---|
| `.agents/.obsidian/workspace.json` | Obsidian guarda el estado de pestañas abiertos localmente. Cambia con cada apertura de Obsidian. Ya agregado a `.gitignore`. |
| `.agents/.obsidian/workspace-mobile.json` | Idem para Obsidian mobile. |

Si aparecen en conflicto: `git checkout --theirs .agents/.obsidian/workspace.json` (o simplemente descartar el cambio local).

---

## 2. TRABAJAR

Escribir código, hacer las tareas. Commits intermedios según sea necesario.

---

## 3. COMMITEAR (Al terminar la tarea)

Conventional Commits obligatorio:
- `feat(scope): descripción`
- `fix(scope): descripción`
- `refactor(scope): descripción`
- `chore(scope): descripción`
- `docs(scope): descripción`

// turbo-all

```bash
git status --short
git add -A
git commit -m "<type>(<scope>): <descripción>"
```

---

## 4. PUSH + PR (Al terminar features/tareas completas)

**Cuando los cambios en la rama están terminados, se hace push y PR a develop.**

```bash
git push origin <rama-actual>
```

Luego crear PR en GitHub hacia `develop` con:
- Título descriptivo del feature/fix
- Resumen breve de cambios

> **No acumular features sin PR.** Cada tarea completada debe tener su PR lo antes posible.

---

## 5. NUEVA RAMA (Para la siguiente tarea)

**Antes de empezar la siguiente tarea**, crear rama nueva desde develop actualizado:

// turbo-all

```bash
git checkout develop
git pull origin develop
git checkout -b codex/<tipo>/<nombre-corto>
```

- Formato: `codex/<tipo>/<nombre-corto>`
- Tipos: `feat`, `fix`, `refactor`, `chore`, `docs`, `rollback`
- Ejemplo: `codex/feat/admin-og-upload`, `codex/fix/i18n-missing-keys`
- Rama de retorno inmutable: `codex/rollback/<fecha>-<hito>`

---

## Cuándo Aplicar

- **SIEMPRE** al inicio de cada sesión (paso 1)
- **SIEMPRE** al finalizar una tarea (pasos 3-4)
- **SIEMPRE** al iniciar una tarea nueva (paso 5 → 1)
- **No es necesario** crear nueva rama para correcciones menores dentro de la misma tarea

## Convención de Scopes

| Scope | Uso |
|---|---|
| `i18n` | Internacionalización |
| `relief` | Herramienta de relieve |
| `engine` | Motor 3D |
| `ui` | Componentes visuales |
| `auth` | Autenticación |
| `api` | Backend/servicios |
| `seo` | SEO y metadatos |
| `admin` | Panel de administración |
| `community` | Funcionalidad de comunidad |
