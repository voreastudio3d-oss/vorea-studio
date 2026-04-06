/**
 * AnalyticsInsightsTab — AI-powered analytics dashboard for SuperAdmin.
 * Shows KPIs, tool usage, signup funnel, and Gemini-generated insights.
 */
import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Zap,
  Target,
  Shield,
  ArrowUpRight,
  Eye,
  Download,
  UserPlus,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MetricRow {
  dimensions: Record<string, string>;
  metrics: Record<string, number>;
}

interface MetricsBundle {
  period: string;
  fetchedAt: string;
  overview: { sessions: number; activeUsers: number; newUsers: number; bounceRate: number };
  topEvents: MetricRow[];
  toolUsage: MetricRow[];
  exportEvents: MetricRow[];
  signupFunnel: MetricRow[];
  topPages: MetricRow[];
  pricingClicks: MetricRow[];
}

interface Insight {
  category: "activation" | "conversion" | "retention" | "growth" | "risk" | "trend_discovery";
  priority: "high" | "medium" | "low";
  title: string;
  insight: string;
  action: string;
  metric_reference: string;
}

interface InsightsResponse {
  period: string;
  generatedAt: string;
  metrics: MetricsBundle | null;
  insights: Insight[];
  cached: boolean;
  mock: boolean;
  configured: boolean;
  available: boolean;
  unavailableReason?: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL || "/api";

const CATEGORY_CONFIG: Record<string, { icon: typeof Sparkles; color: string; bg: string; label: string }> = {
  activation: { icon: Zap, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "Activación" },
  conversion: { icon: Target, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", label: "Conversión" },
  retention: { icon: Shield, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "Retención" },
  growth: { icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", label: "Crecimiento" },
  risk: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Riesgo" },
  trend_discovery: { icon: Sparkles, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", label: "Oportunidad 3D" },
};

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-500/20 text-red-300 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  low: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

const TOOL_COLORS: Record<string, string> = {
  studio: "#C6E36C",
  relief: "#60a5fa",
  ai_studio: "#a78bfa",
  organic: "#f97316",
  makerworld: "#2dd4bf",
  pricing: "#f472b6",
  community: "#fbbf24",
  gcode: "#6b7280",
  noticias: "#818cf8",
  explore: "#34d399",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AnalyticsInsightsTab() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");

  const fetchInsights = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("vorea_token") || "";
        const res = await fetch(
          `${API}/admin/analytics-insights?period=${period}&force=${force}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [period]
  );

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Cargando insights de analytics...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="text-center py-20 text-red-400">
        <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
        {error}
      </div>
    );
  }

  if (!data) return null;

  if (!data.available || !data.metrics) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Analytics Insights</h2>
              <p className="text-xs text-amber-400">
                Sin datos reales disponibles
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchInsights(true)}
            disabled={loading}
            className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all disabled:opacity-50"
            title="Reintentar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-medium mb-2">Este dashboard ya no usa mocks implícitos.</p>
          <p className="text-amber-100/80">
            {data.unavailableReason || "Configura GA4 antes de usar métricas de negocio en administración."}
          </p>
          {!data.configured && (
            <p className="text-amber-200/70 text-xs mt-3">
              Variables esperadas: <code>GA4_PROPERTY_ID</code> y <code>GA4_SERVICE_ACCOUNT_KEY</code>.
            </p>
          )}
        </div>
      </div>
    );
  }

  const { metrics, insights } = data;
  const funnel = {
    landing: metrics.signupFunnel.find((r) => r.dimensions.eventName === "landing_view")?.metrics.eventCount || 0,
    signupStart: metrics.signupFunnel.find((r) => r.dimensions.eventName === "sign_up_start")?.metrics.eventCount || 0,
    signupComplete: metrics.signupFunnel.find((r) => r.dimensions.eventName === "sign_up_complete")?.metrics.eventCount || 0,
    pricingClick: metrics.signupFunnel.find((r) => r.dimensions.eventName === "pricing_plan_click")?.metrics.eventCount || 0,
  };

  const maxToolCount = Math.max(1, ...metrics.toolUsage.map((r) => r.metrics.eventCount || 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Analytics Insights</h2>
            <p className="text-xs text-gray-500">
              {data.mock && <span className="text-amber-400 mr-1">[MOCK EXPLÍCITO]</span>}
              {data.cached && <span className="text-blue-400 mr-1">[CACHED]</span>}
              {data.generatedAt && timeAgo(data.generatedAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(["7d", "30d", "90d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                period === p
                  ? "bg-[#C6E36C]/20 text-[#C6E36C] border border-[#C6E36C]/30"
                  : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => fetchInsights(true)}
            disabled={loading}
            className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all disabled:opacity-50"
            title="Regenerar insights"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Eye} label="Sesiones" value={metrics.overview.sessions} color="text-blue-400" />
        <KpiCard icon={Users} label="Usuarios activos" value={metrics.overview.activeUsers} color="text-green-400" />
        <KpiCard icon={UserPlus} label="Nuevos" value={metrics.overview.newUsers} color="text-purple-400" />
        <KpiCard
          icon={Activity}
          label="Bounce rate"
          value={`${Math.round(metrics.overview.bounceRate * 100)}%`}
          color={metrics.overview.bounceRate > 0.5 ? "text-red-400" : "text-emerald-400"}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tool Usage Chart */}
        <div className="bg-white/[0.03] rounded-xl border border-white/10 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#C6E36C]" />
            Uso por herramienta
          </h3>
          <div className="space-y-2">
            {metrics.toolUsage.map((row) => {
              const tool = row.dimensions["customEvent:tool"] || "unknown";
              const count = row.metrics.eventCount || 0;
              const pct = (count / maxToolCount) * 100;
              return (
                <div key={tool} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-20 truncate text-right">{tool}</span>
                  <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: TOOL_COLORS[tool] || "#6b7280",
                        opacity: 0.8,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-12 text-right">{formatNum(count)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Signup Funnel */}
        <div className="bg-white/[0.03] rounded-xl border border-white/10 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            Funnel de activación
          </h3>
          <div className="space-y-3">
            {[
              { label: "Landing views", value: funnel.landing, color: "#C6E36C" },
              { label: "Pricing clicks", value: funnel.pricingClick, color: "#a78bfa" },
              { label: "Signup start", value: funnel.signupStart, color: "#60a5fa" },
              { label: "Signup complete", value: funnel.signupComplete, color: "#34d399" },
            ].map((step, i) => {
              const maxFunnel = funnel.landing || 1;
              const pct = (step.value / maxFunnel) * 100;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">{step.label}</span>
                    <span className="text-gray-300 font-medium">
                      {formatNum(step.value)}
                      {i > 0 && funnel.landing > 0 && (
                        <span className="text-gray-500 ml-1">({Math.round(pct)}%)</span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: step.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Export breakdown */}
          {metrics.exportEvents.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/5">
              <h4 className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <Download className="w-3 h-3" /> Exports
              </h4>
              <div className="flex flex-wrap gap-2">
                {metrics.exportEvents.map((row) => (
                  <span
                    key={row.dimensions.eventName}
                    className="px-2 py-1 text-xs rounded-md bg-white/5 text-gray-300 border border-white/10"
                  >
                    {row.dimensions.eventName?.replace("export_", "").toUpperCase()}: {row.metrics.eventCount}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Insights */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          Sugerencias IA
          <span className="text-xs text-gray-500 font-normal ml-1">
            Powered by Gemini
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {insights.map((insight, i) => {
            const cfg = CATEGORY_CONFIG[insight.category] || CATEGORY_CONFIG.growth;
            const Icon = cfg.icon;
            return (
              <div
                key={i}
                className={`rounded-xl border p-4 space-y-2 transition-all hover:border-opacity-50 ${cfg.bg}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                    <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_BADGE[insight.priority]}`}>
                    {insight.priority}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-white leading-snug">{insight.title}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">{insight.insight}</p>
                <div className="flex items-start gap-1.5 pt-1">
                  <ArrowUpRight className="w-3 h-3 text-[#C6E36C] mt-0.5 shrink-0" />
                  <p className="text-xs text-[#C6E36C]/80 leading-relaxed">{insight.action}</p>
                </div>
                <p className="text-[10px] text-gray-600 pt-1">{insight.metric_reference}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Pages */}
      {metrics.topPages.length > 0 && (
        <div className="bg-white/[0.03] rounded-xl border border-white/10 p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Páginas más visitadas</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {metrics.topPages.slice(0, 8).map((row) => (
              <div
                key={row.dimensions.pagePath}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
              >
                <span className="text-xs text-gray-300 font-mono truncate max-w-[60%]">
                  {row.dimensions.pagePath}
                </span>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{formatNum(row.metrics.screenPageViews || 0)} views</span>
                  <span>{formatNum(row.metrics.activeUsers || 0)} users</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Eye;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="bg-white/[0.03] rounded-xl border border-white/10 p-4 hover:border-white/20 transition-all">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <span className="text-xl font-bold text-white">
        {typeof value === "number" ? formatNum(value) : value}
      </span>
    </div>
  );
}

export default AnalyticsInsightsTab;
