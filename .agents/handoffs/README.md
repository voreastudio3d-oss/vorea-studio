# Handoffs — Directorio Canónico

> **Regla:** Todo handoff nuevo debe crearse aquí con formato `ai_handoff_YYYY-MM-DD.md`.
> Si hay más de un handoff por día, usar sufijo descriptivo: `ai_handoff_YYYY-MM-DD_topic.md`

## Fuente de verdad
Este directorio es la **única ubicación canónica** para handoffs de IA.
Los handoffs anteriormente dispersos en:
- raíz del proyecto (`ai_handoff_*.md`)
- `.agents/runtime/ai_handoff_*.md`
- `.agents/docs/ai_handoff_*.md`

han sido consolidados aquí el 2026-04-05.

## Convención
- Formato: Markdown con secciones "Qué se hizo", "Hallazgos", "Siguiente paso", "Verificaciones"
- Cada handoff debe ser autosuficiente para que la siguiente IA pueda continuar sin leer handoffs anteriores
- El handoff más reciente siempre está referenciado en `ai_shared_plan.md` → Índice rápido

## Índice (últimos)
- `ai_handoff_2026-04-05.md` — BG-006 + BG-301 monetización hardening + motor LLM verificado
- `ai_handoff_2026-04-05_migrations-pipeline.md` — Prisma migrations pipeline + news summary fix
- `ai_handoff_2026-04-04.md` — Fallback Tree UI & Admin Layout Balancing
- `ai_handoff_2026-04-04_telemetry.md` — BigData Telemetry Pipeline
- `ai_handoff_2026-04-02.md` — Auditoría global + skills nuevas + routing por LLM
- `ai_handoff_2026-04-01.md` — Motor IA Multi-LLM para AI Studio
