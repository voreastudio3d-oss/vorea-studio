/**
 * GCode Collection – View, manage, and re-download saved GCode files.
 * Uses GCodeCollectionService for persistence plus the universal tool-credit snapshot.
 */

import { useState, useCallback, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { useNavigate } from "../nav";
import { useAuth } from "../services/auth-context";
import { useI18n } from "../services/i18n-context";
import {
  GCodeCollectionService,
  type SavedGCodeItem,
} from "../services/storage";
import { toast } from "sonner";
import { trackAnalyticsEvent } from "../services/analytics";
import {
  FileCode2,
  Download,
  Trash2,
  Clock,
  ArrowLeft,
  FolderOpen,
  Copy,
  Printer,
  Search,
  Package,
  Crown,
} from "lucide-react";

export function GCodeCollection() {
  const navigate = useNavigate();
  const { isLoggedIn, user, creditBalance, refreshCredits } = useAuth();
  const { t } = useI18n();

  const [items, setItems] = useState<SavedGCodeItem[]>(GCodeCollectionService.list);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Cloud sync on mount
  useEffect(() => {
    trackAnalyticsEvent("page_view", { page: "gcode_collection" });
    let cancelled = false;
    setSyncing(true);
    Promise.all([
      GCodeCollectionService.listCloud(),
      isLoggedIn ? refreshCredits().catch(() => undefined) : Promise.resolve(undefined),
    ])
      .then(([cloudItems]) => {
        if (cancelled) return;
        setItems(cloudItems);
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });
    return () => { cancelled = true; };
  }, [isLoggedIn, refreshCredits]);

  const filtered = search
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  const selected = selectedId ? items.find((i) => i.id === selectedId) : null;

  const handleDelete = useCallback((id: string) => {
    GCodeCollectionService.remove(id);
    const updated = GCodeCollectionService.list();
    setItems(updated);
    if (selectedId === id) setSelectedId(null);
    trackAnalyticsEvent("gcode_delete", { tool: "gcode" });
    toast.success(t("gcode.deleted"));
  }, [selectedId, t]);

  const handleDownload = useCallback((item: SavedGCodeItem) => {
    const blob = new Blob([item.gcode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.name.replace(/\s+/g, "_")}.gcode`;
    a.click();
    URL.revokeObjectURL(url);
    trackAnalyticsEvent("gcode_download", { tool: "gcode", name: item.name });
    toast.success(t("gcode.downloaded"));
  }, [t]);

  const handleCopy = useCallback((item: SavedGCodeItem) => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = item.gcode;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      trackAnalyticsEvent("gcode_copy", { tool: "gcode" });
      toast.success(t("gcode.copied"));
    } catch {
      toast.error(t("gcode.copyError"));
    }
  }, [t]);

  const gcodeLines = selected ? selected.gcode.split("\n").length : 0;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="border-b border-[rgba(168,187,238,0.12)]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate("/studio")}
              className="w-8 h-8 rounded-lg bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-[#C6E36C]/10 border border-[#C6E36C]/30 flex items-center justify-center">
              <Printer className="w-5 h-5 text-[#C6E36C]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t("gcode.title")}</h1>
              <p className="text-sm text-gray-400">{t("gcode.filesSaved", { count: String(items.length) })}</p>
            </div>
          </div>

          {/* Credits + Search row */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("gcode.searchPlaceholder")}
                className="w-full pl-10 pr-4 py-2 bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] rounded-xl text-sm text-gray-300 placeholder-gray-600"
              />
            </div>

            {/* Credit badges */}
            {isLoggedIn && (
              <div className="flex items-center gap-2">
                <Badge className={`text-[9px] ${
                  (creditBalance ?? 0) > 25
                    ? "bg-green-500/15 text-green-400 border-green-500/25"
                    : (creditBalance ?? 0) > 0
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                    : "bg-red-500/15 text-red-400 border-red-500/25"
                }`}>
                  <Package className="w-3 h-3 mr-1" />
                  {creditBalance ?? "—"} cr disponibles
                </Badge>
                <Badge className="bg-[#1a1f36] text-gray-500 border-[rgba(168,187,238,0.08)] text-[9px]">
                  <Crown className="w-3 h-3 mr-1" />
                  {user?.tier ?? "FREE"}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {items.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] flex items-center justify-center mb-4">
              <FolderOpen className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-gray-300">{t("gcode.noFiles")}</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
              {t("gcode.noFilesDesc")}
            </p>
            <Button onClick={() => navigate("/studio")} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> {t("gcode.goToParametric")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List */}
            <div className="lg:col-span-1 flex flex-col gap-2 max-h-[600px] overflow-y-auto">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    selectedId === item.id
                      ? "bg-[#C6E36C]/10 border-[#C6E36C]/30"
                      : "bg-[rgba(26,31,54,0.4)] border-[rgba(168,187,238,0.08)] hover:border-[rgba(168,187,238,0.2)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode2 className="w-4 h-4 text-[#C6E36C] shrink-0" />
                      <span className="text-sm text-white truncate">{item.name}</span>
                    </div>
                    <Badge className="bg-[#1a1f36] text-gray-500 border-[rgba(168,187,238,0.08)] text-[9px] shrink-0">
                      .gcode
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
                    <Clock className="w-3 h-3" />
                    {new Date(item.createdAt).toLocaleDateString("es-LA", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </button>
              ))}

              {filtered.length === 0 && search && (
                <p className="text-sm text-gray-500 text-center py-8">
                  {t("gcode.noResults", { query: search })}
                </p>
              )}
            </div>

            {/* Detail / Preview */}
            <div className="lg:col-span-2">
              {selected ? (
                <Card className="bg-[rgba(26,31,54,0.6)] border-[rgba(168,187,238,0.12)]">
                  <CardContent className="p-0">
                    <div className="px-5 py-4 border-b border-[rgba(168,187,238,0.08)] flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">{selected.name}</h3>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {t("gcode.lines", { count: String(gcodeLines) })} &middot; {(selected.gcode.length / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" className="text-xs gap-1.5" onClick={() => handleCopy(selected)}>
                          <Copy className="w-3 h-3" /> {t("gcode.copy")}
                        </Button>
                        <Button size="sm" variant="secondary" className="text-xs gap-1.5" onClick={() => handleDownload(selected)}>
                          <Download className="w-3 h-3" /> {t("gcode.download")}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-xs gap-1.5 text-red-400 hover:text-red-300"
                          onClick={() => handleDelete(selected.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    <pre className="p-5 text-[10px] font-mono text-gray-400 overflow-x-auto max-h-[500px] overflow-y-auto leading-relaxed whitespace-pre">
                      {selected.gcode.slice(0, 10000)}
                      {selected.gcode.length > 10000 && `\n\n${t("gcode.truncated")}`}
                    </pre>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[300px] text-gray-600 text-sm">
                  {t("gcode.selectFile")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
