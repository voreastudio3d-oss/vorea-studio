# Capability Map

Usar este archivo como matriz de soporte antes de prometer formatos, imports o exportes del pipeline 3D.

## Soporte verificado hoy

- `SCAD`
  - El repo ya genera y consume SCAD dentro del pipeline parametrico y del editor.
  - Revisar `src/app/parametric/*`, `src/app/engine/scad-interpreter.ts` y `server/mcp-tools.ts`.
- `PNG`, `JPG`, `JPEG`, `WEBP`
  - Estan conectados al flujo de Relief y al registro de imagenes raster.
  - Revisar `src/app/pages/Relief.tsx` y `src/app/engine/image-registry.ts`.
- `surface("archivo")`
  - Existe en `src/app/engine/scad-interpreter.ts` y usa imagenes registradas por nombre.
  - Tratarlo como flujo raster, no como import vectorial.
- `STL`
  - Export binario presente en `src/app/engine/threemf-exporter.ts`.
- `3MF`
  - Export con color encoding y rotacion para slicers presente en `src/app/engine/threemf-exporter.ts`.
- `GCODE`
  - Slicing y generacion presentes en `src/app/engine/slicer.ts` y `src/app/engine/fullcontrol.ts`.
- `Three.js` o `WebGL`
  - Preview y render presentes en `src/app/engine/threejs-renderer.ts` y `src/app/engine/mesh-renderer.ts`.

## Verificar antes de prometer

- `OBJ`
  - Hay copy y planes que lo mencionan, pero no hay exportador o importador verificado en `src/app/engine/`.
- `SVG` directo como textura o upload de usuario
  - `Relief.tsx` usa SVG inline solo para previews internas.
  - El input de archivo actual acepta raster (`image/png,image/jpeg,image/jpg,image/webp`), no carga directa de SVG.
- `F3D`
  - Hay labels o credit actions que lo mencionan en `server/app.ts`, pero no hay engine ni exportador verificado.
- Import de `STL`, `3MF` u `OBJ`
  - Verificar en codigo antes de asumir ingest o edicion round-trip.

## Regla operativa

- Si el formato o la tecnica no esta en la lista de soporte verificado, tratarlo como roadmap, preprocesado externo o nueva implementacion.
- Si hace falta conversion previa, explicitarla:
  - rasterizacion para flujos tipo Relief o `surface()`;
  - nuevo exportador/importador para formatos no implementados;
  - nueva familia o nuevo generador cuando el pedido sea geometrico y no solo de formato.
