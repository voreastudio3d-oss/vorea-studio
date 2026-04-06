# VoreaStudio-3d-parametrics

This repository contains the Vorea Studio Parametric 3D web app (frontend + local API server + Prisma/PostgreSQL tooling).

Original design source:  
https://www.figma.com/design/TmGbJveDw2ciiU358bQrvF/VoreaStudio-3d-parametrics

## AI Collaboration (Mandatory)

All AI agents working in this repository must use the shared coordination plan as the source of truth:

- `.agents/skills`
- `ai_shared_plan.md`

Required companion docs:

- `.agents/skills` (governance index)
- `project_backlog.md`
- `ai_handoff_YYYY-MM-DD.md` (current day handoff)

## Run Locally

1. Install dependencies:
```bash
npm i
```

2. Start frontend (Vite):
```bash
npm run dev
```

3. Start API server (optional, for community/auth/persistence flows):
```bash
npm run dev:api
```

## Community Seed Source Of Truth

Community seed content is centralized in:

- `src/app/data/community-data.ts`

This file now feeds:

- `server/seed-community.ts` (KV/API seed)
- `prisma/seed.ts` (Prisma/PostgreSQL seed)

So model metadata, SCAD, tags, and authors stay synchronized across environments.

## API Docs Project (`/docs`)

The repository includes a generated API documentation mini project:

- OpenAPI source: `public/openapi.json`
- Technical portal: `/docs/` (served from `public/docs/index.html`)
- Operational matrix: `docs/api/endpoint-matrix.md`
- Inconsistencies report: `docs/api/inconsistencies.md`

Generate and validate parity between backend routes and OpenAPI:

```bash
npm run docs:api:generate
npm run docs:api:check
```

### Community DB Mode (`COMMUNITY_DB_MODE`)

Server-side community routes support three storage modes.
Today the runtime default is still `kv`, and that mode is no longer ephemeral:
it persists into the PostgreSQL-backed `kv_store` through `server/kv.ts`.

- `kv`: read/write in `kv_store` (current default, PostgreSQL-backed KV)
- `dual`: write to both KV and Prisma-backed tables, read from KV
- `prisma`: read/write from Prisma-backed tables (optional cutover mode after parity verification)

Set it in `.env`:

```bash
COMMUNITY_DB_MODE=kv
```

Duplicate-safe reads:

- Community list reads (`kv` and `prisma`) de-duplicate legacy clones by `authorId + title + modelType`.
- When duplicates exist (`c_*` and `cm_*` variants), the API prefers `cm_*` as canonical.

### Backfill KV -> Prisma (Community)

Recommended sequence before switching from the current default (`kv`) to `COMMUNITY_DB_MODE=prisma`:

1. Dry-run diff/report:

```bash
npm run backfill:community:dry
```

2. Apply idempotent backfill:

```bash
npm run backfill:community:apply
```

3. Verify parity in report (`PARITY_STATUS=OK`):

- models KV == Prisma (community set)
- tags KV == `community_tags`
- likes KV == `community_model_likes`

4. Switch runtime mode:

```bash
COMMUNITY_DB_MODE=prisma
```

5. Run smoke on community endpoints:

- `GET /api/community/models`
- `GET /api/community/models/:id`
- `GET /api/community/tags`
- `GET /api/community/users/:id`

## Seeding Commands

Seed API/KV community data:

```bash
npx tsx server/seed-community.ts
```

Seed Prisma/PostgreSQL data:

```bash
npx prisma db seed
```

## Tests

Run all tests:

```bash
npm run test
```

Run only community data integrity tests:

```bash
npm run test -- src/app/data/__tests__/community-data.test.ts
```

Relief QA manual:

- QA matrix and status: `docs/operations/relief-3mf-qa-matrix.md`
- Orca/Bambu smoke guide: `docs/operations/relief-orca-bambu-smoke.md`
- Smoke assets generator: `npm run qa:relief:assets`
- Smoke assets output: `public/qa-assets/relief-smoke/`
- Recommended smoke fixture: `public/qa-assets/relief-smoke-four-zones.svg`
