import React from "react";
import { CheckCircle2, XCircle, ChevronDown, Activity, AlertTriangle, ShieldAlert } from "lucide-react";
import type { AiGenerationTraceSummary } from "../services/api-client";

function getLaneLabel(lane: "economy" | "balanced" | "premium"): string {
  return lane === "economy" ? "económico" : lane === "balanced" ? "equilibrado" : "premium";
}

function getLaneBadgeClass(lane: "economy" | "balanced" | "premium"): string {
  if (lane === "economy") {
    return "text-[#C6E36C] border-[#C6E36C]/20 bg-[#C6E36C]/10";
  }
  if (lane === "balanced") {
    return "text-amber-300 border-amber-500/20 bg-amber-500/10";
  }
  return "text-fuchsia-300 border-fuchsia-500/20 bg-fuchsia-500/10";
}

export function AiFallbackTree({ trace }: { trace: AiGenerationTraceSummary }) {
  const attempts = trace.attemptHistory && trace.attemptHistory.length > 0
    ? trace.attemptHistory
    : [{
        provider: trace.provider || "Desconocido",
        model: trace.model || "Desconocido",
        lane: trace.lane || "economy",
        reason: trace.reason || (trace.status === "failed" ? "Fallo general" : "Enrutamiento exitoso"),
        status: trace.status === "failed" ? "failed" : "succeeded",
        error: trace.failureCode || undefined
      }];

  return (
    <div className="relative pl-6 py-2">
      {/* Línea conectora vertical estilo Vercel */}
      <div className="absolute top-4 bottom-4 left-[11px] w-0.5 bg-[rgba(168,187,238,0.1)] rounded-full z-0" />
      
      <div className="space-y-4 relative z-10 flex flex-col gap-2">
        {attempts.map((attempt, index) => {
          const isFailed = attempt.status === "failed";
          const isLast = index === attempts.length - 1;
          const isFinalSuccess = !isFailed && isLast;
          
          return (
            <div key={index} className="relative flex items-start gap-4">
              {/* Nodo visual */}
              <div className="flex-shrink-0 mt-2 relative">
                {/* Ícono de estatus */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 bg-[#0C101A] transition-colors ${
                  isFailed
                    ? "border-red-500/50 text-red-400"
                    : "border-[#C6E36C]/50 text-[#C6E36C]"
                }`}>
                  {isFailed ? (
                    <XCircle className="w-3.5 h-3.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                </div>
                {/* Resplandor decorativo para fallos o aciertos fuertes */}
                {isFailed && <div className="absolute inset-0 bg-red-500/20 blur-sm rounded-full -z-10" />}
                {isFinalSuccess && <div className="absolute inset-0 bg-[#C6E36C]/20 blur-sm rounded-full -z-10" />}
              </div>

              {/* Tarjeta del intento (Vercel style) */}
              <div className={`flex-1 rounded-xl border px-5 py-4 shadow-sm backdrop-blur-sm transition-all ${
                isFailed 
                  ? "border-red-500/10 bg-red-500/[0.04] hover:bg-red-500/[0.06]" 
                  : "border-[rgba(168,187,238,0.08)] bg-[rgba(19,24,41,0.6)] hover:bg-[rgba(19,24,41,0.8)]"
              }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold tracking-wide ${isFailed ? "text-red-400" : "text-white"}`}>
                        {attempt.provider}
                      </span>
                      <ChevronDown className="-rotate-90 w-3 h-3 text-gray-600" />
                      <span className="text-gray-300 text-sm font-mono">{attempt.model}</span>
                    </div>
                    {attempt.error && (
                      <div className="flex flex-wrap items-center mt-2.5 gap-1.5 p-1.5 px-3 bg-[#0C101A]/80 rounded-md border border-red-500/10 w-fit">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-[11px] tracking-wide text-red-300 font-mono">CODE: {attempt.error}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-start md:items-end gap-1.5">
                    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${getLaneBadgeClass(attempt.lane)}`}>
                      {getLaneLabel(attempt.lane)}
                    </span>
                    <span className="text-[11px] font-medium text-gray-500">
                      {isFailed ? "FAILBACK" : "SUCCESSFUL ROUTE"}
                    </span>
                  </div>
                </div>

                {isFailed && attempt.reason && (
                  <div className="mt-3.5 pt-3 border-t border-[rgba(168,187,238,0.05)] text-[13px] text-gray-400 leading-relaxed w-full flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500/80 shrink-0 mt-0.5" />
                    <span className="pt-0.5 font-medium">{attempt.reason}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
