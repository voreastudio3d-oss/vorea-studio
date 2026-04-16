---
applyTo: "public/openapi.json"
description: "Use when: editing the OpenAPI spec, adding/modifying API endpoints, or updating public/openapi.json. Ensures spec stays in sync with backend routes."
---

# OpenAPI Spec Maintenance

## Sync Workflow

After any change to `public/openapi.json` or backend routes in `server/`:

1. `pnpm docs:api:generate` — Regenerate docs from spec
2. `pnpm docs:api:check` — Verify parity between OpenAPI spec and actual backend routes

## Rules

- Every route in `server/app.ts` must have a matching entry in `public/openapi.json`
- Use the existing endpoint matrix as reference: [docs/api/endpoint-matrix.md](../../docs/api/endpoint-matrix.md)
- Known inconsistencies are tracked in [docs/api/inconsistencies.md](../../docs/api/inconsistencies.md)
- Response schemas must match actual Hono handler return types
- Include `security` field on authenticated endpoints
