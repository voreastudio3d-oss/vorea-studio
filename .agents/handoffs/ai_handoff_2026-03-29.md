# AI Handoff — 2026-03-29

Base estable de referencia al iniciar este bloque: `develop@abc82ca`

## Bloque del día

Endurecimiento agéntico `BG-209 V1.1` sobre la base ya integrada de gobernanza machine-readable.

## Objetivo

1. quitar drift de gobernanza;
2. mejorar router/preflight/git-recover;
3. normalizar surfaces `.agents/**`;
4. publicar una nota directa para Claude y Gemini sobre memoria propia actualizable;
5. dejar las tres superficies de trazabilidad con roles claros.

## Cambios aplicados

- `scripts/agents/lib/governance.ts`:
  - nuevo campo machine-readable `cross_llm_notes`;
  - reporte de coverage OpenAI + matriz de soporte LLM;
  - publicación de notas directas multi-LLM en registry, validation report e índice maestro;
  - warnings más finos sobre duplicación entre plan/backlog/handoff.
- `scripts/agents/lib/router.ts` + `scripts/agents/route.ts`:
  - precedencia real para cambios en `SKILL.md` y `agents/openai.yaml`;
  - soporte `--goal`;
  - `current_block` preserva entradas humanas pero permite override explícito del objetivo.
- `scripts/agents/lib/preflight.ts` + `scripts/agents/preflight.ts`:
  - salida `--json`.
- `scripts/agents/lib/git-recover.ts` + `scripts/agents/git-recover.ts`:
  - salida `--json`.
- `.agents/workflows/skill_review_upgrade_workflow.md` y `.agents/workflows/subagent_routing_workflow.md`:
  - nota directa para Claude y Gemini sobre memoria propia actualizable.
- `.agents/generated/*`, `.agents/skills`, `.agents/skills_catalog/README.md`, `.agents/subagents/README.md`:
  - resincronizados sin drift.
- `guidelines/Guidelines.md`:
  - comandos nuevos y nota operativa multi-LLM.
- `server/__tests__/agent-governance.test.ts`:
  - cobertura para `cross_llm_notes`, routing de `openai.yaml`, `--goal`, `preflight --json` y `git-recover --json`.
- `.github/workflows/ci.yml`:
  - `pnpm agent:governance:check` agregado al pipeline.
- `ai_shared_plan.md`, `project_backlog.md`, `ai_handoff_2026-03-29.md`:
  - simplificados para separar ejecución activa, estado consolidado y evidencia diaria.

## Validaciones corridas

- `pnpm agent:sync`
- `pnpm agent:governance:check`
- `pnpm exec vitest run server/__tests__/agent-governance.test.ts`
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

## Riesgos abiertos

- los adapters concretos siguen siendo solo OpenAI en esta pasada;
- el valor de la nota para Claude/Gemini depende de que consuman registry/superficies compartidas;
- `typecheck:repo` legacy no forma parte del cierre de este bloque.

## Siguiente paso previsto

Usar esta V1.1 en el próximo bloque comercial real: alinear `/for/*` con `/plans` antes de campañas y comprobar la ergonomía del flujo endurecido en una ejecución completa.

## Bloque adicional ejecutado

Dogfood real de la gobernanza V1.1 sobre el frente comercial `/for/*` vs `/plans`.

## Cambios aplicados en el dogfood

- `src/app/services/public-plan-pricing.ts`:
  - hook compartido para pricing público desde `business-config`.
- `src/app/pages/MakerLanding.tsx`, `src/app/pages/AICreatorsLanding.tsx`, `src/app/pages/EducationLanding.tsx`:
  - pricing teaser ahora lee Free/Pro reales y elimina `$4` hardcodeado.
- `src/app/locales/es.json`, `src/app/locales/en.json`, `src/app/locales/pt.json`:
  - copy de pricing alineado a mensajes no cuantitativos compatibles con `/plans`;
  - `membership.subtitle` deja de vender `colaboración`.
- `src/app/route-head.ts`:
  - metadata específica para `/for/makers`, `/for/ai-creators` y `/for/education`.
- `src/app/services/__tests__/route-head.test.ts`:
  - nueva cobertura para metadata de landings `/for/*`.

## Validaciones corridas en el dogfood

- `pnpm exec vitest run src/app/services/__tests__/route-head.test.ts`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm agent:governance:check`

## Hallazgo operativo

`node scripts/i18n-sync-check.mjs` sigue fallando, pero por deuda previa: faltan 20 claves en `en.json` y 21 en `pt.json` respecto de `es.json`. No fue introducido por este slice, pero conviene tomarlo como siguiente bloque candidato para probar Claude/Gemini con una tarea de localización gobernada.

## Próximo paso recomendado

Abrir el siguiente bloque con Claude o Gemini sobre esa deuda `i18n` o sobre otro frente real pequeño, usando:

1. `pnpm agent:preflight --json`
2. `pnpm agent:route --goal "<objetivo>"`
3. `.agents/runtime/current_block.yaml`

Eso ya permite comprobar si el contexto machine-readable se traduce en continuidad real entre modelos, sin depender de instrucciones directas publicadas para proveedores concretos.

## Ajuste adicional por compatibilidad Antigravity

Se eliminó el legado `.agent/workflows/dev-tasks.md` para dejar un solo sistema de workspace-level governance en `.agents/`. La coexistencia de `.agent/` y `.agents/` quedó como sospechosa de conflicto para Antigravity, especialmente en modelos no-OpenAI.

## Investigación adicional sobre Antigravity

Se identificó otra causa potencial mucho más fuerte para el colapso de agentes nativos en este repo:

- existía `worktrees/promote-news` dentro del root del proyecto como `gitlink` (`mode 160000`);
- fue agregado en el commit `be075d1` (`feat(seo): localized server-side metadata and cta text exposure`);
- autor: `Martín Daguerre`;
- el mismo commit también había agregado artefactos `.playwright-cli/`, lo que sugiere un commit de working set y no un submódulo intencional;
- no existe `.gitmodules`, por lo que no estaba configurado como submódulo formal.

Para aislar el workspace:

- se movió físicamente `worktrees/` fuera del repo hacia:
  - `e:\__Vorea-Studio\__3D_parametrics\_workspace_overflow\Vorea-Paramentrics-3D-worktrees-2026-03-29`
- se agregó a `.gitignore`:
  - `.agent/`
  - `worktrees/`
  - `.vite/`

Pendiente intencional:

- consolidar en git la eliminación del `gitlink` `worktrees/promote-news` si la prueba en Antigravity confirma que este era el principal disparador.

## Bloque adicional ejecutado

Sincronización de i18n para `en.json` y `pt.json`.

## Cambios aplicados

- `src/app/locales/en.json` y `src/app/locales/pt.json`:
  - Se agregaron las 20 y 21 claves faltantes (respectivamente) respecto de `es.json` relacionadas a configuración de membresías (mensajes de PayPal, cupones), errores de carga, y presets de relieves (Plane, Cylinder).
  - Queda resuelta la deuda de claves faltantes detectada por `i18n-sync-check`.

## Validaciones corridas

- `pnpm test` (354 tests passed exitosamente en todo el proyecto)
- Node JSON parsers check = valid.

## Bloque adicional ejecutado

Compatibilidad del workspace para Antigravity.

## Cambios aplicados

- se dejaron filtros dedicados en `.antigravityignore` y `.geminiignore`;
- se agregó `Vorea-Paramentrics-3D.antigravity.code-workspace` para abrir el repo con exclusiones de watcher/search;
- se agregó `.vscode/settings.json` con exclusiones para `node_modules/`, `dist/`, `coverage/`, `.playwright-cli/` y `.vite/`;
- se quitaron del índice los artefactos trackeados de `.playwright-cli/` y `.vite/`;
- se movieron copias de resguardo de `.playwright-cli/`, `.vite/`, `coverage/` y `dist/` a:
  - `E:\__Vorea-Studio\__3D_parametrics\_workspace_overflow\Vorea-Paramentrics-3D-antigravity-compat-2026-03-29`
- referencia operativa:
  - `docs/operations/antigravity-workspace-compat-2026-03-29.md`

## Próximo paso recomendado

Probar Antigravity abriendo `Vorea-Paramentrics-3D.antigravity.code-workspace`. Si todavía se cuelga, hacer una prueba con copia limpia del repo sin `node_modules/`.

## Bloque adicional ejecutado

Integración del primer slice generado por Claude dentro del workspace abierto.

## Cambios aplicados

- `src/app/pages/Membership.tsx`:
  - se conserva la navegación canónica a `/plans`;
  - el bloque de top-up pausado mantiene `t(...)` en lugar de copy hardcodeado.
- `src/app/locales/es.json`, `src/app/locales/en.json`, `src/app/locales/pt.json`:
  - se integran las nuevas claves del bloque pausado;
  - se pulen anglicismos innecesarios en `es` y `pt`.
- `src/app/pages/__tests__/membership-page.test.tsx`:
  - nueva cobertura mínima para el estado `creditPacksEnabled = false`.

## Validaciones previstas para cierre

- `node scripts/i18n-sync-check.mjs`
- `pnpm exec vitest run src/app/pages/__tests__/membership-page.test.tsx`
- `pnpm typecheck`
- `pnpm lint`
