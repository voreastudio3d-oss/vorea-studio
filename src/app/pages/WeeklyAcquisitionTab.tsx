import { useState, useEffect, useCallback } from "react";
import { Loader2, TrendingUp, TrendingDown, Users, Mail, Globe, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AdminApi } from "../services/api-client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const TIER_COLORS: Record<string, string> = {
  FREE: "#94a3b8",
  PRO: "#C6E36C",
  "STUDIO PRO": "#a78bfa",
};
const PIE_COLORS = ["#94a3b8", "#C6E36C", "#a78bfa", "#60a5fa", "#f59e0b"];

interface AcquisitionData {
  totalUsers: number;
  signupsLast7d: number;
  signupsPrev7d: number;
  weekOverWeekChange: number | null;
  weeklySignups: { week: string; signups: number; tiers: Record<string, number> }[];
  tierDistribution: Record<string, number>;
  contactLeadsLast30d: number;
  landingViewsLast7d: Record<string, number>;
}

function KpiCard({ label, value, icon, subtext, trend }: {
  label: string; value: string; icon: React.ReactNode; subtext?: string; trend?: "up" | "down" | null;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-white/40">{icon}</span>
        <span className="text-xs text-white/50">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-xl font-bold text-white">{value}</p>
        {trend === "up" && <TrendingUp className="w-4 h-4 text-green-400" />}
        {trend === "down" && <TrendingDown className="w-4 h-4 text-red-400" />}
      </div>
      {subtext && <p className="text-xs text-white/40 mt-1">{subtext}</p>}
    </div>
  );
}

export function WeeklyAcquisitionTab() {
  const [data, setData] = useState<AcquisitionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await AdminApi.fetchAcquisitionReport();
      setData(result);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar datos de adquisición");
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
    return <p className="text-white/50 text-center py-10">No se pudieron cargar los datos.</p>;
  }

  const wowChange = data.weekOverWeekChange;
  const wowLabel = wowChange !== null ? `${wowChange > 0 ? "+" : ""}${wowChange}% vs semana anterior` : "Sin datos previos";
  const wowTrend = wowChange !== null ? (wowChange >= 0 ? "up" : "down") : null;

  const tierPieData = Object.entries(data.tierDistribution).map(([name, value]) => ({ name, value }));
  const landingData = Object.entries(data.landingViewsLast7d).map(([name, views]) => ({ name, views }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Adquisición Semanal</h2>
        <button onClick={fetchData} className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Usuarios totales"
          value={data.totalUsers.toLocaleString()}
          icon={<Users className="w-4 h-4" />}
        />
        <KpiCard
          label="Nuevos (7d)"
          value={String(data.signupsLast7d)}
          icon={<TrendingUp className="w-4 h-4" />}
          subtext={wowLabel}
          trend={wowTrend}
        />
        <KpiCard
          label="Leads (30d)"
          value={String(data.contactLeadsLast30d)}
          icon={<Mail className="w-4 h-4" />}
        />
        <KpiCard
          label="Landing views (7d)"
          value={String(Object.values(data.landingViewsLast7d).reduce((a, b) => a + b, 0))}
          icon={<Globe className="w-4 h-4" />}
        />
      </div>

      {/* Weekly signups chart */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white/70 mb-3">Registros semanales (últimas 8 semanas)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.weeklySignups}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="week" tick={{ fill: "#9CA3AF", fontSize: 11 }} />
            <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#1f2937", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
              labelStyle={{ color: "#9CA3AF" }}
            />
            <Bar dataKey="signups" fill="#C6E36C" radius={[4, 4, 0, 0]} name="Registros" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Tier distribution pie */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white/70 mb-3">Distribución por plan</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={tierPieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {tierPieData.map((entry, i) => (
                  <Cell key={entry.name} fill={TIER_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Landing views by intent */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white/70 mb-3">Landing views por vertical (7d)</h3>
          {landingData.length > 0 ? (
            <div className="space-y-3 mt-4">
              {landingData.map((l) => (
                <div key={l.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/70 capitalize">{l.name}</span>
                    <span className="text-white/50">{l.views}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full"
                      style={{ width: `${Math.min(100, (l.views / Math.max(...landingData.map((d) => d.views), 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/40 text-sm mt-4">Sin datos de landing en los últimos 7 días.</p>
          )}
        </div>
      </div>
    </div>
  );
}
