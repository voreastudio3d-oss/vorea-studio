// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

type SourceStore = Map<string, any>;
type ArticleStore = Map<string, any>;
type RunStore = Map<string, any>;

const repoState = vi.hoisted(() => ({
  sources: new Map() as SourceStore,
  articles: new Map() as ArticleStore,
  runs: new Map() as RunStore,
}));

vi.mock("../news-repository.js", () => ({
  newsRepository: {
    seedSources: async (seeds: any[]) => {
      for (const seed of seeds) {
        repoState.sources.set(seed.slug, {
          ...seed,
          language: seed.language || "en",
          editorialPolicy: seed.editorialPolicy || "standard",
          editorialNotes: seed.editorialNotes ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    },
    listSources: async ({ enabledOnly }: { enabledOnly?: boolean } = {}) =>
      [...repoState.sources.values()].filter((source) => (enabledOnly ? source.enabled : true)),
    getSourceBySlug: async (slug: string) => repoState.sources.get(slug) || null,
    startRun: async (sourceId: string | null) => {
      const run = {
        id: `run_${repoState.runs.size + 1}`,
        sourceId,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        status: "running",
        fetchedCount: 0,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        error: null,
      };
      repoState.runs.set(run.id, run);
      return run;
    },
    finishRun: async (id: string, patch: any) => {
      const current = repoState.runs.get(id);
      repoState.runs.set(id, { ...current, ...patch });
    },
    upsertArticle: async (input: any) => {
      const key = `${input.sourceId}::${input.canonicalUrl}`;
      const current = repoState.articles.get(key);
      if (!current) {
        repoState.articles.set(key, { ...input });
        return "inserted";
      }
      const changed =
        current.titleDisplayEs !== input.titleDisplayEs ||
        current.summaryEs !== input.summaryEs ||
        current.detailEs !== input.detailEs ||
        current.titleDisplayEn !== input.titleDisplayEn ||
        current.summaryEn !== input.summaryEn ||
        current.detailEn !== input.detailEn;
      repoState.articles.set(key, { ...current, ...input });
      return changed ? "updated" : "skipped";
    },
    cleanupExpired: async () => ({ deletedArticles: 0, deletedRuns: 0 }),
    listPublishedArticles: async () => ({ articles: [], total: 0, page: 1, limit: 12 }),
    getPublishedArticleBySlug: async () => null,
  },
}));

const sampleFeed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <item>
      <title>New industrial resin expands large-format printing</title>
      <link>https://3dprint.com/999999/industrial-resin-large-format-printing/</link>
      <description><![CDATA[<p>A new high-strength resin targets large-format additive manufacturing workflows.</p>]]></description>
      <category>Materials</category>
      <pubDate>Wed, 19 Mar 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe("news-service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    repoState.sources.clear();
    repoState.articles.clear();
    repoState.runs.clear();
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
  });

  it("parses rss items into normalized raw news", async () => {
    const { __newsTestUtils } = (await import("../news-service.ts")) as any;
    const items = __newsTestUtils.parseFeedItems(sampleFeed, {
      id: "ns_3dprint",
      slug: "3dprint",
      name: "3DPrint.com",
      type: "news",
      language: "en",
      baseUrl: "https://3dprint.com",
      feedUrl: "https://3dprint.com/feed/",
      listingUrl: "https://3dprint.com/",
      fetchMode: "rss",
      enabled: true,
      priority: 10,
      editorialPolicy: "standard",
      editorialNotes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(items).toHaveLength(1);
    expect(items[0].canonicalUrl).toContain("industrial-resin-large-format-printing");
    expect(items[0].category).toBe("Materials");
    expect(items[0].excerpt).toContain("high-strength resin");
  });

  it("keeps ingestion idempotent by source and canonical url", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/feed")) {
        return new Response(sampleFeed, { status: 200, headers: { "Content-Type": "application/xml" } });
      }
      if (url.includes("generativelanguage.googleapis.com")) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        titleDisplayEs: "Nueva resina industrial amplía la impresión de gran formato",
                        summaryEs: "La nota presenta una resina de alta resistencia pensada para flujos de fabricación aditiva de mayor escala.",
                        detailEs: "El medio destaca una formulación enfocada en piezas grandes y aplicaciones industriales, con impacto potencial en materiales y tiempos de producción.",
                        titleDisplayEn: "New industrial resin expands large-format printing",
                        summaryEn: "The story covers a high-strength resin designed for larger-scale additive manufacturing workflows.",
                        detailEn: "The outlet highlights a formulation aimed at bigger parts and industrial applications, with potential impact on materials and production timing.",
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock as any);

    const { ingestNews } = await import("../news-service.ts");
    const first = await ingestNews({ sourceSlug: "3dprint" });
    const second = await ingestNews({ sourceSlug: "3dprint" });

    expect(first.insertedCount).toBe(1);
    expect(first.updatedCount).toBe(0);
    expect(second.insertedCount).toBe(0);
    expect(second.skippedCount).toBe(1);
    expect(repoState.articles.size).toBe(1);
    const stored = [...repoState.articles.values()][0];
    expect(stored.titleDisplayEn).toContain("industrial resin");
    expect(stored.summaryEs).toContain("alta resistencia");
  });

  it("filters non-article utility pages from listing ingestion", async () => {
    const { __newsTestUtils } = (await import("../news-service.ts")) as any;
    expect(__newsTestUtils.isLikelyArticleUrl("/about", "https://3dprint.com")).toBe(false);
    expect(__newsTestUtils.isLikelyArticleUrl("/privacy-policy", "https://3dprint.com")).toBe(false);
    expect(__newsTestUtils.isLikelyArticleUrl("/support-center", "https://3dprint.com")).toBe(false);
    expect(__newsTestUtils.isLikelyArticleUrl("/fr/", "https://www.voxelmatters.com")).toBe(false);
    expect(__newsTestUtils.isLikelyArticleUrl("/contribute/", "https://www.voxelmatters.com")).toBe(false);
    expect(__newsTestUtils.isLikelyArticleUrl("/am-focus/", "https://www.voxelmatters.com")).toBe(false);
    expect(
      __newsTestUtils.isLikelyArticleUrl(
        "/999999/industrial-resin-large-format-printing/",
        "https://3dprint.com"
      )
    ).toBe(true);
  });

  it("skips thin commercial listing items that read like catalog pages", async () => {
    const { __newsTestUtils } = (await import("../news-service.ts")) as any;
    expect(
      __newsTestUtils.shouldSkipThinCommercialItem(
        {
          id: "ns_macrotec",
          slug: "macrotec",
          name: "Macrotec Uruguay",
          type: "news",
          language: "es",
          baseUrl: "https://macrotec.com.uy",
          feedUrl: null,
          listingUrl: "https://macrotec.com.uy/novedades",
          fetchMode: "listing",
          enabled: true,
          priority: 20,
          editorialPolicy: "brief_only",
          editorialNotes: "Radar comercial",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          titleOriginal: "Impresión 3D y Láser | Macrotec",
          canonicalUrl: "https://macrotec.com.uy/impresion-3d-y-laser",
          excerpt:
            "Todo para imprimir en 3D en Uruguay. Impresoras 3D de filamento y de resina. Partes, accesorios y repuestos para tus impresoras 3D.",
          imageUrl: null,
          author: null,
          category: "Insumos",
          tags: [],
          sourceLanguage: "es",
          publishedAt: new Date().toISOString(),
        }
      )
    ).toBe(true);
  });

  it("skips utility and navigation pages even when they look like listing candidates", async () => {
    const { __newsTestUtils } = (await import("../news-service.ts")) as any;
    const source = {
      id: "ns_voxelmatters",
      slug: "voxelmatters",
      name: "VoxelMatters",
      type: "news",
      language: "en",
      baseUrl: "https://www.voxelmatters.com",
      feedUrl: "https://www.voxelmatters.com/feed/",
      listingUrl: "https://www.voxelmatters.com/",
      fetchMode: "listing" as const,
      enabled: true,
      priority: 70,
      editorialPolicy: "standard" as const,
      editorialNotes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(
      __newsTestUtils.shouldSkipUtilityIndexItem(source, {
        titleOriginal: "Contribute",
        canonicalUrl: "https://www.voxelmatters.com/contribute/",
        excerpt:
          "Submit PR Please use this form to submit press releases for our editors to consider for publication.",
        imageUrl: null,
        author: null,
        category: null,
        tags: [],
        sourceLanguage: "en",
        publishedAt: null,
      })
    ).toBe(true);

    expect(
      __newsTestUtils.shouldSkipUtilityIndexItem(source, {
        titleOriginal: "AM Focus",
        canonicalUrl: "https://www.voxelmatters.com/am-focus/",
        excerpt:
          "Industrial Aerospace AM Space Defense Automotive AM Consumer Products Construction Sustainability Medical AM Market AM Hardware AM Materials AM Service AM Software Events AM Focus Calendar.",
        imageUrl: null,
        author: null,
        category: null,
        tags: [],
        sourceLanguage: "en",
        publishedAt: null,
      })
    ).toBe(true);

    expect(
      __newsTestUtils.shouldSkipUtilityIndexItem(source, {
        titleOriginal: "What Will Change for Post-Processing in 2026?",
        canonicalUrl: "https://www.voxelmatters.com/post-processing-in-2026/",
        excerpt:
          "A fresh report highlights sustainability, safety and health as the next major shifts in post-processing workflows.",
        imageUrl: null,
        author: null,
        category: "Business",
        tags: ["Business"],
        sourceLanguage: "en",
        publishedAt: new Date().toISOString(),
      })
    ).toBe(false);
  });

  it("hides already-persisted utility articles from the public feed", async () => {
    const { __newsTestUtils } = (await import("../news-service.ts")) as any;
    expect(
      __newsTestUtils.shouldHideUtilityArticleRecord({
        id: "nar_voxel_contribute",
        slug: "contribute-utility",
        sourceId: "ns_voxelmatters",
        canonicalUrl: "https://www.voxelmatters.com/contribute/",
        titleOriginal: "Contribute",
        titleDisplayEs: "Contribute",
        summaryEs: "Contribute News Industrial Aerospace AM Space Defense Automotive AM Consumer Products.",
        detailEs: "VoxelMatters presenta esta actualización como una señal a seguir de cerca para el ecosistema 3D.",
        titleDisplayEn: "Contribute",
        summaryEn: "Contribute News Industrial Aerospace AM Space Defense Automotive AM Consumer Products.",
        detailEn: "VoxelMatters frames this update as a signal worth tracking for the 3D ecosystem.",
        sourceExcerpt:
          "Submit PR Please use this form to submit press releases for our editors to consider for publication.",
        imageUrl: null,
        author: null,
        category: null,
        tags: [],
        sourceLanguage: "en",
        publishedAt: null,
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        status: "published",
        editorialTier: "indexable",
        indexable: true,
        dedupeHash: "voxel-contribute",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: {
          id: "ns_voxelmatters",
          slug: "voxelmatters",
          name: "VoxelMatters",
          type: "news",
          language: "en",
          baseUrl: "https://www.voxelmatters.com",
          feedUrl: "https://www.voxelmatters.com/feed/",
          listingUrl: "https://www.voxelmatters.com/",
          fetchMode: "listing",
          enabled: true,
          priority: 70,
          editorialPolicy: "standard",
          editorialNotes: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
    ).toBe(true);
  });

  it("keeps editorial detail distinct from the summary when extra context exists", async () => {
    const { __newsTestUtils } = (await import("../news-service.ts")) as any;
    const detail = __newsTestUtils.finalizeEditorialDetail(
      {
        id: "ns_3dprint",
        slug: "3dprint",
        name: "3DPrint.com",
        type: "news",
        language: "en",
        baseUrl: "https://3dprint.com",
        feedUrl: "https://3dprint.com/feed/",
        listingUrl: "https://3dprint.com/",
        fetchMode: "rss",
        enabled: true,
        priority: 10,
        editorialPolicy: "standard",
        editorialNotes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        titleOriginal: "New industrial resin expands large-format printing",
        canonicalUrl: "https://3dprint.com/999999/industrial-resin-large-format-printing/",
        excerpt:
          "A new high-strength resin targets large-format additive manufacturing workflows. The release also points to faster post-processing for short production runs.",
        imageUrl: null,
        author: null,
        category: "Materials",
        tags: ["materials"],
        sourceLanguage: "en",
        publishedAt: new Date().toISOString(),
      },
      "A new high-strength resin targets large-format additive manufacturing workflows.",
      "A new high-strength resin targets large-format additive manufacturing workflows. The release also points to faster post-processing for short production runs.",
      "en"
    );

    expect(detail).toContain("faster post-processing");
    expect(detail).not.toContain("A new high-strength resin targets");
  });

  it("classifies high-value editorial items as evergreen or brief based on signal quality", async () => {
    const { __newsTestUtils } = (await import("../news-service.ts")) as any;
    const evergreen = __newsTestUtils.inferEditorialTier(
      {
        id: "ns_prusa",
        slug: "prusa",
        name: "Prusa Blog",
        type: "news",
        language: "en",
        baseUrl: "https://blog.prusa3d.com",
        feedUrl: "https://blog.prusa3d.com/feed",
        listingUrl: "https://blog.prusa3d.com",
        fetchMode: "rss",
        enabled: true,
        priority: 12,
        editorialPolicy: "standard",
        editorialNotes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        titleOriginal: "Guide to dialing in PETG profiles for large-format prints",
        canonicalUrl: "https://blog.prusa3d.com/guide-petg-large-format",
        excerpt: "A practical guide covering calibration, temperature bands and workflow decisions for stable PETG parts.",
        imageUrl: null,
        author: null,
        category: "Guides",
        tags: ["guide", "petg"],
        sourceLanguage: "en",
        publishedAt: new Date().toISOString(),
      },
      {
        titleDisplayEs: "Guía para ajustar perfiles PETG en impresiones de gran formato",
        summaryEs: "Una guía práctica sobre calibración, temperatura y flujo de trabajo para piezas PETG más estables.",
        detailEs: "La nota profundiza en cómo ajustar perfiles, evitar deformaciones y escalar piezas sin perder repetibilidad en taller.",
        titleDisplayEn: "Guide to dialing in PETG profiles for large-format prints",
        summaryEn: "A practical guide covering calibration, temperature bands and workflow decisions for stable PETG parts.",
        detailEn: "The piece expands on profile tuning, warp control and repeatable workshop workflows for larger parts.",
      }
    );

    const brief = __newsTestUtils.inferEditorialTier(
      {
        id: "ns_vendor",
        slug: "vendor",
        name: "Vendor News",
        type: "news",
        language: "es",
        baseUrl: "https://vendor.example.com",
        feedUrl: null,
        listingUrl: "https://vendor.example.com/novedades",
        fetchMode: "listing",
        enabled: true,
        priority: 80,
        editorialPolicy: "standard",
        editorialNotes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        titleOriginal: "Nueva actualización de catálogo de resinas",
        canonicalUrl: "https://vendor.example.com/catalogo-resinas",
        excerpt: "Se actualizó el catálogo de resinas disponibles para entrega inmediata.",
        imageUrl: null,
        author: null,
        category: "Materiales",
        tags: ["resina"],
        sourceLanguage: "es",
        publishedAt: new Date().toISOString(),
      },
      {
        titleDisplayEs: "Nueva actualización de catálogo de resinas",
        summaryEs: "Se actualizó el catálogo de resinas disponibles para entrega inmediata.",
        detailEs: "Disponible para entrega inmediata.",
        titleDisplayEn: "New resin catalog update",
        summaryEn: "The resin catalog has been refreshed for immediate delivery.",
        detailEn: "Available for immediate delivery.",
      }
    );

    expect(evergreen).toEqual({ editorialTier: "evergreen", indexable: true });
    expect(brief).toEqual({ editorialTier: "brief", indexable: false });
  });

  it("forces noisy sources in brief-only mode even when the content looks evergreen", async () => {
    const { __newsTestUtils } = (await import("../news-service.ts")) as any;
    const forcedBrief = __newsTestUtils.inferEditorialTier(
      {
        id: "ns_vendor_brief",
        slug: "vendor-brief",
        name: "Vendor Brief",
        type: "news",
        language: "es",
        baseUrl: "https://vendor.example.com",
        feedUrl: null,
        listingUrl: "https://vendor.example.com/blog",
        fetchMode: "listing",
        enabled: true,
        priority: 18,
        editorialPolicy: "brief_only",
        editorialNotes: "Mucho contenido comercial",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        titleOriginal: "Guía para ajustar perfiles PETG en impresiones de gran formato",
        canonicalUrl: "https://vendor.example.com/guia-petg",
        excerpt: "Una guía práctica sobre calibración, temperatura y flujo de trabajo para piezas PETG estables.",
        imageUrl: null,
        author: null,
        category: "Guides",
        tags: ["guide", "petg"],
        sourceLanguage: "es",
        publishedAt: new Date().toISOString(),
      },
      {
        titleDisplayEs: "Guía para ajustar perfiles PETG en impresiones de gran formato",
        summaryEs: "Una guía práctica sobre calibración, temperatura y flujo de trabajo para piezas PETG más estables.",
        detailEs: "La nota profundiza en cómo ajustar perfiles, evitar deformaciones y escalar piezas sin perder repetibilidad.",
        titleDisplayEn: "Guide to dialing in PETG profiles for large-format prints",
        summaryEn: "A practical guide covering calibration, temperature bands and workflow decisions for stable PETG parts.",
        detailEn: "The piece expands on profile tuning, warp control and repeatable workflows for larger parts.",
      }
    );

    expect(forcedBrief).toEqual({ editorialTier: "brief", indexable: false });
  });

  it("sanitizes malformed remote image urls before they reach the UI", async () => {
    const { __newsTestUtils } = (await import("../news-service.ts")) as any;
    expect(
      __newsTestUtils.sanitizeRemoteImageUrl("http://https//cdn.creality.com/media/example.webp")
    ).toBe("https://cdn.creality.com/media/example.webp");
    expect(__newsTestUtils.sanitizeRemoteImageUrl("//cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
  });

  it("normalizes legacy editorial boilerplate on read", async () => {
    const { __newsTestUtils } = (await import("../news-service.ts")) as any;
    const article = __newsTestUtils.localizeArticle(
      {
        id: "nar_legacy",
        slug: "legacy-news",
        sourceId: "ns_macrotec",
        canonicalUrl: "https://macrotec.com.uy/blog/example",
        titleOriginal: "Impresión 3D y Láser | Macrotec",
        titleDisplayEs: "Impresión 3D y Láser | Macrotec",
        summaryEs:
          "Resumen editorial de Macrotec Uruguay: Todo para imprimir en 3D en Uruguay. Impresoras 3D de filamento y de resina.",
        detailEs:
          "La fuente original publicó una actualización sobre Impresión 3D y Láser | Macrotec. Todo para imprimir en 3D en Uruguay. Impresoras 3D de filamento y de resina. También menciona repuestos y accesorios.",
        titleDisplayEn: null,
        summaryEn: null,
        detailEn: null,
        sourceExcerpt:
          "Todo para imprimir en 3D en Uruguay. Impresoras 3D de filamento y de resina. También menciona repuestos y accesorios.",
        imageUrl: null,
        author: null,
        category: "Insumos",
        tags: [],
        sourceLanguage: "es",
        publishedAt: new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1000 * 60).toISOString(),
        status: "published",
        editorialTier: "brief",
        indexable: false,
        dedupeHash: "legacy",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: {
          id: "ns_macrotec",
          slug: "macrotec",
          name: "Macrotec Uruguay",
          type: "news",
          language: "es",
          baseUrl: "https://macrotec.com.uy",
          feedUrl: null,
          listingUrl: "https://macrotec.com.uy/blog",
          fetchMode: "listing",
          enabled: true,
          priority: 10,
          editorialPolicy: "brief_only",
          editorialNotes: "Radar comercial",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      "es"
    );

    expect(article.summary).toBe("Todo para imprimir en 3D en Uruguay. Impresoras 3D de filamento y de resina.");
    expect(article.detail).toContain("También menciona repuestos y accesorios");
    expect(article.detail).not.toContain("La fuente original publicó");
    expect(article.editorialTier).toBe("brief");
    expect(article.indexable).toBe(false);
  });

  it("forces persisted articles from brief-only sources to read back as brief/noindex", async () => {
    const { __newsTestUtils } = (await import("../news-service.ts")) as any;
    const article = __newsTestUtils.localizeArticle(
      {
        id: "nar_voxel_live",
        slug: "voxel-live",
        sourceId: "ns_voxelmatters",
        canonicalUrl: "https://www.voxelmatters.com/feature-story/",
        titleOriginal: "Feature Story",
        titleDisplayEs: "Feature Story",
        summaryEs: "Una pieza todavía guardada como indexable desde una corrida anterior.",
        detailEs: "Más contexto editorial.",
        titleDisplayEn: "Feature Story",
        summaryEn: "A story that was previously stored as indexable.",
        detailEn: "More editorial context.",
        sourceExcerpt: "A story that was previously stored as indexable.",
        imageUrl: null,
        author: null,
        category: "Analysis",
        tags: ["analysis"],
        sourceLanguage: "en",
        publishedAt: new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1000 * 60).toISOString(),
        status: "published",
        editorialTier: "indexable",
        indexable: true,
        dedupeHash: "voxel-live",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: {
          id: "ns_voxelmatters",
          slug: "voxelmatters",
          name: "VoxelMatters",
          type: "news",
          language: "en",
          baseUrl: "https://www.voxelmatters.com",
          feedUrl: "https://www.voxelmatters.com/feed/",
          listingUrl: "https://www.voxelmatters.com/",
          fetchMode: "listing",
          enabled: true,
          priority: 70,
          editorialPolicy: "brief_only",
          editorialNotes: "Radar breve",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      "es"
    );

    expect(article.editorialTier).toBe("brief");
    expect(article.indexable).toBe(false);
  });
});
