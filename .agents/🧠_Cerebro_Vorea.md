# 🧠 Cerebro Colectivo Vorea

Bienvenido al núcleo de conocimiento del proyecto. Obsidian usará este documento como el Sol (nodo central) de tu **Graph View** conectando a los planetas (reglas, flujos, memoria temporal).

_Actualizado: 2026-04-10 — 12 agentes activos creados desde skills-database + auditoría de gobernanza_

## Plan Maestro y Handoffs

> **Directorio canónico de handoffs:** `.agents/handoffs/` (consolidados 2026-04-05)

- [[handoffs/README|handoffs/README.md]] **Índice de Handoffs (directorio canónico)**
- [[ai_shared_plan|ai_shared_plan.md]] **Plan Maestro Compartido (IA) — Vorea Studio**
- [[project_backlog|project_backlog.md]] **Backlog Consolidado — Vorea Studio Parametric 3D**
- [[llm_assignment_matrix|runtime/llm_assignment_matrix.yaml]] **⚡ Matriz de Asignación LLM por Bloque**

## Reglas de Código (Rules)

- [[ai_traceability_rule|rules/ai_traceability_rule.md]]
- [[api_docs_route_sync_rule|rules/api_docs_route_sync_rule.md]]
- [[backend_orm_auth_rule|rules/backend_orm_auth_rule.md]]
- [[change_quality_gate_rule|rules/change_quality_gate_rule.md]]
- [[db_migration_rule|rules/db_migration_rule.md]]
- [[rollback_branch_protection_rule|rules/rollback_branch_protection_rule.md]]

## Workflows

- [[admin_panel_ux_patterns|workflows/admin_panel_ux_patterns.md]]
- [[agent_handoff_evidence_workflow|workflows/agent_handoff_evidence_workflow.md]]
- [[auth_security_rule|workflows/auth_security_rule.md]]
- [[change_validation_master_workflow|workflows/change_validation_master_workflow.md]]
- [[codebase_architecture_boundaries_rule|workflows/codebase_architecture_boundaries_rule.md]] **⚠️ Boundaries de imports, dependencias y zonas protegidas — LECTURA OBLIGATORIA para toda IA**
- [[design_tokens_rule|workflows/design_tokens_rule.md]] **🎨 Prohibido hex hardcodeado en className — mapa de equivalencias y checklist pre-PR**
- [[docs_update_sync_rule|workflows/docs_update_sync_rule.md]]
- [[endpoint_security_validation_workflow|workflows/endpoint_security_validation_workflow.md]]
- [[engine_testing_rule|workflows/engine_testing_rule.md]]
- [[git_branching_rule|workflows/git_branching_rule.md]]
- [[git_hygiene_recovery_workflow|workflows/git_hygiene_recovery_workflow.md]]
- [[global_architecture_scale_rule|workflows/global_architecture_scale_rule.md]] **Escala global, storage y costos operativos**
- [[global_identity_payments_rule|workflows/global_identity_payments_rule.md]] **Identidad regional, pagos y verificación reforzada**
- [[global_localization_marketing_rule|workflows/global_localization_marketing_rule.md]] **Localización, growth y marketing por región**
- [[i18n_admin_content_rule|workflows/i18n_admin_content_rule.md]]
- [[i18n_locale_sync_rule|workflows/i18n_locale_sync_rule.md]]
- [[llm_safe_operating_protocol|workflows/llm_safe_operating_protocol.md]] **⚠️ Protocolo de operación segura multi-LLM — Prohibiciones, handoff y lecciones aprendidas**
- [[multi_llm_specialization_routing|workflows/multi_llm_specialization_routing.md]] **Routing de tareas por especialización LLM**
- [[post_commit_review_rule|workflows/post_commit_review_rule.md]]
- [[prisma_migration_pipeline_rule|workflows/prisma_migration_pipeline_rule.md]] **⚠️ BLOQUEANTE — Usar `migrate dev`, nunca `db push` en producción**
- [[service_abuse_hardening_runbook|workflows/service_abuse_hardening_runbook.md]] **Hardening de abuso de servicios**
- [[skill_review_upgrade_workflow|workflows/skill_review_upgrade_workflow.md]]
- [[subagent_routing_workflow|workflows/subagent_routing_workflow.md]] **Selección y coordinación de subagentes**
- [[ui_state_sync_rule|workflows/ui_state_sync_rule.md]] **Regla obligatoria para persistencia y transferencia de estado UI**
- [[ux_ui_review_workflow|workflows/ux_ui_review_workflow.md]]
- [[vorea_monetization_strategy|workflows/vorea_monetization_strategy.md]]

## Skills & Catalogos

- [[openai|adapters/openai.md]] (ver también `codex-skills/vorea-parametric-scad-products/agents/openai.yaml`)
- [[studio-template-map|codex-skills/vorea-parametric-scad-products/references/studio-template-map.md]] **Studio Template Map**
- [[technique-map|codex-skills/vorea-parametric-scad-products/references/technique-map.md]] **Technique Map**
- [[vorea-parametric-scad-products/SKILL|codex-skills/vorea-parametric-scad-products/SKILL.md]] **Vorea SCAD product families**
- [[capability-map|codex-skills/vorea-parametric-scad-surface/references/capability-map.md]] **Capability Map**
- [[vorea-parametric-scad-surface/SKILL|codex-skills/vorea-parametric-scad-surface/SKILL.md]]
- [[global-identity-payments-strategy|skills_catalog/global-identity-payments-strategy.md]] **Identidad, pagos y verificación por región**
- [[global-localization-growth-strategy|skills_catalog/global-localization-growth-strategy.md]] **Localización profunda, marketing y growth global**
- [[global-market-platform-strategy|skills_catalog/global-market-platform-strategy.md]] **Escala global, costos y arquitectura de plataforma**
- [[advanced-3d-parametric-math-fdm|skills_catalog/advanced-3d-parametric-math-fdm.md]]
- [[ai-orchestration|skills_catalog/ai-orchestration.md]]
- [[skills_catalog/README|skills_catalog/README.md]] **Catálogo de Skills Expertas**
- [[ux-ui-css-layout|skills_catalog/ux-ui-css-layout.md]]
- [[web-ts-services-postgres-headless-mcp|skills_catalog/web-ts-services-postgres-headless-mcp.md]]
- [[webgl-canvas-threejs|skills_catalog/webgl-canvas-threejs.md]]

## Agentes Activos (.agent.md)

> **Directorio:** `.github/agents/` — Agentes invocables nativos de Copilot, creados 2026-04-10 desde `.skills-database`

### Tier 1 — Impacto directo en backlog
- [[vorea-security-reviewer|agents/vorea-security-reviewer.agent.md]] **🔒 Security Reviewer** — Auth, pagos, OWASP, threat modeling
- [[vorea-db-architect|agents/vorea-db-architect.agent.md]] **🗄️ DB Architect** — PostgreSQL, Prisma, migraciones, indexing
- [[vorea-api-tester|agents/vorea-api-tester.agent.md]] **🔌 API Tester** — Tests funcionales, performance, carga
- [[vorea-technical-writer|agents/vorea-technical-writer.agent.md]] **📚 Technical Writer** — OpenAPI, manuales, docs portal
- [[vorea-seo-growth|agents/vorea-seo-growth.agent.md]] **🔍 SEO & Growth** — SEO técnico, funnels, analytics
- [[vorea-product-owner|agents/vorea-product-owner.agent.md]] **🧭 Product Owner** — PRDs, RICE, roadmap, sprint goals
- [[vorea-analytics|agents/vorea-analytics.agent.md]] **📊 Analytics & Finance** — KPIs, dashboards, AI spend

### Tier 2 — Calidad y compliance
- [[vorea-accessibility-auditor|agents/vorea-accessibility-auditor.agent.md]] **♿ Accessibility Auditor** — WCAG 2.2, screen reader, keyboard nav
- [[vorea-ux-researcher|agents/vorea-ux-researcher.agent.md]] **🔬 UX Researcher** — Usability testing, personas, journey maps
- [[vorea-workflow-architect|agents/vorea-workflow-architect.agent.md]] **🗺️ Workflow Architect** — State machines, failure modes, handoff contracts
- [[vorea-sprint-prioritizer|agents/vorea-sprint-prioritizer.agent.md]] **🎯 Sprint Prioritizer** — RICE scoring, capacity planning, velocity
- [[vorea-legal-compliance|agents/vorea-legal-compliance.agent.md]] **⚖️ Legal Compliance** — GDPR, CCPA, EU AI Act, multi-jurisdicción

### CAD Interop
- [[vorea-cad-converter|agents/vorea-cad-converter.agent.md]] **🔄 CAD Converter** — Fusion 360 → SCAD, parámetros, mapeo de familias

## Skills Activos (.github/skills/)

- [[fusion-scad-bridge|.github/skills/fusion-scad-bridge/SKILL.md]] **🔄 Fusion→SCAD Bridge** — Script F360, conversión de unidades, mapeo a familias Vorea

## Subagentes Específicos

- [[subagents/README|subagents/README.md]] **Catálogo de Subagentes**
- [[subagent-ai-orchestrator|subagents/subagent-ai-orchestrator.md]]
- [[subagent-fullstack-ts-services|subagents/subagent-fullstack-ts-services.md]]
- [[subagent-mcp-headless-integration|subagents/subagent-mcp-headless-integration.md]]
- [[subagent-parametric-math-fdm|subagents/subagent-parametric-math-fdm.md]]
- [[subagent-ux-ui-layout|subagents/subagent-ux-ui-layout.md]]
- [[subagent-webgl-three-rendering|subagents/subagent-webgl-three-rendering.md]]

## Adaptadores IA

- [[antigravity|adapters/antigravity.md]] **Antigravity (Claude Opus 4.6 Thinking)**
- [[claude|adapters/claude.md]]
- [[gemini|adapters/gemini.md]]
- [[openai|adapters/openai.md]] **OpenAI / GPT / Codex (con restricciones de zona)**

## Estado (Runtime)

- [[ai_handoff_2026-03-31|runtime/ai_handoff_2026-03-31.md]] **Handoff: Integración Feedback AI Review en Panel Administrativo**
- [[ai_handoff_2026-04-01|runtime/ai_handoff_2026-04-01.md]] **Handoff: Motor IA Multi-LLM para AI Studio**
- [[ai_handoff_2026-04-02|runtime/ai_handoff_2026-04-02.md]] **Handoff: auditoría global, skills nuevas y routing por LLM**
- [[ai_handoff_2026-04-04|docs/ai_handoff_2026-04-04.md]] **Handoff: Fallback Tree UI & Admin Layout Balancing**
- [[ai_handoff_2026-04-05|docs/ai_handoff_2026-04-05.md]] **Handoff: BG-006 + BG-301 — Monetización hardening + Motor LLM verificado**
- [[ai_studio_prompt_routing_architecture_2026-04-01|runtime/ai_studio_prompt_routing_architecture_2026-04-01.md]] **AI Studio — Arquitectura de Normalización y Routing Inteligente**
- [[current_block.template|runtime/current_block.template.yaml]]
- [[current_block|runtime/current_block.yaml]]
- [[documentation_cutoff_2026-04-01|runtime/documentation_cutoff_2026-04-01.md]] **Corte documental — 2026-04-01**
- [[global_readiness_status_2026-04-02|runtime/global_readiness_status_2026-04-02.md]] **Estado actual por punto del plan global (1-14)**
- [[global_profile_region_foundation_2026-04-02|runtime/global_profile_region_foundation_2026-04-02.md]] **Fundación de perfil global, región, locale y facturación básica**
- [[email_verification_checkout_stepup_2026-04-02|runtime/email_verification_checkout_stepup_2026-04-02.md]] **Verificación de email OTP y step-up regional previo al checkout**
- [[regional_identity_payments_domains_research_2026-04-02|runtime/regional_identity_payments_domains_research_2026-04-02.md]] **Research fechado: social login, pagos y dominios por región**
- [[local_scratch_inventory_2026-04-02|runtime/local_scratch_inventory_2026-04-02.md]] **Inventario de archivos scratch/locales fuera del flujo canónico**
- [[llm_assignment_matrix|runtime/llm_assignment_matrix.yaml]] **⚡ Matriz de Asignación LLM por Bloque (reemplaza delegación narrativa)**
- [[llm_delegation_plan|runtime/llm_delegation_plan.md]] **Plan de Delegación entre IAs: Motor LLM (histórico)**
- [[runtime/README|runtime/README.md]] **Runtime README**
- [[roadmap_delegacion_abril_2026|runtime/roadmap_delegacion_abril_2026.md]] **Roadmap y Delegación Multi-LLM (Abril 2026)**
- [[security_abuse_audit_2026-04-01|runtime/security_abuse_audit_2026-04-01.md]] **Auditoría de abuso y hardening operativo — 2026-04-01**

## Integraciones Operativas

- [[paperclip_vorea_operating_map_2026-04-03|paperclip_vorea_operating_map_2026-04-03.md]] **Mapa operativo Paperclip x Vorea**
- [[paperclip_vorea_operator_guide_2026-04-03|paperclip_vorea_operator_guide_2026-04-03.md]] **Guia operativa para trabajar con Paperclip en Vorea**
- Paperclip local activo en `http://localhost:3100` sin conflicto con los puertos dev de Vorea
- Proyecto real conectado en Paperclip: `Vorea Parametrics 3D`
- CEO inicial conectado al repo y al cerebro: `Cerebro Vorea CEO`
- Primera capa de equipo ya creada en Paperclip: `Vorea CTO`, `Vorea CMO`, `Vorea Researcher`
- Segunda capa tecnica ya creada bajo el CTO: `Vorea AI Studio Engineer`, `Vorea Monetization Engineer`, `Vorea Relief Engineer`
- Issues semilla ya cargados en Paperclip para BG-301, AI Studio CMS, monetización, Relief, growth y FODA/roadmap
- Subissues tecnicos adicionales ya sembrados: `EMP-10`, `EMP-11`, `EMP-12`

## Documentos Sueltos

- [[2026-04-01|2026-04-01.md]]
- [[validation-report|generated/validation-report.md]] **Governance Validation Report**
- [[🧠_Cerebro_Vorea|🦠_Cerebro_Vorea.md]] **🧠 Cerebro Colectivo Vorea**

## Documentos Raíz (canónicos)

- [[ai_governance_analysis|ai_governance_analysis.md]] **Governance Analysis**
- [[IA-Prompts|IA-Prompts.md]] — redirect a adapters nativos (ver cutoff 2026-04-01)
- [[marketing_audit|marketing_audit.md]] **Auditoría de marketing — parcialmente vigente**
- [[production_deploy_guide|production_deploy_guide.md]] **Guía de deploy en producción**
- [[project_backlog|project_backlog.md]] **Backlog Consolidado**
- [[project_health_report|project_health_report.md]] **Reporte de salud del proyecto**
- [[project_pending|project_pending.md]] **Pendientes del proyecto**
- [[walkthrough|walkthrough.md]] **Walkthrough general**
- [[walkthrough-relief|walkthrough-relief.md]] **Walkthrough Relief Engine**
- [[walkthrough_2026-03-24|walkthrough_2026-03-24.md]]
- [[walkthrough_2026-03-26|walkthrough_2026-03-26.md]]
