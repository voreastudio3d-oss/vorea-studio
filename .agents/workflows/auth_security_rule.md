---
id: auth-security
kind: workflow
title: Seguridad de autenticación y datos
description: Reglas de seguridad obligatorias para autenticación, sesiones y datos de usuario
when_to_use:
  - Cuando cambien auth, sesiones, roles o flujos con datos sensibles.
inputs:
  - server/**
  - src/app/components/AuthDialog.tsx
  - src/app/services/auth-context.tsx
outputs:
  - Endurecimiento de auth y protección de datos de usuario.
validations:
  - npm run test
  - Revisar protección de secretos, expiración de tokens y validación server-side.
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - security
  - auth
  - backend
applies_to:
  - server/**/auth*
  - server/**/session*
  - server/**/*token*
  - src/app/components/AuthDialog.tsx
  - src/app/services/auth-context.tsx
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:endpoint-security-validation
  - rule:change-quality-gate
---

## Regla de Desarrollo — Seguridad en Autenticación y Datos

### Alcance
Aplica a toda modificación de `server/auth.ts`, rutas protegidas del backend, flujos de login/registro del frontend (`AuthDialog.tsx`), y cualquier código que maneje credenciales, tokens o datos sensibles de usuario.

### Requisitos Obligatorios

1. **Nunca hardcodear secretos:**
   `JWT_SECRET`, `DATABASE_URL`, claves de APIs externas (Stripe, Google, Supabase, etc.) deben estar **siempre** en variables de entorno (`.env`). El agente no debe escribir secretos en código fuente bajo ninguna circunstancia.

2. **bcrypt para passwords:**
   Toda contraseña debe hashearse con bcrypt (mínimo 12 rounds). Queda prohibido almacenar passwords en texto plano o con hashes débiles (MD5, SHA1, SHA256 sin salt).

3. **JWT con expiración:**
   Los tokens JWT deben emitirse **siempre** con `expiresIn` (actualmente: 7 días). Nunca emitir tokens sin expiración.

4. **Validación de inputs en servidor:**
   Toda ruta del servidor que reciba datos del usuario debe:
   - Sanitizar la entrada antes de procesarla.
   - Usar **whitelists** de campos permitidos (patrón existente en `updateUser`).
   - Rechazar campos no reconocidos silenciosamente.

5. **Protección por roles (doble capa):**
   - **Frontend:** Usar `TierGate` para ocultar UI que el usuario no debería ver.
   - **Backend:** Validar JWT + rol **en cada ruta protegida**. El frontend NUNCA es la única barrera de acceso.
   - Jerarquía: `user < admin < superadmin`.

6. **No exponer datos sensibles en respuestas:**
   Usar siempre `toPublicProfile()` o equivalente al enviar datos de usuario al frontend. Nunca incluir `password_hash`, `google_id`, o tokens internos en respuestas de la API.

### Checklist para el Agente de IA
- [ ] ¿Se verificó que no hay secretos hardcodeados?
- [ ] ¿Las passwords usan bcrypt con 12+ rounds?
- [ ] ¿Los JWT tienen expiración definida?
- [ ] ¿Los inputs del servidor están sanitizados con whitelist?
- [ ] ¿Las rutas protegidas validan JWT + rol en el backend?
