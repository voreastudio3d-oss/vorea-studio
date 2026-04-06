/**
 * CreditsTab — Admin panel for managing Vorea Studio's universal credit system.
 *
 * Three sections:
 *  1. Tool Credit Config — per-tool action costs and tier limits
 *  2. AI Budget — global monthly cap, circuit breaker, revenue binding
 *  3. Image Limits — per-tier upload constraints
 *
 * Vorea Studio — voreastudio.com
 */

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Save, DollarSign, Bot, ImagePlus, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Shield, Package, Plus, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminApi } from "../services/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToolAction {
  actionId: string;
  labelKey: string;
  creditCost: number;
  limits: { free: number | null; pro: number | null; studioPro: number | null };
  limitPeriod: string;
}

interface ToolConfig {
  label: string;
  actions: ToolAction[];
}

interface ToolCreditsConfig {
  creditValueUsd: number;
  monthlyCredits: Record<string, number>;
  tools: Record<string, ToolConfig>;
}

interface AIBudgetConfig {
  globalMonthlyBudgetUsd: number;
  maxBudgetPercentOfRevenue: number;
  currentMonthSpentUsd: number;
  currentMonth: string;
  perTierDailyLimits: Record<string, number>;
  circuitBreakerEnabled: boolean;
}

interface AIBudgetComputed {
  monthlyRevenue: number;
  effectiveBudget: number;
  budgetRemaining: number;
  budgetUtilization: string;
  circuitBreakerTripped: boolean;
}

interface ImageLimitsConfig {
  free: { maxBytes: number; resizePx: number | null };
  pro: { maxBytes: number; resizePx: number | null };
  studioPro: { maxBytes: number; resizePx: number | null };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function limitDisplay(val: number | null): string {
  if (val === null) return "✗ Bloqueado";
  if (val === -1) return "∞ Ilimitado";
  return String(val);
}

const CARD = "bg-[#1a1f36] border border-[rgba(168,187,238,0.10)] rounded-xl p-5";
const CARD_HEADER = "text-sm font-semibold text-white mb-3 flex items-center gap-2";
const INPUT_CLS = "bg-[#0d1117] border border-[rgba(168,187,238,0.15)] rounded-md px-3 py-1.5 text-xs text-gray-300 w-full outline-none focus:border-[#C6E36C]/50 transition-colors";
const SAVE_BTN = "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#C6E36C] text-[#0d1117] hover:bg-[#d4f07a] transition-all disabled:opacity-40";

// ─── Component ────────────────────────────────────────────────────────────────

export function CreditsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Tool Credits
  const [toolCredits, setToolCredits] = useState<ToolCreditsConfig | null>(null);
  const [editCredits, setEditCredits] = useState<ToolCreditsConfig | null>(null);

  // AI Budget
  const [budget, setBudget] = useState<AIBudgetConfig | null>(null);
  const [editBudget, setEditBudget] = useState<AIBudgetConfig | null>(null);
  const [computed, setComputed] = useState<AIBudgetComputed | null>(null);

  // Image Limits
  const [imageLimits, setImageLimits] = useState<ImageLimitsConfig | null>(null);
  const [editImageLimits, setEditImageLimits] = useState<ImageLimitsConfig | null>(null);

  // Credit Packs
  const [creditPacks, setCreditPacks] = useState<any[]>([]);
  const [editPacks, setEditPacks] = useState<any[]>([]);

  // Collapsible tool sections
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  // ─── Load data ──────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      AdminApi.getToolCredits()
        .then((tc: ToolCreditsConfig) => { setToolCredits(tc); setEditCredits(JSON.parse(JSON.stringify(tc))); }),
      AdminApi.getAIBudget()
        .then((resp: { budget: AIBudgetConfig; computed: AIBudgetComputed }) => {
          setBudget(resp.budget);
          setEditBudget(JSON.parse(JSON.stringify(resp.budget)));
          setComputed(resp.computed);
        }),
      AdminApi.getImageLimits()
        .then((il: ImageLimitsConfig) => { setImageLimits(il); setEditImageLimits(JSON.parse(JSON.stringify(il))); }),
      AdminApi.getCreditPacks()
        .then((packs: any[]) => { setCreditPacks(packs); setEditPacks(JSON.parse(JSON.stringify(packs))); })
        .catch(() => {}),
    ])
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ─── Save handlers ─────────────────────────────────────────────────
  const saveToolCredits = useCallback(async () => {
    if (!editCredits) return;
    setSaving("credits");
    try {
      const updated = await AdminApi.updateToolCredits(editCredits);
      setToolCredits(updated);
      setEditCredits(JSON.parse(JSON.stringify(updated)));
      toast.success("Configuración de créditos guardada");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(null); }
  }, [editCredits]);

  const saveAIBudget = useCallback(async () => {
    if (!editBudget) return;
    setSaving("budget");
    try {
      const updated = await AdminApi.updateAIBudget(editBudget);
      setBudget(updated);
      setEditBudget(JSON.parse(JSON.stringify(updated)));
      toast.success("Presupuesto AI guardado");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(null); }
  }, [editBudget]);

  const saveImageLimits = useCallback(async () => {
    if (!editImageLimits) return;
    setSaving("images");
    try {
      const updated = await AdminApi.updateImageLimits(editImageLimits);
      setImageLimits(updated);
      setEditImageLimits(JSON.parse(JSON.stringify(updated)));
      toast.success("Limites de imagen guardados");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(null); }
  }, [editImageLimits]);

  const saveCreditPacks = useCallback(async () => {
    setSaving("packs");
    try {
      const updated = await AdminApi.updateCreditPacks(editPacks);
      setCreditPacks(updated);
      setEditPacks(JSON.parse(JSON.stringify(updated)));
      toast.success("Credit packs guardados");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(null); }
  }, [editPacks]);

  // ─── Loading state ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#C6E36C] animate-spin" />
      </div>
    );
  }

  const toggleTool = (toolKey: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      next.has(toolKey) ? next.delete(toolKey) : next.add(toolKey);
      return next;
    });
  };

  const hasCreditsChanges = JSON.stringify(editCredits) !== JSON.stringify(toolCredits);
  const hasBudgetChanges = JSON.stringify(editBudget) !== JSON.stringify(budget);
  const hasImageChanges = JSON.stringify(editImageLimits) !== JSON.stringify(imageLimits);

  return (
    <div className="space-y-6">
      {/* ─── Section 1: Global Credit Config ─────────────────────────── */}
      <div className={CARD}>
        <div className={CARD_HEADER}>
          <DollarSign className="w-4 h-4 text-[#C6E36C]" />
          Configuración de Créditos
        </div>

        {editCredits && (
          <div className="space-y-4">
            {/* Credit value + monthly allocations */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">1 Crédito = USD</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className={INPUT_CLS}
                  value={editCredits.creditValueUsd}
                  onChange={(e) => setEditCredits({ ...editCredits, creditValueUsd: parseFloat(e.target.value) || 0.05 })}
                />
              </div>
              {Object.entries(editCredits.monthlyCredits).map(([tier, val]) => (
                <div key={tier}>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">{tier} / mes</label>
                  <input
                    type="number"
                    min="0"
                    className={INPUT_CLS}
                    value={val}
                    onChange={(e) => setEditCredits({
                      ...editCredits,
                      monthlyCredits: { ...editCredits.monthlyCredits, [tier]: parseInt(e.target.value) || 0 },
                    })}
                  />
                </div>
              ))}
            </div>

            {/* Per-tool actions */}
            <div className="space-y-2 mt-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Costos por Herramienta</p>
              {Object.entries(editCredits.tools).map(([toolKey, tool]) => (
                <div key={toolKey} className="border border-[rgba(168,187,238,0.08)] rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-300 hover:bg-white/5 transition-colors"
                    onClick={() => toggleTool(toolKey)}
                  >
                    <span className="font-medium">{tool.label} <span className="text-gray-600 ml-1">({tool.actions.length} acciones)</span></span>
                    {expandedTools.has(toolKey) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {expandedTools.has(toolKey) && (
                    <div className="px-4 pb-3">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="text-gray-500 border-b border-[rgba(168,187,238,0.08)]">
                            <th className="text-left py-1.5 font-medium">Acción</th>
                            <th className="text-center py-1.5 font-medium w-16">Costo</th>
                            <th className="text-center py-1.5 font-medium w-16">FREE</th>
                            <th className="text-center py-1.5 font-medium w-16">PRO</th>
                            <th className="text-center py-1.5 font-medium w-20">STUDIO</th>
                            <th className="text-center py-1.5 font-medium w-16">Periodo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tool.actions.map((action, actionIdx) => (
                            <tr key={action.actionId} className="border-b border-[rgba(168,187,238,0.04)]">
                              <td className="py-1.5 text-gray-400">{action.actionId.replace(/_/g, " ")}</td>
                              <td className="py-1.5 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  className="bg-transparent border border-[rgba(168,187,238,0.12)] rounded px-1.5 py-0.5 w-12 text-center text-gray-300 outline-none focus:border-[#C6E36C]/40"
                                  value={action.creditCost}
                                  onChange={(e) => {
                                    const next = { ...editCredits };
                                    next.tools[toolKey].actions[actionIdx].creditCost = parseInt(e.target.value) || 0;
                                    setEditCredits({ ...next });
                                  }}
                                />
                              </td>
                              {(["free", "pro", "studioPro"] as const).map((tierKey) => {
                                const val = action.limits[tierKey];
                                const mode = val === null ? "blocked" : val === -1 ? "unlimited" : "custom";
                                return (
                                  <td key={tierKey} className="py-1.5 text-center">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <select
                                        className={`bg-transparent border rounded px-0.5 py-0.5 text-[9px] outline-none cursor-pointer w-[70px] ${
                                          mode === "blocked" ? "text-red-400 border-red-500/30" :
                                          mode === "unlimited" ? "text-emerald-400 border-emerald-500/30" :
                                          "text-gray-300 border-[rgba(168,187,238,0.15)]"
                                        }`}
                                        value={mode}
                                        onChange={(e) => {
                                          const next = { ...editCredits };
                                          const m = e.target.value;
                                          next.tools[toolKey].actions[actionIdx].limits[tierKey] =
                                            m === "blocked" ? null : m === "unlimited" ? -1 : 1;
                                          setEditCredits({ ...next });
                                        }}
                                      >
                                        <option value="unlimited">∞ Ilimitado</option>
                                        <option value="custom">⊞ Límite</option>
                                        <option value="blocked">✗ Bloqueado</option>
                                      </select>
                                      {mode === "custom" && (
                                        <input
                                          type="number"
                                          min="1"
                                          className="bg-transparent border border-[rgba(168,187,238,0.15)] rounded px-1 py-0.5 w-12 text-center text-[10px] text-gray-300 outline-none focus:border-[#C6E36C]/40"
                                          value={val!}
                                          onChange={(e) => {
                                            const next = { ...editCredits };
                                            next.tools[toolKey].actions[actionIdx].limits[tierKey] = Math.max(1, parseInt(e.target.value) || 1);
                                            setEditCredits({ ...next });
                                          }}
                                        />
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="py-1.5 text-center">
                                <select
                                  className="bg-transparent border border-[rgba(168,187,238,0.12)] rounded px-1 py-0.5 text-[10px] text-gray-400 outline-none focus:border-[#C6E36C]/40 cursor-pointer"
                                  value={action.limitPeriod}
                                  onChange={(e) => {
                                    const next = { ...editCredits };
                                    next.tools[toolKey].actions[actionIdx].limitPeriod = e.target.value;
                                    setEditCredits({ ...next });
                                  }}
                                >
                                  <option value="unlimited">unlimited</option>
                                  <option value="day">day</option>
                                  <option value="month">month</option>
                                  <option value="total">total</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Save */}
            {hasCreditsChanges && (
              <div className="flex justify-end pt-2">
                <button className={SAVE_BTN} onClick={saveToolCredits} disabled={saving === "credits"}>
                  {saving === "credits" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Guardar Créditos
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Section 2: AI Budget ─────────────────────────────────────── */}
      <div className={CARD}>
        <div className={CARD_HEADER}>
          <Bot className="w-4 h-4 text-purple-400" />
          Presupuesto IA Global
          {computed?.circuitBreakerTripped && (
            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Circuit Breaker ACTIVO
            </span>
          )}
          {computed && !computed.circuitBreakerTripped && (
            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Operativo
            </span>
          )}
        </div>

        {editBudget && computed && (
          <div className="space-y-4">
            {/* Live metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#0d1117] rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-500 uppercase">Ingreso Mensual</p>
                <p className="text-lg font-bold text-emerald-400">${computed.monthlyRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-[#0d1117] rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-500 uppercase">Presupuesto Efectivo</p>
                <p className="text-lg font-bold text-[#C6E36C]">${computed.effectiveBudget.toFixed(2)}</p>
              </div>
              <div className="bg-[#0d1117] rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-500 uppercase">Gastado ({editBudget.currentMonth})</p>
                <p className={`text-lg font-bold ${computed.circuitBreakerTripped ? "text-red-400" : "text-gray-300"}`}>
                  ${editBudget.currentMonthSpentUsd.toFixed(2)}
                </p>
              </div>
              <div className="bg-[#0d1117] rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-500 uppercase">Utilización</p>
                <p className="text-lg font-bold text-gray-300">{computed.budgetUtilization}</p>
              </div>
            </div>

            {/* Editable config */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Cap Mensual (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  className={INPUT_CLS}
                  value={editBudget.globalMonthlyBudgetUsd}
                  onChange={(e) => setEditBudget({ ...editBudget, globalMonthlyBudgetUsd: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">% Máx. sobre Ingreso</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className={INPUT_CLS}
                  value={editBudget.maxBudgetPercentOfRevenue}
                  onChange={(e) => setEditBudget({ ...editBudget, maxBudgetPercentOfRevenue: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-[#C6E36C]"
                    checked={editBudget.circuitBreakerEnabled}
                    onChange={(e) => setEditBudget({ ...editBudget, circuitBreakerEnabled: e.target.checked })}
                  />
                  <Shield className="w-3.5 h-3.5" />
                  Circuit Breaker
                </label>
              </div>
            </div>

            {/* Per-tier daily limits */}
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Límites IA por Tier (solicitudes/día)</p>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(editBudget.perTierDailyLimits).map(([tier, val]) => (
                  <div key={tier}>
                    <label className="text-[10px] text-gray-500 block mb-1">{tier}</label>
                    <input
                      type="number"
                      min="-1"
                      className={INPUT_CLS}
                      value={val}
                      onChange={(e) => setEditBudget({
                        ...editBudget,
                        perTierDailyLimits: { ...editBudget.perTierDailyLimits, [tier]: parseInt(e.target.value) },
                      })}
                    />
                    <span className="text-[9px] text-gray-600">-1 = ilimitado</span>
                  </div>
                ))}
              </div>
            </div>

            {hasBudgetChanges && (
              <div className="flex justify-end pt-2">
                <button className={SAVE_BTN} onClick={saveAIBudget} disabled={saving === "budget"}>
                  {saving === "budget" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Guardar Presupuesto
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Section 3: Image Limits ──────────────────────────────────── */}
      <div className={CARD}>
        <div className={CARD_HEADER}>
          <ImagePlus className="w-4 h-4 text-blue-400" />
          Límites de Imagen por Tier
        </div>

        {editImageLimits && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(["free", "pro", "studioPro"] as const).map((tier) => {
                const tierLabel = tier === "studioPro" ? "STUDIO PRO" : tier.toUpperCase();
                const tierColor = tier === "free" ? "text-gray-400" : tier === "pro" ? "text-[#C6E36C]" : "text-purple-400";
                return (
                  <div key={tier} className="bg-[#0d1117] rounded-lg p-4">
                    <p className={`text-xs font-semibold ${tierColor} mb-3`}>{tierLabel}</p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Max Upload (bytes)</label>
                        <input
                          type="number"
                          min="0"
                          step="1048576"
                          className={INPUT_CLS}
                          value={editImageLimits[tier].maxBytes}
                          onChange={(e) => setEditImageLimits({
                            ...editImageLimits,
                            [tier]: { ...editImageLimits[tier], maxBytes: parseInt(e.target.value) || 0 },
                          })}
                        />
                        <span className="text-[9px] text-gray-600">{formatBytes(editImageLimits[tier].maxBytes)}</span>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Resize (px)</label>
                        <input
                          type="number"
                          min="0"
                          className={INPUT_CLS}
                          value={editImageLimits[tier].resizePx ?? 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setEditImageLimits({
                              ...editImageLimits,
                              [tier]: { ...editImageLimits[tier], resizePx: val === 0 ? null : val },
                            });
                          }}
                        />
                        <span className="text-[9px] text-gray-600">{editImageLimits[tier].resizePx === null ? "Sin límite" : `${editImageLimits[tier].resizePx}px`}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasImageChanges && (
              <div className="flex justify-end pt-2">
                <button className={SAVE_BTN} onClick={saveImageLimits} disabled={saving === "images"}>
                  {saving === "images" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Guardar Límites
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── Section 4: Credit Packs ─────────────────────────────────── */}
        <div className="p-5 rounded-xl bg-[rgba(26,31,54,0.7)] border border-[rgba(168,187,238,0.12)]">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-4 h-4 text-[#C6E36C]" />
            <h2 className="text-sm font-semibold">Credit Packs (Tienda)</h2>
          </div>

          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_80px_80px_60px_40px] gap-2 text-[9px] text-gray-500 uppercase tracking-wider px-1">
              <span>Nombre</span>
              <span>Créditos</span>
              <span>Precio (USD)</span>
              <span>$/crédito</span>
              <span>Popular</span>
              <span></span>
            </div>

            {editPacks.map((pack, idx) => (
              <div key={pack.id || idx} className="grid grid-cols-[1fr_80px_80px_80px_60px_40px] gap-2 items-center">
                <input
                  className={INPUT_CLS}
                  value={pack.name}
                  onChange={(e) => {
                    const next = [...editPacks];
                    next[idx] = { ...next[idx], name: e.target.value };
                    setEditPacks(next);
                  }}
                />
                <input
                  type="number"
                  min={1}
                  className={INPUT_CLS}
                  value={pack.credits}
                  onChange={(e) => {
                    const next = [...editPacks];
                    const credits = parseInt(e.target.value) || 1;
                    next[idx] = { ...next[idx], credits, pricePerCredit: +(next[idx].price / credits).toFixed(2) };
                    setEditPacks(next);
                  }}
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className={INPUT_CLS}
                  value={pack.price}
                  onChange={(e) => {
                    const next = [...editPacks];
                    const price = parseFloat(e.target.value) || 0;
                    next[idx] = { ...next[idx], price, pricePerCredit: +(price / (next[idx].credits || 1)).toFixed(2) };
                    setEditPacks(next);
                  }}
                />
                <span className="text-xs text-gray-400 text-center">${pack.pricePerCredit?.toFixed(2)}</span>
                <button
                  className={`w-6 h-6 mx-auto rounded-full border transition-colors ${
                    pack.popular
                      ? "bg-[#C6E36C]/20 border-[#C6E36C]/50 text-[#C6E36C]"
                      : "border-gray-600 text-gray-600 hover:border-gray-400"
                  }`}
                  onClick={() => {
                    const next = [...editPacks];
                    next[idx] = { ...next[idx], popular: !next[idx].popular };
                    setEditPacks(next);
                  }}
                >
                  {pack.popular ? <CheckCircle2 className="w-3.5 h-3.5 m-auto" /> : null}
                </button>
                <button
                  className="text-red-400/60 hover:text-red-400 transition-colors"
                  onClick={() => setEditPacks(editPacks.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Add row */}
            <button
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#C6E36C] transition-colors pt-2"
              onClick={() => {
                const id = `pack_${Date.now()}`;
                setEditPacks([...editPacks, { id, name: "Nuevo Pack", credits: 10, price: 2.99, pricePerCredit: 0.30, popular: false }]);
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Agregar Pack
            </button>
          </div>

          {/* Save */}
          {JSON.stringify(editPacks) !== JSON.stringify(creditPacks) && (
            <div className="flex justify-end pt-3">
              <button className={SAVE_BTN} onClick={saveCreditPacks} disabled={saving === "packs"}>
                {saving === "packs" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar Packs
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
