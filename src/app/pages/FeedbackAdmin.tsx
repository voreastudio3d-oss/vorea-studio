/**
 * FeedbackAdmin – Admin dashboard for AI-reviewed feedback + Engine Telemetry.
 * Includes a simulated "cron job" that auto-triggers AI review
 * at configurable intervals (e.g., every 5, 15, 30 min).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bot,
  Play,
  Pause,
  RefreshCw,
  Clock,
  AlertTriangle,
  Bug,
  Lightbulb,
  TrendingUp,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  BarChart3,
  Loader2,
  Timer,
  Zap,
  MessageSquare,
  ArrowUpDown,
  Eye,
  Sparkles,
  Activity,
  BarChart2,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { FeedbackApi, TelemetryApi } from "../services/api-client";
import type { TelemetryInsights } from "../services/api-client";
import { useAuth } from "../services/auth-context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AIReview {
  category: string;
  priority: string;
  sentiment: string;
  summary: string;
  suggestedAction: string;
  affectedArea: string;
  tags: string[];
}

interface FeedbackItem {
  id: string;
  type: string;
  message: string;
  userId: string;
  userEmail?: string;
  createdAt: string;
  status: string;
  aiReview?: AIReview | null;
  aiReviewedAt?: string | null;
}

interface AIStats {
  total: number;
  reviewed: number;
  open: number;
  priorities: Record<string, number>;
  categories: Record<string, number>;
  sentiments: Record<string, number>;
  areas: Record<string, number>;
  lastRun: { runAt: string; reviewed: number; model: string } | null;
  totalRuns: number;
}

type CronInterval = 5 | 15 | 30 | 60;
type FilterType = "all" | "open" | "reviewed" | "resolved" | "dismissed";
type SortField = "date" | "priority" | "sentiment";
type AdminTab = "feedback" | "telemetry";

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30" },
  high: { bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30" },
  medium: { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
  low: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" },
};

const SENTIMENT_ICONS: Record<string, { icon: string; color: string }> = {
  positive: { icon: "+", color: "text-green-400" },
  neutral: { icon: "~", color: "text-gray-400" },
  negative: { icon: "-", color: "text-red-400" },
};

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  bug: { label: "Bug", color: "text-red-400" },
  feature_request: { label: "Feature", color: "text-purple-400" },
  ux_issue: { label: "UX", color: "text-amber-400" },
  performance: { label: "Performance", color: "text-orange-400" },
  documentation: { label: "Docs", color: "text-blue-400" },
  praise: { label: "Elogio", color: "text-green-400" },
  spam: { label: "Spam", color: "text-gray-500" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function FeedbackAdmin() {
  const { isLoggedIn, isSuperAdmin } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<AdminTab>("feedback");

  // Data
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [stats, setStats] = useState<AIStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);

  // Telemetry data
  const [telemetryData, setTelemetryData] = useState<TelemetryInsights | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [telemetryDays, setTelemetryDays] = useState(30);

  // Cron job state
  const [cronActive, setCronActive] = useState(false);
  const [cronInterval, setCronInterval] = useState<CronInterval>(15);
  const [nextRunIn, setNextRunIn] = useState(0);
  const cronRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // UI state
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showIntervalPicker, setShowIntervalPicker] = useState(false);

  // ─── Fetch data ──────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [items, aiStats] = await Promise.all([
        FeedbackApi.list(),
        FeedbackApi.getAIStats(),
      ]);
      setFeedbackItems(items || []);
      setStats(aiStats);
    } catch (err) {
      console.error("Error fetching feedback data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTelemetry = useCallback(async (days?: number) => {
    setTelemetryLoading(true);
    try {
      const data = await TelemetryApi.getInsights(days ?? telemetryDays);
      setTelemetryData(data);
    } catch (err) {
      console.error("Error fetching telemetry:", err);
    } finally {
      setTelemetryLoading(false);
    }
  }, [telemetryDays]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [isLoggedIn, fetchData]);

  // Fetch telemetry when tab switches to telemetry
  useEffect(() => {
    if (activeTab === "telemetry" && !telemetryData && isLoggedIn) {
      fetchTelemetry();
    }
  }, [activeTab, telemetryData, isLoggedIn, fetchTelemetry]);

  // ─── AI Review trigger ───────────────────────────────────────────────

  const runAIReview = useCallback(async () => {
    setReviewing(true);
    try {
      const result = await FeedbackApi.triggerAIReview();
      if (result.reviewed > 0) {
        toast.success(`IA reviso ${result.reviewed} feedbacks`);
      } else {
        toast.info(result.message || "No hay feedback pendiente");
      }
      await fetchData();
    } catch (err: any) {
      toast.error(`Error en revision IA: ${err.message}`);
      console.error("AI review error:", err);
    } finally {
      setReviewing(false);
    }
  }, [fetchData]);

  // ─── Cron job logic ──────────────────────────────────────────────────

  const startCron = useCallback(() => {
    // Clear existing
    if (cronRef.current) clearInterval(cronRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    const intervalMs = cronInterval * 60 * 1000;
    setNextRunIn(cronInterval * 60);

    // Countdown timer
    countdownRef.current = setInterval(() => {
      setNextRunIn((prev) => {
        if (prev <= 1) return cronInterval * 60;
        return prev - 1;
      });
    }, 1000);

    // Actual cron
    cronRef.current = setInterval(() => {
      console.log(`[Cron] Auto-triggering AI feedback review at ${new Date().toISOString()}`);
      runAIReview();
      setNextRunIn(cronInterval * 60);
    }, intervalMs);

    setCronActive(true);
    toast.success(`Cron activado: revision cada ${cronInterval} min`);
  }, [cronInterval, runAIReview]);

  const stopCron = useCallback(() => {
    if (cronRef.current) {
      clearInterval(cronRef.current);
      cronRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCronActive(false);
    setNextRunIn(0);
    toast.info("Cron detenido");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cronRef.current) clearInterval(cronRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ─── Update status ──────────────────────────────────────────────────

  const updateStatus = useCallback(
    async (id: string, newStatus: string) => {
      try {
        await FeedbackApi.updateStatus(id, newStatus);
        toast.success(`Estado actualizado: ${newStatus}`);
        await fetchData();
      } catch (err: any) {
        toast.error(`Error: ${err.message}`);
      }
    },
    [fetchData]
  );

  // ─── Filtering & sorting ─────────────────────────────────────────────

  const filtered = feedbackItems.filter((fb) => {
    if (filter === "all") return true;
    return fb.status === filter;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === "date") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortField === "priority") {
      const pa = PRIORITY_ORDER[a.aiReview?.priority || "low"] ?? 3;
      const pb = PRIORITY_ORDER[b.aiReview?.priority || "low"] ?? 3;
      return pa - pb;
    }
    // sentiment: negative first
    const sentOrder: Record<string, number> = { negative: 0, neutral: 1, positive: 2 };
    const sa = sentOrder[a.aiReview?.sentiment || "neutral"] ?? 1;
    const sb = sentOrder[b.aiReview?.sentiment || "neutral"] ?? 1;
    return sa - sb;
  });

  // ─── Format helpers ──────────────────────────────────────────────────

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ─── Not logged in ──────────────────────────────────────────────────

  if (!isLoggedIn || !isSuperAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Bot className="w-16 h-16 text-gray-600 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-300">
            Feedback Admin
          </h2>
          <p className="text-sm text-gray-500">
            {!isLoggedIn
              ? "Inicia sesion para acceder al panel de revision de feedback con IA."
              : "Acceso restringido a superadministradores."}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              Admin Panel
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Feedback AI Review + Engine Telemetry
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "feedback" && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-2 text-xs"
                  onClick={fetchData}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refrescar
                </Button>
                <Button
                  size="sm"
                  className="gap-2 text-xs"
                  onClick={runAIReview}
                  disabled={reviewing}
                >
                  {reviewing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {reviewing ? "Analizando..." : "Ejecutar revision IA"}
                </Button>
              </>
            )}
            {activeTab === "telemetry" && (
              <Button
                size="sm"
                variant="secondary"
                className="gap-2 text-xs"
                onClick={() => fetchTelemetry()}
                disabled={telemetryLoading}
              >
                {telemetryLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Refrescar
              </Button>
            )}
          </div>
        </div>

        {/* ─── Tab Switcher ──────────────────────────────────────────── */}
        <div className="flex gap-1 bg-background rounded-xl p-1 border border-border-subtle">
          <button
            onClick={() => setActiveTab("feedback")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "feedback"
                ? "bg-surface-raised text-primary border border-primary/20 shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Feedback AI Review
          </button>
          <button
            onClick={() => setActiveTab("telemetry")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "telemetry"
                ? "bg-surface-raised text-primary border border-primary/20 shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Engine Telemetry
          </button>
        </div>

        {activeTab === "feedback" && (<>

        {/* ─── Cron Job Control ───────────────────────────────────────── */}
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  cronActive
                    ? "bg-green-500/15 border border-green-500/30"
                    : "bg-gray-500/15 border border-gray-500/30"
                }`}
              >
                <Timer
                  className={`w-5 h-5 ${
                    cronActive ? "text-green-400" : "text-gray-500"
                  }`}
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Cron Job Automatico
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      cronActive
                        ? "bg-green-500/15 text-green-400 border border-green-500/30"
                        : "bg-gray-500/15 text-gray-500 border border-gray-500/30"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        cronActive ? "bg-green-400 animate-pulse" : "bg-gray-500"
                      }`}
                    />
                    {cronActive ? "Activo" : "Inactivo"}
                  </span>
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Revisa feedback pendiente automaticamente cada{" "}
                  <span className="text-gray-300">{cronInterval} minutos</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Interval picker */}
              <div className="relative">
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-surface-raised border border-border text-gray-300 hover:border-border-faint transition-colors"
                  onClick={() => setShowIntervalPicker(!showIntervalPicker)}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {cronInterval} min
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showIntervalPicker && (
                  <div className="absolute top-full mt-1 right-0 bg-surface-raised border border-border rounded-lg shadow-xl z-10 overflow-hidden">
                    {([5, 15, 30, 60] as CronInterval[]).map((val) => (
                      <button
                        key={val}
                        className={`block w-full px-4 py-2 text-xs text-left hover:bg-white/5 transition-colors ${
                          cronInterval === val
                            ? "text-primary bg-primary/5"
                            : "text-gray-400"
                        }`}
                        onClick={() => {
                          setCronInterval(val);
                          setShowIntervalPicker(false);
                          if (cronActive) {
                            stopCron();
                            // Restart with new interval after brief delay
                            setTimeout(() => startCron(), 100);
                          }
                        }}
                      >
                        Cada {val} min
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {cronActive ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5 text-xs text-red-400 hover:text-red-300"
                  onClick={stopCron}
                >
                  <Pause className="w-3.5 h-3.5" />
                  Detener
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={startCron}
                >
                  <Play className="w-3.5 h-3.5" />
                  Iniciar
                </Button>
              )}
            </div>
          </div>

          {/* Countdown & last run */}
          {cronActive && (
            <div className="mt-4 flex items-center gap-6 text-xs">
              <div className="flex items-center gap-2 text-gray-400">
                <Zap className="w-3.5 h-3.5 text-primary" />
                Proxima ejecucion en{" "}
                <span className="font-mono text-white bg-background px-2 py-0.5 rounded">
                  {formatCountdown(nextRunIn)}
                </span>
              </div>
              {stats?.lastRun && (
                <div className="flex items-center gap-2 text-gray-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  Ultima ejecucion:{" "}
                  <span className="text-gray-400">
                    {formatDate(stats.lastRun.runAt)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Stats Grid ─────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard
              label="Total"
              value={stats.total}
              icon={<MessageSquare className="w-4 h-4" />}
              color="text-white"
            />
            <StatCard
              label="Pendientes"
              value={stats.open}
              icon={<Clock className="w-4 h-4" />}
              color="text-amber-400"
              highlight={stats.open > 0}
            />
            <StatCard
              label="Revisados"
              value={stats.reviewed}
              icon={<CheckCircle2 className="w-4 h-4" />}
              color="text-green-400"
            />
            <StatCard
              label="Criticos"
              value={stats.priorities.critical || 0}
              icon={<AlertTriangle className="w-4 h-4" />}
              color="text-red-400"
              highlight={(stats.priorities.critical || 0) > 0}
            />
            <StatCard
              label="Altos"
              value={stats.priorities.high || 0}
              icon={<TrendingUp className="w-4 h-4" />}
              color="text-orange-400"
            />
            <StatCard
              label="Ejecuciones IA"
              value={stats.totalRuns}
              icon={<Bot className="w-4 h-4" />}
              color="text-purple-400"
            />
            <StatCard
              label="Sentimiento -"
              value={stats.sentiments.negative || 0}
              icon={<XCircle className="w-4 h-4" />}
              color="text-red-400"
            />
          </div>
        )}

        {/* ─── Category & Area Breakdown ──────────────────────────────── */}
        {stats && (stats.reviewed > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Categories */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5" /> Categorias
              </h4>
              <div className="space-y-2">
                {Object.entries(stats.categories)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, count]) => {
                    const config = CATEGORY_LABELS[cat] || {
                      label: cat,
                      color: "text-gray-400",
                    };
                    const pct = Math.round((count / stats.reviewed) * 100);
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span
                          className={`text-[10px] font-medium w-20 ${config.color}`}
                        >
                          {config.label}
                        </span>
                        <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/40 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 w-10 text-right">
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Affected Areas */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5" /> Areas afectadas
              </h4>
              <div className="space-y-2">
                {Object.entries(stats.areas)
                  .sort((a, b) => b[1] - a[1])
                  .map(([area, count]) => {
                    const pct = Math.round((count / stats.reviewed) * 100);
                    return (
                      <div key={area} className="flex items-center gap-3">
                        <span className="text-[10px] font-medium w-20 text-gray-300 capitalize">
                          {area.replace("_", " ")}
                        </span>
                        <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500/40 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 w-10 text-right">
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ─── Filters & Sort ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filtrar:
          </span>
          {(["all", "open", "reviewed", "resolved", "dismissed"] as FilterType[]).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-[11px] transition-all border ${
                  filter === f
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-surface-raised border-border-subtle text-gray-500 hover:text-gray-300"
                }`}
              >
                {f === "all"
                  ? "Todos"
                  : f === "open"
                  ? "Pendientes"
                  : f === "reviewed"
                  ? "Revisados"
                  : f === "resolved"
                  ? "Resueltos"
                  : "Descartados"}
              </button>
            )
          )}

          <span className="ml-4 text-xs text-gray-500 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" /> Ordenar:
          </span>
          {(["date", "priority", "sentiment"] as SortField[]).map((s) => (
            <button
              key={s}
              onClick={() => setSortField(s)}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all border ${
                sortField === s
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-surface-raised border-border-subtle text-gray-500 hover:text-gray-300"
              }`}
            >
              {s === "date"
                ? "Fecha"
                : s === "priority"
                ? "Prioridad"
                : "Sentimiento"}
            </button>
          ))}

          <span className="ml-auto text-[11px] text-gray-600">
            {sorted.length} resultado{sorted.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ─── Feedback List ──────────────────────────────────────────── */}
        <div className="space-y-3">
          {sorted.length === 0 ? (
            <div className="bg-surface border border-border-subtle rounded-xl p-12 text-center">
              <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                No hay feedback{" "}
                {filter !== "all" ? `con estado "${filter}"` : "registrado"}
              </p>
            </div>
          ) : (
            sorted.map((fb) => (
              <FeedbackCard
                key={fb.id}
                item={fb}
                expanded={expandedId === fb.id}
                onToggle={() =>
                  setExpandedId(expandedId === fb.id ? null : fb.id)
                }
                onUpdateStatus={updateStatus}
              />
            ))
          )}
        </div>
        </>)}

        {/* ─── Telemetry Tab ─────────────────────────────────────────── */}
        {activeTab === "telemetry" && (
          <TelemetryTab
            data={telemetryData}
            loading={telemetryLoading}
            days={telemetryDays}
            onDaysChange={(d) => { setTelemetryDays(d); fetchTelemetry(d); }}
          />
        )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-surface rounded-xl border p-3 text-center transition-all ${
        highlight
          ? "border-red-500/30 ring-1 ring-red-500/10"
          : "border-border-subtle"
      }`}
    >
      <div className={`${color} mx-auto mb-1`}>{icon}</div>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}

function FeedbackCard({
  item,
  expanded,
  onToggle,
  onUpdateStatus,
}: {
  item: FeedbackItem;
  expanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (id: string, status: string) => void;
}) {
  const review = item.aiReview;
  const priorityCfg = PRIORITY_COLORS[review?.priority || "low"] || PRIORITY_COLORS.low;
  const catCfg = CATEGORY_LABELS[review?.category || ""] || {
    label: review?.category || item.type,
    color: "text-gray-400",
  };
  const sentCfg = SENTIMENT_ICONS[review?.sentiment || "neutral"] || SENTIMENT_ICONS.neutral;

  const statusColors: Record<string, string> = {
    open: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    reviewed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    resolved: "bg-green-500/15 text-green-400 border-green-500/30",
    dismissed: "bg-gray-500/15 text-gray-500 border-gray-500/30",
  };

  return (
    <div
      className={`bg-surface border rounded-xl overflow-hidden transition-all ${
        review?.priority === "critical"
          ? "border-red-500/25"
          : "border-border"
      }`}
    >
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
        onClick={onToggle}
      >
        {/* Priority indicator */}
        <div
          className={`w-2 h-8 rounded-full ${
            review?.priority === "critical"
              ? "bg-red-500"
              : review?.priority === "high"
              ? "bg-orange-500"
              : review?.priority === "medium"
              ? "bg-amber-500"
              : "bg-blue-500/50"
          }`}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {/* Status badge */}
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border ${
                statusColors[item.status] || statusColors.open
              }`}
            >
              {item.status}
            </span>

            {/* Category */}
            {review && (
              <span className={`text-[10px] font-medium ${catCfg.color}`}>
                {catCfg.label}
              </span>
            )}

            {/* Priority */}
            {review && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] border ${priorityCfg.bg} ${priorityCfg.text} ${priorityCfg.border}`}
              >
                {review.priority}
              </span>
            )}

            {/* Sentiment */}
            {review && (
              <span className={`text-xs font-bold ${sentCfg.color}`}>
                {sentCfg.icon}
              </span>
            )}

            {/* AI badge */}
            {review && (
              <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[8px] px-1.5 py-0">
                <Bot className="w-2.5 h-2.5 mr-0.5" />
                IA
              </Badge>
            )}
          </div>

          <p className="text-sm text-gray-200 truncate">
            {review?.summary || item.message}
          </p>
          <p className="text-[10px] text-gray-600 mt-0.5">
            {item.userEmail || item.userId} &middot;{" "}
            {new Date(item.createdAt).toLocaleDateString("es-MX", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border-subtle p-4 space-y-4">
          {/* Original message */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">
              Mensaje original
            </label>
            <p className="text-sm text-gray-300 bg-background rounded-lg p-3 leading-relaxed">
              {item.message}
            </p>
          </div>

          {/* AI Analysis */}
          {review && (
            <div className="space-y-3">
              <label className="text-[10px] text-gray-500 uppercase tracking-wider block flex items-center gap-1">
                <Bot className="w-3 h-3 text-purple-400" />
                Analisis IA (Gemini)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-background rounded-lg p-3">
                  <p className="text-[9px] text-gray-600 uppercase mb-1">
                    Resumen
                  </p>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {review.summary}
                  </p>
                </div>
                <div className="bg-background rounded-lg p-3">
                  <p className="text-[9px] text-gray-600 uppercase mb-1">
                    Accion sugerida
                  </p>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {review.suggestedAction}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="bg-background rounded-lg px-3 py-2">
                  <p className="text-[9px] text-gray-600">Area</p>
                  <p className="text-xs text-gray-300 capitalize">
                    {review.affectedArea?.replace("_", " ")}
                  </p>
                </div>
                <div className="bg-background rounded-lg px-3 py-2">
                  <p className="text-[9px] text-gray-600">Categoria</p>
                  <p className={`text-xs ${catCfg.color}`}>{catCfg.label}</p>
                </div>
                <div className="bg-background rounded-lg px-3 py-2">
                  <p className="text-[9px] text-gray-600">Prioridad</p>
                  <p className={`text-xs ${priorityCfg.text}`}>
                    {review.priority}
                  </p>
                </div>
                <div className="bg-background rounded-lg px-3 py-2">
                  <p className="text-[9px] text-gray-600">Sentimiento</p>
                  <p className={`text-xs ${sentCfg.color}`}>
                    {review.sentiment}
                  </p>
                </div>
              </div>

              {/* Tags */}
              {review.tags && review.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {review.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full bg-primary/10 text-primary/80 text-[9px] border border-primary/15"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {item.aiReviewedAt && (
                <p className="text-[9px] text-gray-600">
                  Revisado por IA el{" "}
                  {new Date(item.aiReviewedAt).toLocaleString("es-MX")}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border-faint">
            <span className="text-[10px] text-gray-500 mr-2">
              Cambiar estado:
            </span>
            {(["open", "reviewed", "resolved", "dismissed"] as const).map(
              (st) => (
                <button
                  key={st}
                  onClick={() => onUpdateStatus(item.id, st)}
                  disabled={item.status === st}
                  className={`px-2 py-1 rounded text-[10px] transition-all border ${
                    item.status === st
                      ? "bg-white/5 border-white/10 text-white cursor-default"
                      : "bg-surface-raised border-border-subtle text-gray-500 hover:text-gray-300 hover:border-border"
                  }`}
                >
                  {st === "open"
                    ? "Pendiente"
                    : st === "reviewed"
                    ? "Revisado"
                    : st === "resolved"
                    ? "Resuelto"
                    : "Descartado"}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Telemetry Tab ────────────────────────────────────────────────────────────

const TRIGGER_COLORS: Record<string, string> = {
  generation: "bg-primary",
  export_stl: "bg-blue-400",
  export_3mf: "bg-purple-400",
  warning: "bg-amber-400",
  crash: "bg-red-400",
  user_feedback: "bg-teal-400",
};

const MESH_SCORE_COLORS: Record<string, { bg: string; text: string }> = {
  printable: { bg: "bg-green-500/40", text: "text-green-400" },
  warnings: { bg: "bg-amber-500/40", text: "text-amber-400" },
  "not-printable": { bg: "bg-red-500/40", text: "text-red-400" },
};

function TelemetryTab({
  data,
  loading,
  days,
  onDaysChange,
}: {
  data: TelemetryInsights | null;
  loading: boolean;
  days: number;
  onDaysChange: (d: number) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-surface border border-border-subtle rounded-xl p-12 text-center">
        <Activity className="w-12 h-12 text-gray-700 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          No se pudieron cargar los datos de telemetria
        </p>
      </div>
    );
  }

  const maxTriggerCount = Math.max(1, ...data.byTrigger.map((t) => t.count));
  const maxSurfaceCount = Math.max(1, ...data.bySurfaceMode.map((s) => s.count));
  const maxGenTime = Math.max(1, ...data.avgGenTime.map((g) => g.avgMs));

  return (
    <div className="space-y-5">
      {/* ─── Time range selector + summary ────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-cyan-500/15 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Engine Telemetry</h3>
            <p className="text-[11px] text-gray-500">
              <span className="text-white font-bold">{data.totalEvents.toLocaleString()}</span> eventos en los ultimos{" "}
              <span className="text-gray-300">{data.daysBack}</span> dias
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {[7, 14, 30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => onDaysChange(d)}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all border ${
                days === d
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-surface-raised border-border-subtle text-gray-500 hover:text-gray-300"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {data.totalEvents === 0 ? (
        <div className="bg-surface border border-border-subtle rounded-xl p-12 text-center">
          <BarChart2 className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            Aun no hay eventos de telemetria registrados
          </p>
          <p className="text-[10px] text-gray-600 mt-1">
            Los eventos aparecen cuando los usuarios generan relieves, exportan STL/3MF, etc.
          </p>
        </div>
      ) : (
        <>
          {/* ─── KPI Cards ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface rounded-xl border border-border-subtle p-4 text-center">
              <p className="text-2xl font-bold text-white">{data.totalEvents.toLocaleString()}</p>
              <p className="text-[10px] text-gray-500 mt-1">Total de eventos</p>
            </div>
            <div className="bg-surface rounded-xl border border-border-subtle p-4 text-center">
              <p className="text-2xl font-bold text-primary">
                {data.byTrigger.find((t) => t.trigger === "generation")?.count.toLocaleString() || "0"}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">Generaciones</p>
            </div>
            <div className="bg-surface rounded-xl border border-border-subtle p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">
                {((data.byTrigger.find((t) => t.trigger === "export_stl")?.count || 0) +
                  (data.byTrigger.find((t) => t.trigger === "export_3mf")?.count || 0)).toLocaleString()}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">Exportaciones</p>
            </div>
            <div className="bg-surface rounded-xl border border-border-subtle p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">
                {data.byMeshScore.find((m) => m.meshScore === "warnings")?.count.toLocaleString() || "0"}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">Warnings mesh</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ─── Events by Trigger ──────────────────────────── */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-primary" /> Eventos por tipo
              </h4>
              <div className="space-y-2.5">
                {data.byTrigger.map((t) => {
                  const pct = Math.round((t.count / maxTriggerCount) * 100);
                  const color = TRIGGER_COLORS[t.trigger] || "bg-gray-500";
                  return (
                    <div key={t.trigger} className="flex items-center gap-3">
                      <span className="text-[10px] font-medium w-24 text-gray-300 truncate">
                        {t.trigger.replace(/_/g, " ")}
                      </span>
                      <div className="flex-1 h-3 bg-background rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 w-12 text-right font-mono">
                        {t.count.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── Events by Surface Mode ─────────────────────── */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-purple-400" /> SurfaceMode mas usados
              </h4>
              <div className="space-y-2.5">
                {data.bySurfaceMode.map((s) => {
                  const pct = Math.round((s.count / maxSurfaceCount) * 100);
                  return (
                    <div key={s.surfaceMode} className="flex items-center gap-3">
                      <span className="text-[10px] font-medium w-24 text-gray-300 truncate capitalize">
                        {s.surfaceMode}
                      </span>
                      <div className="flex-1 h-3 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500/50 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 w-12 text-right font-mono">
                        {s.count.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── Mesh Health Distribution ────────────────────── */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Salud del Mesh
              </h4>
              {data.byMeshScore.length === 0 ? (
                <p className="text-[11px] text-gray-600">Sin datos de mesh score</p>
              ) : (
                <div className="space-y-3">
                  {data.byMeshScore.map((m) => {
                    const totalMesh = data.byMeshScore.reduce((a, b) => a + b.count, 0);
                    const pct = Math.round((m.count / totalMesh) * 100);
                    const cfg = MESH_SCORE_COLORS[m.meshScore] || { bg: "bg-gray-500/40", text: "text-gray-400" };
                    return (
                      <div key={m.meshScore} className="flex items-center gap-3">
                        <span className={`text-[10px] font-medium w-28 ${cfg.text}`}>
                          {m.meshScore === "not-printable" ? "No imprimible" : m.meshScore === "warnings" ? "Con warnings" : "Imprimible"}
                        </span>
                        <div className="flex-1 h-3 bg-background rounded-full overflow-hidden">
                          <div
                            className={`h-full ${cfg.bg} rounded-full transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 w-16 text-right font-mono">
                          {m.count.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── Avg Generation Time ─────────────────────────── */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <Timer className="w-3.5 h-3.5 text-cyan-400" /> Tiempo promedio de generacion (ms)
              </h4>
              {data.avgGenTime.length === 0 ? (
                <p className="text-[11px] text-gray-600">Sin datos de rendimiento</p>
              ) : (
                <div className="space-y-2.5">
                  {data.avgGenTime.map((g) => {
                    const pct = Math.round((g.avgMs / maxGenTime) * 100);
                    const isHigh = g.avgMs > 3000;
                    return (
                      <div key={g.surfaceMode} className="flex items-center gap-3">
                        <span className="text-[10px] font-medium w-24 text-gray-300 truncate capitalize">
                          {g.surfaceMode}
                        </span>
                        <div className="flex-1 h-3 bg-background rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isHigh ? "bg-red-500/50" : "bg-cyan-500/40"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span
                          className={`text-[10px] w-16 text-right font-mono ${
                            isHigh ? "text-red-400" : "text-gray-500"
                          }`}
                        >
                          {g.avgMs.toLocaleString()}ms
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── Top Warning Combos ─────────────────────────────── */}
          {data.warningCombos.length > 0 && (
            <div className="bg-surface border border-amber-500/15 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-amber-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Top combinaciones con warnings
              </h4>
              <p className="text-[10px] text-gray-500 mb-3">
                Parametros que mas frecuentemente generan meshes con warnings
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-gray-600 border-b border-border-faint">
                      <th className="py-2 pr-4">Surface Mode</th>
                      <th className="py-2 pr-4">Subdivisions</th>
                      <th className="py-2 text-right">Ocurrencias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.warningCombos.map((w, i) => (
                      <tr
                        key={i}
                        className="border-b border-divider hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-2 pr-4 text-xs text-gray-300 capitalize">
                          {w.surfaceMode}
                        </td>
                        <td className="py-2 pr-4 text-xs text-gray-400 font-mono">
                          {w.subdivisions ?? "—"}
                        </td>
                        <td className="py-2 text-xs text-amber-400 text-right font-mono font-semibold">
                          {w.count.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}