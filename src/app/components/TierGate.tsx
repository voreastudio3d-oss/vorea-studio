/**
 * TierGate – wraps content that requires a specific membership tier.
 * Shows a locked overlay with upgrade CTA when the user's tier is insufficient.
 */

import { type ReactNode, useState } from "react";
import { useAuth } from "../services/auth-context";
import { useNavigate } from "../nav";
import { Button } from "./ui/button";
import { AuthDialog } from "./AuthDialog";
import type { MembershipTier } from "../services/types";
import { Lock, Crown } from "lucide-react";

const TIER_RANK: Record<MembershipTier, number> = {
  FREE: 0,
  PRO: 1,
  "STUDIO PRO": 2,
};

interface TierGateProps {
  requiredTier: MembershipTier;
  featureName?: string;
  children: ReactNode;
  /** If true, content is rendered but with a blurred overlay instead of being hidden */
  blur?: boolean;
}

export function TierGate({
  requiredTier,
  featureName,
  children,
  blur = true,
}: TierGateProps) {
  const { isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);

  const userTier = user?.tier ?? "FREE";
  const hasAccess =
    isLoggedIn && TIER_RANK[userTier] >= TIER_RANK[requiredTier];

  if (hasAccess) return <>{children}</>;

  return (
    <div className="relative">
      {blur && (
        <div className="pointer-events-none select-none blur-sm opacity-50">
          {children}
        </div>
      )}
      <div
        className={`${
          blur ? "absolute inset-0" : ""
        } flex flex-col items-center justify-center gap-4 rounded-2xl border border-[rgba(168,187,238,0.12)] bg-[rgba(13,17,23,0.9)] backdrop-blur-sm ${
          blur ? "" : "p-12"
        }`}
      >
        <div className="w-14 h-14 rounded-2xl bg-[#1a1f36] border border-[rgba(168,187,238,0.12)] flex items-center justify-center">
          <Lock className="w-6 h-6 text-gray-500" />
        </div>
        <div className="text-center max-w-xs">
          <p className="text-sm text-white mb-1">
            {featureName
              ? `${featureName} requiere ${requiredTier}`
              : `Requiere plan ${requiredTier}`}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            {!isLoggedIn
              ? "Inicia sesion o crea una cuenta para acceder"
              : `Actualiza tu plan de ${userTier} a ${requiredTier}`}
          </p>
          {!isLoggedIn ? (
            <Button size="sm" className="gap-2" onClick={() => setAuthOpen(true)}>
              Ingresar
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-2"
              onClick={() => navigate("/plans")}
            >
              <Crown className="w-3.5 h-3.5" /> Ver Planes
            </Button>
          )}
        </div>
      </div>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
