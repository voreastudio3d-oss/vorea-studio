/**
 * ActivityTab — Admin panel for viewing user activity logs and KPIs.
 *
 * Two sections:
 *  1. KPI Dashboard — aggregated metrics (active users, exports, AI generations, purchases)
 *  2. Per-user Activity Log — search by user, view their activity history
 *
 * Vorea Studio — voreastudio.com
 */

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Search, Users, TrendingUp, Coins, Zap, ShoppingCart,
  Activity, RefreshCw, ChevronDown, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { AdminApi } from "../services/api-client";
import { useI18n } from "../services/i18n-context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPIData {
  totalUsers: number;
  activeToday: number;
  activeWeek: number;
  activeMonth: number;
  totalExports: number;
  totalPaidActions?: number;
  totalToolCreditActions?: number;
  totalAiGenerations: number;
  totalCreditPurchases: number;
  totalCreditsSpent: number;
  totalLegacyCreditsSpent?: number;
  totalToolCreditsSpent?: number;
  actionCounts: Record<string, number>;
  toolActionCounts?: Record<string, number>;
}

const ACTION_KEYS: Record<string, string> = {
  login: "admin.activity.login",
  credit_consumed: "admin.activity.creditConsumed",
  tool_credit_consumed: "Créditos de herramienta usados",
  tool_credit_topped_up: "Top-up de créditos agregado",
  tool_credit_topup_migrated: "Créditos legacy migrados al saldo universal",
  credit_purchased: "admin.activity.creditPurchased",
  coupon_redeemed: "admin.activity.couponRedeemed",
  ai_generation: "admin.activity.aiGeneration",
  model_published: "admin.activity.modelPublished",
  tier_changed: "admin.activity.tierChanged",
};

const ACTION_COLORS: Record<string, string> = {
  login: "text-blue-400",
  credit_consumed: "text-amber-400",
  tool_credit_consumed: "text-amber-300",
  tool_credit_topped_up: "text-green-400",
  tool_credit_topup_migrated: "text-cyan-300",
  credit_purchased: "text-green-400",
  coupon_redeemed: "text-purple-400",
  ai_generation: "text-cyan-400",
  model_published: "text-[#C6E36C]",
  tier_changed: "text-red-400",
};

function resolveActionLabel(action: string, t: (key: string) => string) {
  const label = ACTION_KEYS[action];
  if (!label) return action;
  return label.includes(".") ? t(label) : label;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActivityTab() {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [kpi, setKPI] = useState<KPIData | null>(null);

  // Per-user activity
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  // ─── Load KPI ─────────────────────────────────────────────────────
  const loadKPI = useCallback(async () => {
    try {
      const data = await AdminApi.getKPI();
      setKPI(data);
    } catch (e: any) {
      toast.error(e.message);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      loadKPI(),
      AdminApi.listUsers().then((res: any) => setUsers(res.users || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [loadKPI]);

  // ─── Load user activity ───────────────────────────────────────────
  const loadUserActivity = useCallback(async (userId: string) => {
    setSelectedUserId(userId);
    setLoadingActivity(true);
    try {
      const activity = await AdminApi.getUserActivity(userId, 100);
      setUserActivity(activity);
    } catch (e: any) {
      toast.error(e.message);
      setUserActivity([]);
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  // Filter users by search
  const filteredUsers = userSearch
    ? users.filter((u) =>
        (u.email || "").toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.displayName || "").toLowerCase().includes(userSearch.toLowerCase())
      )
    : users.slice(0, 20);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#C6E36C] animate-spin" />
      </div>
    );
  }

  const totalPaidActions = kpi?.totalPaidActions ?? kpi?.totalExports ?? 0;
  const totalToolCreditActions = kpi?.totalToolCreditActions ?? 0;

  return (
    <div className="space-y-6">
      {/* ─── KPI Dashboard ─────────────────────────────────────────────── */}
      <div className="p-5 rounded-xl bg-[rgba(26,31,54,0.7)] border border-[rgba(168,187,238,0.12)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#C6E36C]" />
            <h2 className="text-sm font-semibold">KPI Dashboard</h2>
          </div>
          <button
            className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            onClick={loadKPI}
          >
            <RefreshCw className="w-3 h-3" /> {t("admin.activity.refresh")}
          </button>
        </div>

        {kpi && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Total Users */}
            <div className="p-3 rounded-lg bg-[#0e1225]/60 border border-[rgba(168,187,238,0.08)]">
              <div className="flex items-center gap-1.5 text-[9px] text-gray-500 uppercase tracking-wider mb-1">
                <Users className="w-3 h-3" /> {t("admin.activity.users")}
              </div>
              <p className="text-xl font-bold text-gray-200">{kpi.totalUsers}</p>
              <div className="flex gap-2 mt-1 text-[9px] text-gray-500">
                <span className="text-green-400">{kpi.activeToday} {t("admin.activity.today")}</span>
                <span>{kpi.activeWeek} {t("admin.activity.week")}</span>
                <span>{kpi.activeMonth} {t("admin.activity.monthPeriod")}</span>
              </div>
            </div>

            {/* Exports */}
            <div className="p-3 rounded-lg bg-[#0e1225]/60 border border-[rgba(168,187,238,0.08)]">
              <div className="flex items-center gap-1.5 text-[9px] text-gray-500 uppercase tracking-wider mb-1">
                <Activity className="w-3 h-3" /> Acciones con crédito
              </div>
              <p className="text-xl font-bold text-amber-400">{totalPaidActions}</p>
              <p className="text-[9px] text-gray-500 mt-1">
                {kpi.totalCreditsSpent} cr usados · {totalToolCreditActions} tool / {kpi.totalExports} export
              </p>
            </div>

            {/* AI Generations */}
            <div className="p-3 rounded-lg bg-[#0e1225]/60 border border-[rgba(168,187,238,0.08)]">
              <div className="flex items-center gap-1.5 text-[9px] text-gray-500 uppercase tracking-wider mb-1">
                <Zap className="w-3 h-3" /> {t("admin.activity.aiGenerations")}
              </div>
              <p className="text-xl font-bold text-cyan-400">{kpi.totalAiGenerations}</p>
            </div>

            {/* Purchases */}
            <div className="p-3 rounded-lg bg-[#0e1225]/60 border border-[rgba(168,187,238,0.08)]">
              <div className="flex items-center gap-1.5 text-[9px] text-gray-500 uppercase tracking-wider mb-1">
                <ShoppingCart className="w-3 h-3" /> {t("admin.activity.purchases")}
              </div>
              <p className="text-xl font-bold text-green-400">{kpi.totalCreditPurchases}</p>
            </div>
          </div>
        )}

        {/* Action Breakdown */}
        {kpi && Object.keys(kpi.actionCounts).length > 0 && (
          <div className="mt-4 pt-4 border-t border-[rgba(168,187,238,0.08)]">
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">{t("admin.activity.actionBreakdown")}</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(kpi.actionCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([action, count]) => (
                  <span
                    key={action}
                    className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-[#0e1225]/80 border border-[rgba(168,187,238,0.08)] ${ACTION_COLORS[action] || "text-gray-400"}`}
                  >
                    {resolveActionLabel(action, t)}: <strong>{count}</strong>
                  </span>
                ))}
            </div>
          </div>
        )}

        {kpi && kpi.toolActionCounts && Object.keys(kpi.toolActionCounts).length > 0 && (
          <div className="mt-4 pt-4 border-t border-[rgba(168,187,238,0.08)]">
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Descuento por herramienta</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(kpi.toolActionCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([toolId, count]) => (
                  <span
                    key={toolId}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-[#0e1225]/80 border border-[rgba(168,187,238,0.08)] text-amber-300"
                  >
                    {toolId}: <strong>{count}</strong>
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Per-User Activity Log ─────────────────────────────────────── */}
      <div className="p-5 rounded-xl bg-[rgba(26,31,54,0.7)] border border-[rgba(168,187,238,0.12)]">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-[#C6E36C]" />
          <h2 className="text-sm font-semibold">{t("admin.activity.perUser")}</h2>
        </div>

        {/* User search */}
        <div className="relative mb-3 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder={t("admin.activity.searchPlaceholder")}
            className="w-full pl-9 pr-3 py-2 bg-[#0d1117] border border-[rgba(168,187,238,0.15)] rounded-lg text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-[#C6E36C]/50 transition-colors"
          />
        </div>

        {/* User list (compact) */}
        <div className="flex flex-wrap gap-1.5 mb-4 max-h-32 overflow-y-auto">
          {filteredUsers.map((u) => (
            <button
              key={u.id}
              className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                selectedUserId === u.id
                  ? "bg-[#C6E36C]/15 border-[#C6E36C]/30 text-[#C6E36C]"
                  : "bg-[#0e1225]/60 border-[rgba(168,187,238,0.08)] text-gray-400 hover:text-gray-200 hover:border-[rgba(168,187,238,0.2)]"
              }`}
              onClick={() => loadUserActivity(u.id)}
            >
              {u.email || u.displayName || u.id}
            </button>
          ))}
        </div>

        {/* Activity timeline */}
        {loadingActivity ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-[#C6E36C] animate-spin" />
          </div>
        ) : selectedUserId && userActivity.length > 0 ? (
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {userActivity.map((entry, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0e1225]/40 border border-[rgba(168,187,238,0.05)] text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${ACTION_COLORS[entry.action] || "text-gray-400"}`}>
                    {resolveActionLabel(entry.action, t)}
                  </span>
                  {entry.creditCost !== undefined && (
                    <span className="text-[9px] text-gray-600">
                      <Coins className="w-2.5 h-2.5 inline mr-0.5" />{entry.creditCost} cr
                    </span>
                  )}
                  {entry.creditsAdded !== undefined && (
                    <span className="text-[9px] text-green-500">+{entry.creditsAdded} cr</span>
                  )}
                  {entry.promoName && (
                    <span className="text-[9px] text-purple-400">{entry.promoName}</span>
                  )}
                </div>
                <span className="text-[9px] text-gray-600">
                  {entry.at ? new Date(entry.at).toLocaleString(locale.startsWith("en") ? "en-US" : locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </div>
            ))}
          </div>
        ) : selectedUserId ? (
          <p className="text-xs text-gray-500 text-center py-6">{t("admin.activity.noActivity")}</p>
        ) : (
          <p className="text-xs text-gray-500 text-center py-6">{t("admin.activity.selectUser")}</p>
        )}
      </div>
    </div>
  );
}
