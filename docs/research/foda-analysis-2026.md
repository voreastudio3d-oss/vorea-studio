# FODA Analysis — Vorea Studio 3D (Q2 2026)

## Fortalezas (Strengths)

1. **Motor IA multi-proveedor exclusivo** — 5 proveedores LLM (Gemini, OpenAI, Anthropic, DeepSeek, Kimi) con routing inteligente, fallback cascade y circuit breaker presupuestario ($100/mes). Ningún competidor 3D ofrece generación SCAD paramétrica asistida por IA.

2. **Pipeline paramétrico completo** — Desde prompt → normalización → SCAD → mesh → 3MF/STL. Self-healing SCAD cuando la sintaxis falla. Motor Relief con 7 modos de superficie (plane, cylinder, box, polygon, lampshade, geodesic, STL).

3. **Exportación multi-color 3MF** — Soporte hybrid y slic3r-strict para Bambu Studio/Orca Slicer. Vertex coloring con paleta cuantizada. Geometría manifold verificada.

4. **Monetización diversificada** — PayPal subscriptions (PRO/STUDIO PRO monthly/yearly) + sistema de créditos (compra directa) + donaciones. Ledger con idempotencia y reserva atómica.

5. **Cobertura de tests robusta** — 1400+ tests, 91%+ statement coverage. Governance automatizada con YAML parser custom, drift detection y artifact sync.

6. **Stack moderno y eficiente** — React 18 + Vite + Hono + Prisma 7.5 + PostgreSQL en Railway. PWA-ready, SEO estático, i18n, GA4.

## Debilidades (Weaknesses)

1. **Dependencia de proveedores IA externos** — Sin modelo propio. Cambios de pricing o API de OpenAI/Anthropic/Google impactan directamente costos y disponibilidad.

2. **Single-developer bottleneck** — Toda la arquitectura, QA y deploy depende de un solo desarrollador. Bus factor = 1.

3. **Motor SCAD interpretado** — El intérprete SCAD propio tiene limitaciones vs OpenSCAD nativo: sin CSG booleans reales, $fn limitado a 48, sin render nativo.

4. **Base de usuarios sin validar** — Métricas de actividad sin benchmark contra competidores. Ratio conversión FREE→PRO desconocido.

5. **Documentación de API incompleta** — OpenAPI spec existe pero no cubre todos los endpoints internos. Falta guía de integración para desarrolladores terceros.

6. **Pipeline CI/CD limitado** — Sin staging environment dedicado. Deploy manual vía Railway. Sin canary releases.

## Oportunidades (Opportunities)

1. **Mercado 3D printing en expansión** — $16B proyectado para 2027. Maker community creciendo con Bambu Lab popularizando impresión FDM multi-color accesible.

2. **AI-native design como diferenciador** — Ningún competidor (MakerWorld, Printables, Thangs, Thingiverse) ofrece generación paramétrica IA integrada. First-mover advantage.

3. **Educación y makers** — Landings específicas (`/for/makers`, `/for/education`, `/for/ai-creators`) posicionan nichos desatendidos. Potencial partnerships con escuelas STEM.

4. **API pública** — Exponer motor IA como servicio B2B para otras plataformas 3D. Revenue adicional sin depender de usuarios finales.

5. **Comunidad de modelos** — Marketplace de diseños paramétricos personalizables. Creator economy con comisiones sobre ventas de modelos.

6. **Expansión multi-idioma** — i18n ya implementado. Potencial en mercados hispanohablantes y asiáticos (China/Japón con Kimi/DeepSeek).

## Amenazas (Threats)

1. **Competidores con capital** — MakerWorld (Bambu Lab), Thangs ($15M funding) podrían implementar IA generativa rápidamente con sus recursos.

2. **Cambios en pricing de APIs IA** — Incrementos de costo en OpenAI/Anthropic podrían erosionar márgenes. El circuit breaker mitiga pero no elimina.

3. **Regulación IA** — EU AI Act y regulaciones similares podrían requerir compliance costoso para generación de diseños.

4. **Patent trolls en generación 3D** — Espacio tecnológico con potencial de litigios de propiedad intelectual.

5. **Fatiga de suscripciones** — Usuarios saturados de modelos SaaS. Necesidad de demostrar valor tangible vs herramientas gratuitas (Thingiverse, OpenSCAD puro).

6. **Downtime de proveedores IA** — Gemini 429s frecuentes observados. Dependencia en disponibilidad de terceros para feature core.

---

## Roadmap 6 Meses (Q2-Q3 2026)

| Mes | Prioridad | Entregable |
|-----|-----------|------------|
| Abril | Estabilidad | Relief manifold fix ✅, governance tests ✅, monetization smoke ✅ |
| Mayo | Motor IA | Self-healing SCAD v2, Kimi integration tuning, prompt library expansion |
| Junio | Comunidad | Marketplace beta, creator profiles enhanced, model sharing |
| Julio | Educación | STEM curriculum pack, classroom licensing, tutorial system |
| Agosto | API pública | REST API v1 beta, developer docs, sandbox environment |
| Septiembre | Escala | CDN optimization, auto-scaling, monitoring dashboard, Series A prep |
