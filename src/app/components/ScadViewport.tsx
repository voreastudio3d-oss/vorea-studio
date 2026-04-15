/**
 * ScadViewport – React wrapper for the CSG mesh renderer.
 * Uses Three.js WebGL for high-quality rendering.
 * Uses a Web Worker for off-main-thread compilation (with fallback).
 * Includes complexity estimation and manual/auto compile modes.
 */

import { useRef, useEffect, useCallback, useState, useMemo, forwardRef, useImperativeHandle } from "react";
import { compileScad } from "../engine/scad-interpreter";
import { regenerateScad } from "../services/scad-parser";
import { registerSvg, clearSvgs } from "../engine/svg-registry";
import { registerImageData, clearImages as clearImageRegistry } from "../engine/image-registry";
import { estimateComplexity, complexityColor, type ComplexityEstimate } from "../engine/complexity";
import {
  deserializeToRenderable,
  type SerializedMesh,
  type SerializedImage,
  type WorkerCompileRequest,
  type WorkerCompileResponse,
  type RenderableMesh,
} from "../engine/mesh-data";
import {
  initScene,
  updateMesh,
  resizeScene,
  disposeScene,
  setGridVisible,
  setAxesVisible,
  setCameraPreset,
  resetView,
  getFaceCount,
  handleClick,
  selectMesh,
  deselectMesh,
  setTransformMode,
  getTransformMode,
  type ThreeSceneContext,
  type RenderMode,
  type TransformMode,
} from "../engine/threejs-renderer";
import { CompilationLogService, copyToClipboard } from "../services/compilation-log";
import { Badge } from "./ui/badge";
import {
  Grid3x3,
  Box,
  Eye,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Cpu,
  Play,
  RefreshCw,
  Zap,
  Gauge,
  Copy,
  CheckCircle2,
  Axis3D,
  Move,
  RotateCw,
  Maximize2,
  MousePointerClick,
} from "lucide-react";

interface ScadViewportProps {
  /** Original SCAD source */
  source: string;
  /** Current parameter values (overrides) */
  values: Record<string, number | boolean | string | number[]>;
  /** Auto-compile on mount? (default false) */
  autoCompile?: boolean;
  /** Callback with serialized mesh (for GCode generation) */
  onMeshReady?: (mesh: SerializedMesh | null) => void;
  /** SVG files keyed by filename for import() support */
  svgs?: Record<string, string>;
  /** Serialized image data keyed by filename for surface() support */
  images?: Record<string, SerializedImage>;
}

export interface ScadViewportHandle {
  getSceneCtx(): ThreeSceneContext | null;
}

// ─── Worker singleton ─────────────────────────────────────────────────────────

let workerInstance: Worker | null = null;
let workerFailed = false;

function getWorker(): Worker | null {
  if (workerFailed) return null;
  if (workerInstance) return workerInstance;
  try {
    workerInstance = new Worker(
      new URL("../engine/csg-worker.ts", import.meta.url),
      { type: "module" }
    );
    // Test that the worker loaded
    workerInstance.onerror = () => {
      workerFailed = true;
      workerInstance = null;
    };
    return workerInstance;
  } catch {
    workerFailed = true;
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

let compileIdCounter = 0;

export const ScadViewport = forwardRef<ScadViewportHandle, ScadViewportProps>(function ScadViewport({
  source,
  values,
  autoCompile = false,
  onMeshReady,
  svgs,
  images,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ThreeSceneContext | null>(null);
  const meshRef = useRef<RenderableMesh | null>(null);

  // Expose scene ctx to parent
  useImperativeHandle(ref, () => ({
    getSceneCtx: () => sceneRef.current,
  }));

  const [hasCompiled, setHasCompiled] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compileTime, setCompileTime] = useState(0);
  const [faceCount, setFaceCount] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [stale, setStale] = useState(false);
  const [autoRecompile, setAutoRecompile] = useState(false);
  const [usedWorker, setUsedWorker] = useState(false);
  const [errorCopied, setErrorCopied] = useState(false);
  const [renderMode, setRenderMode] = useState<RenderMode>("smooth");
  const [transformMode, setTransformModeState] = useState<TransformMode | null>(null);
  const autoRef = useRef(false);
  autoRef.current = autoRecompile;
  const lastFingerprintRef = useRef<string>("");
  const activeCompileId = useRef(0);

  // ─── Complexity estimate ──────────────────────────────────────────
  const complexity: ComplexityEstimate = useMemo(
    () => estimateComplexity(source, values),
    [source, values]
  );

  // ─── Initialize Three.js Scene ─────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ctx = initScene(container);
    sceneRef.current = ctx;

    return () => {
      disposeScene(ctx);
      sceneRef.current = null;
    };
  }, []);

  // ─── Click-to-select handler ──────────────────────────────────────
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;

    let downPos: { x: number; y: number } | null = null;

    const onPointerDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!downPos) return;
      // Only treat as click if pointer didn't move much (ignore drags)
      const dx = e.clientX - downPos.x;
      const dy = e.clientY - downPos.y;
      if (dx * dx + dy * dy > 9) return; // 3px threshold

      const selected = handleClick(ctx, e as unknown as MouseEvent);
      setTransformModeState(selected ? (getTransformMode(ctx) || "translate") : null);
    };

    const dom = ctx.renderer.domElement;
    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointerup", onPointerUp);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  // ─── Resize handler ───────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const ctx = sceneRef.current;
    if (!container || !ctx) return;

    const resize = () => {
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 600;
      if (w > 0 && h > 0) {
        resizeScene(ctx, w, h);
      }
    };

    resize();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(resize);
      ro.observe(container);
      return () => ro.disconnect();
    }
  }, []);

  // ─── Re-render with current mesh when mode/grid/axes changes ──────
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    setGridVisible(ctx, showGrid);
  }, [showGrid]);

  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    setAxesVisible(ctx, showAxes);
  }, [showAxes]);

  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx || !meshRef.current) return;
    updateMesh(ctx, meshRef.current as any, renderMode);
  }, [renderMode]);

  // ─── Render helper (update Three.js scene with mesh) ──────────────
  const renderMeshToScene = useCallback((mesh: RenderableMesh, autoCenter: boolean = false) => {
    const ctx = sceneRef.current;
    if (!ctx) return;
    updateMesh(ctx, mesh as any, renderMode, autoCenter);
  }, [renderMode]);

  // ─── Compile via Worker (off main thread) ─────────────────────────
  const compileWithWorker = useCallback((worker: Worker): Promise<void> => {
    return new Promise((resolve) => {
      const id = ++compileIdCounter;
      activeCompileId.current = id;

      const msg: WorkerCompileRequest = {
        type: "compile",
        id,
        source,
        values,
        svgs,
        images,
      };

      const handler = (e: MessageEvent<WorkerCompileResponse>) => {
        if (e.data.type !== "result" || e.data.id !== id) return;
        worker.removeEventListener("message", handler);

        // Stale result? Ignore.
        if (activeCompileId.current !== id) { resolve(); return; }

        if (e.data.mesh) {
          const renderable = deserializeToRenderable(e.data.mesh);
          meshRef.current = renderable;
          setFaceCount(e.data.faceCount);
          onMeshReady?.(e.data.mesh);
          renderMeshToScene(renderable, !hasCompiled);
        }
        setCompileTime(Math.round(e.data.time));
        setError(e.data.error || null);
        setHasCompiled(true);
        setStale(false);
        setUsedWorker(true);
        lastFingerprintRef.current = JSON.stringify({ source, values });
        setCompiling(false);

        // ─── Log result ─────────────────────────────────────────────
        if (e.data.error) {
          CompilationLogService.logError(e.data.error, {
            phase: "compile",
            source: source.slice(0, 500),
            duration: Math.round(e.data.time),
          });
        } else if (e.data.mesh) {
          CompilationLogService.logSuccess(
            "worker-compile",
            Math.round(e.data.time),
            e.data.faceCount,
            source.slice(0, 200)
          );
        }

        resolve();
      };

      worker.addEventListener("message", handler);
      worker.postMessage(msg);
    });
  }, [source, values, svgs, renderMeshToScene, onMeshReady]);

  // ─── Compile fallback (main thread, setTimeout) ───────────────────
  const compileMainThread = useCallback(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          // Sync SVG registry for main-thread compilation
          if (svgs) {
            clearSvgs();
            for (const [name, text] of Object.entries(svgs)) {
              registerSvg(name, text);
            }
          }

          // Sync image registry for main-thread compilation
          if (images) {
            clearImageRegistry();
            for (const [name, img] of Object.entries(images)) {
              registerImageData(name, {
                width: img.width,
                height: img.height,
                data: new Uint8ClampedArray(img.data),
              });
            }
          }

          const updatedSource = regenerateScad(source, values);
          const result = compileScad(updatedSource, values);
          const polys = result.geometry.toPolygons();

          // Create a renderable + serialized mesh
          meshRef.current = result.geometry as any;
          setCompileTime(Math.round(result.time));
          setFaceCount(polys.length);
          setHasCompiled(true);
          setStale(false);
          setUsedWorker(false);
          lastFingerprintRef.current = JSON.stringify({ source, values });

          // Update Three.js scene
          renderMeshToScene(result.geometry as any, !hasCompiled);

          // Serialize for GCode panel
          if (onMeshReady) {
            const serialized = {
              polygons: polys.map(p => ({
                vertices: p.vertices.map((v: any) => ({
                  px: v.pos.x, py: v.pos.y, pz: v.pos.z,
                  nx: v.normal.x, ny: v.normal.y, nz: v.normal.z,
                })),
                planeNx: p.plane.normal.x,
                planeNy: p.plane.normal.y,
                planeNz: p.plane.normal.z,
                planeW: p.plane.w,
              })),
              faceCount: polys.length,
            };
            onMeshReady(serialized);
          }

          // ─── Log main-thread result ─────────────────────────────────
          if (result.error) {
            setError(result.error);
            CompilationLogService.logError(result.error, {
              phase: "compile",
              source: source.slice(0, 500),
              duration: Math.round(result.time),
            });
          } else {
            CompilationLogService.logSuccess(
              "main-thread",
              Math.round(result.time),
              polys.length,
              source.slice(0, 200)
            );
          }
        } catch (e: any) {
          const errMsg = e?.message || "Error de compilacion";
          setError(errMsg);
          CompilationLogService.logError(errMsg, {
            phase: "compile",
            details: e?.stack?.slice(0, 500),
            source: source.slice(0, 500),
          });
        }
        setCompiling(false);
      }, 20);
    });
  }, [source, values, svgs, images, renderMeshToScene, onMeshReady]);

  // ─── Unified compile ──────────────────────────────────────────────
  const compile = useCallback(() => {
    setCompiling(true);
    setError(null);

    const worker = getWorker();
    if (worker) {
      compileWithWorker(worker);
    } else {
      compileMainThread();
    }
  }, [compileWithWorker, compileMainThread]);

  // ─── Detect staleness ─────────────────────────────────────────────
  useEffect(() => {
    const fp = JSON.stringify({ source, values });
    if (lastFingerprintRef.current && fp !== lastFingerprintRef.current) {
      setStale(true);
      if (autoRef.current && !compiling) {
        const timer = setTimeout(compile, 400);
        return () => clearTimeout(timer);
      }
    }
  }, [source, values, compile, compiling]);

  // ─── Auto-compile on mount (opt-in) ───────────────────────────────
  const didAutoCompile = useRef(false);
  useEffect(() => {
    if (autoCompile && !didAutoCompile.current) {
      didAutoCompile.current = true;
      compile();
    }
  }, [autoCompile, compile]);

  // ─── Reset when source changes completely ─────────────────────────
  const prevSourceRef = useRef(source);
  useEffect(() => {
    if (source !== prevSourceRef.current) {
      prevSourceRef.current = source;
      meshRef.current = null;
      setHasCompiled(false);
      setStale(false);
      setError(null);
      setFaceCount(0);
      setCompileTime(0);
      lastFingerprintRef.current = "";
      didAutoCompile.current = false;
      onMeshReady?.(null);
      // Clear Three.js mesh
      const ctx = sceneRef.current;
      if (ctx) {
        while (ctx.meshGroup.children.length > 0) {
          ctx.meshGroup.remove(ctx.meshGroup.children[0]);
        }
      }
    }
  }, [source, onMeshReady]);

  // ─── Cycle render mode ─────────────────────────────────────────────
  const cycleRenderMode = useCallback(() => {
    setRenderMode(prev => {
      const modes: RenderMode[] = ["smooth", "faceted", "wireframe"];
      return modes[(modes.indexOf(prev) + 1) % modes.length];
    });
  }, []);

  const renderModeLabel = renderMode === "smooth" ? "Suavizado" : renderMode === "faceted" ? "Facetado" : "Alambre";

  // ─── Toggle auto-recompile with recommendation check ──────────────
  const toggleAutoRecompile = useCallback(() => {
    setAutoRecompile(prev => !prev);
  }, []);

  const showIdleOverlay = !hasCompiled && !compiling;
  const cColor = complexityColor(complexity.level);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Three.js renderer attaches its own canvas to this div */}

      {/* ─── Idle overlay ──────────────────────────────────────────────── */}
      {showIdleOverlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0f1320]/95 z-10">
          <div className="w-16 h-16 rounded-2xl bg-[#C6E36C]/10 border border-[#C6E36C]/20 flex items-center justify-center">
            <Box className="w-8 h-8 text-[#C6E36C]/60" />
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-1">Modelo SCAD listo</p>
            <p className="text-[11px] text-gray-600 max-w-52 mb-2">
              La compilacion CSG puede tomar varios segundos dependiendo de la complejidad
            </p>
            {/* Complexity indicator */}
            <div className="flex items-center justify-center gap-2">
              <Gauge className="w-3.5 h-3.5" style={{ color: cColor }} />
              <span className="text-[10px]" style={{ color: cColor }}>
                Complejidad: {complexity.level === "light" ? "Ligera" : complexity.level === "medium" ? "Media" : "Alta"}
                {complexity.estimatedMs > 1000 && ` (~${(complexity.estimatedMs / 1000).toFixed(1)}s)`}
              </span>
            </div>
            {complexity.warning && (
              <p className="text-[9px] text-amber-500/70 mt-1">{complexity.warning}</p>
            )}
          </div>
          <button
            onClick={compile}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C6E36C] text-[#0d1117] text-sm hover:bg-[#d4ed7a] transition-colors"
          >
            <Play className="w-4 h-4" />
            Compilar modelo
          </button>
        </div>
      )}

      {/* ─── Compiling overlay ─────────────────────────────────────────── */}
      {compiling && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0f1320]/80 backdrop-blur-sm z-10">
          <Loader2 className="w-8 h-8 text-[#C6E36C] animate-spin" />
          <p className="text-sm text-gray-400">Compilando geometria CSG...</p>
          <p className="text-[10px] text-gray-600">
            {getWorker() ? "Web Worker activo (UI no bloqueada)" : "Procesando en hilo principal"}
          </p>
        </div>
      )}

      {/* ─── Status badges ─────────────────────────────────────────────── */}
      {hasCompiled && !compiling && (
        <div className="absolute top-14 left-3 flex gap-2 flex-wrap z-10">
          <Badge className="bg-[#1a1f36]/90 backdrop-blur text-gray-300 border-[rgba(168,187,238,0.12)]">
            <Eye className="w-3 h-3 mr-1.5" /> WebGL Render
          </Badge>
          {usedWorker && (
            <Badge className="bg-green-500/15 text-green-400/80 border-green-500/20 backdrop-blur text-[9px]">
              Worker
            </Badge>
          )}
          {stale && (
            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 backdrop-blur">
              <RefreshCw className="w-3 h-3 mr-1.5" /> Desactualizado
            </Badge>
          )}
          {error && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 backdrop-blur">
              <AlertTriangle className="w-3 h-3 mr-1.5" /> Error
            </Badge>
          )}
        </div>
      )}

      {/* ─── Compile info ──────────────────────────────────────────────── */}
      {hasCompiled && !compiling && (
        <div className="absolute bottom-12 left-3 flex gap-2 flex-wrap z-10">
          <Badge className="bg-[#1a1f36]/90 backdrop-blur text-gray-500 border-[rgba(168,187,238,0.08)] text-[9px]">
            <Cpu className="w-3 h-3 mr-1" /> {compileTime}ms · {faceCount} faces
          </Badge>
          <Badge
            className="backdrop-blur border text-[9px]"
            style={{
              backgroundColor: `${cColor}15`,
              color: cColor,
              borderColor: `${cColor}30`,
            }}
          >
            <Gauge className="w-3 h-3 mr-1" />
            {complexity.level === "light" ? "Ligero" : complexity.level === "medium" ? "Medio" : "Pesado"}
          </Badge>
        </div>
      )}

      {/* ─── Re-compile button ─────────────────────────────────────────── */}
      {stale && !compiling && hasCompiled && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          <button
            onClick={compile}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#C6E36C] text-[#0d1117] text-xs hover:bg-[#d4ed7a] transition-colors shadow-lg shadow-black/30"
          >
            <RefreshCw className="w-3 h-3" />
            Re-compilar
          </button>
        </div>
      )}

      {/* ─── Controls ──────────────────────────────────────────────────── */}
      {hasCompiled && !compiling && (
        <div className="absolute top-14 right-3 flex flex-col gap-1.5 z-10">
          {/* ─── Render mode cycle ───────────────────────────────────── */}
          <button
            onClick={cycleRenderMode}
            className="h-7 px-2 rounded-lg bg-[#C6E36C]/15 text-[#C6E36C] border border-[#C6E36C]/25 flex items-center justify-center gap-1 transition-colors hover:bg-[#C6E36C]/25 text-[9px] font-semibold min-w-[28px]"
            title={`Modo: ${renderModeLabel} (click para cambiar)`}
          >
            <Box className="w-3 h-3" />
            <span className="hidden sm:inline">{renderModeLabel}</span>
          </button>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              showGrid
                ? "bg-[#C6E36C]/20 text-[#C6E36C] border border-[#C6E36C]/30"
                : "bg-[#1a1f36]/90 text-gray-500 border border-[rgba(168,187,238,0.12)]"
            }`}
            title="Grid"
          >
            <Grid3x3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowAxes(!showAxes)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              showAxes
                ? "bg-[#C6E36C]/20 text-[#C6E36C] border border-[#C6E36C]/30"
                : "bg-[#1a1f36]/90 text-gray-500 border border-[rgba(168,187,238,0.12)]"
            }`}
            title="Ejes"
          >
            <Axis3D className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { const ctx = sceneRef.current; if (ctx) resetView(ctx); }}
            className="w-7 h-7 rounded-lg bg-[#1a1f36]/90 text-gray-500 border border-[rgba(168,187,238,0.12)] flex items-center justify-center hover:text-gray-300 transition-colors"
            title="Reset vista"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <div className="w-7 h-px" />
          {/* ─── View presets ─────────────────────────────────────────── */}
          <button
            onClick={() => { const ctx = sceneRef.current; if (ctx) setCameraPreset(ctx, "top"); }}
            className="w-7 h-7 rounded-lg bg-[#1a1f36]/90 text-gray-500 border border-[rgba(168,187,238,0.12)] flex items-center justify-center hover:text-[#C6E36C] hover:border-[#C6E36C]/30 transition-colors text-[9px] font-bold"
            title="Vista superior"
          >
            S
          </button>
          <button
            onClick={() => { const ctx = sceneRef.current; if (ctx) setCameraPreset(ctx, "front"); }}
            className="w-7 h-7 rounded-lg bg-[#1a1f36]/90 text-gray-500 border border-[rgba(168,187,238,0.12)] flex items-center justify-center hover:text-[#C6E36C] hover:border-[#C6E36C]/30 transition-colors text-[9px] font-bold"
            title="Vista frontal"
          >
            F
          </button>
          <button
            onClick={() => { const ctx = sceneRef.current; if (ctx) setCameraPreset(ctx, "side"); }}
            className="w-7 h-7 rounded-lg bg-[#1a1f36]/90 text-gray-500 border border-[rgba(168,187,238,0.12)] flex items-center justify-center hover:text-[#C6E36C] hover:border-[#C6E36C]/30 transition-colors text-[9px] font-bold"
            title="Vista lateral"
          >
            L
          </button>
          <div className="w-7 h-px" />
          <button
            onClick={toggleAutoRecompile}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              autoRecompile
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "bg-[#1a1f36]/90 text-gray-500 border border-[rgba(168,187,238,0.12)]"
            }`}
            title={
              autoRecompile
                ? "Auto-recompilacion ON"
                : complexity.autoRecompileRecommended
                  ? "Activar auto-recompilacion"
                  : "Auto-recompilacion no recomendada (modelo complejo)"
            }
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
          <div className="w-7 h-px" />
          {/* ─── Transform mode buttons ──────────────────────────────── */}
          {(["translate", "rotate", "scale"] as TransformMode[]).map((mode) => {
            const Icon = mode === "translate" ? Move : mode === "rotate" ? RotateCw : Maximize2;
            const label = mode === "translate" ? "Mover" : mode === "rotate" ? "Rotar" : "Escalar";
            const active = transformMode === mode;
            return (
              <button
                key={mode}
                onClick={() => {
                  const ctx = sceneRef.current;
                  if (!ctx) return;
                  if (active) {
                    // Deselect
                    deselectMesh(ctx);
                    setTransformModeState(null);
                  } else {
                    // Set mode; auto-select if mesh exists
                    setTransformMode(ctx, mode);
                    setTransformModeState(mode);
                    if (!ctx.selectedMesh && ctx.meshGroup.children.length > 0) {
                      const firstMesh = ctx.meshGroup.children.find(
                        (c) => (c as any).isMesh
                      );
                      if (firstMesh) {
                        selectMesh(ctx, firstMesh as any);
                      }
                    }
                  }
                }}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  active
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    : "bg-[#1a1f36]/90 text-gray-500 border border-[rgba(168,187,238,0.12)] hover:text-gray-300"
                }`}
                title={label}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Help text ─────────────────────────────────────────────────── */}
      {hasCompiled && !compiling && (
        <div className="absolute bottom-12 right-3 text-[9px] text-gray-600 select-none z-10">
          Orbitar · Click derecho pan · Scroll zoom · Click seleccionar
        </div>
      )}

      {/* ─── Error detail ──────────────────────────────────────────────── */}
      {error && !compiling && (
        <div className="absolute inset-x-3 bottom-20 bg-red-500/10 border border-red-500/20 rounded-lg p-3 pr-8 backdrop-blur z-10">
          <p className="text-xs text-red-400 font-mono truncate" title={error}>{error}</p>
          <button
            onClick={() => {
              copyToClipboard(error);
              setErrorCopied(true);
              setTimeout(() => setErrorCopied(false), 2000);
            }}
            className="absolute top-2 right-2 w-6 h-6 rounded flex items-center justify-center hover:bg-red-500/20 transition-colors"
            title="Copiar error"
          >
            {errorCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-red-400" />}
          </button>
        </div>
      )}
    </div>
  );
});