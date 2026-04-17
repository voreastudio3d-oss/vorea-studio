# Inventario Operativo de Endpoints

Generado: 2026-04-16T17:38:13.044Z

Total definiciones detectadas: **154**
Total únicos (method+path): **150**
Definiciones duplicadas detectadas: **4**

| Método | Path | Auth | Rol | Estado | Dependencias | Errores | Origen |
|---|---|---|---|---|---|---|---|
| GET | `/api/activity` | authenticated | authenticated_user | active | kv | 401, 500 | `server/app.ts:2065` |
| GET | `/api/admin/activity/:userId` | superadmin | superadmin | active | kv | 500 | `server/app.ts:2078` |
| GET | `/api/admin/ai-budget` | superadmin | superadmin | active | kv, paypal | 500 | `server/app.ts:3561` |
| PUT | `/api/admin/ai-budget` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3583` |
| DELETE | `/api/admin/ai-lane-matrix` | superadmin | superadmin | active | — | 500 | `server/app.ts:3648` |
| GET | `/api/admin/ai-lane-matrix` | superadmin | superadmin | active | — | 500 | `server/app.ts:3622` |
| PUT | `/api/admin/ai-lane-matrix` | superadmin | superadmin | active | — | 400, 500 | `server/app.ts:3632` |
| GET | `/api/admin/alerts` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5514` |
| PUT | `/api/admin/alerts` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5531` |
| GET | `/api/admin/analytics` | superadmin | superadmin | active | kv | 500 | `server/app.ts:4997` |
| GET | `/api/admin/analytics-insights` | superadmin | superadmin | active | kv | 500 | `server/app.ts:2884` |
| GET | `/api/admin/check` | superadmin | superadmin | active | — | 500 | `server/app.ts:2967` |
| POST | `/api/admin/community/cleanup` | superadmin | superadmin | active | — | 500 | `server/app.ts:8213` |
| GET | `/api/admin/community/models` | superadmin | superadmin | active | — | 500 | `server/app.ts:8123` |
| PUT | `/api/admin/community/models/:id/moderate` | superadmin | superadmin | active | — | 400, 404, 500 | `server/app.ts:8257` |
| PUT | `/api/admin/contributors/:userId` | superadmin | superadmin | active | kv | 400, 404, 500 | `server/app.ts:6544` |
| GET | `/api/admin/credit-packs` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3437` |
| PUT | `/api/admin/credit-packs` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3448` |
| GET | `/api/admin/donations` | superadmin | superadmin | active | kv, paypal | 500 | `server/app.ts:6391` |
| POST | `/api/admin/email` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:5543` |
| GET | `/api/admin/emails` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5588` |
| POST | `/api/admin/expenses` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:5496` |
| GET | `/api/admin/image-limits` | superadmin | superadmin | active | kv | 500 | `server/app.ts:4447` |
| PUT | `/api/admin/image-limits` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:4458` |
| POST | `/api/admin/init` | superadmin | superadmin | active | kv | 401, 403, 404, 500 | `server/app.ts:2810` |
| GET | `/api/admin/kpi` | superadmin | superadmin | active | kv | 500 | `server/app.ts:2090` |
| GET | `/api/admin/limits` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3475` |
| PUT | `/api/admin/limits` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3495` |
| GET | `/api/admin/logs` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5602` |
| POST | `/api/admin/news/ingest` | superadmin | superadmin | active | paypal | 500 | `server/app.ts:8603` |
| GET | `/api/admin/news/source-stats` | superadmin | superadmin | active | — | 500 | `server/app.ts:8594` |
| GET | `/api/admin/news/sources` | superadmin | superadmin | active | — | 500 | `server/app.ts:8549` |
| POST | `/api/admin/news/sources` | superadmin | superadmin | active | — | 201, 400, 500 | `server/app.ts:8570` |
| DELETE | `/api/admin/news/sources/:id` | superadmin | superadmin | active | — | 404, 500 | `server/app.ts:8583` |
| PUT | `/api/admin/news/sources/:id` | superadmin | superadmin | active | — | 404, 500 | `server/app.ts:8558` |
| GET | `/api/admin/plans` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3173` |
| PUT | `/api/admin/plans` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3188` |
| GET | `/api/admin/promotions` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5039` |
| PUT | `/api/admin/promotions` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:5050` |
| DELETE | `/api/admin/promotions/:id` | superadmin | superadmin | active | kv | 404, 500 | `server/app.ts:5084` |
| GET | `/api/admin/reports/acquisition` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5192` |
| GET | `/api/admin/reports/regional-stats` | superadmin | superadmin | active | prisma | 500 | `server/app.ts:5162` |
| GET | `/api/admin/reports/revenue` | superadmin | superadmin | active | kv, paypal | 500 | `server/app.ts:5281` |
| GET | `/api/admin/reports/usage` | superadmin | superadmin | active | kv, paypal | 500 | `server/app.ts:5105` |
| POST | `/api/admin/reset-owner-password` | superadmin | superadmin | active | kv | 400, 403, 500 | `server/app.ts:2718` |
| GET | `/api/admin/tool-credits` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3520` |
| PUT | `/api/admin/tool-credits` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3531` |
| POST | `/api/admin/tool-credits/legacy-migrate` | superadmin | superadmin | active | — | 500 | `server/app.ts:3159` |
| GET | `/api/admin/tool-credits/legacy-status` | superadmin | superadmin | active | — | 500 | `server/app.ts:3148` |
| GET | `/api/admin/users` | superadmin | superadmin | active | kv | 500 | `server/app.ts:2977` |
| DELETE | `/api/admin/users/:id` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3049` |
| PUT | `/api/admin/users/:id` | superadmin | superadmin | active | kv | 404, 500 | `server/app.ts:3007` |
| POST | `/api/admin/users/cleanup-duplicates` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3079` |
| GET | `/api/ai/budget-status` | public | public | active | kv | 500 | `server/app.ts:4329` |
| GET | `/api/ai/history` | authenticated | authenticated_user | active | kv | 401, 500 | `server/app.ts:4186` |
| POST | `/api/ai/history` | authenticated | authenticated_user | active | kv | 400, 401, 500 | `server/app.ts:4203` |
| DELETE | `/api/ai/history/:id` | authenticated | authenticated_user | active | kv | 400, 401, 404, 500 | `server/app.ts:4262` |
| POST | `/api/ai/quick-fix` | optional-auth | public_or_authenticated | active | — | 400, 500 | `server/app.ts:4358` |
| GET | `/api/ai/recipes` | authenticated | authenticated_user | active | kv | 401, 500 | `server/app.ts:4095` |
| POST | `/api/ai/recipes` | authenticated | authenticated_user | active | kv | 400, 401, 500 | `server/app.ts:4110` |
| DELETE | `/api/ai/recipes/:id` | authenticated | authenticated_user | active | kv | 400, 401, 404, 500 | `server/app.ts:4163` |
| POST | `/api/ai/track-spend` | authenticated | authenticated_user | active | kv | 400, 401, 403, 500 | `server/app.ts:4397` |
| POST | `/api/auth/google` | public | public | duplicated_definition | external_http, kv | 400, 401, 403, 500 | `server/app.ts:1853` |
| POST | `/api/auth/google` | public | public | duplicated_definition | kv | 400, 401, 500, 503 | `server/app.ts:5848` |
| GET | `/api/auth/google/config` | public | public | duplicated_definition | — | — | `server/app.ts:1844` |
| GET | `/api/auth/google/config` | public | public | duplicated_definition | — | — | `server/app.ts:5961` |
| GET | `/api/auth/me` | optional-auth | public_or_authenticated | active | kv | 401, 404, 500 | `server/app.ts:1503` |
| PUT | `/api/auth/me` | optional-auth | public_or_authenticated | active | kv | 401, 404, 409, 500 | `server/app.ts:1787` |
| PUT | `/api/auth/me/password` | optional-auth | public_or_authenticated | active | — | 400, 401, 403, 404, 500 | `server/app.ts:1537` |
| POST | `/api/auth/refresh` | public | public | active | — | 401, 403, 404, 500 | `server/app.ts:1485` |
| POST | `/api/auth/request-email-verification` | optional-auth | public_or_authenticated | active | kv | 401, 403, 404, 500 | `server/app.ts:1332` |
| POST | `/api/auth/request-reset` | public | public | active | kv | 400, 500 | `server/app.ts:1193` |
| POST | `/api/auth/reset-password` | public | public | active | kv | 400, 500 | `server/app.ts:1263` |
| POST | `/api/auth/signin` | public | public | active | kv | 400, 401, 403, 500 | `server/app.ts:1133` |
| POST | `/api/auth/signout` | public | public | active | kv, paypal | — | `server/app.ts:5968` |
| POST | `/api/auth/signup` | public | public | active | kv | 400, 500 | `server/app.ts:1058` |
| GET | `/api/auth/social-providers` | public | public | active | — | — | `server/app.ts:2703` |
| POST | `/api/auth/verify-email` | optional-auth | public_or_authenticated | active | kv | 400, 401, 404, 500 | `server/app.ts:1414` |
| GET | `/api/community/models` | public | public | active | — | 500 | `server/app.ts:7272` |
| POST | `/api/community/models` | superadmin | superadmin | active | kv | 201, 400, 401, 403, 404, 500 | `server/app.ts:7557` |
| DELETE | `/api/community/models/:id` | superadmin | superadmin | active | — | 401, 403, 404, 500 | `server/app.ts:7803` |
| GET | `/api/community/models/:id` | public | public | active | — | 404, 500 | `server/app.ts:7371` |
| PUT | `/api/community/models/:id` | superadmin | superadmin | active | kv | 400, 401, 403, 404, 500 | `server/app.ts:7702` |
| GET | `/api/community/models/:id/comments` | public | public | active | kv | 404, 500 | `server/app.ts:8329` |
| POST | `/api/community/models/:id/comments` | authenticated | authenticated_user | active | kv | 400, 401, 403, 404, 500 | `server/app.ts:8346` |
| DELETE | `/api/community/models/:id/comments/:commentId` | authenticated | authenticated_user | active | kv | 401, 403, 404, 500 | `server/app.ts:8404` |
| POST | `/api/community/models/:id/download` | authenticated | authenticated_user | active | kv | 401, 403, 404, 500 | `server/app.ts:7907` |
| GET | `/api/community/models/:id/export-pack` | public | public | active | external_http | 403, 404, 500 | `server/app.ts:7388` |
| POST | `/api/community/models/:id/feature` | superadmin | superadmin | active | — | 400, 403, 404, 500 | `server/app.ts:8086` |
| GET | `/api/community/models/:id/forks` | public | public | active | — | 404, 500 | `server/app.ts:7962` |
| POST | `/api/community/models/:id/like` | authenticated | authenticated_user | active | kv | 401, 403, 404, 500 | `server/app.ts:7846` |
| GET | `/api/community/tags` | public | public | active | — | 500 | `server/app.ts:7988` |
| GET | `/api/community/users/:id` | public | public | active | kv | 404, 500 | `server/app.ts:8016` |
| GET | `/api/config/business` | public | public | active | kv | 500 | `server/app.ts:3393` |
| POST | `/api/contact` | optional-auth | public_or_authenticated | active | kv | 400, 500 | `server/app.ts:2300` |
| GET | `/api/content/hero-banner` | public | public | active | kv | 500 | `server/app.ts:8505` |
| PUT | `/api/content/hero-banner` | superadmin | superadmin | active | kv | 400, 403, 500 | `server/app.ts:8515` |
| GET | `/api/contributors` | public | public | active | kv | 500 | `server/app.ts:6581` |
| GET | `/api/credits` | optional-auth | public_or_authenticated | active | kv | 401, 500 | `server/app.ts:2172` |
| POST | `/api/credits/consume` | optional-auth | public_or_authenticated | active | kv, paypal | 401, 402, 500 | `server/app.ts:2210` |
| POST | `/api/credits/purchase` | superadmin | superadmin | active | kv, paypal | 400, 403, 500 | `server/app.ts:2258` |
| POST | `/api/donations/capture-order` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 403, 404, 409, 500 | `server/app.ts:6750` |
| POST | `/api/donations/create-order` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 500 | `server/app.ts:6669` |
| GET | `/api/donations/me` | authenticated | authenticated_user | active | kv | 401, 500 | `server/app.ts:6613` |
| PUT | `/api/donations/me` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 404, 500 | `server/app.ts:6632` |
| GET | `/api/feedback` | superadmin | superadmin | active | kv | 403, 500 | `server/app.ts:2410` |
| POST | `/api/feedback` | optional-auth | public_or_authenticated | active | kv | 400, 500 | `server/app.ts:2372` |
| PUT | `/api/feedback/:id/status` | superadmin | superadmin | active | kv, paypal | 400, 403, 404, 500 | `server/app.ts:2634` |
| POST | `/api/feedback/ai-review` | superadmin | superadmin | active | external_http, kv | 403, 500 | `server/app.ts:2430` |
| GET | `/api/feedback/ai-stats` | superadmin | superadmin | active | kv | 403, 500 | `server/app.ts:2580` |
| GET | `/api/gcode` | public | public | active | kv | 500 | `server/app.ts:1984` |
| POST | `/api/gcode` | public | public | active | kv | 400, 403, 500 | `server/app.ts:2001` |
| DELETE | `/api/gcode/:id` | public | public | active | kv | 500 | `server/app.ts:2046` |
| GET | `/api/health` | public | public | active | — | — | `server/app.ts:956` |
| POST | `/api/internal/mcp/tool/:tool` | public | public | active | — | 400, 401, 500 | `server/app.ts:1018` |
| POST | `/api/internal/news/cleanup` | public | public | active | — | 401, 500 | `server/news-routes.ts:70` |
| POST | `/api/internal/news/ingest` | public | public | active | — | 401, 500 | `server/news-routes.ts:51` |
| GET | `/api/news` | public | public | active | — | 500 | `server/news-routes.ts:22` |
| GET | `/api/news/:slug` | public | public | active | — | 404, 500 | `server/news-routes.ts:38` |
| POST | `/api/paypal/capture-order` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 403, 404, 409, 500 | `server/app.ts:6213` |
| GET | `/api/paypal/client-id` | public | public | duplicated_definition | paypal | — | `server/app.ts:2694` |
| GET | `/api/paypal/client-id` | public | public | duplicated_definition | paypal | 503 | `server/app.ts:6115` |
| POST | `/api/paypal/create-order` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 409, 500 | `server/app.ts:6122` |
| POST | `/api/promotions/redeem` | authenticated | authenticated_user | active | kv | 400, 401, 404, 500 | `server/app.ts:4523` |
| POST | `/api/promotions/validate` | public | public | active | kv | 400, 500 | `server/app.ts:4477` |
| GET | `/api/rewards/:userId` | public | public | active | kv | 500 | `server/app.ts:4665` |
| GET | `/api/rewards/leaderboard` | public | public | active | kv | 500 | `server/app.ts:8466` |
| GET | `/api/rewards/me` | authenticated | authenticated_user | duplicated_definition | kv | 401, 500 | `server/app.ts:4639` |
| GET | `/api/rewards/me` | authenticated | authenticated_user | duplicated_definition | kv | 401, 500 | `server/app.ts:8446` |
| POST | `/api/rewards/trigger` | authenticated | authenticated_user | active | kv | 400, 401, 500 | `server/app.ts:4686` |
| GET | `/api/subscriptions/client-id` | public | public | active | paypal | — | `server/paypal-subscriptions.ts:137` |
| POST | `/api/subscriptions/create` | authenticated | authenticated_user | active | paypal, prisma | 400, 401, 403, 404, 500 | `server/paypal-subscriptions.ts:142` |
| GET | `/api/subscriptions/my-subscription` | public | public | active | paypal, prisma | 500 | `server/paypal-subscriptions.ts:261` |
| GET | `/api/subscriptions/plans` | public | public | active | paypal | — | `server/paypal-subscriptions.ts:132` |
| POST | `/api/subscriptions/webhook` | public | public | active | kv, paypal, prisma | 400, 500 | `server/paypal-subscriptions.ts:286` |
| POST | `/api/telemetry/batch` | optional-auth | public_or_authenticated | active | kv, prisma | 400, 500 | `server/app.ts:4816` |
| GET | `/api/telemetry/insights` | superadmin | superadmin | active | prisma | 403, 500 | `server/app.ts:4909` |
| POST | `/api/telemetry/snapshot` | public | public | active | kv | 400, 500 | `server/app.ts:4756` |
| GET | `/api/telemetry/snapshot/:id` | public | public | active | kv | 404, 500 | `server/app.ts:4797` |
| POST | `/api/tool-actions/consume` | authenticated | authenticated_user | active | kv | 400, 401, 403, 500 | `server/app.ts:7518` |
| GET | `/api/tool-credits/me` | optional-auth | public_or_authenticated | active | kv | 401, 500 | `server/app.ts:2192` |
| POST | `/api/uploads/community-image` | authenticated | authenticated_user | active | kv | 400, 401, 500 | `server/app.ts:7062` |
| GET | `/api/uploads/community-image/:id` | public | public | active | kv | 404, 500 | `server/app.ts:7119` |
| POST | `/api/uploads/thumbnail` | authenticated | authenticated_user | active | kv | 400, 401, 403, 500 | `server/app.ts:7009` |
| GET | `/api/uploads/thumbnail/:id` | public | public | active | kv | 404, 500 | `server/app.ts:7110` |
| GET | `/api/vault/keys` | superadmin | superadmin | active | kv | 403, 500 | `server/app.ts:5623` |
| DELETE | `/api/vault/keys/:provider` | superadmin | superadmin | active | kv | 403, 500 | `server/app.ts:5713` |
| PUT | `/api/vault/keys/:provider` | superadmin | superadmin | active | kv | 400, 403, 500 | `server/app.ts:5655` |
| POST | `/api/vault/keys/:provider/test` | superadmin | superadmin | active | external_http, kv | 403, 404, 500 | `server/app.ts:5739` |
| GET | `/og/:slug` | public | public | active | — | 200 | `server/app.ts:999` |
| GET | `/og/default.svg` | public | public | active | — | 200 | `server/app.ts:991` |
| GET | `/robots.txt` | public | public | active | — | 200 | `server/app.ts:961` |
| GET | `/sitemap.xml` | public | public | active | — | 200 | `server/app.ts:970` |
| GET | `/sitemaps/:section.xml` | public | public | active | — | 200, 404 | `server/app.ts:978` |
