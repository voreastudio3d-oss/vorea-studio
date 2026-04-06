---
id: codebase-architecture-boundaries
kind: workflow
title: Reglas de arquitectura y boundaries del codebase
description: Reglas obligatorias de estructura, imports, dependencias y convenciones de código que toda IA/agente/LLM debe respetar al modificar el proyecto Vorea.
when_to_use:
  - SIEMPRE que se modifique cualquier archivo en src/, server/, scripts/ o package.json
  - SIEMPRE que se conecte un nuevo agente o LLM al proyecto
inputs:
  - package.json
  - tsconfig.json
  - vite.config.ts
  - server/server.ts
outputs:
  - Código que compila y respeta las boundaries sin errores de import
validations:
  - npm run dev:all (ambos servidores levantan)
  - npx prisma generate (si se tocó schema)
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - base-required
  - architecture
  - governance
  - llm-safety
applies_to:
  - src/**
  - server/**
  - scripts/**
  - package.json
llm_support:
  - codex
  - openai
  - claude
  - gemini
  - paperclip
related:
  - workflow:change-validation-master
  - workflow:multi-llm-specialization-routing
  - workflow:agent-handoff-evidence
  - workflow:prisma-migration-pipeline
---

# Reglas de Arquitectura y Boundaries del Codebase

> **REGLA BLOQUEANTE** — Toda IA, agente o LLM que trabaje en este proyecto DEBE leer y cumplir este documento antes de hacer cualquier cambio. Violar estas reglas rompe el dev server y/o la producción.

---

## 1. Estructura de Directorios — Boundaries Estrictas

```
Vorea-Paramentrics-3D/
├── server/          ← Backend (Node.js + Hono + tsx)
│   ├── *.ts         ← Compilado con tsx, NO con Vite
│   └── __tests__/   ← Tests del backend
├── src/             ← Frontend (React + Vite)
│   ├── app/         ← Componentes, páginas, servicios React
│   └── main.tsx     ← Entry point Vite
├── shared/          ← Código compartido (si existe)
├── scripts/         ← Scripts de build/deploy/seed
├── prisma/          ← Schema y migraciones
└── .agents/         ← Documentación, workflows, cerebro IA
```

### ❌ PROHIBIDO: Imports cross-boundary

| Desde | Hacia | Permitido |
|-------|-------|-----------|
| `server/*.ts` | `server/*.ts` | ✅ Sí |
| `server/*.ts` | `src/app/**` | ❌ **NUNCA** |
| `src/app/**` | `src/app/**` | ✅ Sí |
| `src/app/**` | `server/**` | ⚠️ Solo via re-export proxy |
| `scripts/**` | `server/**` | ✅ Sí (misma runtime) |
| `scripts/**` | `src/app/**` | ❌ **NUNCA** |

**Razón:** El servidor corre con `tsx` (Node.js directo). El frontend corre con Vite (ESM + HMR). Importar de `src/app/` desde `server/` rompe la resolución de módulos del servidor.

**Si necesitas código compartido:** Ponlo en `server/` y crea un re-export proxy en `src/app/`.

### ❌ PROHIBIDO: Extensiones `.ts` en imports del servidor

```typescript
// ❌ MAL — rompe tsx/Node.js
import { foo } from "./bar.ts";
import { baz } from "../src/app/thing.ts";

// ✅ BIEN — extensión .js para ESM
import { foo } from "./bar.js";
import { baz } from "./thing.js";
```

---

## 2. Dependencias — package.json

### Reglas absolutas

| Regla | Explicación |
|-------|-------------|
| `react` y `react-dom` van en `dependencies` | NUNCA en `peerDependencies`, NUNCA en `devDependencies` |
| `tsx` va en `devDependencies` | Es el runtime del servidor en desarrollo |
| `prisma` va en `devDependencies` | `@prisma/client` va en `dependencies` |
| No mover paquetes entre secciones sin razón documentada | El install puede romperse silenciosamente |
| No borrar `package-lock.json` sin reinstalar todo | Usar `npm install --legacy-peer-deps` si hay conflictos de engines |

### Después de modificar `package.json`

```bash
npm install --legacy-peer-deps   # Reinstalar
npx prisma generate              # Si se tocó prisma o se limpió node_modules
npm run dev:all                  # Verificar que levanta
```

### ❌ PROHIBIDO

- Cambiar la sección `peerDependencies` sin aprobación explícita del dueño
- Usar `npm install` sin `--legacy-peer-deps` (hay engine mismatch conocido)
- Borrar dependencias sin verificar que ningún archivo las importa

---

## 3. Rutas de Autenticación — Zona Protegida

> **ZONA ROJA — NO TOCAR SIN REVISIÓN HUMANA**

Los siguientes bloques de `server/app.ts` son **infraestructura crítica**. NO se pueden eliminar, mover o refactorizar sin aprobación explícita:

| Bloque | Descripción |
|--------|-------------|
| `GOOGLE OAUTH ROUTES` | Login/registro con Google (rate limit, audience check, JWT) |
| `AUTH ROUTES` | Login/registro por email, verificación, reset password |
| `CREDITS ROUTES` | Sistema de créditos y monetización |
| `requireAuth` middleware | Validación de sesión JWT |
| `requireSuperAdmin` middleware | Gate de acceso admin |
| `enforceRateLimit` | Protección contra abuso |

**Si un LLM elimina estas rutas, el producto pierde funcionalidad core.**

---

## 4. Servidor — Convenciones

### Runtime

| Componente | Runtime | Config |
|-----------|---------|--------|
| Backend API | `tsx` via Node.js | `--env-file=.env --watch` |
| Frontend | `vite` | `vite.config.ts` |
| Tests | `vitest` | `vitest.config.ts` |
| Prisma | `@prisma/client` generado | `prisma/schema.prisma` |

### Puertos

| Servicio | Puerto | Conflicto conocido |
|----------|--------|-------------------|
| API Backend | `3001` | — |
| Vite Frontend | `5173` | — |
| Paperclip (si activo) | `3100` | Sin conflicto |

### DNS
- `dns.setDefaultResultOrder("ipv4first")` es OBLIGATORIO en `server/server.ts` (fix para redes con IPv6 roto)

---

## 5. Archivos que NO se deben eliminar

| Archivo | Razón |
|---------|-------|
| `server/app.ts` | Contiene TODAS las rutas de la API |
| `server/server.ts` | Entry point del servidor |
| `server/auth.ts` | Motor de autenticación |
| `server/seo.ts` | SEO server-side |
| `src/main.tsx` | Entry point de React |
| `prisma/schema.prisma` | Schema de la base de datos |
| `.env` | Variables de entorno (no commitear) |

---

## 6. Checklist Pre-Commit para toda IA

Antes de hacer commit, toda IA/agente DEBE verificar:

- [ ] ¿Los imports del server solo referencian archivos en `server/`?
- [ ] ¿Los imports usan extensión `.js` (no `.ts`) en el server?
- [ ] ¿`react` y `react-dom` siguen en `dependencies`?
- [ ] ¿Las rutas de auth en `server/app.ts` siguen intactas?
- [ ] ¿`npm run dev:all` levanta sin errores?
- [ ] ¿El endpoint `/api/health` responde `ok`?
- [ ] ¿El endpoint `/api/auth/google/config` responde?
- [ ] Si se modificó `prisma/schema.prisma` → ¿se ejecutó `npm run db:migrate` y se commiteó `prisma/migrations/`? (ver `/prisma_migration_pipeline_rule`)

---

## 7. Procedimiento de Recovery

Si el dev server no levanta después de cambios de un agente:

```bash
# 1. Verificar que react existe
node -e "require('react')"

# 2. Verificar Prisma Client
node -e "require('@prisma/client')"

# 3. Si falla → reinstalar
npm install --legacy-peer-deps
npx prisma generate

# 4. Si sigue fallando → revisar imports
# Buscar imports cross-boundary:
grep -r "from ['\"]\.\.\/src" server/
# NO debería devolver resultados

# 5. Si hay imports cross-boundary → mover el archivo a server/
```
