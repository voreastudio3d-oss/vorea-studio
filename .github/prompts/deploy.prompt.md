---
description: "Deploy to Railway with pre-flight checks. Runs tests, lint, and typecheck before deploying."
agent: "agent"
argument-hint: "Commit message for the deploy"
---

# Railway Deploy

Deploy the Vorea Studio 3D app to Railway production.

## Pre-deploy Checks

Run these in order — abort if any fails:

1. `pnpm test` — All tests must pass
2. `pnpm lint` — No lint errors
3. `pnpm typecheck` — No type errors

## Deploy

After all checks pass, deploy with:

```powershell
railway up -d -p "ab49a600-2e48-46ff-b9e7-c0bd8918d637" -s "Vorea-Paramentrics-3D" -e "production" -m "<commit message>"
```

Use the user's argument as the commit message. If no argument provided, ask for one.

## Post-deploy

- Print the build log URL returned by `railway up`
- Remind the user to check https://voreastudio3d.com/api/health after deploy completes
