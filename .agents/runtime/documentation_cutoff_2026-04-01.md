# Corte documental — 2026-04-01

## Objetivo
Dejar explícito qué documentos siguen siendo canónicos, cuáles son históricos y cuáles son solo borradores locales para evitar decisiones basadas en notas desfasadas.

---

## Estado por documento

### 1. `.agents/runtime/llm_delegation_plan.md`
- **Estado:** histórico / parcialmente desfasado
- **Sirve para:** entender el cierre de la primera fase Multi-LLM
- **Ya no sirve como fuente principal para:**
  - rama activa
  - backlog actual
  - estado de adapters/proveedores
  - estado del admin panel
- **Fuentes canónicas que lo reemplazan:**
  - `.agents/runtime/ai_studio_prompt_routing_architecture_2026-04-01.md`
  - `.agents/runtime/ai_handoff_2026-04-01.md`
  - `.agents/runtime/current_block.yaml`

### 2. `Auditoría de abuso y hardening operativo para Vorea Studio.md`
- **Estado:** borrador local / duplicado no canónico
- **Observación:** es una propuesta/plan local que apunta a los entregables reales ya creados
- **Fuentes canónicas reales:**
  - `.agents/runtime/security_abuse_audit_2026-04-01.md`
  - `.agents/workflows/service_abuse_hardening_runbook.md`
- **Recomendación:** no usar este archivo raíz como referencia operativa; mantenerlo fuera del flujo principal o archivarlo localmente

### 3. `IA-Prompts.md`
- **Estado:** deprecado correctamente
- **Evaluación:** el archivo ya cumple bien su función, porque redirige a adaptadores nativos y a `current_block`
- **Acción:** mantenerlo como redirect; no reabrirlo como bloc de notas global

### 4. `llm_analysis.md`
- **Estado:** borrador local / análisis histórico parcial
- **Sigue siendo útil para:**
  - hipótesis inicial de ranking costo/calidad
  - discusión JSON vs SSE
- **Está desfasado en:**
  - rama mencionada
  - adapters marcados como “futuro”, hoy ya implementados
  - lectura del estado del admin y del router
- **Recomendación:** tratarlo como nota de análisis exploratorio, no como arquitectura vigente

### 5. `marketing_audit.md`
- **Estado:** parcialmente vigente
- **Hallazgos ya resueltos:**
  - packs renombrados a créditos
  - `monthlyCredits.FREE` unificado en `6`
  - `Profile.tsx` ya toma asignación mensual desde backend
- **Hallazgos todavía útiles:**
  - revisar wording comercial ambiguo en features de planes
  - validar promesas de marketing contra `DEFAULT_TOOL_CREDITS`
  - limpiar mensajes tipo “ilimitado” cuando el feature tiene consumo o límites colaterales
- **Recomendación:** mantenerlo, pero leerlo como auditoría viva con hallazgos resueltos y pendientes diferenciados

---

## Fuentes canónicas actuales para AI Studio
- `.agents/runtime/ai_studio_prompt_routing_architecture_2026-04-01.md`
- `.agents/runtime/ai_handoff_2026-04-01.md`
- `.agents/runtime/current_block.yaml`
- `.agents/runtime/security_abuse_audit_2026-04-01.md`
- `.agents/workflows/service_abuse_hardening_runbook.md`

## Fuentes canónicas actuales para pricing/planes
- `server/app.ts`
- `src/app/services/business-config.ts`
- `src/app/pages/Profile.tsx`

## Pendiente recomendado después de este corte
- revisar `src/app/locales/en.json` y el resto de copy visible fuera de AI Studio/Admin para cerrar una pasada completa de i18n/copy
- decidir si los borradores locales raíz (`llm_analysis.md`, `Auditoría de abuso...`) se archivan, se absorben o se eliminan del flujo diario
