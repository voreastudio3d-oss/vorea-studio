/**
 * UserPublic – Public profile showing a community user and their published models.
 * Route: /user/:userId/modelos
 * Powered by the Community API (PostgreSQL KV).
 */
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "../nav";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useI18n } from "../services/i18n-context";
import { CommunityApi, type CommunityModelResponse } from "../services/api-client";
import {
  ArrowLeft,
  Heart,
  Download,
  MessageCircle,
  User,
  Crown,
  Loader2,
  Trophy,
  Star,
  Sparkles,
} from "lucide-react";

// Badge key → i18n key mapping
const BADGE_ICONS: Record<string, string> = {
  first_model: "🎉",
  ten_models: "🔟",
  hundred_likes: "💯",
  thousand_downloads: "🚀",
  contributor_impulsor: "🤝",
  contributor_aliado: "🌿",
  contributor_patrono: "💎",
  contributor_mecenas: "👑",
};
const BADGE_I18N_KEYS: Record<string, string> = {
  first_model: "userPublic.badge.firstModel",
  ten_models: "userPublic.badge.tenModels",
  hundred_likes: "userPublic.badge.hundredLikes",
  thousand_downloads: "userPublic.badge.thousandDownloads",
  contributor_impulsor: "userPublic.badge.contributorImpulsor",
  contributor_aliado: "userPublic.badge.contributorAliado",
  contributor_patrono: "userPublic.badge.contributorPatrono",
  contributor_mecenas: "userPublic.badge.contributorMecenas",
};

export function UserPublic() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();

  // Extract user ID from path: /user/:userId or /user/:userId/modelos
  const parts = pathname.split("/").filter(Boolean);
  const userId = parts[1] ?? "";

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<{
    user: { id: string; displayName: string; username: string; avatarUrl: string | null; tier: string; createdAt: string };
    stats: { totalModels: number; totalLikes: number; totalDownloads: number };
    rewards: { points: number; level: string; badges: string[] };
    models: CommunityModelResponse[];
  } | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    CommunityApi.getUserProfile(userId)
      .then(setUserData)
      .catch(() => setUserData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#C6E36C]/50" />
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-5xl mx-auto w-full">
        <Button variant="secondary" size="sm" className="gap-2 mb-6" onClick={() => navigate("/community")}>
          <ArrowLeft className="w-4 h-4" /> {t("userPublic.backToCommunity")}
        </Button>
        <div className="text-center py-20">
          <p className="text-gray-400">{t("userPublic.notFound")}</p>
        </div>
      </div>
    );
  }

  const { user, stats, rewards, models } = userData;

  // Level color mapping
  const levelColors: Record<string, string> = {
    Master: "#FFD700",
    Expert: "#C6E36C",
    Creator: "#60A5FA",
    Maker: "#A78BFA",
    Novice: "#6B7280",
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Profile Header */}
      <div className="border-b border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.3)] relative">
        <div
          className="h-40 w-full relative overflow-hidden"
          style={{ background: "linear-gradient(90deg, #1a1f36 0%, #0d1117 50%, #1a1f36 100%)" }}
        >
          <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(ellipse at center, #C6E36C 0%, transparent 70%)" }} />
        </div>

        <div className="max-w-5xl mx-auto px-6 pb-8 relative -mt-16">
          <div className="flex items-end gap-5 mb-6">
            <div className="w-28 h-28 rounded-2xl p-1 shadow-xl" style={{ background: "linear-gradient(135deg, #C6E36C, #3b82f6)" }}>
              <div className="w-full h-full rounded-[14px] bg-[#1a1f36] flex items-center justify-center overflow-hidden">
                <User className="w-10 h-10 text-gray-500" />
              </div>
            </div>
            <div className="pb-2">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold" style={{ animation: "vsHeroIn 0.5s cubic-bezier(.22,1,.36,1) both" }}>
                  {user.displayName}
                </h1>
                {/* Reward Level Badge */}
                <Badge className="text-[10px] border" style={{ backgroundColor: `${levelColors[rewards.level] || "#6B7280"}20`, color: levelColors[rewards.level] || "#6B7280", borderColor: `${levelColors[rewards.level] || "#6B7280"}40` }}>
                  <Trophy className="w-3 h-3 mr-1" />
                  {rewards.level}
                </Badge>
              </div>
              <p className="text-gray-400">{user.username}</p>
            </div>
          </div>

          <Button variant="secondary" size="sm" className="gap-2" onClick={() => navigate("/community")}>
            <ArrowLeft className="w-4 h-4" /> {t("userPublic.backToCommunity")}
          </Button>

          {/* Stats + Rewards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6 p-6 glass rounded-2xl border border-[rgba(168,187,238,0.12)]" style={{ animation: "vsHeroIn 0.5s cubic-bezier(.22,1,.36,1) 0.05s both" }}>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t("userPublic.stats.models")}</p>
              <p className="text-2xl font-bold font-mono">{stats.totalModels}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t("userPublic.stats.likes")}</p>
              <p className="text-2xl font-bold font-mono">{stats.totalLikes.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t("userPublic.stats.downloads")}</p>
              <p className="text-2xl font-bold font-mono">{stats.totalDownloads.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t("userPublic.stats.points")}</p>
              <p className="text-2xl font-bold font-mono" style={{ color: levelColors[rewards.level] }}>
                <Star className="w-4 h-4 inline mr-1" />{rewards.points.toLocaleString()}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t("userPublic.stats.badges")}</p>
              <div className="flex flex-wrap gap-1.5">
                {rewards.badges.length > 0 ? rewards.badges.map((b) => (
                  <span key={b} className="text-[10px] px-2 py-0.5 rounded-full bg-[#C6E36C]/10 text-[#C6E36C] border border-[#C6E36C]/20">
                    {BADGE_ICONS[b] || "🏆"} {t(BADGE_I18N_KEYS[b] || b)}
                  </span>
                )) : (
                  <span className="text-[10px] text-gray-600">{t("userPublic.noBadges")}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Models Grid */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-xl font-bold mb-6">{t("userPublic.publishedModels", { count: String(models.length) })}</h2>

        {models.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {models.map((model, i) => (
              <div
                key={model.id}
                className="group relative rounded-xl overflow-hidden glass border border-[rgba(168,187,238,0.12)] hover:border-[#C6E36C]/40 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                onClick={() => navigate(`/model/${model.id}`)}
                style={{ animation: `vsCardIn 0.4s cubic-bezier(.22,1,.36,1) ${i * 0.06}s both` }}
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
                  {model.featured && (
                    <Badge className="absolute top-3 left-3 bg-[#C6E36C]/20 text-[#C6E36C] border-[#C6E36C]/30 backdrop-blur">
                      <Crown className="w-3 h-3 mr-1" /> {t("userPublic.featured")}
                    </Badge>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-[#C6E36C] transition-colors line-clamp-1">{model.title}</h3>
                  <div className="flex gap-2 mb-2">
                    {model.tags.slice(0, 2).map((t) => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1f36] text-gray-500 border border-[rgba(168,187,238,0.08)]">{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{model.likes.toLocaleString()}</span>
                    <span className="flex items-center gap-0.5"><Download className="w-3 h-3" />{model.downloads.toLocaleString()}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{model.commentCount ?? 0}</span>
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <MessageCircle className="w-4 h-4 text-[#C6E36C]" /> {t("userPublic.viewDetails")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-gray-500">
            <p>{t("userPublic.noModels")}</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes vsHeroIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vsCardIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
