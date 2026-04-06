---
id: backend-orm-auth-guidelines
kind: rule
title: Lineamientos Críticos de Backend (Prisma, Auth y CMS Storage)
description: Regla de autoaprendizaje y prevención de anomalías comprobadas en ORM, Autorización y desacople de Endpoints de Storage.
when_to_use:
  - Al desarrollar, modificar o depurar rutas del backend (Hono/Express).
  - Al interactuar con operaciones de guardado en Prisma (`.update`, `.create`).
  - Al crear middlewares de seguridad o validación de JWT (`requireAdmin`).
inputs:
  - server/**/*.ts
outputs:
  - Código de backend resiliente a mutaciones estáticas, errores de 500 silenciosos y bloqueos de seguridad en cuentas elevadas.
validations:
  - Confirmar que los endpoints `PUT` filtran campos inmutables antes de usar Prisma.
  - Comprobar que middlewares de autorización consideren fallbacks por DB o Email contra latencia de JWTs.
docs_to_update: []
tags:
  - backend
  - prisma
  - auth
  - security
applies_to:
  - server/**
  - src/app/services/api-client.ts
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - rule:change-quality-gate
---

# Regla de Arquitectura y Lecciones Aprendidas (Backend, ORM & Auth)

Este documento forma parte del **Cerebro Colectivo** del proyecto. Encapsula lecciones aprendidas tras depurar integraciones complejas de Auth y el CMS de AI Studio, para evitar que futuras IAs repitan errores que cuestan horas de debug.

## 1. El Peligro del ORM Obediente (Error 500 Silencioso en Prisma)
**Problema histórico:** Actualizaciones (`PUT /families/:id`) fallaban con Errores 500 desde la base de datos sin un mensaje claro, porque el front end enviaba el payload JSON completo del objeto. Prisma intentaba sobreescribir columnas autogeneradas o inmutables como `id`, `createdAt`, y `updatedAt`.
**Regla Obligatoria:** 
Cualquier endpoint que haga uso de `prisma.modelo.update()` **debe desestructurar explícitamente** el payload entrante para descartar llaves prohibidas antes de inyectarlo a la propiedad `data`.
```typescript
// ✅ CORRECTO
const { id: _ignoredId, createdAt, updatedAt, ...updateData } = body;
await prisma.aiStudioFamily.update({ where: { id }, data: updateData });
```

## 2. Disociación Fantasma de JWT vs Base de Datos (Seguridad Restrictiva)
**Problema histórico:** Administradores y fundadores (`admin@vorea.studio`) recibían un error `403 No autorizado` al intentar subir imágenes. Aunque la Base de Datos y la memoria (KV) sabían que eran `superadmin`, el JWT local original con el que iniciaron sesión tenía la claim `role: "user"`.
**Regla Obligatoria:**
Los *middlewares* de seguridad restrictivos (`requireAdmin` o similares) no deben confiar ciegamente en `payload.role` si falla. Siempre deben implementar un mecanismo de *fallback* para "Hard-Admins" (ej. leyendo `payload.email` contra una lista estática de dueños) o consultando el rol real en la BD/KV ante la duda, compensando así los JWTs que quedan desincronizados tras promociones en caliente.

## 3. Desacoplamiento Estricto de Endpoints CMS vs Usuarios
**Problema histórico:** Intentar reutilizar servicios web públicos (ej. Subida de imágenes de la comunidad) para nutrir portadas del CMS. Esto activaba *Rate Limits*, validaciones de *maxBytes* del perfil free y consumo de créditos IA.
**Regla Obligatoria:**
Las subidas de almacenamiento (Storage/Assets) destinadas al panel administrativo (CMS) **nunca** deben rutear hacia APIs pensadas para el usuario final. Deben gozar de una sub-ruta dedicada (`/api/admin/.../upload`) que escriba directo en AWS/S3 o KV sin atravesar pasarelas de monetización o cuotas de `CommunityApi`.

## 4. Persistencia Visual Obligatoria (Auto-Guardado en CMS)
**Problema histórico:** Operadores del sistema subían nuevas imágenes y, al cambiar de página o cerrar, la URL devuelta por el servidor se perdía porque olvidaban oprimir "Guardar Blueprint" (guardado de formulario).
**Regla Obligatoria:**
Cuando la UI del CMS administre recursos subidos asíncronamente (imágenes, archivos binarios), apenas el frontend reciba la URL definitiva del backend, **debe disparar un auto-guardado en cascada** (ej. llamando a `PUT /item/:id` con la nueva `imageUrl`) para garantizar la persistencia del vínculo.
