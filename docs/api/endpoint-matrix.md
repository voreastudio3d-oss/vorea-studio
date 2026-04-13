# Inventario Operativo de Endpoints

Generado: 2026-04-13T13:40:09.386Z

Total definiciones detectadas: **151**
Total únicos (method+path): **147**
Definiciones duplicadas detectadas: **4**

| Método | Path | Auth | Rol | Estado | Dependencias | Errores | Origen |
|---|---|---|---|---|---|---|---|
| GET | `/api/activity` | authenticated | authenticated_user | active | kv | 401, 500 | `server/app.ts:2073` |
| GET | `/api/admin/activity/:userId` | superadmin | superadmin | active | kv | 500 | `server/app.ts:2086` |
| GET | `/api/admin/ai-budget` | superadmin | superadmin | active | kv, paypal | 500 | `server/app.ts:3570` |
| PUT | `/api/admin/ai-budget` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3592` |
| DELETE | `/api/admin/ai-lane-matrix` | superadmin | superadmin | active | — | 500 | `server/app.ts:3657` |
| GET | `/api/admin/ai-lane-matrix` | superadmin | superadmin | active | — | 500 | `server/app.ts:3631` |
| PUT | `/api/admin/ai-lane-matrix` | superadmin | superadmin | active | — | 400, 500 | `server/app.ts:3641` |
| GET | `/api/admin/alerts` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5434` |
| PUT | `/api/admin/alerts` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5451` |
| GET | `/api/admin/analytics` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5006` |
| GET | `/api/admin/analytics-insights` | superadmin | superadmin | active | kv | 500 | `server/app.ts:2893` |
| GET | `/api/admin/check` | superadmin | superadmin | active | — | 500 | `server/app.ts:2976` |
| POST | `/api/admin/community/cleanup` | superadmin | superadmin | active | — | 500 | `server/app.ts:8002` |
| GET | `/api/admin/community/models` | superadmin | superadmin | active | — | 500 | `server/app.ts:7912` |
| PUT | `/api/admin/contributors/:userId` | superadmin | superadmin | active | kv | 400, 404, 500 | `server/app.ts:6440` |
| GET | `/api/admin/credit-packs` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3446` |
| PUT | `/api/admin/credit-packs` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3457` |
| GET | `/api/admin/donations` | superadmin | superadmin | active | kv, paypal | 500 | `server/app.ts:6287` |
| POST | `/api/admin/email` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:5463` |
| GET | `/api/admin/emails` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5508` |
| POST | `/api/admin/expenses` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:5416` |
| GET | `/api/admin/image-limits` | superadmin | superadmin | active | kv | 500 | `server/app.ts:4456` |
| PUT | `/api/admin/image-limits` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:4467` |
| POST | `/api/admin/init` | superadmin | superadmin | active | kv | 401, 403, 404, 500 | `server/app.ts:2819` |
| GET | `/api/admin/kpi` | superadmin | superadmin | active | kv | 500 | `server/app.ts:2098` |
| GET | `/api/admin/limits` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3484` |
| PUT | `/api/admin/limits` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3504` |
| GET | `/api/admin/logs` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5522` |
| POST | `/api/admin/news/ingest` | superadmin | superadmin | active | paypal | 500 | `server/app.ts:8322` |
| GET | `/api/admin/news/source-stats` | superadmin | superadmin | active | — | 500 | `server/app.ts:8313` |
| GET | `/api/admin/news/sources` | superadmin | superadmin | active | — | 500 | `server/app.ts:8268` |
| POST | `/api/admin/news/sources` | superadmin | superadmin | active | — | 201, 400, 500 | `server/app.ts:8289` |
| DELETE | `/api/admin/news/sources/:id` | superadmin | superadmin | active | — | 404, 500 | `server/app.ts:8302` |
| PUT | `/api/admin/news/sources/:id` | superadmin | superadmin | active | — | 404, 500 | `server/app.ts:8277` |
| GET | `/api/admin/plans` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3182` |
| PUT | `/api/admin/plans` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3197` |
| GET | `/api/admin/promotions` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5048` |
| PUT | `/api/admin/promotions` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:5059` |
| DELETE | `/api/admin/promotions/:id` | superadmin | superadmin | active | kv | 404, 500 | `server/app.ts:5093` |
| GET | `/api/admin/reports/regional-stats` | superadmin | superadmin | active | prisma | 500 | `server/app.ts:5171` |
| GET | `/api/admin/reports/revenue` | superadmin | superadmin | active | kv, paypal | 500 | `server/app.ts:5201` |
| GET | `/api/admin/reports/usage` | superadmin | superadmin | active | kv, paypal | 500 | `server/app.ts:5114` |
| POST | `/api/admin/reset-owner-password` | superadmin | superadmin | active | kv | 400, 403, 500 | `server/app.ts:2727` |
| GET | `/api/admin/tool-credits` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3529` |
| PUT | `/api/admin/tool-credits` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3540` |
| POST | `/api/admin/tool-credits/legacy-migrate` | superadmin | superadmin | active | — | 500 | `server/app.ts:3168` |
| GET | `/api/admin/tool-credits/legacy-status` | superadmin | superadmin | active | — | 500 | `server/app.ts:3157` |
| GET | `/api/admin/users` | superadmin | superadmin | active | kv | 500 | `server/app.ts:2986` |
| DELETE | `/api/admin/users/:id` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3058` |
| PUT | `/api/admin/users/:id` | superadmin | superadmin | active | kv | 404, 500 | `server/app.ts:3016` |
| POST | `/api/admin/users/cleanup-duplicates` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3088` |
| GET | `/api/ai/budget-status` | public | public | active | kv | 500 | `server/app.ts:4338` |
| GET | `/api/ai/history` | authenticated | authenticated_user | active | kv | 401, 500 | `server/app.ts:4195` |
| POST | `/api/ai/history` | authenticated | authenticated_user | active | kv | 400, 401, 500 | `server/app.ts:4212` |
| DELETE | `/api/ai/history/:id` | authenticated | authenticated_user | active | kv | 400, 401, 404, 500 | `server/app.ts:4271` |
| POST | `/api/ai/quick-fix` | optional-auth | public_or_authenticated | active | — | 400, 500 | `server/app.ts:4367` |
| GET | `/api/ai/recipes` | authenticated | authenticated_user | active | kv | 401, 500 | `server/app.ts:4104` |
| POST | `/api/ai/recipes` | authenticated | authenticated_user | active | kv | 400, 401, 500 | `server/app.ts:4119` |
| DELETE | `/api/ai/recipes/:id` | authenticated | authenticated_user | active | kv | 400, 401, 404, 500 | `server/app.ts:4172` |
| POST | `/api/ai/track-spend` | authenticated | authenticated_user | active | kv | 400, 401, 403, 500 | `server/app.ts:4406` |
| POST | `/api/auth/google` | public | public | duplicated_definition | external_http, kv | 400, 401, 403, 500 | `server/app.ts:1861` |
| POST | `/api/auth/google` | public | public | duplicated_definition | kv | 400, 401, 500, 503 | `server/app.ts:5768` |
| GET | `/api/auth/google/config` | public | public | duplicated_definition | — | — | `server/app.ts:1852` |
| GET | `/api/auth/google/config` | public | public | duplicated_definition | — | — | `server/app.ts:5881` |
| GET | `/api/auth/me` | optional-auth | public_or_authenticated | active | kv | 401, 404, 500 | `server/app.ts:1511` |
| PUT | `/api/auth/me` | optional-auth | public_or_authenticated | active | kv | 401, 404, 409, 500 | `server/app.ts:1795` |
| PUT | `/api/auth/me/password` | optional-auth | public_or_authenticated | active | — | 400, 401, 403, 404, 500 | `server/app.ts:1545` |
| POST | `/api/auth/refresh` | public | public | active | — | 401, 403, 404, 500 | `server/app.ts:1493` |
| POST | `/api/auth/request-email-verification` | optional-auth | public_or_authenticated | active | kv | 401, 403, 404, 500 | `server/app.ts:1342` |
| POST | `/api/auth/request-reset` | public | public | active | kv | 400, 500 | `server/app.ts:1192` |
| POST | `/api/auth/reset-password` | public | public | active | kv | 400, 500 | `server/app.ts:1273` |
| POST | `/api/auth/signin` | public | public | active | kv | 400, 401, 403, 500 | `server/app.ts:1132` |
| POST | `/api/auth/signout` | public | public | active | kv, paypal | — | `server/app.ts:5888` |
| POST | `/api/auth/signup` | public | public | active | kv | 400, 500 | `server/app.ts:1057` |
| GET | `/api/auth/social-providers` | public | public | active | — | — | `server/app.ts:2712` |
| POST | `/api/auth/verify-email` | optional-auth | public_or_authenticated | active | kv | 400, 401, 404, 500 | `server/app.ts:1422` |
| GET | `/api/community/models` | public | public | active | — | 500 | `server/app.ts:7168` |
| POST | `/api/community/models` | superadmin | superadmin | active | kv | 201, 400, 401, 403, 404, 500 | `server/app.ts:7323` |
| DELETE | `/api/community/models/:id` | superadmin | superadmin | active | — | 401, 403, 404, 500 | `server/app.ts:7592` |
| GET | `/api/community/models/:id` | public | public | active | — | 404, 500 | `server/app.ts:7267` |
| PUT | `/api/community/models/:id` | superadmin | superadmin | active | kv | 400, 401, 403, 404, 500 | `server/app.ts:7491` |
| GET | `/api/community/models/:id/comments` | public | public | active | kv | 404, 500 | `server/app.ts:8048` |
| POST | `/api/community/models/:id/comments` | authenticated | authenticated_user | active | kv | 400, 401, 403, 404, 500 | `server/app.ts:8065` |
| DELETE | `/api/community/models/:id/comments/:commentId` | authenticated | authenticated_user | active | kv | 401, 403, 404, 500 | `server/app.ts:8123` |
| POST | `/api/community/models/:id/download` | authenticated | authenticated_user | active | kv | 401, 403, 404, 500 | `server/app.ts:7696` |
| POST | `/api/community/models/:id/feature` | superadmin | superadmin | active | — | 400, 403, 404, 500 | `server/app.ts:7875` |
| GET | `/api/community/models/:id/forks` | public | public | active | — | 404, 500 | `server/app.ts:7751` |
| POST | `/api/community/models/:id/like` | authenticated | authenticated_user | active | kv | 401, 403, 404, 500 | `server/app.ts:7635` |
| GET | `/api/community/tags` | public | public | active | — | 500 | `server/app.ts:7777` |
| GET | `/api/community/users/:id` | public | public | active | kv | 404, 500 | `server/app.ts:7805` |
| GET | `/api/config/business` | public | public | active | kv | 500 | `server/app.ts:3402` |
| POST | `/api/contact` | optional-auth | public_or_authenticated | active | kv | 400, 500 | `server/app.ts:2308` |
| GET | `/api/content/hero-banner` | public | public | active | kv | 500 | `server/app.ts:8224` |
| PUT | `/api/content/hero-banner` | superadmin | superadmin | active | kv | 400, 403, 500 | `server/app.ts:8234` |
| GET | `/api/contributors` | public | public | active | kv | 500 | `server/app.ts:6477` |
| GET | `/api/credits` | optional-auth | public_or_authenticated | active | kv | 401, 500 | `server/app.ts:2180` |
| POST | `/api/credits/consume` | optional-auth | public_or_authenticated | active | kv, paypal | 401, 402, 500 | `server/app.ts:2218` |
| POST | `/api/credits/purchase` | superadmin | superadmin | active | kv, paypal | 400, 403, 500 | `server/app.ts:2266` |
| POST | `/api/donations/capture-order` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 403, 404, 409, 500 | `server/app.ts:6646` |
| POST | `/api/donations/create-order` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 500 | `server/app.ts:6565` |
| GET | `/api/donations/me` | authenticated | authenticated_user | active | kv | 401, 500 | `server/app.ts:6509` |
| PUT | `/api/donations/me` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 404, 500 | `server/app.ts:6528` |
| GET | `/api/feedback` | superadmin | superadmin | active | kv | 403, 500 | `server/app.ts:2419` |
| POST | `/api/feedback` | optional-auth | public_or_authenticated | active | kv | 400, 500 | `server/app.ts:2381` |
| PUT | `/api/feedback/:id/status` | superadmin | superadmin | active | kv, paypal | 400, 403, 404, 500 | `server/app.ts:2643` |
| POST | `/api/feedback/ai-review` | superadmin | superadmin | active | external_http, kv | 403, 500 | `server/app.ts:2439` |
| GET | `/api/feedback/ai-stats` | superadmin | superadmin | active | kv | 403, 500 | `server/app.ts:2589` |
| GET | `/api/gcode` | public | public | active | kv | 500 | `server/app.ts:1992` |
| POST | `/api/gcode` | public | public | active | kv | 400, 403, 500 | `server/app.ts:2009` |
| DELETE | `/api/gcode/:id` | public | public | active | kv | 500 | `server/app.ts:2054` |
| GET | `/api/health` | public | public | active | — | — | `server/app.ts:955` |
| POST | `/api/internal/mcp/tool/:tool` | public | public | active | — | 400, 401, 500 | `server/app.ts:1017` |
| POST | `/api/internal/news/cleanup` | public | public | active | — | 401, 500 | `server/news-routes.ts:70` |
| POST | `/api/internal/news/ingest` | public | public | active | — | 401, 500 | `server/news-routes.ts:51` |
| GET | `/api/news` | public | public | active | — | 500 | `server/news-routes.ts:22` |
| GET | `/api/news/:slug` | public | public | active | — | 404, 500 | `server/news-routes.ts:38` |
| POST | `/api/paypal/capture-order` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 403, 404, 409, 500 | `server/app.ts:6133` |
| GET | `/api/paypal/client-id` | public | public | duplicated_definition | paypal | — | `server/app.ts:2703` |
| GET | `/api/paypal/client-id` | public | public | duplicated_definition | paypal | 503 | `server/app.ts:6035` |
| POST | `/api/paypal/create-order` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 409, 500 | `server/app.ts:6042` |
| POST | `/api/promotions/redeem` | authenticated | authenticated_user | active | kv | 400, 401, 404, 500 | `server/app.ts:4532` |
| POST | `/api/promotions/validate` | public | public | active | kv | 400, 500 | `server/app.ts:4486` |
| GET | `/api/rewards/:userId` | public | public | active | kv | 500 | `server/app.ts:4674` |
| GET | `/api/rewards/leaderboard` | public | public | active | kv | 500 | `server/app.ts:8185` |
| GET | `/api/rewards/me` | authenticated | authenticated_user | duplicated_definition | kv | 401, 500 | `server/app.ts:4648` |
| GET | `/api/rewards/me` | authenticated | authenticated_user | duplicated_definition | kv | 401, 500 | `server/app.ts:8165` |
| POST | `/api/rewards/trigger` | authenticated | authenticated_user | active | kv | 400, 401, 500 | `server/app.ts:4695` |
| GET | `/api/subscriptions/client-id` | public | public | active | paypal | — | `server/paypal-subscriptions.ts:137` |
| POST | `/api/subscriptions/create` | authenticated | authenticated_user | active | paypal, prisma | 400, 401, 403, 404, 500 | `server/paypal-subscriptions.ts:142` |
| GET | `/api/subscriptions/my-subscription` | public | public | active | paypal, prisma | 500 | `server/paypal-subscriptions.ts:261` |
| GET | `/api/subscriptions/plans` | public | public | active | paypal | — | `server/paypal-subscriptions.ts:132` |
| POST | `/api/subscriptions/webhook` | public | public | active | kv, paypal, prisma | 400, 500 | `server/paypal-subscriptions.ts:286` |
| POST | `/api/telemetry/batch` | optional-auth | public_or_authenticated | active | kv, prisma | 400, 500 | `server/app.ts:4825` |
| GET | `/api/telemetry/insights` | superadmin | superadmin | active | prisma | 403, 500 | `server/app.ts:4918` |
| POST | `/api/telemetry/snapshot` | public | public | active | kv | 400, 500 | `server/app.ts:4765` |
| GET | `/api/telemetry/snapshot/:id` | public | public | active | kv | 404, 500 | `server/app.ts:4806` |
| POST | `/api/tool-actions/consume` | authenticated | authenticated_user | active | kv | 400, 401, 403, 500 | `server/app.ts:7284` |
| GET | `/api/tool-credits/me` | optional-auth | public_or_authenticated | active | kv | 401, 500 | `server/app.ts:2200` |
| POST | `/api/uploads/community-image` | authenticated | authenticated_user | active | kv | 400, 401, 500 | `server/app.ts:6958` |
| GET | `/api/uploads/community-image/:id` | public | public | active | kv | 404, 500 | `server/app.ts:7015` |
| POST | `/api/uploads/thumbnail` | authenticated | authenticated_user | active | kv | 400, 401, 403, 500 | `server/app.ts:6905` |
| GET | `/api/uploads/thumbnail/:id` | public | public | active | kv | 404, 500 | `server/app.ts:7006` |
| GET | `/api/vault/keys` | superadmin | superadmin | active | kv | 403, 500 | `server/app.ts:5543` |
| DELETE | `/api/vault/keys/:provider` | superadmin | superadmin | active | kv | 403, 500 | `server/app.ts:5633` |
| PUT | `/api/vault/keys/:provider` | superadmin | superadmin | active | kv | 400, 403, 500 | `server/app.ts:5575` |
| POST | `/api/vault/keys/:provider/test` | superadmin | superadmin | active | external_http, kv | 403, 404, 500 | `server/app.ts:5659` |
| GET | `/og/:slug` | public | public | active | — | 200 | `server/app.ts:998` |
| GET | `/og/default.svg` | public | public | active | — | 200 | `server/app.ts:990` |
| GET | `/robots.txt` | public | public | active | — | 200 | `server/app.ts:960` |
| GET | `/sitemap.xml` | public | public | active | — | 200 | `server/app.ts:969` |
| GET | `/sitemaps/:section.xml` | public | public | active | — | 200, 404 | `server/app.ts:977` |
