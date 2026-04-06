# Lead Magnet + Loop de Contenido Inicial — 2026-04-03

## Decisión

- Lead magnet primario: PDF breve `Guía de 3 clases para introducir diseño 3D paramétrico`.
- Asset complementario: deck corto en Canva para outreach institucional.
- Vertical primaria para el lead magnet: `Education`.
- `Makers` y `AI Creators` mantienen CTA directo a activación (`/for/makers`, `/for/ai-creators`, `/studio`, `/ai-studio`) en lugar de abrir un segundo lead magnet ahora.

## Por qué esta elección

- El playbook ya sugería explícitamente un lead magnet educativo y un deck corto para outreach institucional.
- `Education` es la vertical que más necesita una CTA consultiva y menos depende de pricing o promesas agresivas de IA.
- El producto ya tiene una superficie real de captura en `/contact`, así que se puede operar una primera versión sin construir una stack nueva.
- `Makers` hoy tiene mejor fit con activación inmediata al editor.
- `AI Creators` todavía requiere más prudencia comercial porque la narrativa pública de IA es la más sensible a claims no validados.

## Verdad operativa a respetar

### Comercial interna hoy

Según la configuración pública actual:

- `Free`: `USD 0`, `3 proyectos activos`, `1 generación IA por mes`, exportación `STL` básica.
- `Pro`: `USD 12/mes`, `20 generaciones IA por mes`, exportación `STL/OBJ/3MF`.
- `Studio Pro`: `USD 29/mes`, generaciones IA ilimitadas, exportación `SCAD`.

Fuentes:

- `server/app.ts` define planes y límites por defecto.
- `docs/operations/monetization-tier-smoke-2026-03-28.md` confirma gating por tier en local.

### Regla externa mientras no se unifique sitio + pricing

- No usar precio exacto, límites, créditos ni `ilimitado` en el lead magnet ni en su distribución paga.
- Mantener solo claims de alta confianza:
  - `100% web`
  - `diseño 3D paramétrico`
  - `IA asistida`
  - `sin instalación`
  - `empieza gratis`

## Lead magnet recomendado

### Formato

- PDF breve de 5 a 7 páginas.
- Versión espejo en deck Canva de 5 a 7 slides.

### Título recomendado

`Guía de 3 clases para introducir diseño 3D paramétrico`

### Promesa

Ayudar a docentes, coordinadores STEM y makerspaces a correr una secuencia inicial de clases usando una herramienta 3D 100% web, sin exigir instalación local.

### Contenido mínimo

1. Qué aprende el alumno en 3 clases.
2. Clase 1: introducción al modelado paramétrico en navegador.
3. Clase 2: iteración de parámetros y exportación básica.
4. Clase 3: exploración creativa con IA asistida y/o relieve sin vender automatización total.
5. Qué necesita el docente para correrlo.
6. CTA final: pedir demo, escribir al equipo o empezar gratis.

### CTA operable v1

- CTA principal: `Pedir la guía`.
- Ruta operable: `/contact` o `/contacto`.
- Implementación v1: usar asunto sugerido `Quiero la guía de 3 clases de Vorea`.
- Fulfillment v1: respuesta manual por email con PDF + deck Canva.

Esto evita bloquear la operación por falta de un formulario específico de lead magnet o una automatización de email.

## Loop mínimo de contenido

### Activo fuente

- 1 PDF principal.
- 1 deck Canva derivado del mismo contenido.

### Repurposing

1. LinkedIn carousel para docentes y coordinadores STEM.
   - Fuente: slides 1-5 del deck.
   - CTA: `Pedir la guía`.
   - Destino: `/for/education` y luego `/contact`.

2. Post corto orgánico para X / LinkedIn / comunidad.
   - Fuente: resumen de la clase 1 o clase 2.
   - Hook: `3D paramétrico para el aula sin instalar software`.
   - CTA: `Pedir la guía` o `Empieza gratis`.

3. Story o reel vertical de 20-30 segundos.
   - Fuente: misma secuencia del carousel.
   - Hook visual: `Clase 1 -> Clase 2 -> Clase 3`.
   - CTA: `/for/education`.

4. Email outbound manual a instituciones.
   - Fuente: deck Canva + párrafo resumen.
   - CTA: responder para recibir la guía o pedir demo.

5. Retargeting liviano.
   - Audiencia: visitas a `/for/education` o `/contact` sin envío completado.
   - Mensaje: `Lleva diseño 3D paramétrico al aula sin instalación`.
   - CTA: `Pedir la guía`.

## Secuencia semanal mínima

### Semana 1

- Publicar el PDF y el deck.
- Lanzar 1 carousel de LinkedIn.
- Lanzar 1 versión vertical para story/reel.
- Enviar 10 a 20 contactos manuales a instituciones o talleres.

### Semana 2+

- Reusar una clase por semana como microcontenido.
- Mantener una sola pieza nueva por vertical por semana.
- Solo abrir un segundo activo cuando el primero ya muestre interés real.

## Medición mínima

### KPI primario

- `page_view` en `/for/education`
- `landing_cta_click`
- `contact_submit`

### KPI secundarios

- `sign_up_start`
- `sign_up_complete`
- visitas a `/plans`

### Nota operativa

`contact_submit` ya se dispara desde la página de contacto, pero no aparece documentado en `docs/ga4-analytics-guide.md`. Conviene verificarlo en GA4 antes de usarlo como métrica ejecutiva semanal.

## Qué no abrir todavía

- No crear un segundo lead magnet para `Makers`.
- No crear un lead magnet centrado en `prompt -> 3D` mientras la narrativa de IA siga sensible.
- No prometer demos automáticas, plantillas descargables premium ni matrices de features por plan.

## Siguientes acciones recomendadas

1. Redactar el outline final del PDF en 1 página.
2. Producir el deck corto en Canva con el mismo contenido.
3. Crear copy único para CTA `Pedir la guía` en piezas de `Education`.
4. Preparar respuesta manual tipo email para enviar el PDF en menos de 24 horas.
5. Agregar `contact_submit` al ritual semanal de acquisition junto con `page_view`, `sign_up_start` y `sign_up_complete`.

## Blockers y supuestos

- El sitio ya tiene `/contact` operativo, pero no existe una experiencia dedicada de lead capture para este activo.
- La verdad comercial interna existe en repo, pero externamente el sitio todavía tiene inconsistencias entre landings y `/plans`, por lo que este loop debe mantenerse no cuantitativo.
- Si se destraba una capa de automatización de email o una landing específica de lead magnet, el mismo asset puede migrar a una captura más limpia sin rehacer el contenido.
