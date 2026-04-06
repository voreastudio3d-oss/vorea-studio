---
id: db-migration-safety
kind: rule
title: Seguridad y trazabilidad para migraciones de datos
description: Regla de seguridad y procedimiento obligatorio para aplicar migraciones en la Base de Datos
when_to_use:
  - Cuando cambien schema, migraciones, backfills o resets de datos persistentes.
inputs:
  - prisma/**
  - server/**/*
  - scripts/**/*community*
outputs:
  - Estrategia segura para cambios de datos y evidencia de impacto.
validations:
  - npm run test
  - npm run db:generate
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - backend
  - data
  - safety
applies_to:
  - prisma/**
  - server/**/*migration*
  - server/**/*backfill*
  - scripts/**/*backfill*
  - scripts/**/*reset*
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - rule:rollback-branch-protection
  - workflow:endpoint-security-validation
---

# Regla Obligatoria — Protección y Migraciones de Base de Datos

## Alcance
Aplica a cualquier modificación de schema, tipos de base de datos, configuraciones de conexión, inserciones críticas (como tablas de créditos o config) y cualquier alteración estructural de datos.

## Requisitos Obligatorios

1. **PROHIBIDO ejecutar cambios destructivos asíncronos:**
   La IA **NUNCA** debe ejecutar comandos `DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN TYPE` o eliminar datos de producción sin consentimiento explícito y revisión del usuario.

2. **Migraciones Declarativas:**
   - Todo cambio de schema debe registrarse siguiendo el motor ORM o DB tool utilizado en el proyecto (ej. Drizzle, Prisma, TypeORM, Supabase migrations).
   - No ejecutar SQL "crudo" en consola a menos que sea un query de solo lectura para troubleshooting.

3. **Backwards Compatibility:**
   - Preferir agregar columnas `nullable` o con `default` válido en lugar de eliminar o romper compatibilidad hacia atrás.
   - Si se requiere una migración compleja de datos, escribir un script aislado (ej. `scripts/migrate-xxx.ts`) en lugar de mutar el estado de la app en vivo.

4. **Validación Pre-Cierre:**
   - Asegurarse de actualizar los types del frontend (ej. `interface ToolCreditConfig`) y regenerar tipos de Supabase/ORM si corresponde.

## Evidencia Obligatoria
1. Archivo de esquema/tipos tocado.
2. Comando de generación de tipos u ORM corrido.
3. Confirmación de consistencia (sin warnings de rotura).
