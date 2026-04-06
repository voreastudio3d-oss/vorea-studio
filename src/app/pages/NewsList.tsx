import { useEffect, useMemo, useState } from "react";
import { Link } from "../nav";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { NewsApi, type NewsArticleResponse } from "../services/api-client";
import { useI18n } from "../services/i18n-context";
import { buildNewsDeck, getNewsTierMeta } from "../news-presentation";
import { AlertTriangle, ArrowRight, CalendarDays, ExternalLink, Loader2, Newspaper, Sparkles } from "lucide-react";

type NewsSourceLanguageFilter = "all" | "es" | "en";

function resolveEditorialLanguage(locale: string): "es" | "en" {
  return locale.toLowerCase().startsWith("en") ? "en" : "es";
}

function formatDate(locale: string, value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: undefined,
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

function NewsVisual({
  article,
  className,
  iconClassName,
}: {
  article: NewsArticleResponse;
  className: string;
  iconClassName: string;
}) {
  const [broken, setBroken] = useState(false);

  if (!article.imageUrl || broken) {
    return (
      <div className={`flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(198,227,108,0.14),transparent_55%)] ${className}`}>
        <Newspaper className={iconClassName} />
      </div>
    );
  }

  return (
    <img
      src={article.imageUrl}
      alt={article.titleDisplay}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}

function NewsCard({
  article,
  locale,
  openOriginalLabel,
  readAnalysisLabel,
}: {
  article: NewsArticleResponse;
  locale: string;
  openOriginalLabel: string;
  readAnalysisLabel: string;
}) {
  const published = formatDate(locale, article.publishedAt);
  const sourceName = article.source?.name ?? article.category ?? "Vorea";
  const editorialDeck = buildNewsDeck(article, locale);
  const tierMeta = getNewsTierMeta(article, locale);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[rgba(168,187,238,0.12)] bg-[linear-gradient(180deg,rgba(26,31,54,0.9),rgba(13,17,23,0.95))] hover:border-[#C6E36C]/40 transition-all duration-300 hover:-translate-y-1">
      <Link to={`/noticias/${article.slug}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden bg-[#121620]">
          <NewsVisual
            article={article}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            iconClassName="h-12 w-12 text-gray-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/30 to-transparent" />
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            <Badge className={`${tierBadgeClasses(tierMeta.tone)} backdrop-blur`}>{tierMeta.label}</Badge>
            {article.category && <Badge className="border-white/10 bg-black/30 text-gray-200 backdrop-blur">{article.category}</Badge>}
            {article.source?.name && (
              <Badge className="border-white/10 bg-black/30 text-gray-200 backdrop-blur">
                {article.source.name}
              </Badge>
            )}
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <h2 className="max-w-2xl text-xl font-semibold tracking-tight text-white transition-colors group-hover:text-[#C6E36C]">
              {article.titleDisplay}
            </h2>
          </div>
        </div>
      </Link>

      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-[#C6E36C]/70" />
            {published || article.source?.name || sourceName}
          </span>
          {article.sourceLanguage && <span className="uppercase tracking-[0.18em]">{article.sourceLanguage}</span>}
        </div>

        <p className="text-sm leading-6 text-gray-400">
          {article.summary}
        </p>

        <p className="border-l border-[#C6E36C]/25 pl-3 text-xs leading-6 text-gray-500">
          {editorialDeck}
        </p>

        <div className="flex flex-wrap gap-2">
          {article.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[rgba(168,187,238,0.12)] bg-[#1a1f36] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-gray-500"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <Link
            to={`/noticias/${article.slug}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#C6E36C] transition-colors hover:text-white"
          >
            {readAnalysisLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href={article.canonicalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-gray-300"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {openOriginalLabel}
          </a>
        </div>
      </div>
    </article>
  );
}

export function NewsList() {
  const { t, locale } = useI18n();
  const [articles, setArticles] = useState<NewsArticleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceLanguageFilter, setSourceLanguageFilter] = useState<NewsSourceLanguageFilter>("all");
  const editorialLanguage = resolveEditorialLanguage(locale);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    NewsApi.list({
      limit: 12,
      lang: editorialLanguage,
      sourceLanguage: sourceLanguageFilter === "all" ? undefined : sourceLanguageFilter,
    })
      .then((res) => {
        if (!alive) return;
        setArticles(res.articles);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setArticles([]);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [editorialLanguage, sourceLanguageFilter]);

  const featuredArticle = useMemo(
    () => articles.find((article) => article.editorialTier !== "brief") ?? articles[0],
    [articles]
  );
  const featuredId = featuredArticle?.id || featuredArticle?.slug;
  const primaryStories = useMemo(
    () => articles.filter((article) => (article.id || article.slug) !== featuredId && article.editorialTier !== "brief"),
    [articles, featuredId]
  );
  const briefStories = useMemo(
    () => articles.filter((article) => (article.id || article.slug) !== featuredId && article.editorialTier === "brief"),
    [articles, featuredId]
  );
  const featuredTier = useMemo(
    () => (featuredArticle ? getNewsTierMeta(featuredArticle, locale) : null),
    [featuredArticle, locale]
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="relative overflow-hidden border-b border-[rgba(168,187,238,0.08)] bg-[radial-gradient(circle_at_top_left,rgba(198,227,108,0.08),transparent_35%),linear-gradient(180deg,rgba(26,31,54,0.95),rgba(13,17,23,1))]">
        <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-[#C6E36C]/8 blur-[96px]" />
        <div className="absolute left-0 top-6 h-56 w-56 rounded-full bg-blue-500/8 blur-[110px]" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 md:py-10">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C6E36C]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#C6E36C]/20 bg-[#C6E36C]/10 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5" />
              {t("news.heroKicker")}
            </span>
            <span className="text-gray-500">{t("news.sourceHint")}</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)] lg:items-end">
            <div className="max-w-3xl space-y-3">
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t("news.pageTitle")}</h1>
              <p className="max-w-2xl text-sm leading-6 text-gray-400 md:text-base">
                {t("news.pageSubtitle")}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(168,187,238,0.1)] bg-black/20 px-4 py-3 backdrop-blur-sm">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-500">
                {t("news.segmentLabel")}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(["all", "es", "en"] as const).map((option) => {
                  const active = sourceLanguageFilter === option;
                  const label =
                    option === "all"
                      ? t("news.segmentAll")
                      : option === "es"
                        ? t("news.segmentSpanish")
                        : t("news.segmentEnglish");
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSourceLanguageFilter(option)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                        active
                          ? "border-[#C6E36C]/40 bg-[#C6E36C]/15 text-[#C6E36C]"
                          : "border-[rgba(168,187,238,0.12)] bg-black/20 text-gray-400 hover:border-[#C6E36C]/25 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {t(editorialLanguage === "en" ? "news.contentLanguageEnglish" : "news.contentLanguageSpanish")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {loading ? (
          <div className="flex min-h-[45vh] flex-col items-center justify-center text-gray-500">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-[#C6E36C]/60" />
            <p className="text-sm">{t("news.loading")}</p>
          </div>
        ) : error ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center rounded-3xl border border-red-500/20 bg-red-500/5 px-6 py-14 text-center">
            <AlertTriangle className="mb-4 h-10 w-10 text-red-400" />
            <h2 className="text-xl font-semibold text-white">{t("news.errorTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">{t("news.errorSubtitle")}</p>
            <p className="mt-3 max-w-xl text-xs text-gray-500">{error}</p>
            <Button
              className="mt-6"
              onClick={() => {
                setLoading(true);
                setError(null);
                NewsApi.list({
                  limit: 12,
                  lang: editorialLanguage,
                  sourceLanguage: sourceLanguageFilter === "all" ? undefined : sourceLanguageFilter,
                })
                  .then((res) => setArticles(res.articles))
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
                  .finally(() => setLoading(false));
              }}
            >
              {t("news.retry")}
            </Button>
          </div>
        ) : articles.length === 0 ? (
          <div className="mx-auto flex max-w-2xl flex-col items-center rounded-3xl border border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.5)] px-6 py-16 text-center">
            <Newspaper className="mb-4 h-12 w-12 text-gray-700" />
            <h2 className="text-xl font-semibold text-white">{t("news.emptyTitle")}</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-gray-400">{t("news.emptySubtitle")}</p>
          </div>
        ) : (
          <div className="space-y-10">
            {featuredArticle && featuredTier && (
              <article className="grid items-center overflow-hidden rounded-[2rem] border border-[#C6E36C]/20 bg-[rgba(26,31,54,0.42)] shadow-[0_0_0_1px_rgba(198,227,108,0.04)] lg:grid-cols-[1.4fr_1fr]">
                <div className="relative aspect-video w-full overflow-hidden bg-[#121620]">
                  <NewsVisual
                    article={featuredArticle}
                    className="h-full w-full object-cover"
                    iconClassName="h-16 w-16 text-gray-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0d1117] via-[#0d1117]/15 to-transparent lg:bg-gradient-to-t" />
                </div>
                <div className="flex flex-col justify-between gap-6 p-8">
                  <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                      <Badge className="border-white/10 bg-white/5 text-gray-300">{t("news.featuredLabel")}</Badge>
                      <Badge className={tierBadgeClasses(featuredTier.tone)}>{featuredTier.label}</Badge>
                      {featuredArticle.category && <Badge className="border-[#C6E36C]/25 bg-[#C6E36C]/15 text-[#C6E36C]">{featuredArticle.category}</Badge>}
                      {featuredArticle.source?.name && <Badge className="border-white/10 bg-white/5 text-gray-300">{featuredArticle.source.name}</Badge>}
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{featuredArticle.titleDisplay}</h2>
                    <p className="max-w-xl text-sm leading-7 text-gray-300">{featuredArticle.summary}</p>
                    <p className="max-w-xl border-l border-[#C6E36C]/25 pl-4 text-xs leading-6 text-gray-500">{buildNewsDeck(featuredArticle, locale)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button asChild className="gap-2">
                      <Link to={`/noticias/${featuredArticle.slug}`}>
                        {t("news.readAnalysis")}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <a
                      href={featuredArticle.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t("news.openOriginal")}
                    </a>
                  </div>
                </div>
              </article>
            )}

            {primaryStories.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">{t("news.latestTitle")}</h2>
                  <span className="text-xs uppercase tracking-[0.22em] text-gray-500">{articles.length} {t("news.itemsLabel")}</span>
                </div>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {primaryStories.map((article) => (
                    <NewsCard
                      key={article.id || article.slug}
                      article={article}
                      locale={locale}
                      openOriginalLabel={t("news.openOriginal")}
                      readAnalysisLabel={t("news.readAnalysis")}
                    />
                  ))}
                </div>
              </section>
            )}

            {briefStories.length > 0 && (
              <section className="space-y-4 rounded-[2rem] border border-[rgba(168,187,238,0.12)] bg-[rgba(17,22,32,0.76)] p-6">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-white">{t("news.briefSectionTitle")}</h2>
                  <p className="max-w-3xl text-sm leading-6 text-gray-400">{t("news.briefSectionSubtitle")}</p>
                </div>
                <div className="divide-y divide-white/5">
                  {briefStories.map((article) => {
                    const tierMeta = getNewsTierMeta(article, locale);
                    return (
                      <article key={article.id || article.slug} className="grid gap-4 py-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={tierBadgeClasses(tierMeta.tone)}>{tierMeta.label}</Badge>
                          {article.source?.name ? (
                            <span className="text-xs uppercase tracking-[0.18em] text-gray-500">{article.source.name}</span>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          <Link to={`/noticias/${article.slug}`} className="text-base font-medium text-white transition-colors hover:text-[#C6E36C]">
                            {article.titleDisplay}
                          </Link>
                          <p className="text-sm leading-6 text-gray-400">{article.summary}</p>
                        </div>
                        <div className="flex flex-wrap gap-3 md:justify-end">
                          <Link
                            to={`/noticias/${article.slug}`}
                            className="inline-flex items-center gap-2 text-sm font-medium text-[#C6E36C] transition-colors hover:text-white"
                          >
                            {t("news.readAnalysis")}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                          <a
                            href={article.canonicalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-gray-300"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {t("news.openOriginal")}
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
