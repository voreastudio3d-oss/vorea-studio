import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../components/ui/input-otp";
import { useNavigate } from "../nav";
import { useAuth } from "../services/auth-context";
import { useI18n } from "../services/i18n-context";
import { AuthDialog } from "../components/AuthDialog";
import { toast } from "sonner";
import { AuthApi, PromotionsApi, PaypalApi, SubscriptionsApi } from "../services/api-client";
import type { MembershipTier, MembershipPlan, RegionPolicySummary } from "../services/types";
import { getPlans, getActivePromotions, DEFAULT_PLANS, type Promotion, getLimits, type BusinessLimits } from "../services/business-config";
import { trackAnalyticsEvent } from "../services/analytics";
import {
  Crown,
  Check,
  Zap,
  Sparkles,
  ArrowRight,
  Shield,
  Users,
  Infinity,
  Lock,
  Tag,
  Gift,
  Copy,
  CheckCircle2,
  Coins,
  Package,
  Loader2,
  MailCheck,
} from "lucide-react";

// ─── Plans (loaded dynamically from backend) ──────────────────────────────────

const TIER_COLORS: Record<MembershipTier, string> = {
  FREE: "text-gray-400",
  PRO: "text-[#C6E36C]",
  "STUDIO PRO": "text-purple-400",
};

const TIER_BORDER: Record<MembershipTier, string> = {
  FREE: "border-[rgba(168,187,238,0.12)]",
  PRO: "border-[#C6E36C]/30",
  "STUDIO PRO": "border-purple-500/30",
};

const REGION_LABEL_KEYS: Record<RegionPolicySummary["regionCode"], string> = {
  LATAM: "membership.policy.region.latam",
  NORTH_AMERICA: "membership.policy.region.northAmerica",
  EUROPE: "membership.policy.region.europe",
  APAC: "membership.policy.region.apac",
  AFRICA_MIDDLE_EAST: "membership.policy.region.africaMiddleEast",
  GLOBAL: "membership.policy.region.global",
};

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
  paypal: "PayPal",
  stripe: "Stripe",
  mercado_pago: "Mercado Pago",
  paddle: "Paddle",
};

function formatProviderLabel(provider: string): string {
  const normalized = String(provider || "").trim().toLowerCase();
  if (!normalized) return "";
  return PROVIDER_LABELS[normalized] || normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function isSafePayPalApprovalUrl(urlValue: string): boolean {
  try {
    const parsed = new URL(urlValue);
    if (parsed.protocol !== "https:") return false;
    return parsed.hostname === "www.paypal.com" || parsed.hostname === "www.sandbox.paypal.com";
  } catch {
    return false;
  }
}

// Generate feature comparison table from plan features
function buildFeaturesTable(plans: MembershipPlan[], t: (k: string) => string, limits?: BusinessLimits | null) {
  const free = plans.find((p) => p.tier === "FREE");
  const pro = plans.find((p) => p.tier === "PRO");
  const studio = plans.find((p) => p.tier === "STUDIO PRO");
  if (!free || !pro || !studio) return [];

  const formatLimit = (val: number | undefined, fallback: string, isFem: boolean = false) => {
    if (val === undefined) return fallback;
    if (val === -1) return isFem ? t("membership.val.unlimitedFem") : t("membership.val.unlimited");
    return String(val);
  };

  const freeProjects = limits ? formatLimit(limits.maxActiveProjects?.FREE, "3") : "3";
  const proProjects = limits ? formatLimit(limits.maxActiveProjects?.PRO, t("membership.val.unlimited")) : t("membership.val.unlimited");
  const studioProjects = limits ? formatLimit(limits.maxActiveProjects?.["STUDIO PRO"], t("membership.val.unlimited")) : t("membership.val.unlimited");

  const freeExports = limits?.exportFormats?.FREE ? limits.exportFormats.FREE.join(", ") : "STL";
  const proExports = limits?.exportFormats?.PRO ? limits.exportFormats.PRO.join(", ") : "STL, OBJ, 3MF";
  const studioExports = limits?.exportFormats?.["STUDIO PRO"] ? limits.exportFormats["STUDIO PRO"].join(", ") : "STL, OBJ, 3MF, SCAD";

  const freeGcode = limits ? `${limits.freeExportLimit} / ${t("membership.month") || "mes"}` : t("membership.val.freeGcode"); 

  const freeAi = limits ? formatLimit(limits.aiGenerationsPerMonth?.FREE, "1", true) : "1";
  const proAi = limits ? formatLimit(limits.aiGenerationsPerMonth?.PRO, "20", true) : "20";
  const studioAi = limits ? formatLimit(limits.aiGenerationsPerMonth?.["STUDIO PRO"], t("membership.val.unlimitedFem"), true) : t("membership.val.unlimitedFem");

  return [
    { feature: t("membership.feat.projects"), free: freeProjects, pro: proProjects, studio: studioProjects },
    { feature: t("membership.feat.exports"), free: freeExports, pro: proExports, studio: studioExports },
    { feature: t("membership.feat.gcode"), free: freeGcode, pro: t("membership.val.unlimitedFem"), studio: t("membership.val.unlimitedFem") },
    { feature: t("membership.feat.ai"), free: freeAi, pro: proAi, studio: studioAi },
    { feature: t("membership.feat.organic"), free: t("membership.val.no"), pro: t("membership.val.organicPro"), studio: t("membership.val.organicPro") },
    { feature: t("membership.feat.makerworld"), free: t("membership.val.no"), pro: t("membership.val.mwPro"), studio: t("membership.val.mwPro") },
    { feature: t("membership.feat.private"), free: t("membership.val.no"), pro: t("membership.val.no"), studio: t("membership.val.yes") },
    { feature: t("membership.feat.support"), free: t("membership.val.commSupport"), pro: t("membership.val.prioSupport"), studio: t("membership.val.dedicatedSupport") },
  ];
}

function getCardFeatures(tier: MembershipTier, limits: BusinessLimits | null, t: (k: string, opts?: any) => string) {
  const formatLimit = (val: number | undefined, fallback: string, isFem: boolean = false) => {
    if (val === undefined) return fallback;
    if (val === -1) return isFem ? t("membership.val.unlimitedFem") : t("membership.val.unlimited");
    return String(val);
  };

  if (tier === "FREE") {
    return [
      t("membership.cardFeat.projects", { count: limits ? formatLimit(limits.maxActiveProjects?.FREE, "3") : "3" }),
      t("membership.cardFeat.exports", { formats: limits?.exportFormats?.FREE ? limits.exportFormats.FREE.join(", ") : "STL" }),
      t("membership.cardFeat.editor"),
      t("membership.cardFeat.gcode", { count: limits ? String(limits.freeExportLimit) : "6" }),
      t("membership.cardFeat.commSupport"),
      t("membership.cardFeat.ai", { count: limits ? formatLimit(limits.aiGenerationsPerMonth?.FREE, "1", true) : "1" })
    ];
  }
  if (tier === "PRO") {
    return [
      t("membership.cardFeat.projects", { count: limits ? formatLimit(limits.maxActiveProjects?.PRO, t("membership.val.unlimited")) : t("membership.val.unlimited") }),
      t("membership.cardFeat.exports", { formats: limits?.exportFormats?.PRO ? limits.exportFormats.PRO.join(", ") : "STL, OBJ, 3MF" }),
      t("membership.cardFeat.editorFull"),
      t("membership.cardFeat.gcode", { count: t("membership.val.unlimitedFem") }),
      t("membership.cardFeat.organic"),
      t("membership.cardFeat.ai", { count: limits ? formatLimit(limits.aiGenerationsPerMonth?.PRO, "20", true) : "20" }),
      t("membership.cardFeat.mw"),
      t("membership.cardFeat.supportPrio")
    ];
  }
  if (tier === "STUDIO PRO") {
    return [
      t("membership.cardFeat.allPro"),
      t("membership.cardFeat.gcode", { count: t("membership.val.unlimitedFem") }),
      t("membership.cardFeat.ai", { count: limits ? formatLimit(limits.aiGenerationsPerMonth?.["STUDIO PRO"], t("membership.val.unlimitedFem"), true) : t("membership.val.unlimitedFem") }),
      t("membership.cardFeat.private"),
      t("membership.cardFeat.scad"),
      t("membership.cardFeat.supportDedicated")
    ];
  }
  return [];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Membership() {
  const navigate = useNavigate();
  const { isLoggedIn, user, regionPolicy, refreshUser } = useAuth();
  const { t } = useI18n();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [authOpen, setAuthOpen] = useState(false);
  const [emailVerificationOpen, setEmailVerificationOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationRequested, setVerificationRequested] = useState(false);
  const [verificationDevCode, setVerificationDevCode] = useState<string | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<{
    tier: MembershipTier;
    billing: "monthly" | "yearly";
  } | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>(DEFAULT_PLANS);
  const [limits, setLimits] = useState<BusinessLimits | null>(null);
  const [activePromo, setActivePromo] = useState<Promotion | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponResult, setCouponResult] = useState<{ valid: boolean; error?: string; promotion?: any } | null>(null);
  const [creditPacks, setCreditPacks] = useState<any[]>([]);
  const [creditPacksEnabled, setCreditPacksEnabled] = useState(false);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);

  // Validate coupon code
  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponResult(null);
    try {
      const result = await PromotionsApi.validateCoupon(couponCode.trim(), user?.tier);
      setCouponResult(result);
      if (result.valid && result.promotion) {
        // Apply coupon as active promo
        setActivePromo({
          id: result.promotion.id,
          name: result.promotion.name,
          type: result.promotion.type,
          value: result.promotion.value,
          appliesTo: result.promotion.appliesTo || ["all"],
          active: true,
          conditions: { couponCode: couponCode.trim().toUpperCase() },
        } as Promotion);
        toast.success(t("membership.couponApplied", { name: result.promotion.name }));
      } else {
        toast.error(result.error || t("membership.couponInvalid"));
      }
    } catch {
      setCouponResult({ valid: false, error: t("membership.couponError") });
      toast.error(t("membership.couponError"));
    } finally {
      setCouponLoading(false);
    }
  };
  // Calculate dynamic discount
  const maxDiscount = plans.reduce((max, plan) => {
    if (plan.price > 0 && plan.yearlyPrice > 0) {
      const yearlyNormalPrice = plan.price * 12;
      if (yearlyNormalPrice > plan.yearlyPrice) {
        const discount = Math.round((1 - plan.yearlyPrice / yearlyNormalPrice) * 100);
        return Math.max(max, discount);
      }
    }
    return max;
  }, 0) || 30; // fallback isolated from user limits

  const featuresTable = buildFeaturesTable(plans, t, limits);
  const requiresEmailStepUp = Boolean(
    isLoggedIn && regionPolicy?.requiresStepUpOnPayment && !user?.emailVerifiedAt
  );
  const regionName = regionPolicy ? t(REGION_LABEL_KEYS[regionPolicy.regionCode]) : null;
  const authProvidersSummary = regionPolicy?.recommendedAuthProviders.map(formatProviderLabel).join(" · ") || "";
  const paymentProvidersSummary = regionPolicy?.recommendedPaymentProviders.map(formatProviderLabel).join(" · ") || "";

  // Load plans + promotions from backend on mount
  useEffect(() => {
    getPlans().then(setPlans).catch(() => { /* fallback already set */ });
    getLimits().then(setLimits).catch(() => {});
    getActivePromotions().then((promos) => {
      if (promos.length > 0) setActivePromo(promos[0]);
    }).catch(() => {});
    // Load credit packs from business config
    fetch("/api/config/business")
      .then(r => r.json())
      .then(data => {
        setCreditPacksEnabled(Boolean(data.creditPacksEnabled));
        if (Array.isArray(data.creditPacks)) setCreditPacks(data.creditPacks);
      })
      .catch(() => {});
  }, []);

  const resetVerificationFlow = (options?: { clearPending?: boolean }) => {
    setVerificationCode("");
    setVerificationRequested(false);
    setVerificationDevCode(null);
    setVerificationBusy(false);
    if (options?.clearPending !== false) {
      setPendingCheckout(null);
    }
  };

  const openEmailVerificationStep = async (tier: MembershipTier) => {
    setPendingCheckout({ tier, billing });
    setEmailVerificationOpen(true);
    setVerificationBusy(true);
    try {
      const result = await AuthApi.requestEmailVerification();
      setVerificationRequested(true);
      setVerificationDevCode(result.codeDev ?? null);
      toast.success(result.message || t("membership.verifyEmail.requestSuccess"));
    } catch (error: any) {
      toast.error(error?.message || t("membership.verifyEmail.requestError"));
    } finally {
      setVerificationBusy(false);
    }
  };

  const continueSubscriptionCheckout = async (
    tier: MembershipTier,
    billingCycle: "monthly" | "yearly"
  ) => {
    toast.loading(t("membership.paypalConnecting"));
    const data = await SubscriptionsApi.createSubscription(tier, billingCycle);
    toast.dismiss();

    if (data.error) {
      toast.error(data.error);
      return;
    }

    if (data.approveUrl && isSafePayPalApprovalUrl(data.approveUrl)) {
      window.location.assign(data.approveUrl);
      return;
    }

    toast.error(t("membership.paypalUrlError"));
  };

  const handleVerifyEmailAndContinue = async () => {
    if (!pendingCheckout) return;
    if (verificationCode.trim().length !== 6) {
      toast.error(t("membership.verifyEmail.invalidLength"));
      return;
    }

    setVerificationBusy(true);
    try {
      const result = await AuthApi.verifyEmail(verificationCode.trim());
      await refreshUser();
      toast.success(result.message || t("membership.verifyEmail.success"));
      const nextCheckout = pendingCheckout;
      setEmailVerificationOpen(false);
      resetVerificationFlow();
      await continueSubscriptionCheckout(nextCheckout.tier, nextCheckout.billing);
    } catch (error: any) {
      toast.error(error?.message || t("membership.verifyEmail.verifyError"));
    } finally {
      setVerificationBusy(false);
    }
  };

  // Helper: apply promo discount to a price
  const applyPromo = (price: number, tier: string): { final: number; hasDiscount: boolean } => {
    if (!activePromo || price === 0) return { final: price, hasDiscount: false };
    const applies = activePromo.appliesTo.includes("all") || activePromo.appliesTo.includes(tier);
    if (!applies) return { final: price, hasDiscount: false };
    if (activePromo.type === "percent") return { final: +(price * (1 - activePromo.value / 100)).toFixed(2), hasDiscount: true };
    if (activePromo.type === "fixed") return { final: Math.max(0, +(price - activePromo.value).toFixed(2)), hasDiscount: true };
    return { final: price, hasDiscount: false };
  };

  // Format promo description for banner
  const promoLabel = activePromo ? (
    activePromo.type === "percent" ? t("membership.promoPercent", { value: String(activePromo.value) }) :
    activePromo.type === "fixed" ? t("membership.promoFixed", { value: String(activePromo.value) }) :
    activePromo.type === "trial" ? t("membership.promoTrial", { value: String(activePromo.value) }) :
    activePromo.type === "bonus_credits" ? t("membership.promoCredits", { value: String(activePromo.value) }) : ""
  ) : "";

  const handleSelectPlan = async (tier: MembershipTier) => {
    if (!isLoggedIn) {
      setAuthOpen(true);
      trackAnalyticsEvent("sign_up_start", { tool: "pricing", surface: "conversion", source: "plan_select" });
      return;
    }
    trackAnalyticsEvent("pricing_plan_click", { tool: "pricing", surface: "conversion", plan: tier, billing });
    if (tier === user?.tier) {
      toast(t("membership.alreadyOnPlan"));
      return;
    }

    if (tier === "FREE") {
      toast(t("membership.downgradeInfo"));
      return;
    }

    if (requiresEmailStepUp) {
      await openEmailVerificationStep(tier);
      return;
    }

    // Call subscription backend — redirect to PayPal in same window
    try {
      await continueSubscriptionCheckout(tier, billing);
    } catch (e: any) {
      toast.dismiss();
      toast.error(e?.message || t("membership.paypalError"));
    }
  };

  const currentTier = user?.tier ?? "FREE";

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[rgba(168,187,238,0.12)]">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at top center, rgba(198,227,108,0.06) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(168,85,247,0.06) 0%, transparent 50%), #0d1117",
          }}
        />
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-24 text-center">
          <div
            className="flex items-center justify-center gap-3 mb-4"
            style={{
              animation: "vsHeroIn 0.5s cubic-bezier(.22,1,.36,1) both",
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-[#C6E36C]/10 border border-[#C6E36C]/30 flex items-center justify-center">
              <Crown className="w-5 h-5 text-[#C6E36C]" />
            </div>
          </div>
          <h1
            className="text-4xl md:text-6xl font-bold tracking-tight mb-4"
            style={{
              background:
                "linear-gradient(135deg, #fff 30%, #C6E36C 70%, #a78bfa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation:
                "vsHeroIn 0.55s cubic-bezier(.22,1,.36,1) 0.05s both",
            }}
          >
            {t("membership.title")}
          </h1>
          <p
            className="text-lg text-gray-400 max-w-2xl mx-auto mb-8"
            style={{
              animation:
                "vsHeroIn 0.55s cubic-bezier(.22,1,.36,1) 0.1s both",
            }}
          >
            {t("membership.subtitle")}
          </p>

          {/* Billing toggle */}
          <div
            className="inline-flex items-center gap-1 bg-[#1a1f36] rounded-xl p-1 border border-[rgba(168,187,238,0.12)]"
            style={{
              animation:
                "vsHeroIn 0.55s cubic-bezier(.22,1,.36,1) 0.15s both",
            }}
          >
            <button
              className={`px-5 py-2 text-sm rounded-lg transition-all ${
                billing === "monthly"
                  ? "bg-[#C6E36C]/15 text-[#C6E36C]"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => setBilling("monthly")}
            >
              {t("membership.monthly")}
            </button>
            <button
              className={`px-5 py-2 text-sm rounded-lg transition-all flex items-center gap-2 ${
                billing === "yearly"
                  ? "bg-[#C6E36C]/15 text-[#C6E36C]"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => setBilling("yearly")}
            >
              {t("membership.yearly")}
              <Badge className="bg-green-500/20 text-green-400 border-none text-[9px]">
                -{maxDiscount}%
              </Badge>
            </button>
          </div>
        </div>
      </div>

      {isLoggedIn && regionPolicy && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-4">
            <div className="rounded-2xl border border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.45)] p-5">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#C6E36C]/10 border border-[#C6E36C]/20 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-[#C6E36C]" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h2 className="text-base font-semibold text-white">
                      {t("membership.policy.title")}
                    </h2>
                    <Badge className="bg-[rgba(198,227,108,0.12)] text-[#C6E36C] border-[#C6E36C]/20">
                      {regionName}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-400 mb-4">
                    {t("membership.policy.subtitle")}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[rgba(13,17,23,0.45)] p-3">
                      <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                        {t("membership.policy.authProviders")}
                      </div>
                      <div className="text-gray-200">{authProvidersSummary}</div>
                    </div>
                    <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[rgba(13,17,23,0.45)] p-3">
                      <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                        {t("membership.policy.paymentProviders")}
                      </div>
                      <div className="text-gray-200">{paymentProvidersSummary}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.45)] p-5">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#C6E36C]/10 border border-[#C6E36C]/20 flex items-center justify-center shrink-0">
                  <MailCheck className="w-5 h-5 text-[#C6E36C]" />
                </div>
                <div className="flex-1">
                  <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                    {t("membership.policy.emailStatus")}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-100">
                      {user?.emailVerifiedAt
                        ? t("membership.policy.emailVerified")
                        : t("membership.policy.emailPending")}
                    </span>
                    <Badge
                      className={
                        user?.emailVerifiedAt
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                          : "bg-amber-500/15 text-amber-300 border-amber-500/25"
                      }
                    >
                      {regionPolicy.requiresStepUpOnPayment
                        ? t("membership.policy.stepUpRequired")
                        : t("membership.policy.stepUpNotRequired")}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-400">
                    {user?.emailVerifiedAt
                      ? t("membership.policy.stepUpHintVerified")
                      : t("membership.policy.stepUpHint")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──── Promo Banner + Coupon Input (unified card) ──────────────── */}
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-2">
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(234,179,8,0.12) 0%, rgba(168,85,247,0.1) 40%, rgba(198,227,108,0.08) 100%)",
            boxShadow: "0 0 40px rgba(234,179,8,0.08), 0 0 80px rgba(168,85,247,0.04)",
          }}
        >
          {/* Animated top border */}
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
            background: "linear-gradient(90deg, transparent, #C6E36C, #eab308, #a855f7, #C6E36C, transparent)",
            backgroundSize: "200% 100%",
            animation: "shimmer 3s linear infinite",
          }} />
          <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

          <div className="px-6 py-5 space-y-4">
            {/* Active Promo Banner */}
            {activePromo && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center shrink-0"
                    style={{ animation: "pulse 2s ease-in-out infinite" }}
                  >
                    {activePromo.type === "bonus_credits" ? (
                      <Gift className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <Tag className="w-5 h-5 text-yellow-400" />
                    )}
                  </div>
                  <div>
                    <span className="text-base font-bold text-yellow-400">
                      {activePromo.name}
                    </span>
                    <span className="text-sm text-gray-300 ml-2">
                      — {promoLabel}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {activePromo.conditions?.couponCode && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(activePromo.conditions!.couponCode!);
                        toast.success(t("membership.codeCopied"));
                      }}
                      className="group flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/25 rounded-lg hover:bg-yellow-500/20 hover:border-yellow-500/40 transition-all cursor-pointer"
                      title={t("membership.copyCode")}
                    >
                      <span className="text-[10px] text-gray-500 uppercase font-medium">{t("membership.promoCode")}</span>
                      <code className="text-sm text-yellow-300 font-mono font-bold tracking-widest">
                        {activePromo.conditions.couponCode}
                      </code>
                      <Copy className="w-3.5 h-3.5 text-yellow-500/50 group-hover:text-yellow-400 transition-colors" />
                    </button>
                  )}
                  {activePromo.conditions?.endDate && (
                    <span className="text-[11px] text-gray-500 bg-[rgba(255,255,255,0.03)] px-2.5 py-1 rounded-lg">
                      {t("membership.promoValidUntil", { date: new Date(activePromo.conditions.endDate).toLocaleDateString() })}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Divider if promo is active */}
            {activePromo && <div className="border-t border-[rgba(168,187,238,0.08)]" />}

            {/* Coupon Code Input */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-400 shrink-0">
                <Gift className="w-4 h-4 text-[#C6E36C]/60" />
                <span className="font-medium">{t("membership.haveCoupon")}</span>
              </div>
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleValidateCoupon()}
                  placeholder={t("membership.couponPlaceholder")}
                  className="w-full pl-10 pr-3 py-2.5 bg-[#0a0e1a] border border-[rgba(168,187,238,0.12)] rounded-xl text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C6E36C]/40 focus:bg-[#0d1117] font-mono tracking-widest transition-all"
                />
              </div>
              <button
                onClick={handleValidateCoupon}
                disabled={couponLoading || !couponCode.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#C6E36C]/15 to-yellow-500/15 text-[#C6E36C] border border-[#C6E36C]/25 hover:from-[#C6E36C]/25 hover:to-yellow-500/25 hover:border-[#C6E36C]/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
              >
                {couponLoading ? (
                  <span className="w-4 h-4 border-2 border-[#C6E36C]/30 border-t-[#C6E36C] rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {t("membership.applyCoupon")}
              </button>
            </div>

            {/* Validation result */}
            {couponResult && (
              <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm ${
                couponResult.valid
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/10 border border-red-500/20 text-red-400"
              }`}>
                {couponResult.valid ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <Lock className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {couponResult.valid
                    ? `${couponResult.promotion?.name} — ${couponResult.promotion?.type === "percent" ? `${couponResult.promotion.value}% ${t("membership.discount")}` : couponResult.promotion?.type === "bonus_credits" ? `+${couponResult.promotion.value} ${t("membership.bonusCredits")}` : `$${couponResult.promotion.value} ${t("membership.discount")}`}`
                    : couponResult.error
                  }
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => {
            const isCurrent = isLoggedIn && plan.tier === currentTier;
            const rawPrice =
              billing === "monthly" ? plan.price : plan.yearlyPrice;
            const { final: price, hasDiscount } = applyPromo(rawPrice, plan.tier);
            const priceLabel =
              billing === "monthly" ? t("membership.perMonth") : t("membership.perYear");

            return (
              <Card
                key={plan.tier}
                className={`relative overflow-hidden ${
                  plan.highlighted
                    ? "bg-[rgba(198,227,108,0.05)] border-[#C6E36C]/30"
                    : "bg-[rgba(26,31,54,0.5)] border-[rgba(168,187,238,0.12)]"
                } ${isCurrent ? "ring-2 ring-[#C6E36C]/40" : ""}`}
                style={{
                  animation: `vsCardIn 0.4s cubic-bezier(.22,1,.36,1) ${i * 0.08}s both`,
                }}
              >
                {plan.highlighted && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C6E36C] to-green-400" />
                )}
                {isCurrent && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-[#C6E36C]/20 text-[#C6E36C] border-[#C6E36C]/30 text-[9px]">
                      {t("membership.current")}
                    </Badge>
                  </div>
                )}
                <CardContent className="p-6">
                  <div className={`text-sm font-semibold mb-1 ${TIER_COLORS[plan.tier]}`}>
                    {plan.name}
                  </div>
                  <div className="flex items-baseline gap-1 mb-6">
                    {plan.price === 0 ? (
                      <span className="text-4xl font-bold text-white">
                        {t("membership.free")}
                      </span>
                    ) : (
                      <>
                        {hasDiscount && (
                          <span className="text-lg text-gray-500 line-through mr-1">
                            ${rawPrice}
                          </span>
                        )}
                        <span className={`text-4xl font-bold ${hasDiscount ? "text-[#C6E36C]" : "text-white"}`}>
                          ${price}
                        </span>
                        <span className="text-sm text-gray-500">
                          USD{priceLabel}
                        </span>
                      </>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8">
                    {getCardFeatures(plan.tier, limits, t).map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-sm text-gray-300"
                      >
                        <Check className="w-4 h-4 text-[#C6E36C] shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full gap-2 ${
                      isCurrent
                        ? "opacity-50 cursor-not-allowed"
                        : plan.highlighted
                        ? ""
                        : ""
                    }`}
                    variant={plan.highlighted ? "default" : "secondary"}
                    onClick={() => handleSelectPlan(plan.tier)}
                    disabled={isCurrent}
                  >
                    {isCurrent ? (
                      t("membership.currentPlan")
                    ) : plan.price === 0 ? (
                      <>{t("membership.startFree")}</>
                    ) : !isLoggedIn ? (
                      <>
                        <Lock className="w-3.5 h-3.5" /> {t("membership.signUpToAccess")}
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" /> {t("membership.upgradeTo", { plan: plan.name })}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="border-t border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.15)]">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold mb-2 text-center">
            {t("membership.comparison")}
          </h2>
          <p className="text-sm text-gray-400 mb-10 text-center">
            {t("membership.comparisonSubtitle")}
          </p>

          <div className="rounded-2xl border border-[rgba(168,187,238,0.12)] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-4 bg-[rgba(26,31,54,0.6)]">
              <div className="p-4 text-xs text-gray-500 uppercase tracking-wider">
                {t("membership.feature")}
              </div>
              <div className="p-4 text-xs text-gray-400 uppercase tracking-wider text-center">
                Free
              </div>
              <div className="p-4 text-xs text-[#C6E36C] uppercase tracking-wider text-center">
                Pro
              </div>
              <div className="p-4 text-xs text-purple-400 uppercase tracking-wider text-center">
                Studio Pro
              </div>
            </div>
            {/* Rows */}
            {featuresTable.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-4 border-t border-[rgba(168,187,238,0.06)] ${
                  i % 2 === 0 ? "bg-transparent" : "bg-[rgba(26,31,54,0.2)]"
                }`}
              >
                <div className="p-4 text-sm text-gray-300">{row.feature}</div>
                <div className="p-4 text-sm text-gray-500 text-center">
                  {row.free}
                </div>
                <div className="p-4 text-sm text-gray-300 text-center">
                  {row.pro}
                </div>
                <div className="p-4 text-sm text-gray-300 text-center">
                  {row.studio}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Universal top-up store */}
      {isLoggedIn && creditPacksEnabled && creditPacks.length > 0 && (
        <div id="creditos" className="border-t border-[rgba(168,187,238,0.12)] bg-gradient-to-b from-[rgba(26,31,54,0.3)] to-transparent">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 text-[#C6E36C] text-xs font-medium px-3 py-1.5 rounded-full bg-[#C6E36C]/10 border border-[#C6E36C]/20 mb-4">
                <Coins className="w-3.5 h-3.5" /> {t("membership.credits.extra")}
              </div>
              <h2 className="text-2xl font-bold mb-2">{t("membership.credits.title")}</h2>
              <p className="text-sm text-gray-400">{t("membership.credits.subtitle")}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {creditPacks.map((pack: any, i: number) => (
                <div
                  key={pack.id}
                  className={`relative p-6 rounded-2xl border transition-all ${
                    pack.popular
                      ? "bg-gradient-to-b from-[#C6E36C]/8 to-transparent border-[#C6E36C]/30 shadow-[0_0_30px_rgba(198,227,108,0.08)]"
                      : "bg-[rgba(26,31,54,0.6)] border-[rgba(168,187,238,0.12)] hover:border-[rgba(168,187,238,0.25)]"
                  }`}
                  style={{ animation: `vsCardIn 0.4s cubic-bezier(.22,1,.36,1) ${i * 0.08}s both` }}
                >
                  {pack.popular && (
                    <Badge className="absolute -top-2.5 right-4 bg-[#C6E36C] text-[#0d1117] text-[9px] font-semibold px-2">
                      {t("membership.credits.popular")}
                    </Badge>
                  )}
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-xl bg-[#C6E36C]/10 border border-[#C6E36C]/20 flex items-center justify-center mx-auto mb-3">
                      <Package className="w-6 h-6 text-[#C6E36C]" />
                    </div>
                    <p className="text-sm font-medium text-gray-300 mb-1">{pack.name}</p>
                    <p className="text-3xl font-bold text-white mb-1">{pack.credits}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-4">{t("membership.credits.creditsLabel")}</p>
                    <div className="mb-4">
                      <span className="text-xl font-bold text-[#C6E36C]">${pack.price}</span>
                      <span className="text-xs text-gray-500 ml-1">USD</span>
                    </div>
                    <p className="text-[9px] text-gray-600 mb-2">${(pack.price / pack.credits).toFixed(2)} / {t("membership.credits.perCredit")}</p>
                    <p className="text-[10px] text-gray-500 mb-4">{t("membership.credits.topupDesc")}</p>
                    <Button
                      size="sm"
                      className={`w-full gap-1.5 ${pack.popular ? '' : ''}`}
                      variant={pack.popular ? "default" : "secondary"}
                      disabled={buyingPack === pack.id}
                      onClick={async () => {
                        setBuyingPack(pack.id);
                        try {
                          const data = await PaypalApi.createOrder(pack.id, pack.name, pack.price);
                          // Redirect to PayPal in same window (consistent with subscriptions)
                          if (data.approveUrl && isSafePayPalApprovalUrl(data.approveUrl)) {
                            // Store orderId+packId for capture on return
                            sessionStorage.setItem("vorea_credit_order", JSON.stringify({ orderId: data.orderId, packId: pack.id }));
                            window.location.assign(data.approveUrl);
                          } else {
                            // Fallback: use checkoutnow URL
                            sessionStorage.setItem("vorea_credit_order", JSON.stringify({ orderId: data.orderId, packId: pack.id }));
                            window.location.assign(`https://www.paypal.com/checkoutnow?token=${data.orderId}`);
                          }
                        } catch (e: any) {
                          toast.error(e.message || t("membership.orderError"));
                          setBuyingPack(null);
                        }
                      }}
                    >
                      {buyingPack === pack.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Coins className="w-3.5 h-3.5" />
                      )}
                      {t("membership.credits.buy")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isLoggedIn && !creditPacksEnabled && (
        <div id="creditos" className="border-t border-[rgba(168,187,238,0.12)] bg-gradient-to-b from-[rgba(26,31,54,0.3)] to-transparent">
          <div className="max-w-3xl mx-auto px-6 py-16">
            <div className="rounded-2xl border border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.55)] p-6 text-center">
              <div className="inline-flex items-center gap-2 text-amber-300 text-xs font-medium px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
                <Coins className="w-3.5 h-3.5" /> {t("membership.topup.paused")}
              </div>
              <h2 className="text-2xl font-bold mb-2">{t("membership.topup.pausedTitle")}</h2>
              <p className="text-sm text-gray-400 max-w-xl mx-auto">
                {t("membership.topup.pausedDesc")}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                <Button variant="secondary" onClick={() => navigate("/profile")} className="gap-2">
                  <Coins className="w-4 h-4" /> {t("membership.topup.viewBalance")}
                </Button>
                <Button onClick={() => navigate("/plans")} className="gap-2">
                  <Crown className="w-4 h-4" /> {t("membership.topup.reviewPlans")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trust section */}
      <div className="border-t border-[rgba(168,187,238,0.12)]">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Shield className="w-6 h-6 text-[#C6E36C]" />,
                titleKey: "membership.trustSecure.title",
                descKey: "membership.trustSecure.desc",
              },
              {
                icon: <Users className="w-6 h-6 text-[#C6E36C]" />,
                titleKey: "membership.trustNoCommit.title",
                descKey: "membership.trustNoCommit.desc",
              },
              {
                icon: <Infinity className="w-6 h-6 text-[#C6E36C]" />,
                titleKey: "membership.trustGuarantee.title",
                descKey: "membership.trustGuarantee.desc",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="text-center"
                style={{
                  animation: `vsCardIn 0.4s cubic-bezier(.22,1,.36,1) ${i * 0.08}s both`,
                }}
              >
                <div className="w-12 h-12 rounded-xl bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] flex items-center justify-center mx-auto mb-4">
                  {item.icon}
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">
                  {t(item.titleKey)}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {t(item.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-[rgba(168,187,238,0.12)]">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold mb-3">{t("membership.cta.title")}</h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            {t("membership.cta.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {!isLoggedIn && (
              <Button
                size="lg"
                className="gap-2"
                onClick={() => setAuthOpen(true)}
              >
                <Sparkles className="w-4 h-4" /> {t("membership.cta.createAccount")}
              </Button>
            )}
            <Button
              size="lg"
              variant="secondary"
              className="gap-2"
              onClick={() => navigate("/studio")}
            >
              {t("membership.cta.goToEditor")} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultTab="register" />

      <Dialog
        open={emailVerificationOpen}
        onOpenChange={(open) => {
          setEmailVerificationOpen(open);
          if (!open) {
            resetVerificationFlow();
          }
        }}
      >
        <DialogContent className="bg-[#1a1f36] border-[rgba(168,187,238,0.12)] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("membership.verifyEmail.title")}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {t("membership.verifyEmail.desc", {
                plan: pendingCheckout?.tier || "PRO",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[rgba(13,17,23,0.45)] p-4">
            <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">
              {t("membership.verifyEmail.codeLabel")}
            </div>
            <InputOTP
              maxLength={6}
              value={verificationCode}
              onChange={(value) => setVerificationCode(value)}
              containerClassName="justify-center"
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, index) => (
                  <InputOTPSlot key={index} index={index} className="h-11 w-11 bg-[rgba(13,17,23,0.75)]" />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <p className="text-xs text-gray-500 mt-3">
              {t("membership.verifyEmail.codeHint", { email: user?.email || "" })}
            </p>
            {verificationDevCode && (
              <p className="text-xs text-amber-300 mt-2">
                {t("membership.verifyEmail.devCode", { code: verificationDevCode })}
              </p>
            )}
          </div>

          <DialogFooter className="sm:justify-between gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => openEmailVerificationStep(pendingCheckout?.tier || "PRO")}
              disabled={verificationBusy}
              className="gap-2"
            >
              <MailCheck className="w-4 h-4" />
              {verificationRequested
                ? t("membership.verifyEmail.resendCode")
                : t("membership.verifyEmail.sendCode")}
            </Button>
            <Button
              type="button"
              onClick={handleVerifyEmailAndContinue}
              disabled={verificationBusy || verificationCode.trim().length !== 6}
              className="gap-2"
            >
              <Lock className="w-4 h-4" />
              {t("membership.verifyEmail.continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes vsHeroIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vsCardIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
