# Sistema de Sugerencias IA con Métricas GA4

Integrar GA4 Data API → Gemini → Sugerencias accionables en el panel SuperAdmin, usando las conexiones IA existentes (`fetch()` + `gemini-2.5-flash`).

## Arquitectura

```mermaid
graph LR
    GA4[GA4 Data API v1] -->|runReport| Server[server/ga4-data.ts]
    Server -->|métricas JSON| Gemini[Gemini 2.5 Flash]
    Gemini -->|sugerencias JSON| Endpoint[/api/admin/analytics-insights]
    Endpoint -->|response| UI[SuperAdmin → AnalyticsInsightsTab]
    Cache[KV Cache 6h] -.->|hit| Endpoint
```

## Prerequisitos manuales (Google Cloud Console)

> [!IMPORTANT]
> Estos pasos requieren configuración manual en Google Cloud Console y GA4 Admin.

1. **Google Cloud Console** → proyecto existente de Vorea (`GOOGLE_CLIENT_ID` ya existe)
2. Habilitar **Google Analytics Data API v1**
3. Crear **Service Account** → descargar JSON key
4. **GA4 Admin** → Property Access → agregar el `client_email` del service account con permisos **Viewer**
5. Agregar al [.env](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/.env):
   ```
   GA4_PROPERTY_ID=529863390
   GA4_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
   ```

## Proposed Changes

---

### Data Layer — GA4 Data API Client

#### [NEW] [ga4-data.ts](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/server/ga4-data.ts)

Módulo que autentica con service account y ejecuta `runReport()` via REST API:

- `fetchGa4Metrics(dateRange: "7d" | "30d" | "90d")` → métricas estructuradas
- Métricas extraídas:
  | Métrica | Dimensión | Para qué |
  |---------|-----------|----------|
  | `eventCount` por `eventName` | Top events | ¿Qué herramientas se usan? |
  | `activeUsers` por `pagePath` | Rutas activas | ¿Dónde pasan tiempo? |
  | `eventCount` de `open_tool` por `tool` param | Activación | ¿Qué tool convierte? |
  | `eventCount` de `export_*` | Conversión | ¿Cuántos exports reales? |
  | `eventCount` de `sign_up_*` | Funnel | ¿Signup start → complete? |
  | `eventCount` de `pricing_plan_click` | Revenue | ¿Qué plan atrae? |
  | `sessions`, `newUsers`, `bounceRate` | Overview | Salud general |
- Auth: JWT firmado con private key del service account → access token → `Authorization: Bearer`

---

### AI Analysis Layer — Gemini Integration

#### [NEW] [analytics-insights.ts](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/server/analytics-insights.ts)

Reutiliza el patrón de `summarizeWithGemini()` de [news-service.ts](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/server/news-service.ts):

- `generateAnalyticsInsights(metrics)` → `AnalyticsInsight[]`
- Prompt engineering:
  ```
  Eres un analista de producto de Vorea Studio, una plataforma web de diseño 3D paramétrico.
  
  Datos GA4 de los últimos {periodo}:
  {metrics JSON}
  
  Con base en estos datos, genera exactamente 5 sugerencias accionables en JSON:
  [
    {
      "category": "activation|conversion|retention|growth|risk",
      "priority": "high|medium|low",
      "title": "Título corto de la sugerencia",
      "insight": "Observación basada en datos",
      "action": "Acción concreta recomendada",
      "metric_reference": "Métrica que sustenta la sugerencia"
    }
  ]
  ```
- Categorías de insight:
  - **activation**: ¿Los usuarios prueban las herramientas?
  - **conversion**: ¿Los exports/signups convierten?
  - **retention**: ¿Vuelven los usuarios?
  - **growth**: ¿Crece el tráfico orgánico?
  - **risk**: ¿Alguna métrica baja peligrosamente?

---

### API Endpoint

#### [MODIFY] [app.ts](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/server/app.ts)

Nuevo endpoint protegido por `superadmin`:

```
GET /api/admin/analytics-insights?period=7d|30d|90d
```

Response:
```json
{
  "period": "7d",
  "generatedAt": "2026-03-25T09:00:00Z",
  "metrics": { ... },
  "insights": [ ... ],
  "cached": true
}
```

- Cache en KV (`analytics:insights:{period}`) con TTL de 6 horas para no abusar de cuota Gemini/GA4
- Superadmin-only vía guard existente

---

### Frontend — SuperAdmin Tab

#### [NEW] [AnalyticsInsightsTab.tsx](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/pages/AnalyticsInsightsTab.tsx)

Nuevo tab en SuperAdmin con:

1. **KPI Cards** — sessions, users, signups, exports (últimos 7d)
2. **Tool Usage Chart** — barras horizontales de `open_tool` por herramienta
3. **Funnel** — landing_view → open_tool → export_* → sign_up_complete
4. **Insights AI** — cards con sugerencias de Gemini, coloreadas por categoría/prioridad
5. **Period Selector** — 7d / 30d / 90d
6. **Refresh Button** — fuerza regeneración (invalida cache)

#### [MODIFY] [SuperAdmin.tsx](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/pages/SuperAdmin.tsx)

Agregar `tab === "analytics"` con `<AnalyticsInsightsTab />` en la navegación lateral bajo grupo "Sistema".

#### [MODIFY] [api-client.ts](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/src/app/services/api-client.ts)

Agregar `AdminApi.getAnalyticsInsights(period)` en el cliente API.

---

### Caching & Rate Limiting

- KV cache `analytics:insights:7d` / `analytics:insights:30d` / `analytics:insights:90d`
- TTL: 6 horas (configurable)
- Bypass manual con `?force=true` (superadmin only)
- Cooldown de Gemini: reutilizar el patrón `geminiCooldownUntil` de [news-service.ts](file:///e:/__Vorea-Studio/__3D_parametrics/Vorea-Paramentrics-3D/server/news-service.ts)

---

## Verification Plan

### Automated
- `npm run build` → compila sin errores
- Test unitario para `ga4-data.ts` (mock de fetch, validar parsing de response)
- Test unitario para `analytics-insights.ts` (mock de Gemini, validar prompt y parsing)

### Manual
1. Configurar service account y variables de entorno
2. Llamar `GET /api/admin/analytics-insights?period=7d` con auth superadmin
3. Verificar que metrics contienen datos reales de GA4
4. Verificar que Gemini genera insights relevantes
5. Verificar UI en SuperAdmin → tab Analytics

---

## Costo / Impacto

| Recurso | Impacto |
|---------|---------|
| GA4 Data API | Gratis (cuota: 200K requests/día) |
| Gemini 2.5 Flash | ~$0.001/request (ya en uso) |
| Complejidad | 4 archivos nuevos, 2 mods |
| Tiempo estimado | ~2h implementación |
