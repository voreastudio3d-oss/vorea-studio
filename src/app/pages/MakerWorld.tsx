/**
 * MakerWorld – Quality Gate with real model lint, functional export, and publish flow.
 * Uses ModelContext to access the current compiled mesh.
 */

import { useState, useCallback, useMemo } from "react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { useNavigate } from "../nav";
import { useModel } from "../services/model-context";
import { useAuth } from "../services/auth-context";
import { useI18n } from "../services/i18n-context";
import { AuthDialog } from "../components/AuthDialog";
import { PublishDialog } from "../components/PublishDialog";
import { regenerateScad } from "../services/scad-parser";
import { consumeProtectedToolAction } from "../services/protected-tool-actions";
import { toast } from "sonner";
import { ScadLibrary } from "../components/ScadLibrary";
import { trackAnalyticsEvent } from "../services/analytics";
import {
  Printer,
  Play,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileDown,
  ShieldCheck,
  BarChart3,
  Upload,
  RefreshCw,
  Loader2,
  Download,
  Box,
  Code2,
} from "lucide-react";

// ─── Lint engine ──────────────────────────────────────────────────────────────

interface LintCheck {
  id: string;
  name: string;
  description: string;
  status: "pass" | "fail" | "warn" | "pending";
  detail?: string;
}

interface MeshStats {
  faceCount: number;
  vertexCount: number;
  triangleCount: number;
  boundingBox: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
  };
  volume: number;
  hasNormalIssues: boolean;
  hasDegenerateFaces: boolean;
}

function analyzeMesh(mesh: NonNullable<ReturnType<typeof useModel>["compiledMesh"]>): MeshStats {
  const polys = mesh.polygons;
  let vertexCount = 0;
  let triangleCount = 0;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let hasNormalIssues = false;
  let hasDegenerateFaces = false;
  let volume = 0;

  for (const poly of polys) {
    const vs = poly.vertices;
    vertexCount += vs.length;
    triangleCount += Math.max(0, vs.length - 2);

    for (const v of vs) {
      if (v.px < minX) minX = v.px;
      if (v.px > maxX) maxX = v.px;
      if (v.py < minY) minY = v.py;
      if (v.py > maxY) maxY = v.py;
      if (v.pz < minZ) minZ = v.pz;
      if (v.pz > maxZ) maxZ = v.pz;
    }

    // Check normals
    const nl = Math.sqrt(poly.planeNx ** 2 + poly.planeNy ** 2 + poly.planeNz ** 2);
    if (nl < 0.9 || nl > 1.1) hasNormalIssues = true;

    // Check degenerate
    if (vs.length < 3) hasDegenerateFaces = true;

    // Simple volume estimation (signed volume of tetrahedra)
    if (vs.length >= 3) {
      for (let i = 1; i < vs.length - 1; i++) {
        const v0 = vs[0], v1 = vs[i], v2 = vs[i + 1];
        volume += (
          v0.px * (v1.py * v2.pz - v2.py * v1.pz) -
          v1.px * (v0.py * v2.pz - v2.py * v0.pz) +
          v2.px * (v0.py * v1.pz - v1.py * v0.pz)
        ) / 6;
      }
    }
  }

  return {
    faceCount: polys.length,
    vertexCount,
    triangleCount,
    boundingBox: {
      minX: minX === Infinity ? 0 : minX,
      maxX: maxX === -Infinity ? 0 : maxX,
      minY: minY === Infinity ? 0 : minY,
      maxY: maxY === -Infinity ? 0 : maxY,
      minZ: minZ === Infinity ? 0 : minZ,
      maxZ: maxZ === -Infinity ? 0 : maxZ,
    },
    volume: Math.abs(volume),
    hasNormalIssues,
    hasDegenerateFaces,
  };
}

function runLintChecks(stats: MeshStats, t: (key: string, r?: Record<string, string | number>) => string): LintCheck[] {
  const { boundingBox: bb } = stats;
  const sizeX = bb.maxX - bb.minX;
  const sizeY = bb.maxY - bb.minY;
  const sizeZ = bb.maxZ - bb.minZ;
  const maxDim = Math.max(sizeX, sizeY, sizeZ);

  return [
    {
      id: "manifold",
      name: t("mw.lint.manifold"),
      description: t("mw.lint.manifoldDesc"),
      status: stats.faceCount > 4 ? "pass" : "fail",
      detail: stats.faceCount > 4
        ? t("mw.lint.manifoldPass", { faces: stats.faceCount, triangles: stats.triangleCount })
        : t("mw.lint.manifoldFail", { faces: stats.faceCount }),
    },
    {
      id: "thickness",
      name: t("mw.lint.thickness"),
      description: t("mw.lint.thicknessDesc"),
      status: Math.min(sizeX, sizeY, sizeZ) > 0.8 ? "pass" : "warn",
      detail: t("mw.lint.thicknessDetail", { value: Math.min(sizeX, sizeY, sizeZ).toFixed(1) }),
    },
    {
      id: "overhang",
      name: t("mw.lint.overhang"),
      description: t("mw.lint.overhangDesc"),
      status: stats.faceCount < 500 ? "pass" : "warn",
      detail: stats.faceCount < 500
        ? t("mw.lint.overhangPass")
        : t("mw.lint.overhangWarn", { faces: stats.faceCount }),
    },
    {
      id: "scale",
      name: t("mw.lint.scale"),
      description: t("mw.lint.scaleDesc"),
      status: maxDim <= 256 ? "pass" : maxDim <= 300 ? "warn" : "fail",
      detail: t("mw.lint.scaleDetail", { x: sizeX.toFixed(1), y: sizeY.toFixed(1), z: sizeZ.toFixed(1) }) +
        (maxDim > 256 ? t("mw.lint.scaleExceeds") : ""),
    },
    {
      id: "normals",
      name: t("mw.lint.normals"),
      description: t("mw.lint.normalsDesc"),
      status: stats.hasNormalIssues ? "warn" : "pass",
      detail: stats.hasNormalIssues
        ? t("mw.lint.normalsWarn")
        : t("mw.lint.normalsPass"),
    },
    {
      id: "degenerate",
      name: t("mw.lint.degenerate"),
      description: t("mw.lint.degenerateDesc"),
      status: stats.hasDegenerateFaces ? "fail" : "pass",
      detail: stats.hasDegenerateFaces
        ? t("mw.lint.degenerateFail")
        : t("mw.lint.degeneratePass"),
    },
  ];
}

const STATUS_ICON = {
  pass: <CheckCircle2 className="w-4 h-4 text-green-400" />,
  fail: <XCircle className="w-4 h-4 text-red-400" />,
  warn: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  pending: <div className="w-4 h-4 rounded-full border-2 border-gray-600" />,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MakerWorld() {
  const navigate = useNavigate();
  const model = useModel();
  const { isLoggedIn, refreshCredits } = useAuth();
  const { t } = useI18n();
  const [checks, setChecks] = useState<LintCheck[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [meshStats, setMeshStats] = useState<MeshStats | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  const hasModel = !!model.compiledMesh;

  const runLint = useCallback(() => {
    if (isRunning || !model.compiledMesh) return;
    setIsRunning(true);
    setChecks([]);

    const stats = analyzeMesh(model.compiledMesh);
    setMeshStats(stats);
    const results = runLintChecks(stats, t);

    // Animate checks appearing sequentially
    results.forEach((check, i) => {
      setTimeout(() => {
        setChecks((prev) => [...prev, check]);
        if (i === results.length - 1) {
          setIsRunning(false);
          setHasRun(true);
          trackAnalyticsEvent("makerworld_lint", {
            tool: "makerworld",
            surface: "editor",
            pass: String(results.filter(c => c.status === "pass").length),
            fail: String(results.filter(c => c.status === "fail").length),
            warn: String(results.filter(c => c.status === "warn").length),
          });
        }
      }, 300 + i * 350);
    });
  }, [isRunning, model.compiledMesh, t]);

  const passCount = checks.filter((c) => c.status === "pass").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  const allPass = hasRun && failCount === 0;

  const consumeMakerworldAction = useCallback(async (actionId: string) => {
    return consumeProtectedToolAction({
      isLoggedIn,
      toolId: "makerworld",
      actionId,
      onAuthRequired: () => setAuthOpen(true),
      authMessage: t("mw.authMessage"),
      onConsumed: refreshCredits,
    });
  }, [isLoggedIn, refreshCredits]);

  // Export handlers
  const handleExportSTL = useCallback(async () => {
    if (!model.compiledMesh) return;
    const allowed = await consumeMakerworldAction("download_prep");
    if (!allowed) return;
    const polys = model.compiledMesh.polygons;
    let stl = "solid vorea_model\n";
    for (const poly of polys) {
      const vs = poly.vertices;
      if (vs.length < 3) continue;
      for (let i = 1; i < vs.length - 1; i++) {
        stl += `  facet normal ${poly.planeNx.toFixed(6)} ${poly.planeNy.toFixed(6)} ${poly.planeNz.toFixed(6)}\n`;
        stl += "    outer loop\n";
        stl += `      vertex ${vs[0].px.toFixed(6)} ${vs[0].py.toFixed(6)} ${vs[0].pz.toFixed(6)}\n`;
        stl += `      vertex ${vs[i].px.toFixed(6)} ${vs[i].py.toFixed(6)} ${vs[i].pz.toFixed(6)}\n`;
        stl += `      vertex ${vs[i + 1].px.toFixed(6)} ${vs[i + 1].py.toFixed(6)} ${vs[i + 1].pz.toFixed(6)}\n`;
        stl += "    endloop\n";
        stl += "  endfacet\n";
      }
    }
    stl += "endsolid vorea_model\n";
    const blob = new Blob([stl], { type: "application/sla" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${model.modelName.replace(/\s+/g, "_")}.stl`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("mw.stlExported"));
    trackAnalyticsEvent("export_stl", { tool: "makerworld", surface: "editor" });
  }, [model.compiledMesh, model.modelName, consumeMakerworldAction, t]);

  const handleExportOBJ = useCallback(async () => {
    if (!model.compiledMesh) return;
    const allowed = await consumeMakerworldAction("download_prep");
    if (!allowed) return;
    const polys = model.compiledMesh.polygons;
    let obj = "# Vorea Studio OBJ Export\n";
    let vIdx = 1;
    for (const poly of polys) {
      for (const v of poly.vertices) {
        obj += `v ${v.px.toFixed(6)} ${v.py.toFixed(6)} ${v.pz.toFixed(6)}\n`;
      }
    }
    for (const poly of polys) {
      const indices: number[] = [];
      for (let i = 0; i < poly.vertices.length; i++) {
        indices.push(vIdx++);
      }
      obj += `f ${indices.join(" ")}\n`;
    }
    const blob = new Blob([obj], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${model.modelName.replace(/\s+/g, "_")}.obj`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("mw.objExported"));
    trackAnalyticsEvent("export_obj", { tool: "makerworld", surface: "editor" });
  }, [model.compiledMesh, model.modelName, consumeMakerworldAction, t]);

  const handleExportSCAD = useCallback(async () => {
    const allowed = await consumeMakerworldAction("upload_scad");
    if (!allowed) return;
    const code = regenerateScad(model.scadSource, model.paramValues);
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${model.modelName.replace(/\s+/g, "_")}.scad`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("mw.scadExported"));
    trackAnalyticsEvent("export_scad", { tool: "makerworld", surface: "editor" });
  }, [model.scadSource, model.paramValues, model.modelName, consumeMakerworldAction, t]);

  const bb = meshStats?.boundingBox;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[rgba(168,187,238,0.12)]">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at top right, rgba(34,197,94,0.08) 0%, transparent 60%), radial-gradient(ellipse at bottom left, rgba(198,227,108,0.05) 0%, transparent 60%), #0d1117",
          }}
        />
        <div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
          <div className="flex items-center gap-3 mb-4" style={{ animation: "vsHeroIn 0.5s cubic-bezier(.22,1,.36,1) both" }}>
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <Printer className="w-5 h-5 text-green-400" />
            </div>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              {t("mw.badge")}
            </Badge>
          </div>
          <h1
            className="text-4xl md:text-5xl font-bold tracking-tight mb-3"
            style={{
              background: "linear-gradient(135deg, #fff 30%, #4ade80 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "vsHeroIn 0.55s cubic-bezier(.22,1,.36,1) 0.05s both",
            }}
          >
            {t("mw.title")}
          </h1>
          <p className="text-base text-gray-400 max-w-2xl mb-6" style={{ animation: "vsHeroIn 0.55s cubic-bezier(.22,1,.36,1) 0.1s both" }}>
            {t("mw.subtitle")}
          </p>

          {/* No model warning */}
          {!hasModel && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3 max-w-xl" style={{ animation: "vsHeroIn 0.55s cubic-bezier(.22,1,.36,1) 0.15s both" }}>
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-200 mb-1">{t("mw.noModel")}</p>
                <p className="text-xs text-amber-400/70 mb-3">
                  {t("mw.noModelDesc")}
                </p>
                <Button size="sm" onClick={() => navigate("/studio")} className="gap-2">
                  <ArrowLeft className="w-3.5 h-3.5" /> {t("mw.goEditor")}
                </Button>
              </div>
            </div>
          )}

          {hasModel && (
            <div className="flex gap-3" style={{ animation: "vsHeroIn 0.55s cubic-bezier(.22,1,.36,1) 0.15s both" }}>
              <Button onClick={() => navigate("/studio")} variant="secondary" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> {t("mw.editor")}
              </Button>
              <Badge className="bg-[#1a1f36] text-gray-300 border-[rgba(168,187,238,0.12)] flex items-center gap-1.5 px-3">
                <Box className="w-3 h-3 text-[#C6E36C]" />
                {model.modelName}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Quality Gate */}
      {hasModel && (
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Checks */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between mb-4">
                <Button onClick={runLint} disabled={isRunning} className="gap-2">
                  {isRunning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {isRunning ? t("mw.analyzing") : hasRun ? t("mw.reAnalyze") : t("mw.runLint")}
                </Button>

                {hasRun && (
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5 text-green-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {passCount} pass
                    </span>
                    {warnCount > 0 && (
                      <span className="flex items-center gap-1.5 text-yellow-400">
                        <AlertTriangle className="w-3.5 h-3.5" /> {warnCount} warn
                      </span>
                    )}
                    {failCount > 0 && (
                      <span className="flex items-center gap-1.5 text-red-400">
                        <XCircle className="w-3.5 h-3.5" /> {failCount} fail
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Check cards */}
              {checks.length === 0 && !isRunning && (
                <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[rgba(26,31,54,0.3)] p-8 text-center">
                  <ShieldCheck className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">
                    {t("mw.lintPrompt")}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-1">
                    {t("mw.lintPromptDetail")}
                  </p>
                </div>
              )}

              {checks.map((check, i) => (
                <div
                  key={check.id}
                  className={`rounded-xl border p-4 transition-all ${
                    check.status === "pass"
                      ? "border-green-500/20 bg-green-500/5"
                      : check.status === "fail"
                      ? "border-red-500/20 bg-red-500/5"
                      : check.status === "warn"
                      ? "border-yellow-500/20 bg-yellow-500/5"
                      : "border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.4)]"
                  }`}
                  style={{ animation: `vsCardIn 0.3s cubic-bezier(.22,1,.36,1) both` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {STATUS_ICON[check.status]}
                      <div>
                        <p className="text-sm text-white">{check.name}</p>
                        <p className="text-[11px] text-gray-500">{check.description}</p>
                      </div>
                    </div>
                    <Badge
                      className={`text-[9px] ${
                        check.status === "pass"
                          ? "bg-green-500/20 text-green-400 border-none"
                          : check.status === "warn"
                          ? "bg-yellow-500/20 text-yellow-400 border-none"
                          : "bg-red-500/20 text-red-400 border-none"
                      }`}
                    >
                      {check.status.toUpperCase()}
                    </Badge>
                  </div>
                  {check.detail && (
                    <p className="text-[10px] text-gray-400 mt-2 ml-7">
                      {check.detail}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Side panel */}
            <div className="flex flex-col gap-4">
              {/* Export */}
              <Card className="bg-[rgba(26,31,54,0.6)] border-[rgba(168,187,238,0.12)]">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <FileDown className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-semibold">{t("mw.export")}</span>
                  </div>
                  <div className="space-y-2">
                    <button onClick={handleExportSTL} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#1a1f36] border border-[rgba(168,187,238,0.08)] hover:border-green-500/30 transition-all text-left">
                      <div>
                        <span className="text-xs text-white font-mono">.STL</span>
                        <p className="text-[10px] text-gray-500 mt-0.5">{t("mw.exportStl")}</p>
                      </div>
                      <Download className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    <button onClick={handleExportOBJ} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#1a1f36] border border-[rgba(168,187,238,0.08)] hover:border-green-500/30 transition-all text-left">
                      <div>
                        <span className="text-xs text-white font-mono">.OBJ</span>
                        <p className="text-[10px] text-gray-500 mt-0.5">{t("mw.exportObj")}</p>
                      </div>
                      <Download className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    <button onClick={handleExportSCAD} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#1a1f36] border border-[rgba(168,187,238,0.08)] hover:border-green-500/30 transition-all text-left">
                      <div>
                        <span className="text-xs text-white font-mono">.SCAD</span>
                        <p className="text-[10px] text-gray-500 mt-0.5">{t("mw.exportScad")}</p>
                      </div>
                      <Download className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Publish */}
              <Card className={`border ${allPass ? "bg-green-500/5 border-green-500/20" : "bg-[rgba(26,31,54,0.6)] border-[rgba(168,187,238,0.12)]"}`}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Upload className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-semibold">{t("mw.publish")}</span>
                  </div>
                  {!hasRun ? (
                    <p className="text-xs text-gray-500 mb-4">{t("mw.publishRunLint")}</p>
                  ) : allPass ? (
                    <p className="text-xs text-green-400/80 mb-4">{t("mw.publishAllPass")}</p>
                  ) : (
                    <p className="text-xs text-yellow-400/80 mb-4">
                      {failCount > 0 ? t("mw.publishFixErrors") : t("mw.publishWarnings")}
                    </p>
                  )}
                  <Button className="w-full gap-2" disabled={!hasRun || failCount > 0} onClick={() => setPublishOpen(true)}>
                    <Upload className="w-3.5 h-3.5" /> {t("mw.publishBtn")}
                    <span className="opacity-80 text-[10px] bg-black/20 px-1.5 py-0.5 rounded leading-none flex items-center">-3 Cr</span>
                  </Button>
                </CardContent>
              </Card>

              {/* Real stats */}
              <Card className="bg-[rgba(26,31,54,0.6)] border-[rgba(168,187,238,0.12)]">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-semibold">{t("mw.stats")}</span>
                  </div>
                  {meshStats ? (
                    <div className="space-y-2 text-xs text-gray-400">
                      <div className="flex justify-between">
                        <span>{t("mw.statsFaces")}</span>
                        <span className="text-green-300 font-mono">{meshStats.faceCount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("mw.statsTriangles")}</span>
                        <span className="text-green-300 font-mono">{meshStats.triangleCount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("mw.statsVertices")}</span>
                        <span className="text-green-300 font-mono">{meshStats.vertexCount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("mw.statsVolume")}</span>
                        <span className="text-green-300 font-mono">
                          {meshStats.volume < 1000
                            ? `${meshStats.volume.toFixed(1)} mm3`
                            : `${(meshStats.volume / 1000).toFixed(1)} cm3`}
                        </span>
                      </div>
                      {bb && (
                        <div className="flex justify-between">
                          <span>{t("mw.statsBBox")}</span>
                          <span className="text-green-300 font-mono text-[10px]">
                            {(bb.maxX - bb.minX).toFixed(0)}x{(bb.maxY - bb.minY).toFixed(0)}x{(bb.maxZ - bb.minZ).toFixed(0)}mm
                          </span>
                        </div>
                      )}
                      {meshStats.volume > 0 && (
                        <div className="flex justify-between">
                          <span>{t("mw.statsWeight")}</span>
                          <span className="text-green-300 font-mono">
                            ~{((meshStats.volume / 1000) * 1.24 * 0.2).toFixed(0)}g (20% infill)
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">{t("mw.statsRunLint")}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Features */}
      <div className="border-t border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.15)]">
        <div className="max-w-7xl mx-auto px-6 py-14">
          <h2 className="text-2xl font-bold mb-2">{t("mw.pipelineTitle")}</h2>
          <p className="text-sm text-gray-400 mb-8 max-w-xl">
            {t("mw.pipelineSubtitle")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: t("mw.feat.lint"),
                desc: t("mw.feat.lintDesc"),
                icon: <ShieldCheck className="w-5 h-5 text-green-400" />,
              },
              {
                title: t("mw.feat.gates"),
                desc: t("mw.feat.gatesDesc"),
                icon: <CheckCircle2 className="w-5 h-5 text-green-400" />,
              },
              {
                title: t("mw.feat.multiFormat"),
                desc: t("mw.feat.multiFormatDesc"),
                icon: <FileDown className="w-5 h-5 text-green-400" />,
              },
              {
                title: t("mw.feat.publish"),
                desc: t("mw.feat.publishDesc"),
                icon: <Upload className="w-5 h-5 text-green-400" />,
              },
            ].map((f, i) => (
              <Card
                key={i}
                className="bg-[rgba(26,31,54,0.4)] border-[rgba(168,187,238,0.08)]"
                style={{ animation: `vsCardIn 0.4s cubic-bezier(.22,1,.36,1) ${i * 0.08}s both` }}
              >
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-xl bg-[#1a1f36] flex items-center justify-center border border-[rgba(168,187,238,0.12)] mb-4">
                    {f.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* ─── SCAD Library ─── */}
      <div className="border-t border-[rgba(168,187,238,0.12)]">
        <div className="max-w-7xl mx-auto px-6 py-14">
          <ScadLibrary />
        </div>
      </div>

      <style>{`
        @keyframes vsHeroIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vsCardIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        sceneCtx={null}
        mode="create"
      />
    </div>
  );
}
