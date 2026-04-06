# Legacy Top-Up Backfill

## Objetivo

Cerrar el bucket histórico `user:*:credits` migrando los `purchasedCredits` pendientes al saldo universal `user:*:tool_credits`.

## Qué hace

- detecta usuarios con `purchasedCredits > 0`
- mueve ese saldo a `topupBalance`
- conserva `freeUsed` y `totalExported`
- deja `purchasedCredits = 0`
- registra actividad `tool_credit_topup_migrated`
- guarda resumen de ejecución en `admin:tool_credits:legacy_backfill:last_run`

## Dónde ejecutarlo

- SuperAdmin -> `Finanzas` -> bloque `Cierre de créditos legacy`
- preview: `GET /api/admin/tool-credits/legacy-status`
- ejecución: `POST /api/admin/tool-credits/legacy-migrate`

## Notas operativas

- la migración es idempotente a nivel práctico: una vez que `purchasedCredits` queda en `0`, el usuario ya no vuelve a entrar en el batch
- el sistema ya migraba créditos legacy “on touch”; este backfill sirve para cerrar el bucket de forma explícita y auditable
- si el preview queda en `0 usuarios afectados`, no hace falta correr nada

## Validación recomendada

1. revisar preview en SuperAdmin
2. ejecutar el backfill
3. verificar que `Créditos por migrar = 0`
4. revisar en usuarios que el saldo legacy pendiente desaparezca
5. conservar el timestamp de `Último backfill` como evidencia operativa
