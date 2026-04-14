/**
 * ModifierPanel — UI controls for Worley / Lattice geometry modifiers.
 *
 * Displays inline controls to configure and apply surface displacement
 * or lattice conversion on any compiled 3D model.
 *
 * Vorea Studio — voreastudio.com
 */

import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { CollapsibleSection } from "./CollapsibleSection";
import {
  DEFAULT_MODIFIER,
  MODIFIER_PRESETS,
  exportModifierPreset,
  parseModifierPreset,
  type ModifierConfig,
  type CellStyle,
  type ModifierMode,
} from "../engine/geometry-modifiers";
import type { WorleyMetric } from "../engine/worley";
import {
  Hexagon,
  Grid3x3,
  Download,
  Upload,
  RotateCcw,
  Zap,
} from "lucide-react";

interface ModifierPanelProps {
  config: ModifierConfig;
  onChange: (config: ModifierConfig) => void;
}

const CELL_STYLES: { value: CellStyle; label: string; desc: string }[] = [
  { value: "sphere", label: "Dimples", desc: "F1 — spherical dents" },
  { value: "cylinder", label: "Bumps", desc: "F2 — faceted bumps" },
  { value: "cube", label: "Cracks", desc: "Edge — cracked scales" },
];

const MODES: { value: ModifierMode; label: string }[] = [
  { value: "surface", label: "Surface" },
  { value: "lattice", label: "Lattice" },
];

export function ModifierPanel({ config, onChange }: ModifierPanelProps) {
  const [presetKey, setPresetKey] = useState<string>("custom");
  const [isOpen, setIsOpen] = useState(config.enabled);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<ModifierConfig>) =>
    onChange({ ...config, ...patch });

  const handlePreset = (key: string) => {
    setPresetKey(key);
    if (key === "custom") return;
    const p = MODIFIER_PRESETS[key];
    if (p) onChange({ ...DEFAULT_MODIFIER, ...p.config });
  };

  const handleExport = () => {
    const blob = exportModifierPreset(config, presetKey);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vorea_modifier_${presetKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseModifierPreset(ev.target?.result as string);
      if (parsed) {
        onChange(parsed);
        setPresetKey("custom");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_MODIFIER });
    setPresetKey("custom");
  };

  return (
    <CollapsibleSection
      title="Surface Modifier"
      icon={<Hexagon className="w-4 h-4" />}
      isOpen={isOpen}
      onToggle={() => setIsOpen((o) => !o)}
    >
      <div className="space-y-3">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Worley Displacement
          </label>
          <Button
            size="sm"
            variant={config.enabled ? "default" : "outline"}
            className="h-6 text-[10px] px-2"
            onClick={() => set({ enabled: !config.enabled })}
          >
            {config.enabled ? (
              <>
                <Zap className="w-3 h-3 mr-1" /> Active
              </>
            ) : (
              "Off"
            )}
          </Button>
        </div>

        {config.enabled && (
          <>
            {/* Quick presets */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Presets
              </label>
              <div className="flex flex-wrap gap-1 mt-1">
                {[
                  ["custom", "Custom"],
                  ...Object.entries(MODIFIER_PRESETS).map(([k, v]) => [
                    k,
                    v.label,
                  ]),
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => handlePreset(key)}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors ${
                      presetKey === key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:bg-accent"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode: surface vs lattice */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Mode
              </label>
              <div className="flex gap-1 mt-1">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => set({ mode: m.value })}
                    className={`flex-1 py-1 text-[11px] font-semibold rounded border transition-colors ${
                      config.mode === m.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:bg-accent"
                    }`}
                  >
                    {m.value === "lattice" ? (
                      <Grid3x3 className="w-3 h-3 inline mr-1" />
                    ) : (
                      <Hexagon className="w-3 h-3 inline mr-1" />
                    )}
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cell style */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Cell Style
              </label>
              <div className="flex gap-1 mt-1">
                {CELL_STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => set({ cellStyle: s.value })}
                    title={s.desc}
                    className={`flex-1 py-1 text-[10px] font-semibold rounded border transition-colors ${
                      config.cellStyle === s.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:bg-accent"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders */}
            <SliderRow
              label="Cells"
              value={config.cellCount}
              min={5}
              max={120}
              step={1}
              onChange={(v) => set({ cellCount: v })}
            />
            <SliderRow
              label="Seed"
              value={config.seed}
              min={1}
              max={999}
              step={1}
              onChange={(v) => set({ seed: v })}
            />
            <SliderRow
              label="Wall Thickness"
              value={config.wallThickness}
              min={0.5}
              max={8}
              step={0.25}
              onChange={(v) => set({ wallThickness: v })}
            />
            <SliderRow
              label="Diameter"
              value={config.diameter}
              min={20}
              max={200}
              step={5}
              onChange={(v) => set({ diameter: v })}
            />

            {/* Lattice-specific controls */}
            {config.mode === "lattice" && (
              <>
                <SliderRow
                  label="Tube Radius"
                  value={config.tubeRadius}
                  min={0.2}
                  max={3}
                  step={0.1}
                  onChange={(v) => set({ tubeRadius: v })}
                />
                <SliderRow
                  label="Tube Segments"
                  value={config.tubeSegments}
                  min={3}
                  max={12}
                  step={1}
                  onChange={(v) => set({ tubeSegments: v })}
                />
              </>
            )}

            {/* Import / Export / Reset */}
            <div className="flex gap-1 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-7 text-[10px]"
                onClick={handleExport}
              >
                <Download className="w-3 h-3 mr-1" /> Export
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-7 text-[10px]"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-3 h-3 mr-1" /> Import
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[10px] px-2"
                onClick={handleReset}
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
            </div>
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}

// ─── Slider Row ───────────────────────────────────────────────────────────────

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-0.5">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[11px] font-mono font-semibold text-primary">
          {Number.isInteger(step) ? value : value.toFixed(1)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-primary cursor-pointer"
      />
    </div>
  );
}
