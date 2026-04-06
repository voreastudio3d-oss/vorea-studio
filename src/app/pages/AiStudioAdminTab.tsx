import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  Edit2,
  Loader2,
  Package,
  Plus,
  Save,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AiFallbackTree } from "../components/AiFallbackTree";
import {
  AdminApi,
  AiStudioAdminApi,
  AiStudioCMSApi,
  type AdminAIBudgetRecord,
  type AiStudioAdminConfigRecord,
  type AiStudioFamilyApiRecord,
  type AiStudioPresetApiRecord,
} from "../services/api-client";

function parseAlertThresholds(input: string): number[] {
  return [...new Set(input
    .split(",")
    .map((chunk) => Number(chunk.trim()))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100))]
    .sort((a, b) => a - b);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value || 0);
}

function formatUsdPer1kTokens(value: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 0.01 ? 5 : 2,
    maximumFractionDigits: value < 0.01 ? 5 : 2,
  }).format(value || 0);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getLaneForTokenCost(costPer1kTokens: number): "economy" | "balanced" | "premium" {
  if (costPer1kTokens <= 0.0002) return "economy";
  if (costPer1kTokens <= 0.003) return "balanced";
  return "premium";
}

function getLaneLabel(lane: "economy" | "balanced" | "premium"): string {
  return lane === "economy" ? "económico" : lane === "balanced" ? "equilibrado" : "premium";
}

function getLaneBadgeClass(lane: "economy" | "balanced" | "premium"): string {
  if (lane === "economy") {
    return "text-[#C6E36C] border-[#C6E36C]/20 bg-[#C6E36C]/10";
  }
  if (lane === "balanced") {
    return "text-amber-300 border-amber-500/20 bg-amber-500/10";
  }
  return "text-fuchsia-300 border-fuchsia-500/20 bg-fuchsia-500/10";
}

function getQualityLabel(quality: "draft" | "final"): string {
  return quality === "draft" ? "borrador" : "final";
}

export function AiStudioAdminTab() {
  const [families, setFamilies] = useState<AiStudioFamilyApiRecord[]>([]);
  const [presets, setPresets] = useState<AiStudioPresetApiRecord[]>([]);
  const [aiConfigDraft, setAiConfigDraft] = useState<AiStudioAdminConfigRecord | null>(null);
  const [aiBudget, setAiBudget] = useState<AdminAIBudgetRecord | null>(null);
  const [aiConfigError, setAiConfigError] = useState<string | null>(null);
  const [aiBudgetError, setAiBudgetError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAiConfig, setSavingAiConfig] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [alertThresholdsInput, setAlertThresholdsInput] = useState("50, 75, 90");

  const [editingFamily, setEditingFamily] = useState<AiStudioFamilyApiRecord | Partial<AiStudioFamilyApiRecord> | null>(null);
  const [parametersJson, setParametersJson] = useState("[]");
  const [scadTemplate, setScadTemplate] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setAiConfigError(null);
      setAiBudgetError(null);

      const [fams, pres, config, budget] = await Promise.allSettled([
        AiStudioCMSApi.getFamilies(),
        AiStudioCMSApi.getPresets(),
        AiStudioAdminApi.getAIConfig(),
        AdminApi.getAIBudget(),
      ]);

      if (fams.status === "fulfilled") {
        setFamilies(fams.value);
      } else {
        toast.error(fams.reason?.message || "Error cargando familias AI Studio");
      }

      if (pres.status === "fulfilled") {
        setPresets(pres.value);
      } else {
        toast.error(pres.reason?.message || "Error cargando presets AI Studio");
      }

      if (config.status === "fulfilled" && config.value) {
        setAiConfigDraft(config.value);
        setAlertThresholdsInput(config.value.alertThresholds.join(", "));
      } else {
        setAiConfigDraft(null);
        setAiConfigError(config.status === "rejected" ? config.reason?.message || "No se pudo cargar la configuración del motor IA." : "No se recibió configuración del motor IA.");
      }

      if (budget.status === "fulfilled" && budget.value) {
        setAiBudget(budget.value);
      } else {
        setAiBudget(null);
        setAiBudgetError(budget.status === "rejected" ? budget.reason?.message || "No se pudo cargar el presupuesto IA." : "No se recibió el presupuesto IA.");
      }
    } catch (e: any) {
      toast.error(e.message || "Error cargando AI Studio admin");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleProviderChange = (provider: string) => {
    if (!aiConfigDraft) return;
    const nextModels = aiConfigDraft.providers[provider]?.models || [];
    setAiConfigDraft({
      ...aiConfigDraft,
      activeProvider: provider,
      activeModel: nextModels[0]?.id || aiConfigDraft.activeModel,
    });
  };

  const handleSaveAiConfig = async () => {
    if (!aiConfigDraft) return;

    const parsedThresholds = parseAlertThresholds(alertThresholdsInput);
    if (parsedThresholds.length === 0) {
      toast.error("Ingresa al menos un umbral válido entre 0 y 100.");
      return;
    }

    setSavingAiConfig(true);
    try {
      const saved = await AiStudioAdminApi.updateAIConfig({
        activeProvider: aiConfigDraft.activeProvider,
        activeModel: aiConfigDraft.activeModel,
        manualMode: aiConfigDraft.manualMode,
        alertThresholds: parsedThresholds,
      });

      setAiConfigDraft(saved);
      setAlertThresholdsInput(saved.alertThresholds.join(", "));
      setAiBudget(await AdminApi.getAIBudget());
      toast.success("Motor IA actualizado");
    } catch (e: any) {
      toast.error(e.message || "No se pudo guardar la configuración del motor IA");
    } finally {
      setSavingAiConfig(false);
    }
  };

  const handleEditFamily = (family: AiStudioFamilyApiRecord) => {
    setEditingFamily(family);
    setParametersJson(JSON.stringify(family.parameters || [], null, 2));
    setScadTemplate(family.scadTemplate || "");
  };

  const handleCreateFamily = () => {
    setEditingFamily({
      engine: "fdm",
      status: "active",
      nameEs: "",
      nameEn: "",
      descriptionEs: "",
      descriptionEn: "",
      slug: "",
      imageUrl: "",
      priority: 0,
    });
    setParametersJson("[\n  {\n    \"name\": \"example_var\",\n    \"type\": \"number\",\n    \"defaultValue\": 10,\n    \"description\": \"Describe el parámetro\"\n  }\n]");
    setScadTemplate("// Pega tu SCAD aquí\n");
  };

  const handleSaveFamily = async () => {
    if (!editingFamily) return;

    let parsedParameters = [];
    try {
      parsedParameters = JSON.parse(parametersJson);
    } catch {
      toast.error("JSON de parámetros inválido.");
      return;
    }

    const payload: Partial<AiStudioFamilyApiRecord> = {
      ...editingFamily,
      parameters: parsedParameters,
      scadTemplate,
    };

    try {
      if ((editingFamily as AiStudioFamilyApiRecord).id) {
        await AiStudioCMSApi.updateFamily((editingFamily as AiStudioFamilyApiRecord).id, payload);
        toast.success("Familia actualizada");
      } else {
        await AiStudioCMSApi.createFamily(payload);
        toast.success("Familia creada");
      }
      setEditingFamily(null);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar familia");
    }
  };

  const handleDeleteFamily = async (id: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta familia?")) return;
    try {
      await AiStudioCMSApi.deleteFamily(id);
      toast.success("Familia eliminada");
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Error eliminando familia");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Cargando AI Studio admin...
      </div>
    );
  }

  const draft = aiConfigDraft;
  const selectedModels = draft ? draft.providers[draft.activeProvider]?.models || [] : [];
  const utilizationPercent = aiBudget ? Number(String(aiBudget.computed.budgetUtilization).replace("%", "")) || 0 : 0;
  const providerEntries = draft ? Object.entries(draft.providers) : [];
  const pricingRows = providerEntries
    .flatMap(([providerKey, provider]) =>
      provider.models.map((model) => {
        const lane = getLaneForTokenCost(model.costPer1kTokens);
        const available = draft?._availableProviders.includes(providerKey) ?? false;
        const selectable = draft?._selectableProviders.includes(providerKey) ?? false;

        return {
          id: `${providerKey}:${model.id}`,
          providerKey,
          providerLabel: provider.label,
          modelId: model.id,
          modelLabel: model.label,
          lane,
          costPer1kTokens: model.costPer1kTokens,
          available,
          selectable,
        };
      })
    )
    .sort((left, right) => left.costPer1kTokens - right.costPer1kTokens);
  const forecastBand = draft?.forecast?.forecastBand || aiBudget?.computed.forecastBand || "green";
  const forecastBandLabel = forecastBand === "blocked"
    ? "Bloqueado"
    : forecastBand === "red"
      ? "Rojo"
      : forecastBand === "yellow"
        ? "Amarillo"
        : "Verde";

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Bot className="w-6 h-6 text-[#C6E36C]" />
              AI Studio Admin
            </h2>
            <p className="text-sm text-gray-400 mt-1 max-w-3xl">
              Aquí administras el motor LLM en caliente y el CMS paramétrico del AI Studio. La selección de proveedor se filtra automáticamente por claves reales del servidor y por adaptadores que ya estén listos para producción.
            </p>
          </div>
          <button
            onClick={() => void loadData()}
            className="px-4 py-2 rounded-lg border border-[rgba(168,187,238,0.12)] bg-[#131829] text-sm text-gray-300 hover:text-white hover:border-[#C6E36C]/30 transition-colors"
          >
            Recargar
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="space-y-6">
            <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-5 space-y-5">
              <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#C6E36C]" />
                  Motor LLM
                </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    El modo automático usa proyección, tier, calidad y salud del runtime; el modo manual fija un proveedor/modelo exacto.
                  </p>
              </div>
              <button
                onClick={handleSaveAiConfig}
                disabled={!draft || savingAiConfig}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C6E36C] text-black font-semibold hover:bg-[#b8d864] transition-colors disabled:opacity-50"
              >
                {savingAiConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar motor
              </button>
            </div>

            {draft && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs text-gray-400">Modo de selección</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setAiConfigDraft({ ...draft, manualMode: false })}
                        className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                          !draft.manualMode
                            ? "border-[#C6E36C]/40 bg-[#C6E36C]/10 text-[#C6E36C]"
                            : "border-[rgba(168,187,238,0.12)] text-gray-300 hover:text-white"
                        }`}
                      >
                        Automático
                      </button>
                      <button
                        onClick={() => setAiConfigDraft({ ...draft, manualMode: true })}
                        className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                          draft.manualMode
                            ? "border-[#C6E36C]/40 bg-[#C6E36C]/10 text-[#C6E36C]"
                            : "border-[rgba(168,187,238,0.12)] text-gray-300 hover:text-white"
                        }`}
                      >
                        Manual
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs text-gray-400">Umbrales de alerta (%)</label>
                    <input
                      value={alertThresholdsInput}
                      onChange={(e) => setAlertThresholdsInput(e.target.value)}
                      placeholder="50, 75, 90"
                      className="w-full bg-[#0C101A] border border-[rgba(168,187,238,0.1)] rounded-lg p-2 text-sm text-white"
                    />
                    <p className="text-[11px] text-gray-600">
                      Separados por coma. Se usan para marcar consumo alto del presupuesto IA.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs text-gray-400">Proveedor activo</label>
                    <select
                      value={draft.activeProvider}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      disabled={!draft.manualMode}
                      className="w-full bg-[#0C101A] border border-[rgba(168,187,238,0.1)] rounded-lg p-2 text-sm text-white"
                    >
                      {providerEntries.map(([providerKey, provider]) => {
                        const selectable = draft._selectableProviders.includes(providerKey);
                        const available = draft._availableProviders.includes(providerKey);
                        const suffix = selectable
                          ? "operativo"
                          : available
                            ? "clave detectada"
                            : "sin clave";
                        return (
                          <option key={providerKey} value={providerKey} disabled={!selectable && draft.manualMode}>
                            {provider.label} · {suffix}
                          </option>
                        );
                      })}
                    </select>
                    {draft.manualMode && !draft._selectableProviders.includes(draft.activeProvider) && (
                      <p className="text-[11px] text-amber-400">
                        Este proveedor no es seleccionable en modo manual porque todavía no tiene runtime operativo.
                      </p>
                    )}
                    {!draft.manualMode && (
                      <p className="text-[11px] text-gray-500">
                        En automático, el backend elige proveedor/modelo según proyección, tier, calidad y salud real del runtime.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs text-gray-400">Modelo activo</label>
                    <select
                      value={draft.activeModel}
                      onChange={(e) => setAiConfigDraft({ ...draft, activeModel: e.target.value })}
                      disabled={!draft.manualMode}
                      className="w-full bg-[#0C101A] border border-[rgba(168,187,238,0.1)] rounded-lg p-2 text-sm text-white"
                    >
                      {selectedModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                    {selectedModels[0] && (
                      <p className="text-[11px] text-gray-500">
                        Costo de referencia: {formatUsdPer1kTokens(selectedModels.find((model) => model.id === draft.activeModel)?.costPer1kTokens || 0)} por 1K tokens.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0C101A] p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
                    <div className="space-y-1 text-sm">
                      <p className="text-white font-medium">Estado actual del runtime</p>
                      <p className="text-gray-400 text-xs">
                        Proveedores con clave cargada: {draft._availableProviders.length > 0 ? draft._availableProviders.join(", ") : "ninguno"}.
                      </p>
                      <p className="text-gray-400 text-xs">
                        Proveedores ejecutables hoy: {draft._selectableProviders.length > 0 ? draft._selectableProviders.join(", ") : "ninguno"}.
                      </p>
                      <p className="text-gray-400 text-xs">
                        Proveedores sanos: {draft._healthyProviders.length > 0 ? draft._healthyProviders.join(", ") : "ninguno"}.
                      </p>
                      <p className="text-gray-400 text-xs">
                        Banda de proyección actual: <span className="text-white">{forecastBandLabel}</span>.
                      </p>
                      {draft._availableProviders.some((provider) => !draft._selectableProviders.includes(provider)) && (
                        <p className="text-amber-300 text-xs">
                          Hay claves detectadas para proveedores cuyo adaptador todavía no está habilitado. Se muestran en el panel, pero no se pueden fijar manualmente para evitar fallos de generación.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {!draft && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                {aiConfigError || "No se pudo cargar la configuración del motor IA."}
              </div>
            )}
            </div>

            <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#C6E36C]" />
                  Disponibilidad y enrutamiento
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Salud del runtime, matriz efectiva de niveles y trazas recientes del enrutamiento automático.
                </p>
              </div>

              {draft ? (
                <>
                  <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0C101A] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white font-medium">Enrutamiento automático</p>
                      <span className={`rounded-full px-3 py-1 text-[11px] border ${
                        forecastBand === "blocked"
                          ? "text-red-300 border-red-500/20 bg-red-500/10"
                          : forecastBand === "red"
                            ? "text-red-300 border-red-500/20 bg-red-500/10"
                            : forecastBand === "yellow"
                              ? "text-amber-300 border-amber-500/20 bg-amber-500/10"
                              : "text-[#C6E36C] border-[#C6E36C]/20 bg-[#C6E36C]/10"
                      }`}>
                        {forecastBandLabel}
                      </span>
                    </div>
                    {draft.laneMatrix && (
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        {Object.entries(draft.laneMatrix).map(([tier, lanes]) => (
                          <div key={tier} className="rounded-lg bg-[#131829] border border-[rgba(168,187,238,0.08)] px-3 py-2 flex items-center justify-between gap-3">
                            <span className="text-gray-300 font-medium">{tier}</span>
                            <span className="text-gray-500">borrador: <span className="text-white">{getLaneLabel(lanes.draft)}</span></span>
                            <span className="text-gray-500">final: <span className="text-white">{getLaneLabel(lanes.final)}</span></span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-gray-500">
                      El enrutamiento decide por tier, calidad y proyección antes de optimizar costo entre modelos sanos.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {providerEntries.map(([providerKey, provider]) => {
                      const available = draft._availableProviders.includes(providerKey);
                      const selectable = draft._selectableProviders.includes(providerKey);
                      const statusLabel = selectable ? "Operativo" : available ? "Clave detectada" : "Sin clave API";
                      const statusClass = selectable
                        ? "text-[#C6E36C] border-[#C6E36C]/20 bg-[#C6E36C]/10"
                        : available
                          ? "text-amber-300 border-amber-500/20 bg-amber-500/10"
                          : "text-gray-400 border-[rgba(168,187,238,0.08)] bg-[#0C101A]";

                      return (
                        <div key={providerKey} className="flex items-center justify-between rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0C101A] px-4 py-3">
                          <div>
                            <p className="text-sm text-white font-medium">{provider.label}</p>
                            <p className="text-[11px] text-gray-500">{provider.models.length} modelos registrados</p>
                          </div>
                          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] ${statusClass}`}>
                            {selectable ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {statusLabel}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {draft.recommendedFallbacks?.length ? (
                    <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0C101A] p-4 space-y-2">
                      <p className="text-sm text-white font-medium">Alternativas recomendadas</p>
                      {draft.recommendedFallbacks.map((fallback) => (
                        <div key={`${fallback.provider}-${fallback.model}`} className="flex items-center justify-between text-xs text-gray-400">
                          <span>{fallback.provider} / {fallback.model}</span>
                          <span className="text-white">{getLaneLabel(fallback.lane)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {draft.recentTraces?.length ? (
                    <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0C101A] p-4 space-y-4">
                      <p className="text-sm text-white font-medium">Últimas decisiones de enrutamiento</p>
                      {draft.recentTraces.map((trace) => (
                        <div key={trace.id} className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#080b15] pb-2 overflow-hidden">
                          <div className="flex items-center justify-between px-5 pt-3 pb-2 border-b border-[rgba(168,187,238,0.05)] text-[11px]">
                            <span className="text-gray-400 font-medium">Trace ID: <span className="font-mono text-gray-500">{trace.id.slice(-8)}</span></span>
                            <span className="text-gray-500 font-medium tracking-wide">{formatDateTime(trace.createdAt)}</span>
                          </div>
                          <AiFallbackTree trace={trace} />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  {aiConfigError || "No se pudo cargar la configuración de enrutamiento."}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#C6E36C]" />
                  Costos de modelos
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Estos valores salen del catálogo `costPer1kTokens` del backend y alimentan el costo estimado por solicitud. No representan el presupuesto mensual.
                </p>
              </div>

              {pricingRows.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {pricingRows.map((row) => {
                      const statusLabel = row.selectable ? "Operativo" : row.available ? "Clave detectada" : "Sin clave API";
                      const statusClass = row.selectable
                        ? "text-[#C6E36C] border-[#C6E36C]/20 bg-[#C6E36C]/10"
                        : row.available
                          ? "text-amber-300 border-amber-500/20 bg-amber-500/10"
                          : "text-gray-400 border-[rgba(168,187,238,0.08)] bg-[#0C101A]";

                      return (
                        <div key={row.id} className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0C101A] px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-white font-medium">{row.modelLabel}</p>
                              <p className="text-[11px] text-gray-500 mt-1">{row.providerLabel} · {row.modelId}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={`rounded-full border px-3 py-1 text-[11px] ${getLaneBadgeClass(row.lane)}`}>
                                {getLaneLabel(row.lane)}
                              </span>
                              <span className={`rounded-full border px-3 py-1 text-[11px] ${statusClass}`}>
                                {statusLabel}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3 mt-3 text-xs">
                            <span className="text-gray-500">Costo referencia / 1K tokens</span>
                            <span className="text-white font-semibold">{formatUsdPer1kTokens(row.costPer1kTokens)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Los niveles se calculan por costo configurado: `económico` hasta US$ 0,00020, `equilibrado` hasta US$ 0,00300 y `premium` por encima de eso.
                  </p>
                </>
              ) : (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  No se pudo cargar el catálogo de pricing de modelos.
                </div>
              )}
            </div>

            <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#C6E36C]" />
                  Presupuesto operativo
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Métricas acumuladas y proyectadas del backend: gasto IA, ingresos, presupuesto efectivo y proyección del mes.
                </p>
              </div>

              {aiBudget ? (
                <>
                  <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0C101A] p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Utilización mensual</span>
                      <span className={utilizationPercent >= 90 ? "text-red-400 font-semibold" : utilizationPercent >= 75 ? "text-amber-400 font-semibold" : "text-[#C6E36C] font-semibold"}>
                        {aiBudget.computed.budgetUtilization}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          utilizationPercent >= 90 ? "bg-red-400" : utilizationPercent >= 75 ? "bg-amber-400" : "bg-[#C6E36C]"
                        }`}
                        style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg bg-[#131829] border border-[rgba(168,187,238,0.08)] p-3">
                        <p className="text-gray-500">Gastado</p>
                        <p className="text-white font-semibold mt-1">{formatUsd(aiBudget.budget.currentMonthSpentUsd)}</p>
                      </div>
                      <div className="rounded-lg bg-[#131829] border border-[rgba(168,187,238,0.08)] p-3">
                        <p className="text-gray-500">Restante</p>
                        <p className="text-white font-semibold mt-1">{formatUsd(aiBudget.computed.budgetRemaining)}</p>
                      </div>
                      <div className="rounded-lg bg-[#131829] border border-[rgba(168,187,238,0.08)] p-3">
                        <p className="text-gray-500">Presupuesto efectivo</p>
                        <p className="text-white font-semibold mt-1">{formatUsd(aiBudget.computed.effectiveBudget)}</p>
                      </div>
                      <div className="rounded-lg bg-[#131829] border border-[rgba(168,187,238,0.08)] p-3">
                        <p className="text-gray-500">Ingresos del mes</p>
                        <p className="text-white font-semibold mt-1">{formatUsd(aiBudget.computed.monthlyRevenue)}</p>
                      </div>
                      <div className="rounded-lg bg-[#131829] border border-[rgba(168,187,238,0.08)] p-3">
                        <p className="text-gray-500">Proyección fin de mes</p>
                        <p className="text-white font-semibold mt-1">{formatUsd(aiBudget.computed.projectedMonthEndSpendUsd)}</p>
                      </div>
                      <div className="rounded-lg bg-[#131829] border border-[rgba(168,187,238,0.08)] p-3">
                        <p className="text-gray-500">Utilización proyectada</p>
                        <p className="text-white font-semibold mt-1">{aiBudget.computed.projectedUtilization}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Fuente: trazas/agregados IA + ingresos del mes. El presupuesto efectivo se limita por ingresos y por el tope global antes de enrutar solicitudes.
                    </p>
                  </div>

                  {aiBudget?.breakdown ? (
                    <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[#0C101A] p-4 space-y-3">
                      <p className="text-sm text-white font-medium">Consumo acumulado</p>
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        {Object.entries(aiBudget.breakdown.byQuality).map(([qualityKey, entry]) => (
                          <div key={qualityKey} className="flex items-center justify-between text-gray-400">
                            <span>Calidad {getQualityLabel(qualityKey as "draft" | "final")}</span>
                            <span className="text-white">{entry.requests} req · {formatUsd(entry.estimatedUsd)}</span>
                          </div>
                        ))}
                        {Object.entries(aiBudget.breakdown.byLane).map(([laneKey, entry]) => (
                          <div key={laneKey} className="flex items-center justify-between text-gray-400">
                            <span>Nivel {getLaneLabel(laneKey as "economy" | "balanced" | "premium")}</span>
                            <span className="text-white">{entry.requests} req · {formatUsd(entry.estimatedUsd)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  {aiBudgetError || "No se pudo cargar el presupuesto IA."}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">CMS paramétrico</h3>
            <p className="text-sm text-gray-400 mt-1">
              Gestiona familias, templates SCAD y estructura base del catálogo del AI Studio.
            </p>
          </div>
          {!editingFamily && (
            <button
              onClick={handleCreateFamily}
              className="flex items-center gap-2 px-4 py-2 bg-[#C6E36C] text-black font-semibold rounded-lg hover:bg-[#a8df65] transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nueva familia
            </button>
          )}
        </div>

        {editingFamily ? (
          <div className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-medium text-white">
                {(editingFamily as AiStudioFamilyApiRecord).id ? "Editar familia paramétrica" : "Nueva familia paramétrica"}
              </h4>
              <button
                onClick={() => setEditingFamily(null)}
                className="text-gray-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nombre (ES)</label>
                  <input
                    type="text"
                    className="w-full bg-[#0C101A] border border-[rgba(168,187,238,0.1)] rounded p-2 text-sm text-white"
                    value={editingFamily.nameEs || ""}
                    onChange={(e) => setEditingFamily({ ...editingFamily, nameEs: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nombre (EN)</label>
                  <input
                    type="text"
                    className="w-full bg-[#0C101A] border border-[rgba(168,187,238,0.1)] rounded p-2 text-sm text-white"
                    value={editingFamily.nameEn || ""}
                    onChange={(e) => setEditingFamily({ ...editingFamily, nameEn: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Slug ID</label>
                  <input
                    type="text"
                    className="w-full bg-[#0C101A] border border-[rgba(168,187,238,0.1)] rounded p-2 text-sm text-white"
                    value={editingFamily.slug || ""}
                    onChange={(e) => setEditingFamily({ ...editingFamily, slug: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Imagen / Thumbnail</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-[#0C101A] border border-[rgba(168,187,238,0.1)] rounded p-2 text-sm text-white"
                      value={editingFamily.imageUrl || ""}
                      placeholder="Escribe la URL o sube una imagen..."
                      onChange={(e) => setEditingFamily({ ...editingFamily, imageUrl: e.target.value })}
                    />
                    <div className="relative">
                      <button
                        disabled={uploadingImage}
                        className="h-full px-4 rounded bg-[rgba(168,187,238,0.1)] hover:bg-[rgba(168,187,238,0.2)] text-gray-300 flex items-center gap-2"
                      >
                        <UploadCloud className={`w-4 h-4 ${uploadingImage ? "animate-pulse" : ""}`} />
                        {uploadingImage ? "..." : "Subir"}
                      </button>
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        disabled={uploadingImage}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !editingFamily) return;
                          try {
                            setUploadingImage(true);
                            const url = await AiStudioCMSApi.uploadFamilyImage(file);
                            setEditingFamily({ ...editingFamily, imageUrl: url });

                            if ((editingFamily as AiStudioFamilyApiRecord).id) {
                              await AiStudioCMSApi.updateFamily((editingFamily as AiStudioFamilyApiRecord).id, { imageUrl: url });
                              toast.success("Imagen subida y auto-guardada en la DB");
                              await loadData();
                            } else {
                              toast.success("Imagen adjuntada al borrador. Aún debes guardar la familia.");
                            }
                          } catch (err: any) {
                            toast.error(err.message || "Error al subir la imagen");
                          } finally {
                            setUploadingImage(false);
                            e.target.value = "";
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Engine</label>
                  <select
                    className="w-full bg-[#0C101A] border border-[rgba(168,187,238,0.1)] rounded p-2 text-sm text-white"
                    value={editingFamily.engine || "fdm"}
                    onChange={(e) => setEditingFamily({ ...editingFamily, engine: e.target.value as "fdm" | "organic" })}
                  >
                    <option value="fdm">FDM</option>
                    <option value="organic">Organic</option>
                  </select>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">Status</label>
                    <select
                      className="w-full bg-[#0C101A] border border-[rgba(168,187,238,0.1)] rounded p-2 text-sm text-white"
                      value={editingFamily.status || "active"}
                      onChange={(e) => setEditingFamily({ ...editingFamily, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="draft">Borrador</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1">Prioridad visual</label>
                    <input
                      type="number"
                      className="w-full bg-[#0C101A] border border-[rgba(168,187,238,0.1)] rounded p-2 text-sm text-white"
                      value={editingFamily.priority || 0}
                      onChange={(e) => setEditingFamily({ ...editingFamily, priority: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="mt-6 border-t border-[rgba(168,187,238,0.1)] pt-4">
                  <h5 className="text-white text-sm font-medium mb-3">Schema de parámetros (JSON)</h5>
                  <p className="text-xs text-gray-500 mb-2">
                    Define min, max, type, defaultValue y descripción para cada control del generador.
                  </p>
                  <textarea
                    className="w-full h-64 bg-[#080B14] border border-[#C6E36C]/20 rounded p-3 text-xs text-[#C6E36C] font-mono leading-relaxed"
                    value={parametersJson}
                    onChange={(e) => setParametersJson(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-4 flex flex-col h-full">
                <h5 className="text-white text-sm font-medium mb-1">Plantilla SCAD</h5>
                <p className="text-xs text-gray-500 mb-2">
                  Código OpenSCAD base que el motor IA puede usar como punto de partida o inyectar dinámicamente.
                </p>
                <textarea
                  className="flex-1 min-h-[500px] w-full bg-[#080B14] border border-blue-500/20 rounded p-4 text-xs text-blue-200 font-mono leading-relaxed resize-none"
                  value={scadTemplate}
                  onChange={(e) => setScadTemplate(e.target.value)}
                />

                <button
                  onClick={handleSaveFamily}
                  className="w-full py-4 mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg flex justify-center items-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Guardar blueprint completo
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {families.map((family) => {
              const familyPresetsCount = presets.filter((preset) => preset.familyId === family.id).length;
              return (
                <div key={family.id} className="bg-[#131829] border border-[rgba(168,187,238,0.08)] rounded-xl p-5 hover:border-[#C6E36C]/20 transition-all flex justify-between items-start group">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-[#0C101A] rounded-lg border border-[rgba(168,187,238,0.1)] flex items-center justify-center shrink-0">
                      <Package className="w-6 h-6 text-[#C6E36C]" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white group-hover:text-[#C6E36C] transition-colors">
                        {family.nameEs} <span className="text-gray-500 text-xs ml-2">({family.slug})</span>
                      </h4>
                      <div className="flex gap-3 text-xs text-gray-400 mt-2">
                        <span className="bg-gray-800 px-2 py-0.5 rounded text-white">{family.engine}</span>
                        <span className={family.status === "active" ? "text-green-400" : "text-amber-400"}>{family.status}</span>
                        <span>{familyPresetsCount} ajustes</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEditFamily(family)} className="p-2 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteFamily(family.id)} className="p-2 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
