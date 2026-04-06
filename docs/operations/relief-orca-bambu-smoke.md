# Relief 3MF Smoke — OrcaSlicer y Bambu Studio

## Objetivo

Validar manualmente que los exports 3MF de Relief se importan, asignan colores/filamentos y slicéan de forma usable en OrcaSlicer y Bambu Studio.

Para criterios operativos, cobertura automatizada y estado consolidado por caso, usar tambien `docs/operations/relief-3mf-qa-matrix.md`.

## Alcance

Casos cubiertos en este smoke:

1. `surfaceMode=plane` con export 3MF `hybrid`.
2. `surfaceMode=cylinder` con export 3MF `slic3r-strict`.
3. export 3MF `split-objects` como fallback Bambu/Orca.

Quedan fuera de este smoke:

1. STL monocromático.
2. geometrías STL directas importadas como superficie.
3. validación visual avanzada de seam/orientación para casos artísticos complejos.

## Fixture recomendado

Usar este archivo del repo para evitar variaciones entre sesiones:

- `public/qa-assets/relief-smoke-four-zones.svg`

El fixture fuerza:

1. varias zonas de color contrastantes;
2. diferencias claras de brillo/altura;
3. un caso simple de cuantización para `4` capas.

## Artefactos reproducibles

Para no depender de la UI de Vorea en cada corrida, se pueden regenerar artefactos listos para importar con:

- `npm run qa:relief:assets`

El script deja en `public/qa-assets/relief-smoke/`:

1. `relief-plane-hybrid.3mf`
2. `relief-cylinder-slic3r-strict.3mf`
3. `relief-plane-split-objects.3mf`
4. `manifest.json` con paleta, bounds y metadata del fixture
5. `.stl` equivalentes para depuracion rapida si un slicer reporta problemas ajenos al 3MF

Si esos archivos ya fueron generados, el smoke puede correrse importandolos directo en OrcaSlicer/Bambu Studio sin volver a abrir Vorea.

## Precondiciones

1. Tener una build funcional de Vorea o una sesion local en `/relief`, o haber corrido `npm run qa:relief:assets`.
2. Tener OrcaSlicer y/o Bambu Studio instalados.
3. Tener un perfil AMS/multicolor disponible en el slicer.
4. Ejecutar el smoke con `colorZones >= 4`.
5. Mantener todas las capas exportables seleccionadas salvo que se esté validando exclusión deliberada.

## Configuración base en Vorea

### Caso A — Plano general

1. Abrir `/relief`.
2. Cargar `public/qa-assets/relief-smoke-four-zones.svg`.
3. Aplicar preset `Plano balanceado`.
4. Confirmar:
   - `surfaceMode = plane`
   - `colorZones = 4`
   - `solid = true`
   - modo 3MF = `Híbrido`
5. Generar el relieve.

### Caso B — Cilindro para Orca/Bambu

1. Mantener el mismo fixture.
2. Aplicar preset `Cilindro Bambu/Orca`.
3. Confirmar:
   - `surfaceMode = cylinder`
   - modo 3MF = `Bambu/Orca estricto`
   - `cylinderRadius = 140`
   - `cylinderHeight = 200`
   - `cylinderRepeats = 4`
4. Generar el relieve.

### Caso C — Fallback por objetos

1. Partir del caso plano o cilíndrico ya generado.
2. Cambiar el modo 3MF a `Partes por color`.
3. Exportar manteniendo todas las capas activas.

## Pasos de smoke

### 1. Export `hybrid` sobre plano

1. En Vorea, exportar 3MF desde el caso A.
2. Importar `relieve-vorea.3mf` en OrcaSlicer.
3. Importar el mismo archivo en Bambu Studio.

Alternativa reproducible:

1. Importar `public/qa-assets/relief-smoke/relief-plane-hybrid.3mf` en ambos slicers.

Validaciones esperadas:

1. El archivo abre sin error ni reparación destructiva del slicer.
2. El modelo aparece como una sola pieza principal.
3. Las capas/zonas de color quedan reconocibles.
4. El slicing completa sin desaparecer zonas ni colapsar la base.

### 2. Export `slic3r-strict` sobre cilindro

1. En Vorea, exportar 3MF desde el caso B.
2. Importar `relieve-vorea.3mf` en OrcaSlicer.
3. Importar el mismo archivo en Bambu Studio.

Alternativa reproducible:

1. Importar `public/qa-assets/relief-smoke/relief-cylinder-slic3r-strict.3mf` en ambos slicers.

Validaciones esperadas:

1. El cilindro importa sin invertir altura ni romper la envolvente.
2. La segmentación multicolor se conserva mejor que en `hybrid`.
3. Se pueden asignar filamentos/materiales a las zonas detectadas.
4. El preview de slicing no muestra caras faltantes ni superficies abiertas evidentes.

### 3. Export `split-objects`

1. En Vorea, exportar 3MF desde el caso C.
2. Importar `relieve-vorea.3mf` en OrcaSlicer.
3. Importar el mismo archivo en Bambu Studio.

Alternativa reproducible:

1. Importar `public/qa-assets/relief-smoke/relief-plane-split-objects.3mf` en ambos slicers.

Validaciones esperadas:

1. El slicer muestra múltiples objetos o partes separadas por color.
2. La cantidad visible de objetos coincide con las capas activas exportadas.
3. Cada objeto permite asignación de filamento independiente.
4. El slicing completa sin fusionar indebidamente las partes.

## Interpretación por modo

### `Híbrido`

Usarlo cuando:

1. se quiera máxima compatibilidad 3MF general;
2. el slicer soporte tanto `colorgroup` como metadata tipo slic3r.

Señales de falla:

1. importa como monocromo;
2. ignora segmentación;
3. muestra menos zonas de las esperadas.

### `Bambu/Orca estricto`

Usarlo cuando:

1. el objetivo principal sea OrcaSlicer o Bambu Studio;
2. `hybrid` no conserve bien la separación de filamentos.

Señales de falla:

1. el slicer ignora la pintura/segmentación;
2. las zonas aparecen unificadas;
3. el cilindro pierde continuidad o muestra seam incorrecto evidente.

### `Partes por color`

Usarlo cuando:

1. los otros modos no se interpreten bien en Bambu/Orca;
2. se prefiera asignación explícita por objeto.

Señales de falla:

1. el número de objetos no coincide con las capas exportadas;
2. el slicer une objetos indebidamente;
3. desaparecen partes al slicear.

## Registro mínimo del smoke

Guardar por ejecución:

1. fecha;
2. commit o branch;
3. slicer y versión;
4. caso (`plane/hybrid`, `cylinder/slic3r-strict`, `split-objects`);
5. resultado `PASS` o `FAIL`;
6. observaciones;
7. screenshot si falla.

Tambien puede completarse `docs/operations/relief-orca-bambu-smoke-results.md`.

Plantilla sugerida:

```md
| Fecha | Commit | Slicer | Caso | Resultado | Observaciones |
|---|---|---|---|---|---|
| 2026-03-26 | develop | OrcaSlicer x.y.z | plane/hybrid | PASS | Importa bien, 4 zonas visibles |
```

## Criterio de cierre de BG-110

El smoke manual puede considerarse suficiente cuando:

1. `plane/hybrid` pasa en OrcaSlicer y Bambu Studio;
2. `cylinder/slic3r-strict` pasa en OrcaSlicer y Bambu Studio;
3. `split-objects` muestra conteo de partes coherente y permite asignación por objeto;
4. no aparecen agujeros, inversiones severas ni pérdida de capas durante slicing.
