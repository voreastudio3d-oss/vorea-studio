# Fundación de perfil global y política regional — 2026-04-02

## Objetivo

Crear la primera base canónica para identidad global del usuario sin mezclar todavía vault de tarjetas, checkout regional ni verificación OTP. El foco de este bloque fue unificar:

- `auth_users`
- KV profile
- tipos frontend
- persistencia real desde `/profile`

## Qué se implementó

### Backend
- Nuevo módulo: `server/profile-region-policy.ts`
- Normalización centralizada de:
  - `countryCode`
  - `defaultLocale`
  - `phone`
  - `billingProfile`
- Resolución de `regionCode` a partir del país.
- Política regional mínima aditiva (`regionPolicy`) con:
  - auth providers recomendados
  - payment providers recomendados
  - necesidad de step-up auth
  - recomendación de verificación telefónica
  - recomendación de dirección fiscal

### Storage
- `auth_users` ahora soporta:
  - `phone`
  - `country_code`
  - `region_code`
  - `default_locale`
  - `billing_profile`
  - `email_verified_at`
  - `phone_verified_at`
- El backend rehidrata un `profile` canónico desde DB + KV en `GET /api/auth/me`.

### API
- `GET /api/auth/me`
  - sigue devolviendo `profile`
  - ahora agrega `regionPolicy`
- `PUT /api/auth/me`
  - ya permite persistir:
    - `phone`
    - `countryCode`
    - `defaultLocale`
    - `billingProfile`
  - sigue bloqueando auto-escalación de `tier`, `role`, etc.

### Frontend
- `Profile.tsx` dejó de guardar solo `displayName` / `username` en localStorage.
- El guardado ahora usa backend real (`AuthApi.updateProfile(...)`) y refresca el contexto autenticado.
- Se añadió un bloque visible de “perfil global” con:
  - contacto y región
  - idioma por defecto
  - estado básico de verificación
  - facturación básica

## Qué todavía no cubre

- verificación real de email
- verificación real de teléfono por SMS/WhatsApp
- OTP/biometría en checkout
- vault de tarjetas o tokenización
- matrices regionales activas en checkout

## Pruebas

- `npm run typecheck`
- `npx vitest run server/__tests__/profile-region-policy.test.ts server/__tests__/app-auth-profile.integration.test.ts src/app/pages/__tests__/profile-page.test.tsx`

## Siguiente paso recomendado

1. Conectar `email_verified_at` y `phone_verified_at` a flujos reales de verificación.
2. Definir matriz ejecutable `region -> auth -> payments -> verification`.
3. Llevar esta política al checkout para step-up auth/OTP en momentos críticos.
