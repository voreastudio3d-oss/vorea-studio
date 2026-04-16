/**
 * ScadCustomizer – Renders auto-generated controls for parsed SCAD parameters.
 * Supports: number sliders, boolean toggles, string inputs, array editors.
 * Groups controls by section headers extracted from SCAD comments.
 */

import { useState, useCallback } from "react";
import type { ScadParam, ScadParseResult } from "../services/scad-parser";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { CollapsibleSection } from "./CollapsibleSection";
import {
  RotateCcw,
  Layers,
  ChevronDown,
  ChevronRight,
  Hash,
  ToggleLeft,
  Type,
  List,
  Settings2,
  Plus,
  Minus,
  Info,
} from "lucide-react";

interface ScadCustomizerProps {
  parseResult: ScadParseResult;
  values: Record<string, number | boolean | string | number[]>;
  onChange: (name: string, value: number | boolean | string | number[]) => void;
  onResetAll: () => void;
  onResetParam?: (name: string) => void;
  /** Accent color class for the customizer (default: C6E36C) */
  accentColor?: string;
}

// ─── Type icons ───────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ReactNode> = {
  number: <Hash className="w-3 h-3" />,
  bool: <ToggleLeft className="w-3 h-3" />,
  string: <Type className="w-3 h-3" />,
  array: <List className="w-3 h-3" />,
  special: <Settings2 className="w-3 h-3" />,
};

// ─── Friendly display names for technical SCAD params ─────────────────────────

const FRIENDLY_LABELS: Record<string, string> = {
  "$fn": "Nivel de detalle",
  "$fa": "Ángulo mínimo",
  "$fs": "Tamaño mínimo",
  jitter: "Aleatoriedad",
  jitter_pct: "Aleatoriedad %",
  seed: "Semilla",
  wall: "Grosor de pared",
  corner_r: "Radio de esquinas",
};

function friendlyName(name: string): string {
  return FRIENDLY_LABELS[name] ?? FRIENDLY_LABELS[name.toLowerCase()] ?? name;
}

// ─── Individual parameter controls ───────────────────────────────────────────

function NumberControl({
  param,
  value,
  onChange,
}: {
  param: ScadParam;
  value: number;
  onChange: (v: number) => void;
}) {
  const range = param.range ?? { min: 0, max: 100, step: 1 };

  return (
    <div>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#C6E36C]"
      />
      <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
        <span>{range.min}</span>
        <span>{range.max}</span>
      </div>
    </div>
  );
}

function BoolControl({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${
        value
          ? "bg-[#C6E36C]/10 border-[#C6E36C]/30 text-[#C6E36C]"
          : "bg-[#1a1f36] border-[rgba(168,187,238,0.12)] text-gray-400"
      }`}
    >
      <span className="text-xs">{value ? "Activado" : "Desactivado"}</span>
      <div
        className={`w-8 h-4.5 rounded-full p-0.5 transition-all ${
          value ? "bg-[#C6E36C]/30" : "bg-gray-700"
        }`}
      >
        <div
          className={`w-3.5 h-3.5 rounded-full transition-transform ${
            value
              ? "bg-[#C6E36C] translate-x-3.5"
              : "bg-gray-500 translate-x-0"
          }`}
        />
      </div>
    </button>
  );
}

function StringControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#C6E36C]/50 transition-colors"
    />
  );
}

function ChoiceControl({
  param,
  value,
  onChange,
}: {
  param: ScadParam;
  value: number | string;
  onChange: (v: number | string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => {
          const valStr = e.target.value;
          const num = Number(valStr);
          onChange(param.type === "number" || param.type === "special" ? (!isNaN(num) && valStr !== "" ? num : valStr) : valStr);
        }}
        className="w-full appearance-none bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] rounded-lg px-3 py-2 pr-8 text-xs text-white outline-none focus:border-[#C6E36C]/50 transition-colors cursor-pointer"
      >
        {param.choices?.map((c, i) => (
          <option key={i} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
    </div>
  );
}

function ArrayControl({
  param,
  value,
  onChange,
}: {
  param: ScadParam;
  value: number[];
  onChange: (v: number[]) => void;
}) {
  const handleElementChange = (idx: number, val: number) => {
    const copy = [...value];
    copy[idx] = val;
    onChange(copy);
  };

  const addElement = () => {
    // Default to last element's value or 0.5
    const last = value[value.length - 1] ?? 0.5;
    onChange([...value, last]);
  };

  const removeElement = (idx: number) => {
    if (value.length <= 1) return;
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {value.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[10px] text-gray-600 w-4 font-mono shrink-0">
            {i}
          </span>
          <input
            type="number"
            value={v}
            step={0.05}
            onChange={(e) => handleElementChange(i, Number(e.target.value))}
            className="flex-1 bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-[#C6E36C]/50 transition-colors font-mono"
          />
          <button
            onClick={() => removeElement(i)}
            disabled={value.length <= 1}
            className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Minus className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button
        onClick={addElement}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[rgba(168,187,238,0.15)] text-[10px] text-gray-500 hover:border-[#C6E36C]/30 hover:text-[#C6E36C] transition-colors"
      >
        <Plus className="w-3 h-3" /> Agregar elemento
      </button>
      <div className="text-[10px] text-gray-600 font-mono">
        [{value.join(", ")}]
      </div>
    </div>
  );
}

// ─── Section component ────────────────────────────────────────────────────────

function Section({
  title,
  params,
  values,
  onChange,
  defaultOpen,
}: {
  title: string;
  params: ScadParam[];
  values: Record<string, number | boolean | string | number[]>;
  onChange: (name: string, value: number | boolean | string | number[]) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);

  return (
    <CollapsibleSection
      title={title}
      icon={<Settings2 className="w-4 h-4" />}
      isOpen={open}
      onToggle={() => setOpen(!open)}
    >
      <div className="space-y-4 pb-1 pl-1">
        {params.map((param) => {
          const val = values[param.name] ?? param.value;
          const translatedLabel =
            typeof param.comment === "string" && param.comment.trim().length > 0
              ? param.comment.trim()
              : friendlyName(param.name);
          const showTechnicalKey = translatedLabel !== param.name;
          return (
            <div key={param.name}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">
                    {TYPE_ICON[param.type]}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-gray-200 leading-tight">
                      {translatedLabel}
                    </span>
                    {showTechnicalKey && (
                      <span className="text-[10px] text-gray-500 font-mono leading-none">
                        {param.name}
                      </span>
                    )}
                  </div>
                </div>
                <span className="font-mono text-[#C6E36C] text-xs">
                  {typeof val === "boolean"
                    ? val
                      ? "true"
                      : "false"
                    : Array.isArray(val)
                    ? `[${val.length}]`
                    : String(val)}
                </span>
              </div>

              {param.choices && param.choices.length > 0 ? (
                <ChoiceControl
                  param={param}
                  value={typeof val === "boolean" ? String(val) : Array.isArray(val) ? val[0] : val}
                  onChange={(v) => onChange(param.name, v)}
                />
              ) : param.type === "number" || param.type === "special" ? (
                <NumberControl
                  param={param}
                  value={typeof val === "number" ? val : Number(val)}
                  onChange={(v) => onChange(param.name, v)}
                />
              ) : param.type === "bool" ? (
                <BoolControl
                  value={typeof val === "boolean" ? val : Boolean(val)}
                  onChange={(v) => onChange(param.name, v)}
                />
              ) : param.type === "string" ? (
                <StringControl
                  value={String(val)}
                  onChange={(v) => onChange(param.name, v)}
                />
              ) : param.type === "array" ? (
                <ArrayControl
                  param={param}
                  value={Array.isArray(val) ? val : []}
                  onChange={(v) => onChange(param.name, v)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ScadCustomizer({
  parseResult,
  values,
  onChange,
  onResetAll,
}: ScadCustomizerProps) {
  const { params, sections } = parseResult;

  // Group params by section
  const grouped: Array<{ section: string; params: ScadParam[] }> = [];
  const usedSections = new Set<string>();

  // Build ordered groups
  const noSection: ScadParam[] = [];

  for (const param of params) {
    if (!param.section) {
      noSection.push(param);
    } else {
      if (!usedSections.has(param.section)) {
        usedSections.add(param.section);
        grouped.push({ section: param.section, params: [] });
      }
      const group = grouped.find((g) => g.section === param.section);
      group?.params.push(param);
    }
  }

  // Prepend ungrouped params
  if (noSection.length > 0) {
    grouped.unshift({ section: "General", params: noSection });
  }

  return (
    <Card className="bg-[rgba(26,31,54,0.6)] border-[rgba(168,187,238,0.12)]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#C6E36C]" />
            <span className="text-sm font-semibold">Parametros</span>
            <span className="text-[9px] text-gray-500 bg-[#0d1117] px-1.5 py-0.5 rounded">
              {params.length} vars
            </span>
          </div>
          <button
            onClick={onResetAll}
            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reset todo
          </button>
        </div>

        <div className="space-y-3">
          {grouped.map((group, i) => (
            <Section
              key={group.section}
              title={group.section}
              params={group.params}
              values={values}
              onChange={onChange}
              defaultOpen={i < 3}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
