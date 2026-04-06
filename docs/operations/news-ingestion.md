# Operación del módulo de noticias 3D

## Resumen

- Fuente de verdad: PostgreSQL (`news_sources`, `news_articles`, `news_ingestion_runs`)
- Ingesta: `POST /api/internal/news/ingest`
- Cleanup: `POST /api/internal/news/cleanup`
- Protección: header `x-news-cron-secret: <NEWS_CRON_SECRET>`
- Scheduler recomendado:
  - ingesta: `5 */6 * * *` UTC
  - cleanup: `30 3 * * *` UTC

## Scripts manuales

```bash
npm run news:seed-sources
npm run news:ingest
npm run news:cleanup
```

## Variables de entorno

- `NEWS_CRON_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (default `gemini-2.5-flash`)
- `NEWS_MAX_ITEMS_PER_SOURCE` (default `6`)

## Política editorial

- Se almacena solo `resumen propio + link`.
- No se republica el cuerpo completo de la noticia original.
- La ingesta genera versión editorial en `es` y `en` para cada artículo.
- El frontend puede pedir `GET /api/news?lang=es|en&sourceLanguage=es|en`.
- Si Gemini falla, el sistema genera un fallback saneado para no cortar el cron.

## Allow-list inicial

- 3DPrint.com
- 3D Printing Industry
- Fabbaloo
- DEVELOP3D
- VoxelMatters
- 3Dnatives (EN)
- 3Dnatives ES

Fuentes adicionales catalogadas:

- Macrotec Uruguay (`news_sources`, deshabilitada por defecto mientras CloudFront devuelva `403` a la ingesta automatizada)

Fuentes de comunidad quedan cargadas en `news_sources`, pero deshabilitadas por defecto hasta validar estructura estable.
