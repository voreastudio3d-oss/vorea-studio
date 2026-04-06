import { describe, expect, it } from "vitest";
import {
  buildNewsDeck,
  buildNewsWhyItMatters,
  getNewsContextParagraph,
  getNewsTierMeta,
  shouldShowOriginalTitle,
} from "../../news-presentation";
import type { NewsArticleResponse } from "../api-client";

function makeArticle(overrides: Partial<NewsArticleResponse> = {}): NewsArticleResponse {
  return {
    id: "nar_1",
    slug: "nota-demo",
    sourceId: "ns_demo",
    source: { id: "ns_demo", slug: "demo", name: "Demo Source", type: "news", language: "en" },
    canonicalUrl: "https://example.com/story",
    titleOriginal: "Original title",
    titleDisplayEs: "Titulo editorial",
    summaryEs: "Resumen editorial.",
    detailEs: "Contexto distinto.",
    titleDisplayEn: "Editorial title",
    summaryEn: "Editorial summary.",
    detailEn: "Distinct context.",
    titleDisplay: "Editorial title",
    summary: "Editorial summary.",
    detail: "Distinct context.",
    sourceExcerpt: "Source excerpt.",
    imageUrl: null,
    author: null,
    category: "Materials",
    tags: ["materials"],
    sourceLanguage: "en",
    publishedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000).toISOString(),
    status: "published",
    editorialTier: "indexable",
    indexable: true,
    whyItMatters: null,
    requestedLanguage: "en",
    availableLanguages: ["es", "en"],
    ...overrides,
  };
}

describe("news-presentation", () => {
  it("hides the detail block when it repeats the summary", () => {
    const article = makeArticle({ detail: "Editorial summary." });
    expect(getNewsContextParagraph(article)).toBeNull();
  });

  it("shows the original title only when it differs from the editorial title", () => {
    expect(shouldShowOriginalTitle(makeArticle())).toBe(true);
    expect(shouldShowOriginalTitle(makeArticle({ titleOriginal: "Editorial title" }))).toBe(false);
  });

  it("builds a deck and fallback why-it-matters without echoing the title", () => {
    const article = makeArticle({ whyItMatters: null });
    expect(buildNewsDeck(article, "en")).toContain("Editorial read from Demo Source");
    expect(buildNewsWhyItMatters(article, "en")).toContain("This signal from Demo Source");
  });

  it("maps editorial tiers to reader-facing labels", () => {
    expect(getNewsTierMeta(makeArticle({ editorialTier: "evergreen" }), "en").label).toBe("Evergreen guide");
    expect(getNewsTierMeta(makeArticle({ editorialTier: "brief", indexable: false }), "es").label).toBe("Radar breve");
  });
});
