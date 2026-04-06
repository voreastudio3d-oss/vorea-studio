# AI Handoff — 2026-04-05
## BG-006 + BG-301: Monetización Hardening + Motor LLM Verificado

**Rama mergeada:** `claude/feat/bg301-llm-engine-contract` → `develop` (`d5cec65`)

---

## Estado del Motor LLM (verificado en vivo)

El motor LLM **ya estaba completamente implementado** antes de esta sesión.
`ai-generation-engine.ts` tiene 5 providers con HTTP calls reales.

### Resultados del Smoke Test Real (2026-04-05)

| Provider | Modelo | Estado | Latencia |
|---|---|---|---|
| openai | gpt-4o-mini | ✅ FUNCIONA | ~2600ms |
| openai | gpt-4o | ✅ FUNCIONA | ~2700ms |
| deepseek | deepseek-chat | ✅ FUNCIONA | ~720ms |
| gemini | gemini-2.5-pro | ❌ 429 cuota free-tier | — |
| gemini | gemini-2.5-flash | ❌ 429 cuota free-tier | — |
| anthropic | claude-opus-4-20250514 | ✅ FUNCIONA (verificado) | — |
| anthropic | claude-sonnet-4-20250514 | ✅ FUNCIONA (verificado) | — |

---

## Cambios Implementados en Esta Sesión

### BG-301 — Integración End-to-End

**`server/credit-ledger.ts`**
- `IdempotencyRecord`: agregado `userId?: string`
- `markGenerationCompleted`: firma extendida con `userId`

**`server/ai-studio-routes.ts`**
- Nuevo `GET /api/ai-studio/generation/:generationId`
  - `200 + cached:true` → resultado listo
  - `202` → en progreso
  - `404` → no encontrado
  - Validación de ownership: `record.userId === userId`
- `markGenerationCompleted` llamado con `{ userId, ...responsePayload }`

**`src/app/services/api-client.ts`**
- `AiStudioGenerateRequest.generationId?: string`
- `AiStudioGenerateResponse.cached?: boolean` + `generationId?: string`
- `AiStudioGenerateApi.generate()`: auto-genera UUID si no se provee
- `AiStudioGenerateApi.getGenerationResult(id)`: nuevo método HTTP GET

**`server/__tests__/ai-generation-engine.smoke.test.ts`** (NUEVO)
- Suite de smoke tests permanente con auto-skip si no hay API key
- Cubre: openai, deepseek, gemini, anthropic

### Fix Anthropic Models

**`server/ai-generation-engine.ts`**
- Reemplazados model IDs deprecados de Claude 3.x por Claude 4 verificados:
  - `claude-opus-4-20250514` ($0.015/1k tokens)
  - `claude-sonnet-4-20250514` ($0.003/1k tokens)

---

## Pendientes Operativos

| Ítem | Acción |
|---|---|
| Gemini 429 | Activar Pay-as-you-go en Google AI Studio console |
| Kimi | Agregar `KIMI_API_KEY` a `.env` si se quiere activar |
| Frontend retries | El cliente tiene `getGenerationResult()` disponible — puede usarse en el hook de generación para retry inteligente ante timeouts |

---

## Notas para Próxima IA

- No auditar rate limiting distribuido — ya implementado en `server/middleware/rate-limit.ts` (PostgreSQL)
- No auditar el motor LLM — funciona con OpenAI y DeepSeek hoy mismo
- El KV usa PostgreSQL nativo (tabla `kv_store`), no Redis
- Gemini falla por **billing**, no por código
- El endpoint `GET /api/ai-studio/generation/:id` es nuevo y no está documentado en el OpenAPI si existe uno — agregar si es necesario
