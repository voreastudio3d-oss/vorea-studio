# Research fechado — identidad, pagos y dominios por región (2026-04-02)

## Objetivo

Cerrar con evidencia actual dos pendientes del bloque global:

1. smoke funcional en deploy de cambios públicos UX/auth;
2. research externo fechado para priorizar social login, pagos y estrategia de dominios por región.

Este documento complementa:

- [[global_readiness_status_2026-04-02|global_readiness_status_2026-04-02.md]]
- [[roadmap_delegacion_abril_2026|roadmap_delegacion_abril_2026.md]]
- [[global_identity_payments_rule|global_identity_payments_rule.md]]

## 1. Smoke de producción

### Validaciones confirmadas en deploy

- Landing pública operativa en `https://voreastudio3d.com/es`.
- El badge `Fork` del hero está visible y accesible en el bloque principal.
- El modal de auth muestra solo `Google` como social login visible.
- El acceso `/es/profile` sin sesión está correctamente protegido con estado guest/locked.

### Evidencia resumida

- Landing:
  - URL: `https://voreastudio3d.com/es`
  - título: `Vorea Studio | 3D paramétrico, comunidad y AI Studio`
- Auth dialog:
  - título: `Iniciar Sesión`
  - provider visible: `Google`
  - provider oculto: `Instagram`
- Profile guest:
  - título: `Perfil | Vorea Studio`
  - mensaje: `Tu perfil es privado`

### Pendientes que no se marcaron como validados

- Smoke autenticado del cambio de contraseña en producción.
- Smoke admin-only del editor de Hero Banner por locale.

Estos dos puntos requieren cuenta QA con permisos y no deben cerrarse como validados solo por revisión pública.

## 2. Recomendación de login social por región

## Resumen ejecutivo

- Mantener `Google` como baseline global.
- Añadir `Apple` como prioridad alta para mercados con alto peso iOS/premium.
- Añadir `Facebook` solo en fase 2 para mercados consumer y especialmente LATAM.
- Añadir `LinkedIn` como login contextual, no como login universal, para flujos B2B/profesionales.

## Ola recomendada de activación

### Ola 1 — ahora

- `Google` global.
- `Email + password` local.
- `Apple` en mercados con mayor afinidad Apple o adquisición móvil premium:
  - US/CA
  - UK/EU occidental
  - AU/NZ
  - JP/KR

### Ola 2 — después de medir lift de conversión

- `Facebook` para mercados consumer, con prioridad:
  - LATAM
  - algunos mercados SEA si se abren campañas allí

### Ola 3 — login contextual

- `LinkedIn` solo en:
  - funnels B2B
  - creators profesionales
  - enterprise onboarding
  - partnerships, marketplace pro o hiring

No se recomienda poner `LinkedIn` como botón universal en el modal principal si el foco sigue siendo maker/consumer.

## Matriz por región

### Norteamérica / Europa / ANZ

- Prioridad: `Google + Apple`
- Opcional: `LinkedIn` si se empuja B2B o creator-pro
- `Facebook` solo si campañas consumer muestran mejor CAC o menor fricción

Razonamiento:

- Google Identity Services sigue siendo un baseline muy sólido y seguro para web, con One Tap, Automatic Sign-in y FedCM para nuevas integraciones web.
- Apple mantiene un valor alto en ecosistemas premium/iOS y en usuarios sensibles a privacidad.

### LATAM

- Prioridad: `Google`
- Fase 2 recomendada: `Facebook`
- `Apple` solo si el mix de adquisición muestra peso real de iPhone o ticket alto
- `LinkedIn` solo en funnels profesionales específicos

Razonamiento:

- Meta conserva un peso muy alto de audiencia en LATAM; para varios países la penetración publicitaria de Facebook sigue siendo muy alta sobre la base de internet local.
- Google sigue siendo el mejor primer provider por cobertura y simplicidad técnica.

### India

- Prioridad: `Google`
- `Apple` opcional para segmentos premium/iOS
- `Facebook` menor prioridad que pagos y checkout local
- `LinkedIn` solo si se abre línea B2B/enterprise

Razonamiento:

- En India lo más crítico no es sumar muchos social logins sino resolver pagos locales y fricción de checkout.
- Google tiene mejor baseline práctico para el tipo de producto actual.

### B2B / enterprise transregional

- Mantener `Google`
- Añadir `LinkedIn` en páginas o modales específicos de flujo profesional
- No mezclar `LinkedIn` como botón principal del modal consumer

## 3. Recomendación de pagos por región

## Resumen ejecutivo

- Mantener `PayPal` como baseline cross-border mientras se expande.
- Añadir `Stripe` como siguiente gran paso para tarjetas y métodos locales dinámicos.
- Añadir `Mercado Pago` si LATAM pasa a ser foco comercial real, no solo cobertura aspiracional.
- Añadir `Razorpay` si India se vuelve mercado objetivo operativo.
- Evaluar `Paddle` si Vorea quiere simplificar tax/compliance global vía Merchant of Record.

## Matriz recomendada

### Baseline global inmediato

- `PayPal`
- `Stripe` (siguiente prioridad)

Razonamiento:

- PayPal REST soporta muchos países para business accounts y sigue siendo útil para cross-border inicial.
- Stripe permite activar muchas familias de pago y métodos locales por región desde un stack más unificado.

### Europa / UK / Norteamérica

- `Stripe + PayPal`

Con Stripe se ganan:

- tarjetas globales y locales;
- SEPA / Bacs / iDEAL / Bancontact / Klarna / wallets;
- mejor expansión futura a wallets y métodos regionales.

### LATAM

- `PayPal` como cross-border base
- `Stripe` si la entidad/país operativo lo permite y se necesita orquestación más amplia
- `Mercado Pago` como prioridad local cuando haya foco real en:
  - Argentina
  - Brasil
  - Chile
  - Colombia
  - México
  - Perú
  - Uruguay

Razonamiento:

- Mercado Pago mantiene footprint regional claro y operativo en esos mercados.
- Para LATAM, pago local pesa mucho más en conversión que agregar más social login.

### India

- `Razorpay` como recomendación principal
- `PayPal` solo para cross-border puntual
- `Paddle` o `Stripe` dependen de entidad, compliance y modelo de venta

Razonamiento:

- Razorpay está claramente orientado a checkout local, métodos configurables y cobertura amplia de payment methods en India.
- Paddle ya soporta UPI International, pero sigue siendo más natural como MoR global que como primer checkout doméstico India-first.

### SaaS global / suscripciones internacionales

- Evaluar `Paddle` si el dolor principal pasa a ser:
  - tax compliance
  - merchant-of-record
  - moneda local
  - expansión a 200+ mercados

No conviene activar todo al mismo tiempo. La secuencia más limpia sería:

1. `PayPal` actual
2. `Stripe`
3. `Mercado Pago` o `Razorpay` según región objetivo real
4. `Paddle` si el peso fiscal/compliance global justifica el cambio de modelo

## OTP y biometría en checkout

No se recomienda imponer OTP/biometría en todo checkout por defecto.

Sí se recomienda diseñar `step-up auth` para:

- cambio de método de pago;
- primera compra de alto valor;
- señales de riesgo;
- recuperación sensible de cuenta;
- discrepancias de región/dispositivo.

Para el resto, la fricción puede costar más conversión de la que protege.

## 4. Estrategia de dominios

## Recomendación operativa

- Mantener `voreastudio3d.com` como canonical principal en el corto plazo.
- Mantener estrategia de locales por subpath:
  - `/es`
  - `/en`
  - `/pt`

No migrar todavía a ccTLDs o subdominios por país.

## Dominios que conviene intentar reservar

- `vorea.studio`
- `vorea.ai`
- `voreastudio.ai`
- `voreastudio.app`
- `vorea3d.com`

## Lógica recomendada

- `voreastudio3d.com`: continuidad SEO y cero ruptura inmediata.
- `vorea.studio`: mejor marca corta si está disponible.
- `vorea.ai` / `voreastudio.ai`: protección de marca y futura capa AI.
- `voreastudio.app`: protección mobile/app.
- `vorea3d.com`: alias corto defensivo.

## Nota importante

Se intentó una comprobación en vivo de disponibilidad/precio mediante el tool de Vercel, pero la consulta estaba bloqueada por autenticación del conector. Por tanto:

- la estrategia de naming sí queda definida;
- la disponibilidad/precio en tiempo real sigue pendiente de una verificación posterior con herramienta autenticada.

## 5. Recomendación de implementación

### Próximo bloque recomendado

1. Añadir `Apple` como siguiente login social prioritario.
2. Diseñar matriz formal `region -> social providers -> payment providers -> verification policy`.
3. Preparar la integración de `Stripe`.
4. Posponer `Facebook` hasta validar si realmente aporta lift en LATAM.
5. Posponer `LinkedIn` para un entry point profesional/B2B separado.
6. Ejecutar una verificación autenticada de dominios antes de comprar.

## 6. Fuentes

### Identidad

- Google Identity Services — Sign in with Google overview:
  - https://developers.google.com/identity/gsi/web/guides/overview
- Apple — Configuring Sign in with Apple support:
  - https://developer.apple.com/documentation/xcode/configuring-sign-in-with-apple
- Apple — Sign in with Apple for the web:
  - https://developer.apple.com/help/account/configure-app-capabilities/configure-sign-in-with-apple-for-the-web
- LinkedIn Consumer Solutions Platform:
  - https://learn.microsoft.com/linkedin/consumer
- LinkedIn Sign In with LinkedIn:
  - https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin
- LinkedIn OIDC metadata reference surfaced in Microsoft Learn:
  - https://www.linkedin.com/oauth/.well-known/openid-configuration
- Meta/Regional scale reference:
  - https://datareportal.com/essential-facebook-stats
  - https://datareportal.com/reports/digital-2025-mexico
  - https://datareportal.com/reports/digital-2025-peru

### Pagos

- Stripe payment methods overview:
  - https://docs.stripe.com/payments/payment-methods/overview
- Stripe payment method support:
  - https://docs.stripe.com/payments/payment-methods/payment-method-support
- PayPal REST country and region codes:
  - https://developer.paypal.com/api/rest/reference/country-codes/
- Mercado Pago status / regional footprint:
  - https://status.mercadopago.com/
- Razorpay payments overview:
  - https://razorpay.com/docs/payments/
- Razorpay supported methods / payment method configuration:
  - https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/configure-payment-methods/supported-methods/
  - https://razorpay.com/docs/payments/dashboard/account-settings/payment-methods/
- Paddle supported countries:
  - https://developer.paddle.com/concepts/sell/supported-countries-locales
- Paddle payment methods overview:
  - https://developer.paddle.com/concepts/payment-methods/overview
- Paddle UPI International:
  - https://developer.paddle.com/concepts/payment-methods/upi
- Paddle localized pricing:
  - https://developer.paddle.com/build/products/offer-localized-pricing

## 7. Estado de cierre

- Smoke público en deploy: completado
- Research regional de identidad/pagos/dominios: completado
- Smoke autenticado/admin-only: pendiente y separado explícitamente
