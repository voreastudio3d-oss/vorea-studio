# Roadmap y Delegación Multi-LLM (Abril 2026)

Con la integración principal del motor Multi-LLM, el enrutador inteligente y la infraestructura básica de seguridad ya desplegada, el proyecto entra en una fase de estabilización, expansión global y pulido comercial.

Este documento debe leerse junto con:

- `global_readiness_status_2026-04-02.md`
- `regional_identity_payments_domains_research_2026-04-02.md`
- `multi_llm_specialization_routing.md`
- `ai_handoff_2026-04-02.md`

---

## 🔵 1. Gemini — operaciones, costos, datos y escala
*Gemini lidera bloques de infraestructura, storage, costos, latencia, base de datos y backend profundo.*

- **Despliegue y Migración de BD en Producción:**
  - Ejecutar la migración a producción de Prisma para las nuevas tablas `AiGenerationTrace` y `AiGenerationDailyAggregate` (`npx prisma db push` o migrate deploy).
  - Verificación en caliente de Ingress, logs y variables de entorno (`JWT_SECRET`, base de datos) en Railway.
- **Auto-Corrección de SCAD (Self-Healing Loop):**
  - Implementar la validación algorítmica y sintáctica de los modelos SCAD generados por IA.
  - Si un LLM alucina medidas imposibles, interceptarlo y re-enviar el prompt a un "modelo reparador" con instrucciones estrictas de corrección geométrica.
- **Saneamiento Técnico y Deuda:**
  - Reparar los fallos pre-existentes en la test suite (`circuit-breaker.test.ts`, logs desactualizados, aserciones rotas en rutas).
- **Expansión global de plataforma:**
  - modelar costo por storage, imágenes, previews, traces, ancho de banda y gasto IA;
  - priorizar mitigaciones de escala multi-región;
  - preparar plan de dominios/subdominios/canonical/redirects solo después de research fechada.

---

## 🟠 2. Claude — seguridad, identidad y pagos
*Claude lidera bloques donde el costo del error es alto: auth, pagos, compliance, OTP, verificación y diseño de datos sensibles.*

- **Rate Limiting Distribuido (Fase 2 Hardening):**
  - Refactorizar el Rate Limiter (actualmente in-memory por nodo local) para que persista y se comparta en el KV-Store o Redis. Vital para resistir picos de tráfico en clusters.
  - Sincronizar límites estandarizados para operaciones críticas (login, signup, password resets).
- **Endurecimiento de Comunidad Anti-Spam:**
  - Añadir rate limits agresivos y detección de bots a operaciones de la "Comunidad Maker" (`likes`, `comments`, `publish model`, `downloads`).
- **Edición Dinámica de Rutas IA en el Panel de SuperAdmin:**
  - Crear la lógica de backend e integrarla con Frontend para que el Admin pueda alterar el catálogo de IA, setear márgenes de costo (`costPer1kTokens`) y mover parámetros de bandas ("green", "red") sin redeploy.
- **Identidad regional y checkout reforzado:**
  - definir matriz por región de social login (Apple, Google, Facebook, etc.);
  - definir matriz por región de pagos (PayPal, Stripe, Mercado Pago, Paddle, etc.);
  - diseñar cuándo aplicar OTP/biometría/step-up auth y cuándo solo agregaría fricción.
- **Estado ya resuelto en esta fase:**
  - `email verification` con OTP por email;
  - `step-up` previo al checkout cuando la política regional lo requiere;
  - enforcement server-side en `subscriptions/create` para no depender solo del frontend.
- **Perfil extendido y billing profile:**
  - base canónica de país, región, teléfono, idioma por defecto y facturación básica ya implementada;
  - siguiente fase: verificación real, vault/tokenización y límites claros entre vault propio vs tercero.

---

## 🟢 3. OpenAI / GPT — mercados, marketing y localización
*GPT lidera síntesis estratégica, copy, variación cultural e interpretación de mercados. Codex aterriza después en repo.*

- **UX/UI Polish y Panel de Trazas:**
  - Diseñar y construir en el AI Studio Admin Tab un "Árbol visual de caídas" (Fallback Tree UI), para que si falla DeepSeek y rebota a Gemini Flash, el administrador vea el gráfico de cascada con motivos del error (UI tipo Vercel / DataDog).
- **Auditoría de Marketing y Copy (i18n):**
  - Tomar la posta de `marketing_audit.md`. Eliminar falsas características "ilimitadas" de las traducciones.
  - Finalizar la limpieza de anglicismos e inconsistencias entre los tres idiomas `es.json`, `en.json`, `pt.json` para todas las landing pages y el workspace que no sean solo AI Studio.
- **Higiene de Obsidian Documental:**
  - Leer y eliminar/archivar los borradores obsoletos como `llm_analysis.md`, `Auditoría de abuso...` siguiendo las instrucciones directas de la nueva regla del "Corte Documental" (`documentation_cutoff_2026-04-01.md`).
- **Go-to-market global:**
  - priorizar regiones iniciales;
  - adaptar messaging por idioma/cultura;
  - definir herramientas de CRM, mailing, social growth y fidelización.

---

## 🟣 4. Codex — integración real y cierre operativo
*Codex lidera la implementación full-stack, la validación y la documentación de cierre.*

- Ya resuelto en repo:
  - ocultar Instagram hasta implementación real
  - hacer visible el link Fork del Hero
  - corregir placeholders del Hero Banner por locale
  - cerrar el backend real del cambio de contraseña del perfil
- Validar estos cambios en deploy con smoke funcional de UX/auth.
- Mantener Cerebro, handoff, current_block y gobernanza sincronizados tras cada bloque.

---

## Orden recomendado de ejecución

1. **Codex:** integrar o descartar explícitamente los fixes locales y cerrar el punto 10 real.
2. **Claude:** diseñar y priorizar identidad/pagos/OTP por región.
3. **Gemini:** modelar storage, costos, escalabilidad y riesgos de globalización.
4. **OpenAI/GPT:** bajar estrategia de mercados, marketing y growth por idioma/región.
