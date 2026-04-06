/**
 * Organic – Deformation tools that generate SCAD code and show 2D + 3D preview.
 * Connects to ModelContext: generates organic SCAD and pushes to Editor.
 * Includes inline ScadViewport for real-time 3D CSG rendering.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { useNavigate } from "../nav";
import { useModel } from "../services/model-context";
import { useAuth } from "../services/auth-context";
import { useI18n } from "../services/i18n-context";
import { AuthDialog } from "../components/AuthDialog";
import { ScadViewport } from "../components/ScadViewport";
import { consumeProtectedToolAction } from "../services/protected-tool-actions";
import { trackAnalyticsEvent } from "../services/analytics";
import { toast } from "sonner";
import {
  Waves,
  Play,
  ArrowRight,
  Image,
  Hexagon,
  Paintbrush,
  Maximize,
  Sliders,
  RotateCcw,
  ExternalLink,
  Code2,
  ChevronDown,
  ChevronUp,
  Box,
  Eye,
  Mountain,
} from "lucide-react";

// ─── Deformation modes ────────────────────────────────────────────────────────

const MODES = [
  { id: "voronoi", name: "Voronoi", icon: <Hexagon className="w-4 h-4" /> },
  { id: "relief", name: "Relieve", icon: <Image className="w-4 h-4" /> },
  { id: "svgwrap", name: "SVG Wrap", icon: <Paintbrush className="w-4 h-4" /> },
] as const;

type ModeId = (typeof MODES)[number]["id"];

interface DeformParams {
  voronoi: { cells: number; depth: number; jitter: number; seed: number; height: number; radius: number };
  relief: { intensity: number; blur: number; invert: number; radius: number; height: number };
  svgwrap: { scale: number; depth: number; smooth: number; radius: number; sides: number };
}

const DEFAULT_PARAMS: DeformParams = {
  voronoi: { cells: 24, depth: 4, jitter: 80, seed: 42, height: 60, radius: 30 },
  relief: { intensity: 5, blur: 2, invert: 0, radius: 35, height: 40 },
  svgwrap: { scale: 100, depth: 3, smooth: 50, radius: 30, sides: 6 },
};

const PARAM_META: Record<ModeId, Array<{ key: string; label: string; min: number; max: number; step: number }>> = {
  voronoi: [
    { key: "cells", label: "Celdas", min: 4, max: 80, step: 1 },
    { key: "depth", label: "Profundidad", min: 0.5, max: 12, step: 0.5 },
    { key: "jitter", label: "Aleatoriedad %", min: 0, max: 100, step: 1 },
    { key: "seed", label: "Semilla", min: 1, max: 999, step: 1 },
    { key: "radius", label: "Radio", min: 10, max: 60, step: 1 },
    { key: "height", label: "Altura", min: 20, max: 120, step: 5 },
  ],
  relief: [
    { key: "intensity", label: "Intensidad", min: 0, max: 15, step: 0.5 },
    { key: "blur", label: "Suavizado", min: 0, max: 10, step: 0.5 },
    { key: "invert", label: "Invertir", min: 0, max: 1, step: 1 },
    { key: "radius", label: "Radio", min: 10, max: 60, step: 1 },
    { key: "height", label: "Altura", min: 10, max: 80, step: 5 },
  ],
  svgwrap: [
    { key: "scale", label: "Escala %", min: 10, max: 200, step: 5 },
    { key: "depth", label: "Profundidad", min: 0.5, max: 10, step: 0.5 },
    { key: "smooth", label: "Suavizado %", min: 0, max: 100, step: 5 },
    { key: "radius", label: "Radio", min: 10, max: 60, step: 1 },
    { key: "sides", label: "Lados", min: 3, max: 12, step: 1 },
  ],
};

// ─── SCAD generators ──────────────────────────────────────────────────────────

function generateVoronoiSCAD(p: DeformParams["voronoi"]): string {
  return `// Voronoi Organico – Vorea Studio
$fn = 32;

// Parametros generados
cells = ${p.cells};       // [4:1:80] Numero de celdas
depth = ${p.depth};       // [0.5:0.5:12] Profundidad corte
jitter = ${p.jitter};     // [0:1:100] Aleatoriedad
seed = ${p.seed};         // [1:1:999] Semilla
radius = ${p.radius};     // [10:1:60] Radio
height = ${p.height};     // [20:5:120] Altura
wall = 2;                 // [1:0.5:5] Grosor pared

// Cuerpo base cilindrico con pared
difference() {
  cylinder(r = radius, h = height);
  translate([0, 0, wall])
    cylinder(r = radius - wall, h = height);

  // Patron Voronoi via cortes cilindricos distribuidos
  for (i = [0 : cells - 1]) {
    angle = i * 360 / cells + sin(i * seed) * jitter * 0.3;
    z_pos = wall + 5 + (height - wall - 10) * ((i * seed * 7) % 100) / 100;
    rotate([0, 0, angle])
      translate([radius - depth/2, 0, z_pos])
        rotate([0, 90, 0])
          cylinder(r = depth, h = depth * 2, center=true);
  }
}`;
}

function generateReliefSCAD(p: DeformParams["relief"]): string {
  return `// Relieve Ondulado – Vorea Studio
$fn = 48;

// Parametros generados
intensity = ${p.intensity};  // [0:0.5:15] Intensidad del relieve
blur = ${p.blur};            // [0:0.5:10] Suavizado
radius = ${p.radius};        // [10:1:60] Radio base
height = ${p.height};        // [10:5:80] Altura
waves = 8;                   // [2:1:20] Numero de ondas
wall = 2;                    // [1:0.5:5] Grosor pared
invert = ${p.invert};        // [0:1:1] Invertir

// Superficie con relieve senoidal
difference() {
  // Exterior con ondulacion
  union() {
    for (z = [0 : 1 : height]) {
      wave = sin(z * 360 / height * waves) * intensity / (1 + blur * 0.3);
      r_actual = invert ? radius - wave : radius + wave;
      translate([0, 0, z])
        cylinder(r = r_actual, h = 1.01);
    }
  }
  // Interior
  translate([0, 0, wall])
    cylinder(r = radius - wall - intensity, h = height + 1);
}`;
}

function generateSvgWrapSCAD(p: DeformParams["svgwrap"]): string {
  return `// SVG Wrap Geometrico – Vorea Studio
$fn = 48;

// Parametros generados
scale_pct = ${p.scale};  // [10:5:200] Escala
depth = ${p.depth};       // [0.5:0.5:10] Profundidad patron
smooth = ${p.smooth};     // [0:5:100] Suavizado
radius = ${p.radius};     // [10:1:60] Radio
sides = ${p.sides};       // [3:1:12] Lados del poligono
height = 50;              // [20:5:100] Altura
pattern_repeat = 6;       // [2:1:12] Repeticiones patron

// Cuerpo base poligonal
difference() {
  // Forma base
  linear_extrude(height = height, twist = smooth * 0.3, slices = 20)
    circle(r = radius * scale_pct / 100, $fn = sides);

  // Patron de cortes envolventes
  for (i = [0 : pattern_repeat - 1]) {
    angle = i * 360 / pattern_repeat;
    for (z = [10 : 12 : height - 5]) {
      rotate([0, 0, angle + z * smooth * 0.02])
        translate([radius * scale_pct / 100 - depth/2, 0, z])
          cube([depth * 2, depth * 3, depth * 2], center=true);
    }
  }

  // Hueco interior
  translate([0, 0, 2])
    linear_extrude(height = height, twist = smooth * 0.3, slices = 20)
      circle(r = radius * scale_pct / 100 - 3, $fn = sides);
}`;
}

// ─── Canvas preview ───────────────────────────────────────────────────────────

function OrganicPreview({ mode, params }: { mode: ModeId; params: DeformParams }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0f1320";
    ctx.fillRect(0, 0, w, h);

    if (mode === "voronoi") {
      const { cells, depth, jitter, seed } = params.voronoi;
      let s = seed;
      const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
      const pts: [number, number][] = [];
      const cols = Math.ceil(Math.sqrt(cells));
      const rows = Math.ceil(cells / cols);
      const cw = w / cols, ch = h / rows;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const jf = jitter / 100;
          pts.push([cw * (c + 0.5 + (rand() - 0.5) * jf), ch * (r + 0.5 + (rand() - 0.5) * jf)]);
        }
      const imgData = ctx.createImageData(w, h);
      for (let y = 0; y < h; y += 2)
        for (let x = 0; x < w; x += 2) {
          let minD = Infinity, minD2 = Infinity;
          for (const [px, py] of pts) {
            const d = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
            if (d < minD) { minD2 = minD; minD = d; } else if (d < minD2) minD2 = d;
          }
          const edge = Math.max(0, 1 - (minD2 - minD) / (depth * 4));
          for (let dy = 0; dy < 2 && y + dy < h; dy++)
            for (let dx = 0; dx < 2 && x + dx < w; dx++) {
              const i = ((y + dy) * w + (x + dx)) * 4;
              imgData.data[i] = Math.floor(edge * 198);
              imgData.data[i + 1] = Math.floor(edge * 227);
              imgData.data[i + 2] = Math.floor(edge * 50) + 108;
              imgData.data[i + 3] = Math.floor(edge * 180);
            }
        }
      ctx.putImageData(imgData, 0, 0);
      ctx.fillStyle = "#C6E36C";
      pts.forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill(); });
    } else if (mode === "relief") {
      const { intensity, blur } = params.relief;
      for (let y = 0; y < h; y += 3) {
        ctx.beginPath();
        for (let x = 0; x < w; x += 2) {
          const nx = x / w, ny = y / h;
          const val = Math.sin(nx * 12 + ny * 8) * 0.3 + Math.sin(nx * 25) * 0.2 + Math.cos(ny * 18 + nx * 5) * 0.25;
          const offset = val * intensity * 6;
          const yy = y + offset * (1 / (1 + blur * 0.3));
          x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
        }
        ctx.strokeStyle = `rgba(198,227,108,${0.1 + (y / h) * 0.5})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    } else {
      const { scale, depth: d, smooth } = params.svgwrap;
      const cx = w / 2, cy = h / 2;
      const baseR = Math.min(w, h) * 0.35 * (scale / 100);
      for (let ring = 1; ring <= 12; ring++) {
        const r = baseR * (ring / 12);
        ctx.beginPath();
        const pts = 60 + smooth;
        for (let i = 0; i <= pts; i++) {
          const a = (i / pts) * Math.PI * 2;
          const deform = Math.sin(a * 5) * d * 2 + Math.cos(a * 3) * d * 1.5;
          const px = cx + Math.cos(a) * (r + deform);
          const py = cy + Math.sin(a) * (r + deform);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(198,227,108,${0.15 + (ring / 12) * 0.55})`;
        ctx.lineWidth = ring === 12 ? 2 : 0.8;
        ctx.stroke();
      }
    }
  }, [mode, params]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    canvas.width = container.clientWidth || 600;
    canvas.height = container.clientHeight || 400;
    render();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      try {
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) { canvas.width = width; canvas.height = height; render(); }
      } catch {}
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [render]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Organic() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const modelCtx = useModel();
  const { isLoggedIn, refreshCredits } = useAuth();
  const [activeMode, setActiveMode] = useState<ModeId>("voronoi");
  const [params, setParams] = useState<DeformParams>({ ...DEFAULT_PARAMS });
  const [showCode, setShowCode] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<"2d" | "3d">("3d");

  const currentMeta = PARAM_META[activeMode];
  const currentValues = params[activeMode] as Record<string, number>;

  const handleParamChange = (key: string, value: number) => {
    setParams((prev) => ({ ...prev, [activeMode]: { ...prev[activeMode], [key]: value } }));
  };

  const handleReset = () => {
    setParams((prev) => ({ ...prev, [activeMode]: { ...DEFAULT_PARAMS[activeMode] } }));
  };

  // Generate SCAD for current mode
  const generatedSCAD =
    activeMode === "voronoi"
      ? generateVoronoiSCAD(params.voronoi)
      : activeMode === "relief"
      ? generateReliefSCAD(params.relief)
      : generateSvgWrapSCAD(params.svgwrap);

  const modeName = MODES.find((m) => m.id === activeMode)?.name ?? "";

  const handleSendToEditor = useCallback(async () => {
    const allowed = await consumeProtectedToolAction({
      isLoggedIn,
      toolId: "organic",
      actionId: "deform",
      onAuthRequired: () => setAuthOpen(true),
      authMessage: t("organic.authMessage", { defaultValue: "Inicia sesión para llevar una deformación orgánica al editor." }),
      onConsumed: refreshCredits,
    });
    if (!allowed) {
      return;
    }

    modelCtx.setScadSource(generatedSCAD, `Organico ${modeName}`);
    navigate("/studio");
    toast.success(t("organic.loadedInEditor", { name: modeName, defaultValue: `"Organico ${modeName}" cargado en el Editor` }));
    trackAnalyticsEvent("organic_deform", { tool: "organic", mode: activeMode });
  }, [generatedSCAD, isLoggedIn, modeName, modelCtx, navigate, refreshCredits, t]);

  // ─── Export current mode as heightmap for Relief ──────────────────────
  const handleSendToRelief = useCallback(() => {
    const SIZE = 512;
    const offscreen = document.createElement("canvas");
    offscreen.width = SIZE;
    offscreen.height = SIZE;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    const imgData = ctx.createImageData(SIZE, SIZE);

    if (activeMode === "voronoi") {
      // Voronoi distance field → grayscale
      const p = params.voronoi;
      let s = p.seed;
      const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
      const pts: [number, number][] = [];
      const cols = Math.ceil(Math.sqrt(p.cells));
      const rows = Math.ceil(p.cells / cols);
      const cw = SIZE / cols, ch = SIZE / rows;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const jf = p.jitter / 100;
          pts.push([cw * (c + 0.5 + (rand() - 0.5) * jf), ch * (r + 0.5 + (rand() - 0.5) * jf)]);
        }
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          let minD = Infinity, minD2 = Infinity;
          for (const [px, py] of pts) {
            const d = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
            if (d < minD) { minD2 = minD; minD = d; } else if (d < minD2) minD2 = d;
          }
          const edge = Math.min(1, (minD2 - minD) / (p.depth * 8));
          const gray = Math.floor(edge * 255);
          const i = (y * SIZE + x) * 4;
          imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = gray;
          imgData.data[i + 3] = 255;
        }
      }
    } else if (activeMode === "relief") {
      // Sinusoidal wave pattern → grayscale
      const p = params.relief;
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const nx = x / SIZE, ny = y / SIZE;
          const val = Math.sin(nx * 12 + ny * 8) * 0.3
            + Math.sin(nx * 25) * 0.2
            + Math.cos(ny * 18 + nx * 5) * 0.25;
          const norm = (val + 0.75) / 1.5; // normalize to 0..1
          const intensity = Math.min(1, Math.max(0, norm * (p.intensity / 8)));
          const gray = p.invert ? Math.floor((1 - intensity) * 255) : Math.floor(intensity * 255);
          const i = (y * SIZE + x) * 4;
          imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = gray;
          imgData.data[i + 3] = 255;
        }
      }
    } else {
      // SVG Wrap concentric rings → radial gradient heightmap
      const p = params.svgwrap;
      const cx = SIZE / 2, cy = SIZE / 2;
      const maxR = SIZE * 0.45 * (p.scale / 100);
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const dx = x - cx, dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          const deform = Math.sin(angle * 5) * p.depth * 3 + Math.cos(angle * 3) * p.depth * 2;
          const ringDist = (dist - deform) / maxR;
          // Create concentric ring heightmap
          const ringVal = Math.abs(Math.sin(ringDist * Math.PI * 6));
          const fade = dist < maxR ? 1 : Math.max(0, 1 - (dist - maxR) / 20);
          const gray = Math.floor(ringVal * fade * 255);
          const i = (y * SIZE + x) * 4;
          imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = gray;
          imgData.data[i + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const dataUrl = offscreen.toDataURL("image/png");
    sessionStorage.setItem("vorea_organic_heightmap", dataUrl);
    sessionStorage.setItem("vorea_organic_heightmap_mode", MODES.find(m => m.id === activeMode)?.name ?? activeMode);

    const modeLabel = MODES.find(m => m.id === activeMode)?.name ?? activeMode;
    toast.success(t("organic.sentToRelief", { defaultValue: `Patrón ${modeLabel} enviado al Relieve — abriendo...` }));
    navigate("/relief");
    trackAnalyticsEvent("organic_to_relief", { tool: "organic", mode: activeMode });
  }, [activeMode, params, navigate, t]);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-[rgba(168,187,238,0.12)]">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(ellipse at top right, rgba(59,130,246,0.08) 0%, transparent 60%), radial-gradient(ellipse at bottom left, rgba(198,227,108,0.06) 0%, transparent 60%), #0d1117" }} />
        <div className="max-w-7xl mx-auto px-6 py-14 md:py-20">
          <div className="flex items-center gap-3 mb-4" style={{ animation: "vsHeroIn 0.5s cubic-bezier(.22,1,.36,1) both" }}>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <Waves className="w-5 h-5 text-blue-400" />
            </div>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">{t("organic.engineBadge", { defaultValue: "ORGANIC ENGINE" })}</Badge>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3" style={{ background: "linear-gradient(135deg, #fff 30%, #60a5fa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "vsHeroIn 0.55s cubic-bezier(.22,1,.36,1) 0.05s both" }}>
            {t("organic.title", { defaultValue: "Deformacion Organica" })}
          </h1>
          <p className="text-base text-gray-400 max-w-2xl mb-6" style={{ animation: "vsHeroIn 0.55s cubic-bezier(.22,1,.36,1) 0.1s both" }}>
            {t("organic.subtitle", { defaultValue: "Genera patrones organicos parametricos: Voronoi, relieves ondulados y envolventes geometricas. Ajusta los parametros y envialos al Editor como codigo SCAD compilable." })}
          </p>
        </div>
      </div>

      {/* Interactive Demo */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-1">{t("organic.labTitle", { defaultValue: "Laboratorio de Deformaciones" })}</h2>
          <p className="text-sm text-gray-400">{t("organic.labSubtitle", { defaultValue: "Ajusta parametros, previsualiza el patron y envia al Editor" })}</p>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 mb-6">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveMode(m.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
                m.id === activeMode
                  ? "bg-blue-500/15 text-blue-400 border border-blue-500/40"
                  : "bg-[#1a1f36] text-gray-400 border border-[rgba(168,187,238,0.12)] hover:border-blue-500/30"
              }`}
            >
              {m.icon}
              {t(`organic.mode.${m.id}`, { defaultValue: m.name })}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Preview area with 2D/3D tabs */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Tab switcher */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewTab("3d")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                  previewTab === "3d"
                    ? "bg-[#C6E36C]/15 text-[#C6E36C] border border-[#C6E36C]/40"
                    : "bg-[#1a1f36] text-gray-400 border border-[rgba(168,187,238,0.12)] hover:border-[#C6E36C]/30"
                }`}
              >
                <Box className="w-3 h-3" /> 3D Preview
              </button>
              <button
                onClick={() => setPreviewTab("2d")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                  previewTab === "2d"
                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/40"
                    : "bg-[#1a1f36] text-gray-400 border border-[rgba(168,187,238,0.12)] hover:border-blue-500/30"
                }`}
              >
                <Eye className="w-3 h-3" /> 2D Patron
              </button>
            </div>

            {/* 3D Preview via ScadViewport */}
            {previewTab === "3d" && (
              <div className="rounded-2xl overflow-hidden border border-[rgba(168,187,238,0.12)] bg-[#0f1320] aspect-[16/10] relative">
                <ScadViewport
                  source={generatedSCAD}
                  values={{}}
                  autoCompile={true}
                />
              </div>
            )}

            {/* 2D Pattern Preview */}
            {previewTab === "2d" && (
              <div className="rounded-2xl overflow-hidden border border-[rgba(168,187,238,0.12)] bg-[#0f1320] aspect-[16/10] relative">
                <OrganicPreview mode={activeMode} params={params} />
                <div className="absolute top-3 left-3">
                  <Badge className="bg-[#1a1f36]/90 backdrop-blur text-gray-300 border-[rgba(168,187,238,0.12)]">
                    <Maximize className="w-3 h-3 mr-1.5" /> {modeName} {t("organic.preview", { defaultValue: "Preview" })}
                  </Badge>
                </div>
              </div>
            )}

            {/* Generated SCAD code */}
            <div className="rounded-xl border border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.6)] overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                onClick={() => setShowCode(!showCode)}
              >
                <div className="flex items-center gap-2">
                  <Code2 className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-semibold">{t("organic.scadCode", { defaultValue: "Codigo SCAD Generado" })}</span>
                  <span className="text-[9px] text-gray-500 bg-[#0d1117] px-1.5 py-0.5 rounded font-mono">
                    {generatedSCAD.split("\n").length}  {t("organic.lines", { defaultValue: "lineas" })}
                  </span>
                </div>
                {showCode ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
              </button>
              {showCode && (
                <div className="border-t border-[rgba(168,187,238,0.08)]">
                  <pre className="p-4 text-[10px] font-mono text-gray-400 overflow-x-auto leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {generatedSCAD}
                  </pre>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSendToEditor} className="gap-2">
                <ExternalLink className="w-4 h-4" />
                {t("organic.compileInEditor", { defaultValue: "Compilar en el Editor" })}
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleSendToRelief}
                variant="secondary"
                className="gap-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/15"
              >
                <Mountain className="w-4 h-4" />
                {t("organic.useAsRelief", { defaultValue: "Usar como Relieve" })}
              </Button>
            </div>
          </div>

          {/* Controls */}
          <Card className="bg-[rgba(26,31,54,0.6)] border-[rgba(168,187,238,0.12)]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-semibold">{t("organic.parametersTitle", { defaultValue: "Parametros" })}</span>
                </div>
                <button onClick={handleReset} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors">
                  <RotateCcw className="w-3 h-3" /> {t("organic.reset", { defaultValue: "Reset" })}
                </button>
              </div>
              <div className="space-y-4">
                {currentMeta.map((p) => (
                  <div key={p.key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300 text-xs">{t(`organic.param.${p.key}`, { defaultValue: p.label })}</span>
                      <span className="font-mono text-blue-400 text-xs">{currentValues[p.key]}</span>
                    </div>
                    <input
                      type="range"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={currentValues[p.key]}
                      onChange={(e) => handleParamChange(p.key, Number(e.target.value))}
                      className="w-full accent-blue-400"
                    />
                    <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                      <span>{p.min}</span>
                      <span>{p.max}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Features */}
      <div className="border-t border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.15)]">
        <div className="max-w-7xl mx-auto px-6 py-14">
          <h2 className="text-2xl font-bold mb-2">{t("organic.modesTitle", { defaultValue: "Modos de Deformacion" })}</h2>
          <p className="text-sm text-gray-400 mb-8 max-w-xl">
            {t("organic.modesSubtitle", { defaultValue: "Cada modo genera codigo SCAD parametrico que puedes compilar y exportar." })}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Patron Voronoi", desc: "Celdas organicas con control de densidad, profundidad y aleatoriedad. Genera cortes cilindricos distribuidos sobre la superficie.", icon: <Hexagon className="w-5 h-5 text-blue-400" /> },
              { title: "Relieve Ondulado", desc: "Superficie con ondulaciones senoidales parametricas. Control de intensidad, frecuencia y suavizado del relieve.", icon: <Image className="w-5 h-5 text-blue-400" /> },
              { title: "SVG Wrap Geometrico", desc: "Formas poligonales con patrones de corte envolventes. Linear extrude con twist y cortes repetitivos.", icon: <Paintbrush className="w-5 h-5 text-blue-400" /> },
            ].map((f, i) => (
              <Card key={i} className="bg-[rgba(26,31,54,0.4)] border-[rgba(168,187,238,0.08)]" style={{ animation: `vsCardIn 0.4s cubic-bezier(.22,1,.36,1) ${i * 0.08}s both` }}>
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-xl bg-[#1a1f36] flex items-center justify-center border border-[rgba(168,187,238,0.12)] mb-4">{f.icon}</div>
                  <h3 className="text-sm font-semibold text-white mb-2">{t(`organic.featureTitle${i}`, { defaultValue: f.title })}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{t(`organic.featureDesc${i}`, { defaultValue: f.desc })}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes vsHeroIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes vsCardIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
