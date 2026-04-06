# AI Handoff Diario - 2026-03-22

## 1) Objetivo

Registrar el inicio seguro de Parametric AI V1 con rollback inmutable, rama feature activa, estado de implementacion Sprint 0/1 y forma de retomarlo localmente.

Plan compartido vigente para todas las IAs: `ai_shared_plan.md`.

## 2) Estado Git y ramas de control

- Rama base validada y sincronizada al iniciar: `develop`.
- Punto de retorno inmutable creado/publicado:
  - `codex/rollback/2026-03-22-pre-parametric-v1`
- Rama de desarrollo creada/publicada desde el mismo commit:
  - `codex/feat/parametric-v1-fdm-organic-mcp`
- Rama operativa actual de continuación, luego de ampliar alcance a hardening/SEO/growth:
  - `codex/feat/web-hardening-seo-growth`
- Commit de origen compartido por rollback + feature al momento de creacion:
  - `f96910d`

Regla operativa:
- `codex/rollback/*` no se usa para desarrollo ni merge.
- El desarrollo histórico inicial de Parametric V1 ocurrió en `codex/feat/parametric-v1-fdm-organic-mcp`.
- La continuación operativa actual ocurre en `codex/feat/web-hardening-seo-growth`.

## 3) Entregables implementados en este bloque

### 3.1 Pipeline Parametrico V1 (Sprint 0)

Nuevos modulos:
- `src/app/parametric/instruction-spec.ts`
- `src/app/parametric/spec-builder.ts`
- `src/app/parametric/validation.ts`
- `src/app/parametric/pipeline.ts`
- `src/app/parametric/generators/index.ts`
- `src/app/parametric/generators/fdm-utility.ts`
- `src/app/parametric/generators/organic-decorative.ts`

Contrato inicial implementado:
- `Prompt -> InstructionSpecV1 -> SCAD`
- Perfil de calidad `draft | final`
- Motor `fdm | organic`

### 3.2 AI Studio unificado (Sprint 1 base)

Actualizado:
- `src/app/pages/AIStudio.tsx`

Capacidades:
- Selector en una sola UI: `FDM | Organic`.
- Selector de calidad: `Draft | Final`.
- Generacion con historial de resultados.
- Visualizacion de warnings/spec y validacion FDM.
- Carga de SCAD generado al Studio para render/iteracion.

### 3.3 MCP interno base (Sprint 1 base)

Nuevo modulo:
- `server/mcp-tools.ts`

Integracion backend:
- `server/app.ts`
- Endpoint: `POST /api/internal/mcp/tool/:tool`

Tools iniciales:
- `generate_spec`
- `generate_scad`
- `validate_fdm`
- `compile_preview`

Contrato estable:
- Exito: `{ ok: true, tool, output }`
- Error: `{ ok: false, tool, error: { code, message, details? } }`

## 4) Gobernanza y workflows actualizados

- Nueva regla de proteccion rollback:
  - `.agents/rules/rollback_branch_protection_rule.md`
- Workflow de branching alineado a estrategia actual:
  - `.agents/workflows/git_branching_rule.md`
- Workflow post-commit alineado a PR y rama activa:
  - `.agents/workflows/post_commit_review_rule.md`
- Registro general de reglas/skills actualizado:
  - `.agents/skills`
- Guia operativa completada/normalizada:
  - `guidelines/Guidelines.md`

## 5) Trazabilidad y backlog

Actualizado:
- `ai_shared_plan.md`
- `project_backlog.md`

Items referenciados:
- `BG-111` (Pipeline Parametric AI V1) en progreso.
- `BG-209` (Gobernanza ramas + rollback) en progreso.

## 6) Validaciones ejecutadas

- `npm run test` -> OK.
- `npm run docs:api:generate` -> OK.
- `npm run docs:api:check` -> OK.
- Smoke local backend:
  - `GET /api/health` -> `{ status: "ok" }`
  - `POST /api/internal/mcp/tool/generate_spec` -> OK
  - `POST /api/internal/mcp/tool/generate_scad` -> OK

## 7) Servicios locales para ver avances en vivo

Estado al cierre:
- Frontend Vite: `http://localhost:5173`
- API: `http://localhost:3001`

Logs:
- Frontend: `tmp/runlogs/frontend.out.log` y `tmp/runlogs/frontend.err.log`
- Backend: `tmp/runlogs/backend.out.log` y `tmp/runlogs/backend.err.log`

## 8) Riesgos actuales / atencion inmediata

1. Existen cambios locales simultaneos en archivos de reglas/documentacion y otros modulos; evitar revertir sin revision fina.
2. `compile_preview` aun es heuristico (estimacion), no compilacion real OpenSCAD.
3. Falta hardening progresivo del contrato MCP (versionado de schema de input/output) para orquestacion multiagente mas estricta.

## 9) Proximo bloque recomendado

1. Cerrar Sprint 1 con presets parametricos por dominio (FDM utilitario y Organic decorativo) + pruebas de regresion visual basicas.
2. Agregar capa de persistencia de `InstructionSpecV1` para historial editable por usuario.
3. Extender MCP interno con tool de `compile_final` y reporte de complejidad/tiempos por etapa.
4. Abrir PR desde la rama operativa vigente (`codex/feat/web-hardening-seo-growth`) con checklist de rollback/traceability.

## 10) Skill repo-local de gobernanza IA

Nuevo artefacto versionado:
- `.agents/codex-skills/vorea-repo-governance/SKILL.md`

Alcance:
- Convierte la gobernanza declarada en `AGENTS.md` y `.agents/*` en un flujo operativo para otras IAs.
- Resume orden de lectura, routing por dominio, seleccion de skill/subagente lider, validaciones bloqueantes y evidencia de cierre.

Integracion:
- El indice `.agents/skills` enlaza este skill para descubrimiento directo dentro del repo.

Validaciones ejecutadas:
- `py -3 C:\\Users\\marti\\.codex\\skills\\.system\\skill-creator\\scripts\\quick_validate.py .agents/codex-skills/vorea-repo-governance` -> no ejecutable por entorno (`ModuleNotFoundError: No module named 'yaml'`).
- Validacion estructural manual equivalente del frontmatter (`name`, `description`, formato y limites) -> OK.
- `npm run test` -> OK (`19 files`, `221 tests`).

## 11) Skill repo-local para SCAD parametrico y superficies 3D

Nuevo artefacto versionado:
- `.agents/codex-skills/vorea-parametric-scad-surface/SKILL.md`

Alcance:
- Trabajo sobre el pipeline 3D real del repo:
  - `InstructionSpecV1 -> SCAD`
  - deformaciones/surface modes
  - render `Three.js`
  - export `3MF`/`STL`
  - slicing/`GCODE`
- El skill deja explicitado que `OBJ`, `SVG` y `F3D` no deben tratarse como soporte garantizado sin implementacion verificable.

Integracion:
- El indice `.agents/skills` enlaza este segundo skill junto al de gobernanza general.

Validaciones ejecutadas:
- Validacion estructural manual equivalente del frontmatter (`name`, `description`, formato y limites) -> OK.
- `npm run test` -> OK (`20 files`, `224 tests`) sobre el arbol actual.

## 12) Skill SCAD ampliada para geometria compleja y formatos

Artefactos actualizados:
- `.agents/codex-skills/vorea-parametric-scad-surface/SKILL.md`
- `.agents/codex-skills/vorea-parametric-scad-surface/agents/openai.yaml`
- `.agents/codex-skills/vorea-parametric-scad-surface/references/capability-map.md`

Ampliaciones relevantes:
- El skill ahora dispara tambien ante pedidos de SCAD parametrico complejo, jarrones/formas organicas, patrones Voronoi-like, deformaciones tipo madera y relieves o `surface()` desde imagenes raster.
- Se separa mejor el soporte verificado del repo respecto de formatos o claims todavia no garantizados.
- Se documenta como soporte verificado del pipeline actual:
  - `SCAD`
  - `PNG/JPG/JPEG/WEBP`
  - `STL`
  - `3MF`
  - `GCODE`
- Se documenta como soporte a verificar antes de prometer:
  - `OBJ`
  - carga directa de `SVG`
  - `F3D`

Validaciones ejecutadas:
- `py -3 C:\\Users\\marti\\.codex\\skills\\.system\\skill-creator\\scripts\\quick_validate.py .agents/codex-skills/vorea-parametric-scad-surface` -> OK (`Skill is valid!`) usando `PyYAML` temporal en `tmp\\skill_pydeps`.
- `npm run test` -> OK (`21 files`, `225 tests`).

## 13) Historial AI persistido por usuario + ajuste UX de AI Studio

Cambios implementados:
- Backend autenticado para historial AI:
  - `GET /api/ai/history`
  - `POST /api/ai/history`
  - `DELETE /api/ai/history/:id`
- Persistencia por usuario en `kv_store` bajo clave `ai:history:${userId}`.
- Fallback local para guest y contingencia de lectura:
  - `src/app/services/ai-studio-history.ts`
- Integración UI en `src/app/pages/AIStudio.tsx`:
  - carga automática del historial persistido;
  - badge `Cuenta | Local` también en historial;
  - borrado de entradas persistidas;
  - corrección del contador diario para usar fecha real de generación;
  - corrección de `Cargar + Generar` para respetar `engine/quality/familyHint` de la recipe seleccionada.
- API client:
  - `src/app/services/api-client.ts`

Validaciones ejecutadas:
- `npx vitest run src/app/services/__tests__/ai-studio-history.test.ts server/__tests__/app-ai-history.integration.test.ts` -> OK (`2 files`, `3 tests`).
- `npm run build` -> OK.

Impacto funcional/API:
- AI Studio ahora recupera generaciones previas del usuario autenticado después de recargar o cambiar de sesión.
- El usuario puede eliminar entradas persistidas del historial desde la UI.
- Nuevo contrato backend expuesto:
  - `GET /api/ai/history`
  - `POST /api/ai/history`
  - `DELETE /api/ai/history/:id`

i18n/documentación:
- Sin claves i18n nuevas; AI Studio sigue arrastrando deuda previa de textos hardcodeados en esta V1.
- Documentación visible actualizada:
  - `docs/manual-usuario.md`
  - `docs/profiles/creativos.md`

Riesgos y pendiente recomendado:
- Falta migrar los textos visibles de AI Studio a i18n real para alinear el workflow UX/UI del repo.
- Siguiente bloque natural: preset/versionado de historial + reaplicar una generación persistida como base editable dentro del mismo AI Studio.

## 14) Reaplicar historial editable + URLs limpias + SEO server-side

Cambios implementados:
- AI Studio ahora permite `Reaplicar` una generación persistida como base editable completa:
  - restaura `prompt`, `engine`, `quality`, `familyHint` y `parameterOverrides`;
  - no dispara auto-generación ni consume cupo diario;
  - muestra un estado visible de “base restaurada desde historial”.
- Contrato de historial extendido a `v1.1`:
  - backend/frontend/local storage ahora manejan `familyHint` + `parameterOverrides`;
  - la lectura mantiene compatibilidad retroactiva con entradas `v1.0`.
- Router frontend migrado de hash a History API:
  - rutas limpias activas (`/ai-studio`, `/perfil`, `/noticias/:slug`, `/modelo/:id/:slug?`, `/user/:id/:slug?/modelos`);
  - enlaces hash legacy `/#/...` se normalizan automáticamente al cargar.
- Flujos PayPal adaptados a rutas limpias:
  - `return_url` y `cancel_url` ahora apuntan a `/perfil?...`;
  - `index.html` mantiene shim defensivo para retornos con query en raíz;
  - `Profile` limpia parámetros de retorno sin reintroducir el hash.
- SEO base server-side implementado:
  - metadata dinámica para landing, comunidad, pricing, noticias, detalle de noticia, detalle de modelo, perfil público y legales;
  - rutas privadas/herramientas marcadas `noindex`;
  - nuevos endpoints:
    - `GET /robots.txt`
    - `GET /sitemap.xml`
    - `GET /og/default.svg`
  - `server/server.ts` inyecta `title`, `description`, `canonical`, Open Graph y Twitter cards al servir `index.html` en producción.

Archivos clave:
- `src/app/nav.tsx`
- `src/app/App.tsx`
- `src/app/pages/AIStudio.tsx`
- `src/app/pages/Profile.tsx`
- `src/app/services/ai-studio-history.ts`
- `src/app/services/api-client.ts`
- `server/seo.ts`
- `server/app.ts`
- `server/server.ts`
- `server/paypal-subscriptions.ts`

Validaciones ejecutadas:
- `npx vitest run src/app/services/__tests__/nav.test.ts src/app/pages/__tests__/news-pages.test.tsx src/app/services/__tests__/ai-studio-history.test.ts server/__tests__/app-ai-history.integration.test.ts server/__tests__/seo.test.ts` -> OK (`5 files`, `33 tests`).
- `npm run build` -> OK.

Riesgos y seguimiento:
- El beneficio SEO completo depende de servir las rutas públicas a través del Node server con inyección de head; un deploy estático puro necesita replicar esta capa en edge/prerender.
- Falta smoke específico de callbacks de PayPal en sandbox/live después del próximo deploy.
- Queda deuda i18n en AI Studio y warnings de chunking del build aún no abordados.

## 15) Diagnóstico de publicación actual + plan operativo

Diagnóstico real del dominio público (`voreastudio3d.com`):

- el bloque histórico quedó empujado a `codex/feat/parametric-v1-fdm-organic-mcp`;
- la continuación operativa vigente se mueve a `codex/feat/web-hardening-seo-growth`;
- el dominio público todavía sirve la build vieja con hash routing;
- `/ai-studio` carga landing;
- `/#/ai-studio` sí funciona;
- `/robots.txt` y `/sitemap.xml` devuelven HTML SPA.

Conclusión:

- la publicación activa sigue en Netlify SPA estática o todavía no tomó esta versión;
- la mejora completa de URLs limpias + SEO server-side no se verá en producción hasta desplegar la versión nueva o mover el frontend público a un runtime Node compatible.

Documento operativo agregado:

- `docs/operations/publishing-routing-seo-plan.md`

Recomendación actual:

1. si se busca velocidad y consistencia, publicar el frontend público desde Node (`server/server.ts`);
2. si se mantiene Netlify estático, abrir iniciativa específica de Edge/Prerender para metadata y archivos SEO.

## 16) Smoke script reutilizable para routing/SEO de deploy

Nuevo artefacto:

- `scripts/verify-deploy-routing-seo.ts`

Script disponible vía:

- `npm run verify:deploy:routing-seo -- https://voreastudio3d.com`

Uso:

- verifica `robots.txt`;
- verifica `sitemap.xml`;
- verifica `canonical`/metadata pública en `/noticias`;
- verifica `noindex` en `/ai-studio`;
- intenta `GET /api/health` sobre `api.<dominio>` o sobre `VOREA_VERIFY_API_BASE_URL` si se define manualmente.

Propósito:

- dejar un smoke técnico repetible post-deploy para BG-108;
- reducir validaciones manuales inconsistentes entre IAs o sesiones.

## 17) Build con artefactos SEO estáticos

Cambios implementados:

- `npm run build` ahora genera además:
  - `dist/robots.txt`
  - `dist/sitemap.xml`
  - `dist/og/default.svg`
- Nuevo script:
  - `scripts/generate-static-seo-assets.ts`
- `Dockerfile` quedó alineado para usar `npm run build` y no solo `vite build`.

Impacto:

- mejora el deploy SPA/Netlify actual porque puede servir archivos SEO reales desde `dist`;
- no resuelve todavía metadata dinámica por ruta ni `noindex` privado, que siguen dependiendo de Node o Edge/prerender.

## 18) Decisión oficial para BG-108

Decisión tomada el 2026-03-23:

- se adopta `Node` como frontend público para `voreastudio3d.com`;
- Netlify queda como legado o contingencia, no como arquitectura objetivo.

Implicancias prácticas:

- el smoke técnico ahora considera como principal `https://voreastudio3d.com/api/health`;
- el siguiente bloque operativo es el cutover del dominio principal al runtime Node;
- `api.voreastudio3d.com` puede mantenerse durante transición, pero ya no es requisito como frontend/API separados.

## 19) Checklist ejecutable de cutover Railway

Nuevo documento operativo:

- `docs/operations/railway-node-cutover-checklist.md`

Cobertura:

- precondiciones;
- variables y dominio en Railway;
- dry run sobre host temporal;
- cutover DNS;
- smoke técnico/manual;
- validación de PayPal y Google;
- rollback de publicación.

## 20) Bridge temporal Netlify -> Railway Node

Implementación operativa posible desde este entorno:

- `netlify.toml` ahora puede usarse para que `voreastudio3d.com` proxee todo el tráfico no-API hacia `https://api.voreastudio3d.com/:splat`.

Objetivo:

- exponer el runtime Node de Railway en el dominio principal aunque todavía no se haya movido DNS directo a Railway.

Límite:

- esto no reemplaza el cutover final de infraestructura;
- `api.voreastudio3d.com` debe mantenerse durante la transición mientras el bridge esté activo.

## 21) Incidente de healthcheck en Railway después del merge a `develop`

Estado observado el 2026-03-23:

- PR `#16` mergeado correctamente a `develop`;
- Railway construyó la imagen y terminó build exitosamente;
- el deploy nuevo falló en healthcheck `/api/health`, por lo que el dominio siguió sirviendo la versión previa.

Causa raíz identificada:

- `server/mcp-tools.ts` importa módulos compartidos desde `../src/app/parametric/*`;
- el `Dockerfile` productivo solo copiaba `server/`, `utils/`, `prisma/` y `dist/`;
- dentro del contenedor, el proceso no encontraba `src/app/parametric`, por lo que no lograba arrancar correctamente.

Corrección aplicada:

- `Dockerfile` actualizado para copiar `src/app/parametric/` en la imagen de producción.

Validaciones corridas:

- `npx prisma validate` -> OK.
- `npm run test -- --run server/__tests__/app-ai-recipes.integration.test.ts server/__tests__/app-ai-history.integration.test.ts` -> OK.
- Smoke local en `NODE_ENV=production`:
  - `GET /api/health` -> 200 `{"status":"ok"}`
  - `GET /robots.txt` -> 200 con contenido SEO esperado.

Estado de datos productivos:

- Railway Postgres validado con queries manuales;
- `orphan_models`, `orphan_gcode_items`, `orphan_export_credits`, `orphan_feedback` -> `0`;
- `ai_recipe_keys` y `ai_history_keys` -> `0`;
- `kv_store` productivo solo contiene claves administrativas, sin legado sensible de AI Studio.

Siguiente paso operativo:

1. empujar este hotfix;
2. abrir PR incremental hacia `develop` y mergearlo;
3. esperar redeploy saludable de Railway;
4. rerun smoke técnico sobre `https://voreastudio3d.com`;
5. configurar `www` como redirect a `voreastudio3d.com` en Cloudflare (sin consumir otro custom domain en Railway).

Nota adicional:

- en logs de Railway apareció `npm warn exec The following package was not found and will be installed: tsx@4.21.0`;
- no fue la causa del fallo principal, pero deja un arranque menos determinista;
- el `Dockerfile` quedó ajustado para arrancar con `./node_modules/.bin/tsx` en lugar de `npx tsx`.

Estado posterior al redeploy sano:

- `https://voreastudio3d.com/api/health` -> OK;
- `https://voreastudio3d.com/noticias` -> título y `canonical` correctos;
- `https://voreastudio3d.com/ai-studio` -> `noindex` correcto;
- `https://voreastudio3d.com/sitemap.xml` -> OK;
- `https://voreastudio3d.com/robots.txt` sin query puede devolver HTML viejo por `cf-cache-status: HIT`, pero `https://voreastudio3d.com/robots.txt?fresh=1` ya devuelve el texto correcto desde origin.

Mitigación adicional aplicada:

- `server/app.ts` ahora envía `Cache-Control` corto para `robots.txt` y `sitemap.xml` con el objetivo de reducir residuos de caché de Cloudflare en redeploys futuros.

Pendientes operativos:

1. purge de caché en Cloudflare para `/robots.txt`;
2. smoke manual de login/perfil/PayPal sandbox/AI Studio persistencia;
3. redirect de `www.voreastudio3d.com` a `https://voreastudio3d.com`.

## 22) Auditoría de integridad de rutas y acceso (2026-03-23)

Qué se revisó:

- snapshot limpio de `origin/develop` (`45c922c`) para no contaminar el análisis con el worktree operativo;
- routing frontend;
- navegación de herramientas;
- endpoints backend sensibles;
- persistencia local que sobrevive al logout.

Conclusiones:

1. No se encontró una escalación obvia de privilegios hacia backend:
   - `tool-actions`, `gcode`, `paypal create/capture`, `community write`, `ai recipes/history`, `vault`, `uploads` y rutas `admin/*` siguen protegidas en servidor.
2. Sí hay deriva de política de acceso en frontend:
   - `App.tsx` solo centraliza `AdminGuard`;
   - varias herramientas siguen siendo accesibles por URL sin una política unificada de `AuthGuard`.
3. Riesgo de privacidad local detectado:
   - `GCodeCollectionService` sigue persistiendo `vorea_gcode_collection` en `localStorage`;
   - el logout no limpia esa colección, por lo que en un navegador compartido puede quedar visible material del usuario anterior.
4. Endpoint público a revisar:
   - `GET /api/rewards/:userId` expone un perfil de recompensas crudo y hoy no es necesario para la UI pública actual.

Plan agregado:

- `BG-112`: hardening de acceso por rutas, `AuthGuard`, limpieza post-logout y poda de exposición pública innecesaria.
- `BG-113`: donación voluntaria con insignias de colaborador, niveles de aporte y nueva página `/colaboradores`.

Validaciones ejecutadas:

- `npx vitest run server/__tests__/app-community.integration.test.ts server/__tests__/app-monetization.integration.test.ts` -> OK (`2 files`, `13 tests`).

Notas de evidencia:

- el worktree limpio usado para la auditoría no tenía `node_modules`, por lo que la parte frontend del review quedó soportada por inspección de código sobre ese snapshot, no por ejecución de tests dentro de ese worktree.

Siguiente paso recomendado:

1. implementar `BG-112` con una matriz explícita de rutas públicas/auth/admin;
2. decidir si `/studio`, `/organic`, `/relief` y `/makerworld` quedan como trial público o pasan a ser autenticadas;
3. luego abrir discovery/implementación de `BG-113` sobre PayPal-first y recompensas simbólicas.

## 23) BG-112/BG-114 iniciales — hardening, contacto real y SEO/i18n sincronizado

Cambios implementados en este bloque:

1. Hardening inicial de acceso frontend:
   - nueva matriz explícita de rutas en `src/app/route-access.ts`;
   - nuevos guards reutilizables en `src/app/route-guards.tsx`;
   - `/perfil` y `/gcode-collection` ahora exigen sesión;
   - `/admin` y `/feedback-admin` exigen rol `superadmin`;
   - `Root.tsx` ya no muestra navegación auth/admin a quien no corresponde.
2. Limpieza post-logout:
   - nuevo `src/app/services/session-cleanup.ts`;
   - `auth-context.tsx` limpia auth/modelos/gcode/recipes/history guest y estado efímero al cerrar sesión.
3. Medición y captura base:
   - nuevo `src/app/services/analytics.ts`;
   - eventos iniciales: `sign_up_start`, `sign_up_complete`, `open_editor`, `view_pricing`, `open_ai_studio`, `news_cta_click`, `contact_submit`;
   - `POST /api/contact` agregado en `server/app.ts`;
   - `Contact.tsx` ahora envía el formulario real y devuelve referencia visible al usuario.
4. SEO técnico ampliado:
   - `server/seo.ts` ahora emite `og:locale`, `hreflang`, `WebSite`, `Organization`, `BreadcrumbList` y `NewsArticle`;
   - `sitemap.xml` pasó a ser índice y se agregaron:
     - `GET /sitemaps/core.xml`
     - `GET /sitemaps/community.xml`
     - `GET /sitemaps/news.xml`
   - `scripts/generate-static-seo-assets.ts` genera también esos sitemaps por sección.
5. SEO/i18n client-side:
   - nuevo `src/app/route-head.ts`;
   - `App.tsx` y `NewsDetail.tsx` sincronizan `title`, `description`, `robots`, `canonical`, `og:*` y `twitter:*` cuando cambia ruta o locale;
   - esto resuelve la UX del cambio de idioma sin recarga para el `head` visible en navegador.
6. Página pública base creada:
   - `src/app/pages/Contributors.tsx`
   - nueva ruta `/colaboradores` montada en `App.tsx`.
7. Exposición pública endurecida:
   - `GET /api/rewards/:userId` quedó reducido a un resumen público mínimo derivado de `user:${userId}:rewards`.
8. Noticias:
   - `server/news-service.ts` ahora descarta mejor URLs de `about/privacy/terms/support/archive/events/downloads/contact/careers/...`.

Validaciones ejecutadas:

- `npx vitest run src/app/services/__tests__/route-access.test.ts src/app/services/__tests__/route-head.test.ts src/app/pages/__tests__/contact-page.test.tsx server/__tests__/app-contact.integration.test.ts server/__tests__/seo.test.ts server/__tests__/news-service.test.ts` -> OK (`6 files`, `14 tests`).
- `npm run test` -> OK (`28 files`, `245 tests`).
- `npm run build` -> OK.
- `npm run docs:api:generate` -> OK.
- `npm run docs:api:check` -> OK.

Impacto funcional/API:

- Nuevas rutas/contratos backend:
  - `POST /api/contact`
  - `GET /sitemaps/:section.xml`
- Nuevo scaffold público:
  - `/colaboradores`
- Cambio de contrato público:
  - `GET /api/rewards/:userId` ahora expone un DTO público mínimo y ya no el perfil crudo anterior.

Impacto i18n:

- No se agregaron claves nuevas en `src/app/locales/*`.
- Se eligió evitar expansión de keys en este bloque para no mezclar hardening/SEO con una migración completa de textos.
- Sí se agregó sincronización explícita de `head` por locale en cliente.

Nota importante de SEO multilenguaje:

1. La sync client-side de `title`, `og:*` y `twitter:*` mejora la experiencia cuando el usuario cambia idioma sin recargar.
2. Pero esta mejora **no alcanza por sí sola** para previews sociales/crawlers realmente localizados:
   - mientras el locale no tenga URL propia ni selección server-side estable, Open Graph/Twitter de una URL compartida seguirán dependiendo principalmente de la versión server-side por defecto.
3. Esta deuda queda incorporada formalmente a `BG-114`:
   - evaluar estrategia de URLs por locale (`/en/...`, `/pt/...` o equivalente canónico).

Próximo paso recomendado:

1. completar el gating fino de trial para save/publish/export/acciones costosas donde aún falte;
2. seguir con `BG-114` para dominio/marca restante y estrategia de locale-addressable URLs;
3. abrir implementación persistida de `BG-113` (donaciones + colaboradores reales) sobre esta base ya más segura.

## 24) BG-112 — cierre adicional de gating fino en rutas trial (2026-03-23)

Cambios implementados:

1. Nuevo helper común:
   - `src/app/services/protected-tool-actions.ts`
   - encapsula el patrón `auth required` vs `plan denied` para acciones protegidas en frontend.
2. `Organic.tsx`:
   - la acción `Compilar en el Editor` ya no cae en 401 crudo;
   - si no hay sesión, abre `AuthDialog` con CTA claro;
   - si hay sesión pero el plan no lo incluye, muestra el error de producto.
3. `MakerWorld.tsx`:
   - export/preparación usa el mismo helper;
   - mejora la UX del gate sin cambiar la política server-side.
4. `Relief.tsx`:
   - export STL y 3MF quedaron alineados con el mismo gate explícito;
   - la publicación ya estaba protegida y se mantuvo.
5. `Editor.tsx`:
   - export `.STL`, `.OBJ` y `.SCAD` ahora pasan por `ToolActionsApi.consume` según `studio.download_*`;
   - esto cierra un bypass real donde el editor exportaba localmente sin respetar cupos/plan;
   - abrir el diálogo de publicación desde el panel derecho ahora exige sesión;
   - guardar GCode en colección vuelve a verificar sesión antes de persistirlo.

Validaciones ejecutadas:

1. `npx vitest run src/app/services/__tests__/protected-tool-actions.test.ts src/app/services/__tests__/route-access.test.ts` -> OK (`2 files`, `7 tests`).
2. `npm run test` -> OK (`29 files`, `249 tests`).
3. `npm run build` -> OK.

Tests nuevos:

1. `src/app/services/__tests__/protected-tool-actions.test.ts`
   - logged out -> abre auth sin llamar API;
   - auth expirada -> reabre login;
   - plan denegado -> muestra error de plan sin abrir auth;
   - success -> retorna permitido.

Impacto funcional:

1. se reduce la diferencia entre “trial público” y “acción realmente permitida”;
2. el usuario ahora ve una transición clara al login cuando intenta retener/exportar valor;
3. el editor deja de ser una vía de export no controlada frente al backend.

Impacto API:

1. no se agregaron rutas nuevas;
2. se reutilizó `/api/tool-actions/consume` como fuente de verdad para cupos/plan.

Impacto i18n:

1. no se agregaron claves nuevas;
2. los mensajes operativos nuevos quedaron inline en español para no mezclar este bloque con un barrido masivo de locales.

Estado después de este bloque:

1. `BG-112` queda más maduro, pero no totalmente cerrado:
   - falta revisar si aún quedan acciones retenibles sensibles fuera de este circuito;
   - falta decidir si algunas persistencias guest deben migrar de `localStorage` a `sessionStorage` o namespace temporal.
2. el siguiente bloque natural puede ser:
   - terminar `BG-112`,
   - o saltar a `BG-113` real (donaciones/ledger/colaboradores) sobre una base de acceso más sólida.

## 25) BG-112 — comunidad/publicación con gate explícito + retiro de legado Supabase (2026-03-23)

Cambios implementados:

1. Nuevo helper:
   - `src/app/services/protected-auth-interactions.ts`
   - centraliza el patrón “si no hay sesión, avisar y abrir `AuthDialog`”.
2. `PublishDialog.tsx`:
   - guardar borrador/publicar ya no dependen de botones deshabilitados cuando el usuario es guest;
   - el intento de publicar sin login abre `AuthDialog` con mensaje claro.
3. `ModelDetail.tsx`:
   - `like`, `comment` y `open/fork` ahora abren gate de login en lugar de quedarse en toast pasivo;
   - la caja de comentarios guest ahora ofrece botón real de acceso.
4. `Explore.tsx`:
   - `like` ahora usa el mismo gate explícito y abre `AuthDialog`.
5. `session-cleanup.ts`:
   - agrega limpieza de `vorea_compilation_logs` al logout.
6. Legado:
   - se eliminaron `supabase/functions/server/index.tsx` y `supabase/functions/server/kv_store.tsx`;
   - quedaron confirmados como backend obsoleto, sin referencias vivas de runtime.

Validaciones ejecutadas:

1. `npx vitest run src/app/services/__tests__/protected-auth-interactions.test.ts src/app/services/__tests__/session-cleanup.test.ts src/app/services/__tests__/protected-tool-actions.test.ts` -> OK (`3 files`, `7 tests`).
2. `npm run test` -> OK (`31 files`, `252 tests`).
3. `npm run build` -> OK.

Tests nuevos:

1. `src/app/services/__tests__/protected-auth-interactions.test.ts`
2. `src/app/services/__tests__/session-cleanup.test.ts`

Impacto funcional:

1. `BG-112` queda mucho más consistente en comunidad/publicación:
   - menos fricción muda;
   - más claridad de camino al login;
   - menos dependencia de errores crudos del backend o de botones bloqueados.
2. El logout limpia mejor rastros locales en navegadores compartidos.
3. El repo ya no arrastra el backend legacy de Supabase dentro del árbol activo.

Impacto API:

1. sin cambios de rutas o contratos backend.

Impacto i18n:

1. sin claves nuevas;
2. se reutilizaron mensajes existentes para no mezclar este bloque con un barrido de locales.

## 26) BG-112/BG-114 — cleanup de legado Supabase y TTL para guest AI Studio (2026-03-23)

Cambios implementados:

1. Se limpiaron referencias activas a Supabase en superficies de producto/equipo:
   - `server/app.ts`: `/api/auth/social-providers` ya no apunta a `Supabase Dashboard`;
   - `SuperAdmin.tsx`: textos de sesión/autenticación pasan a lenguaje agnóstico del backend actual;
   - `GCodeCollection.tsx`, `src/app/services/db/adapter.ts` y `src/app/services/db/prisma-adapter.ts` eliminan referencias desactualizadas.
2. Se eliminó `utils/supabase/info.tsx`:
   - era duplicado legado de `utils/config/info.tsx`;
   - no tenía consumidores vivos en runtime.
3. Se endureció guest state de AI Studio con expiración:
   - `src/app/services/ai-studio-history.ts`
   - `src/app/services/ai-studio-recipes.ts`
   - recipes/history del owner `guest` caducan a los 14 días.
4. Se contextualizó `project_health_report.md`:
   - ahora aclara que sus menciones al backend Supabase son históricas y no arquitectura vigente.

Validaciones ejecutadas:

1. `npx vitest run src/app/services/__tests__/ai-studio-history.test.ts src/app/services/__tests__/ai-studio-recipes.test.ts src/app/services/__tests__/protected-auth-interactions.test.ts src/app/services/__tests__/session-cleanup.test.ts` -> OK (`4 files`, `11 tests`).
2. `npm run docs:api:generate` -> OK.
3. `npm run docs:api:check` -> OK.
4. `npm run build` -> OK.

Decisión funcional:

1. No se pasó AI Studio guest a `sessionStorage`.
2. Se eligió TTL de 14 días para equilibrar:
   - continuidad del trial y adopción;
   - menor arrastre en navegador compartido.
3. Se evaluó la estructura `.scad` del repo:
   - `public/scad-library/models/*` sigue siendo dataset runtime del explorador/biblioteca SCAD;
   - `src/imports/examples/*` y `src/imports/models/*` funciona como corpus de ejemplos, aprendizaje y prueba del intérprete;
   - no se recomienda fusionar o borrar masivamente una de las carpetas sin una migración explícita del flujo que hoy consume `ScadLibrary.tsx`.

Impacto API:

1. sin rutas nuevas;
2. la documentación regenerada deja de presentar `Supabase Dashboard` como instrucción activa del endpoint social-providers.

## 27) BG-113 — donaciones PayPal reales + ledger + mural de colaboradores (2026-03-23)

Cambios implementados:

1. Se agregó `server/donations.ts`:
   - tiers V1 (`impulsor`, `aliado`, `patrono`, `mecenas`);
   - badge derivado por aporte acumulado;
   - ordenamiento del mural público.
2. Nuevas rutas en `server/app.ts`:
   - `GET /api/contributors`
   - `GET /api/donations/me`
   - `POST /api/donations/create-order`
   - `POST /api/donations/capture-order`
3. Persistencia inicial en `kv_store`:
   - `paypal:donation:order:*`
   - `donation:entry:*`
   - `user:{id}:donations`
   - `user:{id}:contributor`
   - `contributors:public`
4. Al capturar una donación:
   - se valida monto/moneda;
   - se registra ledger auditable;
   - se actualiza resumen del colaborador;
   - se sincroniza el badge en `user:{id}:rewards`;
   - se registra actividad + audit log.
5. `src/app/pages/Contributors.tsx` dejó de ser scaffold:
   - carga tiers y colaboradores públicos reales;
   - muestra el estado del usuario autenticado;
   - permite elegir reconocimiento público y mensaje;
   - maneja el retorno/cancelación de PayPal con captura posterior.
6. Se añadieron badges de colaborador en:
   - `src/app/pages/Profile.tsx`
   - `src/app/pages/UserPublic.tsx`
   - locales `es/en/pt`
7. Se corrigió el parser documental:
   - `scripts/api-docs-utils.mjs` ahora detecta solo rutas Hono reales;
   - deja de capturar falsos positivos de `kv.get(...)`.

Tests nuevos:

1. `server/__tests__/app-donations.integration.test.ts`
2. `src/app/pages/__tests__/contributors-page.test.tsx`

Validaciones ejecutadas:

1. `npx vitest run server/__tests__/app-donations.integration.test.ts src/app/pages/__tests__/contributors-page.test.tsx` -> OK (`2 files`, `4 tests`).
2. `npm run test` -> OK (`33 files`, `258 tests`).
3. `npm run docs:api:generate` -> OK.
4. `npm run docs:api:check` -> OK.
5. `npm run build` -> OK.

Impacto funcional:

1. `BG-113` entra en fase funcional real:
   - aporte único voluntario con PayPal;
   - insignia de colaborador por aporte acumulado;
   - mural público sin exponer montos exactos por usuario.
2. La página `/colaboradores` ya sirve para comunidad/SEO y también para activación del programa de apoyo.

Pendiente inmediato:

1. revisar copy/legal de reembolsos y soporte del programa;
2. decidir si el tab `Donaciones` también necesita acciones futuras de refund/manual review.

## 28) BG-113 — cierre del slice admin + edición post-pago del colaborador (2026-03-23)

Cambios implementados:

1. `server/app.ts` completó el bloque operativo pendiente:
   - `GET /api/admin/donations`
   - `PUT /api/admin/contributors/:userId`
   - `PUT /api/donations/me`
2. Se consolidó la semántica de privacidad:
   - pasar a anónimo remueve al usuario de `contributors:public`;
   - el mensaje público se limpia en servidor cuando `publicContributor=false`;
   - volver a público reindexa el muro con mensaje sanitizado.
3. `src/app/services/api-client.ts` quedó alineado con el backend:
   - `AdminApi.listDonations()`
   - `AdminApi.updateContributorVisibility(userId, input)`
   - `DonationsApi.updateMine(input)`
   - tipos admin para órdenes, contributors y stats.
4. `src/app/pages/DonationsAdminTab.tsx` quedó integrado en `src/app/pages/SuperAdmin.tsx`:
   - tab dedicado `Donaciones`;
   - cards de resumen;
   - búsqueda/filtro por estado o texto;
   - órdenes recientes;
   - moderación por colaborador sin recargar la app.
5. `src/app/pages/Contributors.tsx` ahora soporta edición post-pago:
   - si el usuario autenticado ya tiene `summary`, puede actualizar visibilidad y mensaje sin donar otra vez;
   - el bloque conserva su rol pre-pago para configurar la siguiente donación.

Tests nuevos/actualizados:

1. `server/__tests__/app-donations.integration.test.ts`
2. `src/app/pages/__tests__/contributors-page.test.tsx`
3. `src/app/pages/__tests__/donations-admin-tab.test.tsx`

Validaciones ejecutadas:

1. `npx vitest run src/app/pages/__tests__/contributors-page.test.tsx` -> OK (`1 file`, `2 tests`).
2. `npm run test` -> OK (`34 files`, `263 tests`).
3. `npm run docs:api:generate` -> OK.
4. `npm run docs:api:check` -> OK.
5. `npm run build` -> OK.

Impacto funcional:

1. `BG-113` queda usable de punta a punta en V1:
   - donación única PayPal-first;
   - ledger auditable;
   - insignia de colaborador;
   - mural público;
   - edición posterior de anonimato/mensaje;
   - tab admin de trazabilidad y moderación.
2. La superficie pública sigue sin exponer importes exactos por usuario, pero admin sí conserva visibilidad operativa del monto/estado por orden.

## 29) UX admin — `SuperAdmin` pasa a navegación vertical lateral (2026-03-23)

Cambios implementados:

1. `src/app/pages/SuperAdmin.tsx` dejó el esquema de tabs horizontales con overflow.
2. El panel ahora usa:
   - navegación lateral vertical para secciones admin;
   - agrupación por áreas operativas (`Operación`, `Monetización`, `Contenido y comunidad`, `Sistema`);
   - cabecera de sección activa en el panel de contenido.
3. La motivación fue mejorar usabilidad y escalabilidad para módulos largos como `Donaciones`, `Comunidad`, `Noticias` y `Finanzas`.

Validaciones ejecutadas:

1. `npm run test` -> OK (`34 files`, `263 tests`).
2. `npm run build` -> OK.

## 30) BG-113 — cierre del residual de copy/legal y soporte público (2026-03-23)

Cambios implementados:

1. `src/app/pages/Contributors.tsx` agregó un bloque explícito de condiciones del programa y soporte.
2. Desde la UI pública quedó aclarado que:
   - el aporte es voluntario;
   - no reemplaza suscripciones ni desbloquea funcionalidades ocultas;
   - la visibilidad pública puede editarse después del pago;
   - cargos duplicados o incorrectos se revisan caso a caso con `orderId`.
3. `docs/manual-usuario.md` se actualizó para dejar de presentar `/colaboradores` como una feature “en preparación”.

Validaciones ejecutadas:

1. `npx vitest run src/app/pages/__tests__/contributors-page.test.tsx src/app/pages/__tests__/donations-admin-tab.test.tsx` -> OK (`2 files`, `4 tests`).
2. `npm run build` -> OK.

Residual real:

1. Si producto quiere formalizar refunds/manual review en admin, eso ya sería un sub-bloque nuevo, no un faltante de V1 pública.

## 31) BG-115 — depuración editorial y rediseño UX/UI de Noticias (2026-03-23)

Cambios implementados:

1. `server/news-service.ts` endureció la ingesta/editorialización:
   - filtro adicional para páginas thin commercial o casi-catálogo;
   - rechazo de rutas y señales como `shop`, `store`, `cart`, `checkout`, `impresion-3d-y-laser`, `filamentos`, `resinas`, `accessories`, `spare-parts`;
   - `summary`, `detail` y `whyItMatters` más diferenciados;
   - preservación de contexto útil cuando existe, en lugar de pisarlo siempre con fallback genérico.
2. Se agregó `src/app/news-presentation.ts` como capa de composición UX:
   - deck editorial por nota;
   - dedupe de contexto;
   - regla para mostrar el título original solo cuando realmente difiere;
   - fallback homogéneo para `whyItMatters`.
3. `src/app/pages/NewsDetail.tsx` dejó de repetir el mismo texto en múltiples bloques:
   - hero con deck editorial;
   - contexto ampliado renderizado solo si agrega información;
   - panel lateral sin duplicar `source` y `original source`;
   - CTA final más orientado a acción.
4. `src/app/pages/NewsList.tsx` mejoró la lectura del feed:
   - CTA `Leer análisis / Read analysis`;
   - CTA separada para fuente original;
   - featured y cards con deck editorial breve, reduciendo eco de la fuente.
5. Locales `es/en` ampliados para soportar esta capa editorial nueva.

Tests nuevos/actualizados:

1. `server/__tests__/news-service.test.ts`
2. `src/app/pages/__tests__/news-pages.test.tsx`
3. `src/app/services/__tests__/news-presentation.test.ts`

Validaciones ejecutadas:

1. `npx vitest run server/__tests__/news-service.test.ts src/app/pages/__tests__/news-pages.test.tsx src/app/services/__tests__/news-presentation.test.ts` -> OK (`3 files`, `10 tests`).
2. `npm run build` -> OK.

Impacto funcional:

1. Las páginas de Noticias se sienten bastante menos automáticas y más editoriales.
2. El caso visual señalado por el usuario (repetición hero/resumen/contexto/por qué importa/atribución) queda corregido en la capa de presentación.
3. La heurística reduce la probabilidad de que páginas comerciales delgadas entren al feed como si fueran noticias atractivas.

Pendiente siguiente dentro de `BG-115`:

1. persistir tier editorial (`brief/indexable/evergreen`);
2. decidir política `noindex` para briefs pobres;
3. sumar CTA/contexto propio persistido por nota en vez de solo composición dinámica.

## 32) BG-115 — limpieza de boilerplate legacy en lectura (2026-03-23)

Cambios implementados:

1. `server/news-service.ts` ahora limpia en tiempo de lectura los resúmenes/detalles guardados con el formato antiguo:
   - `Resumen editorial de ...:`
   - `Editorial summary from ...:`
   - `La fuente original publicó...`
   - `The original source published...`
2. La normalización se aplica antes de responder `listNews` y `getNewsDetail`, por lo que mejora inmediatamente notas ya almacenadas.
3. Luego de limpiar el copy, la capa vuelve a deduplicar `detail` contra `summary` para evitar que reaparezca repetición en la UI nueva.

Tests nuevos/actualizados:

1. `server/__tests__/news-service.test.ts`

Validaciones ejecutadas:

1. `npx vitest run server/__tests__/news-service.test.ts src/app/pages/__tests__/news-pages.test.tsx src/app/services/__tests__/news-presentation.test.ts` -> OK (`3 files`, `11 tests`).
2. `npm run build` -> OK.

Impacto funcional:

1. La mejora visual ya desplegada para Noticias puede lucir mejor contenido sin depender todavía de una reingesta/backfill.
2. El caso de notas viejas que seguían mostrando frases genéricas queda mitigado desde la propia lectura del API.

## 33) BG-115 — tier editorial persistido, briefs fuera de indexación y saneo de imágenes (2026-03-23)

Cambios implementados:

1. `server/news-repository.ts` agrega persistencia idempotente para:
   - `editorialTier`: `brief | indexable | evergreen`;
   - `indexable`: boolean.
2. `server/news-service.ts` ahora:
   - clasifica cada nota según señal editorial real;
   - reutiliza esa clasificación también como fallback para registros previos;
   - sanea URLs de imagen rotas o mal formadas antes de devolverlas al cliente.
3. `server/seo.ts` pasa a excluir briefs débiles del sitemap de noticias y los sirve con `noindex, follow`.
4. `src/app/pages/NewsList.tsx` reorganiza el feed en:
   - featured no-brief;
   - grid principal de historias con más valor;
   - bloque separado `Radar breve` para señales rápidas.
5. `src/app/pages/NewsDetail.tsx` suma badge por tier y fallback visual más resistente ante imágenes remotas caídas.
6. `src/app/news-presentation.ts` agrega metadatos legibles por tier para mantener consistencia entre cards y detalle.

Tests nuevos/actualizados:

1. `server/__tests__/news-service.test.ts`
2. `server/__tests__/seo.test.ts`
3. `src/app/pages/__tests__/news-pages.test.tsx`
4. `src/app/services/__tests__/news-presentation.test.ts`

Validaciones ejecutadas:

1. `npx vitest run server/__tests__/news-service.test.ts server/__tests__/seo.test.ts src/app/pages/__tests__/news-pages.test.tsx src/app/services/__tests__/news-presentation.test.ts` -> OK (`4 files`, `19 tests`).
2. `npm run test` -> OK (`35 files`, `273 tests`).
3. `npm run docs:api:check` -> OK.
4. `npm run build` -> OK.

Impacto funcional:

1. El feed deja de mostrar el mismo peso editorial para piezas profundas y piezas breves.
2. Las piezas débiles ya no empujan indexación ni ensucian el sitemap.
3. El caso observado en producción con imágenes remotas malformed queda cubierto desde la sanitización en backend.

## 34) BG-115 — gobernanza por fuente y modo `solo brief` (2026-03-23)

Cambios implementados:

1. `server/news-repository.ts` agrega persistencia de dos señales nuevas por fuente:
   - `editorialPolicy`: `standard | brief_only`;
   - `editorialNotes`: nota interna opcional.
2. `server/news-service.ts` respeta esa política editorial en la clasificación:
   - si la fuente está en `brief_only`, cualquier pieza queda forzada a `brief`;
   - además sale de indexación (`indexable = false`) y por tanto no compite por sitemap.
3. `src/app/pages/NewsSourcesTab.tsx` ahora permite gobernar la calidad por fuente desde UX clara:
   - badge `Estándar` o `Solo brief`;
   - selector de política editorial;
   - notas internas para dejar contexto operativo;
   - copy que explica cuándo conviene degradar una fuente sin apagarla.
4. `server/news-sources.ts` deja preconfiguradas como `brief_only` algunas fuentes especialmente comerciales o repetitivas:
   - `Macrotec Uruguay`;
   - `Fabrix Uruguay`;
   - `Creality Blog`.
5. `src/app/services/api-client.ts` suma contratos tipados para esta nueva gobernanza, evitando que el panel siga operando sobre `any`.

Tests nuevos/actualizados:

1. `server/__tests__/news-service.test.ts`
2. `src/app/pages/__tests__/news-sources-tab.test.tsx`

Validaciones ejecutadas:

1. `npx vitest run server/__tests__/news-service.test.ts src/app/pages/__tests__/news-sources-tab.test.tsx` -> OK (`2 files`, `10 tests`).
2. `npm run test` -> OK (`36 files`, `275 tests`).
3. `npm run docs:api:check` -> OK.
4. `npm run build` -> OK.

Impacto funcional:

1. El equipo editorial ya puede bajar una fuente ruidosa a radar breve sin perder completamente la señal.
2. Se reduce la probabilidad de volver a ver casos tipo “catálogo / promo local” con apariencia de noticia relevante.
3. El siguiente escalón natural de `BG-115` pasa a ser más curatorial que técnico: podar/desactivar feeds flojos y mejorar CTA/contexto persistido por nota.

## 35) BG-115 — filtro de páginas utilitarias y de navegación (2026-03-23)

Contexto:
1. Tras la gobernanza por fuente, seguían apareciendo en producción algunas piezas falsas o pobres procedentes de fuentes ruidosas, especialmente `VoxelMatters`.
2. Los casos visibles incluían páginas tipo `Contribute`, `AM Focus` y raíces de idioma como `/fr/`, que no son noticias reales pero estaban pasando por el flujo de listing.

Cambios:
1. `server/news-service.ts` refuerza `isLikelyArticleUrl(...)` para bloquear:
   - raíces por idioma (`/fr/`, `/de/`, `/it/`, `/es/`, `/en/`);
   - utilidades/navegación (`contribute`, `advertise`, `contact`, `podcast`, `calendar`, `resources`, `reviews`, `ebooks`, `webinars`, `am-focus`).
2. Se agregó `shouldSkipUtilityIndexItem(...)` para cortar falsos positivos aunque ya hayan pasado como candidates de listing.
3. El filtro nuevo mira combinación de:
   - path;
   - título genérico;
   - excerpt con demasiada señal de navegación/taxonomía;
   - frases utilitarias como `Please use this form to submit press releases`.
4. Se sumaron tests explícitos para `Contribute`, `AM Focus` y un artículo válido de control.

Validación:
1. `npx vitest run server/__tests__/news-service.test.ts` -> OK
2. `npm run build` -> OK

Impacto esperado:
1. Menos “noticias” falsas en el grid principal.
2. Menos ruido incluso dentro de `Radar breve`.
3. Mejor señal editorial sin depender todavía de apagar por completo fuentes globales que pueden aportar valor parcial.
4. Además, aunque ya existan artículos viejos persistidos, la capa pública puede ocultar esas piezas utilitarias del feed y del detalle mientras se renueva la ingesta.
5. Se tomó una decisión editorial explícita: `VoxelMatters` baja temporalmente a `brief_only` hasta que tenga un parser/fuente más confiable, para que no compita con piezas fuertes en el grid principal.

## 36) Cierre de jornada — estado consolidado para continuidad (2026-03-23)

Ramas y commits:
1. Rama de trabajo actual: `codex/feat/web-hardening-seo-growth`
2. Últimos commits validados en la feature:
   - `25eba18` `feat(news): downgrade noisy voxelmatters feed to brief radar`
   - `e20ebf7` `fix(news): hide persisted utility stories from public feed`
   - `0f0ac67` `feat(news): block utility pages from noisy sources`
   - `3f7221b` `feat(news): compact news page hero`
3. Estado de `develop`:
   - `125a0ec` `merge: downgrade noisy voxelmatters feed on develop`
   - `f6a2b6d` `merge: hide utility news stories on develop`
   - `7d2db39` `merge: filter noisy utility news pages on develop`
   - `f3a93e7` `merge: compact news hero on develop`

Comprobaciones productivas hechas:
1. `https://voreastudio3d.com/api/health` respondió OK durante la secuencia de redeploy.
2. Después del último redeploy, `https://voreastudio3d.com/api/news?source=voxelmatters&limit=8&lang=es` pasó a devolver `total: 0`.
3. El feed general `https://voreastudio3d.com/api/news?limit=12&lang=es` ya no mostró piezas ruidosas de `VoxelMatters` compitiendo en la portada.

Qué quedó realmente sólido:
1. `BG-112`: hardening del frontend muy avanzado y casi cerrado.
2. `BG-113`: donaciones V1 funcionales con edición post-pago y moderación admin.
3. `BG-115`: el feed de noticias quedó bastante más defendible tanto en UX/UI como en gobernanza editorial y limpieza de ruido.

Qué queda abierto para la próxima IA:
1. `BG-115`: seguir podando/degradando fuentes flojas y enriquecer CTA/contexto persistido por nota.
2. `BG-114`: resolver estrategia de URLs/locale realmente estable para social/SEO multilenguaje.
3. `BG-116`: implementar landings, lead magnet, retargeting y tablero de growth.
4. `BG-113`: decidir si habrá herramienta interna de refunds/manual review o si ese circuito queda fuera de producto.

Notas de worktree para no mezclar ruido:
1. Siguen existiendo cambios ajenos fuera de este bloque en:
   - `.agents/*`
   - `README.md`
   - `docs/api/*`
   - `public/docs/api/*`
   - `src/app/services/storage.ts`
   - `tmp/`
   - `worktrees/`
2. No revertirlos sin instrucción explícita del usuario.
