# Monetization Tier Smoke - 2026-03-28

Smoke automatizado ejecutado sobre `http://localhost:3001/api` con provisioning temporal por tier y cleanup habilitado.

## Resultado general

- El smoke automatizado por tier pasó completo en entorno local.
- Se validó cobro real de créditos para `FREE`, `PRO` y `STUDIO PRO`.
- También se validaron bloqueos esperados para acciones fuera de plan.
- Durante la ejecución se corrigieron dos bugs del propio smoke:
  - el script estaba leyendo mal el balance desde `/api/tool-credits/me`
  - el wrapper `pnpm verify:monetization:tiers` fallaba cuando `.env` no existía

## Evidencia

| Fecha | Tier | Flujo | Antes | Después | Delta | Esperado | Resultado | Notas |
|---|---|---|---:|---:|---:|---:|---|---|
| 2026-03-28 | `FREE` | `studio.download_stl` | 50 | 49 | -1 | -1 | PASS | Consumo real validado con cuenta temporal |
| 2026-03-28 | `PRO` | `organic.deform` | 500 | 499 | -1 | -1 | PASS | Consumo real validado con cuenta temporal |
| 2026-03-28 | `STUDIO PRO` | `studio.download_scad` | 1000 | 995 | -5 | -5 | PASS | Consumo real validado con cuenta temporal |
| 2026-03-28 | `FREE` | `organic.deform` | 49 | 49 | 0 | 0 | PASS | Bloqueo esperado `403` |
| 2026-03-28 | `PRO` | `studio.download_scad` | 499 | 499 | 0 | 0 | PASS | Bloqueo esperado `403` |

## Modo de ejecución

- Modo: provisioning temporal con admin local
- Cleanup: `enabled`
- Artefactos runtime: `output/monetization-smoke/` (limpiados luego del registro manual)

## Seguimiento

- Mantener `pnpm verify:monetization:tiers` como gate rápido tras cambios en gating, tool credits o membresías.
- Siguiente paso útil: correr el mismo smoke contra el entorno que se quiera certificar fuera de local y conservar los artefactos generados.
