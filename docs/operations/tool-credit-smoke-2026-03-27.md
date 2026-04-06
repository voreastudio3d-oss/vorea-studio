# Tool Credit Smoke - 2026-03-27

Smoke manual ejecutado sobre `develop` local para validar cobro real de creditos en acciones protegidas.

## Cuenta usada

- Usuario: `qa.pro@vorea.studio`
- Password: `VoreaQA2026!`
- Tier esperado: `PRO`

## Resultado general

- El cobro de creditos SI ocurre en acciones reales del producto.
- Se detecto un bug de respuesta en `/api/tool-actions/consume`: algunas acciones descontaban creditos pero devolvian `consumed: false`.
- El bug quedo corregido en backend y cubierto con test de integracion.

## Evidencia

| Fecha | Flujo | Medio | Antes | Despues | Delta | Resultado | Notas |
|---|---|---|---:|---:|---:|---|---|
| 2026-03-27 | `organic.compile_to_studio` | UI real | 500 | 499 | -1 | PASS | Click en `Compilar en el Editor` y navegacion a `/es/studio`. |
| 2026-03-27 | `studio.download_stl` | UI real | 496 | 495 | -1 | PASS | Exportacion `.STL` completada con descarga real de archivo. |
| 2026-03-27 | `makerworld.download_prep` | API autenticada | 495 | 493 | -2 | PASS | El delta de `2` coincide con la configuracion actual del negocio. |
| 2026-03-27 | `relief.export_stl` | API autenticada | 493 | 492 | -1 | PASS | Validado antes y despues del fix de `consumed`. |
| 2026-03-27 | `community.download` | API autenticada | 492 | 491 | -1 | PASS | Descarga protegida descuenta correctamente. |
| 2026-03-27 | `relief.export_stl` | API autenticada | 490 | 489 | -1 | PASS | Re-smoke despues del fix: la respuesta ya devuelve `consumed: true`. |

## Configuracion observada

La configuracion publica de negocio expone actualmente estos costos relevantes:

- `PRO.monthlyCredits = 500`
- `makerworld.download_prep.creditCost = 2`
- `studio.download_stl.creditCost = 1`
- `relief.export_stl.creditCost = 1`

## Seguimiento

- Mantener este smoke como control rapido despues de tocar gating o monetizacion.
- Extenderlo a compra/captura PayPal cuando se haga la siguiente auditoria E2E de negocio.
