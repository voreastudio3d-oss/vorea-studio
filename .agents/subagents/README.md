# Catalogo de Subagentes

Este directorio define subagentes especializados para bloques complejos.
La lista se genera desde el frontmatter de `.agents/subagents/*.md`.

<!-- AGENTS:GENERATED:START -->
## Subagentes disponibles

1. `subagent-parametric-math-fdm`
   - Archivo: `subagent-parametric-math-fdm.md`
   - Dominio: Especialista en geometría, transformaciones paramétricas y compatibilidad de export FDM.

2. `subagent-ai-orchestrator`
   - Archivo: `subagent-ai-orchestrator.md`
   - Dominio: Especialista en costos, budget gates, routing por proveedor y fallback de IA.

3. `subagent-fullstack-ts-services`
   - Archivo: `subagent-fullstack-ts-services.md`
   - Dominio: Líder técnico para cambios frontend/backend TypeScript, servicios y contratos API.

4. `subagent-mcp-headless-integration`
   - Archivo: `subagent-mcp-headless-integration.md`
   - Dominio: Especialista en contratos de herramientas MCP e integraciones headless.

5. `subagent-ux-ui-layout`
   - Archivo: `subagent-ux-ui-layout.md`
   - Dominio: Especialista en UX/UI, CSS, accesibilidad y maquetación multi-dispositivo.

6. `subagent-webgl-three-rendering`
   - Archivo: `subagent-webgl-three-rendering.md`
   - Dominio: Especialista en renderizado WebGL/Canvas/Three.js y estabilidad del pipeline gráfico.
<!-- AGENTS:GENERATED:END -->

## Regla de coordinacion

- Elegir 1 orquestador principal y no más de 2 workers cuando realmente aporten.
- Consolidar salida en un único handoff siguiendo `.agents/workflows/agent_handoff_evidence_workflow.md`.
- Si cambia el catálogo o los adapters, aplicar `.agents/workflows/skill_review_upgrade_workflow.md`.
