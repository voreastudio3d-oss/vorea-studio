# Checklist Operativa — Certificación Revenue en Railway

Fecha: 2026-04-14

Objetivo:

- cerrar el sprint `revenue-certification-sprint`;
- certificar un cobro real verificable en el entorno Railway/Node;
- confirmar que pago, créditos, email y dashboard financiero quedan consistentes en el mismo entorno.

Referencia complementaria:

- `production_deploy_guide.md`
- `docs/operations/railway-node-cutover-checklist.md`
- `docs/operations/monetization-tier-smoke.md`
- `docs/operations/revenue-certification-evidence-template-2026-04-14.md`
- `.agents/runtime/current_block.yaml`

## 1. Precondiciones obligatorias

No avanzar al smoke real si esto no está en verde:

1. `pnpm typecheck`
2. `corepack pnpm test -- server/__tests__/app-monetization.integration.test.ts server/__tests__/paypal-sandbox.smoke.test.ts`
3. El commit objetivo ya está empujado al remoto que deploya Railway.

Estado de referencia de este corte:

- gate local restaurada el `2026-04-14`
- resultado Vitest de referencia: `1348 passed, 4 skipped`

## 2. Variables críticas en Railway

Revisar manualmente en el servicio Railway antes del deploy:

1. `NODE_ENV=production`
2. `PORT=3001`
3. `DATABASE_URL`
4. `JWT_SECRET`
5. `ENCRYPTION_MASTER_KEY`
6. `FRONTEND_URL=https://voreastudio3d.com`
7. `VITE_API_URL=/api`
8. `PAYPAL_CLIENT_ID`
9. `PAYPAL_CLIENT_SECRET`
10. `PAYPAL_MODE`
11. `PAYPAL_WEBHOOK_ID`
12. `PAYPAL_PRO_MONTHLY_PLAN_ID`
13. `PAYPAL_PRO_YEARLY_PLAN_ID`
14. `PAYPAL_STUDIOPRO_MONTHLY_PLAN_ID`
15. `PAYPAL_STUDIOPRO_YEARLY_PLAN_ID`
16. `RESEND_API_KEY`
17. `GOOGLE_CLIENT_ID`
18. `GOOGLE_CLIENT_SECRET`
19. `DEPLOY_SECRET`

Criterio:

- si falta cualquiera de `DATABASE_URL`, `JWT_SECRET`, `PAYPAL_*`, `RESEND_API_KEY`, `FRONTEND_URL` o `DEPLOY_SECRET`, no certificar.

## 3. Deploy y smoke base del servicio

Después del deploy del commit objetivo:

1. Confirmar `GET /api/health`
2. Confirmar `GET /robots.txt`
3. Confirmar `GET /sitemap.xml`
4. Confirmar `GET /`
5. Confirmar `GET /perfil`
6. Confirmar `GET /ai-studio`

Esperado:

- `/api/health` responde `200`
- `/robots.txt` devuelve texto, no HTML
- `/sitemap.xml` devuelve XML, no HTML
- las rutas públicas cargan sin error visible

## 4. Smoke funcional de monetización

### 4.1 Recarga one-time

Ejecutar una compra one-time en el entorno Railway objetivo:

1. iniciar sesión con un usuario de prueba controlado;
2. abrir el flujo de compra de créditos;
3. crear la orden PayPal;
4. aprobar manualmente en PayPal;
5. volver a la app y dejar que se ejecute `POST /api/paypal/capture-order`.

Evidencia mínima a guardar:

1. `orderId`
2. `captureId` si PayPal lo expone en logs o respuesta
3. monto
4. pack comprado
5. timestamp

### 4.2 Idempotencia básica

Verificar que la misma orden no acredita dos veces:

1. refrescar la vista de retorno;
2. repetir la captura por refresh o replay controlado si el flujo lo permite;
3. revisar que el crédito total no aumente una segunda vez.

Esperado:

- acreditación única;
- sin doble incremento de `topupBalance`;
- sin doble incremento del revenue confirmado.

## 5. Verificación de ledger de créditos

Sobre el mismo usuario:

1. capturar balance antes de la compra;
2. capturar balance después de la compra;
3. verificar que suba el saldo universal;
4. confirmar que el bucket persistido sea consistente con:
   - `balance`
   - `topupBalance`
   - `totalUsed`

Luego ejecutar una generación IA cobrable:

1. abrir `AI Studio`;
2. lanzar una generación autenticada que consuma créditos;
3. confirmar que el flujo server-side hace `reservation -> capture -> release`;
4. si falla la generación, confirmar que el saldo se revierte;
5. si la generación termina bien, confirmar consumo único.

Esperado:

- la compra suma saldo una sola vez;
- la generación descuenta de forma coherente;
- no quedan créditos “fantasma” por refresh o retry;
- en fallo, el snapshot se libera correctamente.

## 6. Verificación de email transaccional

Después de la captura exitosa:

1. revisar que se emite email de confirmación por Resend;
2. confirmar destinatario correcto;
3. confirmar que el contenido incluya:
   - créditos comprados
   - monto
   - `orderId`

Esperado:

- el email se envía sin romper la captura;
- si el proveedor degrada, la compra no debe revertirse por eso.

## 7. Verificación de dashboard financiero

Con la compra real ya capturada:

1. entrar a SuperAdmin;
2. abrir reportes financieros;
3. revisar KPI principal de ingresos;
4. revisar bloque de top-ups one-time;
5. revisar donaciones y suscripciones para asegurar que no se mezclen;
6. revisar gasto IA real si también se ejecutó la generación.

Esperado:

- la recarga aparece en top-ups one-time;
- el revenue total refleja la compra;
- no se duplica la transacción;
- el dashboard sigue separando:
   - top-ups
   - suscripciones
   - donaciones
   - AI spend

## 8. Smoke opcional de tiers

Si el entorno objetivo permite usar credenciales de QA:

```bash
pnpm verify:monetization:tiers --api-base https://<host>/api
```

Usar las variantes documentadas en `docs/operations/monetization-tier-smoke.md`.

No bloquea la certificación del primer cobro real, pero suma evidencia fuerte.

## 9. Criterio de cierre del sprint

Marcar `BG-117.4` como `done` solo si se demuestra todo esto en el mismo entorno Railway:

1. deploy sano
2. compra capturada
3. acreditación única
4. consumo IA consistente
5. email de confirmación enviado
6. dashboard financiero actualizado correctamente

Si falla cualquiera:

1. dejar `BG-117.4` como `blocked`
2. registrar el punto exacto de ruptura
3. guardar evidencia mínima del error
4. no mover el sprint a cerrado

## 10. Evidencia mínima a guardar en handoff

1. URL del entorno certificado
2. commit desplegado
3. `orderId`
4. `captureId` si aplica
5. pack y monto
6. balance antes y después
7. resultado de la generación IA posterior
8. confirmación del email
9. confirmación del dashboard financiero
10. cualquier bloqueo restante
