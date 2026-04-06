# Plan Operativo — Publicación, URLs limpias y SEO

Fecha: 2026-03-22

## 1. Estado actual

### Código del repo

El repo ya soporta:

1. Rutas limpias con History API en frontend.
2. Compatibilidad con enlaces legacy `/#/...`.
3. Retornos PayPal limpios hacia `/perfil?...`.
4. SEO server-side útil cuando el HTML se sirve desde `server/server.ts`:
   - `title`
   - `description`
   - `canonical`
   - Open Graph / Twitter
   - `robots.txt`
   - `sitemap.xml`

### Publicación actual detectada

El dominio `voreastudio3d.com` hoy se comporta como SPA estática en Netlify:

1. `/ai-studio` carga la landing y no la vista correcta.
2. `/#/ai-studio` sí funciona.
3. `/robots.txt` y `/sitemap.xml` devuelven `index.html`.
4. El shim publicado de PayPal sigue redirigiendo a `/#/perfil`.

Conclusión:

- El código nuevo está listo.
- La publicación activa todavía no está sirviendo esa versión o sigue anclada al modo SPA estático viejo.

## 2. Lo que el código nuevo necesita para verse en producción

La mejora completa de URLs + SEO solo aparece si el tráfico público entra por un runtime que pueda:

1. responder deep links limpios;
2. inyectar metadata por ruta antes de enviar HTML;
3. responder recursos reales para `robots.txt` y `sitemap.xml`.

En este repo eso ya existe en `server/server.ts`.

## 3. Opción recomendada

### Opción A — Servir frontend público desde Node

Recomendación principal.

Decisión tomada el 2026-03-23:

- `BG-108` avanza oficialmente por esta opción.

Publicar la app web desde el mismo runtime Node que ya soporta:

1. `npm run build`
2. `NODE_ENV=production npm start`
3. serving de `dist/`
4. fallback SPA
5. inyección SEO server-side

### Ventajas

1. Aprovecha exactamente el trabajo ya implementado.
2. No exige duplicar lógica SEO en Netlify Edge.
3. Permite `robots.txt`, `sitemap.xml` y metadata dinámica sin hacks.
4. Reduce divergencia entre local/prod.

### Desventajas

1. Requiere que el dominio principal apunte a ese runtime.
2. Aumenta responsabilidad del server Node para tráfico público.
3. Puede requerir mover o unificar la topología actual `frontend static + api subdomain`.

### Candidatos de hosting

1. Railway
2. Render
3. cualquier host Node con dominio custom

### Topología objetivo recomendada

1. `voreastudio3d.com` y `www.voreastudio3d.com` apuntan al runtime Node público.
2. Ese runtime sirve:
   - frontend desde `dist`
   - `/api/*`
   - SEO server-side
   - `robots.txt`
   - `sitemap.xml`
   - `og/default.svg`
3. `api.voreastudio3d.com` pasa a ser opcional:
   - puede quedar como alias técnico del mismo servicio;
   - o mantenerse solo durante transición/compatibilidad.

### Cutover exacto recomendado

1. Desplegar la rama/merge objetivo en Railway con `FRONTEND_URL=https://voreastudio3d.com`.
2. Confirmar en el host temporal de Railway:
   - `/api/health`
   - `/robots.txt`
   - `/sitemap.xml`
   - `/ai-studio`
   - `/noticias`
3. Asignar `voreastudio3d.com` al servicio Node.
4. Asignar `www.voreastudio3d.com` al mismo servicio o redirigir a raíz.
5. Mantener `api.voreastudio3d.com` durante la transición si todavía hay terceros o dashboards usándolo.
6. Repetir smoke técnico con:
   - `npm run verify:deploy:routing-seo -- https://voreastudio3d.com`
7. Ejecutar smoke manual:
   - deep links;
   - refresh;
   - PayPal sandbox;
   - Google sign-in.

Checklist operativa dedicada:

- `docs/operations/railway-node-cutover-checklist.md`

### Ejecución práctica desde este entorno

Mientras no haya acceso directo a Railway dashboard o DNS:

1. `voreastudio3d.com` puede cortar tráfico al runtime Node usando Netlify como reverse proxy temporal.
2. El bridge se apoya en `api.voreastudio3d.com` como host público del runtime Railway.
3. El objetivo final no cambia:
   - retirar Netlify del path público;
   - dejar `voreastudio3d.com` apuntando directo al runtime Node;
   - retirar `api.` al cerrar la transición.

### Rollback recomendado

Si el cutover falla:

1. restaurar el dominio principal al frontend estático previo;
2. mantener la API en el host estable actual;
3. dejar trazado el motivo del rollback en handoff;
4. no tocar la rama `codex/rollback/*`, usar solo el rollback de publicación.

## 4. Opción alternativa si se mantiene Netlify

### Opción B — Netlify estático + Edge/Prerender

Mantener Netlify solo es viable si se agrega una capa SEO específica.

Hace falta:

1. seguir usando rutas limpias en frontend;
2. mantener rewrites SPA;
3. excluir `/api/*`, assets, docs y archivos reales del fallback;
4. servir `robots.txt` y `sitemap.xml` como archivos reales o por edge;
5. prerender o inyectar metadata por ruta pública en edge.

### Trabajo extra mínimo

1. generar `robots.txt` real en build;
2. generar `sitemap.xml` real en build o por función edge;
3. crear una Edge Function para rutas públicas:
   - `/`
   - `/comunidad`
   - `/planes`
   - `/noticias`
   - `/noticias/:slug`
   - `/modelo/:id/:slug?`
   - `/user/:id/:slug?/modelos`
   - `/terminos`
   - `/privacidad`
   - `/contacto`
4. devolver `noindex` en:
   - `/studio`
   - `/ai-studio`
   - `/perfil`
   - `/admin`
   - `/feedback-admin`

### Riesgo

La lógica se duplica:

1. una versión en Node;
2. otra versión para Netlify.

Eso encarece mantenimiento y QA.

### Avance ya implementado en el repo

Sin cambiar de infraestructura todavía, el build ahora genera en `dist`:

1. `robots.txt`
2. `sitemap.xml`
3. `og/default.svg`

Esto mejora el deploy estático actual porque deja de servir `index.html` para esos recursos si el host publica archivos reales de `dist`.

Límite actual:

1. la metadata por ruta pública (`canonical`, OG por detalle, etc.) sigue requiriendo Node o Edge;
2. `noindex` por ruta privada (`/ai-studio`, `/perfil`, etc.) sigue requiriendo Node o Edge.

## 5. Recomendación de decisión

### Si el objetivo es velocidad y consistencia

Elegir Opción A.

Motivo:

- ya está implementada;
- es la ruta más corta a producción correcta;
- minimiza deuda.

### Si el objetivo es conservar Netlify sí o sí

Elegir Opción B, asumiendo una iniciativa adicional específica de edge/prerender.

## 6. Impacto en terceros

### PayPal

Ya se actualizó en código a:

1. `return_url -> /perfil?...`
2. `cancel_url -> /perfil?...`

Checklist post deploy:

1. success de créditos
2. cancelled de créditos
3. success de suscripción
4. cancelled de suscripción
5. limpieza de query params tras retorno

### Google Identity

Impacto bajo.

Checklist:

1. verificar `Authorized JavaScript origins`
2. verificar login desde rutas profundas

### Search Console

Después de publicar:

1. registrar `sitemap.xml`
2. pedir reindexación de:
   - `/`
   - `/comunidad`
   - `/planes`
   - `/noticias`

## 7. Smoke checklist post deploy

Comando rápido del repo:

```bash
npm run verify:deploy:routing-seo -- https://voreastudio3d.com
```

Opcional para forzar API alternativa:

```bash
$env:VOREA_VERIFY_API_BASE_URL="https://api.voreastudio3d.com"
npm run verify:deploy:routing-seo -- https://voreastudio3d.com
```

### Navegación

1. `/ai-studio`
2. `/studio?mode=parametric`
3. `/perfil`
4. `/modelo/:id/:slug`
5. `/user/:id/:slug/modelos`
6. `/noticias/:slug`
7. refresh en cada una
8. back/forward

### SEO

1. `curl /robots.txt` devuelve texto, no HTML
2. `curl /sitemap.xml` devuelve XML, no HTML
3. `view-source:/noticias` contiene `canonical`
4. `view-source:/ai-studio` contiene `noindex`
5. si `robots.txt` falla pero `robots.txt?fresh=1` responde texto correcto, tratarlo como residuo de caché en Cloudflare y purgar esa ruta antes de repetir el smoke

### Compatibilidad legacy

1. `/#/ai-studio` normaliza a `/ai-studio`
2. `/#/perfil` normaliza a `/perfil`

## 8. Estado recomendado del backlog

1. Considerar “deploy público compatible con SEO server-side” como subtarea explícita de `BG-108`.
2. Mantener smoke de PayPal y refresh/deep-link como gate de release.
3. Tratar `voreastudio3d.com` como dominio canónico y `www.voreastudio3d.com` como redirect de borde si el plan de Railway no permite un tercer custom domain.
