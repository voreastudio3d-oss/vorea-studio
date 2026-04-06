# Smoke OTP y checkout — 2026-04-02

## Objetivo
Validar en deploy real dos cosas del flujo de pago regional:

1. que el modal OTP aparezca cuando la política regional exige step-up;
2. que el backend bloquee el checkout aunque el frontend falle en interceptarlo.

## Entorno
- URL base: `https://voreastudio3d.com`
- Ruta probada: `/es/plans`
- Método de smoke: navegador real vía `pwcli` + llamadas HTTP directas con JWT de sesión

## Flujo ejecutado
1. Se creó una cuenta temporal de smoke en producción:
   - display name: `OTP Smoke`
   - username: `@otpsmoke1775158191`
   - email: `otpsmoke1775158191@example.com`
2. Se confirmó el estado inicial:
   - `GET /api/auth/me` devolvió `countryCode=null`, `regionCode=GLOBAL`, `emailVerifiedAt=null`
3. Se actualizó el perfil por API:
   - `countryCode=UY`
   - `defaultLocale=es`
   - `phone=+59899111222`
   - `billingProfile.countryCode=UY`
4. Se reintentó el checkout directo por API:
   - `POST /api/subscriptions/create` con `tier=PRO`, `billing=monthly`

## Resultado confirmado
- El bloqueo server-side funciona correctamente.
- Respuesta observada:
  - `HTTP 403`
  - `verificationRequired: true`
  - `regionPolicy.regionCode: LATAM`
  - mensaje: `Debes verificar tu correo antes de continuar con el pago en tu región.`

## Hallazgo UI/runtime
- El backend de suscripciones sí evaluó la región como `LATAM`.
- Pero `GET /api/auth/me` podía responder `regionCode=GLOBAL` después de editar el país.
- Eso dejaba al frontend con `regionPolicy` equivocada y por lo tanto impedía abrir el modal OTP antes del checkout.

## Causa raíz
- La canonicalización del perfil en `server/app.ts` priorizaba `existingProfile.regionCode` desde KV sobre la región derivada del `countryCode`.
- Si el blob KV quedaba con un `regionCode` viejo (`GLOBAL`), el frontend recibía una política inconsistente aunque `countryCode` ya fuera `UY`.

## Corrección aplicada
- `buildCanonicalSelfProfile()` ahora trata `countryCode` como source of truth para `regionCode`.
- Si hay `countryCode`, la región se deriva siempre con `resolveRegionCode(countryCode)`.
- Esto evita que un `regionCode` viejo en KV pise la región efectiva del usuario.

## Validación posterior al fix
- Tests:
  - `server/__tests__/app-auth-profile.integration.test.ts`
  - `server/__tests__/app-auth-email-verification.integration.test.ts`
  - `src/app/pages/__tests__/membership-page.test.tsx`
- `npm run typecheck`

## Validación visual posterior al deploy
- Tras el push de `fix(auth): derive checkout region from country canonically`, el deploy volvió a responder:
  - `GET /api/auth/me` con `regionCode=LATAM`
  - `regionPolicy.requiresStepUpOnPayment=true`
- En `/es/plans`, la tarjeta de política regional pasó de `Global` a `Latinoamérica`.
- Al hacer click en `Actualizar a Pro`, se abrió el modal:
  - título: `Verifica tu correo para continuar`
  - campo: `Código OTP`
  - acciones: `Reenviar código` y `Verificar y continuar`

## Estado
- `checkout` server-side: validado en producción.
- `modal OTP` en producción: validado en producción.
