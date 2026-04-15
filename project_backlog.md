# Backlog Consolidado — Vorea Studio Parametric 3D

Fecha de consolidación: 2026-03-29  
Última actualización: 2026-04-05  
Estado general: `EN_EJECUCION`

Referencia operativa obligatoria para todas las IAs: `ai_shared_plan.md`

Fuentes consideradas:

- `marketing_audit.md`
- `project_health_report.md`
- `project_pending.md`
- `IA-Prompts.md` (secciones de pendientes y auditoría de flujos)

## Corte de estado (2026-03-26)

| ID | Estado | Nota |
|---|---|---|
| BG-001 | ✅ Completado | `freeExportLimit` unificado en backend/frontend (sin `FREE_LIMIT` hardcodeado) |
| BG-002 | ✅ Completado | Packs renombrados a formato de créditos (`Pack Starter/Pro/Studio`) |
| BG-003 | ✅ Completado | Perfil ahora lee asignación mensual desde `toolCredits` (sin hardcode por tier) |
| BG-004 | ✅ Completado | AuthContext endurecido: sesión válida solo con token verificado, sin fallback a mock/local auth |
| BG-006 | 🟡 En progreso | Gating server-side ya descuenta créditos mensuales en acciones protegidas, GCode export/UI quedó unificado en `tool-actions` y las compras one-time ya acreditan `top-up` sobre el saldo universal consumiendo primero asignación mensual y luego saldo comprado. En AI Studio ya quedó corregido el refund inconsistente del caso mixto `monthly + top-up` en backend real; pendiente consolidar el flujo con test de integración del endpoint, modelo `reservation -> capture -> release`, persistencia server-side del resultado antes de responder `200`, helper compartido para mutaciones de créditos y guardrails de gobernanza sobre auth/pagos/créditos/schema. Admin ya tiene preview + batch backfill para vaciar `purchasedCredits`; falta además certificar el flujo fuera de local |
| BG-007 | 🟡 En progreso | PayPal endurecido (`create/capture` valida pack+monto+moneda+ownership+idempotencia); Prisma usado en `paypal-subscriptions`, el mapping `planId -> billing` ahora se persiste en KV y los `PAYMENT.SALE.COMPLETED` nuevos se ledgerizan. Las recargas one-time ya operan como top-up universal; falta smoke real del entorno objetivo y, si se quiere, backfill histórico de suscripciones |
| BG-008 | 🟡 Avanzado | Suite monetización validada con `vitest`, `typecheck`, `lint`, `build` y `docs:api:check`; el revenue report consolida ventas, donaciones, cobros recurrentes ledgerizados y gasto IA real, y `pnpm verify:monetization:tiers` ya quedó validado en local con evidencia. Falta repetirlo en cualquier entorno adicional que se quiera certificar |
| BG-106 | ✅ Completado | Comunidad funcional: detalle, comentarios, media[], publish multi-imagen, edición URL-driven, drafts, reset local, más UI completa de admin/moderación de modelos integrados |
| BG-108 | ✅ ~Cerrado | Routing limpio con History API, deep links, SEO server-side, sitemap segmentado. Falta smoke manual post-deploy menor |
| BG-111 | ✅ Base funcional | Pipeline AI v1: `Prompt → InstructionSpecV1 → SCAD`, recipes persistidas, historial, fallback guest, MCP tools. Quedo ademas un roadmap concreto de expansion de familias/productos en `docs/research/parametric-scad-product-opportunities-2026-03.md`, el skill `.agents/codex-skills/vorea-parametric-scad-products/` y siete familias nuevas ya implementadas: `drawer-organizer-tray`, `planter-drip-system`, `lamp-shade-kit`, `text-keychain-tag`, `nameplate-pro`, `peg-label-system` y `threaded-jar` en AI Studio + Editor |
| BG-112 | ✅ ~Cerrado | Hardening completo: matriz acceso, AuthGuard/RoleGuard, limpieza post-logout, gates en todas las herramientas, retiro Supabase legacy, TTL 14d guest |
| BG-113 | ✅ V1 funcional | Donaciones PayPal-first, ledger, insignias, `/colaboradores`, edición post-pago, panel admin. Residual: refunds/manual review |
| BG-114 | 🟡 Avanzado | SEO dinámico localizado, GA4 ProductionID, analytics hygiene, `isInternalRoute()`, filtro IP configurado, `open_tool` unificado. `/for/makers`, `/for/ai-creators` y `/for/education` ya tienen metadata dinámica específica en cliente. **Pendiente**: política URLs por locale + alinear del todo cliente/SSR para landings |
| BG-115 | ✅ ~Cerrado | Tiers editoriales, briefs noindex, gobernanza por fuente, CTA localizado, VoxelMatters degradada. Residual: evaluar más fuentes |
| BG-116 | ✅ Completado | **3/3 landings creadas** + lead magnet CTA en `/for/education` ("Guía 3 clases" → /contact prefilled) + Weekly Acquisition Dashboard tab en SuperAdmin (signups/semana, tier distribution, landing views, leads 30d) + UTM tracking persistido en sessionStorage + `getUtmParams()` exportado + `lead_magnet_click` event. **Residual**: operación de redes, email automation, retargeting pixels |
| BG-117.1 | ✅ Completado | Sistema IA insights: GA4 Data API + Gemini + `AnalyticsInsightsTab` en SuperAdmin con KPIs, tool usage, funnel, insights IA, cache 6h, mock fallback. Service account configurado en Railway |
| BG-117.2 | ✅ Avanzado | Benchmark de ecosistema ya existente en `docs/research/3d-ecosystem-benchmark-2026-03.md` y nuevo research accionable de producto SCAD en `docs/research/parametric-scad-product-opportunities-2026-03.md`. Tambien quedo skill repo-local para futuras expansiones de catalogo |
| BG-117.3 | ✅ Completado | FODA formalizado en `docs/research/foda-analysis-2026.md` + tab `FODAAnalysisTab` integrada en SuperAdmin con cuadrantes, badges de impacto y roadmap 6 meses |
| BG-117.4 | ✅ Completado | Dashboard financiero con recharts (BarChart revenue/mes, PieChart breakdown, LineChart AI costs, tabla resumen) integrado en SuperAdmin como `FinancialDashboardTab`. 4 KPI cards + visualizaciones completas |
| BG-201 | ✅ Completado | Planes alineados, features fantasma removidas (API access, colaboración, analytics avanzados) |
| BG-202 | ✅ ~Cerrado | i18n: 8 locales sincronizados, 168 claves admin.activity.*, 84 claves membership. Residual: regla automática de sync |
| BG-208 | ✅ Completado | `/docs` + OpenAPI + matriz + perfiles + manual usuario; paridad OpenAPI recuperada y espejo `public/docs/` resincronizado |
| BG-209 | ✅ Completado | Gobernanza agentica V1.1 cerrada: drift determinista resuelto, `agent:governance:check` en CI, `agent:preflight --json`, `agent:git-recover --json`, `agent:route --goal` y routing mejorado para `.agents/**` y `agents/openai.yaml`. La compatibilidad multi-LLM queda como contexto manual mínimo, no como instrucción global intrusiva |
| **Admin UX** | ✅ Completado | Mega menu horizontal por grupos + URL hash persistence + mobile dropdown (2026-03-25) |
| **BG-109** | ✅ Completado | Relief: tolerancia por color con refinamiento de bordes (majority-vote, 0-5 pasos), visualización estadísticas de zonas (barras + %), slider de tolerancia en UI. 1432 tests pasan |
| **BG-110** | ✅ Completado | QA Relief: fix de cap winding en cylinder, box, polygon y lampshade (eliminado `preferredNormal` en caps/seals). Mesh inspector verifica 4 modos watertight, manifold, 0 boundary edges, 0 non-manifold edges. Smoke assets generados OK. 1417 tests pasan |
| **BG-203** | ⬜ No empezado | Refactor intérprete SCAD por módulos (ver `project_pending.md`) |
| **BG-204** | ⬜ No empezado | Métricas internas del engine |
| **BG-205** | ✅ Completado | `text()` mejorado: parámetro `height`/`h` configurable (antes hardcoded fontSize*0.3), soporte multilinea (`\n`), alineación vertical multilinea. `minkowski()` mejorado: sampling adaptativo hasta 192 puntos (antes 64), muestreo prioritario de puntos extremales (min/max por eje) + uniforme para mejor precisión geométrica |
| **BG-206** | ✅ Completado | Hardening técnico: tsconfig strict, rate limiting global y captura 429 en frontend con UI (sonner toast) |
| **BG-207** | ✅ Completado | CI/CD mínimo + Purga de Dependencias + Typecheck global + QA Autopromoción Auth Admin |

## Orden inmediato de acción (Actualizado)

1. ~~**BG-301**: Motor IA Real~~ — ✅ Ya implementado: 5 proveedores LLM (Gemini, OpenAI, Anthropic, DeepSeek, Kimi) con routing, fallback y budget. Verificado con API keys reales.
2. Terminar la capa de CMS del AI Studio (Lectura/Escritura de Familias y Presets desde Base de datos en vez de código estático).
3. Ejecutar fuera de local la certificación pendiente de monetización y guardar evidencia.
4. Reprobar Claude o Gemini con contexto manual mínimo tras retirar instrucciones globales intrusivas.

### Plan consolidado — Hardening monetización AI Studio (`BG-006` / `BG-008`)

1. Agregar test de integración de `/api/ai-studio/generate` simulando fallo del pipeline y verificando refund completo de `balance`, `topupBalance` y `totalUsed`.
2. Evolucionar el cobro actual de AI Studio a un flujo explícito `reservation -> capture -> release` con `generationId` e idempotencia.
3. Persistir el resultado útil del lado servidor antes de responder éxito, para que un refresh del cliente no deje “cobro ok, activo perdido”.
4. Unificar las mutaciones de créditos en helpers compartidos para que `AI Studio`, `tool-actions` y futuros flujos no diverjan.
5. Endurecer gobernanza y validación sobre rutas críticas de auth, pagos, créditos y `prisma/schema.prisma` antes de seguir ampliando monetización.

## P0 — Crítico (producción, riesgo legal, seguridad, datos)

| ID | Accionable | Entregable | Criterio de aceptación |
|---|---|---|---|
| BG-001 | Unificar el sistema de créditos (`FREE_LIMIT`, `monthlyCredits`, límites STL/GCode) | Regla única de créditos en backend + frontend consumiendo la misma fuente | El usuario FREE ve y consume exactamente el mismo límite en toda la app |
| BG-002 | Renombrar packs de “Exportaciones” a packs de créditos | Textos de packs corregidos en backend y frontend | No quedan textos que prometan “N exportaciones” cuando el costo varía por herramienta |
| BG-003 | Corregir tarjeta de perfil con asignación hardcodeada | Perfil leyendo asignación mensual desde API/config central | La tarjeta refleja valores reales sin hardcode por tier |
| BG-004 | Eliminar fallback silencioso de auth mock | Flujo de auth que falla explícitamente si Supabase no responde | No existe login “exitoso” en modo mock cuando auth real falla |
| BG-005 | Migrar KV en memoria a base persistente (PostgreSQL Supabase) | Persistencia de usuarios/planes/logs/créditos en DB real | Reinicios/deploys no pierden datos |
| BG-006 | Fortalecer controles de monetización en backend | Feature gating y validación de tier en servidor | No se puede consumir features premium manipulando frontend |
| BG-007 | Completar flujo de pagos PayPal en producción | Órdenes + captura + validación + persistencia de compra | Compra aprobada incrementa créditos y deja trazabilidad auditable |
| BG-008 | Cobertura mínima de tests para rutas críticas | Suite inicial de tests (créditos, auth, compras, exports) | Pipeline corre tests y bloquea regresiones críticas |
| BG-112 | Endurecer matriz de acceso y aislamiento post-logout | `AuthGuard` centralizado + clasificación pública/privada/admin + limpieza de caches locales sensibles + whitelists de vistas públicas | Un usuario anónimo no puede abrir zonas privadas por URL, un usuario estándar no puede descubrir áreas admin útiles, y al cerrar sesión no quedan colecciones/historiales sensibles reutilizables en el mismo navegador |

## P1 — MVP público (flujo de usuario y valor core)

| ID | Accionable | Entregable | Criterio de aceptación |
|---|---|---|---|
| BG-101 | Crear flujo de modelo compartido entre páginas | Estado compartido para pasar modelo Editor/Parametric/MakerWorld/AI/Organic/Explore | El usuario puede mover un modelo entre herramientas sin perder contexto |
| BG-102 | Conectar Editor al motor SCAD real | Editor con código SCAD + compilación + preview + export funcional | Los controles y acciones del Editor operan sobre geometría real |
| BG-103 | Corregir MakerWorld sin modelo inicial | Estado vacío + CTA de carga/import + lint real sobre mesh | No hay métricas/lint fake cuando no existe modelo |
| BG-104 | AI Studio con salida útil (SCAD real) | Generación SCAD real o plantillas funcionales + “Abrir en Editor” con transferencia | Cada generación produce código utilizable en Editor |
| BG-117 | Dashboard analítico IA (GA4+Gemini+SuperAdmin) | GA4 Data API configurada, Gemini insights, cache 6h. 117.1 ✅, 117.2 ✅ (benchmark en `docs/research/`), 117.3 ✅ (FODA formalizado), 117.4 ✅ (KPI dashboard recharts) | SuperAdmin muestra KPIs, tool usage, funnel, sugerencias IA reales, FODA estratégico y dashboard financiero |
| BG-105 | Orgánico conectado a deformación 3D real | Aplicación de deformaciones sobre mesh real | El resultado orgánico afecta geometría exportable, no solo preview 2D |
| BG-106 | Comunidad real (upload/likes/downloads) | Endpoints + UI con datos reales en Explore | Explore deja de usar catálogo mock y soporta interacción real |
| BG-107 | Envío de emails real | Integración de proveedor (Resend/SendGrid) en flujos admin | Eventos de negocio envían emails verificables |
| BG-108 | Routing real con deep links | Navegación robusta (history/hash) + rutas compartibles + SEO server-side básico | Refrescar o abrir URL directa mantiene estado de ruta correctamente, y las rutas públicas entregan metadata/canonical útiles. Estado actual: implementado y redeployado en `develop`; `voreastudio3d.com` ya sirve `canonical`, `noindex` y `sitemap.xml` correctos desde Railway. Además, la app sincroniza `document.title` por ruta para mantener tabs/bookmarks coherentes después de hidratar, y el menú `Herramientas` ya no depende de `blur` frágil ni falla con query params (`/studio?mode=parametric`). Queda pendiente completar smoke manual post-deploy de navegación y dejar `www` como redirect hacia el root canónico según `docs/operations/publishing-routing-seo-plan.md`. |
| BG-109 | Mejoras de Relief (Partes por color) | Tolerancia por color + previsualización de partes + mejor asignación de caras | Export 3MF de color reduce mezclas y permite validación previa |
| BG-110 | QA de Relief y export 3MF | Tests automáticos + smoke manual documentado para Orca/Bambu | Casos plane/cylinder e híbridos pasan de forma consistente |
| BG-111 | Pipeline paramétrico IA v1 | AI Studio (FDM/Organic) + InstructionSpecV1 + SCAD parametrizable + recipes + historial persistido. Reaplicable por usuario autenticado. | ✅ Base funcional — 7 familias implementadas. Ver `docs/research/parametric-scad-product-opportunities-2026-03.md` |

## P2 — Mejora de producto y deuda técnica

| ID | Accionable | Entregable | Criterio de aceptación |
|---|---|---|---|
| BG-201 | Limpiar promesas de features no implementadas en planes | Tabla/planes alineados con capacidades reales | No se anuncian features fantasma (API access, colaboración, analytics avanzados) |
| BG-202 | Completar internacionalización y regla de sincronía | Cobertura i18n en locales + validación de claves | No hay claves huérfanas ni textos clave hardcodeados |
| BG-203 | Refactor del intérprete SCAD por módulos | Separación parser/runtime/evaluator/geometry + puntos de extensión | Código más mantenible sin romper compatibilidad |
| BG-204 | Métricas internas del engine | Tiempos por etapa, nodos evaluados, memoria estimada | Se puede perfilar escenas y detectar cuellos de botella |
| BG-205 | Mejoras geométricas pendientes (`text`, Minkowski real) | Implementaciones más precisas para geometría avanzada | Casos de uso avanzados producen resultados correctos y estables |
| BG-206 | Hardening técnico base | `tsconfig` strict + rate limiting + limpieza de dependencias fantasma | Menor superficie de bug, abuso y peso innecesario |
| BG-207 | CI/CD mínimo | Pipeline de build, test y checks en PR | Cada PR valida calidad automáticamente |
| BG-208 | Mini proyecto de documentación API y ayuda | OpenAPI versionado + portal `/docs` + docs por perfil + manual de usuario + chequeo de paridad | Toda ruta backend queda documentada y validada por script de paridad |
| BG-209 | Gobernanza de ramas y retorno | Convención `codex/*`, rollback protegido y workflow post-commit alineado a PR | Se evitan cambios accidentales en ramas de retorno y pushes directos a `develop` |
| BG-113 | Programa de donación y colaboradores | Flujo de donación voluntaria + niveles de aporte + insignias de colaborador + página `/colaboradores` + panel mínimo de trazabilidad | V1 ya implementa PayPal-first, ledger básico, insignias acumulativas, moderación admin, edición post-pago del reconocimiento y copy/legal base de cara al usuario; el residual abierto ya no es técnico sino soporte operativo/refunds manuales si se quiere formalizar ese circuito. |
| BG-114 | SEO técnico, marca y medición | JSON-LD útil, señales de idioma, contacto real, GA4, sitemap segmentado dinámico con alternatives y política estable | Las rutas públicas entregan metadata/markup correctos, contacto genera leads reales y la medición base permite atribución confiable |
| BG-115 | Gobernanza editorial de noticias | Tiers `brief/indexable/evergreen`, heurística de ingesta endurecida, metadata CTA por idioma, control de indexación y política por fuente | La base actual clasifica notas por valor, sanea imágenes, separa briefs del radar, permite extractos útiles de lectura y CTA directo. El siguiente umbral es asegurar calidad frente a ruido |
| BG-116 | Growth y adquisición | 3 landings de intención, lead magnet, operación de redes, retargeting y dashboard semanal | Hay embudos medibles desde contenido/social hacia registro, activación y comunidad |
| BG-118 | Investigación SEO-to-SCAD (AnswerThePublic) | Extracción de Excel con intención de búsqueda (dolores/funcional) | Subir CSVs de investigación según `atp-seo-to-scad-loop.md` para derivar nuevas plantillas paramétricas y copys de Growth |

## Sugerencia de ejecución por oleadas

1. `Oleada 1 (P0 inmediato)`: BG-001 a BG-005.  
2. `Oleada 2 (monetización segura)`: BG-006 a BG-008 + BG-201.  
3. `Oleada 3 (flujo producto)`: BG-101 a BG-105.  
4. `Oleada 4 (MVP público)`: BG-106 a BG-110.  
5. `Oleada 5 (escala y calidad)`: BG-202 a BG-207.

---

## P3 — Expansión Global y Plataforma

| ID | Accionable | Entregable | Estado |
|---|---|---|---|
| **BG-301-B** | Herramientas de marketing/mailing/fidelización | Definir stack: proveedor de email marketing (Resend para transaccional ya elegido; evaluar Mailchimp/Loops/Brevo para campañas), CRM liviano, tracking social (Instagram, X, LinkedIn), herramienta de fidelización (gamificación, badges, programa de referidos). Documentar la selección en un ADR y conectar con `global_localization_marketing_rule.md` | ⚪ Sin empezar. Referenciado en `roadmap_delegacion_abril_2026.md` §GPT sin skill propia |
| **BG-302** | Perfil extendido del usuario | País, región, teléfono, idioma por defecto ya implementados en `PUT /api/auth/me`. **Faltante:** (a) UI en `Profile.tsx` para editar todos estos campos; (b) verificación real de teléfono (WhatsApp/SMS vía Twilio/TeleSign); (c) datos de facturación y tarjetas via vault de tercero (no datos crudos en Vorea). Ver `global_identity_payments_rule.md`. | ⚠️ Parcial — backend OK, UI incompleta, teléfono no verificado, vault no implementado |
| **BG-107** | Email transaccional real (Resend) | `RESEND_API_KEY` debe configurarse en Railway. Eliminar `codeDev`/`pinDev` de las respuestas en producción. Smoke de recepción real de email de verificación y reset en entorno de staging/prod. | ⚠️ Condicional — funciona si la var está seteada; sin ella se degrada a console.log |

---

## BG-DS — Design System / Tokens

> Migración de hex hardcodeados a tokens semánticos de Tailwind.
> Regla de gobernanza: `.agents/workflows/design_tokens_rule.md`
> Fuente de verdad de tokens: `src/styles/theme.css`

### Completado (2026-04-05)

| Archivo | Instancias migradas | Commit |
|---|---|---|
| `src/styles/theme.css` | ∞ (definición) | `898e870` |
| `src/app/Root.tsx` | ~58 | `843600c` |
| `src/app/pages/Landing.tsx` | ~24 | `ad8e9b3` |
| `src/app/pages/FeedbackAdmin.tsx` | ~80 | `7a3a354` |
| `src/app/components/ui/button.tsx` | 3 + hover global | `BG-DS-HOVER` |

### Pendiente — Inventario completo (2026-04-05)

> Escaneado con: `Get-ChildItem -Filter "*.tsx" -Recurse | hex pattern match`
> **Total restante: 51 archivos · ~1,104 instancias**

#### 🔴 Alta prioridad (>50 instancias)

| Archivo | Instancias |
|---|---|
| `SuperAdmin.tsx` | 151 |
| `Relief.tsx` | 98 |
| `AIStudio.tsx` | 65 |
| `AiStudioAdminTab.tsx` | 59 |
| `Membership.tsx` | 56 |
| `Profile.tsx` | 54 |

#### 🟡 Media prioridad (10–50 instancias)

| Archivo | Instancias |
|---|---|
| `NewsSourcesTab.tsx` | 34 |
| `ModelDetail.tsx` | 30 |
| `NewsList.tsx` | 26 |
| `GCodePanel.tsx` | 24 |
| `CreditsTab.tsx` | 24 |
| `Editor.tsx` | 23 |
| `Contributors.tsx` | 22 |
| `CommunityTab.tsx` | 22 |
| `ScadViewport.tsx` | 21 |
| `Explore.tsx` | 20 |
| `NewsDetail.tsx` | 20 |
| `ActivityTab.tsx` | 19 |
| `DonationsAdminTab.tsx` | 17 |
| `FeedbackPanel.tsx` | 17 |
| `MakerWorld.tsx` | 15 |
| `Contact.tsx` | 15 |
| `Organic.tsx` | 15 |
| `BenchmarkPage.tsx` | 15 |
| `Terms.tsx` | 14 |
| `GCodeCollection.tsx` | 13 |
| `ScadCustomizer.tsx` | 13 |
| `SlicePreview.tsx` | 13 |
| `UserPublic.tsx` | 12 |
| `ScadLibrary.tsx` | 12 |
| `AuthDialog.tsx` | 12 |
| `VaultUI.tsx` | 12 |
| `MakerLanding.tsx` | 11 |
| `SubscriptionSuccessModal.tsx` | 11 |
| `PublishDialog.tsx` | 11 |

#### 🟢 Baja prioridad (<10 instancias — incluye primitivos UI)

| Archivo | Instancias |
|---|---|
| `Privacy.tsx` | 9 |
| `CreditPackModal.tsx` | 9 |
| `Leaderboard.tsx` | 5 |
| `CommunityGalleryEditor.tsx` | 4 |
| `AnalyticsInsightsTab.tsx` | 4 |
| `Breadcrumbs.tsx` | 3 |
| `CollapsibleSection.tsx` | 3 |
| `route-guards.tsx` | 3 |
| `button.tsx` | 3 |
| `Footer.tsx` | 3 |
| `ScadDiagnosticsPanel.tsx` | 2 |
| `TierGate.tsx` | 2 |
| `badge.tsx` | 2 |
| `card.tsx` | 1 |
| `input.tsx` | 1 |
| `root-nav.test.tsx` | 1 |

### ID BG-DS-HOVER — Hover global de botones

| Campo | Valor |
|---|---|
| **ID** | BG-DS-HOVER |
| **Estado** | ✅ Completado 2026-04-05 |
| **Problema** | Botones y elementos interactivos sin `cursor-pointer` ni feedback visual de hover, generando confusión UX |
| **Solución** | CSS global `.cursor-interactive` en `theme.css` + `button.tsx` primitivo mejorado + clase `@layer base button` |
