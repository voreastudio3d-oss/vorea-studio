# Vorea Studio 3D — Agent Instructions

Full-stack parametric 3D web app: React + Vite frontend, Hono API backend, Prisma + PostgreSQL, deployed on Railway.

## Quick Commands

| Task | Command |
|------|---------|
| Install deps | `pnpm install` |
| Dev frontend | `pnpm dev` (port 3000) |
| Dev backend | `pnpm dev:api` (port 3001) |
| Dev both | `pnpm dev:all` |
| Build | `pnpm build` |
| Test | `pnpm test` |
| Test with coverage | `pnpm test:coverage` |
| Lint | `pnpm lint` |
| Typecheck | `pnpm typecheck` |
| DB generate client | `pnpm db:generate` |
| DB push schema | `pnpm db:push` |
| DB migrate | `pnpm db:migrate` |
| API docs generate | `pnpm docs:api:generate` |
| API docs parity check | `pnpm docs:api:check` |

## Architecture

```
src/                   # React frontend (Vite, Tailwind, Radix UI, Zustand)
  app/components/      # UI components (ScadViewport, GCodePanel, etc.)
  app/pages/           # Route pages (Editor, Explore, AIStudio)
  app/services/        # Business logic + React Context (auth, models, i18n)
  app/hooks/           # Custom React hooks
  app/store/           # Zustand stores
  app/engine/          # 3D/SCAD compute logic
  app/models/          # TypeScript interfaces
  app/locales/         # i18n translation files
server/                # Hono API (Node.js)
  app.ts               # Main router — all /api routes
  server.ts            # Entry point (serves frontend + API)
  auth.ts              # JWT/session auth
  middleware/           # Rate limiting, etc.
prisma/                # Schema, migrations, seed
scripts/               # Build & utility scripts
public/                # Static assets, OpenAPI spec, SCAD library
```

- **Path alias**: `@/*` → `./src/*`
- **Vite proxy**: `/api` → `http://localhost:3001` in dev
- **Production**: Single Railway service serves both frontend and API

## Tech Stack

- **Frontend**: React 18, TypeScript (strict), Vite, Tailwind CSS 4, Radix UI, Zustand, Three.js
- **Backend**: Hono on Node.js 22, Prisma 7 + PostgreSQL
- **Auth**: JWT in cookies, bcrypt, Google OAuth
- **Payments**: PayPal subscriptions + orders
- **Package manager**: pnpm (never use npm or yarn)
- **Testing**: Vitest + Testing Library
- **Deploy**: Railway (Docker, multi-stage Alpine build)

## Conventions

### Code Style
- TypeScript strict mode — avoid `any` when possible
- Functional React components with hooks
- PascalCase for components, camelCase for functions/variables
- Unused vars prefixed with `_` (ESLint `argsIgnorePattern: ^_`)

### Backend Patterns
- Hono route composition: `app.route("/api/resource", resourceApp)`
- Auth via middleware injecting `userId` into Hono context: `c.get("userId")`
- Repository pattern for data access (see `community-repository.ts`)
- Rate limiting middleware on sensitive endpoints

### Frontend Patterns
- React Context providers: `AuthProvider`, `ModelProvider`, `I18nProvider`
- Zustand for cross-component state
- Error boundaries wrapping route trees
- Suspense for lazy-loaded pages

### Database
- Prisma schema in `prisma/schema.prisma`
- After schema changes: run `pnpm db:generate` then `pnpm db:push` or `pnpm db:migrate`
- Seed data: `prisma/seed.ts` (synced from `src/app/data/community-data.ts`)

## Quality Gates

1. **All code changes**: Run `pnpm test`
2. **Backend/API changes**: Also run `pnpm docs:api:generate && pnpm docs:api:check`
3. **Schema changes**: Run `pnpm db:generate`

## Governance

This project uses AI agent governance. See [guidelines/Guidelines.md](guidelines/Guidelines.md) for:
- Branch naming: `codex/<type>/<short-name>`
- Traceability: `ai_shared_plan.md`, `project_backlog.md`, `ai_handoff_YYYY-MM-DD.md`
- Agent commands: `pnpm agent:preflight`, `pnpm agent:route`, `pnpm agent:sync`

## Key Documentation

- [guidelines/Guidelines.md](guidelines/Guidelines.md) — Operational governance rules
- [docs/api/endpoint-matrix.md](docs/api/endpoint-matrix.md) — REST API catalog
- [docs/manual-usuario.md](docs/manual-usuario.md) — User manual (Spanish)
- [public/openapi.json](public/openapi.json) — OpenAPI spec
- [docs/ga4-setup-guide.md](docs/ga4-setup-guide.md) — Analytics setup

## Existing Custom Agents

15 specialized agents in `.github/agents/` — see that folder's [README](.github/agents/README.md) for the full registry. Key agents: `vorea-security-reviewer`, `vorea-db-architect`, `vorea-api-tester`, `vorea-test-coverage`, `vorea-cad-converter`.

## Existing Skills

- [fusion-scad-bridge](.github/skills/fusion-scad-bridge/SKILL.md) — Convert Fusion 360 designs to OpenSCAD parametric models
- [scad-parametric](.github/skills/scad-parametric/SKILL.md) — Parametric SCAD pipeline: models, surfaces, relief, export, product families

## Prompts

- `/deploy` — Railway deploy with pre-flight checks (test, lint, typecheck)

## Hooks

- `lint-on-edit` — Auto-runs ESLint `--fix` after agent file edits
