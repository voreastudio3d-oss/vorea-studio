# Handoff & Lessons Learned - 2026-04-02 (Fase 1: Hardening IA)

## Resumen de Tareas Completadas 🚀

Hemos completado la primera gran fase de abril enfocada en endurecer el ecosistema de IA y establecer telemetría de costos y almacenamiento. 

1. **Self-Healing SCAD:** 
   Se incorporó en `server/ai-studio-pipeline.ts` el validador `validateScadGeometry` para captar asimetrías de llaves/paréntesis y atrapar variables nulas (`NaN`). En caso de fallo de sintaxis, la tubería redirige el código fallido como contexto devuelta al LLM pidiendo explicaciones y correcciones automáticas.
2. **Telemetría de Almacenamiento (Regional Storage Cost):** 
   Añadida la entidad `RegionalStorageDailyAggregate` en la base de datos para monitoreo cruzado (Bytes de Imagen / Bytes de SCAD) por región en tiempo real. Ahora visible desde la pestaña `RegionalStatsTab` en el dashboard de SuperAdmin.
3. **Optimización Inteligente del LLM (JSON Schema vs JSON Object):**
   Descubrimos un bloqueo con OpenAI GPT-4o ("HTTP 400") introducido por la estrictez absoluta de "Structured Outputs" cuando pasábamos contenedores libres (como `value: {}` en variables paramétricas).

## 🧠 Lecciones Aprendidas (Para "El Cerebro")

1. **Cuidado con el JSON Schema Estricto (`strict: true`) en GPT-4o**:
   - **El Problema:** La bandera de "Structured Outputs" es **incapaz** de lidiar con un objeto paramétrico o una inferencia multicapa sin tipo (`any` / `value: {}`). Lanza 400 Bad Request siempre porque el validador exije garantías estructuradas de tipos definidos. 
   - **La Solución (Implementada):** Volver a la directiva base de `response_format: { type: "json_object" }` y forzar al modelo a cumplir el esquema *mediante su System Prompt*. GPT-4o no nos fallará en la entrega de estructura de ese modo y nos ahorramos horas de debug en JSON Schema Validator.
2. **"fetch failed" y el Pool DNS Node.js**:
   - En el entorno de Dev Local/Windows, las peticiones masivas secuenciales hacia endpoints de IA pueden tirar error 0ms por timeouts de stack `fetch` / proxies o resolución de DNS. Esto causa que Gemini/Kimi arrojen `fetch failed` sin código HTTP. 
   - DeepSeek probó no tener bloqueos, ergo la red funciona. Esta irregularidad se neutraliza en ambientes desplegados como Vercel y Cloud donde la gestión de conexiones y resolución de nombres es más controlable y resiliente.
3. **Métricas Híbridas Prisma + KV**:
   - Mantener KV paramétrico para consultas ultra rápidas, pero consolidar asíncronamente en Prisma `RegionalStorageDailyAggregate`. Logramos separar contadores diarios ultra veloces de la persistencia ACID por continente.

## Próximos pasos para la Fase 2
- Migrar a refinamiento de Roles del SuperAdmin (Auth).
- Extender el Dashboard para manipular los presupuestos (`ai_budget`).
