# Agentes Activos — Vorea Studio

Agentes `.agent.md` invocables creados 2026-04-10 a partir del análisis cruzado entre el backlog del proyecto y el catálogo `.skills-database`.

## Origen

Cada agente incorpora expertise de uno o más skills del `.skills-database/` adaptados al dominio específico de Vorea Studio (stack, backlog, workflows, restricciones).

## Tier 1 — Impacto directo en backlog

| Agente | Skills fuente | Bloques backlog |
|--------|--------------|-----------------|
| `vorea-security-reviewer` | security-engineer, code-reviewer | BG-006, BG-007 |
| `vorea-db-architect` | database-optimizer, backend-architect | rate-limiting, infra |
| `vorea-api-tester` | api-tester, performance-benchmarker | BG-008, BG-110 |
| `vorea-technical-writer` | technical-writer | BG-114 |
| `vorea-seo-growth` | seo-specialist, growth-hacker | BG-114, BG-116 |
| `vorea-product-owner` | product-manager | BG-117.3 |
| `vorea-analytics` | analytics-reporter, finance-tracker | BG-117.4 |

## Tier 2 — Calidad y compliance

| Agente | Skills fuente | Área |
|--------|--------------|------|
| `vorea-accessibility-auditor` | accessibility-auditor | WCAG 2.2 AA, UI |
| `vorea-ux-researcher` | ux-researcher | User research, usabilidad |
| `vorea-workflow-architect` | workflow-architect | State machines, failure modes |
| `vorea-sprint-prioritizer` | sprint-prioritizer | RICE, capacity, velocity |
| `vorea-legal-compliance` | legal-compliance-checker | GDPR, CCPA, EU AI Act |

## CAD Interop

| Agente | Skills fuente | Área |
|--------|--------------|------|
| `vorea-cad-converter` | fusion-scad-bridge (skill propio) | Fusion 360 → SCAD, mapeo familias |

## Uso

Para que VS Code Copilot los descubra nativamente, los archivos `.agent.md` deben estar en `.github/agents/`. Si se mantienen en `.agents/agents/`, pueden referenciarse manualmente o copiarse a `.github/agents/` cuando se desee activación directa en el picker.

## Regla de coordinación

- Elegir el agente más específico para la tarea
- Combinar con subagentes del catálogo existente cuando toque implementación
- Registrar el agente usado en el handoff correspondiente
