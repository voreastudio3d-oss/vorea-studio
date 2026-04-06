# Handoff: Motor IA Multi-LLM para AI Studio
**Fecha:** 2026-04-01
**Agente Saliente:** Gemini 3.1 Pro (High)
**Agente Entrante Sugerido:** GPT-5.4 (o Claude Sonnet)

## 1. Resumen de Cambios
- **Qué se cambió:** Se implementó y conectó exitosamente el Motor LLM Backend (`server/ai-generation-engine.ts`) con el frontend asíncrono en `AIStudio.tsx`. Se habilitó arquitectura Multi-LLM configurable desde KV (`admin:ai_config`) soportando Gemini, OpenAI, Claude, DeepSeek y Kimi.
- **Por qué se cambió:** Para abandonar el mock determinista y dotar al AI Studio de verdadera generación paramétrica 3D basada en lenguaje natural con soporte iterativo y fallback seguro.

## 2. Validaciones Ejecutadas
- `npx tsc --noEmit` -> PASS (0 errores en Frontend y Backend).
- Inicio de Servidor (`npm run dev`) -> PASS (Vite levanta en el puerto 5173 sin bloqueos, UI renderizando correctamente los nuevos estados interactivos).

## 3. Impacto Funcional/API
- **API Impactada:** Nuevo endpoint `POST /api/ai-studio/generate` que integra cobro de Budget Vorea, validación de LLMs, y Auto-Refund.
- **Flujo Impactado:** Al hacer clic en "Generar" en el AI Studio, ahora inicia un Job asíncrono con *progressive loading* animado en UI. Si falla, cae al generador algorítmico local (Parametric Pipeline).

## 4. Decisiones de Negocio y Producto (Alineadas con Vorea)
1. **Modelos y Claves `.env` (Completado en `.env.example`):**
   Las APIs soportadas son `GEMINI_MODEL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `KIMI_API_KEY`. (Ya están listas para que el admin las copie a su `.env` local y producción).
2. **Costo Dinámico de Créditos:**
   Se recomienda que la interfaz de Admin permita ponderar el costo del crédito y el markup de ganancia basado en la fluctuación y elección del LLM (ej. Gemini Flash es baratísimo, Claude Opus muy caro). Esto será programado en la próxima iteración del backend.
3. **El Upsell de Calidad (Draft vs Final Model):**
   *(Decisión del owner)*: "Draft" generará un modelo *feo/low-poly* por defecto con la IA por un costo mínimo. Si el usuario desea el modelo "Final" y mejorarlo, debe pagar costo adicional en créditos. **Alineación perfecta con la estrategia de monetización de créditos Vorea.**

## 5. Próximas Tareas y Riesgos (Para GPT-5.4)
- **Tarea #1:** Construir la UI en el Panel de Administración (SuperAdmin) para configurar la clave `admin:ai_config`. Debe permitir seleccionar qué Proveedor LLM usar en caliente y qué Modelo, activando únicamente los que tengan clave válida en el servidor.
- **Riesgo/Pendiente:** Para probar la UI del Selector Admin, el entorno del server debe estar levantado y tener *al menos* otra API Key aparte de Gemini cargada en el `.env` (ej. meter algún valor de prueba temporal en `OPENAI_API_KEY=test`).

## 6. Ruta Agéntica Usada
- **Rama Actual:** `feature/ai-studio-llm-engine` (Commits: `bb689e1`, `2cca2ab`, `740b93c`).
- **Plan Activo:** `.agents/runtime/llm_delegation_plan.md` (Completado y reasignado a GPT-5.4).
- **Current Block:** `ai-studio-llm-integration` en estado finalizado base.

---

## 7. Addendum — Railway + Hardening Anti-Abuso

### Qué se cambió
- Se reparó el `Dockerfile` para Railway:
  - se eliminó la copia rota de `src/app/parametric/`
  - se copia `src/app/engine/`, que es lo que el backend importa en runtime
  - la etapa `production` vuelve a instalar dependencias completas porque el server corre con `tsx`
- Se endurecieron rutas críticas contra abuso y saturación:
  - auth: `signup`, `signin`, `request-reset`, `reset-password`, Google login, owner reset
  - IA: `POST /api/ai-studio/generate`, `POST /api/ai/quick-fix`
  - egress/BYOK: `POST /api/vault/keys/:provider/test`
  - write-heavy: `POST /api/telemetry/batch`, `POST /api/uploads/thumbnail`, `POST /api/uploads/community-image`
- `reset_pin:*` ahora se guarda con `expiresAt` real en KV.
- `JWT_SECRET` ahora falla de forma explícita en producción si no está configurado.

### Validaciones ejecutadas
- `npm run typecheck` -> PASS
- `npm run docs:api:generate` -> PASS
- `npm run docs:api:check` -> PASS
- `docker build -t vorea-railway-fix:test .` -> PASS
- Smoke runtime container:
  - primera corrida detectó fallo real adicional: faltaba `tsx` en runtime
  - tras ajustar Dockerfile, `docker run ...` + `GET /api/health` -> PASS

### Evidencia de abuso controlado (solo local/dev)
- `signin`: 10 respuestas `401`, intento 11 -> `429`
- `request-reset`: 3 respuestas `200`, intento 4 -> `429`
- `telemetry/batch`: 60 respuestas `200`, intento 61 -> `429`
- `telemetry/batch` con 101 eventos -> `400`
- `ai-studio/generate` con usuario autenticado de prueba: 6 respuestas `400`, intento 7 -> `429`
- `reset_pin:{userId}` verificado con shape:
  - `pin`
  - `expiresAt`
  - `requestedAt`

### Documentación nueva
- `.agents/runtime/security_abuse_audit_2026-04-01.md`
- `.agents/workflows/service_abuse_hardening_runbook.md`
- `🧠_Cerebro_Vorea.md` actualizado para enlazar ambos

### Riesgos residuales
- El rate limit sigue siendo in-memory y de nodo único; no es distribuido si Railway escala instancias.
- En dev/local `request-reset` todavía puede devolver `pinDev`.
- Hay fallos preexistentes en `npm run test` no originados por este bloque:
  - suite vacía en `server/tests/circuit-breaker.test.ts`
  - drift/YAML en `agent-governance`
  - expectativa vieja en `route-access.test.ts`

### Siguiente paso recomendado
1. Redeploy en Railway con este `Dockerfile`.
2. Verificar variables críticas en Railway: `JWT_SECRET`, `DATABASE_URL`, `DEPLOY_SECRET`, keys IA.
3. Siguiente iteración de seguridad:
   - mover rate limiting a backend compartido/TTL real
   - endurecer spam en comunidad (`comments`, `likes`, `downloads`, `publish`)
   - añadir alertas operativas por picos de `429`, gasto IA y abuse traffic.

---

## 8. Addendum — AI Studio Prompt Normalizer + Intelligent Router

### Qué se cambió
- Se formalizó el pipeline backend de AI Studio en cuatro capas:
  - `PromptIngress`
  - `NormalizedGenerationRequest`
  - `RoutingDecision`
  - `MasterPromptEnvelope`
- Se creó `server/ai-studio-pipeline.ts` como módulo nuevo para:
  - normalización de prompt
  - clasificación de intención
  - validación/clamp de overrides contra schema real
  - cálculo de forecast
  - routing cross-provider
  - persistencia de trazas y agregados diarios
- `server/ai-generation-engine.ts` quedó más enfocado como capa de adapters/runtime health/catalogo de modelos.
- `POST /api/ai-studio/generate` ahora:
  - construye `PromptIngress`
  - normaliza y enriquece
  - decide provider/model por tier + quality + forecast + salud
  - compone el prompt final
  - persiste `trace` analítica
  - devuelve metadata de routing al cliente
- `GET /api/ai-studio/config` y `GET /api/admin/ai-budget` ahora exponen snapshot operativo del automático y forecast.

### Persistencia nueva
- Prisma schema extendido con:
  - `AiGenerationTrace`
  - `AiGenerationDailyAggregate`
- `promptRawEncrypted` se guarda cifrado con AES-256-GCM.
- `promptNormalized` se guarda en claro para analytics y evolución de reglas.

### Política de routing implementada
- precedencia:
  1. tier/SLA
  2. calidad (`final` antes que `draft`)
  3. coste dentro de la lane permitida
- bandas:
  - `green`
  - `yellow`
  - `red`
  - `blocked`
- lanes:
  - `economy`
  - `balanced`
  - `premium`

### UI/Admin
- `AiStudioAdminTab.tsx` ahora muestra:
  - manual override vs automático
  - forecast actual
  - lane matrix efectiva
  - projected spend/utilization
  - providers/modelos elegibles
  - recent traces de routing/fallback

### Validaciones ejecutadas
- `npm run db:generate` -> PASS
- `npm run typecheck` -> PASS
- `npx vitest run server/__tests__/ai-studio-pipeline.test.ts src/app/services/__tests__/ai-studio-history.test.ts` -> PASS
- `npm run docs:api:generate` -> PASS
- `npm run docs:api:check` -> PASS

### Documentación nueva
- `.agents/runtime/ai_studio_prompt_routing_architecture_2026-04-01.md`
- `🧠_Cerebro_Vorea.md` actualizado con el nuevo documento

### Riesgos residuales
- falta migración/rollout explícito de Prisma en entornos remotos para las nuevas tablas
- admin aún no edita reglas del router/normalizador; eso queda como Fase 2
- faltan tests de integración del endpoint completo, más allá del unit test del pipeline
- el automatic routing ya ejecuta fallback chain real cuando el intento primario falla por provider/model, pero todavía falta observabilidad más rica sobre cada intento intermedio.

### Nota operativa de producción
- Se detectó en Railway que `AI Studio CMS` podía quedar visualmente “vacío” si fallaba `GET /api/admin/ai-budget`, porque el tab cargaba `config + budget + CMS` con `Promise.all`.
- Se corrigió para permitir carga parcial del panel:
  - el motor LLM y CMS siguen renderizando aunque falle budget
  - el budget muestra error explícito en su tarjeta
- También se alineó el bootstrap de `SUPERADMIN_EMAILS` con el owner usado en otros guards (`martindaguerre@gmail.com`) para evitar falsos `403` en rutas de admin budget.
- Se eliminó la definición duplicada de `GET/PUT /api/admin/ai-budget` en `server/app.ts`, reduciendo drift entre handlers y bajando el inventario de rutas duplicadas de `6` a `4`.
- Se enriqueció el router IA para persistir `attemptHistory` real en cada generación y mostrar en admin la cadena de intentos/fallbacks (`provider/model/status`).
- Se clarificó semánticamente el panel admin de AI Studio:
  - `Pricing de modelos` ahora muestra el catálogo `costPer1kTokens` por modelo como costo de referencia por 1K tokens
  - `Budget operativo` quedó separado para métricas acumuladas/proyectadas (`gastado`, `revenue`, `budget efectivo`, `forecast`)
  - `Disponibilidad y routing` concentra salud del runtime, lane matrix, fallbacks y trazas
- Se corrigió también el formateo de costos muy chicos para evitar que valores como `0.00014` se vieran como `US$ 0,00`, lo que inducía a confundir pricing con ausencia de gasto.
- Se hizo una primera pasada de revisión de copy/i18n en AI Studio Admin y locales `es/pt`:
  - se reemplazaron anglicismos visibles como `revenue`, `pricing`, `routing`, `draft` y `recipe` en superficies de admin y cadenas `studio.ai.*`
  - se diferenciaron mejor `costos de modelos` vs `presupuesto operativo`
  - queda pendiente una revisión más amplia del resto de locales fuera del bloque AI Studio/Admin
- Se completó además una pasada equivalente en `en.json` para el bloque `studio.ai.*`, enfocada en consistencia de tono y terminología (`Studio compilation`, `draft/final mode`, `recipes`, `compilation preview`).
- Se hizo también un **corte documental** para separar fuentes canónicas de notas históricas o borradores:
  - `.agents/runtime/documentation_cutoff_2026-04-01.md`
  - `llm_delegation_plan.md` quedó marcado como histórico/parcialmente desfasado
  - `marketing_audit.md` quedó marcado como parcialmente vigente con hallazgos resueltos y pendientes
  - `IA-Prompts.md` se confirma como redirect/deprecado correcto
  - los borradores raíz `Auditoría de abuso...` y `llm_analysis.md` quedan explícitamente fuera del flujo canónico
- Se hizo una pasada de **higiene de Obsidian** para que el vault refleje mejor el estado operativo:
  - se creó `.agents/runtime/README.md` como índice runtime canónico
  - `🧠_Cerebro_Vorea.md` enlaza ya explícitamente `ai_handoff_2026-04-01` y el índice runtime
  - el grafo dejó de mostrar huérfanos temporales por defecto (`showOrphans=false`)
  - el workspace dejó de priorizar `Sin título.canvas`, `Sin título.base` y `2026-04-01.md` en `lastOpenFiles`
  - esas notas temporales no se borraron; solo se sacaron del foco operativo/visual
