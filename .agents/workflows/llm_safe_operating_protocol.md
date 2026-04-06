---
id: llm-safe-operating-protocol
kind: workflow
title: Protocolo de operación segura multi-LLM
description: Reglas operativas para que GPT, Claude, Gemini, Codex, Paperclip y cualquier otro agente trabajen sin romper el trabajo de los demás.
when_to_use:
  - SIEMPRE al conectar un nuevo agente o LLM al proyecto
  - SIEMPRE antes de ejecutar cambios automáticos o con bypass de aprobación
inputs:
  - .agents/workflows/codebase_architecture_boundaries_rule.md
  - .agents/🧠_Cerebro_Vorea.md
outputs:
  - Cambios compatibles entre LLMs sin regresiones
validations:
  - npm run dev:all
  - Checklist pre-commit de codebase_architecture_boundaries_rule.md
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - governance
  - llm-safety
  - multi-agent
applies_to:
  - "**/*"
llm_support:
  - codex
  - openai
  - claude
  - gemini
  - paperclip
related:
  - rule:codebase-architecture-boundaries
  - workflow:multi-llm-specialization-routing
  - workflow:agent-handoff-evidence
  - workflow:git-branching
---

# Protocolo de Operación Segura Multi-LLM

> **Este protocolo existe porque agentes trabajando sin contexto del proyecto ya causaron:**
> 1. Eliminación de rutas de autenticación (Google OAuth borrado)
> 2. Imports que cruzan boundaries arquitectónicas (server → frontend)
> 3. Dependencias movidas de sección en package.json (react a peerDeps)
> 4. Dev server roto sin diagnóstico claro

---

## Regla Zero — Leer antes de escribir

Todo LLM/agente que se conecte al proyecto DEBE leer estos archivos **ANTES** de modificar cualquier código:

1. `.agents/🧠_Cerebro_Vorea.md` — Contexto del proyecto
2. `.agents/workflows/codebase_architecture_boundaries_rule.md` — Boundaries técnicas
3. Este archivo — Protocolo operativo

**Si no leíste, no programes.**

---

## 1. Prohibiciones absolutas

| # | Prohibición | Razón |
|---|------------|-------|
| P1 | **No eliminar rutas de `server/app.ts`** sin aprobación del dueño | Se perdió Google Auth por esto |
| P2 | **No importar `src/app/**` desde `server/**`** | Rompe la compilación del servidor |
| P3 | **No mover paquetes entre secciones de `package.json`** | React desapareció del install |
| P4 | **No usar `dangerouslyBypassApprovalsAndSandbox: true`** en producción | Permite cambios destructivos sin revisión |
| P5 | **No trabajar directamente en `develop`** | Usar ramas: `codex/*`, `gpt/*`, `paperclip/*` |
| P6 | **No borrar `node_modules` sin reinstalar y regenerar Prisma** | El Prisma Client generado se pierde |
| P7 | **No usar extensión `.ts` en imports del servidor** | Usar `.js` para ESM compatibility |

---

## 1.1 Restricciones por LLM (zonas prohibidas)

> Estas restricciones se basan en incidentes reales y fortalezas verificadas. La matriz completa vive en `.agents/runtime/llm_assignment_matrix.yaml`.

| LLM | Zonas que NO debe tocar como líder | Razón |
|-----|-----------------------------------|-------|
| **Codex** | `server/app.ts` (auth routes), `server/auth.ts`, `server/paypal-subscriptions.ts`, `server/credit-ledger.ts`, `package.json` (deps), `prisma/schema.prisma` | Eliminó Google OAuth y movió React a peerDeps (2026-04-03) |
| **OpenAI/GPT** | `server/app.ts` (core routes), `server/middleware/**`, `prisma/migrations/**` | Mismo equipo que Codex; backend profundo y migraciones requieren Gemini o Claude |
| **Gemini** | Copy visible al usuario, pricing/marketing claims, i18n text content (como líder) | Fuerte en backend/infra pero el copy visible requiere sensibilidad de producto |
| **Claude** | Sin restricciones de zona | Mejor track record de seguridad en este proyecto |

---

## 2. Protocolo de rama por agente

Cada LLM/agente tiene su prefijo de rama:

| Agente | Prefijo | Ejemplo |
|--------|---------|---------|
| Codex / Gemini | `codex/` | `codex/feat/ai-studio-contract` |
| GPT / OpenAI | `gpt/` | `gpt/feat/marketing-loop` |
| Claude | `claude/` | `claude/fix/auth-security` |
| Paperclip | `paperclip/` | `paperclip/feat/seo-refactor` |

**NUNCA commitear directo a `develop` o `main`.** Siempre PR con review.

---

## 3. Checklist de handoff entre LLMs

Cuando un LLM termina su tarea y otro va a continuar:

```markdown
## Handoff de [LLM_origen] a [LLM_destino]
- Fecha: YYYY-MM-DD
- Rama: nombre-de-rama
- Estado: ¿compila? ¿tests pasan? ¿dev server levanta?

### Archivos modificados
- archivo1.ts — qué se cambió y por qué
- archivo2.tsx — qué se cambió y por qué

### Dependencias tocadas
- ¿Se agregó/quitó algo de package.json?
- ¿Se corrió `npm install`?
- ¿Se corrió `prisma generate`?

### Verificaciones realizadas
- [ ] `npm run dev:all` levanta
- [ ] `/api/health` responde ok
- [ ] `/api/auth/google/config` responde
- [ ] Login con Google funciona
- [ ] Frontend carga sin errores en consola

### Notas para el siguiente agente
- Qué queda pendiente
- Qué NO se debe tocar
- Qué decisiones de diseño se tomaron y por qué
```

---

## 4. Zonas de riesgo por tipo de cambio

| Zona | Archivos | Nivel de riesgo | Requiere |
|------|----------|-----------------|----------|
| **Auth** | `server/app.ts` (rutas auth), `server/auth.ts` | 🔴 CRÍTICO | Review humano |
| **Pagos** | `server/paypal-subscriptions.ts`, rutas credits | 🔴 CRÍTICO | Review humano |
| **Dependencies** | `package.json`, `package-lock.json` | 🔴 CRÍTICO | Verificación post-install |
| **SEO** | `server/seo.ts`, `server/public-route-meta.ts` | 🟡 MEDIO | Verificar boundaries |
| **AI Pipeline** | `server/ai-studio-*.ts` | 🟡 MEDIO | Verificar contrato |
| **Frontend UI** | `src/app/pages/*.tsx`, `src/app/components/**` | 🟢 BAJO | Tests visuais |
| **Docs/Config** | `.agents/**`, `docs/**` | 🟢 BAJO | Revisar coherencia |

---

## 5. Convenciones de código universales

### TypeScript

```typescript
// ✅ BIEN — Import con extensión .js en server/
import { foo } from "./bar.js";

// ❌ MAL — Import con extensión .ts
import { foo } from "./bar.ts";

// ❌ MAL — Import cross-boundary
import { foo } from "../src/app/bar.ts";
```

### Hono (Backend)

```typescript
// ✅ BIEN — Estructura estándar de ruta
app.post("/api/endpoint", async (c) => {
  try {
    // ... lógica
    return c.json({ result });
  } catch (e: any) {
    console.log(`POST /api/endpoint error: ${e.message}`);
    return c.json({ error: `Mensaje: ${e.message}` }, 500);
  }
});
```

### React (Frontend)

```typescript
// ✅ BIEN — Import de componente
import { Component } from "./components/Component";

// ✅ BIEN — Import de servicio
import { apiClient } from "./services/api-client";
```

---

## 6. Verificación post-sesión obligatoria

Al terminar una sesión de trabajo, el LLM/agente DEBE ejecutar:

```bash
# 1. Dev server levanta
npm run dev:all

# 2. Health checks
curl http://localhost:3001/api/health        # → {"status":"ok"}
curl http://localhost:3001/api/auth/google/config  # → {"configured":true,...}
curl http://localhost:5173                    # → 200

# 3. Git status limpio
git status --short
git diff --stat
```

Si alguno falla, el LLM debe corregir antes de entregar.

---

## 7. Lecciones aprendidas — Registro de incidentes

### 2026-04-03 — Sesión GPT/Paperclip
- **Incidente 1:** GPT eliminó 135 líneas de Google OAuth de `server/app.ts`
  - Causa: No entendió que era código productivo crítico
  - Fix: Restauración manual del bloque completo
- **Incidente 2:** GPT creó import `server/seo.ts` → `../src/app/public-route-meta.ts`
  - Causa: No conocía la boundary server/frontend
  - Fix: Mover archivo a `server/` + re-export proxy
- **Incidente 3:** GPT movió `react`/`react-dom` a `peerDependencies` opcionales
  - Causa: No entendió que npm las saltea con `--legacy-peer-deps`
  - Fix: Moverlas de vuelta a `dependencies`
- **Incidente 4:** `tsx` no estaba en `devDependencies`
  - Causa: Dependencia implícita global no declarada
  - Fix: `npm install tsx --save-dev`
- **Impacto:** Dev server roto ~2 horas de debugging
