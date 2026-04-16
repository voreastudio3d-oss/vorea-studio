---
applyTo: "src/**"
description: "Use when: editing React components, pages, hooks, stores, services, or any frontend file under src/."
---

# Frontend (React) Instructions

## Stack
- React 18 + TypeScript strict, Vite, Tailwind CSS 4, Radix UI primitives
- Path alias: `@/*` → `./src/*`

## Component Patterns
- Functional components only, with hooks
- UI primitives from Radix UI (dialog, dropdown, tabs, etc.)
- Styling: Tailwind utility classes + `cn()` helper from `@/lib/utils`
- Icons: `lucide-react`

## State Management
- **Local**: React state + hooks
- **Cross-component**: Zustand stores in `src/app/store/`
- **App-wide**: React Context providers (`AuthProvider`, `ModelProvider`, `I18nProvider`)

## Key Services (src/app/services/)
- `auth-context` — Authentication state & guards
- `model-context` — 3D model state
- `i18n-context` — Internationalization
- `analytics.ts` — GA4 event tracking

## Routing
- React Router with lazy-loaded pages
- Auth guards via `AuthGuard`, `RoleGuard` components
- Error boundaries wrap route trees

## i18n
- Translation files in `src/app/locales/`
- Use `useI18n()` hook to access translations
- When adding user-facing strings, add keys to all locale files
