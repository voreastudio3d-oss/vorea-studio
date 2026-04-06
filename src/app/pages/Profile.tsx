import { useState, useEffect, useCallback } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useNavigate } from "../nav";
import { useUserProfile } from "../services/hooks";
import { useAuth } from "../services/auth-context";
import { getToolCredits } from "../services/business-config";
import { buildCommunityEditorRoute } from "../services/community-edit-routing";
import { RewardsApi, ToolCreditsApi, CommunityApi, ActivityApi, SubscriptionsApi, AuthApi, type CommunityModelResponse } from "../services/api-client";
import { PayPalService } from "../services/paypal";
import { AuthDialog } from "../components/AuthDialog";
import { VaultUI } from "../components/VaultUI";
import { SubscriptionSuccessModal } from "../components/SubscriptionSuccessModal";
import { useI18n } from "../services/i18n-context";
import type { MembershipTier } from "../services/types";
import {
  formatActivityAge,
  getActivityLabel,
  getActivityTimestamp,
  PROFILE_ACTIVITY_ICONS,
} from "../profile-activity";
import { toast } from "sonner";
import { trackAnalyticsEvent } from "../services/analytics";
import {
  User,
  Box,
  Heart,
  Download,
  Settings,
  Edit3,
  Copy,
  Trash2,
  Check,
  X,
  Crown,
  LogIn,
  Trophy,
  Star,
  Zap,
  GitFork,
  Mountain,
  Globe,
  EyeOff,
  Coins,
  History,
  MessageCircle,
  Lock,
} from "lucide-react";

const BADGE_ICONS: Record<string, string> = {
  first_model: "🎉",
  ten_models: "🔟",
  hundred_likes: "💯",
  thousand_downloads: "🚀",
  forked_5: "🍴",
  forked_25: "🌟",
  forked_100: "👑",
  contributor_impulsor: "🤝",
  contributor_aliado: "🌿",
  contributor_patrono: "💎",
  contributor_mecenas: "👑",
};
const BADGE_KEYS: Record<string, string> = {
  first_model: "profile.badge.firstModel",
  ten_models: "profile.badge.tenModels",
  hundred_likes: "profile.badge.hundredLikes",
  thousand_downloads: "profile.badge.thousandDownloads",
  forked_5: "profile.badge.forked5",
  forked_25: "profile.badge.forked25",
  forked_100: "profile.badge.forked100",
  contributor_impulsor: "profile.badge.contributorImpulsor",
  contributor_aliado: "profile.badge.contributorAliado",
  contributor_patrono: "profile.badge.contributorPatrono",
  contributor_mecenas: "profile.badge.contributorMecenas",
};

type EditableBillingProfile = {
  fullName: string;
  companyName: string;
  taxId: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
};

const LEVEL_THRESHOLDS = [
  { level: "Novice", min: 0, max: 99, color: "#6B7280" },
  { level: "Maker", min: 100, max: 499, color: "#A78BFA" },
  { level: "Creator", min: 500, max: 1999, color: "#60A5FA" },
  { level: "Expert", min: 2000, max: 4999, color: "#C6E36C" },
  { level: "Master", min: 5000, max: Infinity, color: "#FFD700" },
];

// ─── Activity History Helper ─────────────────────────────────────────────────
function CreditActivityHistory() {
  const { t } = useI18n();
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ActivityApi.getMyActivity(30)
      .then(setActivity)
      .catch(() => setActivity([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mt-4 p-6 glass rounded-2xl border border-[rgba(168,187,238,0.12)]">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-[#C6E36C]" />
        <h3 className="text-lg font-semibold">{t("profile.activity.title")}</h3>
        <span className="text-xs text-gray-600 ml-auto">{t("profile.activity.recent")}</span>
      </div>

      {loading ? (
        <div className="text-center py-6 text-gray-500 text-sm">...</div>
      ) : activity.length === 0 ? (
        <div className="text-center py-6 text-gray-600 text-sm">{t("profile.activity.empty")}</div>
      ) : (
        <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
          {activity.map((item, i) => (
            <div
              key={item.id || i}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[rgba(26,31,54,0.5)] transition-colors text-sm"
            >
              <span className="text-base flex-shrink-0">{PROFILE_ACTIVITY_ICONS[item.action] || "📌"}</span>
              <span className="text-gray-300 flex-1 truncate">
                {getActivityLabel(item.action)}
                {item.metadata?.modelTitle && (
                  <span className="text-gray-600 ml-1">— {item.metadata.modelTitle}</span>
                )}
              </span>
              {item.metadata?.credits && (
                <span className="text-[10px] text-amber-400 font-mono flex-shrink-0">
                  {item.metadata.credits > 0 ? `+${item.metadata.credits}` : item.metadata.credits} cr
                </span>
              )}
              <span className="text-[10px] text-gray-700 flex-shrink-0 w-8 text-right">
                {formatActivityAge(getActivityTimestamp(item))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Profile() {
  const navigate = useNavigate();
  const { isLoggedIn, loading, user: authUser, creditBalance, refreshCredits, refreshUser } = useAuth();
  const { user, updateUser } = useUserProfile();
  const { t } = useI18n();
  const profileSource = authUser ?? user;

  const [communityModels, setCommunityModels] = useState<CommunityModelResponse[]>([]);
  const [communityStats, setCommunityStats] = useState({ totalModels: 0, totalLikes: 0, totalDownloads: 0 });
  const [loadingModels, setLoadingModels] = useState(false);
  const [profileTab, setProfileTab] = useState<"published" | "draft" | "keys">("published");

  const [editingProfile, setEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: "", newPassword: "" });
  const [editName, setEditName] = useState(profileSource.displayName);
  const [editUsername, setEditUsername] = useState(profileSource.username);
  const [editPhone, setEditPhone] = useState(profileSource.phone || "");
  const [editCountryCode, setEditCountryCode] = useState(profileSource.countryCode || "");
  const [editDefaultLocale, setEditDefaultLocale] = useState(profileSource.defaultLocale || "es");
  const [editBilling, setEditBilling] = useState<EditableBillingProfile>({
    fullName: profileSource.billingProfile?.fullName || "",
    companyName: profileSource.billingProfile?.companyName || "",
    taxId: profileSource.billingProfile?.taxId || "",
    addressLine1: profileSource.billingProfile?.addressLine1 || "",
    addressLine2: profileSource.billingProfile?.addressLine2 || "",
    city: profileSource.billingProfile?.city || "",
    state: profileSource.billingProfile?.state || "",
    postalCode: profileSource.billingProfile?.postalCode || "",
    countryCode: profileSource.billingProfile?.countryCode || "",
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [rewards, setRewards] = useState<{ points?: number; xp?: number; level: string; badges: string[]; history: any[] } | null>(null);
  const [activeSub, setActiveSub] = useState<any>(null);
  const [showSubSuccess, setShowSubSuccess] = useState(false);
  const [subSuccessTier, setSubSuccessTier] = useState<string>("");
  const [toolCreditSnapshot, setToolCreditSnapshot] = useState<Awaited<ReturnType<typeof ToolCreditsApi.getMine>> | null>(null);
  const [monthlyCreditsByTier, setMonthlyCreditsByTier] = useState<Record<MembershipTier, number>>({
    FREE: 6,
    PRO: 200,
    "STUDIO PRO": 500,
  });

  const refreshToolCreditSnapshot = useCallback(async () => {
    if (!isLoggedIn) {
      setToolCreditSnapshot(null);
      return;
    }
    try {
      const snapshot = await ToolCreditsApi.getMine();
      setToolCreditSnapshot(snapshot);
    } catch {
      setToolCreditSnapshot(null);
    }
  }, [isLoggedIn]);

  // Detect PayPal return (?sub=success/cancelled or ?credits=success/cancelled)
  // PayPal may place query params in window.location.search OR inside the hash fragment
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const hashQIdx = hash.indexOf("?");
    const hashParams = hashQIdx >= 0 ? new URLSearchParams(hash.slice(hashQIdx)) : new URLSearchParams();
    const cleanProfilePath = "/profile";

    const subValue = searchParams.get("sub") || hashParams.get("sub");

    if (subValue === "success") {
      setShowSubSuccess(true);
      setSubSuccessTier(authUser?.tier || "PRO");
      trackAnalyticsEvent("subscription_success", { tier: authUser?.tier || "PRO" });
      window.history.replaceState(null, "", cleanProfilePath);
    } else if (subValue === "cancelled") {
      toast("Suscripción cancelada. No se realizó ningún cargo.", { icon: "ℹ️" });
      window.history.replaceState(null, "", cleanProfilePath);
    }

    // Handle credit pack return from PayPal
    const creditsValue = searchParams.get("credits") || hashParams.get("credits");
    if (creditsValue === "success") {
      const stored = sessionStorage.getItem("vorea_credit_order");
      if (stored) {
        sessionStorage.removeItem("vorea_credit_order");
        (async () => {
          try {
            const { orderId, packId } = JSON.parse(stored);
            const result = await PayPalService.captureOrder(orderId, packId);
            if (result.success) {
              toast.success(`¡${result.credits} créditos agregados al saldo universal!`, { description: result.message });
              trackAnalyticsEvent("credit_purchase_success", { credits: String(result.credits), packId });
              refreshCredits?.();
              refreshToolCreditSnapshot();
            }
          } catch (captureErr: any) {
            if (!captureErr.message?.includes("ya fue procesada")) {
              console.log("PayPal credit capture:", captureErr.message);
            }
          }
        })();
      }
      window.history.replaceState(null, "", cleanProfilePath);
    } else if (creditsValue === "cancelled") {
      sessionStorage.removeItem("vorea_credit_order");
      toast("Compra de créditos cancelada. No se realizó ningún cargo.", { icon: "ℹ️" });
      window.history.replaceState(null, "", cleanProfilePath);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      trackAnalyticsEvent("page_view", { page: "profile", tier: authUser?.tier || "FREE" });
      RewardsApi.getMyRewards().then(setRewards).catch(() => { });
      SubscriptionsApi.getMySubscription()
        .then((subscription) => setActiveSub(subscription))
        .catch(() => setActiveSub(null));
      refreshToolCreditSnapshot();
      return;
    }
    setToolCreditSnapshot(null);
  }, [isLoggedIn, authUser?.tier, refreshToolCreditSnapshot]);

  useEffect(() => {
    getToolCredits()
      .then((cfg) => {
        if (cfg?.monthlyCredits) {
          setMonthlyCreditsByTier((prev) => ({ ...prev, ...cfg.monthlyCredits }));
        }
      })
      .catch(() => { });
  }, []);

  // Fetch community models for current user (including drafts)
  useEffect(() => {
    if (isLoggedIn && authUser?.id) {
      setLoadingModels(true);
      CommunityApi.listModels({ authorId: authUser.id, status: "all", limit: 50 })
        .then((data) => {
          const models = data.models || [];
          setCommunityModels(models);
          const published = models.filter((m: CommunityModelResponse) => m.status === "published");
          setCommunityStats({
            totalModels: published.length,
            totalLikes: published.reduce((sum: number, m: CommunityModelResponse) => sum + (m.likes || 0), 0),
            totalDownloads: published.reduce((sum: number, m: CommunityModelResponse) => sum + (m.downloads || 0), 0),
          });
        })
        .catch(() => { })
        .finally(() => setLoadingModels(false));
    }
  }, [isLoggedIn, authUser?.id]);

  useEffect(() => {
    setEditName(profileSource.displayName);
    setEditUsername(profileSource.username);
    setEditPhone(profileSource.phone || "");
    setEditCountryCode(profileSource.countryCode || "");
    setEditDefaultLocale(profileSource.defaultLocale || "es");
    setEditBilling({
      fullName: profileSource.billingProfile?.fullName || "",
      companyName: profileSource.billingProfile?.companyName || "",
      taxId: profileSource.billingProfile?.taxId || "",
      addressLine1: profileSource.billingProfile?.addressLine1 || "",
      addressLine2: profileSource.billingProfile?.addressLine2 || "",
      city: profileSource.billingProfile?.city || "",
      state: profileSource.billingProfile?.state || "",
      postalCode: profileSource.billingProfile?.postalCode || "",
      countryCode: profileSource.billingProfile?.countryCode || "",
    });
  }, [
    profileSource.displayName,
    profileSource.username,
    profileSource.phone,
    profileSource.countryCode,
    profileSource.defaultLocale,
    profileSource.billingProfile?.fullName,
    profileSource.billingProfile?.companyName,
    profileSource.billingProfile?.taxId,
    profileSource.billingProfile?.addressLine1,
    profileSource.billingProfile?.addressLine2,
    profileSource.billingProfile?.city,
    profileSource.billingProfile?.state,
    profileSource.billingProfile?.postalCode,
    profileSource.billingProfile?.countryCode,
  ]);

  const resetProfileEditor = useCallback(() => {
    setEditName(profileSource.displayName);
    setEditUsername(profileSource.username);
    setEditPhone(profileSource.phone || "");
    setEditCountryCode(profileSource.countryCode || "");
    setEditDefaultLocale(profileSource.defaultLocale || "es");
    setEditBilling({
      fullName: profileSource.billingProfile?.fullName || "",
      companyName: profileSource.billingProfile?.companyName || "",
      taxId: profileSource.billingProfile?.taxId || "",
      addressLine1: profileSource.billingProfile?.addressLine1 || "",
      addressLine2: profileSource.billingProfile?.addressLine2 || "",
      city: profileSource.billingProfile?.city || "",
      state: profileSource.billingProfile?.state || "",
      postalCode: profileSource.billingProfile?.postalCode || "",
      countryCode: profileSource.billingProfile?.countryCode || "",
    });
  }, [
    profileSource.billingProfile?.addressLine1,
    profileSource.billingProfile?.addressLine2,
    profileSource.billingProfile?.city,
    profileSource.billingProfile?.companyName,
    profileSource.billingProfile?.countryCode,
    profileSource.billingProfile?.fullName,
    profileSource.billingProfile?.postalCode,
    profileSource.billingProfile?.state,
    profileSource.billingProfile?.taxId,
    profileSource.countryCode,
    profileSource.defaultLocale,
    profileSource.displayName,
    profileSource.phone,
    profileSource.username,
  ]);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const updatedProfile = await AuthApi.updateProfile({
        displayName: editName,
        username: editUsername,
        phone: editPhone,
        countryCode: editCountryCode,
        defaultLocale: editDefaultLocale,
        billingProfile: editBilling,
      });
      updateUser(updatedProfile);
      await refreshUser();
      setEditingProfile(false);
      toast.success(t("profile.updateSuccess"));
    } catch (e: any) {
      toast.error(e.message || t("profile.updateError"));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    if (!passwordData.newPassword) {
      toast.error("Debes ingresar una nueva contraseña");
      return;
    }
    try {
      const { getStoredToken } = await import("../services/api-client");
      const res = await fetch("/api/auth/me/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getStoredToken() || ""}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.current,
          newPassword: passwordData.newPassword
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al actualizar contraseña");
      
      toast.success(json.message || "Contraseña actualizada exitosamente");
      setIsChangingPassword(false);
      setPasswordData({ current: "", newPassword: "" });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await CommunityApi.deleteModel(id);
      setCommunityModels((prev) => prev.filter((m) => m.id !== id));
      setConfirmDeleteId(null);
      toast.success(t("profile.deleteSuccess"));
    } catch (e: any) {
      toast.error(e.message || t("profile.deleteError"));
    }
  };

  const handleEdit = (model: CommunityModelResponse, mode: "original" | "copy" = "original") => {
    const intent = mode === "copy" ? "fork" : "edit";
    navigate(buildCommunityEditorRoute(model, intent));
    toast.success(
      mode === "copy"
        ? `"${model.title}" abierto como copia`
        : `"${model.title}" abierto para edición`
    );
  };

  const handleToggleVisibility = async (model: CommunityModelResponse) => {
    const newStatus = model.status === "published" ? "draft" : "published";
    try {
      await CommunityApi.updateModel(model.id, { status: newStatus });
      setCommunityModels((prev) =>
        prev.map((m) => (m.id === model.id ? { ...m, status: newStatus } : m))
      );
      toast.success(newStatus === "published" ? "Modelo publicado" : "Modelo pasado a privado");
    } catch (e: any) {
      toast.error(e.message || "Error al cambiar visibilidad");
    }
  };

  const formatNum = (n: number): string => {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return n.toString();
  };

  const currentTier = (authUser?.tier ?? "FREE") as MembershipTier;
  const monthlyAllocation = monthlyCreditsByTier[currentTier] ?? 0;
  const totalCreditBalance = toolCreditSnapshot?.balance ?? creditBalance;
  const monthlyAvailable = toolCreditSnapshot?.monthlyBalance ?? null;
  const topUpAvailable = toolCreditSnapshot?.topupBalance ?? null;

  if (loading) {
    return (
      <div className="flex-1 w-full">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <div className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8 md:p-10">
            <div className="h-8 w-56 rounded-lg bg-white/5 animate-pulse mb-6" />
            <div className="h-4 w-full rounded bg-white/5 animate-pulse mb-3" />
            <div className="h-4 w-4/5 rounded bg-white/5 animate-pulse mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
              <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
              <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex-1 overflow-y-auto w-full">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <div className="glass rounded-2xl border border-[rgba(168,187,238,0.12)] p-8 md:p-10 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#C6E36C]/10 border border-[#C6E36C]/20 flex items-center justify-center mb-5">
              <User className="w-7 h-7 text-[#C6E36C]" />
            </div>
            <h1 className="text-3xl font-bold mb-3">{t("profile.title")}</h1>
            <p className="text-gray-400 max-w-xl mx-auto mb-8">
              {t("profile.notLoggedIn")}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button className="gap-2" onClick={() => setAuthOpen(true)}>
                <LogIn className="w-4 h-4" />
                {t("profile.loginButton")}
              </Button>
              <Button variant="secondary" className="gap-2" onClick={() => navigate("/")}>
                {t("nav.home")}
              </Button>
            </div>
          </div>
        </div>

        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto w-full">
      {/* Profile Header */}
      <div className="border-b border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.3)] relative">
        {/* Banner */}
        <div
          className="h-40 w-full relative overflow-hidden"
          style={{
            background:
              "linear-gradient(90deg, #1a1f36 0%, #0d1117 50%, #1a1f36 100%)",
          }}
        >
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background:
                "radial-gradient(ellipse at center, #C6E36C 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="max-w-5xl mx-auto px-6 pb-8 relative -mt-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex items-end gap-5">
              <div
                className="w-32 h-32 rounded-2xl p-1 shadow-xl"
                style={{
                  background: "linear-gradient(135deg, #C6E36C, #3b82f6)",
                }}
              >
                <div className="w-full h-full rounded-[14px] bg-[#1a1f36] flex items-center justify-center overflow-hidden">
                  <User className="w-12 h-12 text-gray-500" />
                </div>
              </div>

              <div className="pb-2">
                {editingProfile ? (
                  <div className="flex flex-col gap-2">
                    <input
                      autoFocus
                      className="bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-1.5 text-xl text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <input
                      className="bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-1.5 text-sm text-gray-400 outline-none focus:border-[#C6E36C]/50 transition-colors"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1" onClick={handleSaveProfile} disabled={isSavingProfile}>
                        <Check className="w-3.5 h-3.5" /> {isSavingProfile ? t("profile.saving") : t("profile.saveChanges")}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-1"
                        disabled={isSavingProfile}
                        onClick={() => {
                          setEditingProfile(false);
                          resetProfileEditor();
                        }}
                      >
                        <X className="w-3.5 h-3.5" /> {t("profile.cancelEdit")}
                      </Button>
                    </div>
                  </div>
                ) : isChangingPassword ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-amber-500 max-w-sm mb-1">
                      Si te registraste con Google/OAuth, deja la contraseña actual en blanco para crear una nueva contraseña.
                    </p>
                    <input
                      type="password"
                      className="bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                      placeholder="Contraseña actual"
                      value={passwordData.current}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, current: e.target.value }))}
                    />
                    <input
                      type="password"
                      className="bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                      placeholder="Nueva contraseña"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1" onClick={handleSavePassword}>
                        <Check className="w-3.5 h-3.5" /> Guardar
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-1"
                        onClick={() => {
                          setIsChangingPassword(false);
                          setPasswordData({ current: "", newPassword: "" });
                        }}
                      >
                        <X className="w-3.5 h-3.5" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-1">
                      <h1 className="text-3xl font-bold">{profileSource.displayName}</h1>
                      <Badge
                        variant="tier"
                        className="bg-[#C6E36C]/20 text-[#C6E36C] border-[#C6E36C]/30 cursor-pointer"
                        onClick={() => navigate("/plans")}
                      >
                        <Crown className="w-3 h-3 mr-1" />
                        {profileSource.tier}
                      </Badge>
                    </div>
                    <p className="text-gray-400">{profileSource.username}</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3 pb-2">
              <Button
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setIsChangingPassword(false);
                  resetProfileEditor();
                  setEditingProfile(true);
                }}
              >
                <Settings className="w-4 h-4" />
                {t("profile.editProfile")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setEditingProfile(false);
                  setPasswordData({ current: "", newPassword: "" });
                  setIsChangingPassword(true);
                }}
              >
                <Lock className="w-4 h-4" />
                Contraseña
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 md:flex gap-6 md:gap-12 mt-10 p-6 glass rounded-2xl border border-[rgba(168,187,238,0.12)]">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t("profile.stats.models")}</p>
              <p className="text-2xl font-bold font-mono">{communityStats.totalModels}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t("profile.stats.likes")}</p>
              <p className="text-2xl font-bold font-mono">{formatNum(communityStats.totalLikes)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t("profile.stats.downloads")}</p>
              <p className="text-2xl font-bold font-mono">{formatNum(communityStats.totalDownloads)}</p>
            </div>
          </div>

          <div className="mt-4 p-6 glass rounded-2xl border border-[rgba(168,187,238,0.12)]">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold">{t("profile.global.title")}</h3>
                <p className="text-sm text-gray-500">{t("profile.global.subtitle")}</p>
              </div>
              <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/20">
                {profileSource.regionCode || t("profile.global.missing")}
              </Badge>
            </div>

            {editingProfile ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">{t("profile.global.contactTitle")}</p>
                  <input
                    className="w-full bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                    placeholder={t("profile.global.phone")}
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                  <input
                    className="w-full bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors uppercase"
                    placeholder={t("profile.global.country")}
                    value={editCountryCode}
                    onChange={(e) => setEditCountryCode(e.target.value.toUpperCase())}
                    maxLength={2}
                  />
                  <select
                    className="w-full bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                    value={editDefaultLocale}
                    onChange={(e) => setEditDefaultLocale(e.target.value)}
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                    <option value="pt">Português</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">{t("profile.global.billingTitle")}</p>
                  <input
                    className="w-full bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                    placeholder={t("profile.global.billingName")}
                    value={editBilling.fullName}
                    onChange={(e) => setEditBilling((prev) => ({ ...prev, fullName: e.target.value }))}
                  />
                  <input
                    className="w-full bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                    placeholder={t("profile.global.companyName")}
                    value={editBilling.companyName}
                    onChange={(e) => setEditBilling((prev) => ({ ...prev, companyName: e.target.value }))}
                  />
                  <input
                    className="w-full bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                    placeholder={t("profile.global.taxId")}
                    value={editBilling.taxId}
                    onChange={(e) => setEditBilling((prev) => ({ ...prev, taxId: e.target.value }))}
                  />
                  <input
                    className="w-full bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                    placeholder={t("profile.global.addressLine1")}
                    value={editBilling.addressLine1}
                    onChange={(e) => setEditBilling((prev) => ({ ...prev, addressLine1: e.target.value }))}
                  />
                  <input
                    className="w-full bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                    placeholder={t("profile.global.addressLine2")}
                    value={editBilling.addressLine2}
                    onChange={(e) => setEditBilling((prev) => ({ ...prev, addressLine2: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="w-full bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                      placeholder={t("profile.global.city")}
                      value={editBilling.city}
                      onChange={(e) => setEditBilling((prev) => ({ ...prev, city: e.target.value }))}
                    />
                    <input
                      className="w-full bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                      placeholder={t("profile.global.state")}
                      value={editBilling.state}
                      onChange={(e) => setEditBilling((prev) => ({ ...prev, state: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="w-full bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
                      placeholder={t("profile.global.postalCode")}
                      value={editBilling.postalCode}
                      onChange={(e) => setEditBilling((prev) => ({ ...prev, postalCode: e.target.value }))}
                    />
                    <input
                      className="w-full bg-[#1a1f36] border border-[rgba(168,187,238,0.2)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#C6E36C]/50 transition-colors uppercase"
                      placeholder={t("profile.global.billingCountry")}
                      value={editBilling.countryCode}
                      onChange={(e) => setEditBilling((prev) => ({ ...prev, countryCode: e.target.value.toUpperCase() }))}
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="rounded-xl bg-[#0e1225]/60 border border-[rgba(168,187,238,0.08)] p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{t("profile.global.contactTitle")}</p>
                  <p className="text-gray-200">{profileSource.phone || t("profile.global.missing")}</p>
                  <p className="text-gray-500 mt-1">
                    {t("profile.global.country")}: {profileSource.countryCode || t("profile.global.missing")}
                  </p>
                  <p className="text-gray-500">
                    {t("profile.global.region")}: {profileSource.regionCode || t("profile.global.missing")}
                  </p>
                </div>
                <div className="rounded-xl bg-[#0e1225]/60 border border-[rgba(168,187,238,0.08)] p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{t("profile.global.localeTitle")}</p>
                  <p className="text-gray-200">{profileSource.defaultLocale || t("profile.global.missing")}</p>
                  <p className="text-gray-500 mt-1">
                    Email: {profileSource.emailVerifiedAt ? t("profile.global.verified") : t("profile.global.pending")}
                  </p>
                  <p className="text-gray-500">
                    {t("profile.global.phone")}: {profileSource.phoneVerifiedAt ? t("profile.global.verified") : t("profile.global.pending")}
                  </p>
                </div>
                <div className="rounded-xl bg-[#0e1225]/60 border border-[rgba(168,187,238,0.08)] p-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{t("profile.global.billingTitle")}</p>
                  <p className="text-gray-200">{profileSource.billingProfile?.fullName || profileSource.billingProfile?.companyName || t("profile.global.missing")}</p>
                  <p className="text-gray-500 mt-1">{profileSource.billingProfile?.taxId || t("profile.global.taxIdMissing")}</p>
                  <p className="text-gray-500">
                    {profileSource.billingProfile?.countryCode || t("profile.global.missing")}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Active Subscription Section */}
          {activeSub && activeSub.status === "ACTIVE" && (
            <div className="mt-4 p-6 glass rounded-2xl border border-[rgba(168,187,238,0.12)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Crown className={`w-5 h-5 ${activeSub.tier === "STUDIO_PRO" ? "text-purple-400" : "text-[#C6E36C]"}`} />
                  <h3 className="text-lg font-semibold">Suscripción Activa</h3>
                </div>
                <Badge className={activeSub.tier === "STUDIO_PRO" ? "bg-purple-500/20 text-purple-400" : "bg-[#C6E36C]/20 text-[#C6E36C]"}>
                  {activeSub.tier}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 uppercase tracking-wider mb-1">ID Suscripción</p>
                  <p className="font-mono text-sm text-gray-300">{activeSub.subscriptionId}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => window.open(`https://www.paypal.com/myaccount/autopay/`, "_blank")}>
                  Gestionar en PayPal
                </Button>
              </div>
            </div>
          )}

          {/* Credits Section */}
          {isLoggedIn && (
            <div className="mt-4 p-6 glass rounded-2xl border border-[rgba(168,187,238,0.12)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[#C6E36C]" />
                  <h3 className="text-lg font-semibold">{t("profile.credits.title")}</h3>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs gap-1.5"
                  onClick={() => navigate("/plans")}
                >
                  <Crown className="w-3 h-3" /> {t("profile.credits.buyMore")}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Balance */}
                <div className="text-center p-4 rounded-xl bg-[#0e1225]/60 border border-[rgba(168,187,238,0.08)]">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t("profile.credits.balance")}</p>
                  {(() => {
                    return (
                      <p className={`text-3xl font-bold ${
                          (totalCreditBalance ?? 0) >= 100 ? "text-[#C6E36C]" :
                            (totalCreditBalance ?? 0) >= 50 ? "text-green-400" :
                              (totalCreditBalance ?? 0) > 0 ? "text-amber-400" :
                                "text-red-400"
                        }`}>
                        {totalCreditBalance ?? "—"}
                      </p>
                    );
                  })()}
                  <p className="text-[9px] text-gray-600 mt-1">{t("profile.credits.available")}</p>
                </div>
                {/* Monthly Available */}
                <div className="text-center p-4 rounded-xl bg-[#0e1225]/60 border border-[rgba(168,187,238,0.08)]">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t("profile.credits.monthlyAvailable")}</p>
                  <p className="text-3xl font-bold text-gray-200">{monthlyAvailable ?? "—"}</p>
                  <p className="text-[9px] text-gray-600 mt-1">{t("profile.credits.monthlyAlloc")}: {monthlyAllocation}</p>
                </div>
                {/* Top-up Available */}
                <div className="text-center p-4 rounded-xl bg-[#0e1225]/60 border border-[rgba(168,187,238,0.08)]">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t("profile.credits.topupAvailable")}</p>
                  <p className="text-3xl font-bold text-cyan-300">{topUpAvailable ?? "—"}</p>
                  <p className="text-[9px] text-gray-600 mt-1">{t("profile.credits.persistentBalance")}</p>
                </div>
                {/* Tier */}
                <div className="text-center p-4 rounded-xl bg-[#0e1225]/60 border border-[rgba(168,187,238,0.08)]">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t("profile.credits.tier")}</p>
                  <p className="text-3xl font-bold text-[#C6E36C]">{authUser?.tier ?? "FREE"}</p>
                  <p className="text-[9px] text-gray-600 mt-1">{t("profile.credits.current")}</p>
                </div>
              </div>
            </div>
          )}

          {/* Credit Activity History */}
          {isLoggedIn && (
            <CreditActivityHistory />
          )}

          {/* Rewards Section */}
          {rewards && (
            <div className="mt-4 p-6 glass rounded-2xl border border-[rgba(168,187,238,0.12)]">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-[#C6E36C]" />
                <h3 className="text-lg font-semibold">{t("profile.rewards.title")}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Level + Progress */}
                <div className="col-span-1">
                  {(() => {
                    const current = LEVEL_THRESHOLDS.find((l) => l.level === rewards.level) || LEVEL_THRESHOLDS[0];
                    const nextIdx = LEVEL_THRESHOLDS.findIndex((l) => l.level === rewards.level) + 1;
                    const next = LEVEL_THRESHOLDS[nextIdx] || current;
                    const rewardPts = rewards.points ?? (rewards as any).xp ?? 0;
                    const progress = next === current ? 100 : Math.min(100, ((rewardPts - current.min) / (next.min - current.min)) * 100);
                    return (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="text-sm" style={{ backgroundColor: `${current.color}20`, color: current.color, borderColor: `${current.color}40` }}>
                            <Zap className="w-3.5 h-3.5 mr-1" /> {rewards.level}
                          </Badge>
                          <span className="text-sm font-mono" style={{ color: current.color }}>
                            <Star className="w-3.5 h-3.5 inline mr-0.5" />{(rewards.points ?? (rewards as any).xp ?? 0).toLocaleString()} pts
                          </span>
                        </div>
                        {nextIdx < LEVEL_THRESHOLDS.length && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                              <span>{rewards.level}</span>
                              <span>{next.level} ({next.min} pts)</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-[#1a1f36] overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: current.color }} />
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                {/* Badges */}
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{t("profile.rewards.badges")}</p>
                  <div className="flex flex-wrap gap-2">
                    {rewards.badges.length > 0 ? rewards.badges.map((b) => (
                      <span key={b} className="text-[11px] px-2.5 py-1 rounded-full bg-[#C6E36C]/10 text-[#C6E36C] border border-[#C6E36C]/20">
                        {BADGE_ICONS[b] || "🏆"} {BADGE_KEYS[b] ? t(BADGE_KEYS[b]) : b}
                      </span>
                    )) : (
                      <span className="text-sm text-gray-600">Publica modelos en la Comunidad para ganar badges</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{t("profile.title")}</h2>
          <Button size="sm" onClick={() => navigate("/studio")}>
            {t("landing.enterEditor")}
          </Button>
        </div>

        {/* Tabs: Published vs Drafts vs Keys */}
        <div className="flex gap-2 mb-6 border-b border-[rgba(168,187,238,0.12)] pb-4">
          {(["published", "draft", "keys"] as const).map((tab) => {
            const isKeys = tab === "keys";
            const count = isKeys ? null : communityModels.filter((m) => m.status === tab).length;
            const label = isKeys ? "API Keys / IA" : tab === "published" ? t("profile.tab.published") : t("profile.tab.drafts");

            return (
              <button
                key={tab}
                onClick={() => setProfileTab(tab)}
                className={`text-sm px-5 py-2 rounded-lg font-medium transition-all ${profileTab === tab
                    ? "bg-[#C6E36C]/15 text-[#C6E36C] border border-[#C6E36C]/30 shadow-[0_0_15px_rgba(198,227,108,0.1)]"
                    : "bg-transparent text-gray-500 hover:text-gray-300 hover:bg-[#1a1f36]/50"
                  }`}
              >
                {label} {count !== null && <span className="ml-1 opacity-60 text-xs font-mono">({count})</span>}
              </button>
            );
          })}
        </div>

        {profileTab === "keys" ? (
          <VaultUI />
        ) : (() => {
          const filtered = communityModels.filter((m) => m.status === profileTab);
          return filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((model, i) => (
                <div
                  key={model.id}
                  className="group relative rounded-2xl overflow-hidden glass border border-[rgba(168,187,238,0.12)] flex flex-col"
                  style={{
                    animation: `vsCardIn 0.4s cubic-bezier(.22,1,.36,1) ${i * 0.1}s both`,
                  }}
                >
                  <div className="aspect-video w-full overflow-hidden relative bg-[#121620]">
                    {model.thumbnailUrl ? (
                      <img
                        src={model.thumbnailUrl}
                        alt={model.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Box className="w-10 h-10 text-gray-700" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 flex gap-2">
                      <Badge
                        className={`backdrop-blur-md ${model.status === "draft"
                            ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                            : "bg-green-500/20 text-green-400 border-green-500/30"
                          }`}
                      >
                        {model.status === "draft" ? t("profile.modelDraft") : t("profile.tab.published")}
                      </Badge>
                      {model.featured && (
                        <Badge className="backdrop-blur-md bg-[#C6E36C]/20 text-[#C6E36C] border-[#C6E36C]/30">
                          <Crown className="w-3 h-3 mr-1" /> Destacado
                        </Badge>
                      )}
                      {model.forkedFromId && (
                        <Badge className="backdrop-blur-md bg-purple-500/20 text-purple-400 border-purple-500/30">
                          <GitFork className="w-3 h-3 mr-1" /> Fork
                        </Badge>
                      )}
                      {model.modelType === "relief" ? (
                        <Badge className="backdrop-blur-md bg-amber-500/20 text-amber-300 border-amber-500/30">
                          <Mountain className="w-3 h-3 mr-1" /> Relieve
                        </Badge>
                      ) : (
                        <Badge className="backdrop-blur-md bg-blue-500/20 text-blue-300 border-blue-500/30">
                          <Box className="w-3 h-3 mr-1" /> Paramétrico
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="text-lg font-semibold text-white mb-1 line-clamp-1">
                      {model.title}
                    </h3>
                    {model.tags && model.tags.length > 0 && (
                      <div className="flex gap-1.5 mb-2 flex-wrap">
                        {model.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1f36] text-gray-500 border border-[rgba(168,187,238,0.08)]">{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-sm mb-6 mt-auto">
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <Heart className="w-4 h-4" />
                        <span>{model.likes}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <Download className="w-4 h-4" />
                        <span>{model.downloads}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-auto">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-2 text-xs flex-1 min-w-[130px]"
                        onClick={() => navigate(`/model/${model.id}`)}
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> {t("profile.viewDetails")}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-2 text-xs flex-1 min-w-[130px]"
                        onClick={() => void handleEdit(model, "original")}
                      >
                        <Edit3 className="w-3.5 h-3.5" /> {t("common.edit")}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-2 text-xs flex-1 min-w-[130px]"
                        onClick={() => void handleEdit(model, "copy")}
                      >
                        <Copy className="w-3.5 h-3.5" /> Editar copia
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className={`gap-1 text-xs flex-1 min-w-[130px] ${model.status === "published" ? "text-green-400" : "text-gray-400"}`}
                        onClick={() => handleToggleVisibility(model)}
                      >
                        {model.status === "published" ? <Globe className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {model.status === "published" ? "Público" : "Privado"}
                      </Button>
                      {confirmDeleteId === model.id ? (
                        <div className="flex gap-1 flex-1 min-w-[130px]">
                          <Button
                            size="sm"
                            className="flex-1 text-xs bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => handleDelete(model.id)}
                          >
                            {t("common.yes")}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            {t("common.no")}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-2 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400 flex-1 min-w-[130px]"
                          onClick={() => setConfirmDeleteId(model.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {t("common.delete")}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-gray-500 glass rounded-2xl border border-[rgba(168,187,238,0.12)]">
              <Box className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg font-medium">
                {profileTab === "draft" ? t("profile.noDrafts") : t("profile.noModels")}
              </p>
              <p className="text-sm mt-1">
                {profileTab === "draft" ? t("profile.noDrafts") : t("profile.noModels")}
              </p>
              <Button className="mt-6" onClick={() => navigate("/studio")}>
                {t("membership.cta.goToEditor")}
              </Button>
            </div>
          );
        })()}
      </div>

      <style>{`
        @keyframes vsCardIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <SubscriptionSuccessModal
        open={showSubSuccess}
        onClose={() => setShowSubSuccess(false)}
        tier={subSuccessTier}
      />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
