/**
 * SuperAdmin – Complete admin dashboard for Vorea Studio.
 * Tabs: Dashboard, Usuarios, Planes, Uso, Finanzas, Alertas, Emails, Logs
 */

import { useState, useEffect, useCallback } from "react";
import { NewsSourcesTab } from "./NewsSourcesTab";
import { DonationsAdminTab } from "./DonationsAdminTab";
import { AnalyticsInsightsTab } from "./AnalyticsInsightsTab";
import {
  Shield, Users, CreditCard, BarChart3, Newspaper, DollarSign, Bell, Mail, ScrollText,
  RefreshCw, Loader2, Trash2, Ban, CheckCircle2, Crown, Edit2, Save, X,
  Plus, Send, AlertTriangle, TrendingUp, Zap, Bot, ArrowUpDown, Search,
  ChevronDown, Eye, EyeOff, ShieldCheck, UserX, UserCheck, LayoutDashboard, Activity, Box, Globe, Sparkles, MessageSquare, BookOpen, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { AdminApi, CreditsApi, CommunityApi, setCachedAccessToken, getCachedAccessToken, AuthApi } from "../services/api-client";
import { useAuth } from "../services/auth-context";
import type { MembershipTier } from "../services/types";
import { CreditsTab } from "./CreditsTab";
import { ActivityTab } from "./ActivityTab";
import { CommunityTab } from "./CommunityTab";
import { FeedbackAdmin } from "./FeedbackAdmin";
import { AiStudioAdminTab } from "./AiStudioAdminTab";
import { RegionalStatsTab } from "./RegionalStatsTab";

type Tab = "dashboard" | "users" | "plans" | "credits" | "activity" | "usage" | "finance" | "donations" | "alerts" | "emails" | "logs" | "content" | "community" | "news" | "analytics" | "feedback" | "aistudiocms" | "regional";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
  { id: "users", label: "Usuarios", icon: <Users className="w-4 h-4" /> },
  { id: "plans", label: "Planes", icon: <CreditCard className="w-4 h-4" /> },
  { id: "credits", label: "Créditos", icon: <Zap className="w-4 h-4" /> },
  { id: "activity", label: "Actividad", icon: <Activity className="w-4 h-4" /> },
  { id: "usage", label: "Uso", icon: <TrendingUp className="w-4 h-4" /> },
  { id: "finance", label: "Finanzas", icon: <DollarSign className="w-4 h-4" /> },
  { id: "donations", label: "Donaciones", icon: <ShieldCheck className="w-4 h-4" /> },
  { id: "alerts", label: "Alertas", icon: <Bell className="w-4 h-4" /> },
  { id: "emails", label: "Emails", icon: <Mail className="w-4 h-4" /> },
  { id: "logs", label: "Logs", icon: <ScrollText className="w-4 h-4" /> },
  { id: "content", label: "Contenido", icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: "community", label: "Comunidad / Modelos", icon: <Box className="w-4 h-4" /> },
  { id: "news", label: "Noticias", icon: <Newspaper className="w-4 h-4" /> },
  { id: "analytics", label: "Analytics IA", icon: <Sparkles className="w-4 h-4" /> },
  { id: "feedback", label: "Feedback AI", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "aistudiocms", label: "AI Studio CMS", icon: <Bot className="w-4 h-4" /> },
  { id: "regional", label: "Regional", icon: <Globe className="w-4 h-4" /> },
];

const NAV_GROUPS: Array<{
  id: string;
  label: string;
  description: string;
  tabs: Tab[];
}> = [
  {
    id: "ops",
    label: "Operación",
    description: "Estado general, usuarios y actividad diaria.",
    tabs: ["dashboard", "users", "activity", "usage", "regional"],
  },
  {
    id: "monetization",
    label: "Monetización",
    description: "Planes, créditos, finanzas y donaciones.",
    tabs: ["plans", "credits", "finance", "donations"],
  },
  {
    id: "content",
    label: "Contenido y comunidad",
    description: "Home, noticias, modelos y ecosistema público.",
    tabs: ["content", "community", "news", "aistudiocms"],
  },
  {
    id: "system",
    label: "Sistema",
    description: "Alertas, emails y trazabilidad operativa.",
    tabs: ["alerts", "emails", "logs", "analytics", "feedback"],
  },
];

const TIER_COLORS: Record<string, string> = {
  FREE: "text-gray-400 bg-gray-500/10 border-gray-500/20",
  PRO: "text-[#C6E36C] bg-[#C6E36C]/10 border-[#C6E36C]/20",
  "STUDIO PRO": "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export function SuperAdmin() {
  const { isLoggedIn, isSuperAdmin, user, isOnline, login } = useAuth();

  // ── Tab state with URL hash persistence ────────────────────────────
  const getTabFromHash = (): Tab => {
    const hash = window.location.hash.replace("#", "");
    if (hash && TABS.some((t) => t.id === hash)) return hash as Tab;
    return "dashboard";
  };
  const [tab, setTabState] = useState<Tab>(getTabFromHash);

  const setTab = useCallback((newTab: Tab) => {
    setTabState(newTab);
    window.history.replaceState(null, "", `#${newTab}`);
  }, []);

  // Listen for browser back/forward
  useEffect(() => {
    const onHashChange = () => setTabState(getTabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const [promoting, setPromoting] = useState(false);
  const [reAuthEmail, setReAuthEmail] = useState("");
  const [reAuthPass, setReAuthPass] = useState("");
  const [reAuthing, setReAuthing] = useState(false);
  const [needsSignup, setNeedsSignup] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const OWNER_EMAIL = "vorea.studio3d@gmail.com";
  const isOwnerEmail = user?.email === OWNER_EMAIL;

  // Pre-fill email
  useEffect(() => {
    if (user?.email && !reAuthEmail) setReAuthEmail(user.email);
  }, [user?.email]);



  if (!isLoggedIn) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 text-gray-600 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-300">Acceso Restringido</h2>
          <p className="text-sm text-gray-500">Inicia sesion para acceder al panel de administracion.</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    // Handler: authenticate with the active auth backend + promote in one step
    const handleAuthAndPromote = async () => {
      setReAuthing(true);
      try {
        const email = reAuthEmail || user!.email;
        const password = reAuthPass;

        if (!password) {
          toast.error("Ingresa tu contraseña de cuenta");
          setReAuthing(false);
          return;
        }

        // Step 1: Authenticate with self-hosted auth
        const authResult = await AuthApi.signin(email, password);

        if (!authResult.session?.access_token) {
          toast.error("No se obtuvo token de sesión. Verifica tus credenciales.");
          setReAuthing(false);
          return;
        }

        // Cache the access token IMMEDIATELY so fetchApi uses it for /admin/init
        setCachedAccessToken(authResult.session.access_token);

        toast.success("Sesión activa. Promoviendo...");

        // Role comes from backend automatically if authorized
        toast.success("Promovido a Superadmin exitosamente!");
      } catch (e: any) {
        toast.error(`Error inesperado: ${e.message}`);
      } finally {
        setReAuthing(false);
      }
    };

    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <Shield className="w-16 h-16 text-red-500/50 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-300">Superusuario Requerido</h2>

          {/* Diagnostic info */}
          <div className="text-left bg-gray-800/50 rounded-lg p-4 text-xs space-y-1 border border-gray-700">
            <p><span className="text-gray-500">Email:</span> <span className="text-gray-300">{user?.email || "N/A"}</span></p>
            <p><span className="text-gray-500">Es Owner:</span> <span className={isOwnerEmail ? "text-green-400" : "text-red-400"}>{isOwnerEmail ? "Sí" : "No"}</span></p>
            <p><span className="text-gray-500">Sesión verificada:</span> <span className={isOnline ? "text-green-400" : "text-yellow-400"}>{isOnline ? "Activa (online)" : "Sin sesión verificada"}</span></p>
            <p><span className="text-gray-500">Rol actual:</span> <span className="text-gray-300">{user?.role || "ninguno"}</span></p>
            {promoting && (
              <p className="text-amber-400 flex items-center gap-1.5 mt-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Auto-promoviendo a superadmin...
              </p>
            )}
          </div>

          {isOwnerEmail && (
            <div className="bg-[#131829] border border-[rgba(168,187,238,0.12)] rounded-xl p-5 text-left space-y-3">
              <p className="text-sm text-gray-300">
                Tu email coincide con el propietario. Ingresa tu contraseña para autenticarte y promoverte en un solo paso.
              </p>
              <input
                type="email"
                placeholder="Email"
                value={reAuthEmail}
                onChange={e => setReAuthEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#C6E36C]/50"
              />
              <input
                type="password"
                placeholder="Contraseña de cuenta"
                value={reAuthPass}
                onChange={e => setReAuthPass(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#C6E36C]/50"
              />
              <button
                onClick={handleAuthAndPromote}
                disabled={reAuthing || !reAuthPass}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#C6E36C]/20 to-purple-500/20 border border-[#C6E36C]/30 text-[#C6E36C] text-sm font-medium hover:from-[#C6E36C]/30 hover:to-purple-500/30 transition-all disabled:opacity-50"
              >
                {reAuthing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {reAuthing ? "Autenticando y promoviendo..." : "Autenticar y Promover a Superadmin"}
              </button>


              {/* Password Reset / Create Account Section */}
              <div className="border-t border-gray-700/50 pt-3 mt-2">
                {!showPasswordReset ? (
                  <button
                    onClick={() => setShowPasswordReset(true)}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
                  >
                    Olvidé mi contraseña / Necesito habilitar mi cuenta
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Esto resetea (o crea) la contraseña del owner en el backend de autenticación activo.
                    </p>
                    <input
                      type="password"
                      placeholder="Nueva contraseña (min 6 caracteres)"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-amber-500/50"
                    />
                    <input
                      type="password"
                      placeholder="Confirmar nueva contraseña"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-amber-500/50"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (newPassword.length < 6) {
                            toast.error("La contraseña debe tener al menos 6 caracteres");
                            return;
                          }
                          if (newPassword !== confirmPassword) {
                            toast.error("Las contraseñas no coinciden");
                            return;
                          }
                          setResetting(true);
                          try {
                            const result = await AdminApi.resetOwnerPassword(OWNER_EMAIL, newPassword);
                            toast.success(result.created
                              ? "Cuenta creada! Ahora usa tu nueva contraseña arriba."
                              : "Contraseña actualizada! Ahora usa tu nueva contraseña arriba."
                            );
                            setReAuthPass(newPassword);
                            setShowPasswordReset(false);
                            setNewPassword("");
                            setConfirmPassword("");
                          } catch (e: any) {
                            toast.error(e.message);
                          } finally {
                            setResetting(false);
                          }
                        }}
                        disabled={resetting || newPassword.length < 6 || newPassword !== confirmPassword}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs hover:bg-amber-500/25 transition-all disabled:opacity-50"
                      >
                        {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                        {resetting ? "Reseteando..." : "Resetear / Crear Contraseña"}
                      </button>
                      <button
                        onClick={() => { setShowPasswordReset(false); setNewPassword(""); setConfirmPassword(""); }}
                        className="px-3 py-2.5 rounded-xl border border-gray-700 text-gray-500 text-xs hover:text-gray-300 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!isOwnerEmail && (
            <p className="text-sm text-gray-500">
              Este panel es exclusivo para superadministradores. Tu email ({user?.email}) no es el email del propietario.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-purple-500/20 border border-red-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Panel de Administracion</h1>
              <p className="text-[11px] text-gray-500">
                Superadmin: {user?.email} &middot; {user?.displayName}
              </p>
            </div>
          </div>
          <a
            href="/docs/index.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[rgba(168,187,238,0.12)] bg-[#131829] px-4 py-2 text-sm text-gray-300 transition-colors hover:border-[#C6E36C]/30 hover:text-[#C6E36C]"
          >
            <BookOpen className="w-4 h-4" />
            Abrir documentación técnica
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* ── Horizontal Mega Menu Navigation ─────────────────────────── */}

        {/* Mobile: compact select dropdown */}
        <div className="sm:hidden mb-2">
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value as Tab)}
            className="w-full px-4 py-3 rounded-xl bg-[#131829] border border-[rgba(168,187,238,0.12)] text-gray-200 text-sm focus:border-[#C6E36C]/40 focus:outline-none appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%239ca3af' viewBox='0 0 16 16'%3E%3Cpath d='m4.4 6.4 3.6 3.6 3.6-3.6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}
          >
            {NAV_GROUPS.map((group) => (
              <optgroup key={group.id} label={group.label}>
                {group.tabs.map((tabId) => {
                  const t = TABS.find((entry) => entry.id === tabId);
                  if (!t) return null;
                  return <option key={t.id} value={t.id}>{t.label}</option>;
                })}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Desktop: horizontal group tabs + sub-tab pills */}
        <nav className="hidden sm:block rounded-2xl border border-[rgba(168,187,238,0.08)] bg-[#131829] overflow-hidden">
          {/* Group row */}
          <div className="flex border-b border-[rgba(168,187,238,0.08)]">
            {NAV_GROUPS.map((group) => {
              const isActiveGroup = group.tabs.includes(tab);
              return (
                <button
                  key={group.id}
                  onClick={() => {
                    // If clicking the already-active group, do nothing
                    // Otherwise switch to the first tab of that group
                    if (!isActiveGroup) setTab(group.tabs[0] as Tab);
                  }}
                  className={`flex-1 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider transition-all relative ${
                    isActiveGroup
                      ? "text-[#C6E36C] bg-[#C6E36C]/[0.04]"
                      : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]"
                  }`}
                >
                  {group.label}
                  {isActiveGroup && (
                    <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-[#C6E36C] rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Sub-tab pills for active group */}
          <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
            {NAV_GROUPS
              .find((g) => g.tabs.includes(tab))
              ?.tabs.map((tabId) => {
                const t = TABS.find((entry) => entry.id === tabId);
                if (!t) return null;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      tab === t.id
                        ? "bg-[#C6E36C]/15 text-[#C6E36C] border border-[#C6E36C]/25 shadow-[0_0_8px_rgba(198,227,108,0.06)]"
                        : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <span className={tab === t.id ? "text-[#C6E36C]" : "text-gray-500"}>{t.icon}</span>
                    {t.label}
                  </button>
                );
              })}
          </div>
        </nav>

        {/* ── Tab Content (full width, no sidebar) ─────────────────── */}
        <div className="space-y-4">
          {tab === "dashboard" && <DashboardTab />}
          {tab === "users" && <UsersTab />}
          {tab === "plans" && <PlansTab />}
          {tab === "credits" && <CreditsTab />}
          {tab === "activity" && <ActivityTab />}
          {tab === "usage" && <UsageTab />}
          {tab === "finance" && <FinanceTab />}
          {tab === "donations" && <DonationsAdminTab />}
          {tab === "alerts" && <AlertsTab />}
          {tab === "emails" && <EmailsTab />}
          {tab === "logs" && <LogsTab />}
          {tab === "content" && <ContentTab />}
          {tab === "community" && <CommunityTab />}
          {tab === "news" && <NewsSourcesTab />}
          {tab === "analytics" && <AnalyticsInsightsTab />}
          {tab === "feedback" && <FeedbackAdmin />}
          {tab === "aistudiocms" && <AiStudioAdminTab />}
          {tab === "regional" && <RegionalStatsTab />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard Tab
// ═══════════════════════════════════════════════════════════════════════════════

function DashboardTab() {
  const [usage, setUsage] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [aiBudgetInfo, setAiBudgetInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([AdminApi.getUsageReport(), AdminApi.getRevenueReport(), AdminApi.getAIBudget()])
      .then(([u, r, b]) => { setUsage(u); setRevenue(r); setAiBudgetInfo(b); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!usage || !revenue) return <p className="text-sm text-gray-500">Error al cargar datos</p>;

  const aiCostsConfigured = revenue.expenses?.aiCosts?.configured !== false;
  const infraCostsConfigured = revenue.expenses?.infrastructure?.configured !== false;
  const trackedAiSpend = Number(revenue.expenses?.aiCosts?.trackedSpendUsd ?? revenue.expenses?.aiCosts?.totalCost ?? 0);

  const cards = [
    { label: "Usuarios", value: usage.totalUsers, icon: <Users className="w-4 h-4" />, color: "text-blue-400" },
    { label: "Ingresos Confirmados", value: `$${revenue.revenue.totalRevenue.toFixed(2)}`, icon: <DollarSign className="w-4 h-4" />, color: "text-green-400" },
    { label: "Ordenes Completadas", value: usage.completedOrders, icon: <CreditCard className="w-4 h-4" />, color: "text-purple-400" },
    { label: "Feedback Recibido", value: usage.totalFeedback, icon: <BarChart3 className="w-4 h-4" />, color: "text-amber-400" },
    { label: "Ejecuciones IA", value: usage.totalAIRuns, icon: <Bot className="w-4 h-4" />, color: "text-pink-400" },
    { label: "Exportaciones GCode", value: usage.totalGCodeExports, icon: <Zap className="w-4 h-4" />, color: "text-[#C6E36C]" },
    {
      label: "Gasto IA Real",
      value: `$${trackedAiSpend.toFixed(4)}`,
      icon: <AlertTriangle className="w-4 h-4" />,
      color: "text-orange-400",
    },
    { label: "Utilidad Neta", value: `$${revenue.profit.toFixed(2)}`, icon: <TrendingUp className="w-4 h-4" />, color: revenue.profit >= 0 ? "text-green-400" : "text-red-400" },
  ];

  return (
    <div className="space-y-6">
      {(!aiCostsConfigured || !infraCostsConfigured) && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
          Faltan referencias base en administración.
          {!aiCostsConfigured && <span className="ml-1">AI cost/run sigue pendiente para comparar contra gasto real.</span>}
          {!infraCostsConfigured && <span className="ml-1">Infraestructura mensual sin definir.</span>}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <div key={i} className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4">
            <div className={`${c.color} mb-2`}>{c.icon}</div>
            <p className="text-lg font-bold text-white">{c.value}</p>
            <p className="text-[10px] text-gray-500">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Tier distribution */}
      <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-400 mb-3">Distribucion por Plan</h3>
        <div className="flex gap-4">
          {Object.entries(usage.tierDistribution as Record<string, number>).map(([tier, count]) => (
            <div key={tier} className="flex-1 text-center">
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${TIER_COLORS[tier] || ""}`}>{tier}</span>
              <p className="text-xl font-bold mt-1">{count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Users Tab
// ═══════════════════════════════════════════════════════════════════════════════

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [creditUserId, setCreditUserId] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [addingCredits, setAddingCredits] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await AdminApi.listUsers();
      setUsers(data.users || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const saveUser = async (id: string) => {
    try {
      await AdminApi.updateUser(id, editData);
      toast.success("Usuario actualizado");
      setEditingId(null);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`Eliminar al usuario "${name}"? Esta accion no se puede deshacer.`)) return;
    try {
      await AdminApi.deleteUser(id);
      toast.success("Usuario eliminado");
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const addCreditsToUser = async (userId: string, userName: string) => {
    const amount = parseInt(creditAmount);
    if (!amount || amount <= 0 || amount > 1000) {
      toast.error("Cantidad inválida (1-1000)");
      return;
    }
    setAddingCredits(true);
    try {
      await CreditsApi.purchase("admin_grant", amount, userId);
      toast.success(`+${amount} créditos asignados a ${userName}`);
      setCreditUserId(null);
      setCreditAmount("");
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAddingCredits(false);
    }
  };

  const toggleBan = async (u: any) => {
    try {
      await AdminApi.updateUser(u.id, { banned: !u.banned });
      toast.success(u.banned ? "Usuario desbaneado" : "Usuario baneado");
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const filtered = users.filter((u) =>
    !search ||
    u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#131829] border border-[rgba(168,187,238,0.12)] rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C6E36C]/30"
          />
        </div>
        <button onClick={fetchUsers} className="p-2 rounded-lg bg-[#131829] border border-[rgba(168,187,238,0.12)] text-gray-400 hover:text-white transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-gray-600">{filtered.length} usuarios</p>

      <div className="space-y-2">
        {filtered.map((u) => {
          const isEditing = editingId === u.id;
          return (
            <div key={u.id} className={`bg-[#131829] border rounded-xl p-4 transition-all ${u.banned ? "border-red-500/20 opacity-60" : "border-[rgba(168,187,238,0.08)]"}`}>
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${u.role === "superadmin" ? "bg-gradient-to-br from-red-500/30 to-purple-500/30 text-red-400" : "bg-gradient-to-br from-[#C6E36C]/20 to-blue-500/20 text-[#C6E36C]"}`}>
                  {u.role === "superadmin" ? <Shield className="w-4 h-4" /> : u.displayName?.[0]?.toUpperCase() || "?"}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isEditing ? (
                      <input value={editData.displayName ?? u.displayName} onChange={(e) => setEditData({ ...editData, displayName: e.target.value })} className="bg-[#0d1117] border border-[rgba(168,187,238,0.15)] rounded px-2 py-0.5 text-sm text-white" />
                    ) : (
                      <span className="text-sm font-medium text-white">{u.displayName}</span>
                    )}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${TIER_COLORS[u.tier] || TIER_COLORS.FREE}`}>
                      {u.tier}
                    </span>
                    {u.role === "superadmin" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">SUPERADMIN</span>}
                    {u.banned && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/25">BANNED</span>}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">{u.email} &middot; {u.username}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    Registrado: {new Date(u.createdAt).toLocaleDateString("es-MX")}
                    {u.credits && ` &middot; Exports: ${u.credits.totalExported}`}
                    {u.toolCredits && <span className="text-[#C6E36C]/70"> &middot; Saldo universal: {u.toolCredits.balance || 0}</span>}
                    {Number(u.credits?.purchasedCredits || 0) > 0 && <span className="text-cyan-300/80"> &middot; Legacy pendiente: {u.credits.purchasedCredits}</span>}
                  </p>

                  {/* Inline credit assignment */}
                  {creditUserId === u.id && (
                    <div className="flex items-center gap-2 mt-2">
                      <Zap className="w-3.5 h-3.5 text-[#C6E36C]" />
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        placeholder="Cant."
                        value={creditAmount}
                        onChange={(e) => setCreditAmount(e.target.value)}
                        className="w-20 px-2 py-1 bg-[#0d1117] border border-[rgba(168,187,238,0.15)] rounded text-xs text-white text-center"
                        autoFocus
                      />
                      <button
                        onClick={() => addCreditsToUser(u.id, u.displayName)}
                        disabled={addingCredits || !creditAmount}
                        className="px-2 py-1 rounded text-[10px] bg-[#C6E36C]/15 border border-[#C6E36C]/25 text-[#C6E36C] hover:bg-[#C6E36C]/25 transition-all disabled:opacity-50 flex items-center gap-1"
                      >
                        {addingCredits ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Asignar
                      </button>
                      <button
                        onClick={() => { setCreditUserId(null); setCreditAmount(""); }}
                        className="p-1 rounded text-gray-500 hover:text-white transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Tier selector when editing */}
                  {isEditing && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-gray-500">Plan:</span>
                      {(["FREE", "PRO", "STUDIO PRO"] as MembershipTier[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setEditData({ ...editData, tier: t })}
                          className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                            (editData.tier ?? u.tier) === t
                              ? TIER_COLORS[t]
                              : "text-gray-600 border-transparent hover:text-gray-400"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                      <span className="text-[10px] text-gray-500 ml-3">Rol:</span>
                      {(["user", "admin", "superadmin"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setEditData({ ...editData, role: r })}
                          className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                            (editData.role ?? u.role ?? "user") === r
                              ? "text-purple-400 bg-purple-500/10 border-purple-500/20"
                              : "text-gray-600 border-transparent hover:text-gray-400"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <button onClick={() => saveUser(u.id)} className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 transition-colors" title="Guardar">
                        <Save className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setEditingId(null); setEditData({}); }} className="p-1.5 rounded-lg text-gray-400 hover:bg-white/5 transition-colors" title="Cancelar">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setCreditUserId(creditUserId === u.id ? null : u.id); setCreditAmount(""); }} className={`p-1.5 rounded-lg transition-colors ${creditUserId === u.id ? "text-[#C6E36C] bg-[#C6E36C]/10" : "text-gray-500 hover:text-[#C6E36C] hover:bg-[#C6E36C]/5"}`} title="Asignar Créditos">
                        <Zap className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setEditingId(u.id); setEditData({}); }} className="p-1.5 rounded-lg text-gray-500 hover:text-[#C6E36C] hover:bg-[#C6E36C]/5 transition-colors" title="Editar">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleBan(u)} className={`p-1.5 rounded-lg transition-colors ${u.banned ? "text-green-400 hover:bg-green-500/10" : "text-amber-400 hover:bg-amber-500/10"}`} title={u.banned ? "Desbanear" : "Banear"}>
                        {u.banned ? <UserCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                      </button>
                      {u.role !== "superadmin" && (
                        <button onClick={() => deleteUser(u.id, u.displayName)} className="p-1.5 rounded-lg text-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Plans Tab
// ═══════════════════════════════════════════════════════════════════════════════

function PlansTab() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editPlans, setEditPlans] = useState<any[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Credit Packs state
  const [creditPacks, setCreditPacks] = useState<any[]>([]);
  const [editPacks, setEditPacks] = useState<any[]>([]);
  const [packChanges, setPackChanges] = useState(false);
  const [savingPacks, setSavingPacks] = useState(false);

  // Limits state
  const [limits, setLimits] = useState<any>(null);
  const [editLimits, setEditLimits] = useState<any>(null);
  const [limitsChanges, setLimitsChanges] = useState(false);
  const [savingLimits, setSavingLimits] = useState(false);

  // Promotions state
  const [promotions, setPromotions] = useState<any[]>([]);
  const [editPromos, setEditPromos] = useState<any[]>([]);
  const [promoChanges, setPromoChanges] = useState(false);
  const [savingPromos, setSavingPromos] = useState(false);

  useEffect(() => {
    Promise.all([
      AdminApi.getPlans()
        .then((p) => { setPlans(p); setEditPlans(JSON.parse(JSON.stringify(p))); }),
      AdminApi.getCreditPacks()
        .then((p) => { setCreditPacks(p); setEditPacks(JSON.parse(JSON.stringify(p))); }),
      AdminApi.getLimits()
        .then(({ limits: l }) => { setLimits(l); setEditLimits(JSON.parse(JSON.stringify(l))); }),
      AdminApi.getPromotions()
        .then((p) => { setPromotions(p); setEditPromos(JSON.parse(JSON.stringify(p))); })
        .catch(() => { /* no promos yet */ }),
    ])
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Plan helpers
  const updatePlan = (idx: number, field: string, value: any) => {
    const next = [...editPlans];
    next[idx] = { ...next[idx], [field]: value };
    setEditPlans(next);
    setHasChanges(true);
  };

  const updateFeature = (planIdx: number, featureIdx: number, value: string) => {
    const next = [...editPlans];
    next[planIdx].features[featureIdx] = value;
    setEditPlans(next);
    setHasChanges(true);
  };

  const addFeature = (planIdx: number) => {
    const next = [...editPlans];
    next[planIdx].features.push("Nueva funcionalidad");
    setEditPlans(next);
    setHasChanges(true);
  };

  const removeFeature = (planIdx: number, featureIdx: number) => {
    const next = [...editPlans];
    next[planIdx].features.splice(featureIdx, 1);
    setEditPlans(next);
    setHasChanges(true);
  };

  const savePlans = async () => {
    setSaving(true);
    try {
      await AdminApi.updatePlans(editPlans);
      setPlans(JSON.parse(JSON.stringify(editPlans)));
      setHasChanges(false);
      toast.success("Planes actualizados");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Pack helpers
  const updatePack = (idx: number, field: string, value: any) => {
    const next = [...editPacks];
    next[idx] = { ...next[idx], [field]: value };
    if (field === "price" || field === "credits") {
      const p = next[idx];
      p.pricePerCredit = p.credits > 0 ? +(p.price / p.credits).toFixed(2) : 0;
    }
    setEditPacks(next);
    setPackChanges(true);
  };

  const addPack = () => {
    const id = `pack_${Date.now()}`;
    setEditPacks([...editPacks, { id, name: "Nuevo Pack", credits: 10, price: 1.99, pricePerCredit: 0.20, popular: false }]);
    setPackChanges(true);
  };

  const removePack = (idx: number) => {
    setEditPacks(editPacks.filter((_, i) => i !== idx));
    setPackChanges(true);
  };

  const savePacks = async () => {
    setSavingPacks(true);
    try {
      await AdminApi.updateCreditPacks(editPacks);
      setCreditPacks(JSON.parse(JSON.stringify(editPacks)));
      setPackChanges(false);
      toast.success("Credit Packs actualizados");
      // Invalidate frontend cache
      const { invalidateBusinessConfigCache } = await import("../services/business-config");
      invalidateBusinessConfigCache();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingPacks(false);
    }
  };

  // Limits helpers
  const updateLimit = (path: string, value: any) => {
    const next = JSON.parse(JSON.stringify(editLimits));
    const parts = path.split(".");
    let obj = next;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = value;
    setEditLimits(next);
    setLimitsChanges(true);
  };

  const saveLimits = async () => {
    setSavingLimits(true);
    try {
      await AdminApi.updateLimits({ limits: editLimits });
      setLimits(JSON.parse(JSON.stringify(editLimits)));
      setLimitsChanges(false);
      toast.success("Limites actualizados");
      const { invalidateBusinessConfigCache } = await import("../services/business-config");
      invalidateBusinessConfigCache();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingLimits(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">

      {/* ── Plans Section ──────────────────────────────────────────── */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#C6E36C]" /> Planes de Membresía
        </h3>

        {hasChanges && (
          <div className="flex items-center justify-between bg-[#C6E36C]/5 border border-[#C6E36C]/20 rounded-xl p-3">
            <span className="text-xs text-[#C6E36C]">Tienes cambios sin guardar</span>
            <div className="flex gap-2">
              <button onClick={() => { setEditPlans(JSON.parse(JSON.stringify(plans))); setHasChanges(false); }} className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded-lg border border-gray-600 transition-colors">
                Descartar
              </button>
              <button onClick={savePlans} disabled={saving} className="text-xs text-black bg-[#C6E36C] hover:bg-[#b5d45e] px-3 py-1 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Guardar
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {editPlans.map((plan, pi) => (
            <div key={plan.tier} className={`bg-[#131829] border rounded-xl p-5 space-y-4 ${plan.highlighted ? "border-[#C6E36C]/30 ring-1 ring-[#C6E36C]/10" : "border-[rgba(168,187,238,0.1)]"}`}>
              <div className="flex items-center justify-between">
                <input
                  value={plan.name}
                  onChange={(e) => updatePlan(pi, "name", e.target.value)}
                  className="text-lg font-bold bg-transparent border-b border-transparent hover:border-gray-600 focus:border-[#C6E36C]/40 focus:outline-none text-white w-32"
                />
                <span className={`text-[10px] px-2 py-0.5 rounded border ${TIER_COLORS[plan.tier]}`}>{plan.tier}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-gray-600 uppercase">Precio/mes (USD)</label>
                  <input
                    type="number"
                    value={plan.price}
                    onChange={(e) => updatePlan(pi, "price", parseFloat(e.target.value) || 0)}
                    className="w-full mt-0.5 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#C6E36C]/30"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-gray-600 uppercase">Precio/anual</label>
                  <input
                    type="number"
                    value={plan.yearlyPrice}
                    onChange={(e) => updatePlan(pi, "yearlyPrice", parseFloat(e.target.value) || 0)}
                    className="w-full mt-0.5 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#C6E36C]/30"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={plan.highlighted || false}
                  onChange={(e) => updatePlan(pi, "highlighted", e.target.checked)}
                  className="accent-[#C6E36C]"
                />
                <span className="text-[10px] text-gray-400">Plan destacado</span>
              </div>

              <div>
                <label className="text-[9px] text-gray-600 uppercase block mb-1">Funcionalidades</label>
                <div className="space-y-1">
                  {plan.features.map((f: string, fi: number) => (
                    <div key={fi} className="flex items-center gap-1">
                      <input
                        value={f}
                        onChange={(e) => updateFeature(pi, fi, e.target.value)}
                        className="flex-1 bg-[#0d1117] border border-[rgba(168,187,238,0.08)] rounded px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-[#C6E36C]/20"
                      />
                      <button onClick={() => removeFeature(pi, fi)} className="p-0.5 text-red-500/40 hover:text-red-400 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => addFeature(pi)} className="mt-1 text-[10px] text-[#C6E36C]/60 hover:text-[#C6E36C] flex items-center gap-1 transition-colors">
                  <Plus className="w-3 h-3" /> Agregar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Credit Packs Section ──────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" /> Packs de Créditos (Exportación GCode)
          </h3>
          <button onClick={addPack} className="text-[10px] text-[#C6E36C]/70 hover:text-[#C6E36C] flex items-center gap-1 transition-colors px-2 py-1 border border-[#C6E36C]/20 rounded-lg">
            <Plus className="w-3 h-3" /> Nuevo Pack
          </button>
        </div>

        {packChanges && (
          <div className="flex items-center justify-between bg-purple-500/5 border border-purple-500/20 rounded-xl p-3">
            <span className="text-xs text-purple-400">Cambios en packs sin guardar</span>
            <div className="flex gap-2">
              <button onClick={() => { setEditPacks(JSON.parse(JSON.stringify(creditPacks))); setPackChanges(false); }} className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded-lg border border-gray-600 transition-colors">
                Descartar
              </button>
              <button onClick={savePacks} disabled={savingPacks} className="text-xs text-white bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
                {savingPacks ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Guardar
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {editPacks.map((pack, pi) => (
            <div key={pack.id} className={`bg-[#131829] border rounded-xl p-4 space-y-3 ${pack.popular ? "border-purple-500/30 ring-1 ring-purple-500/10" : "border-[rgba(168,187,238,0.1)]"}`}>
              <div className="flex items-center justify-between">
                <input
                  value={pack.name}
                  onChange={(e) => updatePack(pi, "name", e.target.value)}
                  className="text-sm font-semibold bg-transparent border-b border-transparent hover:border-gray-600 focus:border-purple-400/40 focus:outline-none text-white flex-1"
                />
                <button onClick={() => removePack(pi)} className="p-1 text-red-500/40 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-gray-600 uppercase">Créditos</label>
                  <input
                    type="number"
                    value={pack.credits}
                    onChange={(e) => updatePack(pi, "credits", parseInt(e.target.value) || 0)}
                    className="w-full mt-0.5 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-purple-400/30"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-gray-600 uppercase">Precio (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pack.price}
                    onChange={(e) => updatePack(pi, "price", parseFloat(e.target.value) || 0)}
                    className="w-full mt-0.5 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-purple-400/30"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500">${pack.pricePerCredit?.toFixed(2) || "0.00"}/crédito</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={pack.popular || false}
                    onChange={(e) => updatePack(pi, "popular", e.target.checked)}
                    className="accent-purple-500"
                  />
                  <span className="text-[9px] text-gray-500">Popular</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Limits Section ──────────────────────────────────────────── */}
      {editLimits && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-400" /> Límites por Tier
          </h3>

          {limitsChanges && (
            <div className="flex items-center justify-between bg-orange-500/5 border border-orange-500/20 rounded-xl p-3">
              <span className="text-xs text-orange-400">Cambios en limites sin guardar</span>
              <div className="flex gap-2">
                <button onClick={() => { setEditLimits(JSON.parse(JSON.stringify(limits))); setLimitsChanges(false); }} className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded-lg border border-gray-600 transition-colors">
                  Descartar
                </button>
                <button onClick={saveLimits} disabled={savingLimits} className="text-xs text-white bg-orange-600 hover:bg-orange-500 px-3 py-1 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
                  {savingLimits ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Guardar
                </button>
              </div>
            </div>
          )}

          <div className="bg-[#131829] border border-[rgba(168,187,238,0.1)] rounded-xl p-5">
            {/* Free export limit */}
            <div className="mb-5">
              <label className="text-[10px] text-gray-500 uppercase block mb-1">Exportaciones GCode Gratis (tier FREE)</label>
              <input
                type="number"
                value={editLimits.freeExportLimit}
                onChange={(e) => updateLimit("freeExportLimit", parseInt(e.target.value) || 0)}
                className="w-32 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-orange-400/30"
              />
            </div>

            {/* AI Generations per day */}
            <div className="mb-5">
              <label className="text-[10px] text-gray-500 uppercase block mb-2">Generaciones IA / mes (-1 = ilimitado)</label>
              <div className="grid grid-cols-3 gap-3">
                {(["FREE", "PRO", "STUDIO PRO"] as const).map((tier) => (
                  <div key={tier}>
                    <span className={`text-[9px] ${TIER_COLORS[tier]?.split(" ")[0] || "text-gray-400"}`}>{tier}</span>
                    <input
                      type="number"
                      value={(editLimits as any).aiGenerationsPerMonth?.[tier] ?? (editLimits as any).aiGenerationsPerDay?.[tier] ?? 0}
                      onChange={(e) => updateLimit(`aiGenerationsPerMonth.${tier}`, parseInt(e.target.value))}
                      className="w-full mt-0.5 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-orange-400/30"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Max active projects */}
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-2">Proyectos Activos Máximos (-1 = ilimitado)</label>
              <div className="grid grid-cols-3 gap-3">
                {(["FREE", "PRO", "STUDIO PRO"] as const).map((tier) => (
                  <div key={tier}>
                    <span className={`text-[9px] ${TIER_COLORS[tier]?.split(" ")[0] || "text-gray-400"}`}>{tier}</span>
                    <input
                      type="number"
                      value={editLimits.maxActiveProjects?.[tier] ?? 0}
                      onChange={(e) => updateLimit(`maxActiveProjects.${tier}`, parseInt(e.target.value))}
                      className="w-full mt-0.5 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-orange-400/30"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Promotions Section ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" /> Promociones
          </h3>
          <button
            onClick={() => {
              setEditPromos([...editPromos, {
                id: "",
                name: "Nueva Promoción",
                type: "percent" as const,
                value: 10,
                appliesTo: ["all"],
                conditions: {
                  startDate: new Date().toISOString().slice(0, 10),
                  endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                  countries: [],
                  couponCode: "",
                  maxUses: 0,
                },
                active: true,
                usedCount: 0,
              }]);
              setPromoChanges(true);
            }}
            className="text-[10px] text-yellow-400/70 hover:text-yellow-400 flex items-center gap-1 transition-colors px-2 py-1 border border-yellow-500/20 rounded-lg"
          >
            <Plus className="w-3 h-3" /> Nueva Promo
          </button>
        </div>

        {promoChanges && (
          <div className="flex items-center justify-between bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3">
            <span className="text-xs text-yellow-400">Cambios en promociones sin guardar</span>
            <div className="flex gap-2">
              <button onClick={() => { setEditPromos(JSON.parse(JSON.stringify(promotions))); setPromoChanges(false); }} className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded-lg border border-gray-600 transition-colors">
                Descartar
              </button>
              <button
                onClick={async () => {
                  setSavingPromos(true);
                  try {
                    const result = await AdminApi.updatePromotions(editPromos);
                    setPromotions(result.promotions || editPromos);
                    setEditPromos(JSON.parse(JSON.stringify(result.promotions || editPromos)));
                    setPromoChanges(false);
                    toast.success("Promociones guardadas");
                    (await import("../services/business-config")).invalidateBusinessConfigCache();
                  } catch (e: any) {
                    toast.error(e.message);
                  } finally {
                    setSavingPromos(false);
                  }
                }}
                disabled={savingPromos}
                className="text-xs text-white bg-yellow-600 hover:bg-yellow-500 px-3 py-1 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                {savingPromos ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Guardar
              </button>
            </div>
          </div>
        )}

        {editPromos.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm bg-[#131829] border border-[rgba(168,187,238,0.1)] rounded-xl">
            No hay promociones activas. Crea una para empezar.
          </div>
        ) : (
          <div className="space-y-3">
            {editPromos.map((promo, pi) => (
              <div key={promo.id || pi} className={`bg-[#131829] border rounded-xl p-4 space-y-3 ${
                promo.active ? "border-yellow-500/20" : "border-[rgba(168,187,238,0.1)] opacity-60"
              }`}>
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <input
                    value={promo.name}
                    onChange={(e) => { const next = [...editPromos]; next[pi] = { ...next[pi], name: e.target.value }; setEditPromos(next); setPromoChanges(true); }}
                    className="text-sm font-semibold bg-transparent border-b border-transparent hover:border-gray-600 focus:border-yellow-400/40 focus:outline-none text-white flex-1 mr-4"
                    placeholder="Nombre de la promo"
                  />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={promo.active}
                        onChange={(e) => { const next = [...editPromos]; next[pi] = { ...next[pi], active: e.target.checked }; setEditPromos(next); setPromoChanges(true); }}
                        className="accent-yellow-500"
                      />
                      <span className="text-[9px] text-gray-500">Activa</span>
                    </label>
                    <button
                      onClick={() => { setEditPromos(editPromos.filter((_, i) => i !== pi)); setPromoChanges(true); }}
                      className="p-1 text-red-500/40 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Type + Value row */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] text-gray-600 uppercase">Tipo</label>
                    <select
                      value={promo.type}
                      onChange={(e) => { const next = [...editPromos]; next[pi] = { ...next[pi], type: e.target.value }; setEditPromos(next); setPromoChanges(true); }}
                      className="w-full mt-0.5 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-400/30"
                    >
                      <option value="percent">% Descuento</option>
                      <option value="fixed">Monto Fijo</option>
                      <option value="trial">Trial Extendido</option>
                      <option value="bonus_credits">Créditos Bonus</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-600 uppercase">
                      {promo.type === "percent" ? "Porcentaje" : promo.type === "trial" ? "Días" : promo.type === "bonus_credits" ? "Créditos" : "Monto USD"}
                    </label>
                    <input
                      type="number"
                      step={promo.type === "percent" ? 1 : 0.01}
                      value={promo.value}
                      onChange={(e) => { const next = [...editPromos]; next[pi] = { ...next[pi], value: parseFloat(e.target.value) || 0 }; setEditPromos(next); setPromoChanges(true); }}
                      className="w-full mt-0.5 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-400/30"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-600 uppercase">Aplica a</label>
                    <select
                      value={(promo.appliesTo || ["all"])[0]}
                      onChange={(e) => { const next = [...editPromos]; next[pi] = { ...next[pi], appliesTo: [e.target.value] }; setEditPromos(next); setPromoChanges(true); }}
                      className="w-full mt-0.5 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-400/30"
                    >
                      <option value="all">Todos los planes</option>
                      <option value="FREE">Solo FREE</option>
                      <option value="PRO">Solo PRO</option>
                      <option value="STUDIO PRO">Solo STUDIO PRO</option>
                      <option value="credit_packs">Packs de Créditos</option>
                    </select>
                  </div>
                </div>

                {/* Dates + Geo row */}
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[9px] text-gray-600 uppercase">Desde</label>
                    <input
                      type="date"
                      value={(promo.conditions?.startDate || "").slice(0, 10)}
                      onChange={(e) => { const next = [...editPromos]; next[pi] = { ...next[pi], conditions: { ...next[pi].conditions, startDate: e.target.value } }; setEditPromos(next); setPromoChanges(true); }}
                      className="w-full mt-0.5 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-yellow-400/30"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-600 uppercase">Hasta</label>
                    <input
                      type="date"
                      value={(promo.conditions?.endDate || "").slice(0, 10)}
                      onChange={(e) => { const next = [...editPromos]; next[pi] = { ...next[pi], conditions: { ...next[pi].conditions, endDate: e.target.value } }; setEditPromos(next); setPromoChanges(true); }}
                      className="w-full mt-0.5 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-yellow-400/30"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-600 uppercase">Cupón</label>
                    <input
                      value={promo.conditions?.couponCode || ""}
                      onChange={(e) => { const next = [...editPromos]; next[pi] = { ...next[pi], conditions: { ...next[pi].conditions, couponCode: e.target.value } }; setEditPromos(next); setPromoChanges(true); }}
                      placeholder="BLACKFRIDAY"
                      className="w-full mt-0.5 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-yellow-400/30 placeholder:text-gray-700"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-gray-600 uppercase">Países (ISO)</label>
                    <input
                      value={(promo.conditions?.countries || []).join(", ")}
                      onChange={(e) => { const next = [...editPromos]; next[pi] = { ...next[pi], conditions: { ...next[pi].conditions, countries: e.target.value.split(",").map((c: string) => c.trim().toUpperCase()).filter(Boolean) } }; setEditPromos(next); setPromoChanges(true); }}
                      placeholder="AR, MX, CO..."
                      className="w-full mt-0.5 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-yellow-400/30 placeholder:text-gray-700"
                    />
                  </div>
                </div>

                {/* Footer info */}
                <div className="flex items-center justify-between text-[10px] text-gray-600">
                  <span>Usos: {promo.usedCount || 0}{promo.conditions?.maxUses ? ` / ${promo.conditions.maxUses}` : ""}</span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1">
                      <span>Max usos:</span>
                      <input
                        type="number"
                        value={promo.conditions?.maxUses || 0}
                        onChange={(e) => { const next = [...editPromos]; next[pi] = { ...next[pi], conditions: { ...next[pi].conditions, maxUses: parseInt(e.target.value) || 0 } }; setEditPromos(next); setPromoChanges(true); }}
                        className="w-16 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded px-1 py-0.5 text-[10px] text-white focus:outline-none"
                      />
                    </label>
                    <span className="text-gray-700">(0 = ilimitado)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Usage Tab
// ═══════════════════════════════════════════════════════════════════════════════

function UsageTab() {
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AdminApi.getUsageReport()
      .then(setUsage)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!usage) return null;

  const signupData = Object.entries(usage.signupsByDay as Record<string, number>);
  const maxSignups = Math.max(...signupData.map(([, v]) => v), 1);

  return (
    <div className="space-y-6">
      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Usuarios Total", value: usage.totalUsers },
          { label: "PayPal Ordenes", value: `${usage.completedOrders}/${usage.totalPaypalOrders}` },
          { label: "Feedback", value: usage.totalFeedback },
          { label: "GCode Exports", value: usage.totalGCodeExports },
        ].map((m, i) => (
          <div key={i} className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4 text-center">
            <p className="text-xl font-bold">{m.value}</p>
            <p className="text-[10px] text-gray-500">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Signup chart (ASCII bar chart) */}
      <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-400 mb-3">Registros ultimos 30 dias</h3>
        <div className="flex items-end gap-0.5 h-24">
          {signupData.map(([day, count], i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
              <div
                className="w-full bg-[#C6E36C]/30 rounded-t-sm hover:bg-[#C6E36C]/50 transition-colors min-h-[2px]"
                style={{ height: `${Math.max((count / maxSignups) * 100, 2)}%` }}
              />
              <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[#0d1117] border border-[rgba(168,187,238,0.15)] rounded px-2 py-1 text-[9px] text-gray-300 whitespace-nowrap z-10">
                {day}: {count} registros
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[8px] text-gray-600">{signupData[0]?.[0]?.slice(5)}</span>
          <span className="text-[8px] text-gray-600">{signupData[signupData.length - 1]?.[0]?.slice(5)}</span>
        </div>
      </div>

      {/* Tier breakdown */}
      <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-400 mb-3">Distribucion por Tier</h3>
        <div className="space-y-2">
          {Object.entries(usage.tierDistribution as Record<string, number>).map(([tier, count]) => {
            const pct = usage.totalUsers > 0 ? Math.round((count / usage.totalUsers) * 100) : 0;
            return (
              <div key={tier} className="flex items-center gap-3">
                <span className={`text-[10px] w-20 font-medium ${TIER_COLORS[tier]?.split(" ")[0] || "text-gray-400"}`}>{tier}</span>
                <div className="flex-1 h-3 bg-[#0d1117] rounded-full overflow-hidden">
                  <div className="h-full bg-[#C6E36C]/30 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-gray-500 w-16 text-right">{count} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Finance Tab
// ═══════════════════════════════════════════════════════════════════════════════

function FinanceTab() {
  const [data, setData] = useState<any>(null);
  const [limitsConfig, setLimitsConfig] = useState<any>(null);
  const [legacyTopUpStatus, setLegacyTopUpStatus] = useState<any>(null);
  const [editCosts, setEditCosts] = useState({ aiCostPerRun: "", monthlyInfrastructure: "" });
  const [costsDirty, setCostsDirty] = useState(false);
  const [savingCosts, setSavingCosts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newExpense, setNewExpense] = useState({ description: "", amount: "", category: "general" });
  const [adding, setAdding] = useState(false);
  const [runningLegacyBackfill, setRunningLegacyBackfill] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [d, limits, legacyStatus] = await Promise.all([
        AdminApi.getRevenueReport(),
        AdminApi.getLimits(),
        AdminApi.getLegacyTopUpStatus(),
      ]);
      setData(d);
      setLimitsConfig(limits);
      setLegacyTopUpStatus(legacyStatus);
      setEditCosts({
        aiCostPerRun: limits?.costs?.aiCostPerRun !== undefined ? String(limits.costs.aiCostPerRun) : "",
        monthlyInfrastructure: limits?.costs?.monthlyInfrastructure !== undefined ? String(limits.costs.monthlyInfrastructure) : "",
      });
      setCostsDirty(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addExpense = async () => {
    if (!newExpense.description || !newExpense.amount) return;
    setAdding(true);
    try {
      await AdminApi.addExpense({ description: newExpense.description, amount: parseFloat(newExpense.amount), category: newExpense.category });
      toast.success("Gasto agregado");
      setNewExpense({ description: "", amount: "", category: "general" });
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAdding(false);
    }
  };

  const runLegacyBackfill = async () => {
    if (!legacyTopUpStatus?.affectedUsers) {
      toast.success("No quedan créditos legacy pendientes");
      return;
    }
    if (!confirm(`Migrar ${legacyTopUpStatus.totalLegacyPurchasedCredits} créditos legacy de ${legacyTopUpStatus.affectedUsers} usuarios al saldo universal?`)) {
      return;
    }

    setRunningLegacyBackfill(true);
    try {
      const result = await AdminApi.runLegacyTopUpBackfill();
      toast.success(`Backfill ejecutado: ${result.totalCreditsMigrated} créditos migrados`);
      setLegacyTopUpStatus(result);
      await fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunningLegacyBackfill(false);
    }
  };

  const updateCostField = (field: "aiCostPerRun" | "monthlyInfrastructure", value: string) => {
    setEditCosts((prev) => ({ ...prev, [field]: value }));
    setCostsDirty(true);
  };

  const resetCostDraft = () => {
    setEditCosts({
      aiCostPerRun: limitsConfig?.costs?.aiCostPerRun !== undefined ? String(limitsConfig.costs.aiCostPerRun) : "",
      monthlyInfrastructure: limitsConfig?.costs?.monthlyInfrastructure !== undefined ? String(limitsConfig.costs.monthlyInfrastructure) : "",
    });
    setCostsDirty(false);
  };

  const applySuggestedCosts = () => {
    setEditCosts({
      aiCostPerRun: String(limitsConfig?.costSuggestions?.aiCostPerRun ?? "0.002"),
      monthlyInfrastructure: String(limitsConfig?.costSuggestions?.monthlyInfrastructure ?? "25"),
    });
    setCostsDirty(true);
  };

  const clearCosts = () => {
    setEditCosts({ aiCostPerRun: "", monthlyInfrastructure: "" });
    setCostsDirty(true);
  };

  const saveCosts = async () => {
    const aiValue = editCosts.aiCostPerRun.trim();
    const infraValue = editCosts.monthlyInfrastructure.trim();

    if (aiValue && (!Number.isFinite(Number(aiValue)) || Number(aiValue) < 0)) {
      toast.error("AI cost/run debe ser un numero positivo o quedar vacio");
      return;
    }
    if (infraValue && (!Number.isFinite(Number(infraValue)) || Number(infraValue) < 0)) {
      toast.error("Infraestructura mensual debe ser un numero positivo o quedar vacio");
      return;
    }

    const costs: Record<string, number> = {};
    if (aiValue) costs.aiCostPerRun = Number(aiValue);
    if (infraValue) costs.monthlyInfrastructure = Number(infraValue);

    setSavingCosts(true);
    try {
      await AdminApi.updateLimits({ costs });
      toast.success(Object.keys(costs).length > 0 ? "Costos base actualizados" : "Costos base limpiados");
      await fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingCosts(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!data) return null;

  const aiCostsConfigured = data.expenses?.aiCosts?.configured !== false;
  const infraCostsConfigured = data.expenses?.infrastructure?.configured !== false;
  const costSuggestions = limitsConfig?.costSuggestions || { aiCostPerRun: 0.002, monthlyInfrastructure: 25 };
  const subscriptionFinance = data.revenue?.subscriptions || {
    available: false,
    activeSubscriptions: 0,
    mappedActiveSubscriptions: 0,
    unmappedActiveSubscriptions: 0,
    estimatedMonthlyRecurringRevenue: 0,
    estimatedAnnualContractValue: 0,
    confirmedRevenue: 0,
    confirmedPayments: 0,
    breakdown: [],
  };
  const hasSubscriptionMappingGaps = Number(subscriptionFinance.unmappedActiveSubscriptions || 0) > 0;
  const aiTrackedSpend = Number(data.expenses?.aiCosts?.trackedSpendUsd || 0);
  const aiAvgTrackedCost = Number(data.expenses?.aiCosts?.averageTrackedCostPerRun || 0);
  const aiConfiguredCost = Number(data.expenses?.aiCosts?.configuredCostPerRun || 0);
  const aiEstimatedCost = Number(data.expenses?.aiCosts?.estimatedConfiguredCost || 0);
  const totalTransactions = Number(data.revenue?.totalTransactions ?? data.revenue?.totalOrders ?? 0);

  return (
    <div className="space-y-6">
      {(!aiCostsConfigured || !infraCostsConfigured) && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
          Faltan referencias base para forecast de negocio.
          {!aiCostsConfigured && <span className="ml-1">AI cost/run sin definir para comparar contra gasto real.</span>}
          {!infraCostsConfigured && <span className="ml-1">Infraestructura mensual sin definir.</span>}
        </div>
      )}
      {!subscriptionFinance.available && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-100">
          El reporte no pudo leer suscripciones activas desde Prisma.
          {subscriptionFinance.unavailableReason && <span className="ml-1">{subscriptionFinance.unavailableReason}</span>}
        </div>
      )}
      {subscriptionFinance.available && hasSubscriptionMappingGaps && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
          Hay {subscriptionFinance.unmappedActiveSubscriptions} suscripciones activas sin mapping <code>planId -&gt; billing</code>.
          <span className="ml-1">Se cuentan como activas, pero no entran al MRR estimado.</span>
        </div>
      )}
      {legacyTopUpStatus?.affectedUsers > 0 && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-100">
          Quedan {legacyTopUpStatus.totalLegacyPurchasedCredits} créditos legacy pendientes en {legacyTopUpStatus.affectedUsers} usuarios.
          <span className="ml-1">Conviene migrarlos en batch para cerrar el bucket histórico.</span>
        </div>
      )}

      <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-gray-200">Configuración base de costos</h3>
            <p className="text-[11px] text-gray-500 mt-1">
              Define los costos reales que alimentan utilidad neta y KPIs financieros.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={applySuggestedCosts}
              className="px-3 py-1.5 rounded-lg border border-blue-500/20 text-xs text-blue-300 hover:bg-blue-500/10 transition-colors"
            >
              Usar sugeridos
            </button>
            <button
              onClick={clearCosts}
              className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 hover:bg-white/5 transition-colors"
            >
              Limpiar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0d1117] p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-medium text-gray-200">AI cost/run</p>
              <span className={`text-[9px] px-2 py-0.5 rounded-full border ${aiCostsConfigured ? "text-green-300 border-green-500/20 bg-green-500/10" : "text-amber-300 border-amber-500/20 bg-amber-500/10"}`}>
                {aiCostsConfigured ? "configurado" : "pendiente"}
              </span>
            </div>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={editCosts.aiCostPerRun}
              onChange={(e) => updateCostField("aiCostPerRun", e.target.value)}
              placeholder={String(costSuggestions.aiCostPerRun)}
              className="w-full bg-[#080b12] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C6E36C]/30"
            />
            <p className="text-[10px] text-gray-500 mt-2">
              Sugerido: ${Number(costSuggestions.aiCostPerRun).toFixed(4)} por ejecución. Déjalo vacío para excluirlo del KPI.
            </p>
          </div>

          <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0d1117] p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-medium text-gray-200">Infraestructura mensual</p>
              <span className={`text-[9px] px-2 py-0.5 rounded-full border ${infraCostsConfigured ? "text-green-300 border-green-500/20 bg-green-500/10" : "text-amber-300 border-amber-500/20 bg-amber-500/10"}`}>
                {infraCostsConfigured ? "configurado" : "pendiente"}
              </span>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={editCosts.monthlyInfrastructure}
              onChange={(e) => updateCostField("monthlyInfrastructure", e.target.value)}
              placeholder={String(costSuggestions.monthlyInfrastructure)}
              className="w-full bg-[#080b12] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#C6E36C]/30"
            />
            <p className="text-[10px] text-gray-500 mt-2">
              Sugerido: ${Number(costSuggestions.monthlyInfrastructure).toFixed(2)} al mes. Déjalo vacío para excluirlo del KPI.
            </p>
          </div>
        </div>

        {costsDirty && (
          <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-[#C6E36C]/20 bg-[#C6E36C]/5 p-3">
            <p className="text-xs text-[#C6E36C]">Hay cambios de costos sin guardar.</p>
            <div className="flex gap-2">
              <button
                onClick={resetCostDraft}
                className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 hover:bg-white/5 transition-colors"
              >
                Descartar
              </button>
              <button
                onClick={saveCosts}
                disabled={savingCosts}
                className="px-3 py-1.5 rounded-lg bg-[#C6E36C] text-black text-xs hover:bg-[#b5d45e] transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                {savingCosts ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Guardar costos
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="bg-[#131829] border border-green-500/15 rounded-xl p-4 text-center">
          <DollarSign className="w-5 h-5 text-green-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-green-400">${data.revenue.totalRevenue.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500">Ingresos confirmados ({totalTransactions} movimientos)</p>
        </div>
        <div className="bg-[#131829] border border-fuchsia-500/15 rounded-xl p-4 text-center">
          <ShieldCheck className="w-5 h-5 text-fuchsia-300 mx-auto mb-1" />
          <p className="text-xl font-bold text-fuchsia-300">${Number(data.revenue?.donations?.totalRevenue || 0).toFixed(2)}</p>
          <p className="text-[10px] text-gray-500">Donaciones confirmadas</p>
        </div>
        <div className="bg-[#131829] border border-cyan-500/15 rounded-xl p-4 text-center">
          <RefreshCw className="w-5 h-5 text-cyan-300 mx-auto mb-1" />
          <p className="text-xl font-bold text-cyan-300">
            {subscriptionFinance.available ? `$${Number(subscriptionFinance.estimatedMonthlyRecurringRevenue || 0).toFixed(2)}` : "Sin lectura"}
          </p>
          <p className="text-[10px] text-gray-500">MRR suscripciones</p>
        </div>
        <div className="bg-[#131829] border border-red-500/15 rounded-xl p-4 text-center">
          <AlertTriangle className="w-5 h-5 text-red-400 mx-auto mb-1" />
          <p className="text-xl font-bold text-red-400">${data.expenses.totalExpenses.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500">Gastos Totales</p>
        </div>
        <div className={`bg-[#131829] border rounded-xl p-4 text-center ${data.profit >= 0 ? "border-green-500/15" : "border-red-500/15"}`}>
          <TrendingUp className="w-5 h-5 mx-auto mb-1" />
          <p className={`text-xl font-bold ${data.profit >= 0 ? "text-green-400" : "text-red-400"}`}>${data.profit.toFixed(2)}</p>
          <p className="text-[10px] text-gray-500">Utilidad Neta</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-2">Top-ups one-time</p>
          <p className="text-2xl font-bold text-white">${Number((data.revenue?.topUps || data.revenue?.oneTime)?.totalRevenue || 0).toFixed(2)}</p>
          <p className="text-[10px] text-gray-500 mt-1">{Number((data.revenue?.topUps || data.revenue?.oneTime)?.totalOrders || 0)} recargas confirmadas</p>
        </div>
        <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-2">Suscripciones cobradas</p>
          <p className="text-2xl font-bold text-white">${Number(subscriptionFinance.confirmedRevenue || 0).toFixed(2)}</p>
          <p className="text-[10px] text-gray-500 mt-1">{Number(subscriptionFinance.confirmedPayments || 0)} cobros recurrentes ledgerizados</p>
        </div>
        <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-2">Donaciones</p>
          <p className="text-2xl font-bold text-white">${Number(data.revenue?.donations?.totalRevenue || 0).toFixed(2)}</p>
          <p className="text-[10px] text-gray-500 mt-1">{Number(data.revenue?.donations?.totalOrders || 0)} aportes capturados</p>
        </div>
      </div>

      <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-cyan-300" /> Suscripciones activas
        </h3>
        {subscriptionFinance.available ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-lg font-bold">{Number(subscriptionFinance.activeSubscriptions || 0)}</p>
                <p className="text-[9px] text-gray-500">Activas</p>
              </div>
              <div>
                <p className="text-lg font-bold text-cyan-300">${Number(subscriptionFinance.estimatedMonthlyRecurringRevenue || 0).toFixed(2)}</p>
                <p className="text-[9px] text-gray-500">MRR estimado</p>
              </div>
              <div>
                <p className="text-lg font-bold text-cyan-200">${Number(subscriptionFinance.estimatedAnnualContractValue || 0).toFixed(2)}</p>
                <p className="text-[9px] text-gray-500">Valor anualizado</p>
              </div>
              <div>
                <p className="text-lg font-bold">{Number(subscriptionFinance.mappedActiveSubscriptions || 0)} / {Number(subscriptionFinance.activeSubscriptions || 0)}</p>
                <p className="text-[9px] text-gray-500">Mapeadas a billing</p>
              </div>
            </div>

            {Array.isArray(subscriptionFinance.breakdown) && subscriptionFinance.breakdown.length > 0 && (
              <div className="mt-4 space-y-2">
                {subscriptionFinance.breakdown.map((entry: any) => (
                  <div key={`${entry.tier}-${entry.billing}`} className="flex items-center justify-between rounded-lg border border-[rgba(168,187,238,0.08)] bg-[#0d1117] px-3 py-2 text-sm">
                    <div>
                      <p className="text-gray-200">{entry.tier}</p>
                      <p className="text-[10px] text-gray-500">{entry.billing} · {entry.count} activas</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-cyan-300">${Number(entry.monthlyEquivalent || 0).toFixed(2)}</p>
                      <p className="text-[10px] text-gray-500">MRR</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-500">
            Sin lectura de Prisma para suscripciones activas. El resto del reporte sigue usando ingresos confirmados de KV.
          </p>
        )}
      </div>

      <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-gray-200">Cierre de créditos legacy</h3>
            <p className="text-[11px] text-gray-500 mt-1">
              Migra los `purchasedCredits` históricos al saldo universal sin esperar a que cada usuario use el sistema nuevo.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={fetchData}
              className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Actualizar
            </button>
            <button
              onClick={runLegacyBackfill}
              disabled={runningLegacyBackfill || !legacyTopUpStatus?.affectedUsers}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200 hover:bg-cyan-500/20 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              {runningLegacyBackfill ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              {runningLegacyBackfill ? "Migrando..." : "Migrar bucket legacy"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0d1117] p-4 text-center">
            <p className="text-xl font-bold text-white">{Number(legacyTopUpStatus?.affectedUsers || 0)}</p>
            <p className="text-[10px] text-gray-500">Usuarios afectados</p>
          </div>
          <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0d1117] p-4 text-center">
            <p className="text-xl font-bold text-cyan-300">{Number(legacyTopUpStatus?.totalLegacyPurchasedCredits || 0)}</p>
            <p className="text-[10px] text-gray-500">Créditos por migrar</p>
          </div>
          <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0d1117] p-4 text-center">
            <p className="text-sm font-bold text-gray-200">
              {legacyTopUpStatus?.lastRun?.executedAt
                ? new Date(legacyTopUpStatus.lastRun.executedAt).toLocaleString("es-MX")
                : "Sin ejecutar"}
            </p>
            <p className="text-[10px] text-gray-500">Último backfill</p>
          </div>
        </div>

        {legacyTopUpStatus?.lastRun && (
          <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0d1117] p-3 text-xs text-gray-300">
            Última ejecución: {legacyTopUpStatus.lastRun.migratedUsers} usuarios, {legacyTopUpStatus.lastRun.totalCreditsMigrated} créditos migrados.
          </div>
        )}

        {Array.isArray(legacyTopUpStatus?.preview) && legacyTopUpStatus.preview.length > 0 ? (
          <div className="space-y-2">
            {legacyTopUpStatus.preview.map((entry: any) => (
              <div
                key={entry.userId}
                className="flex items-center justify-between rounded-lg border border-[rgba(168,187,238,0.08)] bg-[#0d1117] px-3 py-2 text-sm"
              >
                <div>
                  <p className="text-gray-200">{entry.displayName || entry.email || entry.userId}</p>
                  <p className="text-[10px] text-gray-500">{entry.email} · {entry.tier}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-cyan-300">{Number(entry.legacyPurchasedCredits || 0)} cr</p>
                  <p className="text-[10px] text-gray-500">legacy pendiente</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            No quedan usuarios con `purchasedCredits` pendientes fuera del saldo universal.
          </p>
        )}
      </div>

      {/* AI Costs */}
      <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-purple-400" /> Gasto IA trackeado
          {!aiCostsConfigured && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              referencia pendiente
            </span>
          )}
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><p className="text-lg font-bold">{data.expenses.aiCosts.totalRuns}</p><p className="text-[9px] text-gray-500">Ejecuciones</p></div>
          <div><p className="text-lg font-bold">${aiAvgTrackedCost.toFixed(4)}</p><p className="text-[9px] text-gray-500">Promedio real/run</p></div>
          <div><p className="text-lg font-bold text-orange-400">${aiTrackedSpend.toFixed(4)}</p><p className="text-[9px] text-gray-500">Total IA real</p></div>
        </div>
        <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-lg font-bold">{aiCostsConfigured ? `$${aiConfiguredCost.toFixed(4)}` : "Sin config"}</p>
            <p className="text-[9px] text-gray-500">Referencia config/run</p>
          </div>
          <div>
            <p className="text-lg font-bold">{aiCostsConfigured ? `$${aiEstimatedCost.toFixed(4)}` : "Sin config"}</p>
            <p className="text-[9px] text-gray-500">Estimado por config</p>
          </div>
          <div>
            <p className="text-lg font-bold">{infraCostsConfigured ? `$${data.expenses.infrastructure.monthly.toFixed(2)}` : "Sin config"}</p>
            <p className="text-[9px] text-gray-500">Infraestructura mensual</p>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-300">{data.expenses.infrastructure.currentMonth}</p>
            <p className="text-[9px] text-gray-500">Mes de referencia</p>
          </div>
        </div>
      </div>

      {/* Revenue by month */}
      {Object.keys(data.revenue.revenueByMonth).length > 0 && (
        <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-400 mb-2">Ingresos por Mes</h3>
          <div className="space-y-1">
            {Object.entries(data.revenue.revenueByMonth as Record<string, number>).map(([month, amt]) => (
              <div key={month} className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{month}</span>
                <span className="text-green-400 font-mono">${amt.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom expenses */}
      <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-400 mb-3">Gastos Personalizados</h3>

        {data.expenses.custom && data.expenses.custom.length > 0 && (
          <div className="space-y-1 mb-4">
            {data.expenses.custom.map((exp: any) => (
              <div key={exp.id} className="flex items-center justify-between text-sm py-1 border-b border-[rgba(168,187,238,0.04)]">
                <div>
                  <span className="text-gray-300">{exp.description}</span>
                  <span className="text-[9px] text-gray-600 ml-2">{exp.category}</span>
                </div>
                <span className="text-red-400 font-mono">${exp.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            placeholder="Descripcion"
            value={newExpense.description}
            onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
            className="flex-1 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none"
          />
          <input
            type="number"
            placeholder="USD"
            value={newExpense.amount}
            onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
            className="w-20 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none"
          />
          <select
            value={newExpense.category}
            onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
            className="bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2 py-1.5 text-xs text-gray-300"
          >
            <option value="general">General</option>
            <option value="ai">IA</option>
            <option value="hosting">Hosting</option>
            <option value="marketing">Marketing</option>
            <option value="salarios">Salarios</option>
          </select>
          <button onClick={addExpense} disabled={adding} className="px-3 py-1.5 bg-[#C6E36C]/10 text-[#C6E36C] border border-[#C6E36C]/20 rounded-lg text-xs hover:bg-[#C6E36C]/20 transition-colors disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Alerts Tab
// ═══════════════════════════════════════════════════════════════════════════════

function AlertsTab() {
  const [alerts, setAlerts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    AdminApi.getAlerts()
      .then(setAlerts)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await AdminApi.updateAlerts(alerts);
      toast.success("Alertas actualizadas");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!alerts) return null;

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" /> Configuracion de Alertas
          </h3>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={alerts.enabled}
              onChange={(e) => setAlerts({ ...alerts, enabled: e.target.checked })}
              className="accent-[#C6E36C]"
            />
            Alertas activas
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] text-gray-500 uppercase block mb-1">Limite de gasto IA (USD/mes)</label>
            <input
              type="number"
              value={alerts.aiSpendingLimit}
              onChange={(e) => setAlerts({ ...alerts, aiSpendingLimit: parseFloat(e.target.value) || 0 })}
              className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C6E36C]/30"
            />
            <p className="text-[9px] text-gray-600 mt-0.5">Se enviara alerta si los costos de IA superan este monto</p>
          </div>

          <div>
            <label className="text-[10px] text-gray-500 uppercase block mb-1">Presupuesto mensual total (USD)</label>
            <input
              type="number"
              value={alerts.monthlyBudget}
              onChange={(e) => setAlerts({ ...alerts, monthlyBudget: parseFloat(e.target.value) || 0 })}
              className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C6E36C]/30"
            />
          </div>

          <div>
            <label className="text-[10px] text-gray-500 uppercase block mb-1">Alerta de crecimiento de usuarios (threshold)</label>
            <input
              type="number"
              value={alerts.userGrowthAlert}
              onChange={(e) => setAlerts({ ...alerts, userGrowthAlert: parseInt(e.target.value) || 0 })}
              className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C6E36C]/30"
            />
            <p className="text-[9px] text-gray-600 mt-0.5">Alerta cuando el numero de usuarios supere este valor</p>
          </div>
        </div>

        <button onClick={save} disabled={saving} className="w-full py-2 rounded-xl bg-[#C6E36C]/10 text-[#C6E36C] border border-[#C6E36C]/20 text-xs hover:bg-[#C6E36C]/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Guardar Configuracion
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Emails Tab
// ═══════════════════════════════════════════════════════════════════════════════

function EmailsTab() {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ to: "", subject: "", message: "", recipientType: "individual" as string });
  const [sending, setSending] = useState(false);

  const fetchEmails = useCallback(async () => {
    try {
      const e = await AdminApi.listEmails();
      setEmails(e || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const sendEmail = async () => {
    if (!form.subject || !form.message) return;
    setSending(true);
    try {
      const result = await AdminApi.sendEmail(form);
      toast.success(`Email enviado a ${result.recipientCount} destinatarios`);
      setForm({ to: "", subject: "", message: "", recipientType: "individual" });
      fetchEmails();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Compose */}
      <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Send className="w-4 h-4 text-blue-400" /> Nuevo Envio
        </h3>

        <div>
          <label className="text-[10px] text-gray-500 uppercase block mb-1">Tipo de destinatario</label>
          <div className="flex gap-2">
            {[
              { value: "individual", label: "Email individual" },
              { value: "all", label: "Todos los usuarios" },
              { value: "tier", label: "Por plan" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setForm({ ...form, recipientType: opt.value })}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  form.recipientType === opt.value
                    ? "bg-[#C6E36C]/10 border-[#C6E36C]/30 text-[#C6E36C]"
                    : "bg-[#1a1f36] border-[rgba(168,187,238,0.08)] text-gray-500"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {form.recipientType === "individual" && (
          <div>
            <label className="text-[10px] text-gray-500 uppercase block mb-1">Email del destinatario</label>
            <input
              type="email"
              placeholder="user@example.com"
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
              className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none"
            />
          </div>
        )}

        {form.recipientType === "tier" && (
          <div>
            <label className="text-[10px] text-gray-500 uppercase block mb-1">Seleccionar plan</label>
            <div className="flex gap-2">
              {(["FREE", "PRO", "STUDIO PRO"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, to: t })}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                    form.to === t ? TIER_COLORS[t] : "text-gray-600 border-[rgba(168,187,238,0.08)]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-[10px] text-gray-500 uppercase block mb-1">Asunto</label>
          <input
            placeholder="Asunto del email"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] text-gray-500 uppercase block mb-1">Mensaje</label>
          <textarea
            placeholder="Contenido del email..."
            rows={5}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none resize-none"
          />
        </div>

        <button
          onClick={sendEmail}
          disabled={sending || !form.subject || !form.message}
          className="w-full py-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {sending ? "Enviando..." : "Enviar Notificacion"}
        </button>

        <p className="text-[9px] text-gray-600 text-center">
          Los emails se registran como log. Integra Resend o SendGrid para envio real.
        </p>
      </div>

      {/* Email history */}
      {!loading && emails.length > 0 && (
        <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-400 mb-3">Historial de Envios</h3>
          <div className="space-y-2">
            {emails.map((em) => (
              <div key={em.id} className="flex items-start gap-3 py-2 border-b border-[rgba(168,187,238,0.05)] last:border-0">
                <Mail className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-medium truncate">{em.subject}</p>
                  <p className="text-[10px] text-gray-500">
                    {em.recipientType === "all" ? "Todos los usuarios" : em.recipientType === "tier" ? `Plan: ${em.to}` : em.to?.join(", ")}
                    &middot; {em.recipientCount} destinatarios
                  </p>
                  <p className="text-[9px] text-gray-600">
                    {new Date(em.sentAt).toLocaleString("es-MX")} &middot;
                    <span className={em.status === "queued" ? "text-amber-400" : "text-green-400"}> {em.status}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Logs Tab
// ═══════════════════════════════════════════════════════════════════════════════

function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AdminApi.getLogs()
      .then(setLogs)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  const actionColors: Record<string, string> = {
    superadmin_init: "text-red-400",
    user_updated: "text-blue-400",
    user_deleted: "text-red-400",
    plans_updated: "text-purple-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-400">Actividad reciente</h3>
        <button onClick={() => { setLoading(true); AdminApi.getLogs().then(setLogs).finally(() => setLoading(false)); }} className="p-1.5 rounded-lg text-gray-500 hover:text-white transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-8 text-center">
          <ScrollText className="w-10 h-10 text-gray-700 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Sin actividad registrada</p>
        </div>
      ) : (
        <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl divide-y divide-[rgba(168,187,238,0.05)]">
          {logs.map((log, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#C6E36C]/50 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-medium ${actionColors[log.action] || "text-gray-300"}`}>
                  {log.action?.replace(/_/g, " ")}
                </span>
                {log.targetUserId && (
                  <span className="text-[10px] text-gray-600 ml-2">
                    Usuario: {log.targetUserId.slice(0, 8)}...
                  </span>
                )}
                {log.changes && (
                  <span className="text-[10px] text-gray-600 ml-2">
                    {JSON.stringify(log.changes).slice(0, 60)}
                  </span>
                )}
              </div>
              <span className="text-[9px] text-gray-600 shrink-0">
                {new Date(log.at).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Content Tab (CMS) – List / Detail with Live Preview
// ═══════════════════════════════════════════════════════════════════════════════

const LOCALES = ["es", "en", "pt"] as const;
const LOCALE_LABELS: Record<string, string> = { es: "Español", en: "English", pt: "Português" };

type ContentItemDef = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
};

const CONTENT_ITEMS: ContentItemDef[] = [
  {
    id: "hero-banner",
    label: "Hero Banner",
    description: "Banner principal de la Landing Page: imagen, textos, CTAs y modelo destacado.",
    icon: <LayoutDashboard className="w-6 h-6" />,
    color: "#C6E36C",
  },
  // Future items will be added here:
  // { id: "feature-cards",  label: "Feature Cards", ... },
  // { id: "announcement",   label: "Announcement Bar", ... },
];

function ContentTab() {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  if (selectedItem === "hero-banner") {
    return <HeroBannerEditor onBack={() => setSelectedItem(null)} />;
  }

  // ─── List View ──────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Contenido Administrable</h3>
          <p className="text-xs text-gray-500 mt-1">Selecciona un elemento para editar su contenido y ver la vista previa en tiempo real.</p>
        </div>
        <span className="text-[10px] text-gray-600 bg-[#131829] border border-[rgba(168,187,238,0.08)] px-3 py-1 rounded-full">
          {CONTENT_ITEMS.length} {CONTENT_ITEMS.length === 1 ? "elemento" : "elementos"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CONTENT_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedItem(item.id)}
            className="text-left group bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-5 hover:border-[rgba(198,227,108,0.25)] hover:bg-[#131829]/80 transition-all duration-200 relative overflow-hidden"
          >
            {/* Decorative glow */}
            <div
              className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none"
              style={{ background: item.color }}
            />
            <div className="relative z-10">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 border transition-colors"
                style={{
                  background: `${item.color}15`,
                  borderColor: `${item.color}25`,
                  color: item.color,
                }}
              >
                {item.icon}
              </div>
              <h4 className="text-sm font-semibold text-white mb-1 group-hover:text-[#C6E36C] transition-colors">{item.label}</h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">{item.description}</p>
              <div className="mt-4 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-gray-600 group-hover:text-[#C6E36C]/70 transition-colors">
                Editar
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </div>
            </div>
          </button>
        ))}

        {/* Placeholder for future items */}
        <div className="border border-dashed border-[rgba(168,187,238,0.08)] rounded-xl p-5 flex flex-col items-center justify-center text-center min-h-[180px]">
          <Plus className="w-5 h-5 text-gray-700 mb-2" />
          <span className="text-[10px] text-gray-600 uppercase tracking-wide font-medium">Próximamente</span>
          <span className="text-[10px] text-gray-700 mt-1">Feature Cards, Announcements…</span>
        </div>
      </div>
    </div>
  );
}

// ─── Hero Banner Editor (detail view with preview) ─────────────────────────

function HeroBannerEditor({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [previewLocale, setPreviewLocale] = useState<string>("es");

  // Model search picker state
  const [modelSearch, setModelSearch] = useState("");
  const [modelResults, setModelResults] = useState<Array<{ id: string; title: string; authorUsername?: string }>>([]);
  const [modelSearching, setModelSearching] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const searchDebounce = (globalThis as any).__cms_debounce as ReturnType<typeof setTimeout> | undefined;

  const handleModelSearch = (query: string) => {
    setModelSearch(query);
    if ((globalThis as any).__cms_debounce) clearTimeout((globalThis as any).__cms_debounce);
    if (!query.trim()) { setModelResults([]); return; }
    (globalThis as any).__cms_debounce = setTimeout(async () => {
      setModelSearching(true);
      try {
        const res = await CommunityApi.listModels({ search: query, limit: 8 });
        setModelResults(res.models.map((m) => ({ id: m.id, title: m.title, authorUsername: m.authorUsername })));
      } catch { setModelResults([]); }
      setModelSearching(false);
    }, 350);
  };

  const selectModel = (id: string) => {
    setFeaturedModelId(id);
    setHasChanges(true);
    setShowModelPicker(false);
    setModelSearch("");
    setModelResults([]);
  };

  // Hero banner config state
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [featuredModelId, setFeaturedModelId] = useState("");
  const [primaryCtaRoute, setPrimaryCtaRoute] = useState("/studio");
  const [secondaryCtaRoute, setSecondaryCtaRoute] = useState("/comunidad");
  const [localeOverrides, setLocaleOverrides] = useState<Record<string, { title?: string; subtitle?: string; tagline?: string; featuredLabel?: string; featuredSubtitle?: string; primaryCta?: string; secondaryCta?: string }>>({
    es: {}, en: {}, pt: {},
  });

  useEffect(() => {
    AdminApi.getHeroBanner()
      .then((config: any) => {
        if (config) {
          setHeroImageUrl(config.heroImageUrl || "");
          setFeaturedModelId(config.featuredModelId || "");
          setPrimaryCtaRoute(config.primaryCtaRoute || "/studio");
          setSecondaryCtaRoute(config.secondaryCtaRoute || "/comunidad");
          setLocaleOverrides(config.localeOverrides || { es: {}, en: {}, pt: {} });
        }
      })
      .catch(() => { /* no config yet */ })
      .finally(() => setLoading(false));
  }, []);

  const updateLocale = (locale: string, field: string, value: string) => {
    setLocaleOverrides((prev) => ({
      ...prev,
      [locale]: { ...prev[locale], [field]: value },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await AdminApi.updateHeroBanner({
        heroImageUrl,
        featuredModelId,
        primaryCtaRoute,
        secondaryCtaRoute,
        localeOverrides,
      });
      toast.success("Hero banner actualizado");
      setHasChanges(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const inputCls = "w-full mt-1 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C6E36C]/30";
  const labelCls = "text-[10px] text-gray-500 uppercase tracking-wide font-semibold";

  // Resolve preview text: admin override > default fallback
  const pv = localeOverrides[previewLocale] || {};
  const FALLBACKS: Record<string, Record<string, string>> = {
    es: { tagline: "Vorea Studio · Parametric 3D", title: "Tu taller creativo para impresión 3D.", subtitle: "Diseña piezas únicas de forma sencilla. Personaliza modelos con un clic, aplica texturas naturales con IA y comparte tus creaciones con el mundo.", primaryCta: "Entrar al Editor", secondaryCta: "Explorar Comunidad", featuredLabel: "Relieve Paramétrico", featuredSubtitle: "Render en tiempo real" },
    en: { tagline: "Vorea Studio · Parametric 3D", title: "Your creative workshop for 3D printing.", subtitle: "Design unique pieces effortlessly. Customize models with a click, apply natural textures with AI, and share your creations with the world.", primaryCta: "Open Editor", secondaryCta: "Explore Community", featuredLabel: "Parametric Relief", featuredSubtitle: "Real-time render" },
    pt: { tagline: "Vorea Studio · Parametric 3D", title: "A tua oficina criativa para impressão 3D.", subtitle: "Desenha peças únicas de forma simples. Personaliza modelos com um clique, aplica texturas naturais com IA e partilha as tuas criações com o mundo.", primaryCta: "Abrir Editor", secondaryCta: "Explorar Comunidade", featuredLabel: "Relevo Paramétrico", featuredSubtitle: "Render em tempo real" },
  };
  const fb = FALLBACKS[previewLocale] || FALLBACKS.es;
  const pvTagline = pv.tagline || fb.tagline;
  const pvTitle = pv.title || fb.title;
  const pvSubtitle = pv.subtitle || fb.subtitle;
  const pvPrimaryCta = pv.primaryCta || fb.primaryCta;
  const pvSecondaryCta = pv.secondaryCta || fb.secondaryCta;
  const pvFeaturedLabel = pv.featuredLabel || fb.featuredLabel;
  const pvFeaturedSubtitle = pv.featuredSubtitle || fb.featuredSubtitle;

  return (
    <div className="space-y-4">
      {/* Top bar: Back + Save */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors group"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-0.5 transition-transform"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Volver a Contenidos
        </button>

        {hasChanges && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#C6E36C] animate-pulse">● Sin guardar</span>
            <button
              onClick={() => { setHasChanges(false); window.location.reload(); }}
              className="text-[10px] text-gray-500 hover:text-white px-2.5 py-1 rounded-lg border border-gray-700 transition-colors"
            >
              Descartar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-[10px] text-black bg-[#C6E36C] hover:bg-[#b5d45e] px-3 py-1 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 font-semibold"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Guardar
            </button>
          </div>
        )}
      </div>

      {/* Split: Editor (left) + Preview (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* ─── Editor Panel ─────────────────────────────────────── */}
        <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-5 space-y-5 max-h-[75vh] overflow-y-auto scrollbar-thin">
          <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 sticky top-0 bg-[#131829] pb-2 z-10">
            <Edit2 className="w-4 h-4 text-[#C6E36C]" />
            Hero Banner — Editor
          </h3>

          {/* Global fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Hero Image URL</label>
              <input
                value={heroImageUrl}
                onChange={(e) => { setHeroImageUrl(e.target.value); setHasChanges(true); }}
                placeholder="/imports/hero-relief.png o URL externa"
                className={inputCls}
              />
            </div>
            <div className="relative">
              <label className={labelCls}>Modelo Destacado (Fork)</label>
              <div className="flex gap-1 mt-1">
                <input
                  value={featuredModelId}
                  onChange={(e) => { setFeaturedModelId(e.target.value); setHasChanges(true); }}
                  placeholder="cm_abc123"
                  className={inputCls + " !mt-0 font-mono text-[11px]"}
                />
                <button
                  type="button"
                  onClick={() => setShowModelPicker(!showModelPicker)}
                  className="shrink-0 px-2.5 bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg text-gray-400 hover:text-[#C6E36C] hover:border-[#C6E36C]/30 transition-colors"
                  title="Buscar modelo"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
              {featuredModelId && (
                <a
                  href={`/modelo/${featuredModelId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[9px] text-gray-600 hover:text-[#C6E36C] mt-1 inline-flex items-center gap-1 transition-colors"
                >
                  /modelo/{featuredModelId} ↗
                </a>
              )}
              {/* Inline model search dropdown */}
              {showModelPicker && (
                <div className="mt-2 bg-[#0d1117] border border-[rgba(168,187,238,0.15)] rounded-lg p-2 space-y-2">
                  <input
                    value={modelSearch}
                    onChange={(e) => handleModelSearch(e.target.value)}
                    placeholder="Buscar por nombre..."
                    className={inputCls + " !mt-0 text-[11px]"}
                    autoFocus
                  />
                  {modelSearching && (
                    <div className="flex items-center gap-2 py-2 px-1 text-[10px] text-gray-500">
                      <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
                    </div>
                  )}
                  {modelResults.length > 0 && (
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                      {modelResults.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => selectModel(m.id)}
                          className="w-full text-left px-2 py-1.5 rounded-md hover:bg-[#C6E36C]/10 transition-colors group/pick flex items-center justify-between"
                        >
                          <div className="min-w-0">
                            <span className="text-[11px] text-white font-medium block truncate group-hover/pick:text-[#C6E36C] transition-colors">{m.title}</span>
                            <span className="text-[9px] text-gray-600 font-mono">{m.id}</span>
                            {m.authorUsername && <span className="text-[9px] text-gray-600"> · {m.authorUsername}</span>}
                          </div>
                          <span className="text-[9px] text-gray-700 group-hover/pick:text-[#C6E36C]/70 shrink-0 ml-2">Seleccionar</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {modelSearch && !modelSearching && modelResults.length === 0 && (
                    <p className="text-[10px] text-gray-600 py-2 px-1">Sin resultados para "{modelSearch}"</p>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>CTA Primario — Ruta</label>
              <input
                value={primaryCtaRoute}
                onChange={(e) => { setPrimaryCtaRoute(e.target.value); setHasChanges(true); }}
                placeholder="/studio"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>CTA Secundario — Ruta</label>
              <input
                value={secondaryCtaRoute}
                onChange={(e) => { setSecondaryCtaRoute(e.target.value); setHasChanges(true); }}
                placeholder="/comunidad"
                className={inputCls}
              />
            </div>
          </div>

          {/* Per-locale text overrides — edit locale is synced with preview locale */}
          <div className="border-t border-[rgba(168,187,238,0.06)] pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-600">Textos por idioma — dejar vacío usa el valor por defecto.</p>
              {/* Locale tab selector: keeps editor + preview in sync */}
              <div className="flex items-center gap-1 bg-[#0d1117] rounded-lg p-0.5 border border-[rgba(168,187,238,0.08)]">
                {LOCALES.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setPreviewLocale(loc)}
                    className={`text-[10px] px-2.5 py-1 rounded-md font-semibold transition-all ${
                      previewLocale === loc
                        ? "bg-[#C6E36C]/15 text-[#C6E36C] border border-[#C6E36C]/20"
                        : "text-gray-500 hover:text-gray-300 border border-transparent"
                    }`}
                  >
                    {loc.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {/* Only show fields for the active locale — prevents editing all 3 at once */}
            <div className="bg-[#0d1117]/60 rounded-lg p-4">
              <p className="text-[10px] text-[#C6E36C]/70 mb-3 font-semibold uppercase tracking-wide">
                {LOCALE_LABELS[previewLocale]} ({previewLocale})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tagline</label>
                  <input value={localeOverrides[previewLocale]?.tagline || ""} onChange={(e) => updateLocale(previewLocale, "tagline", e.target.value)} placeholder={FALLBACKS[previewLocale]?.tagline || FALLBACKS.es.tagline} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Título</label>
                  <input value={localeOverrides[previewLocale]?.title || ""} onChange={(e) => updateLocale(previewLocale, "title", e.target.value)} placeholder={FALLBACKS[previewLocale]?.title || FALLBACKS.es.title} className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Subtítulo</label>
                  <input value={localeOverrides[previewLocale]?.subtitle || ""} onChange={(e) => updateLocale(previewLocale, "subtitle", e.target.value)} placeholder={FALLBACKS[previewLocale]?.subtitle || FALLBACKS.es.subtitle} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Label Modelo Destacado</label>
                  <input value={localeOverrides[previewLocale]?.featuredLabel || ""} onChange={(e) => updateLocale(previewLocale, "featuredLabel", e.target.value)} placeholder={FALLBACKS[previewLocale]?.featuredLabel || FALLBACKS.es.featuredLabel} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Subtítulo Modelo Destacado</label>
                  <input value={localeOverrides[previewLocale]?.featuredSubtitle || ""} onChange={(e) => updateLocale(previewLocale, "featuredSubtitle", e.target.value)} placeholder={FALLBACKS[previewLocale]?.featuredSubtitle || FALLBACKS.es.featuredSubtitle} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>CTA Primario (texto)</label>
                  <input value={localeOverrides[previewLocale]?.primaryCta || ""} onChange={(e) => updateLocale(previewLocale, "primaryCta", e.target.value)} placeholder={FALLBACKS[previewLocale]?.primaryCta || FALLBACKS.es.primaryCta} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>CTA Secundario (texto)</label>
                  <input value={localeOverrides[previewLocale]?.secondaryCta || ""} onChange={(e) => updateLocale(previewLocale, "secondaryCta", e.target.value)} placeholder={FALLBACKS[previewLocale]?.secondaryCta || FALLBACKS.es.secondaryCta} className={inputCls} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Live Preview Panel ───────────────────────────────── */}
        <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#C6E36C]" />
              Vista Previa
            </h3>
            {/* Locale picker for preview */}
            <div className="flex items-center gap-1 bg-[#0d1117] rounded-lg p-0.5 border border-[rgba(168,187,238,0.08)]">
              {LOCALES.map((loc) => (
                <button
                  key={loc}
                  onClick={() => setPreviewLocale(loc)}
                  className={`text-[10px] px-2.5 py-1 rounded-md font-semibold transition-all ${
                    previewLocale === loc
                      ? "bg-[#C6E36C]/15 text-[#C6E36C] border border-[#C6E36C]/20"
                      : "text-gray-500 hover:text-gray-300 border border-transparent"
                  }`}
                >
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Simulated hero banner preview */}
          <div className="rounded-xl overflow-hidden bg-[#0d1117] border border-[rgba(168,187,238,0.06)]">
            {/* Mini hero simulation */}
            <div className="flex flex-col md:flex-row gap-4 p-5">
              {/* Text side */}
              <div className="flex-1 flex flex-col justify-center space-y-3 min-w-0">
                <p className="text-[9px] font-bold text-[#C6E36C] tracking-[0.15em] uppercase flex items-center gap-2">
                  <span className="w-4 h-[1.5px] bg-[#C6E36C]" />
                  {pvTagline}
                </p>
                <div>
                  <span className="text-sm md:text-base font-extrabold text-white leading-tight block">{pvTitle.split(":")[0]}</span>
                  {pvTitle.includes(":") && (
                    <span
                      className="text-sm md:text-base font-extrabold leading-tight block"
                      style={{
                        background: "linear-gradient(135deg, #C6E36C 0%, #76A665 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      :{pvTitle.split(":").slice(1).join(":")}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed line-clamp-3">{pvSubtitle}</p>
                <div className="flex gap-2 pt-1">
                  <span className="text-[9px] font-bold text-black bg-[#C6E36C] rounded-md px-2.5 py-1">{pvPrimaryCta}</span>
                  <span className="text-[9px] font-bold text-white border border-[rgba(168,187,238,0.2)] rounded-md px-2.5 py-1">{pvSecondaryCta}</span>
                </div>
              </div>

              {/* Image side */}
              <div className="flex-1 relative rounded-xl overflow-hidden bg-gradient-to-tr from-[#1a1f36] to-[#0d1117] border border-[rgba(168,187,238,0.06)] min-h-[140px] md:min-h-[180px]">
                {heroImageUrl ? (
                  <img
                    src={heroImageUrl}
                    alt="Hero preview"
                    className="absolute inset-0 w-full h-full object-cover opacity-70"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-gray-600">
                      <LayoutDashboard className="w-8 h-8 mx-auto mb-1 opacity-30" />
                      <span className="text-[9px]">Imagen del hero</span>
                    </div>
                  </div>
                )}
                {/* Featured model overlay */}
                <div className="absolute bottom-2 left-2 right-2 bg-[#0d1117]/80 backdrop-blur-sm rounded-lg p-2 flex items-center justify-between border border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#C6E36C]/20 flex items-center justify-center border border-[#C6E36C]/30">
                      <div className="w-2 h-2 rounded-full bg-[#C6E36C]" />
                    </div>
                    <div>
                      <span className="text-[9px] text-white font-medium block leading-tight">{pvFeaturedLabel}</span>
                      <span className="text-[8px] text-gray-500 block">{pvFeaturedSubtitle}</span>
                    </div>
                  </div>
                  <div className="w-4 h-4 rounded-full bg-white/5 flex items-center justify-center text-white">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview meta */}
            <div className="border-t border-[rgba(168,187,238,0.04)] px-4 py-2 flex items-center justify-between">
              <span className="text-[9px] text-gray-600">
                Vista previa — {LOCALE_LABELS[previewLocale]}
              </span>
              {featuredModelId && (
                <span className="text-[9px] text-gray-600">
                  Modelo: <span className="text-gray-400 font-mono">{featuredModelId}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared
// ═══════════════════════════════════════════════════════════════════════════════

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-[#C6E36C]" />
    </div>
  );
}
