# AI Handoff — Sesión 2026-04-04 (Claude)
> Rama: `develop` · HEAD: `c506aa7`

---

## ✅ Qué se implementó en esta sesión

### BG-006 — Monetización Hardening (`claude/feat/monetization-hardening-v2`)

**Problema resuelto:** El endpoint `/api/ai-studio/generate` tenía pre-charge correcto y refund en fallo, pero carecía de idempotencia (doble cobro posible en retries) y persistencia del resultado antes del `200` (SCAD perdido si el cliente pierde la conexión).

**Archivos creados/modificados:**

| Archivo | Cambio |
|---|---|
| `server/credit-ledger.ts` *(nuevo)* | Helper unificado: `reserveCredits`, `releaseCredits`, `getUserCreditBalance`, `markGenerationInProgress`, `markGenerationCompleted`, `clearIdempotencyRecord` |
| `server/ai-studio-routes.ts` | Integra `generationId` (idempotencia), flujo `in-progress → completed` en KV, persistencia antes del `200`, usa `credit-ledger.ts` |
| `server/__tests__/app-ai-studio-generate.integration.test.ts` | 3 tests nuevos: replay idempotente, 409 in-progress, persistencia KV en éxito |

**Comportamiento nuevo del endpoint `/api/ai-studio/generate`:**

```
1. Si el cliente envía generationId y ya está "completed" → 200 cached (sin cobrar)
2. Si el cliente envía generationId y está "in-progress" → 409 GENERATION_IN_PROGRESS
3. Si no viene generationId → se genera server-side con crypto.randomUUID()
4. Se marca "in-progress" en KV antes del LLM
5. Créditos reservados via credit-ledger.reserveCredits()
6. LLM ejecuta
7. Resultado persistido en KV (status: completed) ANTES del return 200
8. En fallo: credit-ledger.releaseCredits() + clearIdempotencyRecord()
```

**Tests: 4/4 ✅** (incluye el test de refund que ya existía)

---

## 🔍 Hallazgos críticos — Tareas que parecían pendientes pero YA ESTÁN HECHAS

Estas tareas figuraban en backlog y roadmap como pendientes. **NO volver a implementarlas:**

### 1. Rate Limiting Distribuido — YA IMPLEMENTADO ✅

**Archivo:** `server/middleware/rate-limit.ts`

El rate limiter ya tiene backend distribuido vía PostgreSQL. Cuando `DATABASE_URL` está configurado (Railway), los contadores `rl:*` se persisten en la tabla `kv_store` compartida entre todos los nodos. El fallback a in-memory solo ocurre si la DB cae.

```typescript
// Extracto clave del archivo existente:
async function consumeDistributed(key, maxRequests, windowMs) {
  const kv = await getKvBackend(); // usa KV/PostgreSQL si DATABASE_URL existe
  if (!kv) return null;            // fallback a in-memory si no
  ...
  await kv.set(rlKey, entry);      // estado compartido entre nodos
}
```

**Cobertura actual:**
- `app.ts` — endpoints de auth, signup, reset password vía `rateLimiter()` middleware
- `ai-studio-routes.ts` — IP + user vía `enforceRateLimit()` (20/5min IP, 6/5min user)
- Tests: `server/__tests__/rate-limit-distributed.test.ts` ✅

**No hay deuda técnica en rate limiting.** La Fase 2 ya existe.

### 2. KV Store — PostgreSQL nativo, no Redis

`server/kv.ts` usa `pg` directamente contra `kv_store` (tabla `TEXT PRIMARY KEY, JSONB value`). No usa Redis, Upstash ni ningún servicio externo. El store es el mismo PostgreSQL de Railway.

---

## 📋 Backlog real actualizado (estado post-sesión)

### 🔴 Alta prioridad

| ID | Tarea | LLM líder | Estado |
|---|---|---|---|
| BG-301 | Motor LLM real integrado en AI Studio | Codex (impl) + Claude (contrato) | ⏳ Pendiente |
| — | Diseño contrato endpoint motor LLM | Claude | ⏳ Siguiente |

### 🟠 Media prioridad

| ID | Tarea | LLM líder | Estado |
|---|---|---|---|
| — | Social Login Apple/Facebook (diseño) | Claude → Codex | ⏳ Pendiente |
| — | Phone verification OTP (SMS/WhatsApp) | Claude → Codex | ⏳ Pendiente |
| — | Migración Prisma prod (tablas IA) | Gemini | ⏳ Verificar |
| BG-006 | Monetización hardening | Claude | ✅ **COMPLETADO** `c506aa7` |

### 🟡 Baja prioridad

| ID | Tarea | LLM líder | Estado |
|---|---|---|---|
| — | Auditoría copy i18n + docs limpieza | OpenAI/GPT | ⏳ Pendiente |
| BG-109/110 | Relief: tolerancia por color y QA | Gemini | ⏳ Pendiente |
| BG-203 | Refactor intérprete SCAD por módulos | Gemini | ⏳ Backlog |

### ❌ Canceladas / Ya existían

| Tarea | Razón |
|---|---|
| Rate Limiting Distribuido (Fase 2) | Ya implementado en `rate-limit.ts` con KV/PostgreSQL |

---

## 🏗️ Arquitectura de créditos (estado actual)

```
usuario → POST /api/ai-studio/generate
              │
              ├─ ¿generationId ya completed en KV? → 200 cached (sin LLM)
              ├─ ¿generationId in-progress en KV?  → 409
              │
              ├─ markGenerationInProgress(generationId) → KV rl:idempotency:ai-gen:{id}
              ├─ credit-ledger.reserveCredits(userId, cost) → kv user:{id}:tool_credits
              │
              ├─ executeNormalizedGeneration() → LLM real (o mock)
              │      ├─ OK: markGenerationCompleted() → KV → return 200
              │      └─ FAIL: releaseCredits() + clearIdempotencyRecord() → return 500
              │
              └─ recordGenerationTrace() → Prisma DB (AiGenerationTrace)
```

**Helper de créditos centralizado:** `server/credit-ledger.ts`
- Todos los endpoints futuros que consuman créditos deben usar `reserveCredits/releaseCredits`
- No duplicar la lógica de `applyToolCreditPrecharge` directamente en ningún handler

---

## 🔑 Contexto técnico clave para el próximo agente

### Para implementar BG-301 (Motor LLM real):
- El endpoint `/api/ai-studio/generate` ya llama a `executeNormalizedGeneration()` en `ai-studio-pipeline.ts`
- El pipeline retorna datos con `generation.result.scadCode` — pero actualmente es **mock**
- Lo que hay que conectar: `ai-studio-pipeline.ts` → llamada real al LLM (Gemini/OpenAI/DeepSeek)
- El router de proveedores ya existe en `ai-generation-engine.ts`
- Las API keys van en `.env`: `GOOGLE_AI_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`
- **No tocar** `ai-studio-routes.ts` para BG-301 — solo modificar `ai-studio-pipeline.ts`

### Para verificar Prisma en producción:
```bash
# Correr contra DB de Railway (con DATABASE_URL de Railway en .env):
npx prisma migrate status
```
Las tablas a verificar: `AiGenerationTrace`, `AiGenerationDailyAggregate`, `AiStudioFamily`, `AiStudioPreset`, `AiStudioRecipe`

---

## 📁 Archivos de gobernanza relacionados

- Handoff anterior: `docs/ai_handoff_2026-04-04.md`
- Backlog: `.agents/runtime/project_backlog.md`
- Roadmap delegación: `.agents/runtime/roadmap_delegacion_abril_2026.md`
- Cerebro: `.agents/🧠_Cerebro_Vorea.md`
- Status global: `.agents/runtime/global_readiness_status_2026-04-02.md`

---

*Generado por Claude Sonnet 4.6 — Sesión 2026-04-04T22:21 ART*
