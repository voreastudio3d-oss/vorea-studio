# AI Handoff Diario - 2026-03-19

## 1) Objetivo

Este documento resume de forma operativa lo realizado hoy para que otras IAs puedan continuar sin perder contexto tecnico ni de seguridad.

Plan compartido vigente para todas las IAs: `ai_shared_plan.md`.

## 2) Estado actual del repo

- Branch de trabajo activa: `chore/backlog-p0-auth-credit-alignment`
- Commits nuevos del bloque:
  - `b91efc3` `fix(security): enforce auth identity in rewards trigger`
  - `c802c91` `fix(security): verify PayPal webhook signatures`
  - `98a66d3` `refactor(frontend): centralize subscriptions api and redirect validation`
  - `8e23042` `chore(security): pin patched transitive dependencies`
- Estado del arbol local al cierre de este bloque: limpio (incluyendo estos commits)

## 3) Resumen ejecutivo del dia

Hoy se cerro un bloque de hardening de seguridad en backend, frontend y dependencias:

1. Se elimino un bypass en rewards (`/api/rewards/trigger`) que permitia afectar `userId` arbitrario.
2. Se implemento validacion de firma real para webhooks de PayPal (anti-forgery).
3. Se centralizo el consumo de suscripciones en frontend y se valido `approveUrl` de PayPal por dominio/protocolo.
4. Se actualizaron/pinnearon dependencias transitive vulnerables (`hono`, `@hono/node-server`, `lodash`, `vite`).

## 4) Timeline de commits del bloque

- `b91efc3` `fix(security): enforce auth identity in rewards trigger`
- `c802c91` `fix(security): verify PayPal webhook signatures`
- `98a66d3` `refactor(frontend): centralize subscriptions api and redirect validation`
- `8e23042` `chore(security): pin patched transitive dependencies`

## 5) Cambios clave que deben conocer otras IAs

### 5.1 Rewards trigger ahora usa identidad autenticada

Archivos:
- `server/app.ts`
- `server/__tests__/app-monetization.integration.test.ts`

Cambio:
- `POST /api/rewards/trigger` ya no acepta `userId` del cliente como fuente de verdad.
- El backend exige JWT valido y toma `userId` desde auth (`getUserId(c)`).

Impacto:
- Se bloquea escalation/abuso de XP por suplantacion de usuario en payload.

### 5.2 Webhook de PayPal con verificacion de firma

Archivo:
- `server/paypal-subscriptions.ts`

Cambio:
- Se agrego `verifyWebhookSignature(...)` usando `POST /v1/notifications/verify-webhook-signature` de PayPal.
- Si faltan headers de firma o la validacion falla, responde `400`.
- Si el body no es JSON valido, responde `400` (`Webhook payload inválido`).

Impacto:
- Se evita procesamiento de eventos falsificados por terceros.

### 5.3 Frontend de suscripciones endurecido y centralizado

Archivos:
- `src/app/services/api-client.ts`
- `src/app/pages/Membership.tsx`
- `src/app/pages/Profile.tsx`

Cambio:
- Nuevo `SubscriptionsApi`:
  - `createSubscription(tier, billing)`
  - `getMySubscription()`
- `Membership.tsx` deja de usar fetch manual y valida `approveUrl`:
  - Solo permite `https://www.paypal.com` o `https://www.sandbox.paypal.com`.
- `Profile.tsx` deja de leer `localStorage.getItem("token")` y usa API centralizada.

Impacto:
- Menos drift de auth entre pantallas.
- Menor riesgo de open redirect/script redirect por URL manipulada.

### 5.4 Dependencias vulnerables corregidas

Archivos:
- `package.json`
- `pnpm-lock.yaml`

Cambio:
- Se fijaron overrides:
  - `hono: 4.12.8`
  - `@hono/node-server: 1.19.11`
  - `lodash: 4.17.23`
  - `vite: 6.4.1`

Impacto:
- `pnpm audit` queda sin vulnerabilidades conocidas al cierre.

## 6) Backlog status al cierre (impactado hoy)

Referencias: `project_backlog.md`

- `BG-006` En progreso (se suma hardening real en rutas de rewards/frontend subscriptions).
- `BG-007` En progreso (se cierra parte critica: firma de webhook PayPal).
- `BG-008` En progreso (se agregan pruebas de integracion para evitar regresion del bypass de rewards).

## 7) Validaciones ejecutadas

Comandos:

- `corepack pnpm test -- server/__tests__/app-monetization.integration.test.ts`
- `corepack pnpm audit --prod --audit-level low`
- `corepack pnpm audit --audit-level low`
- `corepack pnpm build`

Resultados:

- Tests de integracion: `11 files`, `197 tests`, `passed`.
- Auditoria de dependencias: `No known vulnerabilities found` (prod y full).
- Build frontend: exitoso (quedan warnings de chunking/externalizacion no bloqueantes).

## 8) Riesgos y puntos de atencion para otras IAs

1. El webhook ya valida firma, pero confirmar en despliegue que `PAYPAL_WEBHOOK_ID` este seteado; sin eso rechazara eventos.
2. `rewards/:userId` (lectura de perfil de recompensas) sigue publico por diseno; mantener asi solo si producto lo requiere.
3. Warnings de build por dependencias server-like en bundle frontend (`pg`, `events`, etc.) siguen pendientes de limpieza de arquitectura.

## 9) Siguiente plan recomendado (orden de ejecucion)

1. Extender tests de integracion de pagos para edge-cases de webhook/cancelaciones (`BG-008`).
2. Revisar endpoints de rewards publicos y documentar claramente el contrato de visibilidad.
3. Continuar cierre de `BG-006` en rutas restantes con patron de gating server-side.
4. En PR, resaltar explicitamente que se cerro bypass de rewards + webhook signing + deps audit clean.

## 10) Convenciones para futuras IAs en este repo

- Mantener cambios de seguridad en commits separados por dominio (`backend auth`, `payments`, `frontend`, `deps`).
- Evitar fetchs manuales cuando exista API client centralizado.
- Toda ruta sensible debe confiar en identidad server-side, nunca en `userId` del body.
- Para webhooks de terceros, no procesar eventos sin verificacion criptografica/firmada.

## 11) Actualización operativa (Comunidad — Fase 1)

Fecha: 2026-03-19

Cambios implementados:

1. Hardening de borradores:
   - `GET /api/community/models/:id` ahora oculta drafts a terceros.
   - Comentarios/listado de comentarios en drafts siguen la misma regla de visibilidad.
   - `like`, `download` y `comment` se restringen a modelos publicados.
2. Contrato de modelo extendido:
   - Nuevos campos: `media[]`, `slug`, `canonicalPath`, `commentCount`.
   - Compatibilidad mantenida con `thumbnailUrl`.
3. Upload de galería:
   - Nuevo `POST /api/uploads/community-image` + `GET /api/uploads/community-image/:id`.
   - Validación de MIME y tamaño por tier (`admin:image_limits`).
4. Admin de comunidad:
   - Nuevo `GET /api/admin/community/models` con filtros/búsqueda/paginación para superadmin.
5. Tests:
   - Nuevo `server/__tests__/app-community.integration.test.ts`.
   - Suite total validada: `12 files`, `201 tests`, `passed`.

## 12) Coordinación obligatoria entre IAs

Se institucionalizó el flujo compartido para evitar desalineaciones:

- `ai_shared_plan.md` pasa a ser la fuente única de plan operativo.
- `README.md` ahora referencia explícitamente ese plan como obligatorio.
- `project_backlog.md` incluye puntero directo al plan maestro.

## 13) Bloque documental implementado (API + perfiles + manual)

Fecha: 2026-03-19

Entregables cerrados:

1. Mini proyecto API expuesto:
   - Portal técnico: `public/docs/index.html` (ruta `/docs/`)
   - OpenAPI versionado: `public/openapi.json`
2. Inventario y normalización de endpoints:
   - `docs/api/endpoint-matrix.md`
   - `docs/api/endpoint-inventory.json`
   - `docs/api/inconsistencies.md`
3. Verificación de paridad código/spec:
   - `scripts/check-api-docs-parity.mjs`
4. Documentación por perfil:
   - `docs/profiles/desarrolladores.md`
   - `docs/profiles/creativos.md`
   - `docs/profiles/administradores-contenido.md`
5. Manual de usuarios final:
   - `docs/manual-usuario.md`

Validaciones corridas:

- `node scripts/generate-api-docs.mjs`
- `node scripts/check-api-docs-parity.mjs` → OK (`101` rutas únicas)
- `npm run build` → OK (con warnings existentes de chunking/externalización)

Estado PayPal/Stripe actualizado:

- PayPal: implementado y documentado como pasarela actual.
- Stripe: no implementado en backend; se mantiene solo como referencia futura/roadmap.

## 14) Actualización operativa (Comunidad — Fase 2 parcial retomada)

Fecha: 2026-03-19

Estado del árbol al cierre de este bloque:

- No limpio: quedan cambios frontend sin commit en:
  - `src/app/components/PublishDialog.tsx`
  - `src/app/pages/Explore.tsx`
  - `src/app/pages/ModelDetail.tsx`
  - `src/app/pages/Profile.tsx`
  - `src/app/pages/UserPublic.tsx`
  - `src/app/locales/en.json`
  - `src/app/locales/es.json`
  - `src/app/locales/pt.json`

Cambios aplicados:

1. `PublishDialog`:
   - Soporta selección de múltiples imágenes.
   - Permite elegir portada.
   - Publica `media[]` combinando auto-capture + uploads del usuario.
2. `ModelDetail`:
   - Ya renderiza `media[]` con carousel principal.
   - Agrega thumbnail strip y swipe móvil.
   - Mantiene fallback a `thumbnailUrl` si no existe galería.
3. Navegación comunidad:
   - `Explore` y `UserPublic` priorizan ir al detalle del modelo.
   - `Profile` suma CTA “ver detalle”.
   - Cards/listados muestran `commentCount`.
4. i18n:
   - Nuevas claves para galería/publicación en `es/en/pt`.

Validaciones corridas:

- `corepack pnpm build` → OK (con warnings históricos de chunking/externalización)
- `corepack pnpm test` → OK (`12 files`, `201 tests`, `passed`)

Siguiente paso recomendado:

1. Avanzar con Fase 3 (`SuperAdmin` comunidad global).
2. Evaluar si conviene sumar tests frontend/integración para edición de `media[]`.

## 15) Actualización operativa (Comunidad — edición de galería cerrada)

Fecha: 2026-03-19

Cambios aplicados:

1. Flujo paramétrico:
   - `Profile -> Editar original` ahora pasa metadata de edición a `Editor`.
   - `PublishDialog` detecta modo edición y llama `updateModel(...)` en vez de republicar.
   - La galería existente se precarga, permite reordenar, cambiar portada, agregar imágenes y guardar/publicar cambios.
2. Flujo Relief:
   - El modal de guardado ahora incluye el editor de galería.
   - Si el modelo ya existía, restaura `media[]`/`thumbnailUrl`, permite reordenar y actualiza el modelo con la galería editada.
3. Reutilización:
   - Nuevo componente compartido `src/app/components/CommunityGalleryEditor.tsx`.
   - Nueva utilidad `src/app/services/community-gallery.ts` para hidratar/serializar `media[]`.

Validaciones corridas:

- `corepack pnpm build` → OK
- `corepack pnpm test` → OK (`12 files`, `201 tests`, `passed`)

## 16) Actualización operativa (Comunidad — URL-driven edit/fork + reset local)

Fecha: 2026-03-19

Cambios aplicados:

1. Studio/Relief URL-driven:
   - `/#/studio?intent=edit&modelId=<id>` y `/#/studio?intent=fork&modelId=<id>`.
   - `/#/relief?intent=edit&modelId=<id>` y `/#/relief?intent=fork&modelId=<id>`.
   - El editor dejó de depender de `sessionStorage` para saber si edita original o crea copia.
2. Navegación:
   - `Profile` y `ModelDetail` ahora abren los flujos de edición/copia con `intent/modelId`.
   - El contexto sobrevive refresh/reentrada porque la URL es la fuente de verdad.
3. Guardado explícito:
   - `PublishDialog` ahora usa modo explícito `create | edit | fork`.
   - `Relief` también diferencia `create | edit | fork` y ya no fuerza forks a borrador en el primer guardado.
   - En modo `edit` siempre actualiza el mismo `id`.
4. Backend:
   - Nuevo `communityRepo.getAllModelsRaw()`.
   - Vistas privadas del dueño (`status=draft|all` o `authorId === viewerId`) dejan de deduplicar y muestran draft + publicado aunque compartan título/modelType.
5. Limpieza de desarrollo:
   - Nuevo script `scripts/reset-dev-community.ts`.
   - Nuevo comando `corepack pnpm reset:community`.
   - Borra modelos/drafts/likes/comments/uploads de comunidad locales y resiembra un fixture mínimo.

Fixture local vigente tras reset:

- Publicado paramétrico con galería visible: `cm_mmwk9htxc096q5`
- Draft del mismo autor/título para validar edición privada: `cm_dev_gallery_draft_01`
- Relief público ajeno para validar fork/copia: `cm_dev_relief_public_01`

Validaciones corridas:

- `corepack pnpm test` → OK (`12 files`, `202 tests`, `passed`)
- `corepack pnpm build` → OK
- `corepack pnpm reset:community` → OK
- API:
  - `GET /api/community/models/cm_mmwk9htxc096q5` devuelve `media.length = 3`
  - `GET /api/community/models?authorId=a1eb2953-9d04-4430-93b7-da956de8889e&status=all` como owner devuelve publicado + draft
- UI:
  - `/#/modelo/cm_mmwk9htxc096q5` muestra hero gallery `1/3` y strip de miniaturas (`Galería 3`)

Siguiente paso recomendado:

1. Continuar con Fase 3: UI admin global de modelos de comunidad.
2. Si se quiere QA adicional, validar visualmente los modos `edit/fork` autenticados en Studio y Relief con un navegador logueado persistente.

## 17) Actualización operativa (Noticias — bilingüe ES/EN + segmentación)

Fecha: 2026-03-19

Cambios aplicados:

1. Persistencia extendida:
   - `news_sources` ahora guarda `language`.
   - `news_articles` ahora guarda `title_display_en`, `summary_en` y `detail_en`.
   - `ensureReady()` agrega columnas nuevas de forma segura sobre entornos ya existentes.
2. Ingesta/editorial:
   - La editorialización ahora produce versión en español e inglés por artículo.
   - Si Gemini responde `429` o falla, el fallback mantiene la ingesta viva y completa los campos con síntesis saneada.
3. Fuentes:
   - Se habilitó `3Dnatives ES` como fuente hispana estable.
   - Se catalogó `Macrotec Uruguay` en `news_sources`, pero quedó deshabilitada por defecto porque hoy responde `403` a la ingesta automatizada desde servidor.
4. API pública:
   - `GET /api/news` ahora soporta `lang=es|en` y `sourceLanguage=es|en`.
   - `GET /api/news/:slug` ahora soporta `lang=es|en`.
   - La API responde campos resueltos `titleDisplay`, `summary`, `detail`, `requestedLanguage`, `availableLanguages`.
5. Frontend:
   - `NewsList` detecta el idioma del usuario desde i18n y pide el contenido editorial correspondiente.
   - Se agregó segmentación opcional por fuentes en español o inglés.
   - `NewsDetail` muestra la versión localizada y mantiene atribución/fuente original.
6. i18n:
   - Nuevas claves de segmentación/idioma editorial sincronizadas en los 8 locale files.
7. Documentación:
   - `docs/operations/news-ingestion.md` actualizado con contrato bilingüe y estado de fuentes.

Validaciones corridas:

- `npm run test` → OK (`16 files`, `211 tests`, `passed`)
- `npm run build` → OK
- `npm run docs:api:generate` → OK
- `npm run docs:api:check` → OK
- `npm run news:seed-sources` → OK
- `npm run news:ingest` → OK

Resultado operativo observado:

- Ingesta real:
  - `7` fuentes habilitadas
  - `42` items procesados
  - `3dnatives-es` insertó `6` noticias nuevas en español
- Gemini:
  - siguió devolviendo `429 quota exceeded`
  - el fallback editorial evitó cortar la operación

Siguiente paso recomendado:

1. Si se quiere reforzar cobertura hispana regional, buscar una segunda fuente en español con RSS/listing estable además de `3Dnatives ES`.
2. Si se recupera cuota de Gemini, relanzar `npm run news:ingest` para refrescar editoriales bilingües con mejor calidad de traducción/adaptación.
