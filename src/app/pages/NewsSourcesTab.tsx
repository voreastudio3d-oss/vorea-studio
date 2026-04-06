import React, { useEffect, useState } from "react";
import {
  RefreshCw,
  Plus,
  Trash2,
  Globe,
  Rss,
  ToggleLeft,
  ToggleRight,
  Save,
  X,
  Loader2,
  Zap,
  ChevronUp,
  ChevronDown,
  Edit2,
  Radar,
  Sparkles,
  StickyNote,
  BarChart3,
} from "lucide-react";
import {
  NewsAdminApi,
  type NewsSourceAdminRecord,
  type NewsSourceEditorialPolicy,
} from "../services/api-client";

// ── Types ──

type NewsSource = NewsSourceAdminRecord;

const REGION_BADGES: Record<string, { label: string; color: string }> = {
  "10": { label: "🇺🇾 Uruguay", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  "11": { label: "🇺🇾 Uruguay", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  "15": { label: "🏭 Marca", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  "16": { label: "🏭 Marca", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  "20": { label: "🌎 LATAM", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  "25": { label: "🌎 LATAM", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  "40": { label: "🇪🇸 España", color: "bg-red-500/20 text-red-300 border-red-500/30" },
};

function getRegionBadge(priority: number) {
  const key = String(priority);
  if (REGION_BADGES[key]) return REGION_BADGES[key];
  if (priority >= 10 && priority < 15) return { label: "🇺🇾 Uruguay", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
  if (priority >= 15 && priority < 20) return { label: "🏭 Marca", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" };
  if (priority >= 20 && priority < 40) return { label: "🌎 LATAM", color: "bg-green-500/20 text-green-300 border-green-500/30" };
  if (priority >= 40 && priority < 50) return { label: "🇪🇸 España", color: "bg-red-500/20 text-red-300 border-red-500/30" };
  if (priority >= 50 && priority < 100) return { label: "🇺🇸 US/World", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" };
  return { label: "📰 Otro", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
}

function getEditorialPolicyMeta(policy: NewsSourceEditorialPolicy) {
  if (policy === "brief_only") {
    return {
      label: "Solo brief",
      description: "Siempre cae en Radar breve y no compite por indexación.",
      color: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      icon: <Radar className="w-3 h-3" />,
    };
  }

  return {
    label: "Estándar",
    description: "Puede convertirse en análisis editorial o evergreen si la pieza lo amerita.",
    color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    icon: <Sparkles className="w-3 h-3" />,
  };
}

// ── Component ──

type SourceStat = {
  sourceId: string;
  total: number;
  brief: number;
  indexable: number;
  evergreen: number;
  lastPublishedAt: string | null;
};

export function NewsSourcesTab() {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [sourceStats, setSourceStats] = useState<Record<string, SourceStat>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPriority, setEditingPriority] = useState<number>(50);
  const [editFormId, setEditFormId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<NewsSource>>({});

  // New source form
  const [newName, setNewName] = useState("");
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [newListingUrl, setNewListingUrl] = useState("");
  const [newFetchMode, setNewFetchMode] = useState("rss");
  const [newLanguage, setNewLanguage] = useState<"es" | "en">("es");
  const [newPriority, setNewPriority] = useState(50);
  const [newEditorialPolicy, setNewEditorialPolicy] = useState<NewsSourceEditorialPolicy>("standard");
  const [newEditorialNotes, setNewEditorialNotes] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadSources = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, stats] = await Promise.all([
        NewsAdminApi.listSources(),
        NewsAdminApi.getSourceStats().catch(() => [] as SourceStat[]),
      ]);
      setSources(data.sort((a: NewsSource, b: NewsSource) => a.priority - b.priority));
      const statsMap: Record<string, SourceStat> = {};
      for (const s of stats) statsMap[s.sourceId] = s;
      setSourceStats(statsMap);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleToggle = async (source: NewsSource) => {
    try {
      await NewsAdminApi.updateSource(source.id, { enabled: !source.enabled });
      setSources((prev) =>
        prev.map((s) => (s.id === source.id ? { ...s, enabled: !s.enabled } : s))
      );
      showToast(`${source.name}: ${!source.enabled ? "habilitada" : "deshabilitada"}`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handlePrioritySave = async (source: NewsSource) => {
    try {
      await NewsAdminApi.updateSource(source.id, { priority: editingPriority });
      setSources((prev) =>
        prev
          .map((s) => (s.id === source.id ? { ...s, priority: editingPriority } : s))
          .sort((a, b) => a.priority - b.priority)
      );
      setEditingId(null);
      showToast(`Prioridad de ${source.name} actualizada a P${editingPriority}`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const openEditForm = (source: NewsSource) => {
    setEditFormId(source.id);
      setEditForm({
        name: source.name,
        baseUrl: source.baseUrl,
        feedUrl: source.feedUrl || "",
        listingUrl: source.listingUrl || "",
        fetchMode: source.fetchMode,
        language: source.language,
        priority: source.priority,
        editorialPolicy: source.editorialPolicy,
        editorialNotes: source.editorialNotes || "",
      });
  };

  const handleEditSave = async (source: NewsSource) => {
    try {
      const patch: Record<string, unknown> = {};
      if (editForm.name && editForm.name !== source.name) patch.name = editForm.name;
      if (editForm.baseUrl && editForm.baseUrl !== source.baseUrl) patch.baseUrl = editForm.baseUrl;
      if ((editForm.feedUrl || "") !== (source.feedUrl || "")) patch.feedUrl = editForm.feedUrl || null;
      if ((editForm.listingUrl || "") !== (source.listingUrl || "")) patch.listingUrl = editForm.listingUrl || null;
      if (editForm.fetchMode && editForm.fetchMode !== source.fetchMode) patch.fetchMode = editForm.fetchMode;
      if (editForm.language && editForm.language !== source.language) patch.language = editForm.language;
      if (editForm.priority !== undefined && editForm.priority !== source.priority) patch.priority = editForm.priority;
      if (editForm.editorialPolicy && editForm.editorialPolicy !== source.editorialPolicy) {
        patch.editorialPolicy = editForm.editorialPolicy;
      }
      if ((editForm.editorialNotes || "") !== (source.editorialNotes || "")) {
        patch.editorialNotes = String(editForm.editorialNotes || "").trim() || null;
      }

      if (Object.keys(patch).length === 0) {
        setEditFormId(null);
        return;
      }

      const updated = await NewsAdminApi.updateSource(source.id, patch);
      setSources((prev) =>
        prev
          .map((s) => (s.id === source.id ? { ...s, ...updated } : s))
          .sort((a, b) => a.priority - b.priority)
      );
      setEditFormId(null);
      showToast(`"${updated.name || source.name}" actualizada`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleCreate = async () => {
    if (!newName || !newBaseUrl || !newFetchMode) {
      showToast("Nombre, URL base y modo de fetch son requeridos");
      return;
    }
    try {
      const created = await NewsAdminApi.createSource({
        name: newName,
        baseUrl: newBaseUrl,
        feedUrl: newFeedUrl || null,
        listingUrl: newListingUrl || null,
        fetchMode: newFetchMode,
        language: newLanguage,
        priority: newPriority,
        editorialPolicy: newEditorialPolicy,
        editorialNotes: newEditorialNotes.trim() || null,
        enabled: true,
      });
      setSources((prev) => [...prev, created].sort((a: NewsSource, b: NewsSource) => a.priority - b.priority));
      setShowForm(false);
      resetForm();
      showToast(`Fuente "${newName}" creada`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (source: NewsSource) => {
    if (!confirm(`¿Eliminar "${source.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await NewsAdminApi.deleteSource(source.id);
      setSources((prev) => prev.filter((s) => s.id !== source.id));
      showToast(`Fuente "${source.name}" eliminada`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleIngest = async () => {
    setIngesting(true);
    try {
      const result = await NewsAdminApi.triggerIngest();
      showToast(
        `Ingesta completa: ${result.insertedCount} nuevas, ${result.updatedCount} actualizadas, ${result.skippedCount} omitidas`
      );
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setIngesting(false);
    }
  };

  const resetForm = () => {
    setNewName("");
    setNewBaseUrl("");
    setNewFeedUrl("");
    setNewListingUrl("");
    setNewFetchMode("rss");
    setNewLanguage("es");
    setNewPriority(50);
    setNewEditorialPolicy("standard");
    setNewEditorialNotes("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Cargando fuentes...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-3">{error}</p>
        <button onClick={loadSources} className="text-sm text-[#C6E36C] hover:underline">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#1a1a2e]/95 border border-[#C6E36C]/30 px-4 py-2 rounded-lg text-sm text-[#C6E36C] shadow-lg backdrop-blur-sm animate-fadeIn">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Fuentes de Noticias</h2>
          <p className="text-xs text-gray-500">
            {sources.filter((s) => s.enabled).length} habilitadas de {sources.length} fuentes ·
            Prioridad: menor número = mayor relevancia
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#C6E36C]/10 text-[#C6E36C] border border-[#C6E36C]/20 hover:bg-[#C6E36C]/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar
          </button>
          <button
            onClick={handleIngest}
            disabled={ingesting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 hover:bg-purple-500/20 transition-all disabled:opacity-50"
          >
            {ingesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            {ingesting ? "Ingestando..." : "Ingestar Ahora"}
          </button>
          <button
            onClick={loadSources}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Priority Legend */}
      <div className="flex flex-wrap gap-2 text-[10px]">
        {[
          { label: "🇺🇾 UY (P10-14)", color: "bg-blue-500/10 text-blue-300" },
          { label: "🏭 Marcas (P15-19)", color: "bg-amber-500/10 text-amber-300" },
          { label: "🌎 LATAM (P20-39)", color: "bg-green-500/10 text-green-300" },
          { label: "🇪🇸 España (P40-49)", color: "bg-red-500/10 text-red-300" },
          { label: "🇺🇸 US/World (P50+)", color: "bg-purple-500/10 text-purple-300" },
        ].map((r) => (
          <span key={r.label} className={`px-2 py-0.5 rounded-full ${r.color}`}>
            {r.label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
        {(["standard", "brief_only"] as const).map((policy) => {
          const meta = getEditorialPolicyMeta(policy);
          return (
            <div key={policy} className={`rounded-xl border px-3 py-2 ${meta.color}`}>
              <div className="flex items-center gap-1.5 font-medium">
                {meta.icon}
                <span>{meta.label}</span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-current/80">{meta.description}</p>
            </div>
          );
        })}
      </div>

      {/* Add Source Form */}
      {showForm && (
        <div className="bg-white/[0.02] border border-[#C6E36C]/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#C6E36C]">Nueva Fuente</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Nombre *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-[#C6E36C]/50 outline-none"
            />
            <input
              placeholder="URL Base *"
              value={newBaseUrl}
              onChange={(e) => setNewBaseUrl(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-[#C6E36C]/50 outline-none"
            />
            <input
              placeholder="Feed URL (RSS/Atom)"
              value={newFeedUrl}
              onChange={(e) => setNewFeedUrl(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-[#C6E36C]/50 outline-none"
            />
            <input
              placeholder="Listing URL"
              value={newListingUrl}
              onChange={(e) => setNewListingUrl(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-[#C6E36C]/50 outline-none"
            />
            <div className="flex gap-2">
              <select
                value={newFetchMode}
                onChange={(e) => setNewFetchMode(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#C6E36C]/50 outline-none"
              >
                <option value="rss">RSS</option>
                <option value="atom">Atom</option>
                <option value="listing">Listing (scraping)</option>
              </select>
              <select
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value as "es" | "en")}
                className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:border-[#C6E36C]/50 outline-none"
              >
                <option value="es">ES</option>
                <option value="en">EN</option>
              </select>
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-xs text-gray-500">Prioridad:</label>
              <input
                type="number"
                min={1}
                max={200}
                value={newPriority}
                onChange={(e) => setNewPriority(Number(e.target.value))}
                className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white text-center focus:border-[#C6E36C]/50 outline-none"
              />
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${getRegionBadge(newPriority).color}`}>
                {getRegionBadge(newPriority).label}
              </span>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">Política editorial</label>
              <select
                value={newEditorialPolicy}
                onChange={(e) => setNewEditorialPolicy(e.target.value as NewsSourceEditorialPolicy)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#C6E36C]/50 outline-none"
              >
                <option value="standard">Estándar</option>
                <option value="brief_only">Solo brief</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">Notas editoriales internas</label>
            <textarea
              rows={3}
              placeholder="Opcional: por qué esta fuente conviene mantenerla como radar breve, qué ruido genera o qué vigilar."
              value={newEditorialNotes}
              onChange={(e) => setNewEditorialNotes(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-[#C6E36C]/50 outline-none resize-y"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs bg-[#C6E36C] text-[#0a0a0f] font-medium hover:bg-[#d4ef7a] transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              Crear Fuente
            </button>
          </div>
        </div>
      )}

      {/* Sources List */}
      <div className="space-y-1">
        {sources.map((source) => {
          const badge = getRegionBadge(source.priority);
          const policyMeta = getEditorialPolicyMeta(source.editorialPolicy);
          const isEditing = editingId === source.id;
          const isEditingForm = editFormId === source.id;

          return (
            <div key={source.id} className="space-y-0">
              <div
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                  source.enabled
                    ? "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                    : "bg-white/[0.01] border-white/[0.03] opacity-60"
                } ${isEditingForm ? "rounded-b-none border-b-0 border-[#C6E36C]/20" : ""}`}
              >
                {/* Enable/Disable Toggle */}
                <button
                  onClick={() => handleToggle(source)}
                  className="shrink-0 transition-colors"
                  title={source.enabled ? "Deshabilitar" : "Habilitar"}
                >
                  {source.enabled ? (
                    <ToggleRight className="w-6 h-6 text-[#C6E36C]" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-600" />
                  )}
                </button>

                {/* Priority */}
                {isEditing ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={editingPriority}
                      onChange={(e) => setEditingPriority(Number(e.target.value))}
                      className="w-14 bg-white/10 border border-[#C6E36C]/30 rounded px-1.5 py-0.5 text-xs text-white text-center outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handlePrioritySave(source);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button
                      onClick={() => handlePrioritySave(source)}
                      className="text-[#C6E36C] hover:text-[#d4ef7a]"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(source.id);
                      setEditingPriority(source.priority);
                    }}
                    className="shrink-0 w-10 text-center text-xs font-mono text-gray-500 hover:text-[#C6E36C] hover:bg-[#C6E36C]/5 rounded py-0.5 transition-colors"
                    title="Editar prioridad"
                  >
                    P{source.priority}
                  </button>
                )}

                {/* Region Badge */}
                <span
                  className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border ${badge.color}`}
                >
                  {badge.label}
                </span>

                {/* Name + URL */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{source.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 uppercase">
                      {source.language}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
                      {source.fetchMode}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${policyMeta.color}`}>
                      {policyMeta.icon}
                      {policyMeta.label}
                    </span>
                    {/* Inline article stats */}
                    {(() => {
                      const stat = sourceStats[source.id];
                      if (!stat || stat.total === 0) return null;
                      return (
                        <span className="inline-flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10" title={`Total: ${stat.total} · Brief: ${stat.brief} · Indexable: ${stat.indexable} · Evergreen: ${stat.evergreen}`}>
                          <BarChart3 className="w-3 h-3" />
                          <span className="font-medium text-white">{stat.total}</span>
                          {stat.brief > 0 && <span className="text-amber-400">{stat.brief}b</span>}
                          {stat.indexable > 0 && <span className="text-emerald-400">{stat.indexable}i</span>}
                          {stat.evergreen > 0 && <span className="text-cyan-400">{stat.evergreen}e</span>}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Globe className="w-3 h-3 text-gray-600" />
                    <a
                      href={source.baseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-gray-600 hover:text-gray-400 truncate"
                    >
                      {source.baseUrl.replace(/^https?:\/\//, "")}
                    </a>
                    {source.feedUrl && (
                      <>
                        <Rss className="w-3 h-3 text-orange-500/40 ml-2" />
                        <span className="text-[10px] text-gray-600">feed</span>
                      </>
                    )}
                  </div>
                  {source.editorialNotes && (
                    <div className="mt-2 flex items-start gap-1.5 text-[10px] text-gray-400 leading-relaxed">
                      <StickyNote className="w-3 h-3 mt-0.5 shrink-0 text-gray-500" />
                      <span className="line-clamp-2">{source.editorialNotes}</span>
                    </div>
                  )}
                </div>

                {/* Move Priority Buttons */}
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={async () => {
                      const newP = Math.max(1, source.priority - 5);
                      await NewsAdminApi.updateSource(source.id, { priority: newP });
                      setSources((prev) =>
                        prev
                          .map((s) => (s.id === source.id ? { ...s, priority: newP } : s))
                          .sort((a, b) => a.priority - b.priority)
                      );
                      showToast(`${source.name} → P${newP}`);
                    }}
                    className="text-gray-600 hover:text-[#C6E36C] p-0.5"
                    title="Subir prioridad (-5)"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      const newP = source.priority + 5;
                      await NewsAdminApi.updateSource(source.id, { priority: newP });
                      setSources((prev) =>
                        prev
                          .map((s) => (s.id === source.id ? { ...s, priority: newP } : s))
                          .sort((a, b) => a.priority - b.priority)
                      );
                      showToast(`${source.name} → P${newP}`);
                    }}
                    className="text-gray-600 hover:text-orange-400 p-0.5"
                    title="Bajar prioridad (+5)"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Edit */}
                <button
                  onClick={() => isEditingForm ? setEditFormId(null) : openEditForm(source)}
                  className={`shrink-0 p-1 rounded transition-all ${
                    isEditingForm
                      ? "text-[#C6E36C] bg-[#C6E36C]/10"
                      : "text-gray-700 hover:text-[#C6E36C] opacity-0 group-hover:opacity-100"
                  }`}
                  title="Editar fuente"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(source)}
                  className="shrink-0 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  title="Eliminar fuente"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* ── Expandable Edit Form ── */}
              {isEditingForm && (
                <div className="bg-white/[0.02] border border-[#C6E36C]/20 border-t-0 rounded-b-xl px-4 py-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 block">Nombre</label>
                      <input
                        value={editForm.name || ""}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#C6E36C]/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 block">URL Base</label>
                      <input
                        value={editForm.baseUrl || ""}
                        onChange={(e) => setEditForm({ ...editForm, baseUrl: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#C6E36C]/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 block">Feed URL (RSS/Atom)</label>
                      <input
                        value={(editForm.feedUrl as string) || ""}
                        onChange={(e) => setEditForm({ ...editForm, feedUrl: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#C6E36C]/50 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 block">Listing URL</label>
                      <input
                        value={(editForm.listingUrl as string) || ""}
                        onChange={(e) => setEditForm({ ...editForm, listingUrl: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#C6E36C]/50 outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 mb-1 block">Fetch Mode</label>
                        <select
                          value={editForm.fetchMode || "rss"}
                          onChange={(e) => setEditForm({ ...editForm, fetchMode: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#C6E36C]/50 outline-none"
                        >
                          <option value="rss">RSS</option>
                          <option value="atom">Atom</option>
                          <option value="listing">Listing (scraping)</option>
                        </select>
                      </div>
                      <div className="w-20">
                        <label className="text-[10px] text-gray-500 mb-1 block">Idioma</label>
                        <select
                          value={editForm.language || "es"}
                          onChange={(e) => setEditForm({ ...editForm, language: e.target.value as "es" | "en" })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:border-[#C6E36C]/50 outline-none"
                        >
                          <option value="es">ES</option>
                          <option value="en">EN</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">Prioridad</label>
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={editForm.priority || 50}
                          onChange={(e) => setEditForm({ ...editForm, priority: Number(e.target.value) })}
                          className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-xs text-white text-center focus:border-[#C6E36C]/50 outline-none"
                        />
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full ${getRegionBadge(editForm.priority || 50).color}`}>
                        {getRegionBadge(editForm.priority || 50).label}
                      </span>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 block">Política editorial</label>
                      <select
                        value={(editForm.editorialPolicy as NewsSourceEditorialPolicy) || "standard"}
                        onChange={(e) => setEditForm({ ...editForm, editorialPolicy: e.target.value as NewsSourceEditorialPolicy })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#C6E36C]/50 outline-none"
                      >
                        <option value="standard">Estándar</option>
                        <option value="brief_only">Solo brief</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">Notas editoriales internas</label>
                    <textarea
                      rows={3}
                      value={(editForm.editorialNotes as string) || ""}
                      onChange={(e) => setEditForm({ ...editForm, editorialNotes: e.target.value })}
                      placeholder="Describe por qué la fuente conviene degradarla, qué ruido produce o qué piezas sí vale rescatar."
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-[#C6E36C]/50 outline-none resize-y"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1 border-t border-white/5">
                    <button
                      onClick={() => setEditFormId(null)}
                      className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleEditSave(source)}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs bg-[#C6E36C] text-[#0a0a0f] font-medium hover:bg-[#d4ef7a] transition-all"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Guardar Cambios
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sources.length === 0 && (
        <div className="text-center py-16 text-gray-500 text-sm">
          No hay fuentes configuradas. Usá el botón "Agregar" para crear la primera.
        </div>
      )}
    </div>
  );
}
