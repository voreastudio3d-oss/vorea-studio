---
id: prisma-migration-pipeline-rule
kind: workflow
title: Regla obligatoria de migraciones Prisma
description: Todo LLM/agente que modifique el schema de base de datos DEBE usar el pipeline de migraciones Prisma (migrate dev → commit → deploy), NUNCA prisma db push en producción.
when_to_use:
  - SIEMPRE que se modifique prisma/schema.prisma
  - SIEMPRE que se agreguen, eliminen o modifiquen modelos, campos o índices
  - SIEMPRE que se haga deploy a Railway relacionado con cambios de DB
inputs:
  - prisma/schema.prisma
  - prisma/migrations/
outputs:
  - Archivo SQL en prisma/migrations/XXXX_nombre/migration.sql
  - DB local y Railway sincronizadas con historial versionado
validations:
  - npx prisma migrate status (debe decir "Database schema is up to date!")
  - npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema ./prisma/schema.prisma --exit-code
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - base-required
  - database
  - governance
  - llm-safety
  - migrations
applies_to:
  - prisma/**
  - Dockerfile
  - .github/workflows/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
  - paperclip
related:
  - workflow:codebase-architecture-boundaries
  - workflow:change-validation-master
  - workflow:endpoint-security-validation
  - workflow:git-branching-rule
---

# Regla Obligatoria de Migraciones Prisma

> **REGLA BLOQUEANTE** — Todo LLM, agente o desarrollador que toque `prisma/schema.prisma` DEBE seguir este protocolo. Usar `prisma db push` en producción está **PROHIBIDO**.

---

## Por qué existe esta regla

El proyecto migró de `prisma db push` a `prisma migrate` el 2026-04-05. Desde esa fecha existe una **baseline migration** (`0001_baseline`) aplicada en local y en Railway producción.

`prisma db push` sincroniza el schema **sin dejar historial**. Si dos agentes lo usan en paralelo, o si el schema diverge entre local y Railway, no hay forma de saber qué estado tiene la DB ni cómo revertirlo.

---

## ❌ PROHIBIDO

```bash
# NUNCA — destruye el historial de migraciones
npx prisma db push
npx prisma db push --force-reset

# NUNCA en producción — puede corromper datos
npx prisma migrate reset
```

---

## ✅ Flujo correcto para cambios de schema

### Paso 1 — Modificar el schema
Editar `prisma/schema.prisma` con el cambio necesario.

### Paso 2 — Crear la migration en local
```bash
npm run db:migrate
# equivale a: npx prisma migrate dev
# Prisma pedirá un nombre descriptivo → usar snake_case: "add_user_avatar_url"
```

Esto genera: `prisma/migrations/YYYYMMDDHHMMSS_nombre/migration.sql`

### Paso 3 — Verificar
```bash
npm run db:migrate:status
# Debe decir: "Database schema is up to date!"
```

### Paso 4 — Commitear la migration
```bash
git add prisma/migrations/
git commit -m "feat(db): descripción del cambio de schema"
git push origin develop
```

### Paso 5 — Deploy a Railway (automático)
El `Dockerfile` ya tiene:
```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && ./node_modules/.bin/tsx server/server.ts"]
```
Railway aplica las migraciones **automáticamente** en cada deploy. No hay que hacer nada manual.

---

## Comandos de diagnóstico y emergencia

```bash
# ✅ Ver estado de migraciones (local)
npm run db:migrate:status

# ✅ Ver estado de migraciones (Railway producción)
DATABASE_URL="<url-publica-railway>" npm run db:migrate:status

# ✅ Detectar schema drift (CI también lo ejecuta)
npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema ./prisma/schema.prisma --exit-code

# 🚨 EMERGENCIA: Marcar migración como aplicada sin ejecutarla (recovery)
# Usar solo cuando la tabla ya existe en DB pero no está en _prisma_migrations
npx prisma migrate resolve --applied "nombre_de_la_migration"

# 🛑 Reset completo (SOLO dev local, NUNCA en producción)
npm run db:migrate:reset
```

---

## Scripts disponibles en `package.json`

| Script | Comando Prisma | Uso |
|--------|---------------|-----|
| `npm run db:migrate` | `prisma migrate dev` | Crear nueva migration en local |
| `npm run db:migrate:deploy` | `prisma migrate deploy` | Aplicar migraciones pendientes |
| `npm run db:migrate:status` | `prisma migrate status` | Ver estado actual |
| `npm run db:migrate:reset` | `prisma migrate reset` | Reset dev (destructivo) |
| `npm run db:push` | `prisma db push` | SOLO si se necesita sincronizar sin migration (evitar) |

---

## Tabla de decisión rápida para LLMs

| Situación | Acción correcta |
|-----------|----------------|
| Agrego un nuevo campo a un modelo | `npm run db:migrate` → commit |
| Elimino un campo | `npm run db:migrate` → commit (revisar si hay datos) |
| Agrego un nuevo modelo | `npm run db:migrate` → commit |
| La DB local divergió del schema | `npm run db:migrate:status` → `prisma migrate resolve` si es emergencia |
| Railway no refleja el schema | Verificar que `prisma/migrations/` está commiteada y pusheada |
| `migrate dev` falla por drift | Revisar si hay tablas manuales en DB; usar `migrate resolve --applied` |

---

## Checklist Pre-Commit para cambios de schema

- [ ] ¿Ejecutaste `npm run db:migrate` y generó un archivo en `prisma/migrations/`?
- [ ] ¿El archivo SQL está commiteado junto al cambio en `schema.prisma`?
- [ ] ¿`npm run db:migrate:status` dice "Database schema is up to date!"?
- [ ] ¿La CI local no detecta schema drift (`migrate diff --exit-code` = 0)?

---

## Contexto histórico

| Fecha | Evento |
|-------|--------|
| 2026-04-05 | Migración de `db push` a `prisma migrate`. Baseline `0001_baseline` creada y aplicada en local + Railway. |
| 2026-04-05 | `telemetry_events` creada en Railway producción con `IF NOT EXISTS`. |
| 2026-04-05 | Dockerfile actualizado para auto-apply en cada deploy. |
| 2026-04-05 | CI GitHub Actions actualizado con schema drift detection. |
