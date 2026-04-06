# Flujos de producto y negocio

## Propósito

Esta guía explica cómo se conectan la API, la monetización, AI Studio, comunidad y gamificación dentro de Vorea Studio. Está pensada para desarrollo, QA técnico, operación interna y cualquier persona que necesite entender el producto más allá del listado de endpoints.

## Cómo leer esta guía

- La referencia de rutas sigue viviendo en [la matriz de endpoints](../api/endpoint-matrix.md).
- El contrato operativo de API sigue en [OpenAPI](../../public/openapi.json).
- Esta guía describe la lógica de negocio y la secuencia real de uso.

## Mapa general

1. Identidad y sesión:
   - el usuario entra por auth clásica o login social soportado;
   - obtiene sesión y acceso a zonas privadas como perfil, AI Studio persistente y acciones protegidas.
2. Monetización:
   - los planes se ofrecen en `/plans`;
   - hoy PayPal es la integración operativa para compras únicas, suscripciones y donaciones.
3. Créditos y gating:
   - cada tier tiene permisos, límites y saldos distintos;
   - algunas acciones consumen créditos o están bloqueadas por plan.
4. Producción de contenido:
   - AI Studio genera o adapta SCAD;
   - Editor y Relief pueden terminar en publicación comunitaria.
5. Comunidad:
   - los modelos pasan por draft, publicación, likes, comentarios, forks y descargas.
6. Gamificación:
   - acciones del usuario disparan puntos, niveles y badges;
   - el resultado se refleja en perfil, perfil público y leaderboard.
7. Operación:
   - SuperAdmin y `/docs` sirven como capa de control, observabilidad y soporte.

## 1. Identidad y sesión

### Qué resuelve

- signup/signin y refresh de sesión;
- perfil privado;
- cambio o alta de contraseña para cuentas sociales;
- gating de rutas privadas.

### Flujo

1. El usuario crea cuenta o inicia sesión.
2. El frontend cachea el bearer token.
3. Las rutas protegidas usan la identidad autenticada del backend, no IDs confiados desde UI.
4. Si el usuario sale de la sesión, el estado sensible local se limpia y las zonas privadas vuelven a requerir acceso.

### Referencias

- Auth y perfil: ver [matriz API](../api/endpoint-matrix.md).
- Apoyo de producto: [manual de usuario](../manual-usuario.md).

## 2. Planes, pagos y monetización

### Estado actual

- proveedor activo de pagos: PayPal;
- suscripciones activas: `/api/subscriptions/*`;
- órdenes puntuales: `/api/paypal/*`;
- donaciones: `/api/donations/*`.

### Flujo

1. El usuario evalúa planes en `/plans`.
2. Elige compra puntual, suscripción o donación.
3. El backend crea la orden o suscripción.
4. PayPal autoriza el pago.
5. Vorea captura la orden o procesa el webhook firmado.
6. El estado del usuario se actualiza en tier, créditos, historial o insignias según el caso.

### Qué mirar

- planes y límites públicos vienen de configuración de negocio;
- la verificación de firma PayPal debe permanecer activa;
- el retorno desde PayPal debe dejar el perfil y la UI consistentes.

### Referencias

- Smoke de monetización: [monetization-tier-smoke.md](./monetization-tier-smoke.md)
- Matriz API: [endpoint-matrix.md](../api/endpoint-matrix.md)

## 3. Créditos y gating por herramienta

### Qué existe

- créditos mensuales por tier;
- packs de top-up;
- acciones protegidas por herramienta;
- consumo y bloqueo por plan o saldo.

### Reglas clave

1. No todas las acciones cuestan lo mismo.
2. Hay acciones permitidas solo para ciertos tiers.
3. Algunas funciones no cuestan créditos, pero igual están limitadas por plan.
4. AI Studio hace pre-charge y, si falla el proveedor, hace refund.

### Ejemplos

- `community.publish` limita publicación mensual en ciertos tiers.
- `makerworld.publish` puede consumir créditos.
- `ai_studio.generate` verifica saldo antes de llamar al proveedor.

### Referencias

- Config y validación de tiers: [monetization-tier-smoke.md](./monetization-tier-smoke.md)
- Rutas vivas: [endpoint-matrix.md](../api/endpoint-matrix.md)

## 4. AI Studio

### Qué hace

AI Studio toma intención cruda del usuario, la normaliza en backend, decide provider/model con el router automático y devuelve SCAD junto con metadata de routing y trazabilidad.

### Flujo

1. El usuario elige motor, familia, calidad y parámetros.
2. El frontend manda intención cruda.
3. El backend normaliza el pedido.
4. El router decide provider, model y fallback chain.
5. Se pre-consumen créditos.
6. Se llama al proveedor LLM.
7. Si falla, se intenta fallback.
8. Si la cadena completa falla, se refundean los créditos.
9. Se persiste trace y metadata para forecast, analytics y admin.

### Resultado visible

- historial de generaciones;
- recipes reutilizables;
- routing y fallback attempts en admin;
- presupuesto operativo y pricing de modelos en AI Studio CMS.

### Referencias

- Manual de usuario: [manual-usuario.md](../manual-usuario.md)
- Operación AI: [Playwright CLI (`pwcli`)](./playwright-cli-skill.md)
- Arquitectura profunda: revisar runtime/cerebro y el índice operativo.

## 5. Comunidad

### Ciclo de vida del modelo

1. Crear modelo.
2. Guardarlo como draft o publicarlo.
3. Si se publica, aplican reglas de gating y reputación.
4. El modelo publicado habilita:
   - likes;
   - comentarios;
   - descargas;
   - forks;
   - destaque editorial/admin.

### Reglas importantes

- los drafts no aceptan likes ni comentarios públicos;
- el owner puede seguir viendo sus drafts;
- publicar desde draft a published consume la regla de negocio correspondiente;
- los forks mantienen cadena de procedencia.

### Referencias

- Rutas de comunidad: [endpoint-matrix.md](../api/endpoint-matrix.md)
- Uso para creativos: [perfil creativos](../profiles/creativos.md)

## 6. Gamificación, puntos y badges

### Qué mide el sistema

- publicación de modelos;
- likes dados y recibidos;
- descargas recibidas;
- forks y fork royalties;
- niveles y badges de reputación.

### Dónde aparece

- `/leaderboard`
- `/perfil`
- `/user/:id`

### Lógica general

1. Una acción relevante dispara un reward trigger.
2. El backend suma puntos o XP.
3. Recalcula nivel.
4. Otorga badges cuando cruza umbrales.
5. Refleja el resultado en leaderboard y perfiles.

### Ejemplos de badges

- primer modelo publicado;
- diez modelos;
- cien likes;
- mil descargas;
- hitos de forks;
- badges de contribución por donaciones.

### Referencias

- API rewards: [endpoint-matrix.md](../api/endpoint-matrix.md)
- Perfiles públicos y reputación: [perfil creativos](../profiles/creativos.md)

## 7. Admin, observabilidad y documentación

### Qué existe

- panel SuperAdmin para operación, monetización, comunidad y AI Studio CMS;
- portal `/docs` accesible desde el propio panel admin;
- docs separadas por API, operaciones y perfiles.

### Uso recomendado

1. Cambios de contrato: revisar [matriz API](../api/endpoint-matrix.md) y OpenAPI.
2. Cambios de operación: revisar [índice operativo](./README.md).
3. Cambios de negocio/producto: revisar esta guía.
4. Validación UI: usar [Playwright CLI (`pwcli`)](./playwright-cli-skill.md).

## Fuente de verdad por tema

- API: [endpoint-matrix.md](../api/endpoint-matrix.md)
- Inconsistencias técnicas: [inconsistencies.md](../api/inconsistencies.md)
- Operación: [README operaciones](./README.md)
- Ayuda funcional al usuario: [manual-usuario.md](../manual-usuario.md)
- Perfil desarrollo: [desarrolladores.md](../profiles/desarrolladores.md)

