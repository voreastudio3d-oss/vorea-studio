/**
 * Explore – Community gallery powered by the Community API.
 * Fetches models, tags, and search from the backend (PostgreSQL KV).
 * Models link to clean /model/:id pages, authors link to /user/:id/modelos.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { AuthDialog } from "../components/AuthDialog";
import { useNavigate, Link } from "../nav";
import { useAuth } from "../services/auth-context";
import { requireLoggedInInteraction } from "../services/protected-auth-interactions";
import { CommunityApi, type CommunityModelResponse, type CommunityTag } from "../services/api-client";
import { toast } from "sonner";
import { Search, Heart, Download, Sparkles, Crown, User, SortAsc, Loader2, GitFork, Mountain, MessageCircle } from "lucide-react";
import { useI18n } from "../services/i18n-context";
import { trackAnalyticsEvent } from "../services/analytics";
import { fireReward } from "../services/reward-triggers";

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Explore() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<"recent" | "popular" | "downloads" | "most_forked">("recent");
  const [models, setModels] = useState<CommunityModelResponse[]>([]);
  const [featuredModels, setFeaturedModels] = useState<CommunityModelResponse[]>([]);
  const [tags, setTags] = useState<CommunityTag[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;
  const [authOpen, setAuthOpen] = useState(false);
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch tags on mount
  useEffect(() => {
    trackAnalyticsEvent("page_view", { page: "explore" });
    CommunityApi.listTags().then(setTags).catch(console.error);
    CommunityApi.listModels({ featured: true, limit: 6 })
      .then((res) => setFeaturedModels(res.models))
      .catch(console.error);
  }, []);

  // Fetch models when filters change (debounced search)
  const fetchModels = useCallback(async () => {
    setLoading(true);
    setCurrentPage(1);
    try {
      const res = await CommunityApi.listModels({
        search: search || undefined,
        tag: activeTag || undefined,
        sort,
        limit: PAGE_SIZE,
        page: 1,
      });
      setModels(res.models);
      setTotal(res.total);
    } catch (e) {
      console.error("Error fetching models:", e);
    } finally {
      setLoading(false);
    }
  }, [search, activeTag, sort]);

  const loadMore = useCallback(async () => {
    const nextPage = currentPage + 1;
    setLoadingMore(true);
    try {
      const res = await CommunityApi.listModels({
        search: search || undefined,
        tag: activeTag || undefined,
        sort,
        limit: PAGE_SIZE,
        page: nextPage,
      });
      setModels((prev) => [...prev, ...res.models]);
      setTotal(res.total);
      setCurrentPage(nextPage);
    } catch (e) {
      console.error("Error loading more:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [search, activeTag, sort, currentPage]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchModels, search ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchModels]);

  const handleOpenDetail = useCallback(
    (modelId: string) => {
      trackAnalyticsEvent("model_open", { tool: "explore", modelId });
      navigate(`/model/${modelId}`);
    },
    [navigate]
  );

  const handleLike = useCallback(
    async (e: React.MouseEvent, modelId: string) => {
      e.stopPropagation();
      if (!requireLoggedInInteraction({
        isLoggedIn,
        onAuthRequired: () => setAuthOpen(true),
        authMessage: t("explore.loginToLike"),
      })) {
        return;
      }
      try {
        const { liked, likes } = await CommunityApi.toggleLike(modelId);
        setModels((prev) =>
          prev.map((m) => (m.id === modelId ? { ...m, likes } : m))
        );
        setFeaturedModels((prev) =>
          prev.map((m) => (m.id === modelId ? { ...m, likes } : m))
        );
        toast.success(liked ? t("explore.likeAdded") : t("explore.likeRemoved"));
        if (liked) fireReward("community_like");
        trackAnalyticsEvent("model_like", { tool: "explore", modelId, liked: String(liked) });
      } catch {
        toast.error(t("explore.likeError"));
      }
    },
    [isLoggedIn, t]
  );

  const SORT_KEYS: Record<string, string> = {
    recent: "explore.sortRecent",
    popular: "explore.sortPopular",
    downloads: "explore.sortDownloads",
    most_forked: "explore.sortForked",
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {t("explore.title")}
        </h1>
        <p className="text-gray-400">
          {t("explore.subtitle")}
        </p>

        <div className="mt-6 flex gap-3 items-center">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder={t("explore.searchPlaceholder")}
              className="pl-10 h-12 bg-[rgba(168,187,238,0.03)] border-[rgba(168,187,238,0.12)] text-base"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-1 bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] rounded-lg px-2 h-12">
            <SortAsc className="w-4 h-4 text-gray-500" />
            {(["recent", "popular", "downloads", "most_forked"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`text-[10px] px-2 py-1.5 rounded transition-colors ${
                  sort === s
                    ? "bg-[#C6E36C]/15 text-[#C6E36C]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {t(SORT_KEYS[s])}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTag(null)}
            className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${
              !activeTag ? "bg-[#C6E36C]/15 text-[#C6E36C] border border-[#C6E36C]/30" : "bg-[#1a1f36] text-gray-500 border border-[rgba(168,187,238,0.08)]"
            }`}
          >
            {t("explore.allTags")}
          </button>
          {tags.map((tag) => (
            <button
              key={tag.name}
              onClick={() => setActiveTag(tag.name === activeTag ? null : tag.name)}
              className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${
                tag.name === activeTag ? "bg-[#C6E36C]/15 text-[#C6E36C] border border-[#C6E36C]/30" : "bg-[#1a1f36] text-gray-500 border border-[rgba(168,187,238,0.08)] hover:border-[rgba(168,187,238,0.2)]"
              }`}
            >
              {tag.name} <span className="opacity-50">({tag.modelCount})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Featured */}
      {!search && !activeTag && featuredModels.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-[#C6E36C]" />
            <h2 className="text-lg font-semibold">{t("explore.featured")}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredModels.map((model, i) => (
              <div
                key={model.id}
                className="group relative rounded-2xl overflow-hidden glass border border-[#C6E36C]/20 hover:border-[#C6E36C]/50 hover:shadow-[0_0_20px_rgba(198,227,108,0.15)] transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                onClick={() => handleOpenDetail(model.id)}
                style={{ animation: `vsCardIn 0.4s cubic-bezier(.22,1,.36,1) ${i * 0.06}s both` }}
              >
                <div className="aspect-[4/3] w-full overflow-hidden relative">
                  {model.thumbnailUrl ? (
                    <img src={model.thumbnailUrl} alt={model.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full bg-[#121620] flex items-center justify-center">
                      <Sparkles className="w-10 h-10 text-gray-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/50 to-transparent opacity-80" />
                  <Badge className="absolute top-3 left-3 bg-[#C6E36C]/20 text-[#C6E36C] border-[#C6E36C]/30 backdrop-blur">
                    <Crown className="w-3 h-3 mr-1" /> {t("explore.featuredBadge")}
                  </Badge>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-[#C6E36C] transition-colors">{model.title}</h3>
                  <div className="flex items-center justify-between text-sm">
                    <Link
                      to={`/user/${model.authorId}/modelos`}
                      className="text-gray-300 hover:text-[#C6E36C] transition-colors flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <User className="w-3 h-3" />
                      {model.authorUsername}
                    </Link>
                    <div className="flex items-center gap-3">
                      <button
                        className="flex items-center gap-1 text-gray-400 hover:text-red-400 transition-colors"
                        onClick={(e) => handleLike(e, model.id)}
                      >
                        <Heart className="w-3.5 h-3.5" /><span>{model.likes.toLocaleString()}</span>
                      </button>
                      <div className="flex items-center gap-1 text-gray-400"><Download className="w-3.5 h-3.5" /><span>{model.downloads.toLocaleString()}</span></div>
                      <div className="flex items-center gap-1 text-gray-400"><MessageCircle className="w-3.5 h-3.5" /><span>{model.commentCount ?? 0}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All models */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {search || activeTag ? t("explore.results", { count: String(total) }) : t("explore.allModels", { count: String(total) })}
        </h2>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-[#C6E36C]/50" />
          <p className="text-sm">{t("explore.loading")}</p>
        </div>
      ) : models.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {models.map((model, i) => (
            <div
              key={model.id}
              className="group relative rounded-xl overflow-hidden glass border border-[rgba(168,187,238,0.12)] hover:border-[#C6E36C]/40 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
              onClick={() => handleOpenDetail(model.id)}
              style={{ animation: `vsCardIn 0.4s cubic-bezier(.22,1,.36,1) ${i * 0.04}s both` }}
            >
              <div className="aspect-[4/3] w-full overflow-hidden relative">
                {model.thumbnailUrl ? (
                  <img src={model.thumbnailUrl} alt={model.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full bg-[#121620] flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-gray-700" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/30 to-transparent opacity-70" />
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-[#C6E36C] transition-colors line-clamp-1">{model.title}</h3>
                <Link
                  to={`/user/${model.authorId}/modelos`}
                  className="text-[11px] text-gray-500 hover:text-[#C6E36C] transition-colors flex items-center gap-1 mb-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <User className="w-3 h-3" />
                  {model.authorUsername}
                </Link>
                {model.forkedFromId && (
                  <p className="text-[9px] text-gray-600 flex items-center gap-1 mb-1">
                    <GitFork className="w-3 h-3" /> {t("explore.forkOf", { author: model.forkedFromAuthor || t("explore.forkOfUnknown") })}
                  </p>
                )}
                {model.modelType === "relief" && (
                  <span className="inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 mb-1">
                    <Mountain className="w-2.5 h-2.5" /> {t("explore.reliefBadge")}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {model.tags.slice(0, 2).map((tg) => (
                      <span key={tg} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1f36] text-gray-500 border border-[rgba(168,187,238,0.08)]">{tg}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <button
                      className="flex items-center gap-0.5 hover:text-red-400 transition-colors relative z-10"
                      onClick={(e) => handleLike(e, model.id)}
                    >
                      <Heart className="w-3 h-3" />{model.likes}
                    </button>
                    <span className="flex items-center gap-0.5"><Download className="w-3 h-3" />{model.downloads}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{model.commentCount ?? 0}</span>
                    {(model.forkCount ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-purple-400"><GitFork className="w-3 h-3" />{model.forkCount}</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Hover overlay */}
              <div className="absolute top-0 left-0 right-0 aspect-[4/3] flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <div className="flex items-center gap-2 text-sm text-white">
                  <MessageCircle className="w-4 h-4 text-[#C6E36C]" /> {t("explore.viewDetails")}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center justify-center text-gray-500">
          <Search className="w-12 h-12 mb-4 opacity-20" />
          <p className="text-lg font-medium">{t("explore.noResults")}</p>
          <p className="text-sm">{t("explore.noResultsHint")}</p>
        </div>
      )}

      {/* Load more */}
      {!loading && models.length > 0 && models.length < total && (
        <div className="flex justify-center mt-10">
          <button
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-[rgba(168,187,238,0.15)] text-sm text-gray-400 hover:border-[#C6E36C]/40 hover:text-[#C6E36C] disabled:opacity-50 transition-all"
          >
            {loadingMore ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            {loadingMore ? "Cargando..." : `Cargar más (${models.length} de ${total})`}
          </button>
        </div>
      )}

      <style>{`
        @keyframes vsCardIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
