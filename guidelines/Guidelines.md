## Vorea Studio - Operational Guidelines

### 1. Rama de trabajo obligatoria
- No desarrollar en `develop` directamente.
- Usar formato `codex/<tipo>/<nombre-corto>`.
- Crear rama de retorno inmutable antes de bloques grandes:
  - `codex/rollback/<fecha>-<hito>`.

### 2. Fuente de verdad de gobernanza IA
- Entry point para agentes: `.agents/skills`
- Base de reglas y workflows: `.agents/skills`.
- Skills expertas: `.agents/skills_catalog/README.md`
- Subagentes: `.agents/subagents/README.md`
- Registro machine-readable: `.agents/generated/registry.json`
- Reporte de validación de gobernanza: `.agents/generated/validation-report.md`
- Plantilla de contexto activo: `.agents/runtime/current_block.template.yaml`
- Estado local del bloque activo: `.agents/runtime/current_block.yaml` (local, no versionado)
- Workflow para higiene de git, backups y limpieza de ramas/worktrees: `.agents/workflows/git_hygiene_recovery_workflow.md`
- Workflow para revision y mejora de skills/adapters/subagentes: `.agents/workflows/skill_review_upgrade_workflow.md`
- Compatibilidad multi-LLM:
  - Evitar instrucciones directas dirigidas a proveedores concretos desde superficies globales del repo.
  - Si se prueba otra LLM, usar como contexto manual mínimo `.agents/runtime/current_block.yaml`, `ai_shared_plan.md`, `project_backlog.md` y `ai_handoff_YYYY-MM-DD.md`.
- Trazabilidad obligatoria:
  - `project_backlog.md` solo para estado/prioridad
  - `ai_shared_plan.md` solo para ejecución activa
  - `ai_handoff_YYYY-MM-DD.md` solo para delta/evidencia del día

### 3. Comandos agentic obligatorios
- Antes de arrancar un bloque relevante:
  - `pnpm agent:preflight`
- Para rutear workflows, skills, docs y generar contexto local:
  - `pnpm agent:route --staged`
  - o `pnpm agent:route --changed <paths>`
  - si el objetivo del bloque ya es conocido: `pnpm agent:route --changed <paths> --goal "<objetivo>"`
- Si cambia `.agents/**`:
  - `pnpm agent:sync`
  - `pnpm agent:governance:check`
- Para plan seguro de recuperación git:
  - `pnpm agent:git-recover --dry-run`
- Para consumo machine-readable:
  - `pnpm agent:preflight --json`
  - `pnpm agent:git-recover --json`

### 4. Quality gates minimos
- Ejecutar `npm run test` en todo cambio de codigo.
- Si cambia backend/API:
  - `npm run docs:api:generate`
  - `npm run docs:api:check`

### 5. Flujo para bloques de alto impacto
1. Crear checkpoint rollback.
2. Crear rama feature desde ese checkpoint.
3. Correr `pnpm agent:preflight`.
4. Correr `pnpm agent:route --staged` o `--changed` y completar `.agents/runtime/current_block.yaml`.
5. Implementar + validar.
6. Actualizar trazabilidad.
7. Push de rama activa y PR a `develop`.

### 6. Parametric AI pipeline v1
- Flujo oficial:
  - Prompt -> InstructionSpecV1 -> SCAD -> Studio compile.
- Motores activos:
  - `fdm` (utilidad imprimible)
  - `organic` (decorativo)
