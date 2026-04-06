# AI Handoff - 2026-03-24 (Sesión 2)

## Rama Activa
`codex/feat/analytics-hygiene-bg114-bg117` → PR #24 abierto hacia `develop`

## Resumen de Cambios

1. **BG-114 Analytics Hygiene:**
   - `isInternalRoute()` guard en `trackAnalyticsEvent` y `trackPageView` (no solo `initAnalytics`)
   - Rutas `/admin`, `/docs`, `/feedback-admin` no generan eventos
2. **BG-117.1 Per-Tool Metrics:**
   - `TOOL_ROUTES` map reemplazando 3 `if` individuales → 10 rutas con `open_tool { tool, surface, auth_state }`
   - Legacy events (`open_editor`, `view_pricing`, `open_ai_studio`) mantenidos como aliases
3. **Eventos de acción:**
   - Landing: `landing_view`
   - Membership: `pricing_plan_click`, `sign_up_start`
   - MakerWorld: `makerworld_lint`, `export_stl/obj/scad`
4. **Signup Funnel:**
   - `sign_up_complete` en login (email), register y Google social login
5. **Documentación:**
   - `docs/ga4-analytics-guide.md` con 20+ eventos, payload estándar, filtro IP

## Validaciones Ejecutadas

- `npm run build` → OK (6.83s)
- PR #24 creado en GitHub

## Impacto Funcional/API

- No hay cambios de endpoints ni contratos backend
- Solo frontend: `analytics.ts`, `App.tsx`, `Landing.tsx`, `Membership.tsx`, `MakerWorld.tsx`, `auth-context.tsx`

## i18n

- Sin cambios de claves i18n

## Riesgos y Pendientes

1. **Manual post-deploy**: Configurar filtro IP interno en GA4 console
2. `VITE_GA4_MEASUREMENT_ID` debe estar seteado en `.env` / Railway
3. Política de URLs por locale (BG-114 residual) sigue abierta

## Reglas Seguidas

- `git_branching_rule.md` (sync → work → commit → PR → new branch)
- `docs_update_sync_rule.md` (analytics es infra, no impacta manual-usuario.md)
- `agent_handoff_evidence_workflow.md` (este documento)

## Trazabilidad

- `ai_shared_plan.md` actualizado con bloque BG-114/BG-117.1
- `project_backlog.md` status de BG-114 actualizado

## Próximos Pasos Recomendados

1. Mergear PR #24 a `develop`
2. Configurar filtro IP en GA4 Admin → Data Streams → Define internal traffic
3. Verificar en GA4 Realtime que eventos aparecen con payloads correctos post-deploy
4. Continuar con `BG-117.2` (benchmarking competitivo público) o `BG-116` (landings de intención)
