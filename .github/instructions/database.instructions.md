---
applyTo: "prisma/**"
description: "Use when: editing Prisma schema, migrations, seed files, or database-related configuration."
---

# Database (Prisma + PostgreSQL) Instructions

## Schema
- Single schema file: `prisma/schema.prisma`
- Key models: `User`, `Model`, `GCodeItem`, `ExportCredits`, `Feedback`, `MembershipPlan`, `PayPalOrder`, `PayPalSubscription`, `ActivityLog`
- Config: `prisma.config.ts` (PostgreSQL adapter)

## Workflow After Schema Changes
1. `pnpm db:generate` — Regenerate Prisma client
2. `pnpm db:push` — Push to dev DB (no migration)
3. Or `pnpm db:migrate` — Create a versioned migration for production

## Seed Data
- `prisma/seed.ts` syncs from `src/app/data/community-data.ts`
- Keep community model metadata in the frontend data file as source of truth

## Dev Database
- Default: `postgresql://vorea:vorea_dev@localhost:5432/vorea_studio`
- Docker compose available: `docker-compose.yml`
