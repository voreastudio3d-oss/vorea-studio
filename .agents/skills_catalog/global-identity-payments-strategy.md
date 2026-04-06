---
id: global-identity-payments-strategy
kind: skill
title: Estrategia global de identidad, pagos y verificación
description: Skill para planificar autenticación multi-provider, medios de pago regionales, OTP/biometría y datos de perfil/billing sin comprometer seguridad.
when_to_use:
  - Cuando el pedido trate social login adicional, pagos por región, billing, verificación de identidad, OTP o datos de perfil/facturación.
inputs:
  - server/**/auth*
  - server/**/*payment*
  - src/app/components/AuthDialog.tsx
  - src/app/pages/Profile.tsx
  - src/app/pages/Membership.tsx
outputs:
  - Estrategia clara de providers de identidad/pago por región y backlog técnico para implementarlos.
validations:
  - Verificar que los datos sensibles queden delegados a vault/tokenización de tercero cuando corresponda.
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - auth
  - identity
  - payments
  - otp
applies_to:
  - server/**/auth*
  - server/**/*payment*
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
    - Lider recomendado para decisiones de auth multi-provider, compliance, OTP y flujos de pago seguros.
  gemini:
    - Muy bueno para impacto backend, esquema de cuentas y rollout técnico.
  openai:
    - Útil para balance entre conversión, fricción y cobertura regional.
  codex:
    - Ideal para aterrizar los flujos en código real y tipos compartidos.
related:
  - workflow:global-identity-payments
  - workflow:auth-security
---

# Skill: global-identity-payments-strategy

## Objetivo

Definir cómo debe evolucionar Vorea Studio en login social, credenciales, recovery y cobros cuando el producto apunta a múltiples regiones.

## Úsalo para

- comparar Apple, Google, Facebook, LinkedIn, WeChat u otros por región;
- comparar PayPal, Stripe, Mercado Pago, Paddle u otros por región;
- definir si OTP o biometría agregan seguridad o fricción;
- diseñar perfil extendido, billing profile y límites del vault propio.

## Entregables esperados

1. Matriz por región de providers recomendados.
2. Estado actual vs faltantes.
3. Backlog técnico por prioridad.
4. Riesgos de seguridad/compliance.
