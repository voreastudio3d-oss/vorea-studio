/**
 * FeedbackPanel – floating feedback button + dialog.
 * Captures screenshot (via canvas), compilation logs, and app state.
 */

import { useState, useCallback, useRef } from "react";
import {
  MessageSquarePlus,
  X,
  Camera,
  Send,
  AlertTriangle,
  CheckCircle2,
  Bug,
  Lightbulb,
  Download,
  Copy,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Shield,
} from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import {
  CompilationLogService,
  copyToClipboard,
  type CompilationLogEntry,
  type LogSeverity,
} from "../services/compilation-log";
import { useAuth } from "../services/auth-context";
import { useLocation } from "../nav";
import { CloudFeedbackService } from "../services/storage";
import { fireReward } from "../services/reward-triggers";

// ─── Types ────────────────────────────────────────────────────────────────────

type FeedbackType = "bug" | "suggestion" | "error-report";

interface FeedbackReport {
  type: FeedbackType;
  message: string;
  screenshot?: string; // base64 data URL
  stateSnapshot: string; // JSON
  timestamp: string;
  userEmail?: string;
  modelSnapshotUrl?: string;
  generationParams?: any;
}

const FEEDBACK_STORAGE_KEY = "vorea_feedback_reports";
const MAX_REPORTS = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readReports(): FeedbackReport[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeReports(reports: FeedbackReport[]): void {
  try {
    localStorage.setItem(
      FEEDBACK_STORAGE_KEY,
      JSON.stringify(reports.slice(0, MAX_REPORTS))
    );
  } catch {
    /* quota */
  }
}

// ─── Severity icon/color map ─────────────────────────────────────────────────

function severityConfig(severity: LogSeverity) {
  switch (severity) {
    case "error":
      return { color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/25", label: "Error" };
    case "warning":
      return { color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/25", label: "Aviso" };
    case "security":
      return { color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/25", label: "Seguridad" };
    default:
      return { color: "text-green-400", bg: "bg-green-500/15", border: "border-green-500/25", label: "Info" };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FeedbackPanel() {
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [sending, setSending] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<LogSeverity | "all">("all");
  const panelRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const { pathname } = useLocation();

  // ─── Logs data ──────────────────────────────────────────────────────
  const allLogs = CompilationLogService.getAll();
  const stats = CompilationLogService.getStats();
  const filteredLogs =
    logFilter === "all"
      ? allLogs
      : allLogs.filter((l) => l.severity === logFilter);

  // ─── Screenshot capture ─────────────────────────────────────────────
  const captureScreenshot = useCallback(async () => {
    setCapturing(true);
    try {
      // Hide the panel temporarily so it's not in the screenshot
      if (panelRef.current) panelRef.current.style.display = "none";

      await new Promise((r) => setTimeout(r, 100));

      // Capture the entire app via a canvas clone approach
      const appRoot = document.getElementById("root") || document.body;
      const canvas = document.createElement("canvas");
      const w = Math.min(appRoot.scrollWidth, 1920);
      const h = Math.min(appRoot.scrollHeight, 1080);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        // Draw a representation: capture all visible canvases + overlay info
        ctx.fillStyle = "#0d1117";
        ctx.fillRect(0, 0, w, h);

        // Copy any existing canvases (3D viewport, etc.)
        if ((window as any).__vorea_get_model_snapshot) { try { (window as any).__vorea_get_model_snapshot(); } catch {} } const canvases = document.querySelectorAll("canvas");
        canvases.forEach((c) => {
          try {
            const rect = c.getBoundingClientRect();
            ctx.drawImage(c, rect.left, rect.top, rect.width, rect.height);
          } catch {
            /* tainted canvas */
          }
        });

        // Overlay timestamp and page info
        ctx.fillStyle = "rgba(13, 17, 23, 0.7)";
        ctx.fillRect(0, h - 36, w, 36);
        ctx.fillStyle = "#C6E36C";
        ctx.font = "12px monospace";
        ctx.fillText(
          `Vorea Studio | ${pathname} | ${new Date().toLocaleString()}`,
          10,
          h - 14
        );

        const dataUrl = canvas.toDataURL("image/png", 0.8);
        setScreenshot(dataUrl);
        toast.success("Captura de pantalla tomada");
      }
    } catch (e) {
      toast.error("No se pudo capturar la pantalla");
      console.error("Screenshot error:", e);
    } finally {
      if (panelRef.current) panelRef.current.style.display = "";
      setCapturing(false);
    }
  }, [pathname]);

  // ─── Send feedback ──────────────────────────────────────────────────
  const sendFeedback = useCallback(() => {
    if (!message.trim()) {
      toast.error("Escribe un comentario antes de enviar");
      return;
    }

    setSending(true);

    // Capture full state
    const stateSnapshot = CompilationLogService.captureState({
      currentPage: pathname,
      userTier: user?.tier,
    });

    const report: FeedbackReport = {
      type: feedbackType,
      message: message.trim(),
      screenshot: screenshot || undefined,
      stateSnapshot: JSON.stringify(stateSnapshot, null, 2),
      timestamp: new Date().toISOString(),
      userEmail: user?.email,
    };

    // Save locally
    const reports = readReports();
    reports.unshift(report);
    writeReports(reports);

    // Log it
    CompilationLogService.log({
      severity: "info",
      phase: "runtime",
      message: `Feedback enviado: [${feedbackType}] ${message.trim().slice(0, 100)}`,
    });

    // Send to cloud (fire-and-forget)
    CloudFeedbackService.submit({
      type: feedbackType,
      message: message.trim(),
      screenshot: screenshot || undefined,
      stateSnapshot: JSON.stringify(stateSnapshot, null, 2),
      userEmail: user?.email,
      generationParams: (window as any).__vorea_get_engine_config ? (window as any).__vorea_get_engine_config() : undefined,
      modelSnapshotUrl: (window as any).__vorea_get_model_snapshot ? (window as any).__vorea_get_model_snapshot() : undefined,
    }).then((result) => {
      if (result.success) {
        console.log("Feedback sent to cloud:", result.feedbackId);
      }
    });

    setTimeout(() => {
      setSending(false);
      setMessage("");
      setScreenshot(null);
      toast.success("Feedback enviado. Gracias por ayudarnos a mejorar!");
      fireReward("feedback_sent");
      setOpen(false);
    }, 600);
  }, [message, feedbackType, screenshot, pathname, user]);

  // ─── Export logs ────────────────────────────────────────────────────
  const exportLogs = useCallback(() => {
    const json = CompilationLogService.exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vorea-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exportados");
  }, []);

  // ─── Copy single log entry ─────────────────────────────────────────
  const copyLogEntry = useCallback((entry: CompilationLogEntry) => {
    const text = [
      `[${entry.severity.toUpperCase()}] ${entry.phase}`,
      `Timestamp: ${entry.timestamp}`,
      `Message: ${entry.message}`,
      entry.details ? `Details: ${entry.details}` : null,
      entry.fileName ? `File: ${entry.fileName}` : null,
      entry.line ? `Line: ${entry.line}` : null,
      entry.sourceSnippet ? `Source:\n${entry.sourceSnippet}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (copyToClipboard(text)) {
      toast.success("Error copiado al portapapeles");
    } else {
      toast.error("No se pudo copiar");
    }
  }, []);

  const typeConfig = {
    bug: { icon: <Bug className="w-4 h-4" />, label: "Bug / Error", color: "text-red-400" },
    suggestion: { icon: <Lightbulb className="w-4 h-4" />, label: "Sugerencia", color: "text-amber-400" },
    "error-report": { icon: <AlertTriangle className="w-4 h-4" />, label: "Reporte de Compilacion", color: "text-orange-400" },
  };

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-[9999]">
      {/* ─── Floating button ─────────────────────────────────────────── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="group relative flex items-center justify-center w-12 h-12 rounded-full bg-[#C6E36C] text-[#0d1117] shadow-lg shadow-[#C6E36C]/20 hover:shadow-[#C6E36C]/40 hover:scale-105 transition-all"
          title="Enviar feedback"
        >
          <MessageSquarePlus className="w-5 h-5" />
          {stats.errors > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
              {stats.errors > 99 ? "99+" : stats.errors}
            </span>
          )}
        </button>
      )}

      {/* ─── Panel ───────────────────────────────────────────────────── */}
      {open && (
        <div
          className="w-[400px] max-h-[85vh] bg-[#131829] border border-[rgba(168,187,238,0.15)] rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden"
          style={{
            animation: "vsFeedbackIn 0.25s cubic-bezier(.22,1,.36,1) both",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(168,187,238,0.1)]">
            <div className="flex items-center gap-2">
              <MessageSquarePlus className="w-4 h-4 text-[#C6E36C]" />
              <span className="text-sm font-semibold">Feedback & Diagnostico</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Stats bar */}
            <div className="flex gap-2">
              <div className="flex-1 bg-[#1a1f36] rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-gray-500">Compilaciones</p>
                <p className="text-sm font-bold text-white">{stats.total}</p>
              </div>
              <div className="flex-1 bg-[#1a1f36] rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-gray-500">Errores</p>
                <p className={`text-sm font-bold ${stats.errors > 0 ? "text-red-400" : "text-green-400"}`}>
                  {stats.errors}
                </p>
              </div>
              <div className="flex-1 bg-[#1a1f36] rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-gray-500">Seguridad</p>
                <p className={`text-sm font-bold ${stats.security > 0 ? "text-orange-400" : "text-green-400"}`}>
                  {stats.security}
                </p>
              </div>
              <div className="flex-1 bg-[#1a1f36] rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-gray-500">Exito</p>
                <p className="text-sm font-bold text-[#C6E36C]">{stats.successRate}%</p>
              </div>
            </div>

            {/* Feedback type selector */}
            <div>
              <label className="text-[11px] text-gray-500 mb-1.5 block">Tipo de feedback</label>
              <div className="flex gap-2">
                {(Object.keys(typeConfig) as FeedbackType[]).map((t) => {
                  const cfg = typeConfig[t];
                  return (
                    <button
                      key={t}
                      onClick={() => setFeedbackType(t)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] transition-all border ${
                        feedbackType === t
                          ? "bg-[#C6E36C]/10 border-[#C6E36C]/30 text-[#C6E36C]"
                          : "bg-[#1a1f36] border-[rgba(168,187,238,0.08)] text-gray-400 hover:border-[rgba(168,187,238,0.2)]"
                      }`}
                    >
                      {cfg.icon}
                      <span className="hidden sm:inline">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment field */}
            <div>
              <label className="text-[11px] text-gray-500 mb-1.5 block">
                Describe el problema o sugerencia
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  feedbackType === "bug"
                    ? "Describe el bug: que esperabas y que sucedio..."
                    : feedbackType === "suggestion"
                    ? "Tu sugerencia para mejorar Vorea Studio..."
                    : "Describe el error de compilacion y el archivo .scad usado..."
                }
                className="bg-[#0d1117] border-[rgba(168,187,238,0.12)] text-sm text-gray-200 placeholder:text-gray-600 min-h-[80px] resize-none"
                rows={3}
              />
            </div>

            {/* Screenshot */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-gray-500">Captura de pantalla</label>
                {screenshot && (
                  <button
                    onClick={() => setScreenshot(null)}
                    className="text-[10px] text-red-400 hover:text-red-300"
                  >
                    Eliminar
                  </button>
                )}
              </div>
              {screenshot ? (
                <div className="relative rounded-lg overflow-hidden border border-[rgba(168,187,238,0.12)]">
                  <img
                    src={screenshot}
                    alt="Captura"
                    className="w-full h-32 object-cover object-top"
                  />
                  <div className="absolute bottom-1 right-1">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[9px]">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Capturada
                    </Badge>
                  </div>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full gap-2 text-xs"
                  onClick={captureScreenshot}
                  disabled={capturing}
                >
                  {capturing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  {capturing ? "Capturando..." : "Tomar captura de pantalla"}
                </Button>
              )}
            </div>

            {/* Compilation logs section */}
            <div className="border-t border-[rgba(168,187,238,0.08)] pt-3">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="w-full flex items-center justify-between text-[11px] text-gray-400 hover:text-gray-200 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Log de compilacion ({allLogs.length} entradas)
                </span>
                {showLogs ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showLogs && (
                <div className="mt-2 space-y-2">
                  {/* Filter chips */}
                  <div className="flex gap-1.5 flex-wrap">
                    {(["all", "error", "warning", "security", "info"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setLogFilter(f)}
                        className={`px-2 py-0.5 rounded text-[9px] transition-all border ${
                          logFilter === f
                            ? "bg-[#C6E36C]/15 border-[#C6E36C]/30 text-[#C6E36C]"
                            : "bg-[#1a1f36] border-[rgba(168,187,238,0.08)] text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        {f === "all" ? "Todos" : f === "error" ? "Errores" : f === "warning" ? "Avisos" : f === "security" ? "Seguridad" : "Info"}
                      </button>
                    ))}
                  </div>

                  {/* Log entries */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {filteredLogs.length === 0 ? (
                      <p className="text-[10px] text-gray-600 text-center py-4">
                        No hay entradas de log
                      </p>
                    ) : (
                      filteredLogs.slice(0, 30).map((entry) => {
                        const cfg = severityConfig(entry.severity);
                        return (
                          <div
                            key={entry.id}
                            className={`group relative rounded-lg border p-2 ${cfg.bg} ${cfg.border} transition-all hover:ring-1 hover:ring-white/5`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className={`text-[9px] font-semibold uppercase ${cfg.color}`}>
                                    {cfg.label}
                                  </span>
                                  <span className="text-[8px] text-gray-600">
                                    {entry.phase}
                                  </span>
                                  {entry.fileName && (
                                    <span className="text-[8px] text-gray-500 truncate max-w-[100px]">
                                      {entry.fileName}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-300 leading-relaxed break-words">
                                  {entry.message}
                                </p>
                                {entry.details && (
                                  <pre className="text-[9px] text-gray-500 mt-1 whitespace-pre-wrap leading-relaxed max-h-16 overflow-y-auto">
                                    {entry.details}
                                  </pre>
                                )}
                                <span className="text-[8px] text-gray-600 mt-1 block">
                                  {new Date(entry.timestamp).toLocaleString()}
                                </span>
                              </div>
                              {/* Copy button */}
                              <button
                                onClick={() => copyLogEntry(entry)}
                                className="opacity-0 group-hover:opacity-100 shrink-0 w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 transition-all"
                                title="Copiar error"
                              >
                                <Copy className="w-3 h-3 text-gray-400" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Log actions */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-[10px] gap-1 flex-1"
                      onClick={exportLogs}
                    >
                      <Download className="w-3 h-3" /> Exportar JSON
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-[10px] gap-1"
                      onClick={() => {
                        const json = CompilationLogService.exportJSON();
                        if (copyToClipboard(json)) {
                          toast.success("Logs copiados al portapapeles");
                        }
                      }}
                    >
                      <Copy className="w-3 h-3" /> Copiar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-[10px] gap-1 text-red-400 hover:text-red-300"
                      onClick={() => {
                        CompilationLogService.clear();
                        toast.success("Logs eliminados");
                      }}
                    >
                      <Trash2 className="w-3 h-3" /> Limpiar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="border-t border-[rgba(168,187,238,0.1)] px-4 py-3 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="text-xs"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-2 text-xs"
              onClick={sendFeedback}
              disabled={!message.trim() || sending}
            >
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {sending ? "Enviando..." : "Enviar feedback"}
            </Button>
          </div>
        </div>
      )}

      {/* Animation keyframe */}
      <style>{`
        @keyframes vsFeedbackIn {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
