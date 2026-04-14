# Vorea Studio 3D — Coverage Status and Improvement Plan

Last verified on `2026-04-14` with:

```bash
npm run test:coverage
```

## Current Baseline

| Metric | Current |
|--------|---------|
| Statements | `89.95%` |
| Branches | `69.60%` |
| Functions | `90.80%` |
| Lines | `93.85%` |

The current `vitest` thresholds in [vitest.config.ts](../../vitest.config.ts) are being met:

| Metric | Threshold |
|--------|-----------|
| Statements | `85%` |
| Branches | `65%` |
| Functions | `85%` |
| Lines | `90%` |

## What Is In Scope

Coverage is intentionally focused on code that is practical to validate in unit and integration-style tests:

- `src/app/engine/**`
- `src/app/services/**`
- `src/app/components/**`
- `src/app/pages/**`
- `src/app/data/**`
- `src/app/models/**`
- `src/app/store/**`
- `server/**`

Large runtime-specific surfaces remain excluded on purpose:

- vendored UI primitives in `src/app/components/ui/**`
- WebGL, workers, and canvas-heavy modules
- DB adapters and live infra paths
- seed scripts and operational scripts
- a few very large app pages already covered indirectly by focused tests

## Highest-Value Gaps Right Now

These are the best next candidates when we want to keep pushing branch coverage without over-investing in brittle tests:

| Area | File | Current signal |
|------|------|----------------|
| Services | `src/app/services/api-client.ts` | Still the largest remaining gap in day-to-day app flows |
| Services | `src/app/services/ai-studio-history.ts` | Mostly solid, but still has malformed-storage branches to exercise |
| Pages | `src/app/pages/DonationsAdminTab.tsx` | UI-heavy, but already isolated enough for targeted render-state tests |
| Server | `server/paypal-order-utils.ts` | Compact utility with recoverable branch gaps |
| Server | `server/ai-quick-fix.ts` | Small enough to keep raising branch coverage cheaply |
| Services | `src/app/services/i18n-context.tsx` | Moderate branch gaps with controlled provider state |

## Practical Strategy

1. Prefer low-dependency utility modules first.
2. Add tests that cover rejection and fallback paths, not just happy paths.
3. Keep exclusions honest: only exclude code that is genuinely impractical in `happy-dom`.
4. Re-run `npm run test:coverage` after each focused batch instead of waiting for a large refactor.

## Recommended Commands

Run all tests:

```bash
npm run test
```

Run coverage:

```bash
npm run test:coverage
```

Open the HTML report locally:

- `coverage/index.html`

Target a single suite while iterating:

```bash
npm run test -- src/app/services/__tests__/api-client-extended.test.ts
```

## Notes For Future Sessions

- The previous coverage plan in this repo reflected an older baseline near `30%`; it is no longer accurate.
- Current effort should focus more on branch quality and documentation freshness than on raw line coverage.
- When adding new modules, include tests in the same change unless the code falls into an existing excluded runtime category.
