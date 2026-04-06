import crypto from "node:crypto";
import { newsRepository, type NewsArticleRecord, type NewsSourceRecord } from "./news-repository.js";
import { DEFAULT_NEWS_SOURCES } from "./news-sources.js";

const USER_AGENT = "VoreaStudioNewsBot/1.0 (+https://voreastudio3d.com)";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const DEFAULT_RETENTION_DAYS = 45;
const DEFAULT_MAX_ITEMS_PER_SOURCE = Math.min(
  Math.max(parseInt(process.env.NEWS_MAX_ITEMS_PER_SOURCE || "6", 10), 1),
  12
);
let geminiCooldownUntil = 0;

export type RawNewsItem = {
  titleOriginal: string;
  canonicalUrl: string;
  excerpt: string;
  imageUrl: string | null;
  author: string | null;
  category: string | null;
  tags: string[];
  sourceLanguage: string | null;
  publishedAt: string | null;
};

type EditorialResult = {
  titleDisplayEs: string;
  summaryEs: string;
  detailEs: string;
  titleDisplayEn: string;
  summaryEn: string;
  detailEn: string;
  ctaTextEs: string | null;
  ctaTextEn: string | null;
  ctaUrl: string | null;
  editorialContext: string | null;
};

export type NewsLocale = "es" | "en";
export type NewsEditorialTier = "brief" | "indexable" | "evergreen";

export type LocalizedNewsArticleRecord = NewsArticleRecord & {
  titleDisplay: string;
  summary: string;
  detail: string;
  whyItMatters: string;
  ctaText: string | null;
  requestedLanguage: NewsLocale;
  availableLanguages: NewsLocale[];
};

export type NewsIngestionSummary = {
  totalSources: number;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  runs: Array<{
    source: string;
    status: string;
    fetchedCount: number;
    insertedCount: number;
    updatedCount: number;
    skippedCount: number;
    error: string | null;
  }>;
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function stripCdata(input: string): string {
  return input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function stripHtml(input: string): string {
  return decodeHtmlEntities(stripCdata(input))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeText(input: string, maxLength = 640): string {
  const text = stripHtml(input || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.slice(0, maxLength).trim();
}

function sanitizeRemoteImageUrl(input: string | null | undefined, baseUrl?: string): string | null {
  const raw = String(input || "").trim();
  if (!raw) return null;

  let value = decodeHtmlEntities(raw)
    .replace(/^https?:\/\/https:\/\//i, "https://")
    .replace(/^https?:\/\/http:\/\//i, "http://")
    .replace(/^https?:\/\/https\/\//i, "https://")
    .replace(/^https?:\/\/http\/\//i, "http://");

  if (value.startsWith("//")) {
    value = `https:${value}`;
  }

  try {
    const parsed = new URL(value, baseUrl || "https://voreastudio3d.com");
    if ((parsed.hostname === "https" || parsed.hostname === "http") && parsed.pathname.startsWith("//")) {
      return sanitizeRemoteImageUrl(`${parsed.hostname}:${parsed.pathname}${parsed.search}${parsed.hash}`, baseUrl);
    }
    if (!/^https?:$/.test(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function splitSentences(input: string): string[] {
  return sanitizeText(input, 2400)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function normalizeComparableText(input: string): string {
  return sanitizeText(input, 1200)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countKeywordHits(haystack: string, keywords: string[]): number {
  return keywords.reduce((total, keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return total + ((haystack.match(new RegExp(`\\b${escaped}\\b`, "g")) || []).length);
  }, 0);
}

function extractDistinctSentences(text: string, referenceTexts: string[] = [], max = 3): string[] {
  const reference = referenceTexts.map(normalizeComparableText).filter(Boolean);
  const seen = new Set<string>();
  const sentences: string[] = [];

  for (const sentence of splitSentences(text)) {
    const normalized = normalizeComparableText(sentence);
    if (!normalized || seen.has(normalized)) continue;
    if (reference.some((entry) => entry.includes(normalized) || normalized.includes(entry))) continue;
    seen.add(normalized);
    sentences.push(sentence);
    if (sentences.length >= max) break;
  }

  return sentences;
}

function clipSentence(text: string, maxLength = 220): string {
  return sanitizeText(text, maxLength).replace(/\s+/g, " ").trim();
}

function stripLegacyEditorialPrefix(text: string, lang: NewsLocale): string {
  const value = clipSentence(text, 900);
  if (!value) return "";

  if (lang === "en") {
    return value
      .replace(/^editorial summary from [^:]+:\s*/i, "")
      .replace(/^latest update detected from [^.]+\.?\s*/i, "")
      .replace(/^the original source published an update about [^.]+\.\s*/i, "")
      .trim();
  }

  return value
    .replace(/^resumen editorial de [^:]+:\s*/i, "")
    .replace(/^actualizacion reciente detectada en [^.]+\.?\s*/i, "")
    .replace(/^la fuente original publico una actualizacion sobre [^.]+\.\s*/i, "")
    .replace(/^la fuente original publicó una actualización sobre [^.]+\.\s*/i, "")
    .trim();
}

function normalizeEditorialParagraph(text: string, lang: NewsLocale, maxLength = 320): string {
  return clipSentence(stripLegacyEditorialPrefix(text, lang), maxLength);
}

function dedupeParagraph(primary: string, secondary: string): string {
  const clippedPrimary = clipSentence(primary, 360);
  const distinct = extractDistinctSentences(secondary, [clippedPrimary], 2);
  if (distinct.length === 0) return "";
  return clipSentence(distinct.join(" "), 520);
}

function sourceLooksRegional(source: NewsSourceRecord): boolean {
  return source.priority <= 39 || /\.uy\b/.test(source.baseUrl) || /uruguay/i.test(source.name);
}

function buildWhyItMatters(source: NewsSourceRecord, item: RawNewsItem, summary: string, detail: string, lang: NewsLocale): string {
  const sourceName = source.name;
  const category = sanitizeText(item.category || "", 80);
  const categoryText = category ? (lang === "en" ? ` in ${category.toLowerCase()}` : ` en ${category.toLowerCase()}`) : "";
  const regional = sourceLooksRegional(source);
  const distinctDetail = detail && normalizeComparableText(detail) !== normalizeComparableText(summary) ? detail : "";

  if (lang === "en") {
    if (regional) {
      return clipSentence(
        `It matters because signals from ${sourceName} can quickly affect local availability, pricing and buying decisions${categoryText} across the 3D printing market. ${distinctDetail}`.trim(),
        1200
      );
    }
    return clipSentence(
      `It matters because this signal from ${sourceName} may influence tools, materials or workflows${categoryText} that makers and print shops keep close to their roadmap. ${distinctDetail}`.trim(),
      1200
    );
  }

  if (regional) {
    return clipSentence(
      `Importa porque una señal de ${sourceName} puede mover disponibilidad, precios o decisiones de compra${categoryText} dentro del mercado 3D regional. ${distinctDetail}`.trim(),
      1200
    );
  }

  return clipSentence(
    `Importa porque esta señal de ${sourceName} puede influir en herramientas, materiales o flujos${categoryText} que makers y talleres siguen de cerca para decidir qué probar o adoptar. ${distinctDetail}`.trim(),
    1200
  );
}

function buildFallbackSummary(item: RawNewsItem): string {
  const sentences = splitSentences(item.excerpt || item.titleOriginal);
  if (sentences.length > 0) {
    return clipSentence(sentences[0], 220);
  }
  return clipSentence(item.titleOriginal, 220);
}

function buildFallbackDetail(source: NewsSourceRecord, item: RawNewsItem, summary: string, lang: NewsLocale): string {
  const distinctFromExcerpt = dedupeParagraph(summary, item.excerpt || "");
  if (distinctFromExcerpt) return distinctFromExcerpt;

  const category = sanitizeText(item.category || "", 80);
  if (lang === "en") {
    return clipSentence(
      category
        ? `${source.name} frames this update within ${category.toLowerCase()} and positions it as a signal worth tracking for the 3D ecosystem.`
        : `${source.name} frames this update as a signal worth tracking for the 3D ecosystem and adjacent maker workflows.`,
      320
    );
  }

  return clipSentence(
    category
      ? `${source.name} encuadra esta actualización dentro de ${category.toLowerCase()} y la plantea como una señal a seguir de cerca para el ecosistema 3D.`
      : `${source.name} presenta esta actualización como una señal a seguir de cerca para el ecosistema 3D y los flujos maker relacionados.`,
    320
  );
}

function finalizeEditorialDetail(
  source: NewsSourceRecord,
  item: RawNewsItem,
  summary: string,
  detail: string,
  lang: NewsLocale
): string {
  const cleanedDetail = clipSentence(detail, 900);
  const dedupedDetail = dedupeParagraph(summary, cleanedDetail);
  if (dedupedDetail) return dedupedDetail;
  return buildFallbackDetail(source, item, summary, lang);
}

function shouldSkipThinCommercialItem(source: NewsSourceRecord, item: RawNewsItem): boolean {
  const joined = normalizeComparableText(
    `${item.titleOriginal} ${item.excerpt} ${item.canonicalUrl} ${item.category || ""}`
  );
  if (!joined) return true;

  const commerceTerms = [
    "accesorios",
    "repuestos",
    "partes",
    "tienda",
    "shop",
    "catalog",
    "catalogo",
    "comprar",
    "precios",
    "precio",
    "oferta",
    "ofertas",
    "distribuidor",
    "stock",
    "servicio tecnico",
    "todo para",
    "filamento",
    "resina",
  ];

  const articleSignals = [
    "lanza",
    "lanzamiento",
    "presenta",
    "anuncia",
    "analisis",
    "estudio",
    "reporta",
    "caso",
    "guia",
    "investigacion",
    "introduces",
    "launch",
    "announces",
    "study",
    "report",
    "case study",
    "guide",
    "update",
    "raises",
    "funding",
    "printer review",
  ];

  const sourceNameNormalized = normalizeComparableText(source.name);
  const titleNormalized = normalizeComparableText(item.titleOriginal);
  const excerptNormalized = normalizeComparableText(item.excerpt);
  const commerceHits = countKeywordHits(joined, commerceTerms);
  const articleHits = countKeywordHits(joined, articleSignals);
  const hasSourceBrandedTitle =
    !!sourceNameNormalized &&
    (titleNormalized.endsWith(sourceNameNormalized) || titleNormalized.includes(` ${sourceNameNormalized}`));
  const looksLikeCategoryPage = /(blog|blogs|news|novedades)?\/?[a-z0-9-]+$/.test(new URL(item.canonicalUrl).pathname.toLowerCase());
  const excerptTooThin = excerptNormalized.length < 120;

  if (commerceHits >= 3 && articleHits === 0) return true;
  if (hasSourceBrandedTitle && commerceHits >= 2 && excerptTooThin) return true;
  if (looksLikeCategoryPage && commerceHits >= 4) return true;
  return false;
}

function shouldSkipUtilityIndexItem(source: NewsSourceRecord, item: RawNewsItem): boolean {
  try {
    const candidate = new URL(item.canonicalUrl, source.baseUrl);
    const path = candidate.pathname.toLowerCase().replace(/\/+$/, "") || "/";
    const title = normalizeComparableText(item.titleOriginal);
    const excerpt = normalizeComparableText(item.excerpt);
    const joined = `${title} ${excerpt}`.trim();

    if (/^\/(fr|de|it|es|en)$/.test(path)) return true;
    if (
      /^\/(contribute|advertise|contact|team|about|podcast|calendar|resources|reviews?|ebooks?|webinars?|am-focus|am-focus-calendar)$/.test(
        path
      )
    ) {
      return true;
    }

    const genericTitles = [
      "contribute",
      "advertise",
      "contact",
      "team",
      "podcast",
      "calendar",
      "resources",
      "review",
      "reviews",
      "ebook",
      "ebooks",
      "webinar",
      "webinars",
      "am focus",
    ];
    if (genericTitles.includes(title)) return true;

    const navigationTerms = [
      "industrial",
      "aerospace",
      "space",
      "defense",
      "automotive",
      "consumer products",
      "construction",
      "sustainability",
      "medical",
      "dental",
      "bioprinting",
      "market",
      "hardware",
      "materials",
      "service",
      "software",
      "events",
      "research",
      "education",
      "analysis",
      "resources",
      "reviews",
      "webinars",
      "interviews",
      "stocks",
      "guides",
      "calendar",
      "podcast",
      "advertise",
      "contact",
      "submit pr",
    ];
    const navHits = countKeywordHits(joined, navigationTerms);
    if (navHits >= 6 && (genericTitles.some((token) => title.includes(token)) || path.split("/").filter(Boolean).length <= 1)) {
      return true;
    }

    if (/please use this form to submit press releases/.test(joined)) return true;
    return false;
  } catch {
    return false;
  }
}

function inferEditorialTier(source: NewsSourceRecord, item: RawNewsItem, editorial: EditorialResult): {
  editorialTier: NewsEditorialTier;
  indexable: boolean;
} {
  if (source.editorialPolicy === "brief_only") {
    return { editorialTier: "brief", indexable: false };
  }

  const joined = normalizeComparableText(
    [
      item.titleOriginal,
      item.excerpt,
      editorial.summaryEs,
      editorial.detailEs,
      item.category || "",
      item.tags.join(" "),
    ].join(" ")
  );

  const evergreenHits = countKeywordHits(joined, [
    "guia",
    "guide",
    "tutorial",
    "how to",
    "comparativa",
    "comparison",
    "benchmark",
    "workflow",
    "flujo",
    "case study",
    "caso",
    "tendencia",
    "trend",
    "tips",
    "checklist",
    "explainer",
  ]);
  const newsHits = countKeywordHits(joined, [
    "anuncia",
    "announce",
    "launch",
    "lanzamiento",
    "update",
    "raises",
    "funding",
    "presenta",
    "reporta",
    "study",
    "analisis",
    "analysis",
  ]);
  const summaryLength = normalizeComparableText(editorial.summaryEs).length;
  const detailDistinct =
    normalizeComparableText(editorial.detailEs) !== normalizeComparableText(editorial.summaryEs) &&
    normalizeComparableText(editorial.detailEs).length >= 70;
  const sourceText = normalizeComparableText(source.name);
  const brandedSnippet =
    !!sourceText &&
    normalizeComparableText(item.titleOriginal).includes(sourceText) &&
    normalizeComparableText(item.excerpt).includes(sourceText);

  if (evergreenHits >= 1 && detailDistinct) {
    return { editorialTier: "evergreen", indexable: true };
  }

  if (summaryLength >= 90 && detailDistinct && (newsHits >= 1 || source.priority <= 45) && !brandedSnippet) {
    return { editorialTier: "indexable", indexable: true };
  }

  return { editorialTier: "brief", indexable: false };
}

function normalizeSourceEditorialPolicy(source: Partial<NewsSourceRecord> | null | undefined): "standard" | "brief_only" {
  return source?.editorialPolicy === "brief_only" ? "brief_only" : "standard";
}

function shouldHideUtilityArticleRecord(article: NewsArticleRecord): boolean {
  const source = article.source || {
    id: article.sourceId,
    slug: article.sourceId,
    name: "Vorea",
    type: "news",
    language: normalizeNewsLocale(article.sourceLanguage || "es"),
    baseUrl: article.canonicalUrl,
    feedUrl: null,
    listingUrl: null,
    fetchMode: "listing" as const,
    enabled: true,
    priority: 100,
    editorialPolicy: normalizeSourceEditorialPolicy(null),
    editorialNotes: null,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  };

  return shouldSkipUtilityIndexItem(source, {
    titleOriginal: article.titleOriginal,
    canonicalUrl: article.canonicalUrl,
    excerpt: article.sourceExcerpt || article.summaryEs || article.summaryEn || article.detailEs || article.detailEn || "",
    imageUrl: article.imageUrl,
    author: article.author,
    category: article.category,
    tags: article.tags,
    sourceLanguage: article.sourceLanguage,
    publishedAt: article.publishedAt,
  });
}

function normalizeUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

function isLikelyArticleUrl(url: string, baseUrl: string): boolean {
  try {
    const candidate = new URL(url, baseUrl);
    const base = new URL(baseUrl);
    if (candidate.hostname !== base.hostname) return false;
    const path = candidate.pathname.toLowerCase();
    if (!path || path === "/") return false;
    if (/\/(tag|category|author|page|topic|search|feed|shop|store|cart|checkout)\b/.test(path)) return false;
    if (/^\/(fr|de|it|es|en)\/?$/.test(path)) return false;
    if (/\/(about|privacy|terms|support|help|archive|events|downloads?|contact|careers|advertise|press|podcast|team|calendar|resources|reviews?|ebooks?|webinars?|contribute)\b/.test(path)) {
      return false;
    }
    if (/(privacy-policy|cookie-policy|terms-of-service|support-center|event-archive|warranty|returns|shipping)/.test(path)) {
      return false;
    }
    if (/(^|\/)(am-focus|am-focus-calendar)(\/|$)/.test(path)) return false;
    if (/(impresion-3d-y-laser|filamentos|resinas|impresoras-3d|consumibles|consumables|accessories|spare-parts)/.test(path)) {
      return false;
    }
    if (/\.(jpg|jpeg|png|gif|svg|webp|xml|pdf)$/i.test(path)) return false;
    return path.split("/").filter(Boolean).length >= 1;
  } catch {
    return false;
  }
}

function hashText(value: string): string {
  return crypto.createHash("sha1").update(value).digest("hex");
}

function takeUnique<T>(items: T[], keyFn: (item: T) => string, limit: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function toIso(input: unknown): string | null {
  if (!input) return null;
  const date = new Date(String(input));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function addDays(days: number, from?: string | null): string {
  const base = from ? new Date(from) : new Date();
  if (Number.isNaN(base.getTime())) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeNewsLocale(input?: string | null): NewsLocale {
  return String(input || "").toLowerCase().startsWith("en") ? "en" : "es";
}

function extractTag(block: string, tagNames: string[]): string | null {
  for (const tagName of tagNames) {
    const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = block.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
    if (match?.[1]) {
      const value = sanitizeText(match[1], 4000);
      if (value) return value;
    }
  }
  return null;
}

function extractTagValues(block: string, tagNames: string[]): string[] {
  const values: string[] = [];
  for (const tagName of tagNames) {
    const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "gi");
    let match = regex.exec(block);
    while (match) {
      const value = sanitizeText(match[1], 120);
      if (value) values.push(value);
      match = regex.exec(block);
    }
  }
  return values;
}

function extractAtomLink(block: string): string | null {
  const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  if (hrefMatch?.[1]) return hrefMatch[1];
  const relMatch = block.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["'][^>]*\/?>/i);
  return relMatch?.[1] || null;
}

function extractImageFromXml(block: string): string | null {
  const mediaContent = block.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1];
  if (mediaContent) return mediaContent;
  const mediaThumbnail = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1];
  if (mediaThumbnail) return mediaThumbnail;
  const enclosure = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i)?.[1];
  if (enclosure) return enclosure;
  const imgInDescription = block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  return imgInDescription || null;
}

function parseFeedItems(xml: string, source: NewsSourceRecord): RawNewsItem[] {
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const entryBlocks = itemBlocks.length ? [] : xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  const blocks = itemBlocks.length ? itemBlocks : entryBlocks;

  return blocks
    .map((block): RawNewsItem | null => {
      const title = extractTag(block, ["title"]);
      const link = itemBlocks.length
        ? extractTag(block, ["link"])
        : extractAtomLink(block);
      if (!title || !link) return null;

      const excerpt =
        extractTag(block, ["description", "content:encoded", "summary", "content"]) || "";
      const categories = extractTagValues(block, ["category"]);
      const author =
        extractTag(block, ["dc:creator", "author", "name"]) || null;
      const publishedAt =
        extractTag(block, ["pubDate", "published", "updated"]) || null;

      return {
        titleOriginal: sanitizeText(title, 260),
        canonicalUrl: normalizeUrl(link, source.baseUrl),
        excerpt: sanitizeText(excerpt, 900),
        imageUrl: sanitizeRemoteImageUrl(extractImageFromXml(block), source.baseUrl),
        author: author ? sanitizeText(author, 120) : null,
        category: categories[0] || null,
        tags: takeUnique(
          categories.map((tag) => sanitizeText(tag, 60)).filter(Boolean),
          (tag) => tag.toLowerCase(),
          8
        ),
        sourceLanguage: guessLanguageFromSource(source),
        publishedAt: toIso(publishedAt),
      };
    })
    .filter((item): item is RawNewsItem => !!item && !!item.canonicalUrl);
}

function extractMeta(html: string, name: string): string | null {
  const attr = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${attr}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${attr}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${attr}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${attr}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]).trim();
  }
  return null;
}

function extractTitleFromHtml(block: string): string | null {
  const headingMatch = block.match(/<(h1|h2|h3)[^>]*>([\s\S]*?)<\/\1>/i);
  if (headingMatch?.[2]) return sanitizeText(headingMatch[2], 260);
  const titleAttr = block.match(/title=["']([^"']+)["']/i)?.[1];
  return titleAttr ? sanitizeText(titleAttr, 260) : null;
}

function extractAnchorUrl(block: string, baseUrl: string): string | null {
  const matches = [...block.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)];
  for (const match of matches) {
    const href = match[1];
    if (isLikelyArticleUrl(href, baseUrl)) {
      return normalizeUrl(href, baseUrl);
    }
  }
  return null;
}

function parseListingItems(html: string, source: NewsSourceRecord): Array<{ url: string; title: string }> {
  const articleBlocks = html.match(/<article\b[\s\S]*?<\/article>/gi) || [];
  const candidates = articleBlocks.length
    ? articleBlocks
    : html.match(/<(div|section)[^>]+class=["'][^"']*(post|article|story|entry)[^"']*["'][\s\S]*?<\/\1>/gi) || [];

  const items = candidates
    .map((block) => {
      const url = extractAnchorUrl(block, source.baseUrl);
      const title = extractTitleFromHtml(block);
      if (!url || !title) return null;
      return { url, title };
    })
    .filter((item): item is { url: string; title: string } => !!item);

  if (items.length > 0) {
    return takeUnique(items, (item) => item.url, DEFAULT_MAX_ITEMS_PER_SOURCE);
  }

  const anchorItems = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const url = match[1];
      const title = sanitizeText(match[2], 260);
      if (!title || !isLikelyArticleUrl(url, source.baseUrl)) return null;
      return { url: normalizeUrl(url, source.baseUrl), title };
    })
    .filter((item): item is { url: string; title: string } => !!item);

  return takeUnique(anchorItems, (item) => item.url, DEFAULT_MAX_ITEMS_PER_SOURCE);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      "accept-language": "en-US,en;q=0.9,es;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} for ${url}`);
  }
  return res.text();
}

function guessLanguageFromSource(source: NewsSourceRecord): string | null {
  return source.language || null;
}

async function fetchListingDetail(
  source: NewsSourceRecord,
  entry: { url: string; title: string }
): Promise<RawNewsItem> {
  const html = await fetchText(entry.url);
  const title =
    extractMeta(html, "og:title") ||
    extractMeta(html, "twitter:title") ||
    sanitizeText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || entry.title, 260);
  const excerpt =
    extractMeta(html, "description") ||
    extractMeta(html, "og:description") ||
    sanitizeText(html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "", 900);
  const imageUrl =
    sanitizeRemoteImageUrl(
      extractMeta(html, "og:image") ||
      extractMeta(html, "twitter:image") ||
      null,
      source.baseUrl
    );
  const author =
    extractMeta(html, "author") ||
    sanitizeText(html.match(/rel=["']author["'][^>]*>([\s\S]*?)</i)?.[1] || "", 120) ||
    null;
  const category =
    sanitizeText(html.match(/<a[^>]+rel=["']category tag["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] || "", 80) ||
    null;
  const publishedAt =
    extractMeta(html, "article:published_time") ||
    sanitizeText(html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1] || "", 80) ||
    null;

  return {
    titleOriginal: title || entry.title,
    canonicalUrl: entry.url,
    excerpt,
    imageUrl,
    author,
    category,
    tags: category ? [category] : [],
    sourceLanguage: guessLanguageFromSource(source),
    publishedAt: toIso(publishedAt),
  };
}

function buildFallbackEditorial(source: NewsSourceRecord, item: RawNewsItem): EditorialResult {
  const sourceLanguage = normalizeNewsLocale(item.sourceLanguage || source.language);
  const summaryEs = buildFallbackSummary(item);
  const detailEs = buildFallbackDetail(source, item, summaryEs, "es");
  const summaryEn = sourceLanguage === "en" ? buildFallbackSummary(item) : clipSentence(`Editorial summary: ${buildFallbackSummary(item)}`, 220);
  const detailEn = buildFallbackDetail(source, item, summaryEn, "en");
  const title = sanitizeText(item.titleOriginal, 180) || "3D news update";
  const titleDisplayEs = title;
  const titleDisplayEn = title;
  return {
    titleDisplayEs,
    summaryEs,
    detailEs,
    titleDisplayEn,
    summaryEn,
    detailEn,
    ctaTextEs: null,
    ctaTextEn: null,
    ctaUrl: item.canonicalUrl || null,
    editorialContext: null,
  };
}

function parseGeminiJson(raw: string): EditorialResult | null {
  const cleaned = raw
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    const titleDisplayEs = sanitizeText(parsed?.titleDisplayEs || "", 180);
    const summaryEs = sanitizeText(parsed?.summaryEs || "", 360);
    const detailEs = sanitizeText(parsed?.detailEs || "", 900);
    const titleDisplayEn = sanitizeText(parsed?.titleDisplayEn || parsed?.titleDisplay || "", 180);
    const summaryEn = sanitizeText(parsed?.summaryEn || "", 360);
    const detailEn = sanitizeText(parsed?.detailEn || "", 900);
    if (!titleDisplayEs || !summaryEs || !detailEs) return null;
    if (!titleDisplayEn || !summaryEn || !detailEn) return null;
    const ctaTextEs = sanitizeText(parsed?.ctaTextEs || "", 120) || null;
    const ctaTextEn = sanitizeText(parsed?.ctaTextEn || "", 120) || null;
    const ctaUrl = sanitizeText(parsed?.ctaUrl || "", 500) || null;
    const editorialContext = sanitizeText(parsed?.editorialContext || "", 500) || null;
    return {
      titleDisplayEs,
      summaryEs: clipSentence(summaryEs, 320),
      detailEs: clipSentence(detailEs, 900),
      titleDisplayEn,
      summaryEn: clipSentence(summaryEn, 320),
      detailEn: clipSentence(detailEn, 900),
      ctaTextEs,
      ctaTextEn,
      ctaUrl,
      editorialContext,
    };
  } catch {
    return null;
  }
}

async function summarizeWithGemini(source: NewsSourceRecord, item: RawNewsItem): Promise<EditorialResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (Date.now() < geminiCooldownUntil) return null;

  const prompt = [
    "Sos un editor de noticias para Vorea Studio, una plataforma de modelado 3D paramétrico con base en Uruguay.",
    "Objetivo: producir una síntesis editorial breve en español e inglés a partir de una noticia externa sobre impresión 3D, fabricación digital o comunidad maker.",
    "",
    "CONTEXTO DE AUDIENCIA (prioridad regional):",
    "1. Uruguay: Macrotec, Fabrix, comunidad maker local — máxima relevancia",
    "2. Argentina, Chile, México: mercado LATAM, insumos, ofertas regionales",
    "3. España: comunidad hispanoparlante, referencias educativas",
    "4. USA y resto del mundo: tecnología global, Creality, Bambu Lab, Prusa, tendencias",
    "",
    "Reglas:",
    "- No copies párrafos completos de la fuente.",
    "- No inventes hechos que no estén sugeridos por el título o el extracto.",
    "- Mantén un tono informativo y claro en ambos idiomas.",
    "- Si la noticia es de una fuente regional (Uruguay/LATAM), enfatizá su relevancia local: disponibilidad, precios, tiendas.",
    "- Si la noticia es de una fuente global, destacá cómo impacta al mercado regional (ej: nuevo producto disponible en LATAM, precio competitivo, etc.).",
    "- Si la fuente está originalmente en inglés, el bloque en inglés puede ser más cercano al título/extracto original; si está en español, idem para español.",
    "- Responde SOLO con JSON válido.",
    "",
    JSON.stringify(
      {
        source: source.name,
        sourceLanguage: source.language,
        titleOriginal: item.titleOriginal,
        excerpt: item.excerpt,
        author: item.author,
        category: item.category,
        publishedAt: item.publishedAt,
        canonicalUrl: item.canonicalUrl,
      },
      null,
      2
    ),
    "",
    'Formato exacto: {"titleDisplayEs":"...","summaryEs":"...","detailEs":"...","titleDisplayEn":"...","summaryEn":"...","detailEn":"...","ctaTextEs":"...","ctaTextEn":"...","ctaUrl":"...","editorialContext":"..."}',
    '',
    'Campos CTA y contexto:',
    '- ctaTextEs: texto breve (~60 chars) invitando al lector a leer más, ej: "Conocé los detalles de este lanzamiento"',
    '- ctaTextEn: English equivalent, ej: "Discover the full details of this launch"',
    '- ctaUrl: la URL canónica del artículo original (la que ya tenés en el contexto)',
    '- editorialContext: 1-2 oraciones explicando por qué esta noticia es relevante para la comunidad 3D/maker latinoamericana',
  ].join("\n");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.log(`[news] Gemini error ${res.status}: ${body.slice(0, 300)}`);
    if (res.status === 429) {
      geminiCooldownUntil = Date.now() + 30 * 60 * 1000;
    }
    return null;
  }

  const json: any = await res.json().catch(() => null);
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!raw) return null;
  return parseGeminiJson(raw);
}

async function buildEditorial(source: NewsSourceRecord, item: RawNewsItem): Promise<EditorialResult> {
  const ai = await summarizeWithGemini(source, item).catch((error) => {
    console.log(`[news] AI summary fallback for ${source.slug}: ${String(error)}`);
    return null;
  });
  const editorial = ai || buildFallbackEditorial(source, item);
  const normalizedSummaryEs = buildFallbackSummary({
    ...item,
    excerpt: editorial.summaryEs,
  });
  const normalizedSummaryEn = buildFallbackSummary({
    ...item,
    excerpt: editorial.summaryEn,
  });

  return {
    ...editorial,
    summaryEs: clipSentence(editorial.summaryEs || normalizedSummaryEs, 320),
    detailEs: finalizeEditorialDetail(source, item, editorial.summaryEs || normalizedSummaryEs, editorial.detailEs, "es"),
    summaryEn: clipSentence(editorial.summaryEn || normalizedSummaryEn, 320),
    detailEn: finalizeEditorialDetail(source, item, editorial.summaryEn || normalizedSummaryEn, editorial.detailEn, "en"),
  };
}

function localizeArticle(article: NewsArticleRecord, requestedLanguage?: string | null): LocalizedNewsArticleRecord {
  const lang = normalizeNewsLocale(requestedLanguage);
  const availableLanguages: NewsLocale[] = ["es"];
  const normalizedImageUrl = sanitizeRemoteImageUrl(article.imageUrl, article.source?.baseUrl || article.canonicalUrl);
  const sourceEditorialPolicy = normalizeSourceEditorialPolicy(article.source);
  const shouldRespectStoredSignals = sourceEditorialPolicy !== "brief_only";
  const editorialSignals = inferEditorialTier(
    article.source || {
      id: article.sourceId,
      slug: article.sourceId,
      name: "Vorea",
      type: "news",
      language: normalizeNewsLocale(article.sourceLanguage || "es"),
      baseUrl: article.canonicalUrl,
      feedUrl: null,
      listingUrl: null,
      fetchMode: "rss",
      enabled: true,
      priority: 100,
      editorialPolicy: normalizeSourceEditorialPolicy(null),
      editorialNotes: null,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    },
    {
      titleOriginal: article.titleOriginal,
      canonicalUrl: article.canonicalUrl,
      excerpt: article.sourceExcerpt || article.summaryEs || article.summaryEn || "",
      imageUrl: normalizedImageUrl,
      author: article.author || null,
      category: article.category || null,
      tags: article.tags,
      sourceLanguage: article.sourceLanguage || "es",
      publishedAt: article.publishedAt,
    },
    {
      titleDisplayEs: article.titleDisplayEs,
      summaryEs: article.summaryEs,
      detailEs: article.detailEs,
      titleDisplayEn: article.titleDisplayEn || article.titleOriginal,
      summaryEn: article.summaryEn || article.summaryEs,
      detailEn: article.detailEn || article.detailEs,
      ctaTextEs: article.ctaTextEs ?? null,
      ctaTextEn: article.ctaTextEn ?? null,
      ctaUrl: article.ctaUrl ?? null,
      editorialContext: article.editorialContext ?? null,
    }
  );
  if (article.titleDisplayEn || article.summaryEn || article.detailEn) {
    availableLanguages.push("en");
  }

  if (lang === "en") {
    const summary = normalizeEditorialParagraph(article.summaryEn || article.sourceExcerpt || article.summaryEs || "", "en", 900);
    const detail = finalizeEditorialDetail(
      article.source || {
        id: article.sourceId,
        slug: article.sourceId,
        name: "Vorea",
        type: "news",
        language: "en",
        baseUrl: article.canonicalUrl,
        feedUrl: null,
        listingUrl: null,
        fetchMode: "rss",
        enabled: true,
        priority: 100,
        editorialPolicy: normalizeSourceEditorialPolicy(null),
        editorialNotes: null,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
      },
      {
        titleOriginal: article.titleOriginal,
        canonicalUrl: article.canonicalUrl,
        excerpt: article.sourceExcerpt || summary,
        imageUrl: article.imageUrl || null,
        author: article.author || null,
        category: article.category || null,
        tags: article.tags,
        sourceLanguage: article.sourceLanguage || "en",
        publishedAt: article.publishedAt,
      },
      summary,
      normalizeEditorialParagraph(article.detailEn || article.summaryEn || article.detailEs || "", "en", 900),
      "en"
    );
    return {
        ...article,
        titleDisplay: article.titleDisplayEn || article.titleOriginal || article.titleDisplayEs,
        summary,
        detail,
        ctaText: article.ctaTextEn || article.ctaTextEs || null,
        imageUrl: normalizedImageUrl,
        editorialTier: shouldRespectStoredSignals ? article.editorialTier || editorialSignals.editorialTier : editorialSignals.editorialTier,
        indexable: shouldRespectStoredSignals
          ? typeof article.indexable === "boolean"
            ? article.indexable
            : editorialSignals.indexable
          : editorialSignals.indexable,
        whyItMatters: buildWhyItMatters(article.source || {
        id: article.sourceId,
        slug: article.sourceId,
        name: "Vorea",
        type: "news",
        language: "en",
        baseUrl: article.canonicalUrl,
        feedUrl: null,
        listingUrl: null,
        fetchMode: "rss",
        enabled: true,
        priority: 100,
        editorialPolicy: normalizeSourceEditorialPolicy(null),
        editorialNotes: null,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
      }, {
        titleOriginal: article.titleOriginal,
        canonicalUrl: article.canonicalUrl,
        excerpt: article.sourceExcerpt || summary,
        imageUrl: article.imageUrl || null,
        author: article.author || null,
        category: article.category || null,
        tags: article.tags,
        sourceLanguage: article.sourceLanguage || "en",
        publishedAt: article.publishedAt,
      }, summary, detail, "en"),
      requestedLanguage: "en",
      availableLanguages,
    };
  }

  const summary = normalizeEditorialParagraph(article.summaryEs || article.sourceExcerpt || article.summaryEn || "", "es", 900);
  const detail = finalizeEditorialDetail(
    article.source || {
      id: article.sourceId,
      slug: article.sourceId,
      name: "Vorea",
      type: "news",
      language: "es",
      baseUrl: article.canonicalUrl,
      feedUrl: null,
      listingUrl: null,
      fetchMode: "rss",
      enabled: true,
      priority: 100,
      editorialPolicy: normalizeSourceEditorialPolicy(null),
      editorialNotes: null,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    },
    {
      titleOriginal: article.titleOriginal,
      canonicalUrl: article.canonicalUrl,
      excerpt: article.sourceExcerpt || summary,
      imageUrl: article.imageUrl || null,
      author: article.author || null,
      category: article.category || null,
      tags: article.tags,
      sourceLanguage: article.sourceLanguage || "es",
      publishedAt: article.publishedAt,
    },
    summary,
    normalizeEditorialParagraph(article.detailEs || article.summaryEs || article.detailEn || "", "es", 900),
    "es"
  );
  return {
    ...article,
    titleDisplay: article.titleDisplayEs || article.titleOriginal,
    summary,
    detail,
    ctaText: article.ctaTextEs || article.ctaTextEn || null,
    imageUrl: normalizedImageUrl,
    editorialTier: shouldRespectStoredSignals ? article.editorialTier || editorialSignals.editorialTier : editorialSignals.editorialTier,
    indexable: shouldRespectStoredSignals
      ? typeof article.indexable === "boolean"
        ? article.indexable
        : editorialSignals.indexable
      : editorialSignals.indexable,
    whyItMatters: buildWhyItMatters(article.source || {
      id: article.sourceId,
      slug: article.sourceId,
      name: "Vorea",
      type: "news",
      language: "es",
      baseUrl: article.canonicalUrl,
      feedUrl: null,
      listingUrl: null,
      fetchMode: "rss",
      enabled: true,
      priority: 100,
      editorialPolicy: normalizeSourceEditorialPolicy(null),
      editorialNotes: null,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    }, {
      titleOriginal: article.titleOriginal,
      canonicalUrl: article.canonicalUrl,
      excerpt: article.sourceExcerpt || summary,
      imageUrl: article.imageUrl || null,
      author: article.author || null,
      category: article.category || null,
      tags: article.tags,
      sourceLanguage: article.sourceLanguage || "es",
      publishedAt: article.publishedAt,
    }, summary, detail, "es"),
    requestedLanguage: "es",
    availableLanguages,
  };
}

export async function seedDefaultNewsSources(): Promise<void> {
  await newsRepository.seedSources(DEFAULT_NEWS_SOURCES);
}

async function fetchSourceItems(source: NewsSourceRecord): Promise<RawNewsItem[]> {
  if (source.fetchMode !== "listing" && source.feedUrl) {
    try {
      const xml = await fetchText(source.feedUrl);
      const items = parseFeedItems(xml, source);
      if (items.length > 0) return takeUnique(items, (item) => item.canonicalUrl, DEFAULT_MAX_ITEMS_PER_SOURCE);
    } catch (error) {
      console.log(`[news] feed fallback for ${source.slug}: ${String(error)}`);
    }
  }

  if (!source.listingUrl) return [];
  const html = await fetchText(source.listingUrl);
  const listingEntries = parseListingItems(html, source);
  const details: RawNewsItem[] = [];
  for (const entry of listingEntries.slice(0, DEFAULT_MAX_ITEMS_PER_SOURCE)) {
    try {
      details.push(await fetchListingDetail(source, entry));
    } catch (error) {
      console.log(`[news] listing detail skipped ${entry.url}: ${String(error)}`);
    }
  }
  return takeUnique(details, (item) => item.canonicalUrl, DEFAULT_MAX_ITEMS_PER_SOURCE);
}

export async function ingestNews(options?: { sourceSlug?: string }): Promise<NewsIngestionSummary> {
  await seedDefaultNewsSources();
  const allSources = await newsRepository.listSources({ enabledOnly: true });
  const sources = options?.sourceSlug
    ? allSources.filter((source) => source.slug === options.sourceSlug)
    : allSources;

  const summary: NewsIngestionSummary = {
    totalSources: sources.length,
    fetchedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    runs: [],
  };

  for (const source of sources) {
    const run = await newsRepository.startRun(source.id);
    let fetchedCount = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let runStatus = "success";
    let runError: string | null = null;

    try {
      const items = await fetchSourceItems(source);
      fetchedCount = items.length;

      for (const item of items) {
        if (!item.canonicalUrl || !item.titleOriginal) {
          skippedCount += 1;
          continue;
        }
        if (shouldSkipThinCommercialItem(source, item)) {
          skippedCount += 1;
          continue;
        }
        if (shouldSkipUtilityIndexItem(source, item)) {
          skippedCount += 1;
          continue;
        }

        const editorial = await buildEditorial(source, item);
        const editorialSignals = inferEditorialTier(source, item, editorial);
        const result = await newsRepository.upsertArticle({
          sourceId: source.id,
          canonicalUrl: item.canonicalUrl,
          titleOriginal: item.titleOriginal,
          titleDisplayEs: editorial.titleDisplayEs,
          summaryEs: editorial.summaryEs,
          detailEs: editorial.detailEs,
          titleDisplayEn: editorial.titleDisplayEn,
          summaryEn: editorial.summaryEn,
          detailEn: editorial.detailEn,
          sourceExcerpt: item.excerpt || null,
          imageUrl: sanitizeRemoteImageUrl(item.imageUrl, source.baseUrl),
          author: item.author || null,
          category: item.category || null,
          tags: takeUnique(
            item.tags.map((tag) => sanitizeText(tag, 40)).filter(Boolean),
            (tag) => tag.toLowerCase(),
            8
          ),
          sourceLanguage: item.sourceLanguage || null,
          publishedAt: item.publishedAt,
          expiresAt: addDays(DEFAULT_RETENTION_DAYS, item.publishedAt),
          status: "published",
          editorialTier: editorialSignals.editorialTier,
          indexable: editorialSignals.indexable,
          dedupeHash: hashText(`${source.id}::${item.canonicalUrl}`),
          ctaTextEs: editorial.ctaTextEs ?? null,
          ctaTextEn: editorial.ctaTextEn ?? null,
          ctaUrl: editorial.ctaUrl ?? item.canonicalUrl ?? null,
          editorialContext: editorial.editorialContext ?? null,
        });

        if (result === "inserted") insertedCount += 1;
        else if (result === "updated") updatedCount += 1;
        else skippedCount += 1;
      }
    } catch (error) {
      runStatus = "failed";
      runError = error instanceof Error ? error.message : String(error);
    }

    await newsRepository.finishRun(run.id, {
      status: runStatus,
      finishedAt: new Date().toISOString(),
      fetchedCount,
      insertedCount,
      updatedCount,
      skippedCount,
      error: runError,
    });

    summary.fetchedCount += fetchedCount;
    summary.insertedCount += insertedCount;
    summary.updatedCount += updatedCount;
    summary.skippedCount += skippedCount;
    summary.runs.push({
      source: source.slug,
      status: runStatus,
      fetchedCount,
      insertedCount,
      updatedCount,
      skippedCount,
      error: runError,
    });
  }

  return summary;
}

export async function cleanupNews(now = new Date()): Promise<{ deletedArticles: number; deletedRuns: number }> {
  return newsRepository.cleanupExpired(now);
}

export async function listNews(params?: {
  source?: string;
  category?: string;
  sourceLanguage?: string;
  lang?: string;
  page?: number;
  limit?: number;
}): Promise<{ articles: LocalizedNewsArticleRecord[]; total: number; page: number; limit: number }> {
  const requestedLimit = Math.min(Math.max(1, Number(params?.limit || 12)), 50);
  const overfetchLimit = Math.min(Math.max(requestedLimit * 3, requestedLimit), 50);
  const result = await newsRepository.listPublishedArticles({
    source: params?.source,
    category: params?.category,
    sourceLanguage: params?.sourceLanguage ? normalizeNewsLocale(params.sourceLanguage) : undefined,
    page: params?.page,
    limit: overfetchLimit,
  });
  const visibleArticles = result.articles.filter((article) => !shouldHideUtilityArticleRecord(article));
  return {
    total: Math.max(visibleArticles.length, result.total - (result.articles.length - visibleArticles.length)),
    page: result.page,
    limit: requestedLimit,
    articles: visibleArticles.slice(0, requestedLimit).map((article) => localizeArticle(article, params?.lang)),
  };
}

export async function getNewsDetail(slug: string, options?: { lang?: string }): Promise<LocalizedNewsArticleRecord | null> {
  const article = await newsRepository.getPublishedArticleBySlug(slug);
  if (!article || shouldHideUtilityArticleRecord(article)) return null;
  return localizeArticle(article, options?.lang);
}

export const __newsTestUtils = {
  parseFeedItems,
  parseListingItems,
  buildFallbackEditorial,
  isLikelyArticleUrl,
  localizeArticle,
  normalizeNewsLocale,
  sanitizeText,
  shouldSkipThinCommercialItem,
  shouldSkipUtilityIndexItem,
  shouldHideUtilityArticleRecord,
  buildWhyItMatters,
  finalizeEditorialDetail,
  stripLegacyEditorialPrefix,
  sanitizeRemoteImageUrl,
  inferEditorialTier,
};
