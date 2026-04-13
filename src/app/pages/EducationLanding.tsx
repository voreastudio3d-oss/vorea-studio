import { useEffect } from "react";
import { useI18n } from "../services/i18n-context";
import { trackAnalyticsEvent } from "../services/analytics";
import { usePublicPlanPricing } from "../services/public-plan-pricing";

export default function EducationLanding() {
  const { t, locale } = useI18n();
  const { freePriceLabel, proPriceLabel, monthlySuffix } = usePublicPlanPricing(locale);

  useEffect(() => {
    trackAnalyticsEvent("landing_view", { intent: "education" });
  }, []);

  const cta = (target: string) => {
    trackAnalyticsEvent("landing_cta_click", { intent: "education", target });
    if (target.includes("pricing") || target.includes("plans") || target === "hero_primary" || target === "final") {
      trackAnalyticsEvent("conversion_intent", { origin: "education_landing", target });
    }
  };

  return (
    <div className="edu-landing">
      {/* ── Hero ───────────────────────────────── */}
      <section className="edu-hero">
        <span className="edu-hero__tag">{t("education.hero.tagline")}</span>
        <h1>
          {t("education.hero.titleLine1")}
          <br />
          <span className="edu-hero__accent">{t("education.hero.titleLine2")}</span>
        </h1>
        <p className="edu-hero__sub">{t("education.hero.subtitle")}</p>
        <div className="edu-hero__actions">
          <a href="/studio" className="edu-btn edu-btn--primary" onClick={() => cta("hero_primary")}>
            {t("education.hero.cta")}
          </a>
          <a href="/plans" className="edu-btn edu-btn--ghost" onClick={() => cta("hero_plans")}>
            {t("education.hero.ctaSecondary")}
          </a>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────── */}
      <section className="edu-stats">
        {[
          { icon: "🧩", label: t("education.stat.parametric") },
          { icon: "🌐", label: t("education.stat.browser") },
          { icon: "🤖", label: t("education.stat.ai") },
          { icon: "🆓", label: t("education.stat.free") },
        ].map((s) => (
          <div key={s.label} className="edu-stats__item">
            <span className="edu-stats__icon">{s.icon}</span>
            <span>{s.label}</span>
          </div>
        ))}
      </section>

      {/* ── Why STEM / Benefits ────────────────── */}
      <section className="edu-why">
        <h2>{t("education.why.title")}</h2>
        <p className="edu-why__sub">{t("education.why.subtitle")}</p>
        <div className="edu-why__grid">
          {[
            { icon: "💻", key: "noInstall" },
            { icon: "📐", key: "mathVisual" },
            { icon: "🤖", key: "aiAssisted" },
            { icon: "🎯", key: "projectBased" },
            { icon: "🌍", key: "multilang" },
            { icon: "🖨️", key: "printReady" },
          ].map(({ icon, key }) => (
            <div key={key} className="edu-why__card">
              <span className="edu-why__card-icon">{icon}</span>
              <span>{t(`education.why.${key}`)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Workflow / How it works ─────────────── */}
      <section className="edu-workflow">
        <h2>{t("education.workflow.title")}</h2>
        <div className="edu-workflow__steps">
          {[
            { num: "1", key: "step1" },
            { num: "2", key: "step2" },
            { num: "3", key: "step3" },
            { num: "4", key: "step4" },
          ].map(({ num, key }) => (
            <div key={key} className="edu-workflow__step">
              <div className="edu-workflow__num">{num}</div>
              <h3>{t(`education.workflow.${key}.title`)}</h3>
              <p>{t(`education.workflow.${key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comparison vs TinkerCAD ─────────────── */}
      <section className="edu-compare">
        <h2>{t("education.compare.title")}</h2>
        <div className="edu-compare__table">
          <div className="edu-compare__header">
            <span>{t("education.compare.feature")}</span>
            <span>Vorea Studio</span>
            <span>TinkerCAD</span>
          </div>
          {[
            { key: "parametricScad", vorea: true, tinker: false },
            { key: "aiGeneration", vorea: true, tinker: false },
            { key: "browserBased", vorea: true, tinker: true },
            { key: "multiExport", vorea: true, tinker: false },
            { key: "community", vorea: true, tinker: true },
            { key: "makerworld", vorea: true, tinker: false },
            { key: "multilang", vorea: true, tinker: false },
            { key: "freeTier", vorea: true, tinker: true },
          ].map(({ key, vorea, tinker }) => (
            <div key={key} className="edu-compare__row">
              <span>{t(`education.compare.row.${key}`)}</span>
              <span className={vorea ? "edu-compare__yes" : "edu-compare__no"}>{vorea ? "✓" : "—"}</span>
              <span className={tinker ? "edu-compare__yes" : "edu-compare__no"}>{tinker ? "✓" : "—"}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing Teaser ─────────────────────── */}
      <section className="edu-pricing">
        <h2>{t("education.pricing.title")}</h2>
        <p className="edu-pricing__sub">{t("education.pricing.subtitle")}</p>
        <div className="edu-pricing__cards">
          <div className="edu-pricing__card">
            <h3>Free</h3>
            <div className="edu-pricing__price">{freePriceLabel}</div>
            <p>{t("education.pricing.freeDesc")}</p>
            <a href="/plans" className="edu-btn edu-btn--outline" onClick={() => cta("pricing_free")}>
              {t("education.pricing.freeCta")}
            </a>
          </div>
          <div className="edu-pricing__card edu-pricing__card--featured">
            <span className="edu-pricing__badge">{t("education.pricing.ideal")}</span>
            <h3>Pro</h3>
            <div className="edu-pricing__price">{proPriceLabel}<span>{monthlySuffix}</span></div>
            <p>{t("education.pricing.proDesc")}</p>
            <a href="/plans" className="edu-btn edu-btn--primary" onClick={() => cta("pricing_pro")}>
              {t("education.pricing.proCta")}
            </a>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────── */}
      <section className="edu-final">
        <h2>{t("education.finalCta.title")}</h2>
        <p>{t("education.finalCta.subtitle")}</p>
        <a href="/studio" className="edu-btn edu-btn--primary edu-btn--lg" onClick={() => cta("final")}>
          {t("education.finalCta.button")}
        </a>
      </section>

      <style>{`
        .edu-landing {
          --edu-accent: #6C63FF;
          --edu-accent2: #00C9A7;
          --edu-bg: #0B0E17;
          --edu-surface: #13162A;
          --edu-border: rgba(108,99,255,.18);
          font-family: 'Inter', system-ui, sans-serif;
          color: #E2E6F0;
          background: var(--edu-bg);
          overflow-x: hidden;
        }

        /* ── Hero ── */
        .edu-hero {
          text-align: center;
          padding: 5rem 1.5rem 3.5rem;
          background: radial-gradient(ellipse at 50% 0%, rgba(108,99,255,.22) 0%, transparent 65%);
        }
        .edu-hero__tag {
          display: inline-block;
          padding: .35rem 1.2rem;
          border-radius: 100px;
          background: rgba(108,99,255,.14);
          border: 1px solid var(--edu-border);
          color: var(--edu-accent);
          font-size: .85rem;
          font-weight: 600;
          letter-spacing: .04em;
          text-transform: uppercase;
          margin-bottom: 1.5rem;
        }
        .edu-hero h1 {
          font-size: clamp(2rem, 5vw, 3.4rem);
          font-weight: 800;
          line-height: 1.15;
          margin: 0 auto 1.2rem;
          max-width: 680px;
        }
        .edu-hero__accent { color: var(--edu-accent); }
        .edu-hero__sub {
          font-size: 1.15rem;
          max-width: 560px;
          margin: 0 auto 2rem;
          color: #9BA3BF;
          line-height: 1.6;
        }
        .edu-hero__actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

        /* ── Buttons ── */
        .edu-btn {
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
        .edu-btn--primary {
          background: var(--edu-accent);
          color: #fff;
        }
        .edu-btn--primary:hover { filter: brightness(1.15); transform: translateY(-1px); }
        .edu-btn--ghost {
          background: transparent;
          border: 1px solid var(--edu-border);
          color: #C4CAE0;
        }
        .edu-btn--ghost:hover { border-color: var(--edu-accent); color: #fff; }
        .edu-btn--outline {
          background: transparent;
          border: 1px solid var(--edu-border);
          color: var(--edu-accent);
        }
        .edu-btn--outline:hover { background: rgba(108,99,255,.12); }
        .edu-btn--lg { padding: 1rem 2.8rem; font-size: 1.1rem; }

        /* ── Stats ── */
        .edu-stats {
          display: flex;
          justify-content: center;
          gap: 2rem;
          padding: 1.8rem 1.5rem;
          flex-wrap: wrap;
          border-top: 1px solid rgba(255,255,255,.05);
          border-bottom: 1px solid rgba(255,255,255,.05);
          background: var(--edu-surface);
        }
        .edu-stats__item {
          display: flex; align-items: center; gap: .5rem;
          font-size: .9rem; color: #9BA3BF;
        }
        .edu-stats__icon { font-size: 1.3rem; }

        /* ── Why STEM ── */
        .edu-why {
          padding: 4rem 1.5rem;
          text-align: center;
        }
        .edu-why h2 { font-size: 2rem; font-weight: 800; margin-bottom: .6rem; }
        .edu-why__sub { color: #9BA3BF; margin-bottom: 2.5rem; max-width: 520px; margin-left: auto; margin-right: auto; }
        .edu-why__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.2rem;
          max-width: 780px;
          margin: 0 auto;
        }
        .edu-why__card {
          display: flex; align-items: center; gap: .8rem;
          padding: 1rem 1.4rem;
          background: var(--edu-surface);
          border: 1px solid var(--edu-border);
          border-radius: 14px;
          font-size: .95rem;
          text-align: left;
        }
        .edu-why__card-icon { font-size: 1.5rem; flex-shrink: 0; }

        /* ── Workflow ── */
        .edu-workflow {
          padding: 4rem 1.5rem;
          text-align: center;
          background: var(--edu-surface);
        }
        .edu-workflow h2 { font-size: 2rem; font-weight: 800; margin-bottom: 2.5rem; }
        .edu-workflow__steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          max-width: 900px;
          margin: 0 auto;
        }
        .edu-workflow__step {
          padding: 1.5rem;
          border-radius: 16px;
          background: rgba(108,99,255,.06);
          border: 1px solid var(--edu-border);
        }
        .edu-workflow__num {
          width: 40px; height: 40px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 50%;
          background: var(--edu-accent);
          color: #fff;
          font-weight: 800;
          font-size: 1.1rem;
          margin: 0 auto 1rem;
        }
        .edu-workflow__step h3 { font-size: 1rem; font-weight: 700; margin-bottom: .5rem; }
        .edu-workflow__step p { font-size: .88rem; color: #9BA3BF; line-height: 1.5; }

        /* ── Comparison ── */
        .edu-compare {
          padding: 4rem 1.5rem;
          text-align: center;
        }
        .edu-compare h2 { font-size: 2rem; font-weight: 800; margin-bottom: 2rem; }
        .edu-compare__table {
          max-width: 640px;
          margin: 0 auto;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid var(--edu-border);
        }
        .edu-compare__header,
        .edu-compare__row {
          display: grid;
          grid-template-columns: 1.6fr 1fr 1fr;
          padding: .85rem 1.2rem;
          text-align: center;
          font-size: .9rem;
        }
        .edu-compare__header {
          background: var(--edu-accent);
          color: #fff;
          font-weight: 700;
        }
        .edu-compare__header span:first-child,
        .edu-compare__row span:first-child { text-align: left; }
        .edu-compare__row { background: var(--edu-surface); border-bottom: 1px solid rgba(255,255,255,.04); }
        .edu-compare__row:nth-child(even) { background: rgba(108,99,255,.04); }
        .edu-compare__yes { color: var(--edu-accent2); font-weight: 700; }
        .edu-compare__no { color: #6B6F80; }

        /* ── Pricing ── */
        .edu-pricing {
          padding: 4rem 1.5rem;
          text-align: center;
          background: var(--edu-surface);
        }
        .edu-pricing h2 { font-size: 2rem; font-weight: 800; margin-bottom: .5rem; }
        .edu-pricing__sub { color: #9BA3BF; margin-bottom: 2.5rem; }
        .edu-pricing__cards {
          display: flex;
          justify-content: center;
          gap: 1.5rem;
          flex-wrap: wrap;
        }
        .edu-pricing__card {
          position: relative;
          padding: 2rem 1.8rem;
          border-radius: 20px;
          background: var(--edu-bg);
          border: 1px solid var(--edu-border);
          width: 260px;
          text-align: center;
        }
        .edu-pricing__card--featured {
          border-color: var(--edu-accent);
          box-shadow: 0 0 30px rgba(108,99,255,.18);
        }
        .edu-pricing__badge {
          position: absolute;
          top: -12px; left: 50%; transform: translateX(-50%);
          background: var(--edu-accent);
          color: #fff;
          padding: .25rem 1rem;
          border-radius: 100px;
          font-size: .75rem;
          font-weight: 700;
          text-transform: uppercase;
        }
        .edu-pricing__price {
          font-size: 2.4rem;
          font-weight: 800;
          margin: .6rem 0;
          color: #fff;
        }
        .edu-pricing__price span { font-size: 1rem; font-weight: 400; color: #9BA3BF; }
        .edu-pricing__card p { font-size: .88rem; color: #9BA3BF; margin-bottom: 1.4rem; line-height: 1.5; }

        /* ── Final CTA ── */
        .edu-final {
          padding: 5rem 1.5rem;
          text-align: center;
          background: radial-gradient(ellipse at 50% 100%, rgba(108,99,255,.16) 0%, transparent 60%);
        }
        .edu-final h2 { font-size: 2rem; font-weight: 800; margin-bottom: .8rem; }
        .edu-final p { color: #9BA3BF; margin-bottom: 2rem; max-width: 440px; margin-left: auto; margin-right: auto; }

        /* ── Responsive ── */
        @media (max-width: 640px) {
          .edu-stats { gap: 1rem; }
          .edu-compare__header, .edu-compare__row { font-size: .8rem; padding: .7rem .8rem; }
          .edu-pricing__cards { flex-direction: column; align-items: center; }
        }
      `}</style>
    </div>
  );
}
