# Email verification + checkout step-up (2026-04-02)

## Objetivo

Cerrar la primera implementación real de verificación de email y usarla como `step-up` previo al checkout cuando la política regional lo requiera.

## Qué se implementó

- Nuevos endpoints autenticados en `server/app.ts`:
  - `POST /api/auth/request-email-verification`
  - `POST /api/auth/verify-email`
- El código OTP:
  - tiene 6 dígitos;
  - vence a los 15 minutos;
  - se guarda temporalmente en KV en `email_verify:{userId}`;
  - respeta rate limits por IP y por usuario.
- Se agregó envío best-effort por Resend:
  - si `RESEND_API_KEY` no existe, el sistema no rompe el flujo;
  - en no producción expone `codeDev` para QA y pruebas locales.
- La verificación exitosa:
  - persiste `email_verified_at` en `auth_users`;
  - sincroniza `emailVerifiedAt` en `user:{id}:profile` si el perfil ya existe;
  - registra actividad `email_verified`.

## Checkout reforzado

- `server/paypal-subscriptions.ts` ahora consulta el usuario autenticado y su `regionPolicy`.
- Si `requiresStepUpOnPayment=true` y el usuario todavía no tiene `email_verified_at`, `POST /api/subscriptions/create` responde `403` con:
  - `verificationRequired: true`
  - `regionPolicy`
- Esto evita depender solo del frontend.

## UX / frontend

- `src/app/services/api-client.ts` incorpora `AuthApi.requestEmailVerification()` y `AuthApi.verifyEmail()`.
- `src/app/services/auth-context.tsx` expone `regionPolicy` y la rehidrata también tras registro y login social.
- `src/app/pages/Membership.tsx` ahora:
  - muestra una tarjeta de política regional;
  - informa proveedores recomendados de login y pago;
  - muestra si el correo ya está verificado;
  - intercepta el checkout pago cuando aplica `step-up`;
  - abre un modal OTP con reenvío y continuación del checkout tras verificar.

## Alcance real

- Ya está resuelto el `step-up` por email previo al pago.
- Todavía no hay:
  - verificación real de teléfono;
  - OTP por SMS o WhatsApp;
  - biometría móvil;
  - políticas de riesgo dinámicas por monto/dispositivo.

## Validación ejecutada

- `npm run typecheck`
- `npx vitest run server/__tests__/app-auth-email-verification.integration.test.ts src/app/pages/__tests__/membership-page.test.tsx`
- `npm run docs:api:generate`
- `npm run docs:api:check`

## Siguiente paso recomendado

1. Añadir `phone verification` real como segunda capa opcional por región.
2. Bajar la misma matriz regional a la selección visible de medios de pago en checkout.
3. Hacer smoke en deploy del modal OTP y el bloqueo server-side de `subscriptions/create`.
