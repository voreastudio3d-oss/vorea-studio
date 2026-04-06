# Guía por Perfil — Desarrolladores

## Objetivo

Integrar, extender y operar la API de Vorea Studio con contratos claros, seguridad y trazabilidad.

## Mapa técnico rápido

1. Fuente de verdad de rutas: `server/app.ts` + `server/paypal-subscriptions.ts`.
2. Spec consumible: `public/openapi.json`.
3. Matriz operativa: `docs/api/endpoint-matrix.md`.
4. Riesgos y discrepancias: `docs/api/inconsistencies.md`.
5. Smoke browser interno: `docs/operations/playwright-cli-skill.md`.
6. Flujos de producto y negocio: `docs/operations/product-business-flows.md`.

## Flujos críticos

1. Auth:
   - signup/signin/refresh y perfil (`/api/auth/*`).
   - usar Bearer JWT en rutas protegidas.
2. Comunidad:
   - crear/editar/listar modelos, likes, comments, downloads.
   - respetar gating por estado (`draft/published/archived`) y permisos.
3. Monetización:
   - créditos: `/api/paypal/create-order`, `/api/paypal/capture-order`.
   - suscripciones: `/api/subscriptions/create`, `/api/subscriptions/webhook`.
4. Admin:
   - operación y configuración por `/api/admin/*` y `/api/vault/*`.
5. Producto:
   - revisar `docs/operations/product-business-flows.md` para entender cómo se conectan auth, planes, créditos, AI Studio, comunidad y rewards.

## Seguridad y operación

1. No confiar en IDs sensibles enviados por frontend; usar identidad autenticada.
2. Mantener webhook de PayPal con verificación de firma activa.
3. Documentar toda ruta nueva en OpenAPI + matriz + parity check.
4. Mantener commits de seguridad/pagos separados de cambios UI.

## Comandos clave

```bash
npm run docs:api:generate
npm run docs:api:check
npm run test
npm run build
```

## Validación UI rápida

Para smoke manual asistido desde terminal, usar la guía:

- `docs/operations/playwright-cli-skill.md`

Está pensada para desarrollo, QA técnico y soporte interno.

