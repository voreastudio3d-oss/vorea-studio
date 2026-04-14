# Plan Maestro Compartido (IA) — Vorea Studio

Última actualización: 2026-04-05
Estado: `LIMPIEZA_OPERATIVA`

Este archivo es la referencia de ejecución activa del repo.
Regla: aquí solo vive el bloque vigente. El estado/prioridad consolidado vive en `project_backlog.md` y la evidencia diaria en `ai_handoff_YYYY-MM-DD.md`.

## Índice rápido

- Plan activo: `ai_shared_plan.md`
- Backlog consolidado: `project_backlog.md`
- Handoffs vigentes: `.agents/docs/ai_handoff_2026-04-05.md` + `ai_handoff_2026-04-05_migrations-pipeline.md`
- Gobernanza IA: `.agents/skills`
- Bloque activo: `.agents/runtime/current_block.yaml` → `operational-cleanup-sprint`

## Objetivo activo

Siguiente frente recomendado:

1. ✅ Estabilización de deuda técnica (`BG-206` y `BG-207` completados).
2. ✅ Entidades de Comunidad (`BG-106`) migradas a API real (sin mocks), SuperAdmin seguro.
3. **Próximo foco a decidir**: Certificación final de Monetización (Pagos/Gate), Reparaciones Motor 3D/Relief (`BG-109`), o Marketing.
   - Si se retoma Monetización: arrancar por el hardening de AI Studio ya consolidado en `project_backlog.md` (`BG-006` / `BG-008`). El fix del refund mixto `monthly + top-up` ya quedó aplicado; la siguiente secuencia es test de integración del endpoint, `reservation -> capture -> release`, persistencia server-side del resultado, helper compartido de créditos y guardrails sobre rutas críticas.

## Estado del bloque

### Bloque cerrado: Sprint QA + Dashboard (2026-04-14)

**Tareas completadas:**
- **BG-110 ✅** — QA Relief: fix cap winding en cylinder, box, polygon, lampshade. 4 modos watertight, manifold, 0 boundary edges. Smoke assets OK.
- **BG-117.3 ✅** — FODA formalizado en `docs/research/foda-analysis-2026.md` + `FODAAnalysisTab` en SuperAdmin.
- **BG-117.4 ✅** — Dashboard financiero con recharts (`FinancialDashboardTab`) integrado en SuperAdmin: KPI cards, BarChart, PieChart, LineChart.
- **BG-301 ✅** — Motor IA Real verificado (5 proveedores LLM con routing, fallback y budget).
- **Gobernanza ✅** — Tests de gobernanza agéntica corregidos y pasando.
- **Monetización** — 17 tests nuevos de webhook handler PayPal (`paypal-webhook-handler.test.ts`).
- **Suite completa**: 1417 tests, 0 failures, 0 TypeScript errors.

### Bloque anterior: `BG-209 V1.1`

- drift de gobernanza eliminado;
- `pnpm agent:governance:check` agregado al CI;
- `agent:preflight --json` y `agent:git-recover --json` operativos;
- `agent:route --goal` operativo;
- routing mejorado para cambios en `.agents/**` y `agents/openai.yaml`;
- `cross_llm_notes` agregado al contrato machine-readable, pero ya no se publica como orden directa en superficies globales del repo;
- `ai_shared_plan.md`, `project_backlog.md` y `ai_handoff_2026-03-29.md` simplificados a roles claros.

### Bloque real de prueba: `/for/*` vs `/plans`

- gobernanza V1.1 usada de punta a punta sobre un slice comercial real;
- `pnpm agent:preflight --json` y `pnpm agent:route --goal` usados antes de editar;
- landings `/for/makers`, `/for/ai-creators` y `/for/education` ya leen pricing Pro real desde `business-config` sin `$4` hardcodeado;
- copy de pricing en `es/en/pt` alineado a mensajes no cuantitativos compatibles con `/plans`;
- hero de `Membership` ya no promete `colaboración`;
- `route-head.ts` ya cubre metadata específica para `/for/makers`, `/for/ai-creators` y `/for/education`;
- `agent:governance:check` siguió pasando dentro del bloque comercial;
- la deuda previa de `i18n-sync-check` quedó resuelta y permitió usar a Claude sobre un slice de copy/localización real.

## Validaciones corridas en el cierre

- `pnpm agent:sync`
- `pnpm agent:governance:check`
- `pnpm exec vitest run server/__tests__/agent-governance.test.ts`
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm exec vitest run src/app/services/__tests__/route-head.test.ts`
- `node scripts/i18n-sync-check.mjs` -> OK

## Riesgos abiertos

- el routing sigue dependiendo de `applies_to` bien mantenido en cada superficie;
- `typecheck:repo` continúa con deuda legacy fuera de este bloque;
- Claude/Gemini siguen sin adapters físicos específicos en esta pasada;
- la compatibilidad multi-LLM depende de pasarles contexto manual mínimo en vez de confiar en instrucciones globales del repo;
- (Resuelto) `en.json` y `pt.json` ya no tienen claves faltantes respecto de `es.json`, mejorando la ergonomía del flujo multi-LLM para tareas de copy/localización.
- falta seguir validando slices pequeños de UI/copy para confirmar continuidad estable entre modelos.
