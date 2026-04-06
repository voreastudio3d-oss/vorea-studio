import { useEffect } from "react";
import { useI18n } from "../services/i18n-context";
import { trackAnalyticsEvent, trackPageView } from "../services/analytics";
import {
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  ArrowRight,
  XCircle
} from "lucide-react";
import { Link } from "../nav";

export default function BenchmarkPage() {
  const { t } = useI18n();

  useEffect(() => {
    trackPageView("/benchmark");
    trackAnalyticsEvent("page_view", { page: "benchmark" });
  }, []);

  const getArray = (key: string): string[] => {
    const val = t(key) as unknown as string[];
    return Array.isArray(val) ? val : [];
  };

  const fodaItems = {
    strengths: getArray("benchmark.fodaStrengthsItems"),
    weaknesses: getArray("benchmark.fodaWeaknessesItems"),
    opportunities: getArray("benchmark.fodaOpportunitiesItems"),
    threats: getArray("benchmark.fodaThreatsItems"),
  };

  const modelPlatforms = ["MakerWorld", "Printables", "Thangs", "Thingiverse", "MyMiniFactory", "Cults"];
  const laserPlatforms = ["Ponoko", "DesignBundles", "Creative"];

  return (
    <div className="w-full min-h-screen bg-[#0d1117] text-white/90 pt-32 pb-24 selection:bg-[#C6E36C]/30 selection:text-[#C6E36C]">
      {/* ── Hero ───────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 mb-24 text-center">
        <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm mb-6 text-white/70">
          <span className="w-2 h-2 rounded-full bg-[#C6E36C] mr-2 animate-pulse" />
          Transparency & Vision
        </div>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
          {t("benchmark.heroTitle")}
        </h1>
        <p className="text-xl text-white/60 max-w-3xl mx-auto leading-relaxed">
          {t("benchmark.heroSubtitle")}
        </p>
      </section>

      {/* ── FODA / SWOT Analysis ──────────────── */}
      <section className="max-w-7xl mx-auto px-6 mb-32">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white/90">{t("benchmark.fodaTitle")}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Strengths */}
          <div className="bg-[#C6E36C]/5 border border-[#C6E36C]/20 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden group hover:border-[#C6E36C]/40 transition-colors">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#C6E36C]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-[#C6E36C]/20 flex items-center justify-center text-[#C6E36C]">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-[#C6E36C]">
                {t("benchmark.fodaStrengthsTitle")}
              </h3>
            </div>
            <ul className="space-y-4 relative z-10">
              {fodaItems.strengths.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-white/80">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#C6E36C]/60 shrink-0" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Weaknesses */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden group hover:border-red-500/40 transition-colors">
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-red-400">
                {t("benchmark.fodaWeaknessesTitle")}
              </h3>
            </div>
            <ul className="space-y-4 relative z-10">
              {fodaItems.weaknesses.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-white/80">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400/60 shrink-0" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Opportunities */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden group hover:border-blue-500/40 transition-colors">
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                <Lightbulb className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-blue-400">
                {t("benchmark.fodaOpportunitiesTitle")}
              </h3>
            </div>
            <ul className="space-y-4 relative z-10">
              {fodaItems.opportunities.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-white/80">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400/60 shrink-0" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Threats */}
          <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden group hover:border-orange-500/40 transition-colors">
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-orange-400">
                {t("benchmark.fodaThreatsTitle")}
              </h3>
            </div>
            <ul className="space-y-4 relative z-10">
              {fodaItems.threats.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-white/80">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-400/60 shrink-0" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Main Comparison Table ──────────────── */}
      <section className="max-w-7xl mx-auto px-6 mb-32">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white/90 mb-4">{t("benchmark.benchmarkTitle")}</h2>
        </div>

        {/* Categories 1: Models & Community */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-white/80 mb-8 border-b border-white/10 pb-4">
            {t("benchmark.benchmarkModelsTitle")}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-4 border-b border-white/10 text-white/50 font-medium uppercase text-xs tracking-wider min-w-[140px]">
                    {t("benchmark.bHeaderPlatform")}
                  </th>
                  <th className="p-4 border-b border-white/10 text-white/50 font-medium uppercase text-xs tracking-wider min-w-[250px]">
                    {t("benchmark.bHeaderWhy")}
                  </th>
                  <th className="p-4 border-b border-white/10 text-[#C6E36C]/70 font-medium uppercase text-xs tracking-wider min-w-[250px]">
                    {t("benchmark.bHeaderReplicate")}
                  </th>
                  <th className="p-4 border-b border-white/10 text-red-400/70 font-medium uppercase text-xs tracking-wider min-w-[250px]">
                    {t("benchmark.bHeaderAvoid")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {modelPlatforms.map((p) => (
                  <tr key={p} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 font-semibold text-white/90">{p}</td>
                    <td className="p-4 text-white/70 text-sm leading-relaxed">
                      {t(`benchmark.b${p}Why`)}
                    </td>
                    <td className="p-4 text-sm leading-relaxed">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#C6E36C] shrink-0 mt-0.5" />
                        <span className="text-white/80">{t(`benchmark.b${p}Replicate`)}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm leading-relaxed">
                      <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span className="text-white/60">{t(`benchmark.b${p}Avoid`)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Categories 2: Laser Cutting */}
        <div className="mb-16">
          <h3 className="text-2xl font-bold text-white/80 mb-8 border-b border-white/10 pb-4">
            {t("benchmark.laserTitle")}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-4 border-b border-white/10 text-white/50 font-medium uppercase text-xs tracking-wider min-w-[140px]">
                    {t("benchmark.bHeaderPlatform")}
                  </th>
                  <th className="p-4 border-b border-white/10 text-white/50 font-medium uppercase text-xs tracking-wider min-w-[250px]">
                    {t("benchmark.bHeaderWhy")}
                  </th>
                  <th className="p-4 border-b border-white/10 text-[#C6E36C]/70 font-medium uppercase text-xs tracking-wider min-w-[250px]">
                    {t("benchmark.bHeaderReplicate")}
                  </th>
                  <th className="p-4 border-b border-white/10 text-red-400/70 font-medium uppercase text-xs tracking-wider min-w-[250px]">
                    {t("benchmark.bHeaderAvoid")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {laserPlatforms.map((p) => (
                  <tr key={p} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 font-semibold text-white/90">{p}</td>
                    <td className="p-4 text-white/70 text-sm leading-relaxed">
                      {t(`benchmark.b${p}Why`)}
                    </td>
                    <td className="p-4 text-sm leading-relaxed">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#C6E36C] shrink-0 mt-0.5" />
                        <span className="text-white/80">{t(`benchmark.b${p}Replicate`)}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm leading-relaxed">
                      <div className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span className="text-white/60">{t(`benchmark.b${p}Avoid`)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Categories 3: News */}
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-white/80 mb-8 border-b border-white/10 pb-4">
             {t("benchmark.newsTitle")}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-4 border-b border-white/10 text-white/50 font-medium uppercase text-xs tracking-wider min-w-[140px]">
                    {t("benchmark.bHeaderPlatform")}
                  </th>
                  <th className="p-4 border-b border-white/10 text-white/50 font-medium uppercase text-xs tracking-wider min-w-[250px]">
                    {t("benchmark.bHeaderWhy")}
                  </th>
                  <th className="p-4 border-b border-white/10 text-[#C6E36C]/70 font-medium uppercase text-xs tracking-wider min-w-[250px]">
                    {t("benchmark.bHeaderReplicate")}
                  </th>
                  <th className="p-4 border-b border-white/10 text-red-400/70 font-medium uppercase text-xs tracking-wider min-w-[250px]">
                    {t("benchmark.bHeaderAvoid")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-semibold text-white/90">3D Hubs / Blogs</td>
                  <td className="p-4 text-white/70 text-sm leading-relaxed">
                    {t(`benchmark.bNewsDesc1`)}
                  </td>
                  <td className="p-4 text-sm leading-relaxed">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#C6E36C] shrink-0 mt-0.5" />
                      <span className="text-white/80">{t(`benchmark.bNewsReplicate1`)}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm leading-relaxed">
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span className="text-white/60">{t(`benchmark.bNewsAvoid1`)}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Call to action ──────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 text-center">
        <div className="bg-gradient-to-br from-white/5 to-[#C6E36C]/5 border border-white/10 rounded-2xl p-12">
          <h2 className="text-3xl font-bold mb-4">Build the future of parametric 3D with us</h2>
          <p className="text-white/60 mb-8 max-w-xl mx-auto">
            Vorea Studio is an open ecosystem where your creations live in the browser, powered by native code generation. No lock-ins, no legacy software constraints.
          </p>
          <Link
            to="/community"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#C6E36C] text-[#0d1117] font-bold rounded-lg hover:bg-white transition-colors"
          >
            Explore the Community
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
