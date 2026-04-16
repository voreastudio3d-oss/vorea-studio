---
applyTo: "server/**"
description: "Use when: editing backend API routes, Hono middleware, server modules, auth, payments, or any file under server/."
---

# Backend (Hono API) Instructions

## Framework
- **Hono** web framework on Node.js 22
- Entry: `server/server.ts` → `server/app.ts` (main router)
- All routes under `/api/`

## Patterns
- Route composition: `app.route("/api/resource", resourceApp)` — each domain gets its own Hono app
- Auth middleware injects `userId` via `c.get("userId")` / `c.set("userId", id)`
- Request parsing: `c.req.json()`, `c.req.query()`, `c.req.param()`
- Response: `c.json({ data })` with appropriate status codes
- Rate limiting via `server/middleware/rate-limit.ts`

## Auth Flow
- JWT tokens stored in HTTP-only cookies
- `server/auth.ts` handles login, register, token refresh, Google OAuth
- Middleware extracts and validates JWT, sets user context

## Data Access
- Prisma client for PostgreSQL (`@prisma/client`)
- Repository pattern: `community-repository.ts` abstracts storage backend
- Always use parameterized queries — never interpolate user input into SQL

## After Changes
- Run `pnpm test` to validate
- If routes changed: `pnpm docs:api:generate && pnpm docs:api:check`
- If schema changed: `pnpm db:generate`
