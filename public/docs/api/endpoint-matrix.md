# Inventario Operativo de Endpoints

Generado: 2026-04-02T19:21:48.837Z

Total definiciones detectadas: **144**
Total únicos (method+path): **140**
Definiciones duplicadas detectadas: **4**

| Método | Path | Auth | Rol | Estado | Dependencias | Errores | Origen |
|---|---|---|---|---|---|---|---|
| GET | `/api/activity` | authenticated | authenticated_user | active | kv | 401, 500 | `server/app.ts:2051` |
| GET | `/api/admin/activity/:userId` | superadmin | superadmin | active | kv | 500 | `server/app.ts:2064` |
| GET | `/api/admin/ai-budget` | superadmin | superadmin | active | kv, paypal | 500 | `server/app.ts:3548` |
| PUT | `/api/admin/ai-budget` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3570` |
| GET | `/api/admin/alerts` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5144` |
| PUT | `/api/admin/alerts` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5161` |
| GET | `/api/admin/analytics` | superadmin | superadmin | active | kv | 500 | `server/app.ts:4746` |
| GET | `/api/admin/analytics-insights` | superadmin | superadmin | active | kv | 500 | `server/app.ts:2871` |
| GET | `/api/admin/check` | superadmin | superadmin | active | — | 500 | `server/app.ts:2954` |
| POST | `/api/admin/community/cleanup` | superadmin | superadmin | active | — | 500 | `server/app.ts:7687` |
| GET | `/api/admin/community/models` | superadmin | superadmin | active | — | 500 | `server/app.ts:7597` |
| PUT | `/api/admin/contributors/:userId` | superadmin | superadmin | active | kv | 400, 404, 500 | `server/app.ts:6150` |
| GET | `/api/admin/credit-packs` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3424` |
| PUT | `/api/admin/credit-packs` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3435` |
| GET | `/api/admin/donations` | superadmin | superadmin | active | kv, paypal | 500 | `server/app.ts:5997` |
| POST | `/api/admin/email` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:5173` |
| GET | `/api/admin/emails` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5218` |
| POST | `/api/admin/expenses` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:5126` |
| GET | `/api/admin/image-limits` | superadmin | superadmin | active | kv | 500 | `server/app.ts:4395` |
| PUT | `/api/admin/image-limits` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:4406` |
| POST | `/api/admin/init` | superadmin | superadmin | active | kv | 401, 403, 404, 500 | `server/app.ts:2797` |
| GET | `/api/admin/kpi` | superadmin | superadmin | active | kv | 500 | `server/app.ts:2076` |
| GET | `/api/admin/limits` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3462` |
| PUT | `/api/admin/limits` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3482` |
| GET | `/api/admin/logs` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5232` |
| POST | `/api/admin/news/ingest` | superadmin | superadmin | active | paypal | 500 | `server/app.ts:7999` |
| GET | `/api/admin/news/source-stats` | superadmin | superadmin | active | — | 500 | `server/app.ts:7990` |
| GET | `/api/admin/news/sources` | superadmin | superadmin | active | — | 500 | `server/app.ts:7945` |
| POST | `/api/admin/news/sources` | superadmin | superadmin | active | — | 201, 400, 500 | `server/app.ts:7966` |
| DELETE | `/api/admin/news/sources/:id` | superadmin | superadmin | active | — | 404, 500 | `server/app.ts:7979` |
| PUT | `/api/admin/news/sources/:id` | superadmin | superadmin | active | — | 404, 500 | `server/app.ts:7954` |
| GET | `/api/admin/plans` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3160` |
| PUT | `/api/admin/plans` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3175` |
| GET | `/api/admin/promotions` | superadmin | superadmin | active | kv | 500 | `server/app.ts:4788` |
| PUT | `/api/admin/promotions` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:4799` |
| DELETE | `/api/admin/promotions/:id` | superadmin | superadmin | active | kv | 404, 500 | `server/app.ts:4833` |
| GET | `/api/admin/reports/revenue` | superadmin | superadmin | active | kv, paypal | 500 | `server/app.ts:4911` |
| GET | `/api/admin/reports/usage` | superadmin | superadmin | active | kv, paypal | 500 | `server/app.ts:4854` |
| POST | `/api/admin/reset-owner-password` | superadmin | superadmin | active | kv | 400, 403, 500 | `server/app.ts:2705` |
| GET | `/api/admin/tool-credits` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3507` |
| PUT | `/api/admin/tool-credits` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3518` |
| POST | `/api/admin/tool-credits/legacy-migrate` | superadmin | superadmin | active | — | 500 | `server/app.ts:3146` |
| GET | `/api/admin/tool-credits/legacy-status` | superadmin | superadmin | active | — | 500 | `server/app.ts:3135` |
| GET | `/api/admin/users` | superadmin | superadmin | active | kv | 500 | `server/app.ts:2964` |
| DELETE | `/api/admin/users/:id` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3036` |
| PUT | `/api/admin/users/:id` | superadmin | superadmin | active | kv | 404, 500 | `server/app.ts:2994` |
| POST | `/api/admin/users/cleanup-duplicates` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3066` |
| GET | `/api/ai/budget-status` | public | public | active | kv | 500 | `server/app.ts:4277` |
| GET | `/api/ai/history` | authenticated | authenticated_user | active | kv | 401, 500 | `server/app.ts:4134` |
| POST | `/api/ai/history` | authenticated | authenticated_user | active | kv | 400, 401, 500 | `server/app.ts:4151` |
| DELETE | `/api/ai/history/:id` | authenticated | authenticated_user | active | kv | 400, 401, 404, 500 | `server/app.ts:4210` |
| POST | `/api/ai/quick-fix` | optional-auth | public_or_authenticated | active | — | 400, 500 | `server/app.ts:4306` |
| GET | `/api/ai/recipes` | authenticated | authenticated_user | active | kv | 401, 500 | `server/app.ts:4043` |
| POST | `/api/ai/recipes` | authenticated | authenticated_user | active | kv | 400, 401, 500 | `server/app.ts:4058` |
| DELETE | `/api/ai/recipes/:id` | authenticated | authenticated_user | active | kv | 400, 401, 404, 500 | `server/app.ts:4111` |
| POST | `/api/ai/track-spend` | authenticated | authenticated_user | active | kv | 400, 401, 403, 500 | `server/app.ts:4345` |
| POST | `/api/auth/google` | public | public | duplicated_definition | external_http, kv | 400, 401, 403, 500 | `server/app.ts:1847` |
| POST | `/api/auth/google` | public | public | duplicated_definition | kv | 400, 401, 500, 503 | `server/app.ts:5478` |
| GET | `/api/auth/google/config` | public | public | duplicated_definition | — | — | `server/app.ts:1838` |
| GET | `/api/auth/google/config` | public | public | duplicated_definition | — | — | `server/app.ts:5591` |
| GET | `/api/auth/me` | optional-auth | public_or_authenticated | active | kv | 401, 404, 500 | `server/app.ts:1500` |
| PUT | `/api/auth/me` | optional-auth | public_or_authenticated | active | kv | 401, 404, 409, 500 | `server/app.ts:1781` |
| PUT | `/api/auth/me/password` | optional-auth | public_or_authenticated | active | — | 400, 401, 403, 404, 500 | `server/app.ts:1534` |
| POST | `/api/auth/refresh` | public | public | active | — | 401, 403, 404, 500 | `server/app.ts:1482` |
| POST | `/api/auth/request-email-verification` | optional-auth | public_or_authenticated | active | kv | 401, 403, 404, 500 | `server/app.ts:1331` |
| POST | `/api/auth/request-reset` | public | public | active | kv | 400, 500 | `server/app.ts:1181` |
| POST | `/api/auth/reset-password` | public | public | active | kv | 400, 500 | `server/app.ts:1262` |
| POST | `/api/auth/signin` | public | public | active | kv | 400, 401, 403, 500 | `server/app.ts:1125` |
| POST | `/api/auth/signout` | public | public | active | kv, paypal | — | `server/app.ts:5598` |
| POST | `/api/auth/signup` | public | public | active | kv | 400, 500 | `server/app.ts:1054` |
| GET | `/api/auth/social-providers` | public | public | active | — | — | `server/app.ts:2690` |
| POST | `/api/auth/verify-email` | optional-auth | public_or_authenticated | active | kv | 400, 401, 404, 500 | `server/app.ts:1411` |
| GET | `/api/community/models` | public | public | active | — | 500 | `server/app.ts:6878` |
| POST | `/api/community/models` | superadmin | superadmin | active | kv | 201, 400, 401, 403, 404, 500 | `server/app.ts:7033` |
| DELETE | `/api/community/models/:id` | superadmin | superadmin | active | — | 401, 403, 404, 500 | `server/app.ts:7290` |
| GET | `/api/community/models/:id` | public | public | active | — | 404, 500 | `server/app.ts:6977` |
| PUT | `/api/community/models/:id` | superadmin | superadmin | active | kv | 400, 401, 403, 404, 500 | `server/app.ts:7194` |
| GET | `/api/community/models/:id/comments` | public | public | active | kv | 404, 500 | `server/app.ts:7733` |
| POST | `/api/community/models/:id/comments` | authenticated | authenticated_user | active | kv | 400, 401, 403, 404, 500 | `server/app.ts:7750` |
| DELETE | `/api/community/models/:id/comments/:commentId` | authenticated | authenticated_user | active | kv | 401, 403, 404, 500 | `server/app.ts:7800` |
| POST | `/api/community/models/:id/download` | authenticated | authenticated_user | active | kv | 401, 403, 404, 500 | `server/app.ts:7386` |
| POST | `/api/community/models/:id/feature` | superadmin | superadmin | active | — | 400, 403, 404, 500 | `server/app.ts:7560` |
| GET | `/api/community/models/:id/forks` | public | public | active | — | 404, 500 | `server/app.ts:7436` |
| POST | `/api/community/models/:id/like` | authenticated | authenticated_user | active | kv | 401, 403, 404, 500 | `server/app.ts:7329` |
| GET | `/api/community/tags` | public | public | active | — | 500 | `server/app.ts:7462` |
| GET | `/api/community/users/:id` | public | public | active | kv | 404, 500 | `server/app.ts:7490` |
| GET | `/api/config/business` | public | public | active | kv | 500 | `server/app.ts:3380` |
| POST | `/api/contact` | optional-auth | public_or_authenticated | active | kv | 400, 500 | `server/app.ts:2286` |
| GET | `/api/content/hero-banner` | public | public | active | kv | 500 | `server/app.ts:7901` |
| PUT | `/api/content/hero-banner` | superadmin | superadmin | active | kv | 400, 403, 500 | `server/app.ts:7911` |
| GET | `/api/contributors` | public | public | active | kv | 500 | `server/app.ts:6187` |
| GET | `/api/credits` | optional-auth | public_or_authenticated | active | kv | 401, 500 | `server/app.ts:2158` |
| POST | `/api/credits/consume` | optional-auth | public_or_authenticated | active | kv, paypal | 401, 402, 500 | `server/app.ts:2196` |
| POST | `/api/credits/purchase` | superadmin | superadmin | active | kv, paypal | 400, 403, 500 | `server/app.ts:2244` |
| POST | `/api/donations/capture-order` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 403, 404, 409, 500 | `server/app.ts:6356` |
| POST | `/api/donations/create-order` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 500 | `server/app.ts:6275` |
| GET | `/api/donations/me` | authenticated | authenticated_user | active | kv | 401, 500 | `server/app.ts:6219` |
| PUT | `/api/donations/me` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 404, 500 | `server/app.ts:6238` |
| GET | `/api/feedback` | superadmin | superadmin | active | kv | 403, 500 | `server/app.ts:2397` |
| POST | `/api/feedback` | optional-auth | public_or_authenticated | active | kv | 400, 500 | `server/app.ts:2359` |
| PUT | `/api/feedback/:id/status` | superadmin | superadmin | active | kv, paypal | 400, 403, 404, 500 | `server/app.ts:2621` |
| POST | `/api/feedback/ai-review` | superadmin | superadmin | active | external_http, kv | 403, 500 | `server/app.ts:2417` |
| GET | `/api/feedback/ai-stats` | superadmin | superadmin | active | kv | 403, 500 | `server/app.ts:2567` |
| GET | `/api/gcode` | public | public | active | kv | 500 | `server/app.ts:1970` |
| POST | `/api/gcode` | public | public | active | kv | 400, 403, 500 | `server/app.ts:1987` |
| DELETE | `/api/gcode/:id` | public | public | active | kv | 500 | `server/app.ts:2032` |
| GET | `/api/health` | public | public | active | — | — | `server/app.ts:952` |
| POST | `/api/internal/mcp/tool/:tool` | public | public | active | — | 400, 401, 500 | `server/app.ts:1014` |
| POST | `/api/internal/news/cleanup` | public | public | active | — | 401, 500 | `server/news-routes.ts:70` |
| POST | `/api/internal/news/ingest` | public | public | active | — | 401, 500 | `server/news-routes.ts:51` |
| GET | `/api/news` | public | public | active | — | 500 | `server/news-routes.ts:22` |
| GET | `/api/news/:slug` | public | public | active | — | 404, 500 | `server/news-routes.ts:38` |
| POST | `/api/paypal/capture-order` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 403, 404, 409, 500 | `server/app.ts:5843` |
| GET | `/api/paypal/client-id` | public | public | duplicated_definition | paypal | — | `server/app.ts:2681` |
| GET | `/api/paypal/client-id` | public | public | duplicated_definition | paypal | 503 | `server/app.ts:5745` |
| POST | `/api/paypal/create-order` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 409, 500 | `server/app.ts:5752` |
| POST | `/api/promotions/redeem` | authenticated | authenticated_user | active | kv | 400, 401, 404, 500 | `server/app.ts:4471` |
| POST | `/api/promotions/validate` | public | public | active | kv | 400, 500 | `server/app.ts:4425` |
| GET | `/api/rewards/:userId` | public | public | active | kv | 500 | `server/app.ts:4613` |
| GET | `/api/rewards/leaderboard` | public | public | active | kv | 500 | `server/app.ts:7862` |
| GET | `/api/rewards/me` | authenticated | authenticated_user | duplicated_definition | kv | 401, 500 | `server/app.ts:4587` |
| GET | `/api/rewards/me` | authenticated | authenticated_user | duplicated_definition | kv | 401, 500 | `server/app.ts:7842` |
| POST | `/api/rewards/trigger` | authenticated | authenticated_user | active | kv | 400, 401, 500 | `server/app.ts:4634` |
| GET | `/api/subscriptions/client-id` | public | public | active | paypal | — | `server/paypal-subscriptions.ts:137` |
| POST | `/api/subscriptions/create` | authenticated | authenticated_user | active | paypal, prisma | 400, 401, 403, 404, 500 | `server/paypal-subscriptions.ts:142` |
| GET | `/api/subscriptions/my-subscription` | public | public | active | paypal, prisma | 500 | `server/paypal-subscriptions.ts:261` |
| GET | `/api/subscriptions/plans` | public | public | active | paypal | — | `server/paypal-subscriptions.ts:132` |
| POST | `/api/subscriptions/webhook` | public | public | active | kv, paypal, prisma | 400, 500 | `server/paypal-subscriptions.ts:286` |
| POST | `/api/telemetry/batch` | public | public | active | kv | 400, 500 | `server/app.ts:4699` |
| POST | `/api/tool-actions/consume` | authenticated | authenticated_user | active | kv | 400, 401, 403, 500 | `server/app.ts:6994` |
| GET | `/api/tool-credits/me` | optional-auth | public_or_authenticated | active | kv | 401, 500 | `server/app.ts:2178` |
| POST | `/api/uploads/community-image` | authenticated | authenticated_user | active | kv | 400, 401, 500 | `server/app.ts:6668` |
| GET | `/api/uploads/community-image/:id` | public | public | active | kv | 404, 500 | `server/app.ts:6725` |
| POST | `/api/uploads/thumbnail` | authenticated | authenticated_user | active | kv | 400, 401, 403, 500 | `server/app.ts:6615` |
| GET | `/api/uploads/thumbnail/:id` | public | public | active | kv | 404, 500 | `server/app.ts:6716` |
| GET | `/api/vault/keys` | superadmin | superadmin | active | kv | 403, 500 | `server/app.ts:5253` |
| DELETE | `/api/vault/keys/:provider` | superadmin | superadmin | active | kv | 403, 500 | `server/app.ts:5343` |
| PUT | `/api/vault/keys/:provider` | superadmin | superadmin | active | kv | 400, 403, 500 | `server/app.ts:5285` |
| POST | `/api/vault/keys/:provider/test` | superadmin | superadmin | active | external_http, kv | 403, 404, 500 | `server/app.ts:5369` |
| GET | `/og/:slug` | public | public | active | — | 200 | `server/app.ts:995` |
| GET | `/og/default.svg` | public | public | active | — | 200 | `server/app.ts:987` |
| GET | `/robots.txt` | public | public | active | — | 200 | `server/app.ts:957` |
| GET | `/sitemap.xml` | public | public | active | — | 200 | `server/app.ts:966` |
| GET | `/sitemaps/:section.xml` | public | public | active | — | 200, 404 | `server/app.ts:974` |
