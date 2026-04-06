# Relief y export 3MF — matriz QA

## Objetivo

Consolidar en un solo lugar la cobertura automatizada, los artefactos reproducibles y la validación real en slicers para el frente Relief/3MF de [EMP-12](/EMP/issues/EMP-12) dentro del cierre mayor de [EMP-4](/EMP/issues/EMP-4).

## Resumen actual

- El caso `plane/hybrid` tiene cobertura automatizada, artefactos reproducibles y evidencia real de import/slicing en OrcaSlicer y Bambu Studio.
- Los casos `cylinder/slic3r-strict` y `plane/split-objects` siguen abiertos: la evidencia real disponible reporta mallas no manifold y bordes abiertos.
- La matriz sirve como criterio operativo para decidir si un cambio nuevo mantiene el baseline o realmente destraba el frente.

## Artefactos y comandos base

- Fixture recomendado: `public/qa-assets/relief-smoke-four-zones.svg`
- Generador reproducible de artefactos: `npm run qa:relief:assets`
- Salida reproducible: `public/qa-assets/relief-smoke/manifest.json`
- Smoke manual: `docs/operations/relief-orca-bambu-smoke.md`
- Evidencia histórica de slicers: `docs/operations/relief-orca-bambu-smoke-results.md`
- Guardrails automatizados:
  - `src/app/engine/__tests__/heightmap-generator.test.ts`
  - `src/app/engine/__tests__/threemf-exporter.test.ts`
  - `src/app/engine/__tests__/mesh-inspector.test.ts`
  - `src/app/engine/__tests__/mesh-repair.test.ts`

## Criterios de aceptación por capa

| Capa | Qué debe probar | Evidencia mínima |
|---|---|---|
| Generación Relief | `plane` y `cylinder` producen geometría con bounds y conteo de caras esperables | `heightmap-generator.test.ts` |
| Inspección de malla | bordes abiertos, non-manifold y degenerados se detectan sin ambigüedad | `mesh-inspector.test.ts` |
| Reparación | existe fallback explícito cuando Manifold falla por construcción directa | `mesh-repair.test.ts` |
| Export 3MF | el paquete 3MF contiene archivos obligatorios y metadata de color según el modo | `threemf-exporter.test.ts` |
| Artefactos reproducibles | los tres casos base se regeneran con manifest, STL y 3MF | `npm run qa:relief:assets` |
| Slicer real | Orca/Bambu importan y slicéan sin reparar destructivamente ni perder segmentación | `relief-orca-bambu-smoke-results.md` |

## Matriz por caso real

| Caso | Artefacto base | Cobertura automatizada asociada | Criterio de aceptación | Evidencia real Orca/Bambu | Estado actual |
|---|---|---|---|---|---|
| `plane/hybrid` | `public/qa-assets/relief-smoke/relief-plane-hybrid.3mf` | `heightmap-generator.test.ts` valida `surfaceMode=plane`; `threemf-exporter.test.ts` valida paquete 3MF + `colorgroup` + `slic3rpe`; `mesh-inspector.test.ts` cubre detección de topología rota | Importa como una pieza principal, conserva 4 zonas reconocibles y completa slicing sin colapsar base ni perder capas | `docs/operations/relief-orca-bambu-smoke-results.md` registra `PASS con warning` en OrcaSlicer 1.0.0.0 y Bambu Studio 02.02.02.56; ambos reportan `manifold = yes`, `number_of_parts = 1` | `PASS con warning` |
| `cylinder/slic3r-strict` | `public/qa-assets/relief-smoke/relief-cylinder-slic3r-strict.3mf` | `heightmap-generator.test.ts` valida bounds cilíndricos; `threemf-exporter.test.ts` cubre metadata `slic3rpe`; `mesh-repair.test.ts` documenta fallback si la topología requiere corrección | Importa sin invertir altura, conserva segmentación MMU, no muestra caras faltantes y mantiene `manifold = yes` en slicer | `docs/operations/relief-orca-bambu-smoke-results.md` registra `FAIL` en Orca y Bambu con `manifold = no`, `open_edges = 294`, `number_of_parts = 1` | `FAIL` |
| `plane/split-objects` | `public/qa-assets/relief-smoke/relief-plane-split-objects.3mf` | `threemf-exporter.test.ts` valida `split-objects`; `mesh-inspector.test.ts` y `mesh-repair.test.ts` cubren diagnóstico/recuperación de topología; `qa:relief:assets` deja el baseline listo para importar | El slicer reconoce objetos separados por color, el conteo coincide con capas activas y cada objeto sigue siendo imprimible/manifold | `docs/operations/relief-orca-bambu-smoke-results.md` registra `FAIL` en Orca y Bambu con conjunto principal `manifold = no`, `open_edges = 596`, `number_of_parts = 2` y sub-objetos extra no manifold | `FAIL` |

## Reglas operativas de uso

1. Si falla un test automatizado de Relief/3MF, no avanzar al smoke manual.
2. Si `npm run qa:relief:assets` cambia geometría, paleta o bounds de un caso base, actualizar `manifest.json` y repetir el smoke real para ese caso.
3. Si Orca/Bambu reportan `manifold = no` u `open_edges > 0`, el caso no puede marcarse como cerrado aunque el import visual parezca usable.
4. `plane/hybrid` funciona hoy como baseline de control; cualquier regresión ahí bloquea el frente completo.
5. `cylinder/slic3r-strict` y `plane/split-objects` siguen siendo los casos que deben destrabarse en [EMP-4](/EMP/issues/EMP-4).

## Próximos pasos sugeridos

1. Usar esta matriz como checklist obligatoria en cada fix de Relief/3MF.
2. Cuando se toque el pipeline cilíndrico o la separación por objetos, rerun mínimo:
   - `npm run qa:relief:assets`
   - `npm run test -- src/app/engine/__tests__/heightmap-generator.test.ts src/app/engine/__tests__/threemf-exporter.test.ts src/app/engine/__tests__/mesh-inspector.test.ts src/app/engine/__tests__/mesh-repair.test.ts`
3. Si un cambio hace pasar `cylinder/slic3r-strict` o `split-objects`, anexar una nueva entrada fechada en `docs/operations/relief-orca-bambu-smoke-results.md`.
