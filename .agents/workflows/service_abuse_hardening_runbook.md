---
id: service-abuse-hardening
kind: workflow
title: Hardening de abuso de servicios
description: Checklist operativo para endurecer endpoints contra saturación, spam, drenaje de costo y abuso automatizado
when_to_use:
  - Cuando se agreguen endpoints con costo, fan-out externo, escritura intensiva o riesgo de abuso.
  - Cuando una ruta acepte tráfico público o autenticado fácil de automatizar.
inputs:
  - server/**
  - Dockerfile
outputs:
  - Endpoints endurecidos contra abuso y evidencias mínimas de validación.
validations:
  - npm run typecheck
  - npm run test
  - npm run docs:api:generate
  - npm run docs:api:check
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
  - .agents/runtime/security_abuse_audit_YYYY-MM-DD.md
llm_support:
  - claude
  - gemini
  - openai
  - generic
tags:
  - security
  - abuse
  - backend
  - operations
applies_to:
  - server/**
  - Dockerfile
related:
  - workflow:auth-security
  - workflow:endpoint-security-validation
  - rule:change-quality-gate
---

# Runbook — Hardening de abuso de servicios

## Paso 1 — Clasificar la ruta
Antes de tocar código, etiquetar la ruta según estas preguntas:
- ¿Es pública o autenticada?
- ¿Tiene costo directo o indirecto?
- ¿Escribe mucho en KV/DB?
- ¿Hace fan-out a terceros?
- ¿Genera artefactos o almacenamiento?
- ¿Expone señales útiles para bots, scrapers o brute force?

Si una respuesta es “sí”, la ruta necesita hardening explícito.

## Paso 2 — Definir límites por actor
Aplicar límites en la capa server-side, nunca solo en frontend.

Usar estas guías por defecto:
- Pública sensible: límite por IP
- Autenticada barata: límite por IP y por usuario
- Autenticada cara: límite por IP, por usuario y por ruta
- Acciones de recuperación o login: límite agresivo con mensajes no enumerables
- Rutas con proveedores externos: límite por usuario y por IP antes del fetch saliente

Cada límite debe devolver `429` y `Retry-After`.

## Paso 3 — Acotar payload y volumen
Para requests con arrays, blobs, base64 o prompts:
- fijar tamaño máximo de body o longitud útil
- fijar cantidad máxima de items por batch
- rechazar estructuras no planas o tipos inesperados
- cortar antes del trabajo caro

## Paso 4 — Desafíos temporales y secretos
Para PINs, tokens de recuperación o verificaciones:
- guardar siempre expiración explícita
- invalidar al usar
- no filtrar detalle sensible en respuestas
- producción debe fallar de forma segura si falta un secreto crítico

## Paso 5 — Costo y egress
Si la ruta consume créditos, IA o llamadas externas:
- aplicar rate limit antes de invocar el servicio caro
- validar saldo/budget antes del trabajo
- dejar refund o rollback si el trabajo falla después del pre-charge
- registrar señales de gasto y anomalías

## Paso 6 — Observabilidad mínima
Toda ruta endurecida debe dejar:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` en bloqueo

Además, registrar al menos una señal operacional útil:
- número de bloqueos
- actor/IP
- ruta o acción
- costo o impacto si aplica

## Paso 7 — Validación ofensiva controlada
En local/dev:
- repetir requests hasta confirmar que salta el `429`
- probar payload grande o batch excesivo
- confirmar que el límite corta antes del trabajo caro
- si hay desafío temporal, verificar que se guarda con expiración real

No ejecutar pruebas ofensivas en producción.

## Paso 8 — Evidencia obligatoria
Al cerrar el bloque, documentar:
- endpoints endurecidos
- límites elegidos y por qué
- pruebas ejecutadas y resultado
- riesgos residuales
- siguiente paso recomendado

## Defaults recomendados
- Auth: 3 a 10 requests por IP en ventanas de 5 a 15 minutos
- IA cara: 5 a 10 por usuario en 5 minutos, más un techo por IP
- Telemetry batch: máximo 100 eventos por request
- Uploads: límite por IP y por usuario, además de tamaño por archivo
- Proveedores externos: límite horario por usuario e IP
