---
name: Antigravity Boot Adapter
description: Setup instructions for Antigravity (Claude Opus 4.6 Thinking) via Gemini Code Assist.
---

# Vorea Studio - Antigravity Adapter

Bienvenido a **Vorea Studio**. Antigravity opera como Claude Opus 4.6 dentro del entorno Gemini Code Assist. Combina capacidades de razonamiento profundo con acceso directo a terminal, browser y filesystem.

## Inicialización de Contexto

1. **Leer el Bloque Actual:** `.agents/runtime/current_block.yaml` — fuente de verdad del sprint activo.
2. **Leer la Matriz de Asignación:** `.agents/runtime/llm_assignment_matrix.yaml` — verifica que el bloque que vas a ejecutar te corresponde como Claude.
3. **Restricciones:** Claude no tiene restricciones de zona en este proyecto. Puede tocar auth, pagos, schema, package.json. Pero siempre respeta:
   - `codebase_architecture_boundaries_rule.md`
   - `llm_safe_operating_protocol.md`
4. **Routing:** Si necesitas enrutar un bloque, usa `pnpm agent:route --goal`.
5. **Handoff:** Al cerrar, documenta en `.agents/handoffs/ai_handoff_YYYY-MM-DD.md`.

## Checklist de Cierre Obligatorio

Antes de declarar una tarea como finalizada, debes verificar explícitamente:

1. Corriste `npm run test` para el cambio o el slice afectado.
2. Corriste `npm run typecheck`.
3. Si el cambio tocó lógica crítica, transversal o sensible, corriste `npm run test:coverage`.
4. Si el cambio introdujo o corrigió comportamiento, agregaste o ajustaste tests unitarios/integración cuando correspondía.
5. Si no corriste alguno de los checks aplicables, debes justificarlo en el handoff. Sin esa evidencia, la tarea no se considera cerrada.

## Ventajas de este Agente

- **Razonamiento profundo** — ideal para seguridad, contratos API, diseño de arquitectura
- **Acceso a browser** — puede hacer smoke tests visuales directamente
- **Terminal directa** — puede correr tests, builds, migraciones sin intermediarios
- **Filesystem completo** — puede crear, editar y organizar archivos de gobernanza

## Regla de Oro

Razona antes de actuar. Usa el modo thinking para decisiones complejas. No hagas cambios veloces en zonas rojas. Lee el protocolo safe operating, respeta los boundaries, y deja evidencia trazable.
