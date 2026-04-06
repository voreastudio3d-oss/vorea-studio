# 🔄 Handoff — BigData Telemetry Pipeline
**Fecha**: 2026-04-04  
**Agente**: Antigravity (Gemini)  
**Branch**: `develop`  
**Estado**: ✅ Implementado, compilado, listo para deploy

---

## Qué se hizo

Se reemplazó el sistema ad-hoc de telemetría (JSON blobs en KV) por un **pipeline BigData dedicado** con columnas tipadas en PostgreSQL para analytics SQL.

### Arquitectura en 3 Capas

```
[Relief.tsx] → telemetry.track() → [TelemetryCollector] → batch POST → [PostgreSQL telemetry_events]
                                         ↓ sendBeacon (on tab close)
                                    [KV snapshots] ← referenced by snapshotId
```

### Archivos Creados
| Archivo | Propósito |
|---------|-----------|
| `src/app/services/telemetry-collector.ts` | Singleton frontend: buffer async, flush cada 30s/10 eventos, sendBeacon |

### Archivos Modificados
| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Modelo `TelemetryEvent` con 30+ columnas tipadas + índices |
| `server/app.ts` | 4 endpoints: batch (Prisma), snapshot upload/serve, insights admin |
| `src/app/pages/Relief.tsx` | 3 puntos instrumentados: generation, export_stl, export_3mf |
| `src/app/pages/FeedbackAdmin.tsx` | Removidos campos BigData (generationParams, modelSnapshotUrl) |
| `src/app/services/db/prisma-services.ts` | Limpiado PrismaFeedbackService de campos BigData |

### Endpoints del Server
| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/telemetry/batch` | POST | Opcional | Inserta eventos en PostgreSQL via Prisma createMany |
| `/api/telemetry/snapshot` | POST | Rate limit | Sube WebP a KV, retorna snapshotId |
| `/api/telemetry/snapshot/:id` | GET | Público | Sirve imagen con cache inmutable |
| `/api/telemetry/insights` | GET | SuperAdmin | Analytics SQL: groupBy trigger/surface/mesh, avg times |

---

## Verificación
- ✅ `npx prisma generate` — client regenerado con TelemetryEvent
- ✅ `npx tsc --noEmit` — 0 errores TypeScript
- ✅ `npx vite build` — 2643 módulos, 14.25s, 0 errores

---

## Pendientes (2)

### 1. `prisma db push` — Aplicar schema a PostgreSQL
**Estado**: No se pudo ejecutar porque PostgreSQL local no está corriendo.  
**Acción**: Al hacer deploy a Railway, el schema se aplica automáticamente. Si se necesita local:
```bash
# Iniciar PostgreSQL local, luego:
npx prisma db push
```

### 2. Tab "Telemetry" en FeedbackAdmin
**Estado**: El endpoint `/api/telemetry/insights` ya funciona y devuelve:
- `totalEvents` — conteo total
- `byTrigger` — eventos por tipo (generation, export_stl, export_3mf)
- `bySurfaceMode` — distribución por modo de superficie
- `byMeshScore` — distribución de salud del mesh
- `warningCombos` — top 10 combinaciones que generan warnings
- `avgGenTime` — tiempo medio de generación por surfaceMode

**Acción**: Crear un componente con charts (recharts o similar) en FeedbackAdmin que consuma `GET /api/telemetry/insights?days=30`.

---

## Reglas Críticas
1. **No guardar imágenes Base64 en PostgreSQL** — snapshots van a KV, referenciados por ID
2. **Feedback ≠ Telemetría** — Feedback es ticket de soporte, TelemetryEvent es datos de motor
3. **Rate limiting**: telemetry batch 60/min/IP, snapshots 30/10min/IP
4. **El collector es silencioso** — nunca muestra errores al usuario, nunca bloquea UI
