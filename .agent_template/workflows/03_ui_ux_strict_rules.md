# 🎨 WORKFLOW OBLIGATORIO: Reglas de Diseño UI/UX

---
description: Prohibición de hardcoding y uso exclusivo de Design Tokens para mantener el proyecto estéticamente premium.
---

## 🚫 1. Prohibiciones Absolutas
- **¡NUNCA uses colores hardcodeados (Hex, RGB, HSL) en archivos o etiquetas `className`!** 
- Ejemplo de lo que **NO** hay que hacer: `className="text-[#4A90E2] bg-gray-500"`
- Si lo haces, romperás el Dark Mode y el sistema completo de theaming.

## ✅ 2. Uso correcto de Design Tokens
Usa siempre la paleta de colores extendida de Tailwind (o las variables CSS que se hayan provisto en index.css durante la inicialización del proyecto).
- Ejemplo de lo que **SÍ** hay que hacer: `className="text-primary-foreground bg-surface-muted"`

## 💫 3. Rich Aesthetics (UX Premium)
- El entorno debe verse vivo: incluye microanimaciones (`transition-all duration-300`).
- Respeta los patrones de `hover`, `active` y `focus-visible`.
- Siempre que el estado cambie, asegúrate de que el loading state sea estilizado adecuadamente (ej: uso de Skeletons en lugar de simples textos "Cargando...").

## ♿ 4. Accesibilidad (A11y)
- Asegura que los componentes mantengan contraste adecuado.
- Aplica etiquetas `aria-label` o `aria-hidden` según corresponda cuando implementes íconos SVG o botones sin texto evidente.
