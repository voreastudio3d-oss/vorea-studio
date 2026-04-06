import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "../nav";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { NewsApi, type NewsArticleResponse } from "../services/api-client";
import { useI18n } from "../services/i18n-context";
import { trackAnalyticsEvent } from "../services/analytics";
import { syncDynamicHead } from "../route-head";
import { buildNewsDeck, buildNewsWhyItMatters, getNewsContextParagraph, getNewsTierMeta, shouldShowOriginalTitle, getNewsCtaConfig, getEditorialContext } from "../news-presentation";
import { AlertTriangle, ArrowLeft, CalendarDays, ExternalLink, Loader2, Newspaper, Sparkles, Tag } from "lucide-react";

function resolveEditorialLanguage(locale: string): "es" | "en" {
  return locale.toLowerCase().startsWith("en") ? "en" : "es";
}

function formatDate(locale: string, value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
  }).format(date);
}

function tierBadgeClasses(tone: "brief" | "indexable" | "evergreen") {
  if (tone === "evergreen") {
    return "border-cyan-400/25 bg-cyan-400/12 text-cyan-100";
  }
  if (tone === "indexable") {
    return "border-[#C6E36C]/25 bg-[#C6E36C]/15 text-[#C6E36C]";
  }
  return "border-amber-400/20 bg-amber-400/10 text-amber-100";
}

function NewsVisual({ article }: { article: NewsArticleResponse }) {
  const [broken, setBroken] = useState(false);

  if (!article.imageUrl || broken) {
    return (
      <div className="flex h-full w-full min-h-[18rem] items-center justify-center bg-[radial-gradient(circle_at_top,rgba(198,227,108,0.15),transparent_55%)]">
        <Newspaper className="h-16 w-16 text-gray-700" />
      </div>
    );
  }

  return (
    <img
      src={article.imageUrl}
      alt={article.titleDisplay}
      className="h-full w-full object-cover"
      onError={() => setBroken(true)}
    />
  );
}

export function NewsDetail() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const slug = pathname.split("/").filter(Boolean)[1] ?? "";
  const editorialLanguage = resolveEditorialLanguage(locale);

  const [article, setArticle] = useState<NewsArticleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!slug) {
      setArticle(null);
      setLoading(false);
      setError(t("news.emptySubtitle"));
      return;
    }
    setLoading(true);
    setError(null);
    NewsApi.getBySlug(slug, { lang: editorialLanguage })
      .then((res) => {
        if (!alive) return;
        setArticle(res);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setArticle(null);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [slug, t, editorialLanguage]);

  const published = formatDate(locale, article?.publishedAt);
  const updated = formatDate(locale, article?.fetchedAt);
  const editorialCtas = useMemo(() => {
    if (!article) return [];
    return [
      {
        label: t("news.ctaAiStudio"),
        to: "/ai-studio",
        variant: "primary" as const,
      },
      {
        label: t("news.ctaExploreCommunity"),
        to: "/community",
        variant: "secondary" as const,
      },
    ];
  }, [article, locale]);
  const editorialDeck = useMemo(() => {
    if (!article) return "";
    return buildNewsDeck(article, locale);
  }, [article, locale]);
  const whyItMatters = useMemo(() => {
    if (!article) return "";
    return buildNewsWhyItMatters(article, locale);
  }, [article, locale]);
  const contextParagraph = useMemo(() => {
    if (!article) return null;
    return getNewsContextParagraph(article);
  }, [article]);
  const showOriginalTitle = useMemo(() => {
    if (!article) return false;
    return shouldShowOriginalTitle(article);
  }, [article]);
  const tierMeta = useMemo(() => {
    if (!article) return null;
    return getNewsTierMeta(article, locale);
  }, [article, locale]);
  const ctaConfig = useMemo(() => {
    if (!article) return null;
    return getNewsCtaConfig(article, locale);
  }, [article, locale]);
  const editorialContext = useMemo(() => {
    if (!article) return null;
    return getEditorialContext(article);
  }, [article]);

  useEffect(() => {
    if (!article) return;
    syncDynamicHead(
      {
        title: `${article.titleDisplay} | Noticias 3D | Vorea Studio`,
        description: article.summary || whyItMatters,
        robots: article.indexable === false || article.editorialTier === "brief" ? "noindex, follow" : "index, follow",
      },
      `/news/${article.slug}`,
      locale
    );
  }, [article, whyItMatters, locale]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin text-[#C6E36C]/60" />
          <p className="text-sm">{t("news.loading")}</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <Button variant="secondary" size="sm" className="mb-6 gap-2" onClick={() => navigate("/news")}>
            <ArrowLeft className="h-4 w-4" />
            {t("news.backToNews")}
          </Button>
          <div className="flex flex-col items-center rounded-3xl border border-red-500/20 bg-red-500/5 px-6 py-16 text-center">
            <AlertTriangle className="mb-4 h-10 w-10 text-red-400" />
            <h1 className="text-2xl font-semibold text-white">{t("news.errorTitle")}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-gray-400">
              {t("news.errorSubtitle")}
            </p>
            {error && <p className="mt-3 max-w-2xl text-xs text-gray-500">{error}</p>}
            <Button className="mt-6" onClick={() => navigate("/news")}>
              {t("news.backToNews")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="relative overflow-hidden border-b border-[rgba(168,187,238,0.08)] bg-[radial-gradient(circle_at_top,rgba(198,227,108,0.1),transparent_35%),linear-gradient(180deg,rgba(26,31,54,0.94),rgba(13,17,23,1))]">
        <div className="absolute -right-24 top-0 h-64 w-64 rounded-full bg-[#C6E36C]/10 blur-[120px]" />
        <div className="absolute left-0 top-6 h-64 w-64 rounded-full bg-blue-500/10 blur-[140px]" />
        <div className="relative mx-auto max-w-7xl px-6 py-10 md:py-14">
          <Button variant="secondary" size="sm" className="gap-2 backdrop-blur-md bg-[#0d1117]/60" onClick={() => navigate("/news")}>
            <ArrowLeft className="h-4 w-4" />
            {t("news.backToNews")}
          </Button>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                {article.category && <Badge className="border-[#C6E36C]/25 bg-[#C6E36C]/15 text-[#C6E36C]">{article.category}</Badge>}
                {article.source?.name && <Badge className="border-white/10 bg-white/5 text-gray-200">{article.source.name}</Badge>}
                  {tierMeta && (
                    <Badge className={tierBadgeClasses(tierMeta.tone)}>{tierMeta.label}</Badge>
                  )}
                  {article.sourceLanguage && (
                    <Badge className="border-white/10 bg-white/5 text-gray-400 uppercase tracking-[0.18em]">{article.sourceLanguage}</Badge>
                  )}
                  {article.requestedLanguage && (
                    <Badge className="border-white/10 bg-white/5 text-gray-400 uppercase tracking-[0.18em]">{article.requestedLanguage}</Badge>
                  )}
                </div>

              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{article.titleDisplay}</h1>
              <p className="max-w-3xl text-base leading-7 text-gray-300 md:text-lg">
                {editorialDeck}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                {published && (
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-[#C6E36C]/70" />
                    {t("news.publishedLabel")}: {published}
                  </span>
                )}
                {updated && (
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#C6E36C]/70" />
                    {t("news.updatedLabel")}: {updated}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-[rgba(168,187,238,0.12)] bg-[#1a1f36] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-gray-400"
                  >
                    <Tag className="h-3 w-3 text-gray-600" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative aspect-video w-full self-start overflow-hidden rounded-[2rem] border border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.45)]">
              <NewsVisual article={article} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-md">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500">
                    {t("news.sourceContextTitle")}
                  </p>
                  <p className="mt-1 text-sm text-white">{article.source?.name ?? "Vorea"}</p>
                  <p className="mt-2 text-xs leading-6 text-gray-300">
                    {t("news.sourceContextBody")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1fr_20rem]">
        <div>
          {/* ── Unified article body ── */}
          <article className="rounded-3xl border border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.45)] p-8 md:p-10">
            {/* Lead / Summary — prominent opening paragraph */}
            <p className="text-base leading-8 text-gray-200 md:text-lg md:leading-9">
              {article.summary}
            </p>

            {/* Detail body — continuous prose */}
            {contextParagraph ? (
              <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-gray-300 md:text-[15px] md:leading-8">
                {contextParagraph}
              </p>
            ) : null}

            {/* Why it matters — inline highlighted callout */}
            <div className="mt-8 rounded-2xl border-l-4 border-[#C6E36C]/60 bg-[#C6E36C]/5 px-6 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C6E36C]/80">
                {t("news.whyItMatters")}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-200">
                {whyItMatters}
              </p>
            </div>

            {/* Editorial context — inline subtle callout */}
            {editorialContext ? (
              <div className="mt-6 rounded-2xl border-l-4 border-blue-400/40 bg-blue-400/5 px-6 py-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-300/80">
                  {t("news.editorialContextTitle")}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-300">
                  {editorialContext}
                </p>
              </div>
            ) : null}

            {/* Source CTA + internal actions — article footer */}
            <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-white/8 pt-6">
              {ctaConfig ? (
                <a
                  href={ctaConfig.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#C6E36C]/30 bg-[#C6E36C]/12 px-5 py-2.5 text-sm font-medium text-[#C6E36C] transition-all hover:bg-[#C6E36C]/25 hover:text-white"
                  onClick={() =>
                    trackAnalyticsEvent("news_source_cta_click", {
                      article_slug: article.slug,
                      cta_url: ctaConfig.url,
                    })
                  }
                >
                  <ExternalLink className="h-4 w-4" />
                  {ctaConfig.text}
                </a>
              ) : null}
              {editorialCtas.map((cta) => (
                <Button
                  key={cta.to}
                  asChild
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                >
                  <Link
                    to={cta.to}
                    onClick={() =>
                      trackAnalyticsEvent("news_cta_click", {
                        article_slug: article.slug,
                        cta_path: cta.to,
                      })
                    }
                  >
                    {cta.label}
                  </Link>
                </Button>
              ))}
            </div>
          </article>
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.45)] p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
              {t("news.attributionTitle")}
            </h3>
            <div className="mt-4 space-y-4 text-sm text-gray-300">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{t("news.sourceLabel")}</p>
                <p className="mt-1">{article.source?.name ?? article.sourceId ?? "Vorea"}</p>
              </div>
              {showOriginalTitle ? (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{t("news.originalTitleLabel")}</p>
                  <p className="mt-1">{article.titleOriginal}</p>
                </div>
              ) : null}
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{t("news.originalLinkLabel")}</p>
                <a
                  href={article.canonicalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-2 text-[#C6E36C] transition-colors hover:text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t("news.openOriginal")}
                </a>
              </div>
              <div className="rounded-2xl border border-[rgba(168,187,238,0.12)] bg-black/20 p-4 text-xs leading-6 text-gray-500">
                {t("news.generatedDisclaimer")}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.45)] p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
              {t("news.metaTitle")}
            </h3>
            <div className="mt-4 space-y-4 text-sm text-gray-300">
              {article.category && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{t("news.categoryLabel")}</p>
                  <p className="mt-1">{article.category}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{t("news.publishedLabel")}</p>
                <p className="mt-1">{published || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{t("news.updatedLabel")}</p>
                <p className="mt-1">{updated || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{t("news.tagsLabel")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {article.tags.length > 0 ? (
                    article.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-[rgba(168,187,238,0.12)] bg-[#1a1f36] px-2.5 py-1 text-[10px] text-gray-400">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Button asChild variant="secondary" className="w-full gap-2">
            <Link to="/news">
              <ArrowLeft className="h-4 w-4" />
              {t("news.backToNews")}
            </Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
