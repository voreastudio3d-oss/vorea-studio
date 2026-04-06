/**
 * ScadDiagnosticsPanel — compact inline error/warning panel for SCAD code.
 *
 * Shows a summary bar + collapsible list of diagnostics.
 * Each diagnostic is clickable to scroll the textarea to that line.
 */

import { useState, useCallback } from "react";
import {
  AlertTriangle,
  XCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import type { ScadDiagnostic, DiagnosticSeverity } from "../services/scad-validator";

interface ScadDiagnosticsPanelProps {
  diagnostics: ScadDiagnostic[];
  isFixing?: boolean;
  /** Callback to scroll the textarea to a specific line */
  onNavigateToLine?: (line: number) => void;
  /** Request Vorea Quick Fix */
  onQuickFixRequested?: (diagnostic: ScadDiagnostic) => void;
}

const SEVERITY_CONFIG: Record<DiagnosticSeverity, {
  icon: typeof XCircle;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  error: {
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    label: "Error",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    label: "Warning",
  },
  info: {
    icon: CheckCircle2,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    label: "Info",
  },
};

export function ScadDiagnosticsPanel({ diagnostics, isFixing, onNavigateToLine, onQuickFixRequested }: ScadDiagnosticsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;
  const hasIssues = errors + warnings > 0;

  const handleClick = useCallback(
    (line: number) => {
      onNavigateToLine?.(line);
    },
    [onNavigateToLine]
  );

  if (diagnostics.length === 0) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-green-400/70">
        <CheckCircle2 className="w-3 h-3" />
        <span>Sin errores</span>
      </div>
    );
  }

  return (
    <div className="border-t border-[rgba(168,187,238,0.08)]">
      {/* Summary bar — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 text-[10px]">
          {errors > 0 && (
            <span className="flex items-center gap-0.5 text-red-400">
              <XCircle className="w-3 h-3" />
              {errors}
            </span>
          )}
          {warnings > 0 && (
            <span className="flex items-center gap-0.5 text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              {warnings}
            </span>
          )}
          {!hasIssues && (
            <span className="flex items-center gap-0.5 text-green-400/70">
              <CheckCircle2 className="w-3 h-3" />
              OK
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-gray-500" />
        ) : (
          <ChevronUp className="w-3 h-3 text-gray-500" />
        )}
      </button>

      {/* Expanded diagnostics list */}
      {expanded && (
        <div className="max-h-32 overflow-y-auto px-2 pb-2 space-y-1">
          {diagnostics.slice(0, 30).map((d, i) => {
            const cfg = SEVERITY_CONFIG[d.severity];
            const Icon = cfg.icon;
            return (
              <div
                key={`${d.line}-${d.col}-${i}`}
                className={`w-full flex items-start justify-between gap-1.5 px-2 py-1 rounded ${cfg.bg} border ${cfg.border} transition-all`}
              >
                <button
                  onClick={() => handleClick(d.line)}
                  className="flex-1 min-w-0 flex items-start gap-1.5 hover:brightness-110 cursor-pointer text-left"
                >
                  <Icon className={`w-3 h-3 mt-0.5 shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] text-gray-500 mr-1.5">L{d.line}</span>
                    <span className="text-[10px] text-gray-300">{d.message}</span>
                  </div>
                </button>
                {d.severity === "error" && onQuickFixRequested && (
                  <button
                    onClick={() => onQuickFixRequested(d)}
                    disabled={isFixing}
                    className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 mt-0.5 text-[9px] bg-[#C6E36C]/10 text-[#C6E36C] hover:bg-[#C6E36C]/20 rounded border border-[#C6E36C]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Vorea Quick Fix"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    Fix
                  </button>
                )}
              </div>
            );
          })}
          {diagnostics.length > 30 && (
            <p className="text-[9px] text-gray-600 text-center py-1">
              +{diagnostics.length - 30} more…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
