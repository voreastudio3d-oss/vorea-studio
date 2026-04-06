# Mini Proyecto API Expuesta — Vorea Studio

Este paquete documenta la API real del backend y su exposición técnica.

## Artefactos

- Spec OpenAPI: `public/openapi.json`
- Portal técnico: `public/docs/index.html` (ruta `/docs/`)
- Matriz operativa: `docs/api/endpoint-matrix.md`
- Inventario JSON: `docs/api/endpoint-inventory.json`
- Inconsistencias: `docs/api/inconsistencies.md`

## Generación y verificación

```bash
npm run docs:api:generate
npm run docs:api:check
```

## Criterios de calidad

1. Paridad 100% entre rutas reales y OpenAPI.
2. Cada endpoint documentado con auth/rol, errores y ejemplo de uso.
3. Quickstarts para auth, comunidad, monetización y admin.

## Estado de pagos (2026-03-19)

- Implementado: **PayPal** (ordenes, captura, suscripciones y webhook firmado).
- No implementado en backend: **Stripe** (solo referencias textuales previas en UI/i18n).

