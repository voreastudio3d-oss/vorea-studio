/**
 * GCodePanel – UI for configuring and generating GCode from compiled models.
 * Integrates server-authoritative tool credits, 2D slice preview, and FullControl engine.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { SlicePreview } from "./SlicePreview";
import { CreditPackModal } from "./CreditPackModal";
import { useAuth } from "../services/auth-context";
import { AuthDialog } from "./AuthDialog";
import { ToolActionsApi, ToolCreditsApi } from "../services/api-client";
import { useNavigate } from "../nav";
import type { SerializedMesh } from "../engine/mesh-data";
import type { GCodeResult } from "../engine/fullcontrol";
import type { SliceConfig } from "../engine/slicer";
import { meshToGCode, DEFAULT_SLICE_CONFIG } from "../engine/slicer";
import { toast } from "sonner";
import {
  Printer,
  Settings2,
  Download,
  Copy,
  Clock,
  Layers,
  Ruler,
  ChevronDown,
  ChevronUp,
  Play,
  Loader2,
  Save,
  FileCode2,
  AlertTriangle,
  Lock,
  Crown,
  Package,
  Zap,
  Eye,
} from "lucide-react";

function isAuthErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("autenticación requerida") ||
    normalized.includes("autenticacion requerida") ||
    normalized.includes("no autenticado") ||
    normalized.includes("no autorizado") ||
    normalized.includes("inicia sesion") ||
    normalized.includes("inicia sesión") ||
    normalized.includes("debes iniciar sesion") ||
    normalized.includes("debes iniciar sesión")
  );
}

type ToolCreditSnapshot = Awaited<ReturnType<typeof ToolCreditsApi.getMine>>;

interface GCodePanelProps {
  mesh: SerializedMesh | null;
  modelName?: string;
  onSaveToCollection?: (gcode: string, name: string) => void;
}

export function GCodePanel({ mesh, modelName = "modelo", onSaveToCollection }: GCodePanelProps) {
  const { isLoggedIn, refreshCredits, creditBalance, user } = useAuth();
  const navigate = useNavigate();
  const userTier = user?.tier ?? "FREE";

  // Slice config
  const [layerHeight, setLayerHeight] = useState(DEFAULT_SLICE_CONFIG.layerHeight);
  const [extrusionWidth, setExtrusionWidth] = useState(DEFAULT_SLICE_CONFIG.extrusionWidth);
  const [infillDensity, setInfillDensity] = useState(DEFAULT_SLICE_CONFIG.infillDensity);
  const [infillPattern, setInfillPattern] = useState<SliceConfig["infillPattern"]>("lines");
  const [wallCount, setWallCount] = useState(DEFAULT_SLICE_CONFIG.wallCount);
  const [printSpeed, setPrintSpeed] = useState(DEFAULT_SLICE_CONFIG.printSpeed);
  const [travelSpeed, setTravelSpeed] = useState(DEFAULT_SLICE_CONFIG.travelSpeed);
  const [nozzleTemp, setNozzleTemp] = useState(200);
  const [bedTemp, setBedTemp] = useState(60);

  // State
  const [result, setResult] = useState<GCodeResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [codePreviewOpen, setCodePreviewOpen] = useState(false);
  const [slicePreviewOpen, setSlicePreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Credit / auth modals
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [availableCredits, setAvailableCredits] = useState<number | null>(creditBalance);
  const [creditsStale, setCreditsStale] = useState(false);
  const [creditsLoading, setCreditsLoading] = useState(false);

  // Credits info
  const remaining = isLoggedIn ? availableCredits : null;

  useEffect(() => {
    setAvailableCredits(creditBalance);
  }, [creditBalance]);

  const syncCredits = useCallback(async () => {
    if (!isLoggedIn) {
      setAvailableCredits(null);
      setCreditsStale(false);
      return { credits: null, stale: false } as { credits: ToolCreditSnapshot | null; stale: boolean };
    }

    setCreditsLoading(true);
    try {
      const credits = await ToolCreditsApi.getMine();
      setAvailableCredits(credits.balance);
      setCreditsStale(false);
      return { credits, stale: false };
    } catch (error) {
      console.log("Tool credit sync failed:", error);
      setCreditsStale(true);
      return { credits: null, stale: true };
    } finally {
      setCreditsLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    void syncCredits();
  }, [syncCredits]);

  // Slice config object for preview
  const sliceConfig = useMemo(() => ({
    layerHeight,
    extrusionWidth,
    infillDensity,
    infillPattern,
    wallCount,
    printSpeed,
    travelSpeed,
  }), [layerHeight, extrusionWidth, infillDensity, infillPattern, wallCount, printSpeed, travelSpeed]);

  // ─── Generate GCode ─────────────────────────────────────────────────
  const generateGCode = useCallback(async () => {
    if (!mesh) {
      toast.error("Compila el modelo primero");
      return;
    }

    // Auth check
    if (!isLoggedIn) {
      setAuthDialogOpen(true);
      return;
    }

    try {
      const preflight = await ToolActionsApi.consume("gcode", "export", { consume: false });
      setAvailableCredits(preflight.credits?.balance ?? availableCredits ?? null);
      setCreditsStale(false);
    } catch (preflightError: any) {
      const message = String(preflightError?.message || "").trim();
      if (message && isAuthErrorMessage(message)) {
        setAuthDialogOpen(true);
        return;
      }
      const deniedMessage = message || "No se pudo validar el acceso a GCode.";
      setError(deniedMessage);
      toast.error(deniedMessage);
      setCreditModalOpen(true);
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const gcodeResult = await new Promise<GCodeResult>((resolve, reject) => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            try {
              resolve(
                meshToGCode(mesh, sliceConfig, {
                  nozzleTemp,
                  bedTemp,
                  printSpeed,
                  travelSpeed,
                  layerHeight,
                  extrusionWidth,
                }),
              );
            } catch (e) {
              reject(e);
            }
          }, 20);
        });
      });

      const charge = await ToolActionsApi.consume("gcode", "export");
      setAvailableCredits(charge.credits?.balance ?? availableCredits ?? null);
      setCreditsStale(false);
      setResult(gcodeResult);
      await refreshCredits();

      const creditMsg =
        typeof charge.credits?.balance === "number"
          ? ` · ${charge.credits.balance} creditos disponibles`
          : "";
      toast.success(
        `GCode generado: ${gcodeResult.lines} lineas, ${gcodeResult.layerCount} capas${creditMsg}`,
      );
    } catch (e: any) {
      const message = e?.message || "Error generando GCode";
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }, [
    bedTemp,
    extrusionWidth,
    isLoggedIn,
    layerHeight,
    mesh,
    nozzleTemp,
    printSpeed,
    refreshCredits,
    sliceConfig,
    travelSpeed,
    availableCredits,
  ]);

  // ─── Download GCode ─────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.gcode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${modelName.replace(/\s+/g, "_")}.gcode`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Archivo .gcode descargado");
  }, [result, modelName]);

  // ─── Copy GCode ─────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    if (!result) return;
    try {
      const textarea = document.createElement("textarea");
      textarea.value = result.gcode;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success("GCode copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar");
    }
  }, [result]);

  // ─── Save to collection ─────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!result || !onSaveToCollection) return;
    onSaveToCollection(result.gcode, modelName);
    toast.success("GCode guardado en tu coleccion");
  }, [result, onSaveToCollection, modelName]);

  // ─── Estimated mesh info ────────────────────────────────────────────
  const meshInfo = useMemo(() => {
    if (!mesh) return null;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const p of mesh.polygons) {
      for (const v of p.vertices) {
        if (v.px < minX) minX = v.px;
        if (v.px > maxX) maxX = v.px;
        if (v.py < minY) minY = v.py;
        if (v.py > maxY) maxY = v.py;
        if (v.pz < minZ) minZ = v.pz;
        if (v.pz > maxZ) maxZ = v.pz;
      }
    }
    return {
      width: (maxX - minX).toFixed(1),
      depth: (maxY - minY).toFixed(1),
      height: (maxZ - minZ).toFixed(1),
      faces: mesh.faceCount,
      layers: Math.ceil((maxZ - minZ) / layerHeight),
    };
  }, [mesh, layerHeight]);

  return (
    <>
      <Card className="bg-[rgba(26,31,54,0.6)] border-[rgba(168,187,238,0.12)]">
        <CardContent className="p-0">
          {/* Header */}
          <div className="px-5 py-4 border-b border-[rgba(168,187,238,0.08)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#C6E36C]" />
                <span className="text-sm font-semibold">Generador GCode</span>
                <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/25 text-[9px]">
                  FullControl
                </Badge>
              </div>
              {!mesh && (
                <Badge className="bg-amber-500/15 text-amber-400/80 border-amber-500/20 text-[9px]">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Compila primero
                </Badge>
              )}
            </div>

            {/* Credits bar */}
            {isLoggedIn && (
              <div className="flex items-center gap-2 mt-3">
                {typeof remaining === "number" ? (
                  <Badge className={`text-[9px] ${
                    remaining > 3
                      ? "bg-green-500/15 text-green-400 border-green-500/25"
                      : remaining > 0
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                      : "bg-red-500/15 text-red-400 border-red-500/25"
                  }`}>
                    {remaining > 0 ? (
                      <Package className="w-3 h-3 mr-1" />
                    ) : (
                      <Lock className="w-3 h-3 mr-1" />
                    )}
                    {remaining} creditos disponibles ({userTier})
                  </Badge>
                ) : (
                  <Badge className="bg-gray-500/15 text-gray-400 border-gray-500/25 text-[9px]">
                    <Zap className="w-3 h-3 mr-1" />
                    Validando saldo server-side
                  </Badge>
                )}
                <Badge className="bg-[#1a1f36] text-gray-500 border-[rgba(168,187,238,0.08)] text-[9px]">
                  GCode usa tool-actions
                </Badge>
                <button
                  onClick={() => setCreditModalOpen(true)}
                  className="text-[9px] text-[#C6E36C] hover:underline ml-auto"
                >
                  Ver saldo y planes
                </button>
                {creditsLoading && (
                  <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/25 text-[9px]">
                    Sincronizando saldo...
                  </Badge>
                )}
                {creditsStale && !creditsLoading && (
                  <button
                    onClick={() => void syncCredits()}
                    className="text-[9px] text-amber-300 hover:underline"
                  >
                    Saldo sin sincronizar. Reintentar
                  </button>
                )}
              </div>
            )}

            {!isLoggedIn && (
              <div className="flex items-center gap-2 mt-3">
                <Badge className="bg-gray-500/15 text-gray-400 border-gray-500/25 text-[9px]">
                  <Lock className="w-3 h-3 mr-1" />
                  Inicia sesion para generar GCode
                </Badge>
              </div>
            )}

            {/* Mesh info */}
            {meshInfo && (
              <div className="flex gap-3 mt-2 text-[10px] text-gray-500">
                <span className="flex items-center gap-1">
                  <Ruler className="w-3 h-3" />
                  {meshInfo.width}&times;{meshInfo.depth}&times;{meshInfo.height}mm
                </span>
                <span>{meshInfo.faces} caras</span>
                <span>~{meshInfo.layers} capas</span>
              </div>
            )}
          </div>

          {/* Quick settings */}
          <div className="px-5 py-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">Altura de capa</label>
              <select
                value={layerHeight}
                onChange={(e) => setLayerHeight(parseFloat(e.target.value))}
                className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-gray-300"
              >
                <option value="0.1">0.10mm (Fino)</option>
                <option value="0.15">0.15mm</option>
                <option value="0.2">0.20mm (Normal)</option>
                <option value="0.25">0.25mm</option>
                <option value="0.3">0.30mm (Rapido)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">Relleno</label>
              <select
                value={infillDensity}
                onChange={(e) => setInfillDensity(parseFloat(e.target.value))}
                className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-gray-300"
              >
                <option value="0">0% (Hueco)</option>
                <option value="0.1">10%</option>
                <option value="0.2">20% (Normal)</option>
                <option value="0.4">40%</option>
                <option value="0.6">60%</option>
                <option value="1">100% (Solido)</option>
              </select>
            </div>
          </div>

          {/* Advanced settings toggle */}
          <button
            className="w-full flex items-center justify-between px-5 py-2 text-[11px] text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors border-t border-[rgba(168,187,238,0.06)]"
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            <span className="flex items-center gap-1.5">
              <Settings2 className="w-3 h-3" />
              Configuracion avanzada
            </span>
            {settingsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {settingsOpen && (
            <div className="px-5 py-3 grid grid-cols-2 gap-3 border-t border-[rgba(168,187,238,0.06)]">
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Ancho extrusion (mm)</label>
                <input
                  type="number"
                  value={extrusionWidth}
                  onChange={(e) => setExtrusionWidth(parseFloat(e.target.value) || 0.4)}
                  step="0.05"
                  min="0.2"
                  max="1.0"
                  className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-gray-300"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Paredes</label>
                <input
                  type="number"
                  value={wallCount}
                  onChange={(e) => setWallCount(parseInt(e.target.value) || 2)}
                  min="1"
                  max="6"
                  className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-gray-300"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Patron relleno</label>
                <select
                  value={infillPattern}
                  onChange={(e) => setInfillPattern(e.target.value as SliceConfig["infillPattern"])}
                  className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-gray-300"
                >
                  <option value="lines">Lineas</option>
                  <option value="grid">Rejilla</option>
                  <option value="none">Sin relleno</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Vel. impresion (mm/min)</label>
                <input
                  type="number"
                  value={printSpeed}
                  onChange={(e) => setPrintSpeed(parseInt(e.target.value) || 1200)}
                  step="100"
                  min="300"
                  max="6000"
                  className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-gray-300"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Temp. boquilla (&deg;C)</label>
                <input
                  type="number"
                  value={nozzleTemp}
                  onChange={(e) => setNozzleTemp(parseInt(e.target.value) || 200)}
                  min="170"
                  max="300"
                  className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-gray-300"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Temp. cama (&deg;C)</label>
                <input
                  type="number"
                  value={bedTemp}
                  onChange={(e) => setBedTemp(parseInt(e.target.value) || 60)}
                  min="0"
                  max="120"
                  className="w-full bg-[#0d1117] border border-[rgba(168,187,238,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-gray-300"
                />
              </div>
            </div>
          )}

          {/* 2D Slice Preview Toggle */}
          <button
            className="w-full flex items-center justify-between px-5 py-2 text-[11px] text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors border-t border-[rgba(168,187,238,0.06)]"
            onClick={() => setSlicePreviewOpen(!slicePreviewOpen)}
          >
            <span className="flex items-center gap-1.5">
              <Eye className="w-3 h-3" />
              Vista previa de capas (2D)
              {mesh && (
                <Badge className="bg-[#C6E36C]/10 text-[#C6E36C] border-[#C6E36C]/20 text-[8px]">
                  Nuevo
                </Badge>
              )}
            </span>
            {slicePreviewOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {slicePreviewOpen && (
            <div className="px-4 py-3 border-t border-[rgba(168,187,238,0.06)]">
              <SlicePreview mesh={mesh} config={sliceConfig} />
            </div>
          )}

          {/* Generate button */}
          <div className="px-5 py-3 border-t border-[rgba(168,187,238,0.08)]">
            {!isLoggedIn ? (
              <Button
                onClick={() => setAuthDialogOpen(true)}
                className="w-full gap-2"
                variant="secondary"
              >
                <Lock className="w-4 h-4" />
                Inicia sesion para generar GCode
              </Button>
            ) : typeof remaining === "number" && remaining <= 0 ? (
              <div className="space-y-2">
                <Button
                  onClick={() => setCreditModalOpen(true)}
                  className="w-full gap-2"
                >
                  <Package className="w-4 h-4" />
                  Revisar saldo y opciones
                </Button>
                <button
                  onClick={() => navigate("/planes")}
                  className="w-full text-center text-[10px] text-[#C6E36C] hover:underline flex items-center justify-center gap-1"
                >
                  <Crown className="w-3 h-3" /> Ver planes y recarga mensual
                </button>
              </div>
            ) : (
              <Button
                onClick={generateGCode}
                disabled={!mesh || generating}
                className="w-full gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando GCode...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Generar GCode
                    {typeof remaining === "number" && (
                      <span className="text-[9px] opacity-70 ml-1">
                        ({remaining} cr)
                      </span>
                    )}
                  </>
                )}
              </Button>
            )}
            {creditsStale && (
              <p className="mt-2 text-[10px] text-amber-300/80 text-center">
                El saldo mostrado puede estar desactualizado. Igual validaremos con el servidor antes de descontar.
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mx-5 mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-[10px] text-red-400 font-mono">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && !generating && (
            <>
              {/* Stats */}
              <div className="px-5 py-3 grid grid-cols-3 gap-3 border-t border-[rgba(168,187,238,0.08)]">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-gray-500 mb-0.5">
                    <Layers className="w-3 h-3" /> Capas
                  </div>
                  <p className="text-sm text-white font-mono">{result.layerCount}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-gray-500 mb-0.5">
                    <Clock className="w-3 h-3" /> Tiempo
                  </div>
                  <p className="text-sm text-white font-mono">
                    {result.estimatedTimeMin < 60
                      ? `${result.estimatedTimeMin}min`
                      : `${(result.estimatedTimeMin / 60).toFixed(1)}h`}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-gray-500 mb-0.5">
                    <Ruler className="w-3 h-3" /> Filamento
                  </div>
                  <p className="text-sm text-white font-mono">
                    {result.filamentUsedMm > 1000
                      ? `${(result.filamentUsedMm / 1000).toFixed(1)}m`
                      : `${result.filamentUsedMm}mm`}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 py-3 flex gap-2 flex-wrap border-t border-[rgba(168,187,238,0.08)]">
                <Button size="sm" variant="secondary" className="text-xs gap-1.5 flex-1" onClick={handleDownload}>
                  <Download className="w-3 h-3" /> .gcode
                </Button>
                <Button size="sm" variant="secondary" className="text-xs gap-1.5 flex-1" onClick={handleCopy}>
                  <Copy className="w-3 h-3" /> Copiar
                </Button>
                {onSaveToCollection && (
                  <Button size="sm" variant="secondary" className="text-xs gap-1.5 flex-1" onClick={handleSave}>
                    <Save className="w-3 h-3" /> Guardar
                  </Button>
                )}
              </div>

              {/* Code preview */}
              <button
                className="w-full flex items-center justify-between px-5 py-2 text-[11px] text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors border-t border-[rgba(168,187,238,0.06)]"
                onClick={() => setCodePreviewOpen(!codePreviewOpen)}
              >
                <span className="flex items-center gap-1.5">
                  <FileCode2 className="w-3 h-3" />
                  Vista previa GCode
                  <span className="text-[9px] text-gray-600 font-mono">{result.lines} lineas</span>
                </span>
                {codePreviewOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {codePreviewOpen && (
                <div className="border-t border-[rgba(168,187,238,0.06)]">
                  <pre className="px-5 py-3 text-[10px] font-mono text-gray-400 overflow-x-auto max-h-60 overflow-y-auto leading-relaxed whitespace-pre">
                    {result.gcode.slice(0, 5000)}
                    {result.gcode.length > 5000 && "\n\n... (truncado para preview)"}
                  </pre>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <CreditPackModal
        open={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        currentBalance={remaining}
        creditsLoading={creditsLoading}
        creditsStale={creditsStale}
        userTier={userTier}
        onRefresh={() => {
          void syncCredits();
          void refreshCredits();
        }}
      />
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </>
  );
}
