# Inconsistencias Detectadas en API/Producto

Generado: 2026-04-02T19:21:48.839Z

## 1) Definiciones duplicadas de rutas

- **POST /api/auth/google**
  - `server/app.ts:1847`
  - `server/app.ts:5478`
  - Recomendación: mantener una sola definición canónica para evitar comportamiento ambiguo.

- **GET /api/auth/google/config**
  - `server/app.ts:1838`
  - `server/app.ts:5591`
  - Recomendación: mantener una sola definición canónica para evitar comportamiento ambiguo.

- **GET /api/paypal/client-id**
  - `server/app.ts:2681`
  - `server/app.ts:5745`
  - Recomendación: mantener una sola definición canónica para evitar comportamiento ambiguo.

- **GET /api/rewards/me**
  - `server/app.ts:4587`
  - `server/app.ts:7842`
  - Recomendación: mantener una sola definición canónica para evitar comportamiento ambiguo.

## 2) Mensajería Stripe vs backend real

No se detectaron menciones a Stripe en locales revisados.

## 3) Estado de pasarela de pagos

- Implementado en backend: **PayPal** (orders + subscriptions + webhook firmado).
- No implementado en backend: **Stripe**.

## 4) Cobertura por dominio

Dominios detectados: AI, Activity, Admin, Admin Community, Auth, Community, Content, Credits, Feedback, GCode, Health, Internal News, Misc, News, PayPal Orders, PayPal Subscriptions, Promotions, Rewards, Telemetry, Tool Actions, Uploads, Vault
