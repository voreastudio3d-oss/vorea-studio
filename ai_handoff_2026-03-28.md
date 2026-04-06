# AI Handoff — 2026-03-28

## Rama base estable

- Base operativa estable al inicio de esta iteración: `develop@0784f82`
- Rama de implementación usada en esta oleada: `codex/feat/legacy-pack-alignment` (ya mergeada a `develop`)

## Qué quedó implementado

1. GCode migrado a monetización universal:
   - `src/app/components/GCodePanel.tsx` dejó de usar `CloudCreditsService`/packs legacy y ahora valida + consume con `ToolActionsApi` y `ToolCreditsApi`.
   - `src/app/pages/GCodeCollection.tsx` ya muestra saldo universal desde `AuthContext`.
   - `src/app/components/CreditPackModal.tsx` pasó de checkout legacy a modal de saldo/acceso para GCode.
   - `src/app/pages/Membership.tsx` ya no ofrece checkout one-time cuando los packs legacy están pausados.
2. Backend GCode endurecido:
   - `server/app.ts` usa `actionId=view` por defecto en `POST /api/gcode`.
   - `POST /api/gcode` rechaza `actionId` inválidos con `400`.
   - Guardar GCode en colección ya no cobra implícitamente `edit_linear`.
   - `ENABLE_UNIVERSAL_TOPUPS` (o en compatibilidad `ENABLE_LEGACY_CREDIT_PACKS`) controla si las recargas one-time de saldo universal están activas.
3. Cobertura:
   - `server/__tests__/app-monetization.integration.test.ts` agrega casos para default `view` y rechazo de `actionId` inválido.
4. Baseline de validación en worktree limpia:
   - se ejecutó `pnpm install --frozen-lockfile`
   - se ejecutó `pnpm exec prisma generate`
   - se agregó `@types/pg@8.11.11` en `package.json` para restaurar `pnpm typecheck` en esta worktree
5. Revenue report y vista financiera alineados:
   - `server/subscription-finance.ts` agrega lectura segura de suscripciones activas desde Prisma para calcular MRR estimado y valor anualizado sin mezclarlo con revenue cobrado.
   - `GET /api/admin/reports/revenue` ahora consolida ingresos confirmados (`paypal:order`, `paypal:donation:order`, `paypal:subscription:payment`) y reemplaza el proxy legacy de IA por `ai_spend_tracked` real desde `activity_log`.
   - `src/app/pages/SuperAdmin.tsx` distingue ingresos confirmados, donaciones, MRR de suscripciones, cobros recurrentes ledgerizados y gasto IA real vs benchmark configurado.
   - `server/__tests__/app-monetization.integration.test.ts` cubre el agregado completo de revenue + gasto IA real sin depender de Prisma real en test.
6. Mapping de suscripciones + smoke automatizado:
   - `server/subscription-billing-map.ts` persiste/resuelve `planId -> billing` usando KV y env, y `server/paypal-subscriptions.ts` lo guarda al crear suscripciones.
   - `server/paypal-subscriptions.ts` ahora ledgeriza nuevos `PAYMENT.SALE.COMPLETED` en `paypal:subscription:payment:*`, para que el revenue confirmado no dependa solo de orders one-time o donaciones.
   - `scripts/verify-monetization-tiers.ts` automatiza el smoke por tier con provisioning temporal via admin o reutilización de cuentas ya existentes.
   - `docs/operations/monetization-tier-smoke.md` documenta variables, modos de ejecución y casos cubiertos.
7. Top-up universal implementado:
   - `POST /api/paypal/create-order` y `POST /api/paypal/capture-order` ahora acreditan recargas sobre `user:*:tool_credits`.
   - el estado universal separa `monthlyBalance` y `topupBalance`, consumiendo primero asignación mensual y luego saldo comprado.
   - `GET /api/tool-credits/me`, `POST /api/credits/purchase` y los cupones `bonus_credits` ya operan sobre el mismo saldo universal.
   - al tocar el sistema nuevo, `purchasedCredits` legacy se migran automáticamente al `topupBalance` para no perder compras previas.
8. Cierre explícito del bucket legacy:
   - `GET /api/admin/tool-credits/legacy-status` resume usuarios afectados, créditos pendientes y último backfill.
   - `POST /api/admin/tool-credits/legacy-migrate` ejecuta la migración batch hacia saldo universal y deja resumen persistido en admin.
   - `src/app/pages/SuperAdmin.tsx` expone preview, ejecución y evidencia del último batch dentro de `Finanzas`.
   - guía operativa en `docs/operations/legacy-topup-backfill.md`.
9. UI principal alineada al saldo universal:
   - `src/app/services/auth-context.tsx` dejó de usar fallback silencioso a `/api/credits` para poblar `creditBalance`.
   - header, perfil y vistas que consumen `useAuth().creditBalance` ahora muestran saldo universal real o `null`, pero no mezclan saldo legacy con el nuevo modelo.
   - `src/app/pages/Profile.tsx` ya muestra `saldo total`, `mensual disponible` y `top-up disponible`, en vez de mezclar saldo total con asignación mensual fija.
   - `register`, `refreshUser` y cambio de plan ahora refrescan también el saldo visible para que login/logout y transición de tier no queden con números viejos.
10. Smoke local ejecutado:
   - `pnpm verify:monetization:tiers` se ejecutó con provisioning temporal y cleanup sobre `http://localhost:3001/api`.
   - evidencia consolidada en `docs/operations/monetization-tier-smoke-2026-03-28.md`.
   - durante el run se corrigieron dos bugs del smoke: lectura incorrecta de `/api/tool-credits/me` y dependencia dura de `.env` en el wrapper.

## Validaciones corridas

- `pnpm exec vitest run server/__tests__/app-monetization.integration.test.ts` -> OK (`24` tests)
- `pnpm exec vitest run src/app/components/__tests__/root-nav.test.tsx src/app/pages/__tests__/news-sources-tab.test.tsx` -> OK (`3` tests)
- `pnpm exec tsx scripts/verify-monetization-tiers.ts --help` -> OK
- `pnpm verify:monetization:tiers` -> OK en local (`FREE`, `PRO`, `STUDIO PRO` + 2 bloqueos esperados)
- `pnpm typecheck` -> OK
- `pnpm lint` -> OK
- `pnpm build` -> OK
- `pnpm docs:api:generate` -> OK
- `pnpm docs:api:check` -> OK
- `GET /api/admin/tool-credits/legacy-status` + `POST /api/admin/tool-credits/legacy-migrate` cubiertos en `server/__tests__/app-monetization.integration.test.ts`

## Riesgos abiertos

1. El smoke E2E ya está automatizado y validado en local, pero no se ejecutó todavía fuera de local; cualquier entorno adicional requiere credenciales admin o cuentas smoke por tier.
2. El backfill legacy ya existe, pero falta correrlo en el entorno real que corresponda para declarar agotado el bucket `user:*:credits`.
3. Los pagos recurrentes nuevos ya se ledgerizan; si hay historial viejo anterior a este cambio, seguirá faltando backfill si se quiere verlo como revenue confirmado histórico.

## Siguiente orden recomendado

1. Ejecutar `pnpm verify:monetization:tiers` en el siguiente entorno a certificar fuera de local y guardar los artefactos generados.
2. Correr `legacy backfill` en el entorno real correspondiente y guardar el timestamp/evidencia del batch.
3. Si se necesita historia financiera completa de suscripciones, definir un backfill puntual de pagos recurrentes previos a este cambio.

## Bloque paralelo agregado - research/product strategy SCAD

Sin tocar runtime del motor, se agrego una capa repo-local de investigacion y ruteo para expansion futura de templates:

1. Nuevo documento:
   - `docs/research/parametric-scad-product-opportunities-2026-03.md`
2. Nuevo skill:
   - `.agents/codex-skills/vorea-parametric-scad-products/SKILL.md`
   - `.agents/codex-skills/vorea-parametric-scad-products/agents/openai.yaml`
3. Nuevas referencias:
   - `.agents/codex-skills/vorea-parametric-scad-products/references/technique-map.md`
   - `.agents/codex-skills/vorea-parametric-scad-products/references/studio-template-map.md`
4. Se actualizo `.agents/skills` para exponer el nuevo skill junto al skill de `surface/relief`.
5. Hallazgo clave:
   - `public/scad-library/catalog.json` ya contiene suficientes semillas para que la proxima oleada de Studio no empiece desde cero.
6. Ola sugerida de implementacion futura:
   - `drawer-organizer-tray`
   - `planter-drip-system`
   - `lamp-shade-kit`
   - `text-keychain-tag`
   - `threaded-jar`

Riesgo abierto de este bloque:

1. Es una entrega de estrategia/skill/documentacion; no agrega `familyHint` nuevos ni generadores en `src/app/parametric/*`.

## Bloque paralelo agregado - primera implementacion de la ola 1 SCAD

Se paso de research a runtime con la familia `drawer-organizer-tray`.

Implementado:

1. Nueva familia FDM soportada de punta a punta:
   - `src/app/parametric/instruction-spec.ts`
   - `src/app/parametric/spec-builder.ts`
   - `src/app/parametric/generators/fdm-utility.ts`
2. AI Studio actualizado:
   - preset nuevo `FDM Organizer`
   - label de familia nuevo
   - deteccion por prompt para organizer tray/cajon/divisores
3. Backend alineado:
   - `server/app.ts` amplia `AiRecipeFamily` y `AI_RECIPE_FAMILIES_BY_ENGINE`
4. Editor actualizado:
   - nuevo template built-in `Drawer Organizer Tray`
   - `src/app/models/drawer-organizer-tray.ts`
   - `src/app/pages/Editor.tsx`
5. i18n sincronizado:
   - `src/app/locales/en.json`
   - `src/app/locales/en-GB.json`
   - `src/app/locales/es.json`
   - `src/app/locales/es-AR.json`
   - `src/app/locales/es-MX.json`
   - `src/app/locales/es-UY.json`
   - `src/app/locales/pt.json`
   - `src/app/locales/pt-BR.json`
6. Cobertura nueva:
   - `src/app/parametric/__tests__/pipeline.test.ts`
   - `server/__tests__/mcp-tools.test.ts`

Validaciones corridas para este bloque:

- `pnpm test` -> OK (`45` files, `324` tests)
- `pnpm typecheck` -> OK
- `pnpm lint` -> OK
- `pnpm build` -> OK

Riesgos abiertos de este bloque:

1. `drawer-organizer-tray` ya existe en pipeline + Editor, pero todavia no se registro como nuevo asset dedicado dentro de `public/scad-library/catalog.json`.
2. La siguiente pieza de la ola 1 deberia decidirse entre `planter-drip-system` y `lamp-shade-kit` para mantener una secuencia equilibrada entre funcional y decorativo.

## Bloque paralelo agregado - segunda implementacion de la ola 1 SCAD

Se sumo `planter-drip-system` como segunda familia nueva ya operativa.

Implementado:

1. Nueva familia FDM soportada de punta a punta:
   - `src/app/parametric/instruction-spec.ts`
   - `src/app/parametric/spec-builder.ts`
   - `src/app/parametric/generators/fdm-utility.ts`
2. AI Studio actualizado:
   - preset nuevo `FDM Planter`
   - label de familia nuevo
   - deteccion por prompt para `planter/maceta/drip`
3. Backend alineado:
   - `server/app.ts` amplia `AiRecipeFamily` y `AI_RECIPE_FAMILIES_BY_ENGINE`
4. Editor actualizado:
   - nuevo template built-in `Planter Drip System`
   - `src/app/models/planter-drip-system.ts`
   - `src/app/pages/Editor.tsx`
5. i18n sincronizado:
   - `src/app/locales/en.json`
   - `src/app/locales/en-GB.json`
   - `src/app/locales/es.json`
   - `src/app/locales/es-AR.json`
   - `src/app/locales/es-MX.json`
   - `src/app/locales/es-UY.json`
   - `src/app/locales/pt.json`
   - `src/app/locales/pt-BR.json`
6. Cobertura nueva:
   - `src/app/parametric/__tests__/pipeline.test.ts`
   - `server/__tests__/mcp-tools.test.ts`

Validaciones corridas para este bloque:

- `pnpm test` -> OK (`45` files, `327` tests)
- `pnpm typecheck` -> OK
- `pnpm lint` -> OK
- `pnpm build` -> OK

Riesgos abiertos de este bloque:

1. `planter-drip-system` ya existe en pipeline + Editor, pero todavia no se registro como nuevo asset dedicado dentro de `public/scad-library/catalog.json`.
2. La siguiente pieza recomendada para mantener balance del catalogo es `lamp-shade-kit`.

## Bloque paralelo agregado - tercera implementacion de la ola 1 SCAD

Se sumo `lamp-shade-kit` como tercera familia nueva ya operativa.

Implementado:

1. Nueva familia FDM soportada de punta a punta:
   - `src/app/parametric/instruction-spec.ts`
   - `src/app/parametric/spec-builder.ts`
   - `src/app/parametric/generators/fdm-utility.ts`
2. AI Studio actualizado:
   - preset nuevo `FDM Lamp`
   - label de familia nuevo
   - deteccion por prompt para `lamp/lampara/shade/pantalla`
3. Backend alineado:
   - `server/app.ts` amplia `AiRecipeFamily` y `AI_RECIPE_FAMILIES_BY_ENGINE`
4. Editor actualizado:
   - nuevo template built-in `Lamp Shade Kit`
   - `src/app/models/lamp-shade-kit.ts`
   - `src/app/pages/Editor.tsx`
5. i18n sincronizado:
   - `src/app/locales/en.json`
   - `src/app/locales/en-GB.json`
   - `src/app/locales/es.json`
   - `src/app/locales/es-AR.json`
   - `src/app/locales/es-MX.json`
   - `src/app/locales/es-UY.json`
   - `src/app/locales/pt.json`
   - `src/app/locales/pt-BR.json`
6. Cobertura nueva:
   - `src/app/parametric/__tests__/pipeline.test.ts`
   - `server/__tests__/mcp-tools.test.ts`

Validaciones corridas para este bloque:

- `pnpm test` -> OK (`45` files, `330` tests)
- `pnpm typecheck` -> OK
- `pnpm lint` -> OK
- `pnpm build` -> OK

Riesgos abiertos de este bloque:

1. `lamp-shade-kit` ya existe en pipeline + Editor, pero todavia no se registro como nuevo asset dedicado dentro de `public/scad-library/catalog.json`.
2. La siguiente pieza recomendada de la ola 1 pasa a ser `threaded-jar`.

## Bloque paralelo agregado - cuarta implementacion de la ola 1 SCAD

Se sumo `text-keychain-tag` como cuarta familia nueva ya operativa y como primera linea explicita de productos personalizados con texto.

Implementado:

1. Nueva familia FDM soportada de punta a punta:
   - `src/app/parametric/instruction-spec.ts`
   - `src/app/parametric/spec-builder.ts`
   - `src/app/parametric/generators/fdm-utility.ts`
2. AI Studio actualizado:
   - preset nuevo `FDM Keychain`
   - label de familia nuevo
   - soporte de parametros `string` y `bool`
   - deteccion por prompt para `keychain/llavero/tag/texto/nombre`
3. Backend alineado:
   - `server/app.ts` amplia `AiRecipeFamily` y `AI_RECIPE_FAMILIES_BY_ENGINE`
4. Editor y libreria publica actualizados:
   - nuevo template built-in `Text Keychain Tag`
   - `src/app/models/text-keychain-tag.ts`
   - `src/app/pages/Editor.tsx`
   - `public/scad-library/models/vorea-text-keychain-tag.scad`
   - `public/scad-library/catalog.json`
5. i18n sincronizado:
   - `src/app/locales/en.json`
   - `src/app/locales/es.json`
   - `src/app/locales/pt.json`
   - variantes regionales activas
6. Cobertura nueva:
   - `src/app/parametric/__tests__/pipeline.test.ts`
   - `server/__tests__/mcp-tools.test.ts`

Riesgos abiertos de este bloque:

1. `text-keychain-tag` abre la via de personalizacion con texto, pero no reemplaza el cierre completo de `BG-205` para geometria avanzada y futuras familias `nameplate-pro`/`peg-label-system`.
2. La siguiente pieza utilitaria recomendada de la ola 1 sigue siendo `threaded-jar`, aunque la rama textual ya quedo habilitada para profundizar catalogo.

## Bloque paralelo agregado - quinta implementacion de la ola 1 SCAD

Se sumo `nameplate-pro` como quinta familia nueva ya operativa y como segunda pieza explicita de personalizacion con texto.

Implementado:

1. Nueva familia FDM soportada de punta a punta:
   - `src/app/parametric/instruction-spec.ts`
   - `src/app/parametric/spec-builder.ts`
   - `src/app/parametric/generators/fdm-utility.ts`
2. AI Studio actualizado:
   - preset nuevo `FDM Nameplate`
   - label de familia nuevo
   - deteccion por prompt para `nameplate/placa/cartel/letrero/signage`
3. Backend alineado:
   - `server/app.ts` amplia `AiRecipeFamily` y `AI_RECIPE_FAMILIES_BY_ENGINE`
4. Editor y libreria publica actualizados:
   - nuevo template built-in `Nameplate Pro`
   - `src/app/models/nameplate-pro.ts`
   - `src/app/pages/Editor.tsx`
   - `public/scad-library/models/vorea-nameplate-pro.scad`
   - `public/scad-library/catalog.json`
5. i18n sincronizado:
   - `src/app/locales/en.json`
   - `src/app/locales/es.json`
   - `src/app/locales/pt.json`
   - variantes regionales activas
6. Cobertura nueva:
   - `src/app/parametric/__tests__/pipeline.test.ts`
   - `server/__tests__/mcp-tools.test.ts`

Validaciones corridas para este bloque:

- `pnpm exec vitest run src/app/parametric/__tests__/pipeline.test.ts server/__tests__/mcp-tools.test.ts` -> OK (`2` files, `23` tests)
- `pnpm typecheck` -> OK
- `pnpm lint` -> OK
- `pnpm build` -> OK

Riesgos abiertos de este bloque:

1. `nameplate-pro` consolida la linea textual, pero no reemplaza el cierre de `BG-205` para etiquetado funcional (`peg-label-system`) y signage mas complejo.
2. La siguiente pieza recomendada de la ola 1 pasa a ser `peg-label-system`, dejando `threaded-jar` como siguiente salto utilitario luego de cerrar la rama de texto funcional.

## Bloque paralelo agregado - sexta implementacion de la ola 1 SCAD

Se sumo `peg-label-system` como sexta familia nueva ya operativa y como cierre funcional de la rama textual antes de pasar a contenedores roscados.

Implementado:

1. Nueva familia FDM soportada de punta a punta:
   - `src/app/parametric/instruction-spec.ts`
   - `src/app/parametric/spec-builder.ts`
   - `src/app/parametric/generators/fdm-utility.ts`
2. AI Studio actualizado:
   - preset nuevo `FDM Peg Label`
   - label de familia nuevo
   - deteccion por prompt para `pegboard/bin label/storage label/etiqueta de taller`
3. Backend alineado:
   - `server/app.ts` amplia `AiRecipeFamily` y `AI_RECIPE_FAMILIES_BY_ENGINE`
4. Editor y libreria publica actualizados:
   - nuevo template built-in `Peg Label System`
   - `src/app/models/peg-label-system.ts`
   - `src/app/pages/Editor.tsx`
   - `public/scad-library/models/vorea-peg-label-system.scad`
   - `public/scad-library/catalog.json`
5. i18n sincronizado:
   - `src/app/locales/en.json`
   - `src/app/locales/es.json`
   - `src/app/locales/pt.json`
   - variantes regionales activas
6. Cobertura nueva:
   - `src/app/parametric/__tests__/pipeline.test.ts`
   - `server/__tests__/mcp-tools.test.ts`

Riesgos abiertos de este bloque:

1. `peg-label-system` ya permite etiquetado funcional, pero no reemplaza futuras iteraciones mas complejas de signage/clips dentro de `BG-205`.
2. La siguiente pieza recomendada de la ola 1 pasa a ser `threaded-jar`.

## Bloque paralelo agregado - septima implementacion de la ola 1 SCAD

Se sumo `threaded-jar` como septima familia nueva ya operativa y como cierre de la secuencia segura de expansion utilitaria.

Implementado:

1. Nueva familia FDM soportada de punta a punta:
   - `src/app/parametric/instruction-spec.ts`
   - `src/app/parametric/spec-builder.ts`
   - `src/app/parametric/generators/fdm-utility.ts`
2. AI Studio actualizado:
   - preset nuevo `FDM Threaded Jar`
   - label de familia nuevo
   - deteccion por prompt para `jar/frasco/tarro/roscado/screw lid`
3. Backend alineado:
   - `server/app.ts` amplia `AiRecipeFamily` y `AI_RECIPE_FAMILIES_BY_ENGINE`
4. Editor y libreria publica actualizados:
   - nuevo template built-in `Threaded Jar`
   - `src/app/models/threaded-jar.ts`
   - `src/app/pages/Editor.tsx`
   - `public/scad-library/models/vorea-threaded-jar.scad`
   - `public/scad-library/catalog.json`
5. i18n sincronizado:
   - `src/app/locales/en.json`
   - `src/app/locales/es.json`
   - `src/app/locales/pt.json`
   - variantes regionales activas
6. Cobertura nueva:
   - `src/app/parametric/__tests__/pipeline.test.ts`
   - `server/__tests__/mcp-tools.test.ts`

Riesgos abiertos de este bloque:

1. `threaded-jar` ya deja rosca helicoidal simple usable dentro del pipeline, pero no reemplaza futuras mejoras de precision mecanica o librerias de roscas mas avanzadas.
2. La ola 1 segura queda cerrada; el siguiente paso puede abrir ola 2 o profundizar `BG-205`.

## Refinamiento agregado - `BG-205` texto y roscas

Se aplico una mejora de calidad sobre familias ya implementadas, sin abrir nuevas familias:

1. `text-keychain-tag`, `nameplate-pro` y `peg-label-system` ahora generan `text_fit` para adaptar mejor textos largos dentro del ancho util del producto.
2. Se relajo el truncado maximo de texto en runtime para que nombres y labels comunes no se corten tan pronto.
3. `threaded-jar` ahora expone `thread_clearance` y `lead_in`, mejorando holgura radial y entrada guiada de la tapa.
4. Seeds del Editor y `public/scad-library` quedaron sincronizadas con estas mejoras.
5. Tests ampliados para verificar:
   - texto largo en `nameplate-pro`
   - nuevos parametros de rosca en `threaded-jar`

Riesgos abiertos:

1. El ajuste de texto sigue siendo heuristico; todavia no hay wrapping multilinea ni medicion real por fuente.
2. Las roscas mejoraron, pero aun falta una capa mas precisa si se quiere apuntar a tolerancias por material/slicer o librerias tipo `BOSL2`.

## Refinamiento agregado - `BG-205` v2: texto extruido y rosca con mas cresta

Se aplico una segunda pasada de calidad sobre el mismo bloque, motivada por validacion visual local:

1. `text-keychain-tag`, `nameplate-pro` y `peg-label-system` ahora generan texto volumetrico real mediante `linear_extrude`, en lugar de depender de un `text()` 2D escalado sobre Z.
2. Seeds del Editor y `public/scad-library` quedaron resincronizadas para reflejar exactamente esa mejora.
3. `threaded-jar` adopta un perfil helicoidal con cresta mas marcada (`depth * 0.42 -> depth -> depth * 0.42`) para evitar una lectura demasiado plana en preview/export.
4. La cobertura se endurecio para verificar:
   - texto extruido en SCAD generado;
   - firma del nuevo perfil de rosca.

Riesgos abiertos:

1. El texto ahora tiene volumen real, pero sigue faltando multilinea, slots de iconos y mejor ajuste tipografico.
2. La rosca ya se lee mejor, pero todavia no hay tolerancia calibrada por material ni soporte de libreria mecanica avanzada.

## Refinamiento agregado - `BG-205` v3: split de texto y compensacion de rosca

Se aplico una tercera pasada enfocada en usabilidad real del output paramétrico:

1. `nameplate-pro` y `peg-label-system` ahora hacen split automatico a 2 lineas cuando el texto es largo y el corte por palabras queda equilibrado.
2. El SCAD generado para signage ahora expone:
   - `primary_text`
   - `secondary_text`
   - `line_count`
   - `line_gap`
   - `line_offset`
3. AI Studio ya respeta limites de texto por familia en vez de cortar todo a `24` caracteres, lo que evita truncar demasiado pronto placas y labels.
4. `threaded-jar` ahora agrega:
   - `thread_depth`
   - `fit_slop`
5. La rosca calcula `effective_thread_clearance` y `effective_lid_clearance`, mejorando el tuning fino para material/slicer sin romper el flujo actual.
6. Seeds del Editor, `public/scad-library` y el catalogo quedaron sincronizados.
7. Cobertura endurecida para verificar:
   - split textual de signage;
   - nuevos parametros y formulas de compensacion de rosca.

Riesgos abiertos:

1. El texto ya se adapta mucho mejor, pero sigue pendiente multilinea libre, iconografia y fit tipografico mas preciso.
2. La rosca ya ofrece tuning mas util, pero falta contrastarlo con slicers/filamentos reales para declarar cerrado el frente mecanico.
