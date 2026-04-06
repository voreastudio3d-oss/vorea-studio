# Auditoría de abuso y hardening operativo — 2026-04-01

## Resumen ejecutivo
Se auditó el backend de Vorea Studio con foco en abuso de servicios, drenaje de costo, saturación y spam. El riesgo más inmediato de operación era doble:

1. Railway no podía desplegar porque la imagen intentaba copiar una ruta inexistente y luego arrancaba con un binario de runtime ausente.
2. Varias rutas críticas de auth y costo dependían de un rate limit que, en la práctica, estaba desactivado por un stub.

Se corrigieron ambos frentes en este bloque. El contenedor vuelve a buildar y arrancar, y las rutas prioritarias ahora responden con `429` y `Retry-After` cuando el abuso supera los umbrales definidos.

## Incidente Railway
### Causa raíz
- El `Dockerfile` copiaba `src/app/parametric/`, pero esa carpeta ya no existe.
- El backend corre con `tsx` en producción, pero la etapa `production` instalaba dependencias con `--omit=dev`, dejando a la imagen sin el runner real de TypeScript.

### Corrección aplicada
- Se reemplazó la copia rota por `src/app/engine/`, que es el árbol que el backend importa en runtime.
- La imagen `production` pasó a instalar las dependencias necesarias para ejecutar `server/server.ts` con `tsx`.

### Evidencia
- `docker build -t vorea-railway-fix:test .` -> PASS
- `docker run ... vorea-railway-fix:test` + `GET /api/health` -> PASS

## Hallazgos principales
| Severidad | Hallazgo | Estado |
| --- | --- | --- |
| Crítica | Deploy roto por `COPY src/app/parametric/` inexistente y runtime sin `tsx` | Resuelto |
| Alta | `signup`, `signin`, `request-reset`, `reset-password`, Google login, owner reset y quick-fix usaban un rate limit efectivamente desactivado | Resuelto |
| Alta | `POST /api/ai-studio/generate` no tenía throttling dedicado por IP/usuario | Resuelto |
| Media | `reset_pin:*` se guardaba sin expiración real | Resuelto |
| Media | `/api/telemetry/batch` permitía flood de requests y batches grandes | Resuelto |
| Media | `/api/uploads/thumbnail` y `/api/uploads/community-image` no tenían throttling | Resuelto |
| Media | `/api/vault/keys/:provider/test` podía usarse para forzar egress repetido a APIs externas | Resuelto |
| Media | `JWT_SECRET` tenía fallback inseguro en producción | Resuelto |
| Media | El rate limiting sigue siendo in-memory y de nodo único | Riesgo residual |
| Media | En dev/local `request-reset` sigue devolviendo `pinDev` | Riesgo residual controlado |
| Baja | Existen rutas duplicadas de Google OAuth y algo de drift operativo/documental asociado | Riesgo residual |

## Narrativas de ataque relevantes
### 1. Brute force y password spray
Antes del hardening, un atacante podía intentar login, signup y reset masivos desde una sola IP sin un corte real del backend. Eso habilitaba:
- fuerza bruta contra cuentas conocidas
- spam de registro
- agotamiento del canal de recuperación
- ruido operacional y potencial lockout del servicio de correo

Ahora estas rutas tienen corte efectivo y devuelven `429` con `Retry-After`.

### 2. Drenaje de costo en AI Studio
`POST /api/ai-studio/generate` era un vector claro para:
- consumo excesivo de créditos
- agotamiento del budget IA
- saturación del backend con requests autenticadas
- probes repetidos con prompts inválidos para medir comportamiento

El corte se aplica antes del trabajo caro. Incluso si el body es inválido, el usuario/IP consume cuota de rate limit y termina bloqueado antes de poder escalar el patrón.

### 3. Flood de telemetría y amplificación de escrituras
`/api/telemetry/batch` aceptaba arrays arbitrarios y cada evento disparaba escrituras adicionales de contadores. Un bot podía transformar una ruta “barata” en amplificación de writes y crecimiento de almacenamiento.

Ahora hay límite por IP y máximo de 100 eventos por batch.

### 4. Abuso de uploads
Las subidas autenticadas permitían acumular imágenes y presión de almacenamiento/IO. No era el vector más crítico, pero sí uno muy sencillo de automatizar con cuentas gratuitas.

Ahora hay límites por IP y por usuario para thumbnails y community images.

### 5. Relay contra proveedores externos vía vault test
`/api/vault/keys/:provider/test` hace fetch a APIs de terceros. Sin límite efectivo, un atacante con cuenta BYOK podía usar la plataforma como relé de tráfico saliente y castigar latencia/costo del servicio.

Ahora hay corte por IP y por usuario.

### 6. Riesgo de JWT inseguro por misconfiguración
El fallback de `JWT_SECRET` en producción convertía una omisión de configuración en una debilidad silenciosa.

Ahora producción falla de forma explícita si `JWT_SECRET` no está configurado.

## Evidencia de validación ofensiva controlada
Pruebas ejecutadas solo en entorno local/dev, con bajo volumen y sin tocar producción.

### Rate limiting real
- `POST /api/auth/signin`
  - Resultado: 10 respuestas `401`, intento 11 -> `429`
  - Evidencia: `Retry-After` presente; cuerpo incluye `retryAfter`
- `POST /api/auth/request-reset`
  - Resultado: 3 respuestas `200`, intento 4 -> `429`
- `POST /api/telemetry/batch`
  - Resultado: 60 respuestas `200`, intento 61 -> `429`
- `POST /api/ai-studio/generate`
  - Resultado con usuario autenticado de prueba: 6 respuestas `400` por prompt corto, intento 7 -> `429`
  - Conclusión: el límite se aplica antes del trabajo costoso

### Boundaries de payload
- `POST /api/telemetry/batch` con 101 eventos
  - Resultado: `400`
  - Mensaje: batch demasiado grande

### TTL real en reset PIN
- Se verificó que `reset_pin:{userId}` ya no guarda un string suelto
- Forma observada en KV:
  - `pin`
  - `expiresAt`
  - `requestedAt`

## Cambios implementados
- `Dockerfile`
  - copia `src/app/engine/` en lugar de la ruta inexistente
  - instala dependencias necesarias para runtime TypeScript en `production`
- `server/middleware/rate-limit.ts`
  - se convirtió en fuente única de truth para consumo manual y middleware
  - expone `consumeRateLimit`, `applyRateLimitHeaders` y `getClientIp`
- `server/app.ts`
  - rate limit real en auth, owner reset, quick-fix, telemetry, uploads y vault test
  - `request-reset` pasa a guardar PIN con expiración real
- `server/ai-studio-routes.ts`
  - rate limit por IP y por usuario en `POST /generate`
  - validaciones de tamaño para prompt y `parameterOverrides`
- `server/auth.ts`
  - producción falla si `JWT_SECRET` no existe

## Riesgos residuales y próximos pasos
### P0
- Redistribuir el rate limiting fuera de memoria local si Railway escala a múltiples instancias o reinicios frecuentes.
- Revisar rutas de comunidad con foco en spam de comentarios, likes, downloads y publicaciones masivas.

### P1
- Eliminar o encapsular mejor las rutas duplicadas de Google OAuth para reducir ambigüedad operacional.
- Revisar si `pinDev` debe pasar a un flag explícito tipo `EXPOSE_DEV_AUTH_PINS=true` en lugar de depender solo de `NODE_ENV`.
- Añadir alertas operativas para picos de `429`, quick-fix, generate, vault test y telemetry.

### P2
- Mover límites y counters a almacenamiento compartido con TTL real.
- Añadir métricas por actor para detectar credential stuffing, granjas de cuentas y drenaje coordinado de IA.

## Validaciones ejecutadas
- `npm run typecheck` -> PASS
- `npm run docs:api:generate` -> PASS
- `npm run docs:api:check` -> PASS
- `docker build -t vorea-railway-fix:test .` -> PASS
- `docker run ...` + `GET /api/health` -> PASS

## Validaciones con fallos preexistentes
- `npm run test` -> FAIL
  - `server/tests/circuit-breaker.test.ts` no contiene suite ejecutable
  - `server/__tests__/agent-governance.test.ts` falla por drift de artefactos y error YAML en preflight
  - `src/app/services/__tests__/route-access.test.ts` falla por expectativa de nav preexistente

Estos fallos no fueron introducidos por este bloque, pero siguen abiertos y deben limpiarse para recuperar una señal CI confiable.
