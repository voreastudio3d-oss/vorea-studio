# Inventario Operativo de Endpoints

Generado: 2026-04-16T14:56:48.506Z

Total definiciones detectadas: **153**
Total únicos (method+path): **149**
Definiciones duplicadas detectadas: **4**

| Método | Path | Auth | Rol | Estado | Dependencias | Errores | Origen |
|---|---|---|---|---|---|---|---|
| GET | `/api/activity` | authenticated | authenticated_user | active | kv | 401, 500 | `server/app.ts:2064` |
| GET | `/api/admin/activity/:userId` | superadmin | superadmin | active | kv | 500 | `server/app.ts:2077` |
| GET | `/api/admin/ai-budget` | superadmin | superadmin | active | kv, paypal | 500 | `server/app.ts:3560` |
| PUT | `/api/admin/ai-budget` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3582` |
| DELETE | `/api/admin/ai-lane-matrix` | superadmin | superadmin | active | — | 500 | `server/app.ts:3647` |
| GET | `/api/admin/ai-lane-matrix` | superadmin | superadmin | active | — | 500 | `server/app.ts:3621` |
| PUT | `/api/admin/ai-lane-matrix` | superadmin | superadmin | active | — | 400, 500 | `server/app.ts:3631` |
| GET | `/api/admin/alerts` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5513` |
| PUT | `/api/admin/alerts` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5530` |
| GET | `/api/admin/analytics` | superadmin | superadmin | active | kv | 500 | `server/app.ts:4996` |
| GET | `/api/admin/analytics-insights` | superadmin | superadmin | active | kv | 500 | `server/app.ts:2883` |
| GET | `/api/admin/check` | superadmin | superadmin | active | — | 500 | `server/app.ts:2966` |
| POST | `/api/admin/community/cleanup` | superadmin | superadmin | active | — | 500 | `server/app.ts:8082` |
| GET | `/api/admin/community/models` | superadmin | superadmin | active | — | 500 | `server/app.ts:7992` |
| PUT | `/api/admin/community/models/:id/moderate` | superadmin | superadmin | active | — | 400, 404, 500 | `server/app.ts:8126` |
| PUT | `/api/admin/contributors/:userId` | superadmin | superadmin | active | kv | 400, 404, 500 | `server/app.ts:6543` |
| GET | `/api/admin/credit-packs` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3436` |
| PUT | `/api/admin/credit-packs` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3447` |
| GET | `/api/admin/donations` | superadmin | superadmin | active | kv, paypal | 500 | `server/app.ts:6390` |
| POST | `/api/admin/email` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:5542` |
| GET | `/api/admin/emails` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5587` |
| POST | `/api/admin/expenses` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:5495` |
| GET | `/api/admin/image-limits` | superadmin | superadmin | active | kv | 500 | `server/app.ts:4446` |
| PUT | `/api/admin/image-limits` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:4457` |
| POST | `/api/admin/init` | superadmin | superadmin | active | kv | 401, 403, 404, 500 | `server/app.ts:2809` |
| GET | `/api/admin/kpi` | superadmin | superadmin | active | kv | 500 | `server/app.ts:2089` |
| GET | `/api/admin/limits` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3474` |
| PUT | `/api/admin/limits` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3494` |
| GET | `/api/admin/logs` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5601` |
| POST | `/api/admin/news/ingest` | superadmin | superadmin | active | paypal | 500 | `server/app.ts:8472` |
| GET | `/api/admin/news/source-stats` | superadmin | superadmin | active | — | 500 | `server/app.ts:8463` |
| GET | `/api/admin/news/sources` | superadmin | superadmin | active | — | 500 | `server/app.ts:8418` |
| POST | `/api/admin/news/sources` | superadmin | superadmin | active | — | 201, 400, 500 | `server/app.ts:8439` |
| DELETE | `/api/admin/news/sources/:id` | superadmin | superadmin | active | — | 404, 500 | `server/app.ts:8452` |
| PUT | `/api/admin/news/sources/:id` | superadmin | superadmin | active | — | 404, 500 | `server/app.ts:8427` |
| GET | `/api/admin/plans` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3172` |
| PUT | `/api/admin/plans` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3187` |
| GET | `/api/admin/promotions` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5038` |
| PUT | `/api/admin/promotions` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:5049` |
| DELETE | `/api/admin/promotions/:id` | superadmin | superadmin | active | kv | 404, 500 | `server/app.ts:5083` |
| GET | `/api/admin/reports/acquisition` | superadmin | superadmin | active | kv | 500 | `server/app.ts:5191` |
| GET | `/api/admin/reports/regional-stats` | superadmin | superadmin | active | prisma | 500 | `server/app.ts:5161` |
| GET | `/api/admin/reports/revenue` | superadmin | superadmin | active | kv, paypal | 500 | `server/app.ts:5280` |
| GET | `/api/admin/reports/usage` | superadmin | superadmin | active | kv, paypal | 500 | `server/app.ts:5104` |
| POST | `/api/admin/reset-owner-password` | superadmin | superadmin | active | kv | 400, 403, 500 | `server/app.ts:2717` |
| GET | `/api/admin/tool-credits` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3519` |
| PUT | `/api/admin/tool-credits` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3530` |
| POST | `/api/admin/tool-credits/legacy-migrate` | superadmin | superadmin | active | — | 500 | `server/app.ts:3158` |
| GET | `/api/admin/tool-credits/legacy-status` | superadmin | superadmin | active | — | 500 | `server/app.ts:3147` |
| GET | `/api/admin/users` | superadmin | superadmin | active | kv | 500 | `server/app.ts:2976` |
| DELETE | `/api/admin/users/:id` | superadmin | superadmin | active | kv | 400, 500 | `server/app.ts:3048` |
| PUT | `/api/admin/users/:id` | superadmin | superadmin | active | kv | 404, 500 | `server/app.ts:3006` |
| POST | `/api/admin/users/cleanup-duplicates` | superadmin | superadmin | active | kv | 500 | `server/app.ts:3078` |
| GET | `/api/ai/budget-status` | public | public | active | kv | 500 | `server/app.ts:4328` |
| GET | `/api/ai/history` | authenticated | authenticated_user | active | kv | 401, 500 | `server/app.ts:4185` |
| POST | `/api/ai/history` | authenticated | authenticated_user | active | kv | 400, 401, 500 | `server/app.ts:4202` |
| DELETE | `/api/ai/history/:id` | authenticated | authenticated_user | active | kv | 400, 401, 404, 500 | `server/app.ts:4261` |
| POST | `/api/ai/quick-fix` | optional-auth | public_or_authenticated | active | — | 400, 500 | `server/app.ts:4357` |
| GET | `/api/ai/recipes` | authenticated | authenticated_user | active | kv | 401, 500 | `server/app.ts:4094` |
| POST | `/api/ai/recipes` | authenticated | authenticated_user | active | kv | 400, 401, 500 | `server/app.ts:4109` |
| DELETE | `/api/ai/recipes/:id` | authenticated | authenticated_user | active | kv | 400, 401, 404, 500 | `server/app.ts:4162` |
| POST | `/api/ai/track-spend` | authenticated | authenticated_user | active | kv | 400, 401, 403, 500 | `server/app.ts:4396` |
| POST | `/api/auth/google` | public | public | duplicated_definition | external_http, kv | 400, 401, 403, 500 | `server/app.ts:1852` |
| POST | `/api/auth/google` | public | public | duplicated_definition | kv | 400, 401, 500, 503 | `server/app.ts:5847` |
| GET | `/api/auth/google/config` | public | public | duplicated_definition | — | — | `server/app.ts:1843` |
| GET | `/api/auth/google/config` | public | public | duplicated_definition | — | — | `server/app.ts:5960` |
| GET | `/api/auth/me` | optional-auth | public_or_authenticated | active | kv | 401, 404, 500 | `server/app.ts:1502` |
| PUT | `/api/auth/me` | optional-auth | public_or_authenticated | active | kv | 401, 404, 409, 500 | `server/app.ts:1786` |
| PUT | `/api/auth/me/password` | optional-auth | public_or_authenticated | active | — | 400, 401, 403, 404, 500 | `server/app.ts:1536` |
| POST | `/api/auth/refresh` | public | public | active | — | 401, 403, 404, 500 | `server/app.ts:1484` |
| POST | `/api/auth/request-email-verification` | optional-auth | public_or_authenticated | active | kv | 401, 403, 404, 500 | `server/app.ts:1331` |
| POST | `/api/auth/request-reset` | public | public | active | kv | 400, 500 | `server/app.ts:1192` |
| POST | `/api/auth/reset-password` | public | public | active | kv | 400, 500 | `server/app.ts:1262` |
| POST | `/api/auth/signin` | public | public | active | kv | 400, 401, 403, 500 | `server/app.ts:1132` |
| POST | `/api/auth/signout` | public | public | active | kv, paypal | — | `server/app.ts:5967` |
| POST | `/api/auth/signup` | public | public | active | kv | 400, 500 | `server/app.ts:1057` |
| GET | `/api/auth/social-providers` | public | public | active | — | — | `server/app.ts:2702` |
| POST | `/api/auth/verify-email` | optional-auth | public_or_authenticated | active | kv | 400, 401, 404, 500 | `server/app.ts:1413` |
| GET | `/api/community/models` | public | public | active | — | 500 | `server/app.ts:7271` |
| POST | `/api/community/models` | superadmin | superadmin | active | kv | 201, 400, 401, 403, 404, 500 | `server/app.ts:7426` |
| DELETE | `/api/community/models/:id` | superadmin | superadmin | active | — | 401, 403, 404, 500 | `server/app.ts:7672` |
| GET | `/api/community/models/:id` | public | public | active | — | 404, 500 | `server/app.ts:7370` |
| PUT | `/api/community/models/:id` | superadmin | superadmin | active | kv | 400, 401, 403, 404, 500 | `server/app.ts:7571` |
| GET | `/api/community/models/:id/comments` | public | public | active | kv | 404, 500 | `server/app.ts:8198` |
| POST | `/api/community/models/:id/comments` | authenticated | authenticated_user | active | kv | 400, 401, 403, 404, 500 | `server/app.ts:8215` |
| DELETE | `/api/community/models/:id/comments/:commentId` | authenticated | authenticated_user | active | kv | 401, 403, 404, 500 | `server/app.ts:8273` |
| POST | `/api/community/models/:id/download` | authenticated | authenticated_user | active | kv | 401, 403, 404, 500 | `server/app.ts:7776` |
| POST | `/api/community/models/:id/feature` | superadmin | superadmin | active | — | 400, 403, 404, 500 | `server/app.ts:7955` |
| GET | `/api/community/models/:id/forks` | public | public | active | — | 404, 500 | `server/app.ts:7831` |
| POST | `/api/community/models/:id/like` | authenticated | authenticated_user | active | kv | 401, 403, 404, 500 | `server/app.ts:7715` |
| GET | `/api/community/tags` | public | public | active | — | 500 | `server/app.ts:7857` |
| GET | `/api/community/users/:id` | public | public | active | kv | 404, 500 | `server/app.ts:7885` |
| GET | `/api/config/business` | public | public | active | kv | 500 | `server/app.ts:3392` |
| POST | `/api/contact` | optional-auth | public_or_authenticated | active | kv | 400, 500 | `server/app.ts:2299` |
| GET | `/api/content/hero-banner` | public | public | active | kv | 500 | `server/app.ts:8374` |
| PUT | `/api/content/hero-banner` | superadmin | superadmin | active | kv | 400, 403, 500 | `server/app.ts:8384` |
| GET | `/api/contributors` | public | public | active | kv | 500 | `server/app.ts:6580` |
| GET | `/api/credits` | optional-auth | public_or_authenticated | active | kv | 401, 500 | `server/app.ts:2171` |
| POST | `/api/credits/consume` | optional-auth | public_or_authenticated | active | kv, paypal | 401, 402, 500 | `server/app.ts:2209` |
| POST | `/api/credits/purchase` | superadmin | superadmin | active | kv, paypal | 400, 403, 500 | `server/app.ts:2257` |
| POST | `/api/donations/capture-order` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 403, 404, 409, 500 | `server/app.ts:6749` |
| POST | `/api/donations/create-order` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 500 | `server/app.ts:6668` |
| GET | `/api/donations/me` | authenticated | authenticated_user | active | kv | 401, 500 | `server/app.ts:6612` |
| PUT | `/api/donations/me` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 404, 500 | `server/app.ts:6631` |
| GET | `/api/feedback` | superadmin | superadmin | active | kv | 403, 500 | `server/app.ts:2409` |
| POST | `/api/feedback` | optional-auth | public_or_authenticated | active | kv | 400, 500 | `server/app.ts:2371` |
| PUT | `/api/feedback/:id/status` | superadmin | superadmin | active | kv, paypal | 400, 403, 404, 500 | `server/app.ts:2633` |
| POST | `/api/feedback/ai-review` | superadmin | superadmin | active | external_http, kv | 403, 500 | `server/app.ts:2429` |
| GET | `/api/feedback/ai-stats` | superadmin | superadmin | active | kv | 403, 500 | `server/app.ts:2579` |
| GET | `/api/gcode` | public | public | active | kv | 500 | `server/app.ts:1983` |
| POST | `/api/gcode` | public | public | active | kv | 400, 403, 500 | `server/app.ts:2000` |
| DELETE | `/api/gcode/:id` | public | public | active | kv | 500 | `server/app.ts:2045` |
| GET | `/api/health` | public | public | active | — | — | `server/app.ts:955` |
| POST | `/api/internal/mcp/tool/:tool` | public | public | active | — | 400, 401, 500 | `server/app.ts:1017` |
| POST | `/api/internal/news/cleanup` | public | public | active | — | 401, 500 | `server/news-routes.ts:70` |
| POST | `/api/internal/news/ingest` | public | public | active | — | 401, 500 | `server/news-routes.ts:51` |
| GET | `/api/news` | public | public | active | — | 500 | `server/news-routes.ts:22` |
| GET | `/api/news/:slug` | public | public | active | — | 404, 500 | `server/news-routes.ts:38` |
| POST | `/api/paypal/capture-order` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 403, 404, 409, 500 | `server/app.ts:6212` |
| GET | `/api/paypal/client-id` | public | public | duplicated_definition | paypal | — | `server/app.ts:2693` |
| GET | `/api/paypal/client-id` | public | public | duplicated_definition | paypal | 503 | `server/app.ts:6114` |
| POST | `/api/paypal/create-order` | authenticated | authenticated_user | active | kv, paypal | 400, 401, 409, 500 | `server/app.ts:6121` |
| POST | `/api/promotions/redeem` | authenticated | authenticated_user | active | kv | 400, 401, 404, 500 | `server/app.ts:4522` |
| POST | `/api/promotions/validate` | public | public | active | kv | 400, 500 | `server/app.ts:4476` |
| GET | `/api/rewards/:userId` | public | public | active | kv | 500 | `server/app.ts:4664` |
| GET | `/api/rewards/leaderboard` | public | public | active | kv | 500 | `server/app.ts:8335` |
| GET | `/api/rewards/me` | authenticated | authenticated_user | duplicated_definition | kv | 401, 500 | `server/app.ts:4638` |
| GET | `/api/rewards/me` | authenticated | authenticated_user | duplicated_definition | kv | 401, 500 | `server/app.ts:8315` |
| POST | `/api/rewards/trigger` | authenticated | authenticated_user | active | kv | 400, 401, 500 | `server/app.ts:4685` |
| GET | `/api/subscriptions/client-id` | public | public | active | paypal | — | `server/paypal-subscriptions.ts:137` |
| POST | `/api/subscriptions/create` | authenticated | authenticated_user | active | paypal, prisma | 400, 401, 403, 404, 500 | `server/paypal-subscriptions.ts:142` |
| GET | `/api/subscriptions/my-subscription` | public | public | active | paypal, prisma | 500 | `server/paypal-subscriptions.ts:261` |
| GET | `/api/subscriptions/plans` | public | public | active | paypal | — | `server/paypal-subscriptions.ts:132` |
| POST | `/api/subscriptions/webhook` | public | public | active | kv, paypal, prisma | 400, 500 | `server/paypal-subscriptions.ts:286` |
| POST | `/api/telemetry/batch` | optional-auth | public_or_authenticated | active | kv, prisma | 400, 500 | `server/app.ts:4815` |
| GET | `/api/telemetry/insights` | superadmin | superadmin | active | prisma | 403, 500 | `server/app.ts:4908` |
| POST | `/api/telemetry/snapshot` | public | public | active | kv | 400, 500 | `server/app.ts:4755` |
| GET | `/api/telemetry/snapshot/:id` | public | public | active | kv | 404, 500 | `server/app.ts:4796` |
| POST | `/api/tool-actions/consume` | authenticated | authenticated_user | active | kv | 400, 401, 403, 500 | `server/app.ts:7387` |
| GET | `/api/tool-credits/me` | optional-auth | public_or_authenticated | active | kv | 401, 500 | `server/app.ts:2191` |
| POST | `/api/uploads/community-image` | authenticated | authenticated_user | active | kv | 400, 401, 500 | `server/app.ts:7061` |
| GET | `/api/uploads/community-image/:id` | public | public | active | kv | 404, 500 | `server/app.ts:7118` |
| POST | `/api/uploads/thumbnail` | authenticated | authenticated_user | active | kv | 400, 401, 403, 500 | `server/app.ts:7008` |
| GET | `/api/uploads/thumbnail/:id` | public | public | active | kv | 404, 500 | `server/app.ts:7109` |
| GET | `/api/vault/keys` | superadmin | superadmin | active | kv | 403, 500 | `server/app.ts:5622` |
| DELETE | `/api/vault/keys/:provider` | superadmin | superadmin | active | kv | 403, 500 | `server/app.ts:5712` |
| PUT | `/api/vault/keys/:provider` | superadmin | superadmin | active | kv | 400, 403, 500 | `server/app.ts:5654` |
| POST | `/api/vault/keys/:provider/test` | superadmin | superadmin | active | external_http, kv | 403, 404, 500 | `server/app.ts:5738` |
| GET | `/og/:slug` | public | public | active | — | 200 | `server/app.ts:998` |
| GET | `/og/default.svg` | public | public | active | — | 200 | `server/app.ts:990` |
| GET | `/robots.txt` | public | public | active | — | 200 | `server/app.ts:960` |
| GET | `/sitemap.xml` | public | public | active | — | 200 | `server/app.ts:969` |
| GET | `/sitemaps/:section.xml` | public | public | active | — | 200, 404 | `server/app.ts:977` |
