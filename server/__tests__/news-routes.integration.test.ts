// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  listNews: vi.fn(),
  getNewsDetail: vi.fn(),
  ingestNews: vi.fn(),
  cleanupNews: vi.fn(),
}));

vi.mock("../news-service.js", () => serviceMocks);

async function loadNewsApp() {
  const mod = await import("../news-routes.ts");
  return mod.default;
}

describe("news routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEWS_CRON_SECRET = "secret-123";
  });

  it("serves public news list and detail endpoints", async () => {
    serviceMocks.listNews.mockResolvedValue({
      articles: [
        {
          id: "nar_1",
          slug: "nota-demo",
          sourceId: "ns_3dprint",
          canonicalUrl: "https://3dprint.com/demo",
          titleOriginal: "Original title",
          titleDisplayEs: "Titulo demo",
          summaryEs: "Resumen",
          detailEs: "Detalle",
          titleDisplayEn: "Demo title",
          summaryEn: "Summary",
          detailEn: "Detail",
          titleDisplay: "Demo title",
          summary: "Summary",
          detail: "Detail",
          sourceExcerpt: "Extracto",
          imageUrl: null,
          author: null,
          category: "Industria",
          tags: ["impresion"],
          sourceLanguage: "en",
          publishedAt: new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 1000).toISOString(),
          status: "published",
          dedupeHash: "abc",
          requestedLanguage: "en",
          availableLanguages: ["es", "en"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: { id: "ns_3dprint", slug: "3dprint", name: "3DPrint.com", type: "news", language: "en" },
        },
      ],
      total: 1,
      page: 1,
      limit: 12,
    });
    serviceMocks.getNewsDetail.mockResolvedValue({
      id: "nar_1",
      slug: "nota-demo",
      sourceId: "ns_3dprint",
      canonicalUrl: "https://3dprint.com/demo",
      titleOriginal: "Original title",
      titleDisplayEs: "Titulo demo",
      summaryEs: "Resumen",
      detailEs: "Detalle",
      titleDisplayEn: "Demo title",
      summaryEn: "Summary",
      detailEn: "Detail",
      titleDisplay: "Demo title",
      summary: "Summary",
      detail: "Detail",
      sourceExcerpt: "Extracto",
      imageUrl: null,
      author: null,
      category: "Industria",
      tags: ["impresion"],
      sourceLanguage: "en",
      publishedAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000).toISOString(),
      status: "published",
      dedupeHash: "abc",
      requestedLanguage: "en",
      availableLanguages: ["es", "en"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: { id: "ns_3dprint", slug: "3dprint", name: "3DPrint.com", type: "news", language: "en" },
    });

    const app = await loadNewsApp();
    const listRes = await app.request("/api/news?limit=12&lang=en&sourceLanguage=en");
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.total).toBe(1);
    expect(serviceMocks.listNews).toHaveBeenCalledWith({
      source: undefined,
      category: undefined,
      sourceLanguage: "en",
      lang: "en",
      page: 1,
      limit: 12,
    });

    const detailRes = await app.request("/api/news/nota-demo?lang=en");
    expect(detailRes.status).toBe(200);
    const detailJson = await detailRes.json();
    expect(detailJson.article.slug).toBe("nota-demo");
    expect(serviceMocks.getNewsDetail).toHaveBeenCalledWith("nota-demo", { lang: "en" });
  });

  it("protects internal cron endpoints with x-news-cron-secret", async () => {
    serviceMocks.ingestNews.mockResolvedValue({
      totalSources: 1,
      fetchedCount: 1,
      insertedCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      runs: [],
    });
    serviceMocks.cleanupNews.mockResolvedValue({ deletedArticles: 2, deletedRuns: 1 });

    const app = await loadNewsApp();
    const missing = await app.request("/api/internal/news/ingest", { method: "POST" });
    expect(missing.status).toBe(401);

    const invalid = await app.request("/api/internal/news/cleanup", {
      method: "POST",
      headers: { "x-news-cron-secret": "wrong" },
    });
    expect(invalid.status).toBe(403);

    const ok = await app.request("/api/internal/news/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-news-cron-secret": "secret-123" },
      body: JSON.stringify({ sourceSlug: "3dprint" }),
    });
    expect(ok.status).toBe(200);
    expect(serviceMocks.ingestNews).toHaveBeenCalledWith({ sourceSlug: "3dprint" });
  });
});
