import type { NewsArticleResponse } from "./services/api-client";

function normalizeComparableText(input: string): string {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRepeatedText(candidate: string, reference: string): boolean {
  const normalizedCandidate = normalizeComparableText(candidate);
  const normalizedReference = normalizeComparableText(reference);
  if (!normalizedCandidate || !normalizedReference) return false;
  if (normalizedCandidate === normalizedReference) return true;
  if (normalizedReference.includes(normalizedCandidate)) return true;
  if (normalizedCandidate.includes(normalizedReference) && normalizedReference.length >= 18) return true;
  return false;
}

export function getNewsContextParagraph(article: NewsArticleResponse): string | null {
  const detail = String(article.detail || "").trim();
  if (!detail) return null;

  const references = [
    article.summary,
    article.titleDisplay,
    article.titleOriginal,
    article.sourceExcerpt,
    article.whyItMatters,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (references.some((reference) => isRepeatedText(detail, reference))) {
    return null;
  }

  return detail;
}

export function shouldShowOriginalTitle(article: NewsArticleResponse): boolean {
  const original = String(article.titleOriginal || "").trim();
  const display = String(article.titleDisplay || "").trim();
  if (!original || !display) return false;
  return !isRepeatedText(original, display);
}

export function buildNewsDeck(article: NewsArticleResponse, locale: string): string {
  const sourceName = article.source?.name ?? "Vorea";
  const category = String(article.category || "").trim();
  const sourceLanguage = article.sourceLanguage?.toUpperCase();

  if (locale.toLowerCase().startsWith("en")) {
    const categoryText = category ? ` around ${category.toLowerCase()}` : "";
    const languageText = sourceLanguage ? ` Source language: ${sourceLanguage}.` : "";
    return `Editorial read from ${sourceName}${categoryText}, focused on what this signal changes for makers, print shops and product decisions.${languageText}`;
  }

  const categoryText = category ? ` sobre ${category.toLowerCase()}` : "";
  const languageText = sourceLanguage ? ` Idioma de la fuente: ${sourceLanguage}.` : "";
  return `Lectura editorial de ${sourceName}${categoryText}, enfocada en qué cambia esta señal para makers, talleres y decisiones de producto.${languageText}`;
}

export function buildNewsWhyItMatters(article: NewsArticleResponse, locale: string): string {
  if (article.whyItMatters) return article.whyItMatters;

  const source = article.source?.name ?? "Vorea";
  const category = article.category ? ` ${article.category.toLowerCase()}` : "";
  const preview = article.summary || article.detail || article.sourceExcerpt || "";

  if (locale.toLowerCase().startsWith("en")) {
    return `This signal from ${source}${category} matters because ${preview}`;
  }

  return `Esta señal de ${source}${category} importa porque ${preview}`;
}

export function getNewsTierMeta(article: NewsArticleResponse, locale: string): {
  label: string;
  tone: "brief" | "indexable" | "evergreen";
} {
  const langIsEnglish = locale.toLowerCase().startsWith("en");
  const tier = article.editorialTier || (article.indexable ? "indexable" : "brief");

  if (tier === "evergreen") {
    return {
      label: langIsEnglish ? "Evergreen guide" : "Guía evergreen",
      tone: "evergreen",
    };
  }

  if (tier === "indexable") {
    return {
      label: langIsEnglish ? "Editorial analysis" : "Análisis editorial",
      tone: "indexable",
    };
  }

  return {
    label: langIsEnglish ? "Brief radar" : "Radar breve",
    tone: "brief",
  };
}

export function getNewsCtaConfig(
  article: NewsArticleResponse,
  locale: string
): { text: string; url: string } {
  const isEn = locale.toLowerCase().startsWith("en");
  const ctaText = isEn
    ? article.ctaTextEn || article.ctaTextEs || null
    : article.ctaTextEs || article.ctaTextEn || null;
  const ctaUrl = article.ctaUrl || article.canonicalUrl || "#";

  if (ctaText) return { text: ctaText, url: ctaUrl };

  const sourceName = article.source?.name ?? "the source";
  return {
    text: isEn
      ? `Read the full story at ${sourceName}`
      : `Leer la nota completa en ${sourceName}`,
    url: ctaUrl,
  };
}

export function getEditorialContext(article: NewsArticleResponse): string | null {
  const context = String(article.editorialContext || "").trim();
  if (!context || context.length < 20) return null;
  return context;
}
