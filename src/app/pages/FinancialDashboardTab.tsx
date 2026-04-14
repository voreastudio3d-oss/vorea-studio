import { useState, useEffect, useCallback } from "react";
import { Loader2, TrendingUp, DollarSign, CreditCard, Zap, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AdminApi } from "../services/api-client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const COLORS = {
  revenue: "#C6E36C",
  topUps: "#60a5fa",
  subscriptions: "#a78bfa",
  donations: "#f59e0b",
  aiCosts: "#ef4444",
  infra: "#f97316",
  profit: "#10b981",
};

interface RevenueData {
  revenue: {
    totalRevenue: number;
    revenueByMonth: Record<string, number>;
    totalTransactions: number;
    avgTransactionValue: number;
    oneTime: { totalRevenue: number; totalOrders: number; revenueByMonth: Record<string, number> };
    donations: { totalRevenue: number; totalOrders: number; revenueByMonth: Record<string, number> };
    subscriptions: { confirmedRevenue: number; confirmedPayments: number; revenueByMonth: Record<string, number> };
  };
  expenses: {
    aiCosts: { totalRuns: number; trackedSpendUsd: number; spendByMonth: Record<string, number> };
    infrastructure: { monthly: number; currentMonth: string };
    totalExpenses: number;
  };
  profit: number;
}

function KpiCard({ label, value, icon, color = "text-white" }: {
  label: string; value: string; icon: React.ReactNode; color?: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-white/40">{icon}</span>
        <span className="text-xs text-white/50">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function formatUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FinancialDashboardTab() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const d = await AdminApi.getRevenueReport();
      setData(d as RevenueData);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-10 text-white/40">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        <p>No se pudieron cargar los datos financieros.</p>
      </div>
    );
  }

  const { revenue, expenses, profit } = data;

  // Monthly trend data for charts
  const allMonths = new Set([
    ...Object.keys(revenue.revenueByMonth),
    ...Object.keys(expenses.aiCosts.spendByMonth),
  ]);
  const sortedMonths = [...allMonths].sort();

  const monthlyTrend = sortedMonths.map((month) => ({
    month: month.slice(2), // "26-01" format
    revenue: revenue.revenueByMonth[month] || 0,
    topUps: revenue.oneTime.revenueByMonth[month] || 0,
    subscriptions: revenue.subscriptions.revenueByMonth[month] || 0,
    donations: revenue.donations.revenueByMonth[month] || 0,
    aiCosts: expenses.aiCosts.spendByMonth[month] || 0,
  }));

  // Revenue breakdown for pie chart
  const revenuePie = [
    { name: "Top-ups", value: revenue.oneTime.totalRevenue, color: COLORS.topUps },
    { name: "Suscripciones", value: revenue.subscriptions.confirmedRevenue, color: COLORS.subscriptions },
    { name: "Donaciones", value: revenue.donations.totalRevenue, color: COLORS.donations },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Dashboard Financiero</h2>
        <p className="text-sm text-white/50 mt-1">Métricas consolidadas de ingresos, costos y rentabilidad</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Ingresos totales"
          value={formatUsd(revenue.totalRevenue)}
          icon={<TrendingUp className="w-4 h-4" />}
          color="text-[#C6E36C]"
        />
        <KpiCard
          label="Gastos totales"
          value={formatUsd(expenses.totalExpenses)}
          icon={<CreditCard className="w-4 h-4" />}
          color="text-red-400"
        />
        <KpiCard
          label="Beneficio neto"
          value={formatUsd(profit)}
          icon={<DollarSign className="w-4 h-4" />}
          color={profit >= 0 ? "text-emerald-400" : "text-red-400"}
        />
        <KpiCard
          label="Transacciones"
          value={String(revenue.totalTransactions)}
          icon={<Zap className="w-4 h-4" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by Month (stacked bar) */}
        {monthlyTrend.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Ingresos por Mes</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }}
                    formatter={(value: number) => formatUsd(value)}
                  />
                  <Bar dataKey="topUps" name="Top-ups" stackId="rev" fill={COLORS.topUps} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="subscriptions" name="Suscripciones" stackId="rev" fill={COLORS.subscriptions} />
                  <Bar dataKey="donations" name="Donaciones" stackId="rev" fill={COLORS.donations} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Revenue Breakdown Pie */}
        {revenuePie.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Desglose de Ingresos</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={revenuePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {revenuePie.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} formatter={(value: number) => formatUsd(value)} />
                  <Legend wrapperStyle={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* AI Cost Trend */}
      {monthlyTrend.some((m) => m.aiCosts > 0) && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Costo IA por Mes</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }}
                  formatter={(value: number) => formatUsd(value)}
                />
                <Line type="monotone" dataKey="aiCosts" name="Costo IA" stroke={COLORS.aiCosts} strokeWidth={2} dot={{ fill: COLORS.aiCosts }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-white/50">
            <span>Total AI runs: <strong className="text-white">{expenses.aiCosts.totalRuns}</strong></span>
            <span>Total AI spend: <strong className="text-red-400">{formatUsd(expenses.aiCosts.trackedSpendUsd)}</strong></span>
            <span>Infra mensual: <strong className="text-orange-400">{formatUsd(expenses.infrastructure.monthly)}</strong></span>
          </div>
        </div>
      )}

      {/* Revenue Summary Table */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Resumen por Canal</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/50 border-b border-white/10">
                <th className="text-left py-2 font-medium">Canal</th>
                <th className="text-right py-2 font-medium">Ingresos</th>
                <th className="text-right py-2 font-medium">Transacciones</th>
                <th className="text-right py-2 font-medium">Promedio</th>
              </tr>
            </thead>
            <tbody className="text-white/80">
              <tr className="border-b border-white/5">
                <td className="py-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLORS.topUps }} />Top-ups
                </td>
                <td className="text-right">{formatUsd(revenue.oneTime.totalRevenue)}</td>
                <td className="text-right">{revenue.oneTime.totalOrders}</td>
                <td className="text-right">{revenue.oneTime.totalOrders > 0 ? formatUsd(revenue.oneTime.totalRevenue / revenue.oneTime.totalOrders) : "—"}</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLORS.subscriptions }} />Suscripciones
                </td>
                <td className="text-right">{formatUsd(revenue.subscriptions.confirmedRevenue)}</td>
                <td className="text-right">{revenue.subscriptions.confirmedPayments}</td>
                <td className="text-right">{revenue.subscriptions.confirmedPayments > 0 ? formatUsd(revenue.subscriptions.confirmedRevenue / revenue.subscriptions.confirmedPayments) : "—"}</td>
              </tr>
              <tr>
                <td className="py-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLORS.donations }} />Donaciones
                </td>
                <td className="text-right">{formatUsd(revenue.donations.totalRevenue)}</td>
                <td className="text-right">{revenue.donations.totalOrders}</td>
                <td className="text-right">{revenue.donations.totalOrders > 0 ? formatUsd(revenue.donations.totalRevenue / revenue.donations.totalOrders) : "—"}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-white/20 font-semibold text-white">
                <td className="py-2">Total</td>
                <td className="text-right">{formatUsd(revenue.totalRevenue)}</td>
                <td className="text-right">{revenue.totalTransactions}</td>
                <td className="text-right">{formatUsd(revenue.avgTransactionValue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
