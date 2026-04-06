# 🔄 Handoff — Prisma Migrations Pipeline + News Summary Fix
**Fecha**: 2026-04-05  
**Agente**: Antigravity (Gemini)  
**Branch**: `develop`  
**Commit**: `3031950`  
**Estado**: ✅ Completado y verificado en local + Railway producción

---

## Qué se hizo

### 1. Pipeline de Migraciones Automáticas (Prisma → Railway)

Se eliminó la dependencia de `prisma db push` y se estableció un pipeline de migraciones formal con historial versionado.

**Problema anterior:** `prisma db push` sobrescribe el schema sin historial. Un schema drift podía silenciosamente desincronizar local y producción sin dejar traza.

**Solución implementada:**

```
schema.prisma → prisma migrate dev → prisma/migrations/XXXXX/migration.sql
                                              ↓
                              [Docker CMD] prisma migrate deploy → Railway DB
```

### Archivos Creados
| Archivo | Propósito |
|---------|-----------|
| `prisma/migrations/0001_baseline/migration.sql` | Baseline completo del schema (578 líneas SQL) |

### Archivos Modificados
| Archivo | Cambio |
|---------|--------|
| `Dockerfile` | CMD: `prisma migrate deploy && tsx server/server.ts` |
| `package.json` | Scripts: `db:migrate`, `db:migrate:deploy`, `db:migrate:status`, `db:migrate:reset` |
| `.github/workflows/ci.yml` | Step: schema drift detection (`migrate diff --exit-code`) |
| `server/news-service.ts` | Summary limit: `320` → `900` chars (ES y EN) |

### Estado en ambos entornos
| Entorno | Estado |
|---------|--------|
| Local (`vorea_studio`) | ✅ `Database schema is up to date!` |
| Railway producción (`railway`) | ✅ `Database schema is up to date!` |
| `telemetry_events` en Railway | ✅ Creada con `IF NOT EXISTS` + FK + 4 índices |

---

### 2. Fix Summary de Noticias

`normalizeEditorialParagraph` en `news-service.ts` cortaba el `summary` a 320 caracteres antes de servir a `NewsDetail.tsx`. Los campos en DB (`summaryEs`, `summaryEn`) son TEXT y ya tenían el contenido completo. Solo se aumentó el límite lógico.

---

## Cómo agregar migraciones futuras

```bash
# 1. Editar prisma/schema.prisma
# 2. Crear migration file:
npm run db:migrate          # → genera prisma/migrations/XXXX_name/migration.sql
# 3. Commitear y pushear:
git add prisma/migrations/ && git commit -m "feat(db): descripción" && git push origin develop
# Railway auto-aplica en el próximo deploy ✨
```

> **NUNCA** usar `prisma db push` en producción — destruye el historial de migraciones.

---

## Reglas Críticas
1. **Usar `prisma migrate dev`** para cambios de schema en local, no `prisma db push`
2. **Commitear siempre `prisma/migrations/`** — sin ese commit, Railway no sabrá qué aplicar
3. **`migrate deploy` es idempotente** — si no hay migraciones nuevas, no hace nada (0ms)
4. **En Railway, el CMD del Dockerfile aplica las migraciones** — no ejecutar manualmente salvo emergencia
5. **Para emergencias de schema drift**, usar `prisma migrate resolve --applied "nombre"` con la URL pública de Railway

---

## Pendientes
- Ninguno. El pipeline está completo y verificado.
