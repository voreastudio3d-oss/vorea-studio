# Vorea Studio 3D — Test Coverage Improvement Plan

## Current Baseline (post-session)

| Metric     | Before  | After   | Target Phase 1 | Target Phase 2 |
|------------|---------|---------|----------------|----------------|
| Lines      | 29.68%  | 29.95%  | 40%            | 55%            |
| Branches   | 23.53%  | 23.89%  | 35%            | 45%            |
| Functions  | 23.03%  | 23.50%  | 35%            | 50%            |
| Statements | 30.65%  | 30.90%  | 42%            | 55%            |

## Tests Created This Session (85 new test cases)

| File | Tests | Domain |
|------|-------|--------|
| `src/app/store/__tests__/ai-studio-store.test.ts` | 7 | Store — 0% → 100% |
| `server/__tests__/donations.test.ts` | 27 | Donations — pure utils |
| `server/__tests__/rate-limit.test.ts` | 13 | Rate limiting — IP extraction, sync limits, headers |
| `server/__tests__/auth.test.ts` | 13 | Auth — JWT, password, getUserIdFromHeader, toPublicProfile |
| `server/__tests__/paypal-subscriptions.test.ts` | 11 | PayPal — normalizeDisplayTier, extractSaleAmountInfo |
| `src/app/services/__tests__/i18n-context.test.tsx` | 10 | i18n — Provider, hook, locale changes, interpolation |
| `src/app/components/__tests__/TierGate.test.tsx` | 8 | TierGate — render logic, blur, CTA buttons |

---

## Phase 1 — Critical Coverage Gaps (Priority: HIGH → CRITICAL)

### 1.1 Server Core (agent: `vorea-api-tester`)
| File | LOC | Risk | Test Strategy |
|------|-----|------|---------------|
| `server/app.ts` | 8000+ | CRITICAL | Integration tests per route group. Split into: auth routes, community routes, AI routes, admin routes. Use supertest-like approach with Hono test client. |
| `server/auth.ts` CRUD | 550 | HIGH | DB-dependent CRUD: `createUser`, `getUserByEmail`, `updateUser`, `deleteUser`. Requires pg mock or test DB. |
| `server/community-repository.ts` | 400 | HIGH | CRUD operations on community models. Mock Prisma. |
| `server/news-sources.ts` | 200 | MEDIUM | Feed parsing, source CRUD. Mock fetch. |
| `server/ai-quick-fix.ts` | 250 | MEDIUM | Error correction engine. Mock AI provider. |

### 1.2 Services (agent: `vorea-test-coverage`)
| File | LOC | Risk | Test Strategy |
|------|-----|------|---------------|
| `src/app/services/api-client.ts` | 2400+ | CRITICAL | Massive API client. Test each method group: AuthApi, CommunityApi, AiStudioApi, ToolCreditsApi. Mock fetch globally. |
| `src/app/services/auth-context.tsx` | 180 | CRITICAL | Provider + hook tests. Mock AuthApi. Test login/logout/register flows. |
| `src/app/services/paypal.ts` | 85 | HIGH | PayPal checkout flow. Mock PayPal SDK. |
| `src/app/services/db/prisma-services.ts` | 400 | HIGH | DB adapter layer. Mock PrismaClient. |
| `src/app/services/telemetry.ts` | 114 | MEDIUM | Analytics events. Mock GA4. |

### 1.3 Components (agent: `vorea-test-coverage`)
| File | LOC | Risk | Test Strategy |
|------|-----|------|---------------|
| `src/app/components/AuthDialog.tsx` | 250 | CRITICAL | Login/register/reset tabs. Mock useAuth. Test form validation. |
| `src/app/components/ScadViewport.tsx` | 400 | CRITICAL | 3D viewport. Mock canvas/WebGL. Test control state. |
| `src/app/components/GCodePanel.tsx` | 300 | HIGH | GCode visualization. Test parsing/rendering. |
| `src/app/components/PublishDialog.tsx` | 280 | HIGH | Publish flow. Mock CommunityApi. |
| `src/app/components/ScadCustomizer.tsx` | 250 | HIGH | Parameter customization UI. Test slider/input logic. |

### 1.4 Pages (agent: `vorea-test-coverage`)
| File | LOC | Risk | Test Strategy |
|------|-----|------|---------------|
| `src/app/pages/Editor.tsx` | 550 | CRITICAL | Core editor page. Test render, panel layout, compilation trigger. |
| `src/app/pages/AIStudio.tsx` | 800 | CRITICAL | AI generation page. Test form submission, result display. |
| `src/app/pages/Relief.tsx` | 450 | CRITICAL | Heightmap relief page. Test upload/preview flow. |
| `src/app/pages/SuperAdmin.tsx` | 400 | CRITICAL | Admin dashboard. Test tab rendering, data loading. |
| `src/app/pages/Organic.tsx` | 400 | CRITICAL | Organic generation. Test workflow steps. |
| `src/app/pages/Landing.tsx` | 350 | HIGH | Landing page. Snapshot/render test. |

---

## Phase 2 — Expand & Harden

### 2.1 Integration Tests (agent: `vorea-api-tester`)
- Auth flow end-to-end (register → login → token → protected route)
- PayPal subscription lifecycle (create → activate → webhook → upgrade tier)
- Credit system (purchase → consume → balance check → rate limit)
- Community workflow (create model → publish → approve → display)

### 2.2 Missing Service Tests
- `analytics.ts`, `telemetry-collector.ts` — event tracking
- `community-gallery.ts`, `community-edit-routing.ts` — gallery CRUD
- `compilation-log.ts` — compilation history
- `hooks.ts` — custom React hooks
- `reward-triggers.ts` — gamification triggers
- `model-context.tsx` — model state provider

### 2.3 Remaining Pages
- `MakerWorld.tsx`, `ModelDetail.tsx`, `CommunityTab.tsx`
- `Landing.tsx`, `Explore.tsx`, `Leaderboard.tsx`
- Static pages: `Privacy.tsx`, `Terms.tsx` (low priority)

---

## Agent Assignments

| Agent | Responsibility |
|-------|---------------|
| `vorea-test-coverage` | Coverage analysis, test file creation, threshold tuning |
| `vorea-api-tester` | API integration tests, endpoint validation, load testing |
| `vorea-security-reviewer` | Auth flow testing, PayPal webhook validation, input sanitization |
| `vorea-workflow-architect` | Map complex test workflows, define test contracts |

## Threshold Progression

| Phase | Lines | Branches | Functions | Statements |
|-------|-------|----------|-----------|------------|
| Current | 25% | 20% | 20% | 25% |
| Phase 1 Complete | 40% | 35% | 35% | 42% |
| Phase 2 Complete | 55% | 45% | 50% | 55% |
| Phase 3 (Future) | 70% | 60% | 65% | 70% |

---

## Toolsets Created

File: `Vorea-Set-tools.toolsets.jsonc` — 26 grouped toolsets across 8 categories:
- **testing** (6): unit, coverage, watch, file, server, frontend
- **quality** (3): lint, typecheck, typecheck:repo
- **ci** (3): full, quick, governance
- **database** (5): generate, migrate, diff, studio, seed
- **dev** (4): frontend, api, all, kill
- **docs** (2): generate, check
- **build** (2): production, docker
- **agents** (2): sync, preflight
- **utils** (2): relief QA, i18n check
