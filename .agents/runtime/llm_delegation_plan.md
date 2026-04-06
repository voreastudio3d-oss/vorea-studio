# Plan de Delegación entre IAs: Motor LLM para AI Studio

> [!IMPORTANT]
> **Estado 2026-04-01: histórico / parcialmente desfasado.**
> Este documento conserva el cierre de una fase anterior de integración Multi-LLM, pero ya no es la fuente canónica del estado actual.
>
> Referencias vigentes:
> - `.agents/runtime/ai_studio_prompt_routing_architecture_2026-04-01.md`
> - `.agents/runtime/ai_handoff_2026-04-01.md`
> - `.agents/runtime/current_block.yaml`
>
> Secciones desfasadas en este archivo:
> - rama `feature/ai-studio-llm-engine`
> - tareas futuras de adapters (`callOpenAI`, `callAnthropic`, `callDeepSeek`, `callKimi`), ya implementadas
> - roadmap de admin panel, hoy ya materializado en `AiStudioAdminTab.tsx`

**Estado:** `completed`
**Bloque Actual:** `ai-studio-llm-integration`
**Rama:** `feature/ai-studio-llm-engine`
**Commits:** 3 (`bb689e1`, `2cca2ab`, `740b93c`)

Este documento registra el estado final de la construcción del Motor IA Real.

---

## ✅ Fase 1: Arquitectura Backend (Completada por Gemini)
**Resultado:**
- `server/ai-generation-engine.ts` — Motor LLM completo (~430 líneas)
  - System prompt maestro para OpenSCAD
  - `generateScadWithLLM()` con parsing JSON robusto
  - Circuit breaker de budget (BG-006/BG-007)
  - Multi-LLM: 5 proveedores (Gemini, OpenAI, Claude, DeepSeek, Kimi)
  - `getActiveAIConfig()` — resolución dinámica desde KV admin:ai_config
  - Modelo default: `gemini-2.5-pro`
- `server/ai-studio-routes.ts` — `POST /api/ai-studio/generate`
  - Pipeline: Auth → Budget → Credits → LLM → Usage Record → Response
  - Auto-refund de créditos en caso de error LLM
- `src/app/services/api-client.ts` — `AiStudioGenerateApi.generate()` tipado
- `.env.example` — Claves multi-LLM opcionales

---

## ✅ Fase 2: Frontend Async y Estados de Carga (Completada por Gemini)
**Resultado:**
- `AIStudio.tsx` — `runGeneration()` ahora es async
  - Llamada primaria a `AiStudioGenerateApi.generate()` (backend LLM)
  - Fallback transparente a `runParametricPipeline()` si el LLM falla
  - Mensajes de carga progresivos animados (5 estados)
  - Muestra créditos consumidos en toast de éxito
  - Tracking analytics con `source: "llm" | "local"`

---

## ✅ Fase 3: Renderizado en Editor (Ya existía, verificada)
**Resultado:**
- `handleOpenInEditor()` → `model.setScadSource(scadCode, modelName)` → `/studio`
- El botón "Abrir en Studio" ya funciona con SCAD de cualquier fuente (LLM o local)
- No se requirieron cambios adicionales

---

## 🔮 Próximas Tareas (Post-integración)

### Para GPT-5.4 (Frontend & UI Engineer):
1. **Admin Panel: Selector de Proveedor IA**
   - UI para elegir provider + modelo desde el panel de administración
   - Toggle manual/automático
   - Visualización de alertas de consumo vs budget
   - Lectura de `getAIProviderConfig()` para mostrar providers disponibles

2. **AI Studio UX Polish**
   - Animación de skeleton loader durante generación
   - Vista previa del código SCAD con syntax highlighting
   - Indicador visual de "fuente: IA" vs "fuente: local" en el historial

### Para Gemini Pro (Backend/Motor 3D):
1. **Multi-Provider Adapters**
   - Implementar `callOpenAI()`, `callAnthropic()`, `callDeepSeek()`, `callKimi()`
   - Router automático por consumo de budget
   - Rate-limit fallback chain

2. **SCAD Quality Validation**
   - Validación semántica del SCAD generado (no solo sintáctica)
   - Detección de alucinaciones paramétricas
   - Auto-corrección vía segundo prompt

---

### 🚦 Regla de Oro en la Delegación:
- **GPT-5.4:** Se hace cargo de toda la plomería pesada (APIs, Webhooks, Bases de Datos, UI Components, Admin Panels). Piensa en ti como el Ingeniero Full-Stack y experto en interfaces.
- **Gemini:** Revisa las fisuras del plan, escribe y mejora el SCAD profundo, maneja la compilación matemática en las mallas 3D y aprueba validaciones visuales o de entorno de desarrollo nativo.
