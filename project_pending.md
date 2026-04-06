# Pendientes Conversados

Fecha: 2026-03-15

## P0 - Relief / Export 3MF

- Mejorar el modo `Partes por color` para Bambu:
  - controlar mejor qué caras caen en cada parte (evitar mezclas en zonas límite)
  - agregar opción de tolerancia de asignación por color
  - agregar verificación visual de partes antes de exportar
- Evaluar exportación 3MF "nativa Bambu" (si se confirma estructura/proyecto aceptada) para mantener color/material de forma más directa.

## P1 - Relief UX

- Paleta previa (ya implementada) - mejoras pendientes:
  - permitir bloquear/editar selección de colores antes de generar
  - mostrar porcentaje de cobertura estimada por color en la imagen
- Modo cilindro (ya implementado) - mejoras pendientes:
  - control de orientación inicial del "seam" (ángulo 0)
  - opción de relieve hacia adentro / hacia afuera
  - opción de tapa superior/inferior configurable
  - optimización de malla para cilindros altos con muchas subdivisiones

## P1 - Validación y pruebas

- Agregar pruebas automáticas para:
  - `surfaceMode=plane` vs `surfaceMode=cylinder`
  - export 3MF en modos `hybrid`, `slic3r-strict`, `split-objects`
  - conteo de objetos en `split-objects`
- Ejecutar el smoke manual ya documentado para Orca y Bambu (`docs/operations/relief-orca-bambu-smoke.md`) usando, si conviene, los artefactos reproducibles de `npm run qa:relief:assets`.

## P2 - Motor SCAD (recordatorio)

- Desglosar el intérprete SCAD en módulos claros:
  - parser/AST
  - normalización/transform passes
  - evaluator/runtime
  - generación de geometría
- Incorporar métricas internas:
  - tiempos por etapa
  - nodos evaluados
  - memoria estimada por escena
- Definir puntos de extensión para futuras optimizaciones (cache incremental, paralelización por subárboles, fallback selectivo).

## P2 - Documentación

- Documentar en README:
  - flujo de Relief plano/cilindro
  - diferencias de exportación 3MF por modo
  - recomendaciones por slicer (Orca/Bambu/otros)
