# AI Studio — Arquitectura de Normalización y Routing Inteligente

**Fecha:** 2026-04-01  
**Estado:** Implementado base en backend + admin observability  
**Scope:** `POST /api/ai-studio/generate`, `GET/PUT /api/ai-studio/config`, `GET /api/admin/ai-budget`

## 1. Objetivo

Formalizar el pipeline de generación de AI Studio para que el frontend deje de componer prompts complejos y el backend pase a ser la única capa que:

1. recibe la intención cruda del usuario
2. la normaliza contra reglas y schema real
3. decide provider/model por forecast y SLA
4. compone el prompt maestro final
5. ejecuta el provider y registra trazas analíticas

El fallback al pipeline local se mantiene como red de seguridad.

## 2. Capas del pipeline

### PromptIngress

Representa lo que llega desde el frontend o desde un consumidor externo del endpoint:

- `prompt`
- `familySlug`
- `engine`
- `quality`
- `parameterOverrides`
- `sourceRecipeId`
- `locale`
- `userId`
- `tier`

Esta shape sigue siendo implícita para el frontend actual. No se movió lógica semántica al cliente.

### NormalizedGenerationRequest

Es el request canónico interno que el backend usa para seguridad, analytics y composición de prompt:

- prompt raw, limpio, canonical y normalized
- familia pedida vs familia resuelta
- schema real de parámetros
- overrides validados y clamped
- intención clasificada
- warnings y risk flags
- SCAD template base cuando exista
- contexto de monetización: tier, credit cost, channel

### RoutingDecision

Es la decisión del router cross-provider:

- `mode`: `manual` o `automatic`
- `provider`
- `model`
- `lane`: `economy`, `balanced`, `premium`
- `reason`
- `forecast`
- `fallbackChain`
- `traceId`

### MasterPromptEnvelope

Es el prompt final listo para el adapter LLM:

- `systemPrompt`
- `userPrompt`
- `summary`
- metadata de analytics: prompt normalized, risk flags, intent, lane

## 3. Flujo actual

1. `server/ai-studio-routes.ts` valida auth, rate limit, budget y créditos.
2. El route construye `PromptIngress`.
3. `server/ai-studio-pipeline.ts` ejecuta `normalizePromptIngress(...)`.
4. El mismo módulo calcula forecast y corre `decideRouting(...)`.
5. `buildMasterPromptEnvelope(...)` compone el prompt final.
6. `server/ai-generation-engine.ts` ejecuta el provider/model elegido.
7. Si el intento primario falla y el modo es automático, el pipeline recorre `fallbackChain` antes de declarar fallo final.
8. `recordGenerationTrace(...)` persiste analítica y agregados diarios con la ruta realmente usada.
9. El endpoint devuelve resultado + metadata de routing.

## 4. Reglas base del normalizador

### Clasificación de intención

Se reutiliza la semántica de `src/app/engine/spec-builder.ts` y `InstructionSpecV1`.

Intents actuales:

- `create_from_scratch`
- `adapt_template`
- `dimension_customization`
- `text_or_engraving`
- `functional_part`
- `decorative_part`

### Validación de overrides

- los overrides se validan contra el schema real de la familia si existe
- si no existe, se usa el schema inferido por `buildInstructionSpec(...)`
- parámetros fuera de schema generan warning
- numéricos fuera de rango se clamped a min/max
- strings se acotan para evitar payloads excesivos

### Risk flags iniciales

- `prompt_short`
- `family_mismatch`
- `override_massive`
- `unknown_override`
- `override_clamped`
- `prompt_injection_marker`
- `external_library_request`

Estas reglas viven en código versionado. Admin editable queda explícitamente como Fase 2.

## 5. Router automático inteligente

El router ya no elige “el primer provider disponible”. Ahora decide con:

1. tier/SLA del usuario
2. calidad pedida (`final` antes que `draft`)
3. coste esperado dentro de la lane permitida
4. salud del runtime por provider/model

### Forecast bands

- `green`: proyección < 70%
- `yellow`: 70% a 90%
- `red`: > 90%
- `blocked`: presupuesto agotado o circuit breaker

### Política de lanes

- `draft` prioriza coste
- `final` prioriza calidad salvo forecast `red`
- tiers altos conservan mejor lane que `FREE`

### Salud del runtime

El engine mantiene candidatos/modelos sanos usando:

- provider con key válida
- provider implementado
- cooldown por fallas consecutivas
- exclusión temporal por errores recientes

## 6. Persistencia y BigData

La fuente de verdad para forecast es DB, no KV.

### Tabla `AiGenerationTrace`

Guarda trazas request-level:

- usuario, tier, provider, model, lane, quality
- `attemptHistory` con la cadena real de intentos/fallbacks
- prompt raw cifrado
- prompt normalized en claro
- intent y risk flags
- familia pedida y resuelta
- credit cost y estimated USD
- status, failure code y routing reason

### Tabla `AiGenerationDailyAggregate`

Guarda agregados diarios por:

- día
- provider
- model
- tier
- quality

Métricas:

- requests
- success/failure
- credits
- estimated USD

### Política de cifrado

- `promptRawEncrypted` usa AES-256-GCM vía `server/crypto.ts`
- `promptNormalized` queda en claro para analítica interna y evolución de reglas

## 7. Superficies admin expuestas

### `GET /api/ai-studio/config`

Devuelve:

- config actual
- providers sanos
- candidates sanos
- forecast snapshot
- lane matrix efectiva
- recommended fallbacks
- recent traces

### `GET /api/admin/ai-budget`

Ahora incluye:

- `projectedMonthEndSpendUsd`
- `projectedUtilization`
- `forecastBand`
- breakdown por `quality`
- breakdown por `lane`

### `AiStudioAdminTab`

El panel muestra:

- manual override vs automático
- forecast actual
- lane matrix vigente
- spend actual vs proyectado
- candidates elegibles
- trazas recientes de routing/fallback con cadena de intentos

## 8. Archivos principales

- `server/ai-studio-pipeline.ts`
- `server/ai-generation-engine.ts`
- `server/ai-studio-routes.ts`
- `server/prisma.ts`
- `prisma/schema.prisma`
- `src/app/engine/spec-builder.ts`
- `src/app/engine/instruction-spec.ts`
- `src/app/services/api-client.ts`
- `src/app/pages/AiStudioAdminTab.tsx`

## 9. Validaciones ejecutadas

- `npm run db:generate`
- `npm run typecheck`
- `npx vitest run server/__tests__/ai-studio-pipeline.test.ts src/app/services/__tests__/ai-studio-history.test.ts`
- `npm run docs:api:generate`
- `npm run docs:api:check`

## 10. Riesgos y backlog Fase 2

- el router usa heurística de coste y bandas, pero todavía no modela calidad percibida ni success-rate histórico por prompt class
- no hay admin editable para reglas del normalizador/router
- el endpoint devuelve metadata de routing, pero todavía no existe una vista histórica dedicada en admin para analytics avanzados
- la persistencia de forecast depende de que Prisma schema esté desplegado en todos los entornos
- falta decidir políticas de retención/anonimización a largo plazo para prompts cifrados

## 11. Siguiente paso recomendado

1. agregar migración/deploy de Prisma para las nuevas tablas
2. instrumentar dashboard histórico de trazas y forecast por día
3. sumar tests de integración del endpoint `/api/ai-studio/generate`
4. abrir Fase 2 para reglas editables y políticas de routing administrables
