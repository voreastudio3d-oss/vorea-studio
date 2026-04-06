/**
 * ModelDetail – Shows a single community model's details.
 * Route: /model/:id
 * Handles both parametric (SCAD → Studio) and relief (→ Relief editor) model types.
 * Powered by the Community API (PostgreSQL KV).
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate, Link } from "../nav";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { AuthDialog } from "../components/AuthDialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "../components/ui/carousel";
import { useAuth } from "../services/auth-context";
import { useI18n } from "../services/i18n-context";
import { requireLoggedInInteraction } from "../services/protected-auth-interactions";
import { buildCommunityEditorRoute } from "../services/community-edit-routing";
import { CommunityApi, type CommunityModelResponse } from "../services/api-client";
import { toast } from "sonner";
import {
  ArrowLeft,
  Heart,
  Download,
  ExternalLink,
  User,
  Tag,
  Code2,
  Play,
  Loader2,
  Mountain,
  GitFork,
  MessageCircle,
  Send,
  Trash2,
} from "lucide-react";

export function ModelDetail() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const { t } = useI18n();

  const modelId = pathname.split("/").filter(Boolean)[1] ?? "";
  const [model, setModel] = useState<CommunityModelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (!modelId) return;
    setLoading(true);
    setSelectedMediaIndex(0);
    setComments([]);
    CommunityApi.getModel(modelId)
      .then(setModel)
      .catch(() => setModel(null))
      .finally(() => setLoading(false));

    // Load comments
    CommunityApi.getComments(modelId)
      .then((items) => {
        const sorted = [...items].sort((a, b) => {
          const ta = new Date(a.createdAt || 0).getTime();
          const tb = new Date(b.createdAt || 0).getTime();
          return ta - tb;
        });
        setComments(sorted);
      })
      .catch(() => setComments([]));
  }, [modelId]);

  const isRelief = model?.modelType === "relief";
  const isOwner = !!model && !!user?.id && model.authorId === user.id;
  const mediaItems = useMemo(() => {
    if (model?.media && model.media.length > 0) {
      return [...model.media].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    if (model?.thumbnailUrl) {
      return [{ url: model.thumbnailUrl, isCover: true }];
    }
    return [];
  }, [model]);

  useEffect(() => {
    if (!carouselApi) return;
    const syncSelected = () => setSelectedMediaIndex(carouselApi.selectedScrollSnap());
    syncSelected();
    carouselApi.on("select", syncSelected);
    carouselApi.on("reInit", syncSelected);
    return () => {
      carouselApi.off("select", syncSelected);
      carouselApi.off("reInit", syncSelected);
    };
  }, [carouselApi]);

  useEffect(() => {
    setSelectedMediaIndex(0);
    carouselApi?.scrollTo(0, true);
  }, [carouselApi, modelId, mediaItems.length]);

  // ─── Open in appropriate editor ──────────────────────────────────────────
  const handleOpen = useCallback(() => {
    if (!model) return;
    if (!requireLoggedInInteraction({
      isLoggedIn,
      onAuthRequired: () => setAuthOpen(true),
      authMessage: "Inicia sesión para abrir este modelo.",
    })) {
      return;
    }
    navigate(buildCommunityEditorRoute(model, isOwner ? "edit" : "fork"));
    toast.success(t("model.loadedInEditor", { title: model.title }));
  }, [isLoggedIn, isOwner, model, navigate, t]);

  const handleLike = useCallback(async () => {
    if (!model) return;
    if (!requireLoggedInInteraction({
      isLoggedIn,
      onAuthRequired: () => setAuthOpen(true),
      authMessage: t("model.loginToLike"),
    })) { return; }
    try {
      const { liked, likes } = await CommunityApi.toggleLike(model.id);
      setModel((prev) => prev ? { ...prev, likes } : prev);
      toast.success(liked ? t("model.likeAdded") : t("model.likeRemoved"));
    } catch { toast.error(t("model.likeError")); }
  }, [model, isLoggedIn, t]);

  const handleAddComment = useCallback(async () => {
    if (!model || !commentText.trim()) return;
    if (!requireLoggedInInteraction({
      isLoggedIn,
      onAuthRequired: () => setAuthOpen(true),
      authMessage: t("model.loginToComment"),
    })) { return; }
    setSubmittingComment(true);
    try {
      const result = await CommunityApi.addComment(model.id, commentText.trim());
      setComments((prev) => [...prev, result.comment]);
      setCommentText("");
      toast.success(t("model.commentAdded"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmittingComment(false);
    }
  }, [model, commentText, isLoggedIn, t]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!model) return;
    try {
      await CommunityApi.deleteComment(model.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success(t("model.commentDeleted"));
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [model, t]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C6E36C]/50" />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-5xl mx-auto w-full">
        <Button variant="secondary" size="sm" className="gap-2 mb-6" onClick={() => navigate("/community")}>
          <ArrowLeft className="w-4 h-4" /> {t("model.backToCommunityLong")}
        </Button>
        <div className="text-center py-20">
          <p className="text-gray-400">{t("model.notFound")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Hero with gallery */}
      <div className="relative h-72 md:h-[30rem] overflow-hidden">
        {mediaItems.length > 0 ? (
          <Carousel setApi={setCarouselApi} opts={{ loop: mediaItems.length > 1 }} className="h-full">
            <CarouselContent className="ml-0 h-full">
              {mediaItems.map((item, index) => (
                <CarouselItem key={`${item.id || item.url}-${index}`} className="pl-0">
                  <div className="relative h-72 md:h-[30rem]">
                    <img src={item.url} alt={`${model.title} ${index + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(198,227,108,0.14),transparent_40%)]" />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {mediaItems.length > 1 && (
              <>
                <CarouselPrevious className="left-4 top-1/2 z-20 -translate-y-1/2 border border-white/10 bg-[#0d1117]/70 text-white hover:bg-[#0d1117]/85 disabled:opacity-40" />
                <CarouselNext className="right-4 top-1/2 z-20 -translate-y-1/2 border border-white/10 bg-[#0d1117]/70 text-white hover:bg-[#0d1117]/85 disabled:opacity-40" />
              </>
            )}
          </Carousel>
        ) : (
          <div className="w-full h-full bg-[#121620]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/60 to-transparent" />
        <div className="absolute top-6 left-6 z-20">
          <Button variant="secondary" size="sm" className="gap-2 backdrop-blur-md bg-[#0d1117]/60" onClick={() => navigate("/community")}>
            <ArrowLeft className="w-4 h-4" /> {t("model.backToCommunity")}
          </Button>
        </div>
        {/* Badges: featured + model type */}
        <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
          {isRelief && (
            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/25 backdrop-blur">
              <Mountain className="w-3 h-3 mr-1" /> {t("model.reliefBadge") || "Relieve"}
            </Badge>
          )}
          {model.featured && (
            <Badge className="bg-[#C6E36C]/20 text-[#C6E36C] border-[#C6E36C]/30 backdrop-blur">
              {t("model.featured")}
            </Badge>
          )}
        </div>
        {mediaItems.length > 1 && (
          <div className="absolute bottom-5 right-6 z-20 rounded-full border border-white/10 bg-[#0d1117]/70 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
            {selectedMediaIndex + 1}/{mediaItems.length}
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-12 -mt-16 relative z-10">
        {/* Title + meta */}
        <div className="mb-8" style={{ animation: "vsHeroIn 0.5s cubic-bezier(.22,1,.36,1) both" }}>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{model.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Link
              to={`/user/${model.authorId}/modelos`}
              className="flex items-center gap-2 text-gray-300 hover:text-[#C6E36C] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] flex items-center justify-center">
                <User className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <span className="font-medium">{model.authorName}</span>
                <span className="text-gray-500 ml-1.5">{model.authorUsername}</span>
              </div>
            </Link>

            {/* Fork info */}
            {model.forkedFromId && (
              <Link
                to={`/model/${model.forkedFromId}`}
                className="flex items-center gap-1.5 text-gray-500 hover:text-purple-400 transition-colors text-xs"
              >
                <GitFork className="w-3.5 h-3.5" />
                Fork de {model.forkedFromAuthor || model.forkedFromTitle}
              </Link>
            )}

            <div className="flex items-center gap-4 ml-auto">
              <button className="flex items-center gap-1.5 text-gray-400 hover:text-red-400 transition-colors" onClick={handleLike}>
                <Heart className="w-4 h-4" />
                <span className="font-medium">{model.likes.toLocaleString()}</span>
              </button>
              <div className="flex items-center gap-1.5 text-gray-400">
                <Download className="w-4 h-4" />
                <span className="font-medium">{model.downloads.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400">
                <MessageCircle className="w-4 h-4" />
                <span className="font-medium">{comments.length}</span>
              </div>
              {(model.forkCount ?? 0) > 0 && (
                <div className="flex items-center gap-1.5 text-purple-400">
                  <GitFork className="w-4 h-4" />
                  <span className="font-medium">{model.forkCount}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-8" style={{ animation: "vsHeroIn 0.5s cubic-bezier(.22,1,.36,1) 0.05s both" }}>
          {model.tags.map((tag) => (
            <Badge key={tag} className="bg-[#1a1f36] text-gray-400 border border-[rgba(168,187,238,0.12)]">
              <Tag className="w-3 h-3 mr-1 text-gray-600" />{tag}
            </Badge>
          ))}
        </div>

        {mediaItems.length > 1 && (
          <div
            className="rounded-2xl border border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.4)] p-4 mb-8"
            style={{ animation: "vsHeroIn 0.5s cubic-bezier(.22,1,.36,1) 0.08s both" }}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">{t("publish.gallery")}</p>
              <p className="text-xs text-gray-600">{mediaItems.length}</p>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {mediaItems.map((item, index) => (
                <button
                  key={`${item.id || item.url}-thumb-${index}`}
                  type="button"
                  className={`group relative shrink-0 overflow-hidden rounded-xl border transition-all ${index === selectedMediaIndex
                    ? "border-[#C6E36C]/60 shadow-[0_0_0_1px_rgba(198,227,108,0.2)]"
                    : "border-[rgba(168,187,238,0.12)] hover:border-[rgba(198,227,108,0.35)]"
                    }`}
                  onClick={() => carouselApi?.scrollTo(index)}
                >
                  <img src={item.url} alt="" className="h-20 w-28 object-cover transition-transform duration-300 group-hover:scale-105" />
                  {item.isCover && (
                    <span className="absolute left-2 top-2 rounded-full bg-[#C6E36C] px-2 py-0.5 text-[9px] font-semibold text-black">
                      {t("publish.coverLabel")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons — adapt to model type */}
        <div className="flex flex-wrap gap-3 mb-10" style={{ animation: "vsHeroIn 0.5s cubic-bezier(.22,1,.36,1) 0.1s both" }}>
          <Button size="lg" className="gap-2" onClick={handleOpen}>
            {isRelief ? (
              <><Mountain className="w-5 h-5" /> {t("model.openInRelief") || "Abrir en Relieve"}</>
            ) : (
              <><Play className="w-5 h-5" /> {t("model.openInEditor")}</>
            )}
          </Button>
        </div>

        {/* Description */}
        {(model as any).description && (
          <div
            className="rounded-2xl border border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.4)] p-6 mb-8"
            style={{ animation: "vsHeroIn 0.5s cubic-bezier(.22,1,.36,1) 0.12s both" }}
          >
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">{t("model.description")}</h2>
            <p className="text-gray-400 leading-relaxed whitespace-pre-wrap">{(model as any).description}</p>
          </div>
        )}

        {/* SCAD Preview — only for parametric models */}
        {!isRelief && model.scadSource && (
          <div className="rounded-2xl border border-[rgba(168,187,238,0.12)] overflow-hidden mb-8" style={{ animation: "vsHeroIn 0.5s cubic-bezier(.22,1,.36,1) 0.15s both" }}>
            <div className="flex items-center justify-between px-5 py-3 bg-[rgba(26,31,54,0.6)] border-b border-[rgba(168,187,238,0.08)]">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Code2 className="w-4 h-4" /> {t("model.scadCode")}
              </div>
              <Button variant="secondary" size="sm" className="gap-1.5 text-xs" onClick={handleOpen}>
                <ExternalLink className="w-3.5 h-3.5" /> {t("model.openInEditor")}
              </Button>
            </div>
            <pre className="p-5 text-sm text-gray-300 font-mono overflow-x-auto leading-relaxed bg-[#0a0e17]">
              <code>{model.scadSource}</code>
            </pre>
          </div>
        )}

        {/* Relief info — only for relief models */}
        {isRelief && model.reliefConfig && (
          <div className="rounded-2xl border border-amber-500/15 overflow-hidden mb-8" style={{ animation: "vsHeroIn 0.5s cubic-bezier(.22,1,.36,1) 0.15s both" }}>
            <div className="flex items-center justify-between px-5 py-3 bg-amber-500/5 border-b border-amber-500/10">
              <div className="flex items-center gap-2 text-sm text-amber-300/70">
                <Mountain className="w-4 h-4" /> {t("model.reliefConfig") || "Configuración de Relieve"}
              </div>
              <Button variant="secondary" size="sm" className="gap-1.5 text-xs border-amber-500/20 text-amber-300 hover:bg-amber-500/10" onClick={handleOpen}>
                <ExternalLink className="w-3.5 h-3.5" /> {t("model.openInRelief") || "Abrir en Relieve"}
              </Button>
            </div>
            <div className="p-5 bg-[#0a0e17] grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {model.reliefConfig.imageData && (
                <div className="col-span-2 md:col-span-4">
                  <img
                    src={model.reliefConfig.imageData}
                    alt="Relief source"
                    className="w-full max-h-48 object-contain rounded-lg border border-amber-500/10"
                  />
                </div>
              )}
              <div>
                <span className="text-gray-600 text-[10px] uppercase tracking-wide block mb-1">Subdivisiones</span>
                <span className="text-gray-300 font-mono">{model.reliefConfig.subdivisions ?? "—"}</span>
              </div>
              <div>
                <span className="text-gray-600 text-[10px] uppercase tracking-wide block mb-1">Altura</span>
                <span className="text-gray-300 font-mono">{model.reliefConfig.maxHeight ?? "—"}</span>
              </div>
              <div>
                <span className="text-gray-600 text-[10px] uppercase tracking-wide block mb-1">Placa</span>
                <span className="text-gray-300 font-mono">{model.reliefConfig.plateWidth ?? "—"}×{model.reliefConfig.plateDepth ?? "—"}</span>
              </div>
              <div>
                <span className="text-gray-600 text-[10px] uppercase tracking-wide block mb-1">Espesor</span>
                <span className="text-gray-300 font-mono">{model.reliefConfig.baseThickness ?? "—"}</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── Comments Section ──────────────────────────────────────────────── */}
        <div
          className="rounded-2xl border border-[rgba(168,187,238,0.12)] overflow-hidden"
          style={{ animation: "vsHeroIn 0.5s cubic-bezier(.22,1,.36,1) 0.2s both" }}
        >
          <div className="flex items-center justify-between px-5 py-3 bg-[rgba(26,31,54,0.6)] border-b border-[rgba(168,187,238,0.08)]">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <MessageCircle className="w-4 h-4" /> {t("model.comments")}
              <span className="text-gray-600">({comments.length})</span>
            </div>
          </div>

          <div className="bg-[#0a0e17]">
            {/* Comment form */}
            {isLoggedIn ? (
              <div className="p-4 border-b border-[rgba(168,187,238,0.06)]">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <textarea
                      className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 resize-none focus:outline-none focus:border-[#C6E36C]/30 transition-colors"
                      placeholder={t("model.commentPlaceholder")}
                      rows={2}
                      maxLength={1000}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddComment();
                      }}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-gray-600">{commentText.length}/1000</span>
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs"
                        disabled={!commentText.trim() || submittingComment}
                        onClick={handleAddComment}
                      >
                        {submittingComment ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        {t("model.addComment")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 flex flex-col items-center gap-3 text-center text-sm text-gray-500 border-b border-[rgba(168,187,238,0.06)]">
                <span>{t("model.loginToComment")}</span>
                <Button size="sm" variant="secondary" onClick={() => setAuthOpen(true)}>
                  {t("profile.loginButton")}
                </Button>
              </div>
            )}

            {/* Comment list */}
            {comments.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-600">
                {t("model.noComments")}
              </div>
            ) : (
              <div className="divide-y divide-[rgba(168,187,238,0.06)]">
                {comments.map((comment) => (
                  <div key={comment.id} className="p-4 flex gap-3 hover:bg-[rgba(26,31,54,0.3)] transition-colors">
                    <div className="w-8 h-8 rounded-full bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {comment.avatarUrl ? (
                        <img src={comment.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-300">{comment.displayName}</span>
                        <span className="text-[10px] text-gray-600">{comment.username}</span>
                        <span className="text-[10px] text-gray-700 ml-auto">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                        {/* Delete button: own comment or admin */}
                        {user && (user.id === comment.userId || (user as any).role === "superadmin") && (
                          <button
                            className="text-gray-700 hover:text-red-400 transition-colors ml-1"
                            onClick={() => handleDeleteComment(comment.id)}
                            title={t("model.deleteComment")}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 whitespace-pre-wrap break-words">{comment.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes vsHeroIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
