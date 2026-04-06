---
name: Gemini Boot Adapter
description: Setup instructions for Gemini / Antigravity Agent.
---

# Vorea Studio - Gemini Adapter

Bienvenido a **Vorea Studio**. Has entrado a un entorno con gobernanza consolidada. No necesitas que se te inyecten reglas globales extensas en cada prompt; tu rol es acatar el "bloque activo" operando limpio y enfocado.

## Inicialización de Contexto

1. **Determina tu Misión:** Para entender en qué estamos trabajando, lee el archivo `.agents/runtime/current_block.yaml`. Allí verás el `goal` y el `scope` del sprint.
2. **Usa tu Routing Operativo:** Evita explorar a ciegas. Si el YAML pide aplicar un cambio, ejecuta comandos para enrutamiento inteligente (como `npm run agent:route`).
3. **Maneja Workflows de Manera Segura:** Tienes acceso directo a la consola (PowerShell). Usa `grep_search` para ser quirúrgico. 
4. **Handoff:** Antes de ceder el control o cerrar tu participación del día, tu responsabilidad ineludible es dejar constancia en `ai_handoff_YYYY-MM-DD.md` o en los artefactos `walkthrough.md`.

**Aviso Especial:** Este proyecto utiliza herramientas MCP y comandos terminales para auditar calidad local (`npm run agent:governance:check`, preflight, typechecks, etc.). Usa las validaciones antes de comprometer cualquier cambio a git.
