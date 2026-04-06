# Relief Smoke Log

Usar esta plantilla despues de generar los artefactos con `npm run qa:relief:assets` y ejecutar el smoke en OrcaSlicer y Bambu Studio.

La lectura consolidada de cobertura, criterios y estado por caso vive en `docs/operations/relief-3mf-qa-matrix.md`.

## Casos base

- `public/qa-assets/relief-smoke/relief-plane-hybrid.3mf`
- `public/qa-assets/relief-smoke/relief-cylinder-slic3r-strict.3mf`
- `public/qa-assets/relief-smoke/relief-plane-split-objects.3mf`

## Registro

| Fecha | Commit | Slicer | Caso | Resultado | Observaciones |
|---|---|---|---|---|---|
| 2026-03-27 | develop (workspace local) | OrcaSlicer 1.0.0.0 (FileVersionRaw) | plane/hybrid | PASS con warning | `--info` carga el 3MF y reporta `manifold = yes`, `number_of_parts = 1`. El CLI emite `calc_exclude_triangles` al inicializar la placa, pero no invalida el modelo. |
| 2026-03-27 | develop (workspace local) | Bambu Studio 02.02.02.56 | plane/hybrid | PASS con warning | `--info` reporta `manifold = yes`, `number_of_parts = 1`. También aparece `Unable to create plate triangles` al inicializar la placa. |
| 2026-03-27 | develop (workspace local) | OrcaSlicer 1.0.0.0 (FileVersionRaw) | cylinder/slic3r-strict | FAIL | `--info` reporta `manifold = no`, `open_edges = 294`, `number_of_parts = 1`. |
| 2026-03-27 | develop (workspace local) | Bambu Studio 02.02.02.56 | cylinder/slic3r-strict | FAIL | `--info` reporta `manifold = no`, `open_edges = 294`, `number_of_parts = 1`; además aparece `Unable to create plate triangles`. |
| 2026-03-27 | develop (workspace local) | OrcaSlicer 1.0.0.0 (FileVersionRaw) | split-objects | FAIL | `--info` reporta el conjunto principal con `manifold = no`, `open_edges = 596`, `number_of_parts = 2`, y además sub-objetos adicionales no manifold (`open_edges = 950/716/316`). |
| 2026-03-27 | develop (workspace local) | Bambu Studio 02.02.02.56 | split-objects | FAIL | `--info` reporta el conjunto principal con `manifold = no`, `open_edges = 596`, `number_of_parts = 2`, con sub-objetos adicionales no manifold (`open_edges = 950/716/316`) y warning de placa. |
