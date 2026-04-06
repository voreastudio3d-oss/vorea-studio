/**
 * RegionalStatsTab.tsx – Regional user distribution dashboard for SuperAdmin.
 * Fetches data from /api/admin/reports/regional-stats and displays:
 *   • Region distribution bar chart (CSS-only)
 *   • Top countries table
 *   • Coverage summary stats
 */
import { useState, useEffect, useCallback } from "react";
import { AdminApi } from "../services/api-client";

interface RegionalStats {
  byRegion: Record<string, number>;
  byCountry: Array<{ country: string; count: number }>;
  totalWithCountry: number;
  totalWithoutCountry: number;
  total: number;
  storageByRegion?: Record<string, { aiStorageBytes: number; aiImageBytes: number }>;
}

// Region colors for visual distinction
const REGION_COLORS: Record<string, string> = {
  LATAM: "#6366f1",
  NA: "#10b981",
  EU: "#3b82f6",
  APAC: "#f59e0b",
  MEA: "#ef4444",
  OTHER: "#8b5cf6",
};

const REGION_LABELS: Record<string, string> = {
  LATAM: "Latin America",
  NA: "North America",
  EU: "Europe",
  APAC: "Asia Pacific",
  MEA: "Middle East & Africa",
  OTHER: "Other / Unmapped",
};

export function RegionalStatsTab() {
  const [stats, setStats] = useState<RegionalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await AdminApi.getRegionalStats();
      setStats(data);
    } catch (e: any) {
      setError(e.message || "Error al cargar estadísticas regionales");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>
        <span className="spinner" /> Loading regional data…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ color: "#ef4444", marginBottom: 12 }}>⚠ {error}</div>
        <button onClick={loadStats} style={btnStyle}>
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const maxRegionCount = Math.max(...Object.values(stats.byRegion), 1);
  const coveragePct =
    stats.total > 0
      ? ((stats.totalWithCountry / stats.total) * 100).toFixed(1)
      : "0.0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ── Summary cards ────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatCard label="Total Users" value={stats.total} />
        <StatCard label="With Country" value={stats.totalWithCountry} />
        <StatCard label="Without Country" value={stats.totalWithoutCountry} />
        <StatCard label="Coverage" value={`${coveragePct}%`} />
      </div>

      {/* ── Region bar chart ─────────────────────────────────── */}
      <div style={cardStyle}>
        <h4 style={sectionTitle}>Users by Region</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(stats.byRegion)
            .sort((a, b) => b[1] - a[1])
            .map(([region, count]) => {
              const pct = (count / maxRegionCount) * 100;
              const color = REGION_COLORS[region] || "#64748b";
              return (
                <div key={region}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      marginBottom: 4,
                      color: "#e2e8f0",
                    }}
                  >
                    <span>
                      {REGION_LABELS[region] || region}
                    </span>
                    <span style={{ fontWeight: 600 }}>{count}</span>
                  </div>
                  <div
                    style={{
                      height: 22,
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.06)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: color,
                        borderRadius: 6,
                        transition: "width 0.6s ease",
                        minWidth: count > 0 ? 4 : 0,
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* ── Top countries table ───────────────────────────────── */}
      <div style={cardStyle}>
        <h4 style={sectionTitle}>Top Countries</h4>
        {stats.byCountry.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 13 }}>
            No country data available yet. Users will be geolocated on next
            sign-in.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#94a3b8", fontSize: 12, textAlign: "left" }}>
                <th style={thStyle}>Country</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Users</th>
                <th style={{ ...thStyle, textAlign: "right" }}>%</th>
              </tr>
            </thead>
            <tbody>
              {stats.byCountry.slice(0, 20).map(({ country, count }) => (
                <tr key={country} style={trStyle}>
                  <td style={tdStyle}>
                    {flagEmoji(country)} {country}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{count}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {stats.total > 0
                      ? ((count / stats.total) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Storage AI Cost by Region ───────────────────────────────── */}
      <div style={cardStyle}>
        <h4 style={sectionTitle}>Storage Footprint (AI Generation)</h4>
        {(!stats.storageByRegion || Object.keys(stats.storageByRegion).length === 0) ? (
          <p style={{ color: "#64748b", fontSize: 13 }}>
            No storage data accumulated for regions yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#94a3b8", fontSize: 12, textAlign: "left" }}>
                <th style={thStyle}>Region</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Code Storage</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Image Storage</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.storageByRegion)
                .sort((a, b) => (b[1].aiStorageBytes + b[1].aiImageBytes) - (a[1].aiStorageBytes + a[1].aiImageBytes))
                .map(([region, usage]) => {
                const total = usage.aiStorageBytes + usage.aiImageBytes;
                return (
                  <tr key={region} style={trStyle}>
                    <td style={tdStyle}>{REGION_LABELS[region] || region}</td>
                    <td style={{ ...tdStyle, textAlign: "right", color: "#6366f1" }}>{formatBytes(usage.aiStorageBytes)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", color: "#10b981" }}>{formatBytes(usage.aiImageBytes)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{formatBytes(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        flex: "1 1 140px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        padding: "14px 18px",
      }}
    >
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0" }}>
        {value}
      </div>
    </div>
  );
}

/** Convert country code to flag emoji (e.g. "AR" → 🇦🇷) */
function flagEmoji(cc: string): string {
  if (!cc || cc.length !== 2) return "🌍";
  const cps = [...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...cps);
}

/** Format bytes into human readable string */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/* ── Styles ───────────────────────────────────────────────────── */

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 20,
};

const sectionTitle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 15,
  fontWeight: 600,
  color: "#e2e8f0",
};

const btnStyle: React.CSSProperties = {
  background: "#6366f1",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 18px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const thStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  fontWeight: 500,
};

const tdStyle: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 13,
  color: "#e2e8f0",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
};

const trStyle: React.CSSProperties = {};
