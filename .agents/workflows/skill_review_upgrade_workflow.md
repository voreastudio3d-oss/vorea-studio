---
id: skill-review-upgrade
kind: workflow
title: Revisión y mejora de skills, adapters y subagentes
description: Workflow para revisar, validar y mejorar skills, catalogos y subagentes del proyecto para Codex, otras LLMs y agentes auxiliares
when_to_use:
  - Cuando cambie el sistema de skills, subagentes, adapters o gobernanza agentica.
inputs:
  - .agents/**
outputs:
  - Superficies de instrucciones alineadas entre Codex, otras LLMs y subagentes.
validations:
  - pnpm agent:sync
  - pnpm agent:governance:check
docs_to_update:
  - .agents/skills
  - ai_shared_plan.md
  - ai_handoff_YYYY-MM-DD.md
tags:
  - governance
  - skills
  - docs
applies_to:
  - .agents/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:subagent-routing
  - rule:ai-traceability
---

# Skill Review & Upgrade Workflow

## Objetivo

Mantener alineadas las superficies de instrucciones del repo para cualquier consumidor:

- Codex y skills repo-locales;
- otras LLMs con adapters o prompts especificos;
- subagentes internos;
- catalogos y entrypoints de descubribilidad.

## V1 machine-readable obligatoria

1. La fuente de verdad vive en frontmatter Markdown de `.agents/**`.
2. Los artefactos derivados se regeneran con:

```bash
pnpm agent:sync
pnpm agent:governance:check
```

3. El contrato común se publica en `.agents/generated/registry.json`.
4. Los catálogos `.agents/skills`, `.agents/skills_catalog/README.md` y `.agents/subagents/README.md` no se editan manualmente dentro del bloque generado.

## Cuándo aplicar

- Cuando se crea o modifica un skill en `.agents/codex-skills/`.
- Cuando cambia el alcance de una familia funcional o dominio tecnico.
- Cuando se agregan nuevos subagentes o cambia el routing entre agentes.
- Cuando la documentacion de skills se queda atras respecto del comportamiento real del producto.
- Antes de declarar cerrada una oleada tecnica importante.

## Superficies a revisar

1. Indice maestro:
   - `.agents/skills`
2. Skills repo-locales:
   - `.agents/codex-skills/*/SKILL.md`
   - `.agents/codex-skills/*/agents/*.yaml`
   - `.agents/codex-skills/*/references/*`
3. Catalogo de skills:
   - `.agents/skills_catalog/README.md`
   - `.agents/skills_catalog/*.md`
4. Subagentes:
   - `.agents/subagents/README.md`
   - `.agents/subagents/*.md`
5. Trazabilidad:
   - `ai_shared_plan.md`
   - `project_backlog.md`
   - `ai_handoff_YYYY-MM-DD.md`

## Paso 1 - Inventario y cobertura

Responder estas preguntas:

1. ¿Que skills existen y para que bloque del producto sirven hoy?
2. ¿Que skills ya quedaron superados por cambios recientes de arquitectura o negocio?
3. ¿Que dominios del repo no tienen skill o subagente claro?
4. ¿Que skills tienen referencias o ejemplos que ya no reflejan el estado actual?

## Paso 2 - Validacion de calidad del skill

Cada skill debe revisarse con esta checklist:

1. `description` clara y precisa.
2. Trigger explicito: cuando usarlo y cuando no.
3. Paths del repo y modulos relevantes actualizados.
4. Workflows obligatorios enlazados cuando corresponde.
5. Riesgos/limites del dominio explicitados.
6. Ejemplos o referencias concretas y vivas.

## Paso 3 - Compatibilidad entre LLMs/agentes

Separar contenido comun de adapters especificos:

1. El conocimiento base y el proceso viven en `SKILL.md`.
2. Las diferencias por proveedor/modelo viven en `agents/*.yaml` u otros adapters equivalentes.
3. El workflow debe evitar instrucciones innecesariamente acopladas a una sola LLM si el dominio puede compartirse.

Regla:

- Si una instruccion aplica a cualquier agente, va al skill comun.
- Si una instruccion depende del formato o contexto de una plataforma concreta, va al adapter del agente.

## Paso 4 - Validacion tecnica

### Skills repo-locales

Si se modifica un skill de `.agents/codex-skills`, validar sintaxis y estructura.

Ejemplo ya usado en este repo:

```bash
py -3 C:\Users\marti\.codex\skills\.system\skill-creator\scripts\quick_validate.py .agents/codex-skills/<skill>
```

Si el validador no esta disponible, hacer revision manual minima:

1. `SKILL.md` existe;
2. paths enlazados existen;
3. adapters `agents/*.yaml` existen y son coherentes;
4. referencias apuntan a archivos reales.

### Catalogos e indices

Verificar que `.agents/skills`, `skills_catalog/README.md` y `subagents/README.md` expongan correctamente lo nuevo o removido.

## Paso 5 - Mejora activa

Al mejorar un skill o subagente, buscar siempre al menos uno de estos upgrades:

1. mejor trigger;
2. mejor criterio de salida;
3. referencias mas utiles;
4. menor ambiguedad para otras LLMs/agentes;
5. mejor relacion entre skill lider y skills colaboradoras;
6. mejor trazabilidad hacia backlog/handoff.

## Paso 6 - Criterio de cierre

El workflow queda completo cuando:

1. el indice `.agents/skills` referencia los workflows y skills correctos;
2. las skills modificadas tienen `SKILL.md` y adapters coherentes;
3. catalogos y subagentes no quedaron desalineados;
4. la trazabilidad del bloque menciona el upgrade de gobernanza;
5. otra IA/agente puede descubrir y aplicar el skill sin contexto oral adicional.

## Notas del repo

- Tratar `.agents/skills` como entrypoint maestro de gobernanza.
- No dejar mejoras de skills solo en handoff; deben reflejarse tambien en los archivos fuente del sistema de agentes.
- Si cambia el routing o la jerarquia entre agentes, revisar tambien `.agents/workflows/subagent_routing_workflow.md`.
