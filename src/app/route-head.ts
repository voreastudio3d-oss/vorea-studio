import { getPublicRouteMeta } from "./public-route-meta";

type RouteHeadMeta = {
  title: string;
  description: string;
  robots?: string;
};

function normalizeLocale(locale: string): { htmlLang: string; ogLocale: string } {
  const value = String(locale || "es").trim() || "es";
  if (value.toLowerCase().startsWith("en")) {
    return { htmlLang: "en", ogLocale: "en_US" };
  }
  if (value.toLowerCase().startsWith("pt")) {
    return { htmlLang: "pt", ogLocale: "pt_BR" };
  }
  return { htmlLang: "es", ogLocale: "es_UY" };
}

function ensureMeta(selector: string, attributes: Record<string, string>) {
  let tag = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    document.head.appendChild(tag);
  }
  Object.entries(attributes).forEach(([key, value]) => tag?.setAttribute(key, value));
}

function ensureLink(selector: string, attributes: Record<string, string>) {
  let tag = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!tag) {
    tag = document.createElement("link");
    document.head.appendChild(tag);
  }
  Object.entries(attributes).forEach(([key, value]) => tag?.setAttribute(key, value));
}

function localizedMeta(pathname: string, locale: string): RouteHeadMeta {
  const isEnglish = locale.toLowerCase().startsWith("en");
  const isPortuguese = locale.toLowerCase().startsWith("pt");
  const publicMeta = getPublicRouteMeta(pathname, locale);
  const homeMeta = getPublicRouteMeta("/", locale)!;

  if (publicMeta) return publicMeta;
  if (pathname === "/studio") {
    return {
      title: isEnglish ? "Studio | Vorea Studio" : isPortuguese ? "Studio | Vorea Studio" : "Studio | Vorea Studio",
      description: homeMeta.description,
      robots: "noindex, nofollow",
    };
  }
  if (pathname === "/ai-studio") {
    return {
      title: isEnglish ? "AI Studio | Vorea Studio" : isPortuguese ? "AI Studio | Vorea Studio" : "AI Studio | Vorea Studio",
      description: homeMeta.description,
      robots: "noindex, nofollow",
    };
  }
  if (pathname === "/profile") {
    return {
      title: isEnglish ? "Profile | Vorea Studio" : isPortuguese ? "Perfil | Vorea Studio" : "Perfil | Vorea Studio",
      description: homeMeta.description,
      robots: "noindex, nofollow",
    };
  }
  if (pathname.startsWith("/news")) {
    return {
      title: isEnglish ? "3D News | Vorea Studio" : isPortuguese ? "Notícias 3D | Vorea Studio" : "Noticias 3D | Vorea Studio",
      description: isEnglish
        ? "Follow relevant 3D printing and maker ecosystem news curated by Vorea Studio."
        : isPortuguese
        ? "Acompanhe notícias relevantes de impressão 3D e do ecossistema maker com curadoria da Vorea Studio."
        : "Sigue noticias relevantes de impresión 3D y del ecosistema maker con curaduría de Vorea Studio.",
    };
  }
  return homeMeta;
}

export function syncRouteHead(pathname: string, locale: string) {
  if (typeof document === "undefined") return;
  syncDynamicHead(localizedMeta(pathname, locale), pathname, locale);
}

export function syncDynamicHead(meta: RouteHeadMeta, pathname: string, locale: string) {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  const { htmlLang, ogLocale } = normalizeLocale(locale);
  const canonicalPath = `/${locale.split('-')[0]}${pathname === '/' ? '' : pathname}`;
  const canonicalUrl = new URL(canonicalPath, window.location.origin).toString();
  const title = meta.title;
  const description = meta.description;
  const robots = meta.robots || (pathname.startsWith("/studio") || pathname.startsWith("/ai-studio") || pathname.startsWith("/perfil") ? "noindex, nofollow" : "index, follow");

  document.title = title;
  document.documentElement.lang = htmlLang;

  ensureMeta('meta[name="description"]', { name: "description", content: description });
  ensureMeta('meta[name="robots"]', { name: "robots", content: robots });
  ensureMeta('meta[property="og:title"]', { property: "og:title", content: title });
  ensureMeta('meta[property="og:description"]', { property: "og:description", content: description });
  ensureMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
  ensureMeta('meta[property="og:locale"]', { property: "og:locale", content: ogLocale });
  ensureMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  ensureMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
  ensureLink('link[rel="canonical"]', { rel: "canonical", href: canonicalUrl });

  // ── hreflang alternates (/:lang prefix) ──
  const hrefLangs = [
    { lang: "es", prefix: "/es" },
    { lang: "en", prefix: "/en" },
    { lang: "pt", prefix: "/pt" },
    { lang: "x-default", prefix: "" },
  ];
  for (const { lang, prefix } of hrefLangs) {
    const href = new URL(prefix + pathname, window.location.origin).toString();
    ensureLink(`link[hreflang="${lang}"]`, { rel: "alternate", hreflang: lang, href });
  }
}
