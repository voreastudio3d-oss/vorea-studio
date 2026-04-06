# Catalogo de Skills Expertas

Este catalogo define las skills expertas reutilizables del repo.
La lista se genera desde el frontmatter de `.agents/skills_catalog/*.md`.

<!-- AGENTS:GENERATED:START -->
## Skills activas

1. `global-identity-payments-strategy`
   - Archivo: `global-identity-payments-strategy.md`
   - Alcance: Skill para planificar autenticación multi-provider, medios de pago regionales, OTP/biometría y datos de perfil/billing sin comprometer seguridad.

2. `global-localization-growth-strategy`
   - Archivo: `global-localization-growth-strategy.md`
   - Alcance: Skill para alinear Vorea Studio con idiomas, culturas y mercados distintos, incluyendo copy, toolstack de growth y señal analítica.

3. `global-market-platform-strategy`
   - Archivo: `global-market-platform-strategy.md`
   - Alcance: Skill para evaluar Vorea Studio como producto global, incluyendo arquitectura regional, storage, big data, costos de hosting/IA, dominios y riesgo operativo.

4. `web-ts-services-postgres-headless-mcp`
   - Archivo: `web-ts-services-postgres-headless-mcp.md`
   - Alcance: Skill experta para frontend/backend TypeScript, servicios, PostgreSQL, servidores headless y contratos MCP.

5. `advanced-3d-parametric-math-fdm`
   - Archivo: `advanced-3d-parametric-math-fdm.md`
   - Alcance: Skill experta para geometría computacional, transformaciones paramétricas, validez de malla y fabricabilidad FDM.

6. `ai-orchestration`
   - Archivo: `ai-orchestration.md`
   - Alcance: Skill experta para routing de IA, control de presupuesto, trazabilidad, seguridad y fallback operativo.

7. `webgl-canvas-threejs`
   - Archivo: `webgl-canvas-threejs.md`
   - Alcance: Skill experta para renderizado 2D/3D, workers y rendimiento visual con WebGL, Canvas y Three.js.

8. `ux-ui-css-layout`
   - Archivo: `ux-ui-css-layout.md`
   - Alcance: Skill experta para layout responsive, accesibilidad, estados de interfaz y disciplina de contenido visible.
<!-- AGENTS:GENERATED:END -->

## Regla de aplicacion

- Seleccionar al menos 1 skill lider en tareas complejas.
- Registrar la selección en `ai_handoff_YYYY-MM-DD.md` cuando la tarea se cierre.
- Si cambian skills, catálogo o adapters, aplicar `pnpm agent:sync` y `.agents/workflows/skill_review_upgrade_workflow.md`.
