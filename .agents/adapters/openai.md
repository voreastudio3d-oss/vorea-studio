---
name: OpenAI Boot Adapter
description: Setup instructions for OpenAI GPT / Codex agents.
---

# Vorea Studio - OpenAI Adapter

Bienvenido a **Vorea Studio**. Si eres GPT-4o/GPT-5 o Codex, este es tu punto de entrada.

## Inicialización de Contexto

1. **Leer el Bloque Actual:** `.agents/runtime/current_block.yaml`
2. **Leer la Matriz de Asignación:** `.agents/runtime/llm_assignment_matrix.yaml` — verifica tu asignación real antes de tocar código.
3. **Restricciones:** Revisa las restricciones de zona en `.agents/workflows/llm_safe_operating_protocol.md` sección 1.1.
4. **Handoff:** Al cerrar, documenta en `.agents/handoffs/ai_handoff_YYYY-MM-DD.md`.

## Checklist de Cierre Obligatorio

Antes de declarar una tarea como finalizada, debes verificar explícitamente:

1. Corriste `npm run test` para el cambio o el slice afectado.
2. Corriste `npm run typecheck`.
3. Si el cambio tocó lógica crítica, transversal o sensible, corriste `npm run test:coverage`.
4. Si el cambio introdujo o corrigió comportamiento, agregaste o ajustaste tests unitarios/integración cuando correspondía.
5. Si no corriste alguno de los checks aplicables, debes justificarlo en el handoff. Sin esa evidencia, la tarea no se considera cerrada.

## ⚠️ Zonas Prohibidas (Codex/GPT)

> **LEER ANTES DE ESCRIBIR CÓDIGO**

Los siguientes archivos están **prohibidos** para Codex y GPT como líder. Solo pueden tocarse con revisión explícita de Claude o Gemini:

- `server/app.ts` (rutas de auth y middleware core)
- `server/auth.ts`
- `server/paypal-subscriptions.ts`
- `server/credit-ledger.ts`
- `package.json` (sección dependencies)
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `server/middleware/**`

**Razón:** Incidentes reales del 2026-04-03 donde GPT eliminó Google OAuth, movió React a peerDeps y creó imports cross-boundary.

## Zonas Seguras

GPT/Codex son fuertes en:
- Componentes React (`src/app/components/**`, `src/app/pages/**`)
- Copy e i18n (`src/app/locales/**`)
- Scripts utilitarios (`scripts/**`)
- Documentación gobernada (`.agents/**`)
- Tests de UI (`src/app/services/__tests__/**`)
- Landings y marketing (`src/app/pages/Landing*.tsx`, `/for/*`)

## Regla de Oro

Si el archivo no está en tu zona segura, **no lo toques**. Pide handoff a Claude o Gemini.
