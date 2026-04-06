# Handoff — Global readiness, skills y routing por LLM
**Fecha:** 2026-04-02
**Objetivo:** dejar alineado el Cerebro con una nueva fase de auditoría/planificación orientada a expansión global, identidad regional, pagos y pendientes UX/auth.

## Qué se hizo
- Se auditó el estado real del repo contra el pedido extendido planteado a Gemini.
- Se confirmó que hay una mezcla de:
  - cambios ya commiteados en producto
  - fixes locales útiles aún no integrados
  - documentación/workflows nuevos que existían pero no estaban gobernados
- Se formalizaron nuevas superficies de gobernanza:
  - `global-architecture-scale`
  - `global-identity-payments`
  - `global-localization-marketing`
  - `multi-llm-specialization-routing`
- Se crearon skills nuevas para expansión global:
  - `global-market-platform-strategy`
  - `global-identity-payments-strategy`
  - `global-localization-growth-strategy`
- Se creó `.agents/runtime/global_readiness_status_2026-04-02.md` con estado por punto (1-14), evidencia y LLM recomendado.
- Se dejó organizada la delegación por LLM según fortalezas reales:
  - Gemini: escala, costos, datos, storage y backend profundo
  - Claude: seguridad, identidad, pagos y verificación
  - OpenAI/GPT: estrategia global, marketing, localización y research comparativo
  - Codex: integración en repo, validación y cierre documental
- `npm run agent:sync` y `npm run agent:governance:check` pasaron limpios.
- Se integraron fixes de producto que estaban solo como cambios locales:
  - ocultar Instagram en auth mientras no exista implementación real
  - hacer más visible el badge `Fork` del hero
  - corregir placeholders por locale en Hero Banner editor
- Se cerró el backend real de cambio de contraseña:
  - nuevo `PUT /api/auth/me/password`
  - soporta cambio normal y creación de password para cuentas OAuth/social
  - incluye rate limit, validación fuerte y prueba de integración dedicada

## Hallazgos clave
- `current_block.yaml` estaba desfasado respecto del estado real del producto.
- `roadmap_delegacion_abril_2026.md` existía como buen borrador, pero no alcanzaba a reflejar todos los puntos 1-14.
- `dfc5a79` resolvió logout reload y agregó UI de cambio de contraseña; luego el backend real para `PUT /api/auth/me/password` quedó cerrado en `a6313af`.
- Los fixes locales de Instagram, Fork y Hero Banner ya quedaron integrados en repo.
- Se inventariaron los archivos scratch/locales restantes para no confundirlos con documentación canónica.

## Siguiente paso recomendado
1. Preparar smoke autenticado/admin-only para cambio de contraseña y Hero Banner editor con cuenta QA dedicada.
2. Convertir el research regional en matriz implementable `region -> login -> payment -> verification policy`.
3. Priorizar `Apple` y `Stripe` como siguientes integraciones reales.

## Actualización posterior

- Se completó smoke público en producción:
  - `Fork` visible en hero.
  - `Instagram` oculto del modal de auth.
  - `/es/profile` correctamente protegido para invitados.
- Se completó research externo fechado para social login, pagos y dominios:
  - documento canónico: `regional_identity_payments_domains_research_2026-04-02.md`
- Se mantuvo una separación explícita entre:
  - validación pública ya confirmada;
  - pendientes que requieren credenciales QA/admin.
- Se corrigió la usabilidad local del skill `playwright` en Windows:
  - wrapper PowerShell agregado;
  - wrapper `bash` normalizado a LF;
  - `SKILL.md` actualizado con uso en PowerShell.
- Se agregó alias persistente `pwcli` al perfil local de PowerShell:
  - archivo: `C:\Users\marti\OneDrive\Documentos\PowerShell\Microsoft.PowerShell_profile.ps1`
  - propósito: invocar el wrapper PowerShell de Playwright con un comando corto y estable.
- Se mejoró el portal `/docs` para reflejar mejor el estado actual:
  - ya no se presenta solo como “API docs”;
  - ahora expone accesos rápidos para API, operaciones y perfiles;
  - se agregó un índice operativo visible y la guía pública interna de `pwcli`.
- Se agregó acceso directo al portal `/docs` desde el header del panel `SuperAdmin`:
  - visible al entrar al admin;
  - abre la documentación técnica en una pestaña nueva;
  - pensado para reducir fricción entre operación diaria y consulta documental.
- El portal `/docs` se amplió con una guía canónica de `flujos de producto y negocio`:
  - explica la relación entre API, auth, monetización, créditos, AI Studio, comunidad y gamificación;
  - quedó enlazada desde el índice del portal, el índice operativo y el perfil de desarrolladores;
  - la intención es que `/docs` sirva no solo como referencia técnica, sino también como mapa funcional del producto.
- Se corrigió el acceso directo a documentación desde admin:
  - el botón ahora apunta a `/docs/index.html`;
  - el servidor redirige explícitamente `/docs` y `/docs/` hacia ese archivo;
  - esto evita que hosts/adapters con fallback SPA manden al usuario de vuelta al home.
- Se implementó la primera fundación canónica de perfil global:
  - `auth_users` ahora soporta `phone`, `country_code`, `region_code`, `default_locale`, `billing_profile`, `email_verified_at` y `phone_verified_at`;
  - `GET /api/auth/me` rehidrata un `profile` canónico y devuelve además `regionPolicy`;
  - `PUT /api/auth/me` ya persiste teléfono, país, idioma por defecto y facturación básica;
  - `/profile` dejó de guardar solo en localStorage y ahora persiste esos datos contra backend real.
- Se implementó la primera capa real de verificación/step-up para checkout:
  - `POST /api/auth/request-email-verification` genera OTP de 6 dígitos con expiración corta y rate limit;
  - `POST /api/auth/verify-email` persiste `email_verified_at` y sincroniza el perfil KV;
  - `Membership` muestra política regional y exige OTP antes del checkout cuando la región lo pide;
  - `POST /api/subscriptions/create` ahora bloquea server-side el checkout si la política regional requiere step-up y el email no está verificado.
- Se ejecutó smoke real del step-up de checkout en producción:
  - se creó una cuenta temporal QA;
  - `POST /api/subscriptions/create` devolvió `403 verificationRequired=true` con política `LATAM`;
  - se detectó una inconsistencia entre `countryCode` y `regionCode` en `GET /api/auth/me` cuando el KV retenía un `regionCode` viejo;
  - se corrigió la canonicalización para derivar siempre la región desde `countryCode` cuando exista;
  - el deploy posterior quedó validado visualmente: la tarjeta cambió a `Latinoamérica` y `Actualizar a Pro` abrió el modal OTP;
  - evidencia canónica: `otp_checkout_smoke_2026-04-02.md`.
