---
id: design-tokens-rule
kind: workflow
title: Regla obligatoria de design tokens — prohibido hex hardcodeado
description: Todo color en className de componentes React DEBE usar tokens del tema Tailwind. Prohibido usar hex, rgba o cualquier valor de color literal en className.
when_to_use:
  - Siempre que se cree o modifique un componente React (.tsx)
  - Antes de hacer code review o merge de cualquier PR con cambios de UI
inputs:
  - src/**/*.tsx
  - src/styles/theme.css
outputs:
  - Componentes sin colores hex hardcodeados en className
validations:
  - grep -rn "text-\[#" src/ --include="*.tsx" (debe dar 0 resultados en archivos nuevos)
docs_to_update:
  - ai_handoff_YYYY-MM-DD.md
applies_to:
  - src/**/*.tsx
  - src/**/*.jsx
tags:
  - design-system
  - tokens
  - css
  - frontend
  - ui
llm_support:
  - codex
  - gemini
  - claude
  - openai
related:
  - workflow:ux-ui-review
  - workflow:codebase-architecture-boundaries
---

# Regla — Design Tokens (No Hex Hardcodeado)

## Regla bloqueante

> **PROHIBIDO** usar valores de color literales (`#RRGGBB`, `rgba(...)`, `hsl(...)`) directamente en los atributos `className` de componentes React.

Todo color debe referenciarse mediante un **token del sistema de diseño** definido en `src/styles/theme.css` y expuesto por Tailwind.

---

## Mapa de equivalencias

Usá este mapa para convertir cualquier hex legacy al token correcto:

### Colores de superficie y fondo

| ❌ Hardcodeado | ✅ Token Tailwind | Uso semántico |
|---|---|---|
| `bg-[#0d1117]` | `bg-background` | Fondo de página |
| `bg-[#131829]` | `bg-surface` | Panel, card, nav |
| `bg-[#1a1f36]` | `bg-surface-raised` o `bg-secondary` | Modal, dropdown, popover |
| `bg-[#3a4555]` | `bg-muted-surface` | Scrollbar, switch off |

### Colores de marca (primary)

| ❌ Hardcodeado | ✅ Token Tailwind | Uso semántico |
|---|---|---|
| `text-[#C6E36C]` | `text-primary` | Texto de acento |
| `bg-[#C6E36C]` | `bg-primary` | Fondo de botón primario |
| `bg-[#C6E36C]/10` | `bg-primary/10` | ✅ Las opacidades están permitidas con token |
| `bg-[#C6E36C]/15` | `bg-primary/15` | ✅ |
| `border-[#C6E36C]/20` | `border-primary/20` | ✅ |
| `hover:border-[#C6E36C]/30` | `hover:border-primary/30` | ✅ |

### Bordes

| ❌ Hardcodeado | ✅ Token Tailwind | Uso semántico |
|---|---|---|
| `border-[rgba(168,187,238,0.12)]` | `border-border` | Borde normal |
| `border-[rgba(168,187,238,0.08)]` | `border-border-subtle` | Borde suave (panel, nav) |
| `border-[rgba(168,187,238,0.06)]` | `border-border-faint` | Borde muy suave |
| `border-[rgba(168,187,238,0.05)]` | `border-divider` | Divisor de lista |
| `divide-[rgba(168,187,238,0.05)]` | `divide-divider` | Divide entre elementos |

### Texto y muted

| ❌ Hardcodeado | ✅ Token Tailwind |
|---|---|
| `text-[#9ca3af]` | `text-muted-foreground` |
| `text-[#ffffff]` | `text-foreground` |
| `text-[#000000]` | `text-primary-foreground` |

---

## Excepciones permitidas

Las siguientes situaciones son las ÚNICAS donde un valor literal es aceptable:

1. **Animaciones `@keyframes` en `theme.css`** — los `box-shadow` gradient y filter con rgba son inevitables en ese contexto.
2. **`style={{ }}` para gradients inline** — cuando Tailwind no puede expresar un `linear-gradient` complejo.
3. **Colores semánticos de estado de terceros** — por ejemplo `red-400`, `green-400`, `blue-400` de Tailwind son válidos sin token propio porque son semánticos por naturaleza.

---

## Checklist pre-PR (nuevo componente)

```
[ ] No hay ningún `#` literal en los className del componente
[ ] No hay ningún `rgba(` literal en los className del componente
[ ] Los colores de superficie usan bg-surface o bg-surface-raised
[ ] Los bordes usan border-border, border-border-subtle o border-border-faint
[ ] Los colores primarios usan text-primary, bg-primary (con opacidad permitida)
[ ] Los inputs usan bg-input o bg-background
```

---

## Flujo para agregar un nuevo token

Si encontrás un valor recurrente que **no tiene token todavía**:

1. Agregarlo en `:root` dentro de `src/styles/theme.css` con comentario semántico.
2. Registrarlo en el bloque `@theme inline` como `--color-nombre: var(--nombre)`.
3. Actualizar esta regla con el nuevo mapeo.
4. **No** crear el componente con el hex hardcodeado como "provisional" — usar el token desde el primer commit.

---

## Estrategia de migración de código legacy

El código existente (pre-2026-04-05) tiene ~600+ instancias hardcodeadas. Ver plan de migración en:
- `project_backlog.md` → `BG-DS-001` (pendiente)

La migración se hace **componente por componente**, nunca con búsqueda-y-reemplazo global ciega.

---

## Relacionados

- [[🧠_Cerebro_Vorea|🧠 Cerebro Colectivo Vorea]]
- [[ux_ui_review_workflow|Workflow UX/UI Review]]
- [[codebase_architecture_boundaries_rule|Arquitectura y Boundaries]]
- `src/styles/theme.css` — fuente de verdad del sistema de tokens
