# Checklist Operativo — Cutover Railway para Frontend Público Node

Fecha: 2026-03-23

Objetivo:

- mover `voreastudio3d.com` a un runtime Node que ejecute `server/server.ts`;
- dejar `BG-108` activo en producción con rutas limpias + SEO server-side;
- conservar una vía de rollback rápida si el corte falla.

## 1. Precondiciones obligatorias

Confirmar antes de tocar Railway o DNS:

1. La rama/commit objetivo ya contiene:
   - rutas limpias;
   - SEO server-side;
   - `robots.txt`;
   - `sitemap.xml`;
   - smoke script `verify:deploy:routing-seo`.
2. La build local está en verde:
   - `npm run test`
   - `npm run build`
3. La rama a publicar está empujada a remoto.
4. Hay acceso operativo a:
   - Railway
   - DNS del dominio
   - PayPal Developer
   - Google Cloud Console

## 2. Configuración objetivo en Railway

Servicio objetivo:

1. usar el servicio Node que ya ejecuta `server/server.ts`;
2. mantener PostgreSQL conectado al mismo entorno;
3. publicar con `FRONTEND_URL=https://voreastudio3d.com`.

Variables mínimas a revisar:

1. `NODE_ENV=production`
2. `PORT=3001`
3. `FRONTEND_URL=https://voreastudio3d.com`
4. `VITE_API_URL=/api`
5. `DATABASE_URL`
6. `JWT_SECRET`
7. `ENCRYPTION_MASTER_KEY`
8. `GOOGLE_CLIENT_ID`
9. `GOOGLE_CLIENT_SECRET`
10. `PAYPAL_CLIENT_ID`
11. `PAYPAL_CLIENT_SECRET`
12. `PAYPAL_MODE`
13. `PAYPAL_WEBHOOK_ID`
14. `PAYPAL_*_PLAN_ID`
15. `RESEND_API_KEY`

## 3. Dry run antes del dominio

Usar primero el dominio temporal de Railway.

Checklist:

1. Deploy del commit objetivo.
2. Confirmar:
   - `GET <railway-url>/api/health`
   - `GET <railway-url>/robots.txt`
   - `GET <railway-url>/sitemap.xml`
   - `GET <railway-url>/ai-studio`
   - `GET <railway-url>/noticias`
3. Validar HTML server-side:
   - `/noticias` contiene `canonical`
   - `/ai-studio` contiene `noindex`
4. Validar smoke:

```bash
npm run verify:deploy:routing-seo -- <railway-url>
```

Criterio:

- no avanzar a DNS si este smoke no pasa.

## 4. Cutover de dominio

Orden exacto recomendado:

1. En Railway, agregar custom domain:
   - `voreastudio3d.com`
2. Si el plan de Railway no permite más custom domains, dejar `www` fuera de Railway y resolverlo en Cloudflare con redirect a `https://voreastudio3d.com`.
3. Configurar DNS según Railway:
   - apex/root según instrucciones del proveedor
   - `www` como CNAME o redirección
4. Esperar propagación.
5. Revalidar HTTPS/SSL emitido por Railway.
6. Si `robots.txt` sigue devolviendo HTML viejo pero `robots.txt?fresh=1` devuelve texto correcto, hacer purge de caché en Cloudflare para `/robots.txt` antes de cerrar el smoke.

## 5. Compatibilidad y transición

Durante la transición:

1. mantener `api.voreastudio3d.com` si sigue siendo útil para:
   - dashboards;
   - callbacks;
   - herramientas internas;
   - smoke comparativo.
2. considerar `api.voreastudio3d.com` como alias técnico, no como arquitectura objetivo del frontend.
3. no desmontar Netlify hasta completar smoke final.

## 6. Verificaciones post-cutover

### Smoke técnico

Ejecutar:

```bash
npm run verify:deploy:routing-seo -- https://voreastudio3d.com
```

Esperado:

1. `robots.txt` PASS
2. `sitemap.xml` PASS
3. `public canonical` PASS
4. `private noindex` PASS
5. `api health` PASS

Nota:

- si todos los checks pasan salvo `robots.txt`, revisar primero si Cloudflare está devolviendo un `HIT` viejo;
- una señal clara es que `robots.txt?fresh=1` responde bien y `robots.txt` no;
- en ese caso, purgar `/robots.txt` y volver a correr el smoke.

### Smoke manual

Verificar manualmente:

1. `https://voreastudio3d.com/`
2. `https://voreastudio3d.com/ai-studio`
3. `https://voreastudio3d.com/perfil`
4. `https://voreastudio3d.com/noticias`
5. `https://voreastudio3d.com/noticias/<slug>`
6. `https://voreastudio3d.com/modelo/<id>/<slug>`
7. `https://voreastudio3d.com/user/<id>/<slug>/modelos`
8. refresh en cada ruta
9. back/forward

### Compatibilidad legacy

1. `https://voreastudio3d.com/#/ai-studio` debe normalizar a `/ai-studio`
2. `https://voreastudio3d.com/#/perfil` debe normalizar a `/perfil`

## 7. Terceros

### PayPal

Verificar:

1. retorno exitoso de compra de créditos
2. retorno cancelado de compra de créditos
3. retorno exitoso de suscripción
4. retorno cancelado de suscripción
5. limpieza de query params en `/perfil`

### Google

Verificar:

1. login desde homepage
2. login desde ruta profunda
3. `Authorized JavaScript origins` incluye:
   - `https://voreastudio3d.com`
   - `https://www.voreastudio3d.com`

## 8. Rollback

Si falla el cutover:

1. restaurar el dominio principal al frontend estático previo;
2. confirmar que la API siga disponible en el host estable;
3. dejar capturas/logs/evidencia del fallo;
4. registrar en handoff:
   - qué falló;
   - si fue DNS, SSL, routing, PayPal, o SEO;
   - siguiente acción recomendada.

No usar ramas `codex/rollback/*` para rollback de infraestructura.

## 9. Evidencia mínima a guardar

1. resultado de:
   - `npm run verify:deploy:routing-seo -- https://voreastudio3d.com`
2. URLs verificadas manualmente
3. estado de PayPal sandbox
4. estado de Google login
5. timestamp del cutover
6. decisión de mantener o desactivar Netlify
