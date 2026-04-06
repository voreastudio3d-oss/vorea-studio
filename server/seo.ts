import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCommunityRepository } from "./community-repository.js";
import { getNewsDetail, listNews } from "./news-service.js";
import { getPublicRouteMeta, normalizePublicRouteLocale } from "./public-route-meta.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localeCache = new Map<string, Record<string, string>>();

function loadLocale(lang: string): Record<string, string> {
  const normalizedLang = normalizePublicRouteLocale(lang);
  if (localeCache.has(normalizedLang)) return localeCache.get(normalizedLang)!;
  if (localeCache.has(lang)) return localeCache.get(lang)!;
  try {
    const filePath = path.resolve(__dirname, "..", "src", "app", "locales", `${normalizedLang}.json`);
    const content = fs.readFileSync(filePath, "utf-8");
    const json = JSON.parse(content);
    localeCache.set(normalizedLang, json);
    return json;
  } catch {
    return {};
  }
}

function t(lang: string, key: string, fallback: string): string {
  const json = loadLocale(lang);
  return json[key] || fallback;
}

function getOgLocale(lang: string): string {
  const normalizedLang = normalizePublicRouteLocale(lang);
  if (normalizedLang === "en") return "en_US";
  if (normalizedLang === "pt") return "pt_BR";
  return "es_UY";
}

type SeoRouteKind = "website" | "article" | "profile" | "product";
export type SitemapSection = "core" | "community" | "news";

type StructuredData = Record<string, unknown>;
type BreadcrumbItem = { name: string; path: string };

export type SeoMetadata = {
  title: string;
  description: string;
  canonicalPath: string;
  robots: string;
  imageUrl: string;
  type: SeoRouteKind;
  locale?: string;
  alternatePaths?: Array<{ hrefLang: string; path: string }>;
  structuredData?: StructuredData[];
};

type SitemapEntry = {
  path: string;
  lastmod?: string | null;
  changefreq?: string;
  priority?: string;
};

const COMMUNITY_DB_MODE = (process.env.COMMUNITY_DB_MODE || "kv").toLowerCase();
const communityRepo = createCommunityRepository(COMMUNITY_DB_MODE);

const SITE_NAME = "Vorea Studio";
const DEFAULT_TITLE = "Vorea Studio | Parametric 3D, comunidad y AI Studio";
const DEFAULT_DESCRIPTION =
  "Diseña modelos 3D paramétricos, explora la comunidad y prueba flujos AI Studio en Vorea Studio.";
const DEFAULT_OG_PATH = "/og/default.svg";
const DEFAULT_LOCALE = "es_UY";
const DEFAULT_PUBLISHER = "Vorea Studio";

const PRIVATE_PREFIXES = [
  "/studio",
  "/ai-studio",
  "/perfil",
  "/admin",
  "/feedback-admin",
  "/organic",
  "/makerworld",
  "/gcode-collection",
  "/relief",
  "/parametric",
];

const PRIVATE_ROUTE_TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: "/studio", title: "Editor SCAD | Vorea Studio" },
  { prefix: "/ai-studio", title: "AI Studio | Vorea Studio" },
  { prefix: "/perfil", title: "Perfil | Vorea Studio" },
  { prefix: "/admin", title: "Admin | Vorea Studio" },
  { prefix: "/feedback-admin", title: "Feedback Admin | Vorea Studio" },
  { prefix: "/organic", title: "Organic Studio | Vorea Studio" },
  { prefix: "/makerworld", title: "MakerWorld | Vorea Studio" },
  { prefix: "/gcode-collection", title: "Colección GCode | Vorea Studio" },
  { prefix: "/relief", title: "Relief Studio | Vorea Studio" },
  { prefix: "/parametric", title: "Parametric Studio | Vorea Studio" },
];

function getStaticMetadata(pathname: string, lang: string): SeoMetadata | null {
  const publicMeta = getPublicRouteMeta(pathname, lang);
  if (publicMeta) {
    const ogSlugMap: Record<string, string | undefined> = {
      "/": undefined,
      "/community": "community",
      "/contact": "contact",
      "/contributors": "contributors",
      "/plans": "plans",
      "/for/makers": "makers",
      "/for/education": "education",
      "/for/ai-creators": "ai-creators",
    };

    return {
      title: publicMeta.title,
      description: publicMeta.description,
      canonicalPath: pathname,
      robots: "index, follow",
      imageUrl: ogSlugMap[pathname] ? `/og/${ogSlugMap[pathname]}.svg` : DEFAULT_OG_PATH,
      type: "website",
    };
  }

  const tTitle = (key: string, fb: string) => `${t(lang, key, fb)} | ${SITE_NAME}`;
  const tDesc = (key: string, fb: string) => t(lang, key, fb);

  const MAP: Record<string, { titleKey: string; titleFb: string; descKey: string; descFb: string; ogSlug?: string }> = {
    "/news": { titleKey: "news.pageTitle", titleFb: "Noticias 3D", descKey: "news.pageSubtitle", descFb: "Actualizaciones del sector de impresión 3D.", ogSlug: "news" },
    "/terms": { titleKey: "terms.pageTitle", titleFb: "Términos de Servicio", descKey: "terms.intro", descFb: "Términos y condiciones de uso." },
    "/privacy": { titleKey: "privacy.title", titleFb: "Privacidad", descKey: "privacy.intro", descFb: "Políticas de privacidad y datos." },
    "/benchmark": { titleKey: "benchmark.heroTitle", titleFb: "Vorea Studio vs MakerWorld, Printables, Thangs — Benchmark 3D 2026", descKey: "benchmark.heroSubtitle", descFb: "Comparamos modelos paramétricos, comunidades y plataformas de noticias 3D.", ogSlug: "benchmark" }
  };

  const config = MAP[pathname];
  if (!config) return null;

  return {
    title: tTitle(config.titleKey, config.titleFb),
    description: tDesc(config.descKey, config.descFb),
    canonicalPath: pathname,
    robots: "index, follow",
    imageUrl: config.ogSlug ? `/og/${config.ogSlug}.svg` : DEFAULT_OG_PATH,
    type: "website",
  };
}

function normalizePathname(pathname: string): string {
  const value = String(pathname || "/").trim() || "/";
  if (value === "/") return "/";
  return value.startsWith("/") ? value.replace(/\/+$/, "") : `/${value.replace(/\/+$/, "")}`;
}

function resolveBaseUrl(requestUrl?: string): string {
  const configured = String(process.env.FRONTEND_URL || "").trim();
  if (configured) {
    try {
      return new URL(configured).origin.replace(/\/+$/, "");
    } catch {
      // fall back to request URL
    }
  }
  try {
    return new URL(requestUrl || "http://localhost:5173").origin.replace(/\/+$/, "");
  } catch {
    return "http://localhost:5173";
  }
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(value: string): string {
  return escapeHtml(value);
}

function trimText(value: unknown, maxLength = 160): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isPublishedModel(model: any): boolean {
  return String(model?.status || "published").toLowerCase() === "published";
}

function slugifySegment(input: unknown): string {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function absoluteUrl(baseUrl: string, pathOrUrl: string): string {
  try {
    return new URL(pathOrUrl, baseUrl).toString();
  } catch {
    return `${baseUrl}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
  }
}

function buildAlternatePaths(canonicalPath: string) {
  return [
    { hrefLang: "es", path: `/es${canonicalPath}` },
    { hrefLang: "en", path: `/en${canonicalPath}` },
    { hrefLang: "pt", path: `/pt${canonicalPath}` },
    { hrefLang: "x-default", path: canonicalPath },
  ];
}

function buildBreadcrumbData(baseUrl: string, items: BreadcrumbItem[]): StructuredData {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(baseUrl, item.path),
    })),
  };
}

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function resolvePrivateRouteTitle(pathname: string): string {
  const match = PRIVATE_ROUTE_TITLES.find(
    (item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`)
  );
  return match?.title || SITE_NAME;
}

function buildFallbackMetadata(pathname: string, lang: string): SeoMetadata {
  return {
    title: `${SITE_NAME}`,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: pathname === "/" ? "/" : pathname,
    robots: "noindex, nofollow",
    imageUrl: DEFAULT_OG_PATH,
    type: "website",
    locale: getOgLocale(lang),
  };
}

async function buildModelMetadata(pathname: string, baseUrl: string, lang: string): Promise<SeoMetadata | null> {
  const match = pathname.match(/^\/model\/([^/]+)(?:\/[^/]+)?$/);
  if (!match) return null;
  const model = await communityRepo.getModel(match[1]);
  if (!model || !isPublishedModel(model)) return null;

  const author = String(model.authorName || model.authorUsername || "la comunidad Vorea").trim();
  const tags = Array.isArray(model.tags) ? model.tags.filter(Boolean).slice(0, 3) : [];
  const tagText = tags.length > 0 ? ` Etiquetas: ${tags.join(", ")}.` : "";
  const canonicalPath =
    String(model.canonicalPath || "").trim() ||
    `/model/${model.id}/${slugifySegment(model.title) || model.id}`;

  return {
    title: `${trimText(model.title, 72)} | ${t(lang, "breadcrumb.model", "Modelo 3D")} | ${SITE_NAME}`,
    description: trimText(
      `${model.title}. ${t(lang, "breadcrumb.model", "Modelo 3D")} publicado por ${author} en la comunidad de Vorea.${tagText}`,
      170
    ),
    canonicalPath,
    robots: "index, follow",
    imageUrl: model.thumbnailUrl || DEFAULT_OG_PATH,
    type: "product",
    locale: getOgLocale(lang),
    alternatePaths: buildAlternatePaths(canonicalPath),
    structuredData: [
      buildBreadcrumbData(baseUrl, [
        { name: t(lang, "nav.home", "Inicio"), path: "/" },
        { name: t(lang, "nav.community", "Comunidad"), path: "/community" },
        { name: trimText(model.title, 72), path: canonicalPath },
      ]),
    ],
  };
}

async function buildUserMetadata(pathname: string, baseUrl: string, lang: string): Promise<SeoMetadata | null> {
  const match = pathname.match(/^\/user\/([^/]+)(?:\/[^/]+)?\/modelos\/?$/);
  if (!match) return null;
  const userId = match[1];
  const profile = await communityRepo.getUserProfile(userId);
  if (!profile) return null;

  const allModels = await communityRepo.getAllModels();
  const publishedModels = (allModels || []).filter(
    (model: any) => model?.authorId === userId && isPublishedModel(model)
  );
  const totalLikes = publishedModels.reduce((sum: number, model: any) => sum + Number(model?.likes || 0), 0);
  const displayName = String(profile.displayName || profile.username || userId).trim();
  const userSlug = slugifySegment(profile.username || profile.displayName || userId) || userId;
  const canonicalPath = `/user/${userId}/${userSlug}/modelos`;
  const imageUrl =
    String(profile.avatarUrl || "").trim() ||
    String(publishedModels[0]?.thumbnailUrl || "").trim() ||
    DEFAULT_OG_PATH;

  return {
    title: `${trimText(displayName, 72)} | ${t(lang, "breadcrumb.profile", "Perfil")} | ${SITE_NAME}`,
    description: trimText(
      `${displayName} comparte ${publishedModels.length} modelos 3D públicos y acumula ${totalLikes} likes en la comunidad de Vorea.`,
      170
    ),
    canonicalPath,
    robots: "index, follow",
    imageUrl,
    type: "profile",
    locale: getOgLocale(lang),
    alternatePaths: buildAlternatePaths(canonicalPath),
    structuredData: [
      buildBreadcrumbData(baseUrl, [
        { name: t(lang, "nav.home", "Inicio"), path: "/" },
        { name: t(lang, "nav.community", "Comunidad"), path: "/community" },
        { name: trimText(displayName, 72), path: canonicalPath },
      ]),
    ],
  };
}

async function buildNewsMetadata(pathname: string, baseUrl: string, lang: string): Promise<SeoMetadata | null> {
  const match = pathname.match(/^\/news\/([^/]+)$/);
  if (!match) return null;
  const targetLang = lang === "es" || lang === "en" ? lang : "es";
  const article = await getNewsDetail(decodeURIComponent(match[1]), { lang: targetLang });
  if (!article) return null;

  return {
    title: `${trimText(article.titleDisplay || article.titleOriginal, 80)} | ${t(lang, "news.pageTitle", "Noticias 3D")} | ${SITE_NAME}`,
    description: trimText(
      article.summary || article.whyItMatters || article.detail || article.sourceExcerpt || DEFAULT_DESCRIPTION,
      180
    ),
    canonicalPath: `/news/${article.slug}`,
    robots: article.indexable === false || article.editorialTier === "brief" ? "noindex, follow" : "index, follow",
    imageUrl: article.imageUrl || DEFAULT_OG_PATH,
    type: "article",
    locale: getOgLocale(lang),
    alternatePaths: buildAlternatePaths(`/news/${article.slug}`),
    structuredData: [
      buildBreadcrumbData(baseUrl, [
        { name: t(lang, "nav.home", "Inicio"), path: "/" },
        { name: t(lang, "nav.news", "Noticias"), path: "/news" },
        { name: trimText(article.titleDisplay || article.titleOriginal, 80), path: `/news/${article.slug}` },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: trimText(article.titleDisplay || article.titleOriginal, 110),
        description: trimText(
          article.summary || article.whyItMatters || article.detail || article.sourceExcerpt || DEFAULT_DESCRIPTION,
          180
        ),
        datePublished: toIso(article.publishedAt) || toIso(article.fetchedAt) || new Date().toISOString(),
        dateModified: toIso(article.fetchedAt) || toIso(article.publishedAt) || new Date().toISOString(),
        image: [absoluteUrl(baseUrl, article.imageUrl || DEFAULT_OG_PATH)],
        author: {
          "@type": "Person",
          name: article.author || article.source?.name || DEFAULT_PUBLISHER,
        },
        publisher: {
          "@type": "Organization",
          name: DEFAULT_PUBLISHER,
          url: absoluteUrl(baseUrl, "/"),
          logo: {
            "@type": "ImageObject",
            url: absoluteUrl(baseUrl, DEFAULT_OG_PATH),
          },
        },
        mainEntityOfPage: absoluteUrl(baseUrl, `/news/${article.slug}`),
      },
    ],
  };
}

export async function buildSeoMetadata(pathnameInput: string, requestUrl?: string, requestedLang: string = "es"): Promise<SeoMetadata> {
  const pathname = normalizePathname(pathnameInput);
  const baseUrl = resolveBaseUrl(requestUrl);

  if (isPrivatePath(pathname)) {
    return {
      title: resolvePrivateRouteTitle(pathname),
      description: DEFAULT_DESCRIPTION,
      canonicalPath: pathname,
      robots: "noindex, nofollow",
      imageUrl: DEFAULT_OG_PATH,
      type: "website",
      locale: getOgLocale(requestedLang),
    };
  }

  const staticMeta = getStaticMetadata(pathname, requestedLang);
  if (staticMeta) {
    const structuredData: StructuredData[] = [];

    if (pathname === "/") {
      structuredData.push(
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: absoluteUrl(baseUrl, "/"),
          inLanguage: requestedLang,
        },
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: SITE_NAME,
          url: absoluteUrl(baseUrl, "/"),
          logo: absoluteUrl(baseUrl, DEFAULT_OG_PATH),
          sameAs: [absoluteUrl(baseUrl, "/community"), absoluteUrl(baseUrl, "/news")],
        }
      );
    } else {
      structuredData.push(
        buildBreadcrumbData(baseUrl, [
          { name: t(requestedLang, "nav.home", "Inicio"), path: "/" },
          { name: staticMeta.title.replace(` | ${SITE_NAME}`, ""), path: staticMeta.canonicalPath },
        ])
      );
    }

    return {
      ...staticMeta,
      locale: getOgLocale(requestedLang),
      alternatePaths: buildAlternatePaths(staticMeta.canonicalPath),
      structuredData,
    };
  }

  const [modelMeta, userMeta, newsMeta] = await Promise.all([
    buildModelMetadata(pathname, baseUrl, requestedLang),
    buildUserMetadata(pathname, baseUrl, requestedLang),
    buildNewsMetadata(pathname, baseUrl, requestedLang),
  ]);

  return modelMeta || userMeta || newsMeta || buildFallbackMetadata(pathname, requestedLang);
}

export function renderSeoHead(metadata: SeoMetadata, requestUrl?: string): string {
  const baseUrl = resolveBaseUrl(requestUrl);
  const canonicalUrl = absoluteUrl(baseUrl, metadata.canonicalPath);
  const imageUrl = absoluteUrl(baseUrl, metadata.imageUrl || DEFAULT_OG_PATH);
  const title = escapeHtml(metadata.title || DEFAULT_TITLE);
  const description = escapeHtml(metadata.description || DEFAULT_DESCRIPTION);
  const robots = escapeHtml(metadata.robots);
  const locale = escapeHtml(metadata.locale || DEFAULT_LOCALE);
  const alternates = (metadata.alternatePaths || [])
    .map((alternate) => `<link rel="alternate" hreflang="${escapeHtml(alternate.hrefLang)}" href="${escapeHtml(absoluteUrl(baseUrl, alternate.path))}" />`)
    .join("\n      ");
  const structuredData = (metadata.structuredData || [])
    .map((entry) => `<script type="application/ld+json">${JSON.stringify(entry)}</script>`)
    .join("\n      ");

  return [
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    alternates,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="${locale}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="${escapeHtml(metadata.type)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
    structuredData,
  ].join("\n      ");
}

export function injectSeoIntoHtml(html: string, metadata: SeoMetadata, requestUrl?: string): string {
  const titleTag = `<title>${escapeHtml(metadata.title || DEFAULT_TITLE)}</title>`;
  const withTitle = /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/i, titleTag)
    : html.replace(/<head>/i, `<head>\n      ${titleTag}`);

  const headTags = renderSeoHead(metadata, requestUrl);

  // ── GA4 gtag.js — injected server-side so Google verification crawler sees it ──
  const ga4Id = process.env.VITE_GA4_MEASUREMENT_ID || "";
  const gtagSnippet = ga4Id
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${ga4Id}"></script>\n` +
      `      <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');</script>\n      `
    : "";

  return withTitle.replace(/<\/head>/i, `      ${gtagSnippet}${headTags}\n    </head>`);
}

export function buildRobotsTxt(requestUrl?: string): string {
  const baseUrl = resolveBaseUrl(requestUrl);
  const lines = [
    "User-agent: *",
    "Allow: /",
    ...PRIVATE_PREFIXES.map((prefix) => `Disallow: ${prefix}`),
    "Disallow: /api/",
    `Sitemap: ${absoluteUrl(baseUrl, "/sitemap.xml")}`,
  ];
  return `${lines.join("\n")}\n`;
}

function buildSitemapEntryXml(entry: SitemapEntry, baseUrl: string): string {
  const LANGS = ["es", "en", "pt"];
  const lastmod = toIso(entry.lastmod);
  const parts = [
    "  <url>",
    `    <loc>${escapeXml(absoluteUrl(baseUrl, entry.path))}</loc>`,
  ];
  if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  if (entry.changefreq) parts.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
  if (entry.priority) parts.push(`    <priority>${escapeXml(entry.priority)}</priority>`);
  // hreflang alternates
  for (const lang of LANGS) {
    parts.push(`    <xhtml:link rel="alternate" hreflang="${lang}" href="${escapeXml(absoluteUrl(baseUrl, `/${lang}${entry.path}`))}" />`);
  }
  parts.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(absoluteUrl(baseUrl, entry.path))}" />`);
  parts.push("  </url>");
  return parts.join("\n");
}

function buildSitemapXmlDocument(entries: SitemapEntry[], baseUrl: string): string {
  const xmlEntries = entries
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((entry) => buildSitemapEntryXml(entry, baseUrl))
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    xmlEntries,
    "</urlset>",
    "",
  ].join("\n");
}

async function collectSitemapSections(requestUrl?: string): Promise<Record<SitemapSection, SitemapEntry[]>> {
  const nowIso = new Date().toISOString();
  const sections: Record<SitemapSection, Map<string, SitemapEntry>> = {
    core: new Map<string, SitemapEntry>(),
    community: new Map<string, SitemapEntry>(),
    news: new Map<string, SitemapEntry>(),
  };

  const addEntry = (section: SitemapSection, entry: SitemapEntry) => {
    const normalizedPath = normalizePathname(entry.path);
    const bucket = sections[section];
    const current = bucket.get(normalizedPath);
    if (!current) {
      bucket.set(normalizedPath, { ...entry, path: normalizedPath });
      return;
    }

    const currentTime = new Date(current.lastmod || 0).getTime();
    const nextTime = new Date(entry.lastmod || 0).getTime();
    if (nextTime > currentTime) {
      bucket.set(normalizedPath, { ...current, ...entry, path: normalizedPath });
    }
  };

  addEntry("core", { path: "/", lastmod: nowIso, changefreq: "daily", priority: "1.0" });
  addEntry("core", { path: "/plans", lastmod: nowIso, changefreq: "weekly", priority: "0.8" });
  addEntry("core", { path: "/terms", lastmod: nowIso, changefreq: "monthly", priority: "0.4" });
  addEntry("core", { path: "/privacy", lastmod: nowIso, changefreq: "monthly", priority: "0.4" });
  addEntry("core", { path: "/contact", lastmod: nowIso, changefreq: "monthly", priority: "0.5" });
  addEntry("core", { path: "/contributors", lastmod: nowIso, changefreq: "weekly", priority: "0.6" });
  addEntry("core", { path: "/for/makers", lastmod: nowIso, changefreq: "weekly", priority: "0.8" });
  addEntry("core", { path: "/for/education", lastmod: nowIso, changefreq: "weekly", priority: "0.8" });
  addEntry("core", { path: "/for/ai-creators", lastmod: nowIso, changefreq: "weekly", priority: "0.8" });
  addEntry("core", { path: "/benchmark", lastmod: nowIso, changefreq: "monthly", priority: "0.7" });
  addEntry("community", { path: "/community", lastmod: nowIso, changefreq: "daily", priority: "0.9" });
  addEntry("news", { path: "/news", lastmod: nowIso, changefreq: "hourly", priority: "0.8" });

  const [models, news] = await Promise.all([
    communityRepo.getAllModels().catch(() => []),
    listNews({ page: 1, limit: 200, lang: "es" }).catch(() => ({ articles: [] as any[] })),
  ]);

  const publishedModels = (models || []).filter((model: any) => isPublishedModel(model));
  const latestModelByAuthor = new Map<string, string>();

  for (const model of publishedModels) {
    const canonicalPath =
      String(model.canonicalPath || "").trim() ||
      `/model/${model.id}/${slugifySegment(model.title) || model.id}`;
    addEntry("community", {
      path: canonicalPath,
      lastmod: model.updatedAt || model.createdAt || nowIso,
      changefreq: "weekly",
      priority: "0.7",
    });
    if (model.authorId) {
      const candidateTime = new Date(model.updatedAt || model.createdAt || 0).getTime();
      const currentTime = new Date(latestModelByAuthor.get(model.authorId) || 0).getTime();
      if (candidateTime > currentTime) {
        latestModelByAuthor.set(model.authorId, model.updatedAt || model.createdAt || nowIso);
      }
    }
  }

  for (const [authorId, lastmod] of latestModelByAuthor.entries()) {
    const profile = await communityRepo.getUserProfile(authorId).catch(() => null);
    if (!profile) continue;
    const slug = slugifySegment(profile.username || profile.displayName || authorId) || authorId;
    addEntry("community", {
      path: `/user/${authorId}/${slug}/modelos`,
      lastmod,
      changefreq: "weekly",
      priority: "0.6",
    });
  }

  for (const article of news.articles || []) {
    if (article.indexable === false || article.editorialTier === "brief") continue;
    addEntry("news", {
      path: `/news/${article.slug}`,
      lastmod: article.publishedAt || article.fetchedAt || nowIso,
      changefreq: "daily",
      priority: "0.7",
    });
  }

  return {
    core: [...sections.core.values()],
    community: [...sections.community.values()],
    news: [...sections.news.values()],
  };
}

export async function buildSitemapSectionXml(section: SitemapSection, requestUrl?: string): Promise<string> {
  const baseUrl = resolveBaseUrl(requestUrl);
  const sections = await collectSitemapSections(requestUrl);
  return buildSitemapXmlDocument(sections[section], baseUrl);
}

export async function buildSitemapXml(requestUrl?: string): Promise<string> {
  const baseUrl = resolveBaseUrl(requestUrl);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "  <sitemap>",
    `    <loc>${escapeXml(absoluteUrl(baseUrl, "/sitemaps/core.xml"))}</loc>`,
    "  </sitemap>",
    "  <sitemap>",
    `    <loc>${escapeXml(absoluteUrl(baseUrl, "/sitemaps/community.xml"))}</loc>`,
    "  </sitemap>",
    "  <sitemap>",
    `    <loc>${escapeXml(absoluteUrl(baseUrl, "/sitemaps/news.xml"))}</loc>`,
    "  </sitemap>",
    "</sitemapindex>",
    "",
  ].join("\n");
}

export function buildOgSvg(
  title: string,
  subtitle: string,
  options?: { accent?: string; badge?: string; tagline?: string }
): string {
  const acc = options?.accent || "#C6E36C";
  const safeTitle = escapeXml(title);
  const safeSubtitle = escapeXml(subtitle);
  const safeBadge = options?.badge ? escapeXml(options.badge) : null;
  const safeTagline = options?.tagline ? escapeXml(options.tagline) : "voreastudio3d.com";

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" fill="none">',
    '  <defs>',
    '    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">',
    '      <stop stop-color="#0D1117" />',
    '      <stop offset="0.5" stop-color="#1A1F36" />',
    '      <stop offset="1" stop-color="#10263D" />',
    "    </linearGradient>",
    `    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(320 180) rotate(38) scale(420 260)">`,
    `      <stop stop-color="${acc}" stop-opacity="0.45" />`,
    `      <stop offset="1" stop-color="${acc}" stop-opacity="0" />`,
    "    </radialGradient>",
    "  </defs>",
    '  <rect width="1200" height="630" fill="url(#bg)" />',
    '  <rect width="1200" height="630" fill="url(#glow)" />',
    '  <circle cx="964" cy="146" r="118" fill="#55D2FF" fill-opacity="0.12" />',
    `  <circle cx="896" cy="426" r="154" fill="${acc}" fill-opacity="0.08" />`,
    '  <rect x="86" y="86" width="1028" height="458" rx="32" fill="#0F1424" fill-opacity="0.82" stroke="rgba(255,255,255,0.08)" />',
    `  <text x="130" y="220" fill="${acc}" font-size="28" font-family="Segoe UI, Arial, sans-serif" font-weight="700">VOREA STUDIO</text>`,
    ...(safeBadge ? [`  <text x="410" y="220" fill="#7E8AA3" font-size="22" font-family="Segoe UI, Arial, sans-serif">— ${safeBadge}</text>`] : []),
    `  <text x="130" y="320" fill="#FFFFFF" font-size="62" font-family="Segoe UI, Arial, sans-serif" font-weight="800">${safeTitle}</text>`,
    `  <text x="130" y="392" fill="#B7C2D0" font-size="32" font-family="Segoe UI, Arial, sans-serif">${safeSubtitle}</text>`,
    `  <rect x="130" y="466" width="238" height="54" rx="27" fill="${acc}" fill-opacity="0.14" stroke="${acc}" stroke-opacity="0.35" />`,
    `  <text x="165" y="501" fill="#E8F7AD" font-size="24" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${safeTagline}</text>`,
    "</svg>",
    "",
  ].join("\n");
}

/** Backward-compatible default OG */
export function buildDefaultOgSvg(): string {
  return buildOgSvg("Vorea Studio", "Parametric 3D, comunidad y AI Studio");
}

/** Per-route OG configs used by /og/:slug.svg endpoint */
export const OG_ROUTE_CONFIGS: Record<string, { title: string; subtitle: string; accent?: string; badge?: string }> = {
  default:     { title: "Vorea Studio", subtitle: "Parametric 3D, comunidad y AI Studio" },
  community:   { title: "Community Gallery", subtitle: "Explore, fork & share 3D models", badge: "Community" },
  news:        { title: "3D Printing News", subtitle: "Latest updates from the 3D world", badge: "News" },
  plans:       { title: "Plans & Pricing", subtitle: "Unlock the full potential of Vorea Studio", accent: "#FFD700", badge: "Pricing" },
  makers:      { title: "For Makers", subtitle: "Parametric 3D design for your next print", accent: "#10B981", badge: "Makers" },
  education:   { title: "For Education", subtitle: "Teach STEM with real 3D models", accent: "#6C63FF", badge: "Education" },
  "ai-creators": { title: "For AI Creators", subtitle: "AI-powered 3D model generation", accent: "#F59E0B", badge: "AI Studio" },
  benchmark:   { title: "3D Benchmark 2026", subtitle: "Vorea vs MakerWorld, Printables & Thangs", accent: "#3B82F6", badge: "Compare" },
  contact:     { title: "Get in Touch", subtitle: "Contact the Vorea Studio team", badge: "Contact" },
  contributors: { title: "Open Source Contributors", subtitle: "The people behind Vorea Studio", badge: "Credits" },
};

