---
id: global-identity-payments
kind: workflow
title: Identidad regional, pagos y verificación reforzada
description: Workflow para planificar o implementar login social, credenciales, verificación y pagos multi-región sin comprometer seguridad ni conversión.
when_to_use:
  - Cuando el bloque trate social login, OTP, biometría, wallets, billing, tarjetas, vaults o expansión de medios de pago por región.
inputs:
  - server/**/auth*
  - server/**/*payment*
  - server/**/*paypal*
  - src/app/components/AuthDialog.tsx
  - src/app/pages/Profile.tsx
  - src/app/pages/Membership.tsx
outputs:
  - Estrategia trazable de identidad y pagos por región con límites claros sobre qué se guarda localmente y qué se delega a terceros.
validations:
  - Revisar separación user/account/provider, protección de credenciales y estado real de los procesadores activos.
  - Verificar que no se guarden PAN/CVC/expiración en crudo.
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - auth
  - identity
  - payments
  - global
applies_to:
  - server/**/auth*
  - server/**/*payment*
  - server/**/*paypal*
  - src/app/components/AuthDialog.tsx
  - src/app/pages/Profile.tsx
  - src/app/pages/Membership.tsx
llm_support:
  - codex
  - openai
  - claude
  - gemini
cross_llm_notes:
  claude:
    - Lider recomendado para modelado riguroso de identidad, auth multi-provider, webhooks, seguridad de pagos y compliance.
  gemini:
    - Muy fuerte para dependencias backend, tablas, migraciones y continuidad operativa del flujo auth/payment.
  openai:
    - Útil para evaluar fricción de conversión, UX de checkout y priorización de providers por mercado.
  codex:
    - Ideal para aterrizar los flujos en código real y tipos compartidos.
related:
  - workflow:auth-security
  - workflow:endpoint-security-validation
  - skill:global-identity-payments-strategy
---

# Workflow - Global Identity Payments

## Objetivo

Preparar a Vorea Studio para que autenticación, recuperación de cuenta y cobro no dependan de un único patrón local.

## Reglas base

### 1. Login social

- Google puede ser el primer provider, pero no debe asumirse como estrategia completa global.
- La arquitectura debe separar:
  - `User`
  - `Account` o relación por provider
  - credenciales locales/password hash
- Un usuario social debe poder añadir contraseña después sin perder el vínculo con su provider externo.

### 2. Verificación y recovery

- Email verification, password reset y OTP deben modelarse como flujos distintos.
- OTP/biometría en checkout solo se recomienda donde el riesgo o regulación lo justifique.
- No introducir OTP “porque sí” si reduce conversión sin un punto crítico claro.

### 3. Pagos

- No guardar datos sensibles de tarjeta en base propia.
- Todo dato de pago sensible debe residir en vault/tokenización de tercero.
- Webhooks deben validarse criptográficamente y ser idempotentes.

### 4. Regionalización

- La estrategia debe contemplar que distintas regiones preferirán distintos providers de identidad y pago.
- La activación por región debe quedar como matriz explícita, no como hardcode accidental.

## Criterio de cierre

Un bloque de identidad/pagos queda razonablemente resuelto solo si deja:

1. providers activos vs candidatos por región;
2. estrategia de recovery y password/social merge;
3. límites claros de qué datos residen en Vorea y cuáles en terceros;
4. backlog técnico de implementación por prioridad.

## Relacionados

- [[🧠_Cerebro_Vorea|🧠 Cerebro Colectivo Vorea]]
- [[roadmap_delegacion_abril_2026|Roadmap y Delegación Multi-LLM (Abril 2026)]]
- [[global_readiness_status_2026-04-02|Estado global actual por punto]]
- [[global-identity-payments-strategy|Skill de identidad y pagos por región]]
