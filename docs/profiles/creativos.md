# Guía por Perfil — Creativos

## Objetivo

Publicar y mantener modelos en Comunidad con control visual, feedback y monetización sin bloquear el flujo creativo.

## Flujo recomendado

1. Crear o editar modelo.
2. Si se trabaja desde AI Studio, guardar `recipes`, usar el historial persistido para comparar variantes SCAD y `Reaplicar` una generación previa como base editable.
3. Cargar imagen principal y galería (`/api/uploads/community-image`).
4. Publicar en Comunidad (`/api/community/models`).
5. Revisar detalle y comentarios (`/api/community/models/:id`, `/comments`).
6. Medir interacción (likes, descargas, forks) y mejorar iterativamente.
7. Compartir links públicos con rutas limpias (`/modelo/:id/:slug`, `/user/:id/:slug/modelos`) para difusión o portfolio.
8. Si el flujo pasa por Relief multicolor, validar el 3MF en el slicer objetivo:
   - `Híbrido` para compatibilidad general.
   - `Bambu/Orca estricto` para Orca/Bambu.
   - `Partes por color` como fallback por objetos.

## Reglas de visibilidad importantes

1. Drafts son privados (dueño/superadmin).
2. Interacciones públicas (like/download/comment) aplican sobre modelos publicados.
3. El estado del modelo impacta distribución, descubrimiento y engagement.

## Buenas prácticas de contenido

1. Portada clara y 2-5 imágenes de soporte.
2. Título descriptivo + tags específicos.
3. Descripción con contexto de uso, tolerancias y recomendaciones de impresión.
4. Responder comentarios con foco en mejoras y variantes.
5. Para validar exportes de Relief antes de compartirlos, seguir `docs/operations/relief-orca-bambu-smoke.md`.

## Límites y gating

1. Validar créditos disponibles antes de acciones premium.
2. Respetar límites de subida de imagen por plan/tier.
3. Revisar políticas de Comunidad antes de publicar contenido sensible.
