import { Hono } from "hono";
import { cleanupNews, getNewsDetail, ingestNews, listNews } from "./news-service.js";

const newsApp = new Hono();

function requireCronSecret(c: any): { ok: boolean; status?: number; error?: string } {
  const secret = process.env.NEWS_CRON_SECRET;
  if (!secret) {
    return { ok: false, status: 503, error: "NEWS_CRON_SECRET no configurado" };
  }
  const header = c.req.header("x-news-cron-secret");
  if (!header) {
    return { ok: false, status: 401, error: "Falta x-news-cron-secret" };
  }
  if (header !== secret) {
    return { ok: false, status: 403, error: "x-news-cron-secret inválido" };
  }
  return { ok: true };
}

// GET /news – Public list of editorialized 3D news
newsApp.get("/api/news", async (c) => {
  try {
    const source = c.req.query("source") || undefined;
    const category = c.req.query("category") || undefined;
    const lang = c.req.query("lang") || undefined;
    const sourceLanguage = c.req.query("sourceLanguage") || undefined;
    const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
    const limit = Math.min(Math.max(1, parseInt(c.req.query("limit") || "12", 10)), 50);
    const payload = await listNews({ source, category, sourceLanguage, lang, page, limit });
    return c.json(payload);
  } catch (e: any) {
    return c.json({ error: `Error al listar noticias: ${e.message}` }, 500);
  }
});

// GET /news/:slug – Public news detail with source attribution
newsApp.get("/api/news/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const lang = c.req.query("lang") || undefined;
    const article = await getNewsDetail(slug, { lang });
    if (!article) return c.json({ error: "Noticia no encontrada" }, 404);
    return c.json({ article });
  } catch (e: any) {
    return c.json({ error: `Error al obtener noticia: ${e.message}` }, 500);
  }
});

// POST /internal/news/ingest – Protected cron endpoint for ingestion
newsApp.post("/api/internal/news/ingest", async (c) => {
  const auth = requireCronSecret(c);
  if (!auth.ok) return c.json({ error: auth.error }, (auth.status || 401) as any);

  try {
    const body = await c.req.json().catch(() => ({}));
    const sourceSlug = typeof body?.sourceSlug === "string" ? body.sourceSlug : undefined;
    const result = await ingestNews({ sourceSlug });
    return c.json({
      ok: true,
      cron: "5 */6 * * * UTC",
      result,
    });
  } catch (e: any) {
    return c.json({ error: `Error al ejecutar ingesta: ${e.message}` }, 500);
  }
});

// POST /internal/news/cleanup – Protected cron endpoint for retention cleanup
newsApp.post("/api/internal/news/cleanup", async (c) => {
  const auth = requireCronSecret(c);
  if (!auth.ok) return c.json({ error: auth.error }, (auth.status || 401) as any);

  try {
    const result = await cleanupNews(new Date());
    return c.json({
      ok: true,
      cron: "30 3 * * * UTC",
      result,
    });
  } catch (e: any) {
    return c.json({ error: `Error al ejecutar cleanup: ${e.message}` }, 500);
  }
});

export default newsApp;
