import { useEffect } from "react";
import { useNavigate } from "../nav";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import {
  Wrench,
  Sparkles,
  Waves,
  ImageIcon,
  ArrowRight,
  Zap,
  Users,
  Download,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { useI18n } from "../services/i18n-context";
import { trackAnalyticsEvent } from "../services/analytics";
import { usePublicPlanPricing } from "../services/public-plan-pricing";

export function MakerLanding() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { freePriceLabel, proPriceLabel, monthlySuffix } = usePublicPlanPricing(locale);

  useEffect(() => {
    trackAnalyticsEvent("landing_view", { intent: "makers" });
  }, []);

  const ctaClick = (target: string, route: string) => {
    trackAnalyticsEvent("landing_cta_click", { intent: "makers", target });
    navigate(route);
  };

  const tools = [
    {
      icon: Wrench,
      titleKey: "makers.tool.parametric.title",
      descKey: "makers.tool.parametric.desc",
      color: "#C6E36C",
      bgColor: "rgba(198,227,108,0.08)",
      borderColor: "rgba(198,227,108,0.15)",
      route: "/studio?mode=parametric",
      target: "parametric",
    },
    {
      icon: ImageIcon,
      titleKey: "makers.tool.relief.title",
      descKey: "makers.tool.relief.desc",
      color: "#22d3ee",
      bgColor: "rgba(34,211,238,0.08)",
      borderColor: "rgba(34,211,238,0.15)",
      route: "/relief",
      target: "relief",
    },
    {
      icon: Waves,
      titleKey: "makers.tool.organic.title",
      descKey: "makers.tool.organic.desc",
      color: "#f87171",
      bgColor: "rgba(248,113,113,0.08)",
      borderColor: "rgba(248,113,113,0.15)",
      route: "/organic",
      target: "organic",
    },
    {
      icon: Sparkles,
      titleKey: "makers.tool.ai.title",
      descKey: "makers.tool.ai.desc",
      color: "#a78bfa",
      bgColor: "rgba(167,139,250,0.08)",
      borderColor: "rgba(167,139,250,0.15)",
      route: "/ai-studio",
      target: "ai_studio",
    },
  ];

  const stats = [
    { icon: Layers, valueKey: "makers.stat.families", color: "#C6E36C" },
    { icon: Download, valueKey: "makers.stat.formats", color: "#22d3ee" },
    { icon: Users, valueKey: "makers.stat.community", color: "#a78bfa" },
    { icon: Zap, valueKey: "makers.stat.ai", color: "#fbbf24" },
  ];

  const benefits = [
    "makers.benefit.noInstall",
    "makers.benefit.scadNative",
    "makers.benefit.aiPipeline",
    "makers.benefit.makerworld",
    "makers.benefit.multiExport",
    "makers.benefit.freeTrial",
  ];

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0d1117]">
      {/* Ambient glows */}
      <div className="absolute top-[-5%] right-[-8%] w-[700px] h-[700px] bg-[#C6E36C] opacity-[0.04] blur-[180px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-10%] w-[500px] h-[500px] bg-purple-500 opacity-[0.03] blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute top-[60%] right-[10%] w-[400px] h-[400px] bg-cyan-500 opacity-[0.02] blur-[120px] rounded-full pointer-events-none" />

      <div className="flex-1 flex flex-col z-10 max-w-6xl mx-auto px-6 w-full">

        {/* ─── Hero Section ──────────────────────────────────────────── */}
        <section
          className="pt-16 md:pt-28 pb-20 text-center"
          style={{ animation: "mkFadeIn 0.6s cubic-bezier(.22,1,.36,1) both" }}
        >
          <p className="text-sm font-bold text-[#C6E36C] tracking-[0.25em] uppercase mb-6 flex items-center justify-center gap-3">
            <span className="w-8 h-[2px] bg-[#C6E36C]" />
            {t("makers.hero.tagline")}
            <span className="w-8 h-[2px] bg-[#C6E36C]" />
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight mb-8 leading-[1.08]">
            <span className="text-white block mb-2">{t("makers.hero.titleLine1")}</span>
            <span
              className="block"
              style={{
                background: "linear-gradient(135deg, #C6E36C 0%, #76A665 50%, #22d3ee 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 4px 16px rgba(198,227,108,0.25))",
              }}
            >
              {t("makers.hero.titleLine2")}
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            {t("makers.hero.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="w-full sm:w-auto font-bold h-14 px-10 text-base shadow-[0_0_30px_rgba(198,227,108,0.3)] hover:shadow-[0_0_50px_rgba(198,227,108,0.4)] transition-shadow"
              onClick={() => ctaClick("hero_primary", "/studio")}
            >
              {t("makers.hero.cta")}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto font-bold h-14 px-10 text-base border-[rgba(168,187,238,0.2)] hover:bg-[rgba(168,187,238,0.05)] text-white"
              onClick={() => ctaClick("hero_plans", "/plans")}
            >
              {t("makers.hero.ctaSecondary")}
            </Button>
          </div>
        </section>

        {/* ─── Stats Bar ────────────────────────────────────────────── */}
        <section
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20"
          style={{ animation: "mkFadeIn 0.6s cubic-bezier(.22,1,.36,1) 0.15s both" }}
        >
          {stats.map((stat, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm"
            >
              <stat.icon className="w-5 h-5 shrink-0" style={{ color: stat.color }} />
              <span className="text-sm text-gray-300 font-medium">{t(stat.valueKey)}</span>
            </div>
          ))}
        </section>

        {/* ─── Tools Section ────────────────────────────────────────── */}
        <section className="mb-24">
          <h2
            className="text-2xl md:text-3xl font-bold text-white text-center mb-4"
            style={{ animation: "mkFadeIn 0.5s cubic-bezier(.22,1,.36,1) 0.25s both" }}
          >
            {t("makers.tools.title")}
          </h2>
          <p
            className="text-gray-400 text-center max-w-xl mx-auto mb-12"
            style={{ animation: "mkFadeIn 0.5s cubic-bezier(.22,1,.36,1) 0.3s both" }}
          >
            {t("makers.tools.subtitle")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tools.map((tool, i) => (
              <Card
                key={i}
                className="relative overflow-hidden border cursor-pointer group hover:-translate-y-1 transition-all duration-300 hover:shadow-2xl"
                style={{
                  background: tool.bgColor,
                  borderColor: tool.borderColor,
                  animation: `mkSlideUp 0.6s cubic-bezier(.22,1,.36,1) ${0.35 + i * 0.08}s both`,
                }}
                onClick={() => ctaClick(tool.target, tool.route)}
              >
                <div
                  className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"
                  style={{ background: tool.color }}
                />
                <CardHeader className="relative z-10 p-7 flex flex-row items-start gap-5">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0 group-hover:scale-110 transition-transform"
                    style={{
                      background: `${tool.color}15`,
                      borderColor: `${tool.color}30`,
                    }}
                  >
                    <tool.icon className="w-7 h-7" style={{ color: tool.color }} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg font-bold text-white mb-2">
                      {t(tool.titleKey)}
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-400 leading-relaxed">
                      {t(tool.descKey)}
                    </CardDescription>
                    <span
                      className="inline-flex items-center gap-1 mt-3 text-xs font-semibold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: tool.color }}
                    >
                      {t("makers.tools.tryCta")} <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* ─── Benefits Checklist ────────────────────────────────────── */}
        <section
          className="mb-24"
          style={{ animation: "mkFadeIn 0.5s cubic-bezier(.22,1,.36,1) 0.5s both" }}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
            {t("makers.benefits.title")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {benefits.map((key, i) => (
              <div
                key={i}
                className="flex items-start gap-3 px-5 py-4 rounded-xl bg-white/[0.02] border border-white/[0.05]"
              >
                <CheckCircle2 className="w-5 h-5 text-[#C6E36C] shrink-0 mt-0.5" />
                <span className="text-sm text-gray-300 leading-relaxed">{t(key)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Pricing Teaser ───────────────────────────────────────── */}
        <section
          className="mb-24 text-center"
          style={{ animation: "mkFadeIn 0.5s cubic-bezier(.22,1,.36,1) 0.6s both" }}
        >
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            {t("makers.pricing.title")}
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto mb-8">
            {t("makers.pricing.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 max-w-2xl mx-auto">
            {/* Free tier */}
            <div className="flex-1 w-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-left">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Free</p>
              <p className="text-3xl font-extrabold text-white mb-1">{freePriceLabel}</p>
              <p className="text-sm text-gray-400 mb-4">{t("makers.pricing.freeDesc")}</p>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => ctaClick("pricing_free", "/studio")}
              >
                {t("makers.pricing.freeCta")}
              </Button>
            </div>
            {/* Pro tier */}
            <div className="flex-1 w-full rounded-2xl border-2 border-[#C6E36C]/30 bg-[#C6E36C]/[0.04] p-6 text-left relative">
              <span className="absolute -top-3 left-6 text-[10px] font-bold text-[#0d1117] bg-[#C6E36C] px-3 py-0.5 rounded-full uppercase tracking-wider">
                {t("makers.pricing.popular")}
              </span>
              <p className="text-xs font-bold text-[#C6E36C] uppercase tracking-wider mb-2">Pro</p>
              <p className="text-3xl font-extrabold text-white mb-1">
                {proPriceLabel}<span className="text-base font-medium text-gray-400">{monthlySuffix}</span>
              </p>
              <p className="text-sm text-gray-400 mb-4">{t("makers.pricing.proDesc")}</p>
              <Button
                className="w-full shadow-[0_0_20px_rgba(198,227,108,0.2)]"
                onClick={() => ctaClick("pricing_pro", "/plans")}
              >
                {t("makers.pricing.proCta")}
              </Button>
            </div>
          </div>
        </section>

        {/* ─── Final CTA ────────────────────────────────────────────── */}
        <section
          className="mb-20 text-center py-16 px-8 rounded-3xl bg-gradient-to-br from-[#C6E36C]/[0.06] to-transparent border border-[#C6E36C]/10"
          style={{ animation: "mkFadeIn 0.5s cubic-bezier(.22,1,.36,1) 0.7s both" }}
        >
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
            {t("makers.finalCta.title")}
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto mb-8">
            {t("makers.finalCta.subtitle")}
          </p>
          <Button
            size="lg"
            className="font-bold h-14 px-12 text-base shadow-[0_0_40px_rgba(198,227,108,0.3)]"
            onClick={() => ctaClick("final_cta", "/studio")}
          >
            {t("makers.finalCta.button")}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </section>
      </div>

      <style>{`
        @keyframes mkFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mkSlideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
