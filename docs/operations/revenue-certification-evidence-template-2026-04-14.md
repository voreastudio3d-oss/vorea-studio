# Plantilla de Evidencia — Certificación Revenue

Fecha:

Responsable:

Entorno:

URL base:

Commit desplegado:

Branch desplegada:

## 1. Preflight

- `pnpm typecheck`:
- `corepack pnpm test -- server/__tests__/app-monetization.integration.test.ts server/__tests__/paypal-sandbox.smoke.test.ts`:
- `verify:deploy:routing-seo`:

## 2. Variables críticas verificadas en Railway

- `DATABASE_URL`:
- `JWT_SECRET`:
- `PAYPAL_CLIENT_ID`:
- `PAYPAL_CLIENT_SECRET`:
- `PAYPAL_WEBHOOK_ID`:
- `PAYPAL_MODE`:
- `RESEND_API_KEY`:
- `FRONTEND_URL`:
- `DEPLOY_SECRET`:

## 3. Smoke técnico post-deploy

- `GET /api/health`:
- `GET /robots.txt`:
- `GET /sitemap.xml`:
- `GET /`:
- `GET /perfil`:
- `GET /ai-studio`:

Observaciones:

## 4. Compra one-time

- Usuario de prueba:
- Pack:
- Monto:
- Moneda:
- `orderId`:
- `captureId`:
- Hora de creación:
- Hora de captura:
- Estado final:

Observaciones:

## 5. Ledger de créditos

- Balance antes:
- `topupBalance` antes:
- `totalUsed` antes:
- Balance después:
- `topupBalance` después:
- `totalUsed` después:
- ¿Acreditación única?:
- ¿Hubo replay/refresh?:
- Resultado del replay:

Observaciones:

## 6. Generación IA posterior a la compra

- Usuario:
- Prompt:
- Engine:
- Resultado:
- ¿Consumió créditos?:
- Balance después de generar:
- `topupBalance` después de generar:
- `totalUsed` después de generar:
- ¿Se observó `reservation -> capture -> release` consistente?:

Observaciones:

## 7. Email transaccional

- ¿Se envió email?:
- Destinatario:
- Asunto:
- ¿Incluye créditos?:
- ¿Incluye monto?:
- ¿Incluye `orderId`?:
- Hora observada:

Observaciones:

## 8. Dashboard financiero

- ¿Aparece en top-ups one-time?:
- ¿Revenue total actualizado?:
- ¿Donaciones separadas correctamente?:
- ¿Suscripciones separadas correctamente?:
- ¿AI spend visible/correcto?:

Observaciones:

## 9. Resultado de certificación

- Estado final:
  - `CERTIFICADO`
  - `BLOQUEADO`
- ¿Mover `BG-117.4` a `done`?:
- Motivo:

## 10. Bloqueos o incidentes

- Incidente 1:
- Incidente 2:
- Incidente 3:

## 11. Próximo paso

- Próxima acción recomendada:
- Responsable:
- Dependencia externa:
