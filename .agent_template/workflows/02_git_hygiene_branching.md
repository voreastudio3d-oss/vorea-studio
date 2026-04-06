# 🌿 WORKFLOW OBLIGATORIO: Ramas, Git y Commits

---
description: Reglas de operación con git para evitar colisiones y pérdida de progreso.
---

Este documento estandariza la interacción con el control de versiones, asegurando que IAs y humanos mantengan un histórico limpio y trazable.

## 🛡️ 1. Ramas Principales Protegidas
- **`main` / `master`:** Producción. Solo recibe merges tras validación y aprobación final. NUNCA se hace commit directo aquí.
- **`develop`:** Staging / Integración. Recibe merges de las ramas operativas. Las IAs solo operan aquí cuando hacen fix puntuales si así está pautado en el `current_block`.

## 🛠️ 2. Flujo de Trabajo Operativo (Feature Branches)
Toda IA que asuma una tarea debe crear una rama con la convención adecuada antes de empezar a codear.

**Nomenclatura permitida:**
- `feat/nombre-de-la-feature`
- `fix/nombre-del-arreglo`
- `chore/actualizaciones-menores`
- `[modelo-ia]/feat/nombre` (Ej: `claude/feat/auth-login`) para rastrear qué agente introdujo el bloque.

// turbo
## 🚀 3. Commits Estratégicos y Semánticos
1. Haz commits atómicos (cuando una lógica esté autocontenida y funcione sin quebrar el entorno). NO hagas un super-commit gigante al final del día.
2. Usa el formato Semantic Commit:
   - `feat(auth): agrega validación de tokens JWT`
   - `fix(ui): repara solapamiento de la botonera principal`
   - `docs(ai): actualiza el handoff del día`

## ⚠️ 4. Recuperación y Sync (Pull strategy)
Antes de pushear, asegúrate de hacer Pull desde la rama base para evitar conflictos si hubieron colaboraciones paralelas.
En caso de detectar conflictos graves, PAUSA y avisa al usuario, o detalla el problema para que una instancia posterior con mayor ventana de contexto lo resuelva.
