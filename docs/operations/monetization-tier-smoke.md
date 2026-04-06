# Monetization Tier Smoke

Smoke automatizado para validar monetización por tier con la regla:

`saldo antes -> acción protegida -> saldo después`

También incluye dos bloqueos esperados para asegurar que el gating no solo cobra bien, sino que además rechaza acciones fuera del plan.

## Script

```bash
pnpm verify:monetization:tiers --api-base http://localhost:3001/api
```

El script genera artefactos en `output/monetization-smoke/`.

## Modos de ejecución

### 1. Provisioning temporal con admin

Recomendado para QA repetible sin contaminar cuentas existentes.

Variables requeridas:

```bash
MONETIZATION_SMOKE_ADMIN_EMAIL=owner@example.com
MONETIZATION_SMOKE_ADMIN_PASSWORD=super-secret
```

Opcionales:

```bash
MONETIZATION_SMOKE_API_URL=http://localhost:3001/api
MONETIZATION_SMOKE_USER_PASSWORD=VoreaSmoke2026!
MONETIZATION_SMOKE_KEEP_USERS=false
```

Qué hace:

1. Crea 3 usuarios temporales.
2. Promueve uno a `PRO` y otro a `STUDIO PRO`.
3. Ejecuta consumos positivos y bloqueos esperados.
4. Limpia los usuarios al final salvo que se use `--keep-users`.

### 2. Cuentas existentes por tier

Útil cuando no se quiere usar credenciales admin.

Variables requeridas:

```bash
MONETIZATION_SMOKE_FREE_EMAIL=free@example.com
MONETIZATION_SMOKE_FREE_PASSWORD=secret
MONETIZATION_SMOKE_PRO_EMAIL=pro@example.com
MONETIZATION_SMOKE_PRO_PASSWORD=secret
MONETIZATION_SMOKE_STUDIO_EMAIL=studio@example.com
MONETIZATION_SMOKE_STUDIO_PASSWORD=secret
```

## Casos cubiertos

Consumos esperados:

- `FREE -> studio.download_stl`
- `PRO -> organic.deform`
- `STUDIO PRO -> studio.download_scad`

Bloqueos esperados:

- `FREE !-> organic.deform`
- `PRO !-> studio.download_scad`

Los costos esperados se leen en runtime desde `/api/config/business`, no están hardcodeados en el script.

## Salida esperada

Tabla markdown con:

- tier
- flujo
- balance antes
- balance después
- delta observado
- delta esperado
- resultado
- notas

## Nota operativa

La evidencia manual histórica sigue en `docs/operations/tool-credit-smoke-2026-03-27.md`.
