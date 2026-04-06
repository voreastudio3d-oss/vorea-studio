// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const communityRepoState = vi.hoisted(() => ({
  models: [] as any[],
  profiles: new Map<string, any>(),
}));

const newsState = vi.hoisted(() => ({
  detail: null as any,
  list: { articles: [] as any[] },
}));

vi.mock("../community-repository.js", () => ({
  createCommunityRepository: () => ({
    getAllModels: async () => communityRepoState.models,
    getAllModelsRaw: async () => communityRepoState.models,
    getModel: async (id: string) => communityRepoState.models.find((model) => model.id === id) || null,
    upsertModel: async () => {},
    deleteModel: async () => {},
    getTag: async () => null,
    upsertTag: async () => {},
    listTags: async () => [],
    getLike: async () => null,
    upsertLike: async () => {},
    deleteLike: async () => {},
    listLikesByModel: async () => [],
    getUserProfile: async (id: string) => communityRepoState.profiles.get(id) || null,
    upsertUserProfile: async () => {},
  }),
}));

vi.mock("../news-service.js", () => ({
  getNewsDetail: async () => newsState.detail,
  listNews: async () => newsState.list,
}));

async function loadSeo() {
  return import("../seo.ts");
}

describe("seo helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    communityRepoState.models = [];
    communityRepoState.profiles.clear();
    newsState.detail = null;
    newsState.list = { articles: [] };
    process.env.FRONTEND_URL = "https://voreastudio3d.com";
  });

  it("marks private tool routes as noindex", async () => {
    const { buildSeoMetadata } = await loadSeo();
    const meta = await buildSeoMetadata("/ai-studio", "https://voreastudio3d.com/ai-studio");
    expect(meta.robots).toBe("noindex, nofollow");
    expect(meta.canonicalPath).toBe("/ai-studio");
    expect(meta.title).toBe("AI Studio | Vorea Studio");
  });

  it("normalizes locale variants for public marketing metadata", async () => {
    const { buildSeoMetadata } = await loadSeo();
    const meta = await buildSeoMetadata(
      "/for/ai-creators",
      "https://voreastudio3d.com/for/ai-creators",
      "en-US"
    );

    expect(meta.title).toBe("AI Studio for 3D creators | Vorea Studio");
    expect(meta.description).toBe(
      "Start from a text prompt and refine editable parametric 3D models with AI Studio."
    );
    expect(meta.locale).toBe("en_US");
  });

  it("builds model metadata from published community data", async () => {
    communityRepoState.models = [
      {
        id: "cm_demo",
        title: "Soporte ergonomico",
        authorId: "user_a",
        authorName: "Martina",
        tags: ["soporte", "telefono"],
        thumbnailUrl: "https://cdn.example.com/model.png",
        status: "published",
        canonicalPath: "/model/cm_demo/soporte-ergonomico",
      },
    ];

    const { buildSeoMetadata } = await loadSeo();
    const meta = await buildSeoMetadata("/model/cm_demo", "https://voreastudio3d.com/model/cm_demo");
    expect(meta.title).toContain("Soporte ergonomico");
    expect(meta.canonicalPath).toBe("/model/cm_demo/soporte-ergonomico");
    expect(meta.robots).toBe("index, follow");
    expect(meta.imageUrl).toBe("https://cdn.example.com/model.png");
  });

  it("renders json-ld and locale tags for news routes", async () => {
    newsState.detail = {
      slug: "nueva-impresora",
      titleDisplay: "Nueva impresora 3D industrial",
      titleOriginal: "New industrial printer",
      summary: "Resumen de la noticia.",
      detail: "Detalle ampliado.",
      whyItMatters: "Importa para la industria.",
      imageUrl: "https://cdn.example.com/news.png",
      author: "Equipo Vorea",
      publishedAt: "2026-03-22T12:00:00.000Z",
      fetchedAt: "2026-03-22T13:00:00.000Z",
      editorialTier: "indexable",
      indexable: true,
      source: { name: "3DPrint" },
    };

    const { buildSeoMetadata, renderSeoHead } = await loadSeo();
    const meta = await buildSeoMetadata("/news/nueva-impresora", "https://voreastudio3d.com/news/nueva-impresora");
    const head = renderSeoHead(meta, "https://voreastudio3d.com/news/nueva-impresora");
    expect(head).toContain('property="og:locale"');
    expect(head).toContain('hreflang="es"');
    expect(head).toContain('hreflang="en"');
    expect(head).toContain('hreflang="pt"');
    expect(head).toContain('hreflang="x-default"');
    expect(head).toContain('/es/news/nueva-impresora');
    expect(head).toContain('/en/news/nueva-impresora');
    expect(head).toContain("NewsArticle");
  });

  it("marks weak brief news pages as noindex", async () => {
    newsState.detail = {
      slug: "catalogo-resinas",
      titleDisplay: "Actualización de catálogo de resinas",
      titleOriginal: "Catalog update",
      summary: "Breve actualización de catálogo.",
      detail: "Breve actualización de catálogo.",
      whyItMatters: "Importa como señal breve del mercado.",
      imageUrl: null,
      author: null,
      publishedAt: "2026-03-22T12:00:00.000Z",
      fetchedAt: "2026-03-22T13:00:00.000Z",
      editorialTier: "brief",
      indexable: false,
      source: { name: "Vendor News" },
    };

    const { buildSeoMetadata } = await loadSeo();
    const meta = await buildSeoMetadata("/news/catalogo-resinas", "https://voreastudio3d.com/news/catalogo-resinas");
    expect(meta.robots).toBe("noindex, follow");
  });

  it("builds sitemap index and section sitemaps with static, model, user and news routes", async () => {
    communityRepoState.models = [
      {
        id: "cm_demo",
        title: "Caja modular",
        authorId: "user_a",
        authorName: "Martina",
        tags: ["caja"],
        status: "published",
        updatedAt: "2026-03-22T15:00:00.000Z",
        canonicalPath: "/model/cm_demo/caja-modular",
      },
    ];
    communityRepoState.profiles.set("user_a", {
      id: "user_a",
      displayName: "Martina",
      username: "martina-3d",
    });
    newsState.list = {
      articles: [
        {
          slug: "nueva-impresora",
          publishedAt: "2026-03-22T12:00:00.000Z",
          editorialTier: "indexable",
          indexable: true,
        },
        {
          slug: "catalogo-resinas",
          publishedAt: "2026-03-22T12:00:00.000Z",
          editorialTier: "brief",
          indexable: false,
        },
      ],
    };

    const { buildSitemapXml, buildSitemapSectionXml } = await loadSeo();
    const indexXml = await buildSitemapXml("https://voreastudio3d.com/sitemap.xml");
    const communityXml = await buildSitemapSectionXml("community", "https://voreastudio3d.com/sitemap.xml");
    const newsXml = await buildSitemapSectionXml("news", "https://voreastudio3d.com/sitemap.xml");
    expect(indexXml).toContain("<loc>https://voreastudio3d.com/sitemaps/core.xml</loc>");
    expect(communityXml).toContain("<loc>https://voreastudio3d.com/model/cm_demo/caja-modular</loc>");
    expect(communityXml).toContain("<loc>https://voreastudio3d.com/user/user_a/martina-3d/modelos</loc>");
    expect(newsXml).toContain("<loc>https://voreastudio3d.com/news/nueva-impresora</loc>");
    expect(newsXml).not.toContain("<loc>https://voreastudio3d.com/news/catalogo-resinas</loc>");
  });
});
