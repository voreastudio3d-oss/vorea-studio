# Relief — Auto-Generate & Sparkle Button Walkthrough

## Changes Made

### 1. CSS Animations — [theme.css](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/styles/theme.css)

Tres `@keyframes` + clase `.relief-generate-attention`:
- **`relief-pulse`** — Escala 1 → 1.06 → 1 (loop 2s)
- **`relief-glow`** — Box-shadow #C6E36C que crece/decrece
- **`relief-sparkle-rise`** — Pseudo-elementos ✦ que suben y desaparecen

### 2. Relief Component — [Relief.tsx](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/pages/Relief.tsx)

| Feature | Mecanismo |
|---------|-----------|
| **Auto-generate** | `pendingAutoGenerate` ref se activa en `handleImageUpload` y session restore. Un `useEffect` lo detecta y llama `generateRef.current()` con 350ms de delay |
| **Dirty tracking** | `currentParamsKey` (JSON stringify de todos los params) se compara contra `lastGeneratedParamsRef` snapshot tomado en [handleSuccess](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/pages/Relief.tsx#643-696) |
| **Sparkle class** | El botón "Generar Relieve" recibe `relief-generate-attention` cuando `paramsDirty && !generating` |

## Browser Recording

![Auto-generate and sparkle test](file:///C:/Users/marti/.gemini/antigravity/brain/dfc455da-2ac8-4559-96c6-52af781d933c/relief_autogenerate_1773704467756.webp)

## Verification

- ✅ Build Vite exitoso (exit code 0)
- ✅ Auto-generate: subir imagen dispara generación automática sin click manual
- ✅ Dirty detection: cambiar parámetro enciende animación sparkle en el botón
- ✅ Reset: clickear "Generar Relieve" apaga la animación
- ✅ Restaurar sesión: imagen desde sesión anterior también auto-genera
