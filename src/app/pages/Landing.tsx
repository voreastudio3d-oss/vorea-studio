import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "../nav";
import type { PathName } from "../nav";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Wrench, Sparkles, Printer, Waves, GitFork } from "lucide-react";
import { useI18n } from "../services/i18n-context";
import { ContentApi } from "../services/api-client";
import { trackAnalyticsEvent } from "../services/analytics";

import heroImg from "../../imports/hero-relief.png";

// Featured model ID is set via admin CMS (cm_xxx format)

export function Landing() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();

  // ─── CMS Hero Banner Config ───────────────────────────────────────────
  const [cmsConfig, setCmsConfig] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    ContentApi.getHeroBanner().then((cfg) => {
      if (cfg) setCmsConfig(cfg);
    });
    trackAnalyticsEvent("landing_view", { tool: "landing", surface: "landing" });
  }, []);

  // Determine base locale code (e.g. "es" from "es-UY")
  const baseLocale = locale.split("-")[0];
  const overrides = cmsConfig?.localeOverrides?.[baseLocale] || {};

  // CMS-aware text: admin override takes priority, then i18n fallback
  const tagline = overrides.tagline || t("landing.tagline");
  const title = overrides.title || t("landing.title");
  const subtitle = overrides.subtitle || t("landing.subtitle");
  const enterEditor = overrides.primaryCta || t("landing.enterEditor");
  const exploreCommunity = overrides.secondaryCta || t("landing.exploreCommunity");
  const featuredLabel = overrides.featuredLabel || t("landing.hero.featuredLabel");
  const featuredSubtitle = overrides.featuredSubtitle || t("landing.hero.featuredSubtitle");

  // CMS-configurable routes
  const heroModelId = cmsConfig?.featuredModelId || "";
  const primaryRoute = cmsConfig?.primaryCtaRoute || "/studio";
  const secondaryRoute = cmsConfig?.secondaryCtaRoute || "/community";

  const features: Array<{
    titleKey: string;
    descKey: string;
    icon: ReactNode;
    route: PathName;
    gradient: string;
  }> = [
    {
      titleKey: "landing.feature.parametric.title",
      descKey: "landing.feature.parametric.desc",
      icon: <Wrench className="w-8 h-8 text-white" />,
      route: "/studio?mode=parametric",
      // from-surface-raised + primary tint
      gradient: "from-surface-raised to-primary/15",
    },
    {
      titleKey: "landing.feature.organic.title",
      descKey: "landing.feature.organic.desc",
      icon: <Waves className="w-8 h-8 text-white" />,
      route: "/organic",
      // organic tool — red tint (semantic exception: tool accent color)
      gradient: "from-surface-raised to-red-400/15",
    },
    {
      titleKey: "landing.feature.ai.title",
      descKey: "landing.feature.ai.desc",
      icon: <Sparkles className="w-8 h-8 text-white" />,
      route: "/ai-studio",
      // ai tool — blue tint (semantic exception: tool accent color)
      gradient: "from-surface-raised to-blue-400/15",
    },
    {
      titleKey: "landing.feature.maker.title",
      descKey: "landing.feature.maker.desc",
      icon: <Printer className="w-8 h-8 text-white" />,
      route: "/makerworld",
      // maker tool — amber tint (semantic exception: tool accent color)
      gradient: "from-surface-raised to-amber-400/15",
    },
  ];

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-background">
      {/* Background ambient glow — inline style: gradients can't use CSS vars easily */}
      <div className="absolute top-0 right-[-10%] w-[600px] h-[600px] bg-primary opacity-[0.03] blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500 opacity-[0.03] blur-[150px] rounded-full pointer-events-none" />

      <div className="flex-1 flex flex-col z-10 max-w-7xl mx-auto px-6 py-12 md:py-20 w-full">
        
        {/* Hero Section - Split Layout */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-20 mb-32">
          
          {/* Text Content */}
          <div 
            className="flex-1 text-left"
            style={{ animation: "vsHeroIn 0.55s cubic-bezier(.22,1,.36,1) both" }}
          >
            <p className="text-sm font-bold text-primary tracking-[0.2em] uppercase mb-6 flex items-center gap-3">
              <span className="w-8 h-[2px] bg-primary"></span>
              {tagline}
            </p>
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]">
              <span className="text-white drop-shadow-lg block mb-2">{title.split(":")[0]}</span>
              <span 
                className="block"
                style={{
                  // Gradient text — inline style exception (Tailwind can't express multi-stop gradient on text)
                  background: "linear-gradient(135deg, #C6E36C 0%, #76A665 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 4px 12px rgba(198,227,108,0.2))"
                }}
              >
                {title.split(":")[1]}
              </span>
            </h1>
            <p className="text-lg md:text-xl text-gray-400 max-w-xl mb-10 leading-relaxed font-light">
              {subtitle}
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              <Button
                size="lg"
                className="w-full sm:w-auto font-bold h-14 px-8 text-base shadow-[0_0_30px_rgba(198,227,108,0.3)] hover:shadow-[0_0_40px_rgba(198,227,108,0.4)] transition-shadow"
                onClick={() => {
                  trackAnalyticsEvent("landing_cta_click", { intent: "general", target: "hero_primary" });
                  trackAnalyticsEvent("conversion_intent", { origin: "main_landing", target: "hero_primary" });
                  navigate(primaryRoute);
                }}
              >
                {enterEditor}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto font-bold h-14 px-8 text-base border-border/20 hover:bg-border/5 text-white"
                onClick={() => {
                  trackAnalyticsEvent("landing_cta_click", { intent: "general", target: "hero_secondary" });
                  navigate(secondaryRoute);
                }}
              >
                {exploreCommunity}
              </Button>
            </div>
          </div>

          {/* 3D Visual Content */}
          <div 
            className="flex-1 w-full max-w-2xl lg:max-w-none relative aspect-square lg:aspect-auto lg:h-[600px] flex items-center justify-center"
            style={{ animation: "vsHeroIn 0.8s cubic-bezier(.22,1,.36,1) 0.2s both" }}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-surface-raised to-background rounded-[2.5rem] border border-border-subtle shadow-2xl overflow-hidden group">
              <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-[0.02] transition-opacity duration-700 pointer-events-none" />
              <img 
                src={heroImg} 
                alt="3D Parametric Relief" 
                className="w-full h-full object-cover mix-blend-screen scale-105 group-hover:scale-110 transition-transform duration-1000 ease-out"
                style={{ filter: "contrast(1.2) brightness(1.1)" }}
              />

              {/* Fork badge — top right (only when a real model ID is configured) */}
              {heroModelId && (
                <button
                  onClick={() => navigate(`/model/${heroModelId}`)}
                  className="absolute top-6 right-6 z-20 flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-[0_0_20px_rgba(198,227,108,0.4)] hover:scale-105 transition-transform"
                  title="Fork este modelo"
                >
                  <GitFork className="w-4 h-4" />
                  Fork
                </button>
              )}

              <button 
                onClick={() => navigate('/relief')}
                className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-background/80 backdrop-blur-md border border-white/5 flex items-center justify-between group/btn hover:bg-surface-raised/90 transition-colors cursor-pointer"
                title={t("landing.hero.reliefTooltip")}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 group-hover/btn:bg-primary/30 transition-colors">
                    <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-white font-medium text-sm">{featuredLabel}</h3>
                    <p className="text-gray-400 text-xs">{featuredSubtitle}</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white group-hover/btn:bg-primary group-hover/btn:text-primary-foreground transition-all transform group-hover/btn:translate-x-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Feature Cards - Media Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
          {features.map((feature, i) => (
            <div
              key={i}
              style={{
                animation: `vsCardIn 0.6s cubic-bezier(.22,1,.36,1) ${0.3 + i * 0.1}s both`,
              }}
            >
              <Card
                className={`relative overflow-hidden bg-gradient-to-br ${feature.gradient} border-border-subtle hover:-translate-y-2 transition-all duration-300 h-full cursor-pointer hover:shadow-2xl hover:shadow-primary/5 group`}
                onClick={() => navigate(feature.route)}
              >
                {/* Decorative background circle */}
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />
                
                <CardHeader className="text-left relative z-10 p-8 h-full flex flex-col justify-between">
                  <div>
                    <div className="mb-6 w-16 h-16 rounded-2xl bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-300">
                      {feature.icon}
                    </div>
                    <CardTitle className="text-xl font-bold text-white tracking-wide mb-3">{t(feature.titleKey)}</CardTitle>
                    <CardDescription className="text-sm text-gray-300 leading-relaxed font-light">
                      {t(feature.descKey)}
                    </CardDescription>
                  </div>
                  <div className="mt-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity translate-y-4 group-hover:translate-y-0 duration-300">
                    {t("landing.feature.tryNow")} &rarr;
                  </div>
                </CardHeader>
              </Card>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes vsHeroIn {
          from { opacity: 0; transform: translateY(30px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes vsCardIn {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}