# Estado actual — expansión global, identidad regional y pendientes UX (2026-04-02)

## Objetivo

Separar claramente qué puntos ya están resueltos, cuáles existen como cambios locales todavía no integrados y cuáles siguen siendo backlog real dentro del plan global de Vorea Studio.

## Estado base de la plataforma

- **Idiomas activos:** `es`, `en`, `pt` más variantes regionales.
- **Login social operativo:** Google.
- **Pagos operativos:** PayPal.
- **Router IA:** Multi-provider con forecast, fallback y observabilidad.
- **Hardening anti-abuso:** Fase 1 ya implementada; falta rate limit distribuido.
- **Storage/media global:** aún no formalizado como arquitectura multi-región.

## Qué sí cambió Gemini hasta ahora

- **Cambio ya commiteado:** `dfc5a79` resolvió el `logout` con recarga dura y agregó UI de cambio de contraseña en perfil.
- **Fixes locales útiles todavía no integrados:** ocultar Instagram en auth, hacer más visible el badge `Fork` del hero y corregir placeholders por locale en la edición del Hero Banner.
- **Aporte documental útil:** dejó un borrador de roadmap que sirvió como base para este corte, pero necesitaba pasar a gobernanza canónica y cruzarse con el estado real del repo.

## Matriz por punto

### 1. Mercado global en lugar de local
- **Estado:** parcialmente mapeado
- **Qué existe:** i18n multi-idioma, router IA multi-provider, documentación de expansión en progreso
- **Qué falta:** estrategia global formal de regiones prioritarias, dominios, costos y arquitectura de datos
- **Skills recomendados:** `global-market-platform-strategy`, `global-localization-growth-strategy`
- **Workflow recomendado:** `global-architecture-scale`, `global-localization-marketing`
- **LLM líder recomendado:** OpenAI/GPT para estrategia + Gemini para modelado operativo + Codex para aterrizaje en repo

### 2. Estrategia por mercados, datos, bigdata, seguridad, costos y dominios
- **Estado:** no implementado como plan canónico completo
- **Qué existe:** auditoría anti-abuso, budget IA, forecast y primeras reglas globales
- **Qué falta:** matriz de regiones, storage growth model, egress/image policy, plan de dominios y costos comparados de hosting
- **Skills recomendados:** `global-market-platform-strategy`
- **Workflow recomendado:** `global-architecture-scale`
- **LLM líder recomendado:** Gemini

### 3. Registro con otras redes
- **Estado:** parcial
- **Qué existe:** Google login operativo
- **Qué falta:** matriz por región y providers adicionales (Apple, Facebook, LinkedIn, etc.)
- **Evidencia:** `src/app/components/AuthDialog.tsx`, `server/app.ts`
- **Skills recomendados:** `global-identity-payments-strategy`
- **Workflow recomendado:** `global-identity-payments`
- **LLM líder recomendado:** Claude

### 4. Medios de pago por región
- **Estado:** parcial
- **Qué existe:** PayPal operativo para planes
- **Qué falta:** Stripe, Mercado Pago, Paddle u otros; matriz regional y criterios de activación
- **Evidencia:** `server/paypal-subscriptions.ts`, `src/app/pages/Membership.tsx`
- **Skills recomendados:** `global-identity-payments-strategy`
- **Workflow recomendado:** `global-identity-payments`
- **LLM líder recomendado:** Claude

### 5. Marketing por idioma / región / cultura
- **Estado:** parcial
- **Qué existe:** i18n extendido y primera limpieza de copy AI Studio/Admin
- **Qué falta:** estrategia por mercado, funnels, claims por región y auditoría completa de landings
- **Skills recomendados:** `global-localization-growth-strategy`
- **Workflow recomendado:** `global-localization-marketing`
- **LLM líder recomendado:** OpenAI/GPT

### 6. Herramientas prometedoras por área
- **Estado:** parcial
- **Qué existe:** GA4, eventos, Resend, analytics internos, budget IA
- **Qué falta:** CRM, mailing, fidelización, BI y seguridad gestionada como stack priorizado
- **Skills recomendados:** `global-market-platform-strategy`, `global-localization-growth-strategy`
- **Workflow recomendado:** `global-architecture-scale`, `global-localization-marketing`
- **LLM líder recomendado:** OpenAI/GPT + Gemini

### 7. Quitar link de Instagram hasta implementarlo
- **Estado:** resuelto en repo
- **Qué existe:** el botón de Instagram quedó oculto hasta que exista implementación real de login social
- **Evidencia:** `src/app/components/AuthDialog.tsx`
- **LLM líder recomendado:** Codex

### 8. Hacer más visible el link de Fork del hero
- **Estado:** resuelto en repo
- **Qué existe:** el badge `Fork` del hero ahora tiene mayor contraste, tamaño y visibilidad
- **Evidencia:** `src/app/pages/Landing.tsx`
- **LLM líder recomendado:** Codex / OpenAI-GPT para revisión UX final

### 9. Bug de traducción en edición de Hero Banner
- **Estado:** resuelto en repo
- **Qué existe:** los placeholders por idioma ahora leen `FALLBACKS[locale]` y dejan de contaminar los tres bloques al alternar ES/EN/PT
- **Evidencia:** `src/app/pages/SuperAdmin.tsx`
- **LLM líder recomendado:** Codex

### 10. Poco control de edición de cuenta
- **Estado:** resuelto en repo
- **Qué existe:** commit `dfc5a79` agregó UI para cambio de contraseña y manejo social->password en `src/app/pages/Profile.tsx`
- **Qué se cerró en este bloque:** backend real para `PUT /api/auth/me/password` con validación fuerte, soporte social->password, rate limit y prueba de integración
- **Evidencia:** `server/app.ts`, `server/__tests__/app-auth-password.integration.test.ts`
- **LLM líder recomendado:** Claude para diseño auth + Codex para implementación real

### 11. Más datos de usuario y facturación
- **Estado:** parcial
- **Qué existe:** perfil básico extendido con `phone`, `countryCode`, `regionCode`, `defaultLocale`, `billingProfile` y persistencia real desde `/profile`
- **Qué evidencia lo respalda:** `server/profile-region-policy.ts`, `server/app.ts`, `server/auth.ts`, `src/app/pages/Profile.tsx`
- **Qué falta:** vault/tokenización de método de pago, tarjetas guardadas y acoplarlo a checkout real
- **LLM líder recomendado:** Claude + Gemini

### 12. Logout no recarga la página
- **Estado:** resuelto
- **Qué existe:** commit `dfc5a79` agregó `window.location.reload()` en `src/app/services/auth-context.tsx`
- **LLM líder recomendado:** ninguno; solo validar smoke

### 13. Envío y validación de correo / teléfono
- **Estado:** parcial
- **Qué existe:** reset por email/PIN, Google OAuth, campos canónicos `email_verified_at` / `phone_verified_at` y verificación formal de email vía OTP con rate limit y persistencia real
- **Qué evidencia lo respalda:** `server/app.ts`, `src/app/services/api-client.ts`, `server/__tests__/app-auth-email-verification.integration.test.ts`
- **Qué falta:** phone verification, WhatsApp o SMS
- **LLM líder recomendado:** Claude

### 14. OTP rápido o biometría móvil en pago
- **Estado:** parcial
- **Qué existe:** componente UI OTP reutilizable en `src/app/components/ui/input-otp.tsx`, flujo real de step-up por email en checkout y enforcement server-side en suscripciones PayPal según `regionPolicy`
- **Qué evidencia lo respalda:** `src/app/pages/Membership.tsx`, `server/paypal-subscriptions.ts`, `email_verification_checkout_stepup_2026-04-02.md`
- **Qué falta:** OTP por teléfono, biometría móvil y política adaptativa por riesgo/monto/dispositivo
- **LLM líder recomendado:** Claude

## Hallazgo transversal importante

El `Cerebro` y `current_block.yaml` venían desalineados respecto del estado real:

- hay cambios de producto ya commiteados (`dfc5a79`);
- hay fixes locales útiles aún no integrados (puntos 7, 8 y 9);
- y había workflows globales nuevos todavía fuera de la gobernanza sincronizada.

## Recomendación de ejecución

1. Formalizar gobernanza global y routing por LLM.
2. Hacer smoke deploy de los puntos 7, 8, 9 y 10 ya integrados.
3. Recién después entrar en research comparativo regional para social login, pagos y dominios.
