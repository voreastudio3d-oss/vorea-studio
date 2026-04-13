# Inconsistencias Detectadas en API/Producto

Generado: 2026-04-13T13:40:09.387Z

## 1) Definiciones duplicadas de rutas

- **POST /api/auth/google**
  - `server/app.ts:1861`
  - `server/app.ts:5768`
  - Recomendación: mantener una sola definición canónica para evitar comportamiento ambiguo.

- **GET /api/auth/google/config**
  - `server/app.ts:1852`
  - `server/app.ts:5881`
  - Recomendación: mantener una sola definición canónica para evitar comportamiento ambiguo.

- **GET /api/paypal/client-id**
  - `server/app.ts:2703`
  - `server/app.ts:6035`
  - Recomendación: mantener una sola definición canónica para evitar comportamiento ambiguo.

- **GET /api/rewards/me**
  - `server/app.ts:4648`
  - `server/app.ts:8165`
  - Recomendación: mantener una sola definición canónica para evitar comportamiento ambiguo.

## 2) Mensajería Stripe vs backend real

No se detectaron menciones a Stripe en locales revisados.

## 3) Estado de pasarela de pagos

- Implementado en backend: **PayPal** (orders + subscriptions + webhook firmado).
- No implementado en backend: **Stripe**.

## 4) Cobertura por dominio

Dominios detectados: AI, Activity, Admin, Admin Community, Auth, Community, Content, Credits, Feedback, GCode, Health, Internal News, Misc, News, PayPal Orders, PayPal Subscriptions, Promotions, Rewards, Telemetry, Tool Actions, Uploads, Vault
