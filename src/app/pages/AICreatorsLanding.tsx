import { useEffect } from "react";
import { useI18n } from "../services/i18n-context";
import { trackAnalyticsEvent } from "../services/analytics";
import { usePublicPlanPricing } from "../services/public-plan-pricing";

export default function AICreatorsLanding() {
  const { t, locale } = useI18n();
  const { freePriceLabel, proPriceLabel, monthlySuffix } = usePublicPlanPricing(locale);

  useEffect(() => {
    trackAnalyticsEvent("landing_view", { intent: "ai_creators" });
  }, []);

  const cta = (target: string) => {
    trackAnalyticsEvent("landing_cta_click", { intent: "ai_creators", target });
    if (target.includes("pricing") || target.includes("plans") || target === "hero_primary" || target === "final") {
      trackAnalyticsEvent("conversion_intent", { origin: "aicreators_landing", target });
    }
  };

  return (
    <div className="aic-landing">
      {/* ── Hero ───────────────────────────────── */}
      <section className="aic-hero">
        <span className="aic-hero__tag">{t("aiCreators.hero.tagline")}</span>
        <h1>
          {t("aiCreators.hero.titleLine1")}
          <br />
          <span className="aic-hero__accent">{t("aiCreators.hero.titleLine2")}</span>
        </h1>
        <p className="aic-hero__sub">{t("aiCreators.hero.subtitle")}</p>
        <div className="aic-hero__actions">
          <a href="/ai-studio" className="aic-btn aic-btn--primary" onClick={() => cta("hero_primary")}>
            {t("aiCreators.hero.cta")}
          </a>
          <a href="/plans" className="aic-btn aic-btn--ghost" onClick={() => cta("hero_plans")}>
            {t("aiCreators.hero.ctaSecondary")}
          </a>
        </div>
      </section>

      {/* ── How it works / Pipeline ──────────── */}
      <section className="aic-pipeline">
        <h2>{t("aiCreators.pipeline.title")}</h2>
        <p className="aic-pipeline__sub">{t("aiCreators.pipeline.subtitle")}</p>
        <div className="aic-pipeline__steps">
          {[
            { num: "1", icon: "💬", key: "prompt" },
            { num: "2", icon: "🤖", key: "generate" },
            { num: "3", icon: "🔧", key: "customize" },
            { num: "4", icon: "📦", key: "export" },
          ].map(({ num, icon, key }) => (
            <div key={key} className="aic-pipeline__step">
              <div className="aic-pipeline__num">{num}</div>
              <span className="aic-pipeline__icon">{icon}</span>
              <h3>{t(`aiCreators.pipeline.${key}.title`)}</h3>
              <p>{t(`aiCreators.pipeline.${key}.desc`)}</p>
            </div>
          ))}
        </div>
        <div className="aic-pipeline__arrow">
          <span>💬 → 🤖 → 🔧 → 📦</span>
        </div>
      </section>

      {/* ── Use Cases ──────────────────────────── */}
      <section className="aic-usecases">
        <h2>{t("aiCreators.usecases.title")}</h2>
        <div className="aic-usecases__grid">
          {[
            { icon: "🖨️", key: "print" },
            { icon: "🎮", key: "gaming" },
            { icon: "🏠", key: "decor" },
            { icon: "🎁", key: "gifts" },
            { icon: "📐", key: "prototypes" },
            { icon: "🎨", key: "art" },
          ].map(({ icon, key }) => (
            <div key={key} className="aic-usecases__card">
              <span className="aic-usecases__icon">{icon}</span>
              <span>{t(`aiCreators.usecases.${key}`)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── No CAD needed / Benefits ─────────── */}
      <section className="aic-benefits">
        <h2>{t("aiCreators.benefits.title")}</h2>
        <p className="aic-benefits__sub">{t("aiCreators.benefits.subtitle")}</p>
        <div className="aic-benefits__grid">
          {[
            { icon: "🚫", key: "noSkills" },
            { icon: "🌐", key: "browser" },
            { icon: "⚡", key: "instant" },
            { icon: "🔄", key: "iterate" },
            { icon: "📂", key: "multiFormat" },
            { icon: "🌍", key: "publish" },
          ].map(({ icon, key }) => (
            <div key={key} className="aic-benefits__item">
              <span className="aic-benefits__icon">{icon}</span>
              <span>{t(`aiCreators.benefits.${key}`)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing Teaser ─────────────────────── */}
      <section className="aic-pricing">
        <h2>{t("aiCreators.pricing.title")}</h2>
        <p className="aic-pricing__sub">{t("aiCreators.pricing.subtitle")}</p>
        <div className="aic-pricing__cards">
          <div className="aic-pricing__card">
            <h3>Free</h3>
            <div className="aic-pricing__price">{freePriceLabel}</div>
            <p>{t("aiCreators.pricing.freeDesc")}</p>
            <a href="/ai-studio" className="aic-btn aic-btn--outline" onClick={() => cta("pricing_free")}>
              {t("aiCreators.pricing.freeCta")}
            </a>
          </div>
          <div className="aic-pricing__card aic-pricing__card--featured">
            <span className="aic-pricing__badge">{t("aiCreators.pricing.recommended")}</span>
            <h3>Pro</h3>
            <div className="aic-pricing__price">{proPriceLabel}<span>{monthlySuffix}</span></div>
            <p>{t("aiCreators.pricing.proDesc")}</p>
            <a href="/plans" className="aic-btn aic-btn--primary" onClick={() => cta("pricing_pro")}>
              {t("aiCreators.pricing.proCta")}
            </a>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────── */}
      <section className="aic-final">
        <h2>{t("aiCreators.finalCta.title")}</h2>
        <p>{t("aiCreators.finalCta.subtitle")}</p>
        <a href="/ai-studio" className="aic-btn aic-btn--primary aic-btn--lg" onClick={() => cta("final")}>
          {t("aiCreators.finalCta.button")}
        </a>
      </section>

      <style>{`
        .aic-landing {
          --aic-accent: #F59E0B;
          --aic-accent2: #8B5CF6;
          --aic-bg: #0B0E17;
          --aic-surface: #13162A;
          --aic-border: rgba(245,158,11,.18);
          font-family: 'Inter', system-ui, sans-serif;
          color: #E2E6F0;
          background: var(--aic-bg);
          overflow-x: hidden;
        }

        /* ── Hero ── */
        .aic-hero {
          text-align: center;
          padding: 5rem 1.5rem 3.5rem;
          background: radial-gradient(ellipse at 50% 0%, rgba(245,158,11,.18) 0%, transparent 65%);
        }
        .aic-hero__tag {
          display: inline-block;
          padding: .35rem 1.2rem;
          border-radius: 100px;
          background: rgba(245,158,11,.12);
          border: 1px solid var(--aic-border);
          color: var(--aic-accent);
          font-size: .85rem;
          font-weight: 600;
          letter-spacing: .04em;
          text-transform: uppercase;
          margin-bottom: 1.5rem;
        }
        .aic-hero h1 {
          font-size: clamp(2rem, 5vw, 3.4rem);
          font-weight: 800;
          line-height: 1.15;
          margin: 0 auto 1.2rem;
          max-width: 700px;
        }
        .aic-hero__accent {
          background: linear-gradient(135deg, var(--aic-accent) 0%, var(--aic-accent2) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .aic-hero__sub {
          font-size: 1.15rem;
          max-width: 560px;
          margin: 0 auto 2rem;
          color: #9BA3BF;
          line-height: 1.6;
        }
        .aic-hero__actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

        /* ── Buttons ── */
        .aic-btn {
          display: inline-flex; align-items: center; justify-content: center;
          padding: .75rem 2rem;
          border-radius: 12px;
          font-weight: 700;
          font-size: .95rem;
          text-decoration: none;
          transition: all .2s;
          cursor: pointer;
          border: none;
        }
        .aic-btn--primary {
          background: linear-gradient(135deg, var(--aic-accent), var(--aic-accent2));
          color: #fff;
        }
        .aic-btn--primary:hover { filter: brightness(1.15); transform: translateY(-1px); }
        .aic-btn--ghost {
          background: transparent;
          border: 1px solid var(--aic-border);
          color: #C4CAE0;
        }
        .aic-btn--ghost:hover { border-color: var(--aic-accent); color: #fff; }
        .aic-btn--outline {
          background: transparent;
          border: 1px solid var(--aic-border);
          color: var(--aic-accent);
        }
        .aic-btn--outline:hover { background: rgba(245,158,11,.1); }
        .aic-btn--lg { padding: 1rem 2.8rem; font-size: 1.1rem; }

        /* ── Pipeline ── */
        .aic-pipeline {
          padding: 4rem 1.5rem;
          text-align: center;
          background: var(--aic-surface);
        }
        .aic-pipeline h2 { font-size: 2rem; font-weight: 800; margin-bottom: .6rem; }
        .aic-pipeline__sub { color: #9BA3BF; margin-bottom: 2.5rem; }
        .aic-pipeline__steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          max-width: 900px;
          margin: 0 auto;
        }
        .aic-pipeline__step {
          padding: 1.5rem;
          border-radius: 16px;
          background: rgba(245,158,11,.05);
          border: 1px solid var(--aic-border);
        }
        .aic-pipeline__num {
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--aic-accent), var(--aic-accent2));
          color: #fff;
          font-weight: 800;
          margin: 0 auto .6rem;
        }
        .aic-pipeline__icon { font-size: 1.8rem; display: block; margin-bottom: .5rem; }
        .aic-pipeline__step h3 { font-size: 1rem; font-weight: 700; margin-bottom: .4rem; }
        .aic-pipeline__step p { font-size: .85rem; color: #9BA3BF; line-height: 1.5; }
        .aic-pipeline__arrow {
          margin-top: 2rem;
          font-size: 1.4rem;
          letter-spacing: .3em;
          color: #9BA3BF;
        }

        /* ── Use Cases ── */
        .aic-usecases {
          padding: 4rem 1.5rem;
          text-align: center;
        }
        .aic-usecases h2 { font-size: 2rem; font-weight: 800; margin-bottom: 2rem; }
        .aic-usecases__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          max-width: 780px;
          margin: 0 auto;
        }
        .aic-usecases__card {
          display: flex; align-items: center; gap: .8rem;
          padding: 1rem 1.4rem;
          background: var(--aic-surface);
          border: 1px solid var(--aic-border);
          border-radius: 14px;
          font-size: .95rem;
          text-align: left;
        }
        .aic-usecases__icon { font-size: 1.5rem; flex-shrink: 0; }

        /* ── Benefits ── */
        .aic-benefits {
          padding: 4rem 1.5rem;
          text-align: center;
          background: var(--aic-surface);
        }
        .aic-benefits h2 { font-size: 2rem; font-weight: 800; margin-bottom: .5rem; }
        .aic-benefits__sub { color: #9BA3BF; margin-bottom: 2.5rem; max-width: 500px; margin-left: auto; margin-right: auto; }
        .aic-benefits__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1rem;
          max-width: 780px;
          margin: 0 auto;
        }
        .aic-benefits__item {
          display: flex; align-items: center; gap: .8rem;
          padding: 1rem 1.4rem;
          background: var(--aic-bg);
          border: 1px solid rgba(139,92,246,.15);
          border-radius: 14px;
          font-size: .93rem;
          text-align: left;
        }
        .aic-benefits__icon { font-size: 1.4rem; flex-shrink: 0; }

        /* ── Pricing ── */
        .aic-pricing {
          padding: 4rem 1.5rem;
          text-align: center;
        }
        .aic-pricing h2 { font-size: 2rem; font-weight: 800; margin-bottom: .5rem; }
        .aic-pricing__sub { color: #9BA3BF; margin-bottom: 2.5rem; }
        .aic-pricing__cards {
          display: flex;
          justify-content: center;
          gap: 1.5rem;
          flex-wrap: wrap;
        }
        .aic-pricing__card {
          position: relative;
          padding: 2rem 1.8rem;
          border-radius: 20px;
          background: var(--aic-surface);
          border: 1px solid var(--aic-border);
          width: 260px;
          text-align: center;
        }
        .aic-pricing__card--featured {
          border-color: var(--aic-accent);
          box-shadow: 0 0 30px rgba(245,158,11,.15);
        }
        .aic-pricing__badge {
          position: absolute;
          top: -12px; left: 50%; transform: translateX(-50%);
          background: linear-gradient(135deg, var(--aic-accent), var(--aic-accent2));
          color: #fff;
          padding: .25rem 1rem;
          border-radius: 100px;
          font-size: .75rem;
          font-weight: 700;
          text-transform: uppercase;
        }
        .aic-pricing__price {
          font-size: 2.4rem;
          font-weight: 800;
          margin: .6rem 0;
          color: #fff;
        }
        .aic-pricing__price span { font-size: 1rem; font-weight: 400; color: #9BA3BF; }
        .aic-pricing__card p { font-size: .88rem; color: #9BA3BF; margin-bottom: 1.4rem; line-height: 1.5; }

        /* ── Final CTA ── */
        .aic-final {
          padding: 5rem 1.5rem;
          text-align: center;
          background: radial-gradient(ellipse at 50% 100%, rgba(245,158,11,.14) 0%, transparent 60%);
        }
        .aic-final h2 { font-size: 2rem; font-weight: 800; margin-bottom: .8rem; }
        .aic-final p { color: #9BA3BF; margin-bottom: 2rem; max-width: 460px; margin-left: auto; margin-right: auto; }

        /* ── Responsive ── */
        @media (max-width: 640px) {
          .aic-pricing__cards { flex-direction: column; align-items: center; }
          .aic-pipeline__arrow { display: none; }
        }
      `}</style>
    </div>
  );
}
