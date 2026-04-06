---
id: global-architecture-scale
kind: workflow
title: Arquitectura global, escala y costo operativo
description: Workflow para evaluar y endurecer Vorea Studio cuando el alcance deja de ser local y pasa a mercados globales, multi-región y con presión real de costo/latencia.
when_to_use:
  - Cuando el bloque trate expansión global, latencia multi-región, storage, big data, costos de hosting, dominios o riesgo operativo por crecimiento.
inputs:
  - server/**
  - prisma/**
  - src/app/services/**
  - docs/**
outputs:
  - Decisiones trazables sobre arquitectura regional, almacenamiento, costos, observabilidad y defensa ante abuso a escala.
validations:
  - Revisar que timestamps, storage, ancho de banda y costos por request estén modelados para crecimiento global.
  - Documentar impacto estimado en base de datos, imágenes, IA y tráfico.
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - architecture
  - scale
  - cost
  - global
applies_to:
  - server/**
  - prisma/**
  - src/app/services/**
  - .agents/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
cross_llm_notes:
  gemini:
    - Lider recomendado para modelado de costos, latencia multi-región, storage, bandwidth y capacidad operativa.
  claude:
    - Revisor fuerte para invariantes de seguridad, modelos de datos y riesgos de escalado.
  openai:
    - Fuerte para síntesis de estrategia de producto/plataforma y priorización ejecutiva.
  codex:
    - Ideal para aterrizar la estrategia en cambios concretos de repo y documentación gobernada.
related:
  - workflow:service-abuse-hardening-runbook
  - workflow:endpoint-security-validation
  - skill:global-market-platform-strategy
---

# Workflow - Global Architecture Scale

## Objetivo

Asegurar que Vorea Studio pueda crecer fuera del mercado local sin asumir que storage, base de datos, imágenes, IA o ancho de banda se comportarán como hoy.

## Preguntas obligatorias

1. ¿La funcionalidad depende de una sola región o de un único proveedor?
2. ¿La ruta genera costo por request, por imagen, por token o por egress?
3. ¿El volumen de datos crecería lineal, exponencial o por picos?
4. ¿Se puede rate-limitar, cachear, comprimir o mover a CDN/object storage?
5. ¿El costo observado puede auditarse contra el costo teórico?

## Reglas de decisión

### 1. Datos y timezones

- Toda fecha persistida debe modelarse en UTC y ser segura para multi-región.
- Los reportes por país/región/idioma deben poder agregarse sin depender del timezone del servidor.

### 2. Storage y media

- No guardar binarios en la base de datos salvo casos muy acotados.
- Imágenes, previews y assets deben pensarse para object storage + CDN.
- Documentar riesgo de crecimiento por:
  - thumbnails
  - uploads comunitarios
  - exports descargables
  - traces IA si capturan payloads grandes

### 3. Presión de costo

- Todo feature con IA, upload o egress debe declarar:
  - costo por request estimado
  - volumen esperado
  - riesgo de abuso
  - mecanismo de corte o degradación

### 4. Defensa operativa

- Rutas costosas deben tener:
  - rate limit
  - circuito de presupuesto
  - fallback o degradación controlada
  - observabilidad operativa

### 5. Dominios y superficie pública

- Los cambios que afecten marca, regiones o nuevos mercados deben dejar un backlog explícito de dominios, subdominios y necesidad de redirects/canonical.
- No recomendar compra de dominios o gasto publicitario como hecho consumado sin investigación separada y fechada.

## Criterio de cierre

El bloque no queda “listo para global” si no deja al menos:

1. riesgo/costo documentado;
2. estrategia de storage y latencia razonable;
3. mecanismos anti-abuso claros;
4. un siguiente paso operativo para producción.

## Relacionados

- [[🧠_Cerebro_Vorea|🧠 Cerebro Colectivo Vorea]]
- [[roadmap_delegacion_abril_2026|Roadmap y Delegación Multi-LLM (Abril 2026)]]
- [[global_readiness_status_2026-04-02|Estado global actual por punto]]
- [[global-market-platform-strategy|Skill de estrategia global de plataforma]]
