# AI Handoff - 2026-04-04 (Fallback Tree UI & Admin Routing)

## 1. Resumen de cambios
- **Qué se cambió**: Se implementó el componente `AiFallbackTree.tsx` en el panel de administración (`AiStudioAdminTab.tsx`) para graficar los intentos de enrutamiento del motor IA con líneas verticales, indicadores visuales de fallo/éxito, y despliegue del proveedor/modelo/costo exacto. Además se movió el componente entero de "Disponibilidad y enrutamiento" a la columna izquierda de la grilla principal para balancear visualmente la página. A su vez, se corrigió un problema de proporción visual (`aspect-video`) en la lista y vista detalle de noticias.
- **Por qué se cambió**: El historial de intentos de LLM se veía como un listado JSON de un solo nivel poco amigable. Las columnas del admin panel estaban desbalanceadas (la derecha sumamente larga y la izquierda corta). 

## 2. Validaciones ejecutadas
- `npm run build` -> Pass (7.56s).
- Smoke test: Validado que auth y endpoints vitales (`/api/admin/kpi`) no fueron rotos.

## 3. Impacto funcional/API
- Cambios puramente frontend/React.
- No hubo impacto funcional en contratos de API; el frontend parsea el modelo de datos `AiGenerationTraceSummary.attemptHistory`.
- Integración completada y fusionada a `develop`.

## 4. i18n
- N/A para esta pasada (las strings internas usadas fueron puramente en español administrativo de sistema).

## 5. Riesgos y pendientes
- A nivel frontend/UX, el tracking del router quedó completado.
- Queda pendiente proceder con la real integración del motor IA/API para que estas trazas se llenen con tráfico genuino fuera del mock (BG-301).

## 6. Ruta agentica usada
- Workflow usado: `agent_handoff_evidence_workflow`, `git_branching_rule`.
- Rama `gemini/feat/fallback-tree-ui` cerrada y fusionada a `develop`.
