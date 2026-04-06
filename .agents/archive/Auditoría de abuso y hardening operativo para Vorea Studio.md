# Auditoría de abuso y hardening operativo para Vorea Studio

## Resumen
Se hará una pasada de seguridad enfocada primero en abuso de servicios, saturación, drenaje de créditos/LLM, bots y spam, con validación ofensiva controlada solo en local/dev. La auditoría partirá de hallazgos ya visibles en el código: el rate limiter real existe pero no está montado, varias rutas sensibles dependen de un stub que no limita nada, `AI Studio` no tiene throttling propio, `telemetry` y `uploads` pueden amplificar escritura/costo, el reset por PIN no tiene expiración real, y `JWT_SECRET` tiene fallback inseguro.

La entrega será un pack operativo:
- informe dedicado de auditoría en `.agents/runtime/security_abuse_audit_2026-04-01.md`
- runbook/checklist de mitigación en `.agents/workflows/service_abuse_hardening_runbook.md`
- actualización del índice en `.agents/🧠_Cerebro_Vorea.md`
- actualización del handoff del día para dejar trazabilidad de hallazgos, validaciones y siguiente paso

## Cambios y entregables
### 1. Threat model y evidencia
- Mapear superficie prioritaria: auth, `AI Studio`, vault/BYOK, uploads, telemetry, comunidad y endpoints internos.
- Modelar ataques por categoría: brute force, signup spam, password reset abuse, account farming, drenaje de créditos, agotamiento de budget IA, abuso de BYOK, storage amplification, telemetry flooding, spam comunitario, escalación por misconfiguración y relay de llamadas a terceros.
- Documentar para cada vector: prerrequisitos, payload/flujo del atacante, impacto, señal de detección, severidad y mitigación recomendada.

### 2. Validación ofensiva local controlada
- Ejecutar pruebas activas solo contra entorno local/dev para verificar:
  - fuerza bruta y password-reset flood en auth
  - saturación de `/api/ai-studio/generate`
  - abuso de `/api/vault/keys/:provider/test`
  - flood de `/api/telemetry/batch`
  - storage spam en `/api/uploads/thumbnail` y `/api/uploads/community-image`
- Limitar las pruebas a cargas acotadas, con stop conditions explícitas, sin tocar producción ni credenciales externas más allá de lo ya permitido por el owner.
- Guardar evidencia reproducible de requests, respuestas, headers, tiempos y comportamiento observado.

### 3. Especificación de hardening
- Reemplazar el uso efectivo del stub inline por una política real de rate limiting y quotas por IP, usuario y ruta cara.
- Priorizar endurecimiento en `server/app.ts` y `server/ai-studio-routes.ts` para:
  - auth: signup, signin, request-reset, reset-password, social login y reset owner
  - IA cara: `generate`, quick-fix y test de claves de vault
  - superficie abierta: telemetry batch, uploads y rutas de interacción de comunidad con riesgo de spam
- Definir mitigaciones concretas y no ambiguas:
  - límites por ruta y actor
  - TTL real para reset PIN
  - eliminación de secretos inseguros por fallback
  - controles de tamaño/frecuencia/volumen acumulado
  - deduplicación o idempotencia donde el costo pueda cobrarse o dispararse varias veces
  - alertas operativas para picos de uso, errores 429, gasto IA y abuso repetido
- Incluir backlog priorizado P0/P1/P2 con orden exacto de implementación y criterio de cierre.

## Cambios de interfaz y contrato
- Las rutas endurecidas deberán responder de forma consistente con `429` y `Retry-After` cuando aplique.
- Los endpoints de auth y rutas caras deberán exponer semántica uniforme de error de abuso/rate limit y no filtrar información útil para enumeración.
- El flujo de reset deberá pasar a PIN con expiración efectiva y sin exposición de `pinDev` fuera de condiciones estrictamente locales.
- La configuración de seguridad deberá tratar `JWT_SECRET` inseguro o ausente como hallazgo crítico y como requisito de fail-closed para producción.
- Si se cambian contratos HTTP, el plan incluye regenerar y validar documentación API antes de cerrar.

## Plan de pruebas
- Revisión estática de rutas y guards para confirmar auth, rol, inputs, costos y writes amplificables.
- Pruebas locales de carga ligera y abuso controlado con evidencia por vector.
- Validación de que los límites bloquean sin romper casos normales de usuario legítimo.
- Validación de observabilidad mínima: headers, logs, contadores y señales de alerta.
- Validaciones base al cerrar cualquier hardening: `npm run test`, `npm run typecheck`, `npm run docs:api:generate` y `npm run docs:api:check` si cambia contrato HTTP.

## Suposiciones y defaults
- El trabajo y las pruebas activas se harán solo en local/dev; producción queda fuera de alcance ofensivo.
- El foco principal es abuso-resiliencia, pero cualquier hallazgo crítico lateral se documentará igual en el informe.
- La documentación final se redactará en español y el Cerebro seguirá siendo índice; el detalle vivirá en el informe y el runbook enlazados.
- Se reutilizarán como marco normativo los workflows existentes de auth y endpoint security, y este trabajo añadirá un runbook operativo específico de abuso/saturación.
