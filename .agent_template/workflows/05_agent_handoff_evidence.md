# 🔖 WORKFLOW OBLIGATORIO: Evidencia e IA Handoff

---
description: Proceso estricto de cierre de sesión de un Agente IA para asegurar cero pérdida de contexto.
---

## 🕒 El problema
Los contextos de los LLMs (como Claude o Gemini) son perecederos. Cuando la sesión termina, todos los detalles intrincados de la operación que no estén en el código se pierden, forzando a la siguiente IA a "re-descubrir" hallazgos y errores.

## 📝 Reglas de Handoff

Toda IA debe terminar de manera formal su intervención creando un documento detallado antes de que termine su contexto:

1. El archivo se generará en la carpeta central: `.agents/handoffs/ai_handoff_YYYY-MM-DD.md`.
2. Si ya existe uno para la fecha, se generará uno con sufijo, ej: `ai_handoff_YYYY-MM-DD_auth_fix.md`.

## 📜 Estructura Indispensable del Handoff

El archivo Markdown CREADO debe incluir obligatoriamente:
- **Agente / Modelo Original:** (ej. Gemini Pro, Opus, etc).
- **Branch:** La rama actual de git donde se trabajaba.
- **Commit:** El hash o nombre del último commit si hubo, o estado de los archivos trackeados.
- **Qué se hizo:** Lista concisa de ficheros modificados y razón.
- **Hallazgos:** "Descubrí que la API de Auth tira 401 si no lleva prefijo Bearer" - ¡Cualquier cosa que ahorre 30 min de investigación a la próxima IA!
- **Siguiente paso:** Qué quedó colgando, o cuál es la recomendación operativa de primer paso para el próximo agente.

## 🔗 Referencia Cruzada Obligatoria
Ese handoff debe obligatoriamente mencionarse o referenciarse dentro del `🧠_Cerebro.md` (o `ai_shared_plan.md` según la gobernanza que haya inicializado este proyecto) como el último handoff activo en runtime.
