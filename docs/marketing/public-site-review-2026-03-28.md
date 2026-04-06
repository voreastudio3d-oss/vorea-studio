# Revisión del Sitio Público 2026-03-28

## Alcance

Revisión manual de la web pública el 2026-03-28 sobre:

- `https://voreastudio3d.com/for/makers`
- `https://voreastudio3d.com/for/ai-creators`
- `https://voreastudio3d.com/for/education`
- `https://voreastudio3d.com/plans`

Se complementó con inspección del DOM renderizado mediante Playwright.

## Qué está bien para marketing

- Las tres landings verticales tienen foco claro y una promesa entendible.
- El hero de cada landing está bien orientado al público:
  - Makers: rapidez y exportación para impresión 3D
  - AI creators: prompt a modelo 3D sin saber CAD
  - Education: uso en aula sin instalación
- La arquitectura de CTA es consistente:
  - CTA principal hacia editor o AI Studio
  - CTA secundario hacia planes
- El sitio transmite bien estos diferenciales:
  - 100% navegador
  - modelado paramétrico
  - IA aplicada al flujo
  - exportación a formatos 3D
  - comunidad y MakerWorld

## Hallazgo crítico

Hay una inconsistencia comercial visible entre landings verticales y página de planes.

### Lo que dicen las landings verticales

En `makers`, `ai-creators` y `education` se observa:

- `Free`: `5 generaciones/día` o copy equivalente
- `Pro`: `USD 4/mes`
- `Pro`: `generaciones ilimitadas + todos los formatos`

### Lo que dice la página de planes

En `https://voreastudio3d.com/plans` se observa:

- `Pro`: `USD 12/mes`
- `Pro`: `20 generaciones IA por mes`
- `Free`: `1 generaciones IA por mes`
- `Free`: `6 exportaciones GCode`

### Riesgo

Si la campaña usa el mensaje de las landings y el usuario llega a `/plans`, la percepción puede ser:

- "Me prometieron `USD 4/mes` y aquí dice `USD 12/mes`."
- "Me prometieron ilimitado y aquí dice `20 por mes`."
- "Me dijeron `5 generaciones/día` y aquí dice `1 por mes`."

Esto es un riesgo directo de:

- caída de conversión
- pérdida de confianza
- tickets de soporte
- reclamos por publicidad inconsistente

## Lectura por landing

### Makers

Fortalezas:

- Hero muy claro: diseño paramétrico en navegador para makers
- Buen listado de herramientas
- Beneficios concretos y entendibles

Observación:

- La promesa es fuerte y usable para ads, pero está más "aspiracional/comercial" que la página de planes.

### AI Creators

Fortalezas:

- Muy buena propuesta de valor: `De texto a modelo 3D sin saber CAD`
- El flujo en 4 pasos simplifica la venta
- Excelente para reels y anuncios demo

Observación:

- Es probablemente la landing con mejor narrativa publicitaria hoy.

### Education

Fortalezas:

- Mensaje claro para docentes
- Comparativa contra TinkerCAD útil para performance y outbound
- El enfoque "sin instalar software" está muy bien elegido

Observación:

- Para campañas B2B/educación conviene sumar una CTA más consultiva además de `Ver Planes`, por ejemplo demo, guía o contacto institucional.

### Plans

Fortalezas:

- La comparación detallada ayuda a justificar upgrade
- La tabla es más precisa que las landings en varios puntos

Observación:

- Comercialmente no está alineada con lo que prometen las landings verticales.

## Recomendación inmediata antes de pautar

Elegir una sola verdad comercial y aplicarla a:

1. landings verticales
2. página de planes
3. anuncios
4. copies orgánicos

## Recomendación de campaña mientras no se unifique

Si hoy hubiera que lanzar tráfico pago antes de corregir pricing/mensajes:

- usar como CTA principal `Probar gratis` o `Abrir editor`
- evitar en anuncios mencionar precio exacto de `Pro`
- evitar prometer `ilimitado`
- evitar prometer cantidades exactas de generaciones
- vender principalmente:
  - navegador
  - flujo 3D
  - IA
  - personalización
  - exportación

## Mensajes seguros hoy

- `Diseño 3D paramétrico desde tu navegador`
- `De prompt a modelo 3D`
- `Sin instalar software`
- `Empieza gratis`
- `Exporta tu modelo cuando esté listo`

## Mensajes a pausar hasta unificar

- `Pro por USD 4/mes`
- `Generaciones ilimitadas`
- `5 generaciones/día`
- cualquier promesa cuantitativa que choque con `/plans`
