---
id: admin-panel-ux-patterns
kind: workflow
title: Patrones UX del panel admin
description: Patrones UX obligatorios para el Admin Panel (SuperAdmin, FeedbackAdmin, Content Manager)
when_to_use:
  - Cuando se creen o modifiquen vistas del panel de administración.
inputs:
  - src/app/pages/**/Admin*.tsx
  - src/app/components/**
outputs:
  - UI admin consistente con lista-detalle, preview y reuso del sistema UI.
validations:
  - npm run test
  - Revisar desktop, mobile y preview del flujo admin impactado.
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
tags:
  - ui
  - admin
applies_to:
  - src/app/pages/**/*Admin*.tsx
  - src/app/pages/SuperAdmin.tsx
  - src/app/components/**
llm_support:
  - codex
  - openai
  - claude
  - gemini
related:
  - workflow:ux-ui-review
  - workflow:i18n-admin-content
---

## Regla de Desarrollo — Patrones UX del Admin Panel

### Alcance
Aplica a toda nueva vista, módulo o sección dentro del **Panel de Administración** del proyecto (SuperAdmin, FeedbackAdmin, y futuros módulos como gestor de contenido, promotions, etc.).

### Requisitos Obligatorios

1. **Patrón Lista-Detalle (Card Grid -> Editor):**
   - La vista principal de cada módulo admin debe mostrar una **lista de tarjetas (cards)** representando los ítems gestionables, incluso si solo existe uno de momento.
   - Al hacer clic en una tarjeta, se abre el **editor del contenido** junto con una **vista previa en vivo** del mismo (inline, modal, o iframe según la complejidad del contenido).
   - La vista previa debe reflejar los cambios en tiempo real antes de guardar.

2. **Vista Previa Obligatoria:**
   - Toda edición de contenido que sea visible para el usuario final **DEBE** incluir un mecanismo de preview que muestre cómo lucirá el cambio antes de publicarlo.
   - Para contenido simple (textos, títulos): Preview inline al costado del formulario.
   - Para contenido complejo (landing sections, banners): Preview en modal o iframe.

3. **Consistencia de Componentes UI:**
   - Usar exclusivamente los componentes existentes de `src/app/components/ui/` (button, toggle, tooltip, sidebar, etc.).
   - No crear componentes ad-hoc para el admin; si falta un componente, agregarlo al directorio `ui/` para que sea reutilizable.

4. **Protección de Acceso:**
   - Toda pantalla del admin debe estar envuelta en `TierGate` verificando `role === 'admin'` o `role === 'superadmin'`.
   - Adicionalmente, las rutas del backend que sirven datos al admin deben validar el JWT y el rol antes de responder.

### Checklist para el Agente de IA
Antes de dar por finalizada cualquier implementación de un módulo admin:
- [ ] ¿La vista principal muestra una lista/grid de cards?
- [ ] ¿Al hacer clic en la card se abre el editor con preview?
- [ ] ¿Se usaron componentes de `ui/`?
- [ ] ¿Está protegida con TierGate y validación de rol en backend?
