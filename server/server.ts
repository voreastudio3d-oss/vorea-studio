/**
 * Vorea Studio API Server — Node.js entry point
 * Serves the Hono app via @hono/node-server.
 * In production, also serves the Vite-built frontend as static files.
 * Load .env before importing the app so process.env is populated.
 */

// Force IPv4-first DNS resolution — fixes ETIMEDOUT on networks with broken
// IPv6 connectivity (Google OAuth certs, Resend emails, AI providers, etc.)
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import app from "./app.js";
import { hasSuperAdminAccessFromContext } from "./docs-access.js";
import paypalSubscriptions from "./paypal-subscriptions.js";
import { buildSeoMetadata, injectSeoIntoHtml } from "./seo.js";
import fs from "node:fs";
import path from "node:path";

const PORT = parseInt(process.env.PORT || process.env.API_PORT || "3001", 10);
const IS_PROD = process.env.NODE_ENV === "production";
const DIST_DIR = path.resolve(import.meta.dirname || __dirname, "..", "dist");

// Mount the PayPal Subscriptions Router
app.route("/api/subscriptions", paypalSubscriptions);

// In production, serve the built frontend as static files
if (IS_PROD && fs.existsSync(DIST_DIR)) {
  const guardDocs = async (c: any, next: () => Promise<void>) => {
    const allowed = await hasSuperAdminAccessFromContext(c);
    if (!allowed) {
      return c.text("Acceso restringido a superadmin", 403);
    }
    await next();
  };

  app.use("/docs", guardDocs);
  app.use("/docs/*", guardDocs);
  app.use("/openapi.json", guardDocs);

  // Directory requests like /docs/ can otherwise fall through to the SPA
  // fallback on some hosts/adapters. Redirect them explicitly to the portal file.
  app.get("/docs", (c) => c.redirect("/docs/index.html", 302));
  app.get("/docs/", (c) => c.redirect("/docs/index.html", 302));

  // Serve static assets (JS, CSS, images, etc.)
  app.use("/*", serveStatic({ root: DIST_DIR }));

  // ── Locale-aware SPA fallback ──────────────────────────────────────────────
  const SUPPORTED_LANGS = ["es", "en", "pt"];
  const LEGACY_SLUG_MAP: Record<string, string> = {
    "/comunidad": "/community",
    "/planes": "/plans",
    "/noticias": "/news",
    "/perfil": "/profile",
    "/contacto": "/contact",
    "/colaboradores": "/contributors",
    "/terminos": "/terms",
    "/privacidad": "/privacy",
    "/modelo": "/model",
  };

  app.get("*", async (c) => {
    const url = new URL(c.req.url);
    const pathname = url.pathname;

    // Auto-redirect bare root / → /:lang/
    if (pathname === "/") {
      const acceptLang = (c.req.header("Accept-Language") || "es").toLowerCase();
      const primaryLang = acceptLang.split(",")[0].split("-")[0].trim();
      const lang = SUPPORTED_LANGS.includes(primaryLang) ? primaryLang : "es";
      return c.redirect(`/${lang}/`, 302);
    }

    // 301 redirect legacy Spanish slugs → English with lang prefix
    for (const [legacy, modern] of Object.entries(LEGACY_SLUG_MAP)) {
      if (pathname === legacy || pathname.startsWith(legacy + "/")) {
        const rest = pathname.slice(legacy.length);
        return c.redirect(`/es${modern}${rest}`, 301);
      }
    }

    // Strip /:lang prefix for SEO metadata lookup
    const langMatch = pathname.match(/^\/([a-z]{2})(\/.*)?$/);
    const requestedLang = (langMatch && SUPPORTED_LANGS.includes(langMatch[1])) ? langMatch[1] : "es";
    const barePath = (langMatch && SUPPORTED_LANGS.includes(langMatch[1]))
      ? (langMatch[2] || "/")
      : pathname;

    const indexPath = path.join(DIST_DIR, "index.html");
    const html = fs.readFileSync(indexPath, "utf-8");
    const metadata = await buildSeoMetadata(barePath, c.req.url, requestedLang);
    return c.html(injectSeoIntoHtml(html, metadata, c.req.url));
  });

  console.log(`📦 Serving static frontend from ${DIST_DIR}`);
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  const mode = IS_PROD ? "PRODUCTION" : "DEVELOPMENT";
  console.log(`\n🚀 Vorea API server [${mode}] running at http://localhost:${info.port}/api/health\n`);
});
