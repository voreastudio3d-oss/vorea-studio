---
id: global-market-platform-strategy
kind: skill
title: Estrategia global de plataforma, datos y costos
description: Skill para evaluar Vorea Studio como producto global, incluyendo arquitectura regional, storage, big data, costos de hosting/IA, dominios y riesgo operativo.
when_to_use:
  - Cuando el pedido trate mercados globales, multi-región, storage de imágenes, crecimiento de base de datos, costos de IA o dominios.
inputs:
  - server/**
  - prisma/**
  - src/app/services/**
  - .agents/runtime/**
outputs:
  - Diagnóstico y backlog ejecutable para escalar Vorea Studio fuera del contexto local.
validations:
  - Documentar supuestos de costo y cuellos de botella antes de recomendar escala global.
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - global
  - platform
  - scale
  - cost
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
    - Mejor candidato para modelado de infraestructura, storage, throughput, costos y latencia.
  claude:
    - Excelente revisor de riesgos, contratos de datos y hardening arquitectónico.
  openai:
    - Fuerte para síntesis estratégica, trade-offs y narrativa ejecutiva.
  codex:
    - Ideal para traducir la estrategia en cambios concretos de repo, schemas y docs.
related:
  - workflow:global-architecture-scale
  - workflow:service-abuse-hardening-runbook
---

# Skill: global-market-platform-strategy

## Objetivo

Analizar si Vorea Studio puede sostenerse como plataforma global y qué cuellos de botella aparecen en storage, costo, rendimiento y operación.

## Úsalo para

- mercados globales vs locales;
- costo de imágenes, previews y uploads;
- crecimiento de base de datos;
- ancho de banda y egress;
- gasto IA por proveedor/modelo;
- riesgo de dominios, subdominios y expansión multi-región.

## Entregables esperados

1. Diagnóstico actual del stack.
2. Principales riesgos de escala.
3. Backlog priorizado de mitigaciones.
4. Supuestos explícitos sobre costo y tráfico.
