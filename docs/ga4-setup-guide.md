# Guía de Configuración: Google Analytics 4 → AI Insights

## Descripción

El sistema de sugerencias IA de Vorea conecta **GA4 Data API** con **Gemini 2.5 Flash** para generar insights accionables visibles en el SuperAdmin (tab "Analytics IA").

Sin configurar GA4 Data API, el dashboard ya no inventa métricas por defecto: muestra el estado como **no configurado** hasta que existan datos reales. El modo mock sigue disponible solo de forma explícita con `ADMIN_ANALYTICS_ALLOW_MOCK=true`.

---

## Prerequisitos

- Acceso a [Google Cloud Console](https://console.cloud.google.com)
- Propiedad GA4: **Vorea Studio 3D** (`G-23WBNB1753`, Property ID: `529863390`)
- Variables de entorno en Railway/.env

---

## Paso 1: Habilitar la API

1. Ir a [Google Cloud Console](https://console.cloud.google.com)
2. Seleccionar el proyecto de Vorea (o crearlo)
3. Ir a **APIs & Services → Library**
4. Buscar **"Google Analytics Data API"** (v1)
5. Click **Enable**

> ⚠️ No confundir con "Google Analytics Admin API" ni con "Google Analytics Reporting API" (legacy UA).

---

## Paso 2: Crear Service Account

1. En Google Cloud Console: **IAM & Admin → Service Accounts**
2. Click **"Create Service Account"**
3. Nombre: `vorea-analytics-reader`
4. Descripción: `Lee métricas GA4 para insights IA`
5. Click **Create and Continue**
6. No asignar roles de proyecto (no necesita)
7. Click **Done**
8. Abrir el service account recién creado
9. Tab **"Keys"** → **Add Key → Create new key**
10. Tipo: **JSON** → Click **Create**
11. Se descarga un `.json` — guardarlo de forma segura

---

## Paso 3: Dar acceso en GA4

1. Ir a [analytics.google.com](https://analytics.google.com)
2. Click ⚙️ **Admin** (abajo a la izquierda)
3. En la columna de Property: **Property Access Management**
4. Click **"+"** → **Add users**
5. Pegar el `client_email` del JSON descargado (ejemplo: `vorea-analytics-reader@proyecto.iam.gserviceaccount.com`)
6. Permisos: **Viewer** (solo lectura) ✓
7. Click **Add**

---

## Paso 4: Variables de entorno

Agregar al `.env` local y a Railway:

```env
# GA4 Data API
GA4_PROPERTY_ID=529863390
GA4_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"vorea-xxx","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"vorea-analytics-reader@vorea-xxx.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}
```

> **IMPORTANTE**: El valor de `GA4_SERVICE_ACCOUNT_KEY` es el **JSON completo en una sola línea** (sin saltos de línea excepto los que están dentro de `private_key`).

Para Railway:
```bash
railway variables set GA4_PROPERTY_ID=529863390
railway variables set GA4_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
```

---

## Paso 5: Verificar

1. En Vorea → SuperAdmin → Sistema → **Analytics IA**
2. Seleccionar período (7d/30d/90d)
3. Si aparece `[MOCK DATA]` → la API no está configurada aún
4. Si aparecen datos reales → ✅ todo funciona
5. Los insights IA se generan con Gemini y se cachean 6 horas

Si quieres habilitar mock de forma explícita en desarrollo:

```env
ADMIN_ANALYTICS_ALLOW_MOCK=true
```

---

## Métricas extraídas

| Reporte | Dimensiones | Métricas | Para qué |
|---------|-------------|----------|----------|
| Overview | — | sessions, activeUsers, newUsers, bounceRate | Salud general |
| Top Events | eventName | eventCount | ¿Qué se usa? |
| Tool Usage | customEvent:tool | eventCount | ¿Qué herramienta convierte? |
| Exports | eventName (export_*) | eventCount | Conversión real |
| Signup Funnel | eventName | eventCount | landing → signup flow |
| Top Pages | pagePath | screenPageViews, activeUsers | ¿Dónde miran? |
| Pricing Clicks | customEvent:plan | eventCount | ¿Qué plan atrae? |

---

## Categorías de insights IA

| Categoría | Pregunta que responde |
|-----------|----------------------|
| **activation** | ¿Los usuarios prueban las herramientas? |
| **conversion** | ¿Los exports/signups convierten? |
| **retention** | ¿Vuelven los usuarios? |
| **growth** | ¿Crece el tráfico orgánico? |
| **risk** | ¿Alguna métrica baja peligrosamente? |

---

## Costos

| Recurso | Costo |
|---------|-------|
| GA4 Data API | Gratis (cuota: 200K requests/día) |
| Gemini 2.5 Flash | ~$0.001/request |
| Cache | 6h → máximo ~4 llamadas Gemini/día por período |

---

## Archivos del sistema

- `server/ga4-data.ts` — Cliente GA4 Data API + mock explícito
- `server/analytics-insights.ts` — Prompt Gemini + fallback
- `server/app.ts` → `GET /api/admin/analytics-insights`
- `src/app/pages/AnalyticsInsightsTab.tsx` — Dashboard UI
