/**
 * CreditPackModal – Access and balance helper for GCode after the migration
 * to the universal server-authoritative tool-credit system.
 */

import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useNavigate } from "../nav";
import {
  X,
  Crown,
  Coins,
  Shield,
  RefreshCw,
  Lock,
  AlertTriangle,
} from "lucide-react";

interface CreditPackModalProps {
  open: boolean;
  onClose: () => void;
  currentBalance: number | null;
  creditsLoading?: boolean;
  creditsStale?: boolean;
  userTier?: string;
  onRefresh?: () => void;
}

export function CreditPackModal({
  open,
  onClose,
  currentBalance,
  creditsLoading = false,
  creditsStale = false,
  userTier = "FREE",
  onRefresh,
}: CreditPackModalProps) {
  const navigate = useNavigate();

  if (!open) return null;

  const hasBalance = (currentBalance ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-lg bg-[#0d1117] border border-[rgba(168,187,238,0.15)] rounded-2xl overflow-hidden shadow-2xl"
        style={{ animation: "modalIn 0.25s cubic-bezier(.22,1,.36,1) both" }}
      >
        <div className="px-6 pt-6 pb-4 border-b border-[rgba(168,187,238,0.08)]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C6E36C]/10 border border-[#C6E36C]/30 flex items-center justify-center">
                <Coins className="w-5 h-5 text-[#C6E36C]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Saldo GCode</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  GCode ya valida acceso con el saldo mensual de herramientas.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] flex items-center justify-center text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <Badge className={`text-[10px] ${
              hasBalance
                ? "bg-green-500/15 text-green-400 border-green-500/25"
                : "bg-red-500/15 text-red-400 border-red-500/25"
            }`}>
              {hasBalance ? <Coins className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
              {currentBalance ?? "—"} cr disponibles
            </Badge>
            <Badge className="bg-[#1a1f36] text-gray-400 border-[rgba(168,187,238,0.08)] text-[10px]">
              <Crown className="w-3 h-3 mr-1" />
              {userTier}
            </Badge>
            {creditsLoading && (
              <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/25 text-[10px]">
                Sincronizando...
              </Badge>
            )}
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="p-4 rounded-xl bg-[rgba(26,31,54,0.45)] border border-[rgba(168,187,238,0.08)]">
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-[#C6E36C] mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-sm text-gray-200">
                  La generación de GCode ahora descuenta solo cuando el servidor confirma la acción.
                </p>
                <p className="text-xs text-gray-500">
                  Si el saldo no alcanza, revisa tu balance mensual desde perfil o cambia de plan.
                </p>
              </div>
            </div>
          </div>

          {creditsStale && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-200">
                <p>No pudimos sincronizar el saldo más reciente.</p>
                <p className="text-amber-100/80 mt-1">
                  La próxima generación igual se validará con el servidor antes de descontar.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => {
                onClose();
                navigate("/profile");
              }}
            >
              <Coins className="w-4 h-4" />
              Ver perfil
            </Button>
            <Button
              className="gap-2"
              onClick={() => {
                onClose();
                navigate("/planes");
              }}
            >
              <Crown className="w-4 h-4" />
              Ver planes
            </Button>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="w-full text-[11px] text-[#C6E36C] hover:underline flex items-center justify-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Revalidar saldo
            </button>
          )}
        </div>

        <style>{`
          @keyframes modalIn {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}
