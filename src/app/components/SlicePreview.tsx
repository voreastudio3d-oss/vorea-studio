/**
 * SlicePreview – 2D Canvas visualization of slicer layers.
 * Shows contours, infill lines, and toolpath navigation per layer.
 */

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import type { SerializedMesh } from "../engine/mesh-data";
import type { SliceConfig } from "../engine/slicer";
import { sliceMesh, DEFAULT_SLICE_CONFIG, type SliceResult } from "../engine/slicer";
import {
  Layers,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Eye,
} from "lucide-react";

interface SlicePreviewProps {
  mesh: SerializedMesh | null;
  config?: Partial<SliceConfig>;
}

export function SlicePreview({ mesh, config }: SlicePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  const [sliceResult, setSliceResult] = useState<SliceResult | null>(null);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [slicing, setSlicing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const cfg = useMemo(
    () => ({ ...DEFAULT_SLICE_CONFIG, ...config }),
    [config]
  );

  // ─── Slice mesh on demand ───────────────────────────────────────────
  const doSlice = useCallback(() => {
    if (!mesh) return;
    setSlicing(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const result = sliceMesh(mesh, cfg);
          setSliceResult(result);
          setCurrentLayer(0);
        } catch {
          setSliceResult(null);
        }
        setSlicing(false);
      }, 10);
    });
  }, [mesh, cfg]);

  // Auto-slice when mesh changes
  useEffect(() => {
    if (mesh) doSlice();
    else setSliceResult(null);
  }, [mesh, doSlice]);

  // ─── Animation playback ─────────────────────────────────────────────
  useEffect(() => {
    if (!playing || !sliceResult) return;

    const total = sliceResult.slices.length;
    let frame = currentLayer;

    const tick = () => {
      frame++;
      if (frame >= total) {
        frame = 0;
      }
      setCurrentLayer(frame);
      animRef.current = window.setTimeout(tick, 80);
    };

    animRef.current = window.setTimeout(tick, 80);

    return () => {
      clearTimeout(animRef.current);
    };
  }, [playing, sliceResult]);

  // ─── Canvas rendering ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sliceResult || sliceResult.slices.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = 20;

    // Clear
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, w, h);

    const { bbox, slices } = sliceResult;

    // Compute scale to fit
    const modelW = bbox.maxX - bbox.minX;
    const modelH = bbox.maxY - bbox.minY;
    if (modelW === 0 || modelH === 0) return;

    const scaleX = (w - pad * 2) / modelW;
    const scaleY = (h - pad * 2) / modelH;
    const scale = Math.min(scaleX, scaleY);

    const offX = (w - modelW * scale) / 2 - bbox.minX * scale;
    const offY = (h - modelH * scale) / 2 - bbox.minY * scale;

    const toScreen = (x: number, y: number): [number, number] => {
      return [x * scale + offX, h - (y * scale + offY)]; // flip Y
    };

    // Draw grid
    ctx.strokeStyle = "rgba(42,48,64,0.3)";
    ctx.lineWidth = 0.5;
    const gridStep = 10;
    for (let gx = Math.floor(bbox.minX / gridStep) * gridStep; gx <= bbox.maxX; gx += gridStep) {
      const [sx, sy1] = toScreen(gx, bbox.minY);
      const [, sy2] = toScreen(gx, bbox.maxY);
      ctx.beginPath(); ctx.moveTo(sx, sy1); ctx.lineTo(sx, sy2); ctx.stroke();
    }
    for (let gy = Math.floor(bbox.minY / gridStep) * gridStep; gy <= bbox.maxY; gy += gridStep) {
      const [sx1, sy] = toScreen(bbox.minX, gy);
      const [sx2] = toScreen(bbox.maxX, gy);
      ctx.beginPath(); ctx.moveTo(sx1, sy); ctx.lineTo(sx2, sy); ctx.stroke();
    }

    // Determine layers to draw
    const layersToDraw = showAll
      ? slices.slice(0, currentLayer + 1)
      : [slices[currentLayer]];

    // Draw previous layers (ghost) when showAll
    if (showAll && layersToDraw.length > 1) {
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = "#C6E36C";
      ctx.lineWidth = 0.5;
      for (let li = 0; li < layersToDraw.length - 1; li++) {
        const s = layersToDraw[li];
        for (const contour of s.contours) {
          if (contour.length < 2) continue;
          ctx.beginPath();
          const [sx, sy] = toScreen(contour[0].x, contour[0].y);
          ctx.moveTo(sx, sy);
          for (let i = 1; i < contour.length; i++) {
            const [px, py] = toScreen(contour[i].x, contour[i].y);
            ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // Draw current layer contours (walls)
    const currentSlice = slices[currentLayer];
    if (currentSlice) {
      // Fill area
      ctx.fillStyle = "rgba(198,227,108,0.08)";
      for (const contour of currentSlice.contours) {
        if (contour.length < 3) continue;
        ctx.beginPath();
        const [sx, sy] = toScreen(contour[0].x, contour[0].y);
        ctx.moveTo(sx, sy);
        for (let i = 1; i < contour.length; i++) {
          const [px, py] = toScreen(contour[i].x, contour[i].y);
          ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }

      // Outer wall
      ctx.strokeStyle = "#C6E36C";
      ctx.lineWidth = 1.5;
      for (const contour of currentSlice.contours) {
        if (contour.length < 2) continue;
        ctx.beginPath();
        const [sx, sy] = toScreen(contour[0].x, contour[0].y);
        ctx.moveTo(sx, sy);
        for (let i = 1; i < contour.length; i++) {
          const [px, py] = toScreen(contour[i].x, contour[i].y);
          ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // Travel moves (dashed)
      if (currentSlice.contours.length > 1) {
        ctx.strokeStyle = "rgba(59,130,246,0.4)";
        ctx.lineWidth = 0.5;
        ctx.setLineDash([3, 3]);
        for (let ci = 0; ci < currentSlice.contours.length - 1; ci++) {
          const c1 = currentSlice.contours[ci];
          const c2 = currentSlice.contours[ci + 1];
          if (c1.length > 0 && c2.length > 0) {
            const [sx1, sy1] = toScreen(c1[c1.length - 1].x, c1[c1.length - 1].y);
            const [sx2, sy2] = toScreen(c2[0].x, c2[0].y);
            ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();
          }
        }
        ctx.setLineDash([]);
      }
    }

    // HUD overlay
    ctx.fillStyle = "rgba(198,227,108,0.5)";
    ctx.font = "10px monospace";
    if (currentSlice) {
      ctx.fillText(
        `Capa ${currentLayer + 1}/${slices.length} · Z=${currentSlice.z.toFixed(2)}mm · ${currentSlice.contours.length} contornos`,
        8,
        h - 8
      );
    }

    // Scale bar (10mm)
    const barLen = 10 * scale;
    if (barLen > 20) {
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w - pad - barLen, pad);
      ctx.lineTo(w - pad, pad);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillText("10mm", w - pad - barLen, pad - 4);
    }
  }, [sliceResult, currentLayer, showAll]);

  // ─── No mesh state ──────────────────────────────────────────────────
  if (!mesh) {
    return (
      <div className="rounded-xl border border-[rgba(168,187,238,0.08)] bg-[rgba(26,31,54,0.3)] p-6 text-center">
        <Layers className="w-6 h-6 text-gray-600 mx-auto mb-2" />
        <p className="text-xs text-gray-500">
          Compila un modelo para ver el preview de capas
        </p>
      </div>
    );
  }

  const totalLayers = sliceResult?.slices.length ?? 0;
  const currentSlice = sliceResult?.slices[currentLayer];

  return (
    <div className="rounded-xl border border-[rgba(168,187,238,0.12)] bg-[rgba(26,31,54,0.4)] overflow-hidden">
      {/* Canvas */}
      <div ref={containerRef} className="relative aspect-square bg-[#0a0e1a]">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ display: sliceResult ? "block" : "none" }}
        />
        {slicing && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0e1a]/80">
            <div className="text-center">
              <div className="w-5 h-5 border-2 border-[#C6E36C] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-[10px] text-gray-400">Slicing...</p>
            </div>
          </div>
        )}
        {!slicing && sliceResult && totalLayers === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-gray-500">Sin capas detectadas</p>
          </div>
        )}

        {/* Layer badge */}
        {sliceResult && totalLayers > 0 && (
          <div className="absolute top-2 left-2 flex gap-1.5">
            <Badge className="bg-[#0a0e1a]/80 text-[#C6E36C] border-[#C6E36C]/20 text-[9px] backdrop-blur-sm">
              <Layers className="w-3 h-3 mr-1" />
              {currentLayer + 1}/{totalLayers}
            </Badge>
            {currentSlice && (
              <Badge className="bg-[#0a0e1a]/80 text-gray-400 border-gray-700/30 text-[9px] backdrop-blur-sm">
                Z={currentSlice.z.toFixed(2)}mm
              </Badge>
            )}
          </div>
        )}

        {/* Show-all toggle */}
        {sliceResult && totalLayers > 0 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className={`absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center transition-colors backdrop-blur-sm ${
              showAll
                ? "bg-[#C6E36C]/20 text-[#C6E36C] border border-[#C6E36C]/30"
                : "bg-[#0a0e1a]/60 text-gray-500 border border-gray-700/30 hover:text-gray-300"
            }`}
            title={showAll ? "Solo capa actual" : "Mostrar capas anteriores"}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Controls */}
      {sliceResult && totalLayers > 0 && (
        <div className="px-3 py-2 border-t border-[rgba(168,187,238,0.08)]">
          {/* Slider */}
          <input
            type="range"
            min={0}
            max={totalLayers - 1}
            value={currentLayer}
            onChange={(e) => {
              setPlaying(false);
              setCurrentLayer(parseInt(e.target.value));
            }}
            className="w-full h-1 accent-[#C6E36C] cursor-pointer"
          />

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => { setPlaying(false); setCurrentLayer(0); }}
                className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-white transition-colors"
              >
                <SkipBack className="w-3 h-3" />
              </button>
              <button
                onClick={() => { setPlaying(false); setCurrentLayer(Math.max(0, currentLayer - 1)); }}
                className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPlaying(!playing)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  playing
                    ? "bg-[#C6E36C]/20 text-[#C6E36C]"
                    : "bg-[#1a1f36] text-gray-400 hover:text-white"
                }`}
              >
                {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => { setPlaying(false); setCurrentLayer(Math.min(totalLayers - 1, currentLayer + 1)); }}
                className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-white transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setPlaying(false); setCurrentLayer(totalLayers - 1); }}
                className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-white transition-colors"
              >
                <SkipForward className="w-3 h-3" />
              </button>
            </div>

            <span className="text-[9px] text-gray-500 font-mono">
              {currentSlice?.contours.length ?? 0} contornos
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
