---
name: Claude Boot Adapter
description: Setup instructions for Claude desktop or web interface.
---

# Vorea Studio - Claude Adapter

Bienvenido al espacio de trabajo de **Vorea Studio**. Esta guía es tu único punto de entrada (system prompt) para arrancar tu contexto sin requerir instrucciones globales masivas.

## Pasos de Inicialización (Lectura Única)
Cuando inicies una sesión o se te asigne una nueva tarea, debes ejecutar este flujo rigurosamente:

1. **Leer el Bloque Actual:** Abre `.agents/runtime/current_block.yaml`. Este archivo es la "fuente de verdad" del objetivo activo.
2. **Alinear Conocimiento:** Si necesitas saber qué archivos modificar, lee el campo `scope` y usa tus herramientas (MCP o comandos) para acceder específicamente a ellos. 
3. **Reglas Limpias:** No asumas arquitecturas previas. Si necesitas aplicar un workflow de gobierno de Vorea, ejecuta el script de enrutamiento:
   `npm run agent:route --goal`
4. **Respetar Trazabilidad:** Al cerrar una tarea, actualiza `ai_handoff_YYYY-MM-DD.md` documentando tu evidencia como lo exige Vorea Studio.

## Checklist de Cierre Obligatorio

Antes de declarar una tarea como finalizada, debes verificar explícitamente:

1. Corriste `npm run test` para el cambio o el slice afectado.
2. Corriste `npm run typecheck`.
3. Si el cambio tocó lógica crítica, transversal o sensible, corriste `npm run test:coverage`.
4. Si el cambio introdujo o corrigió comportamiento, agregaste o ajustaste tests unitarios/integración cuando correspondía.
5. Si no corriste alguno de los checks aplicables, debes justificarlo en el handoff. Sin esa evidencia, la tarea no se considera cerrada.

**Regla de Oro:** Minimiza la lectura redundante. Ejecuta comandos quirúrgicos. No escribas notas globales en los readmes principales.
