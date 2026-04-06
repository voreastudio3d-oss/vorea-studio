/**
 * SubscriptionSuccessModal — Celebratory overlay shown after a successful PayPal subscription.
 * Features confetti particles, sparkle effects, and an encouraging thank-you message.
 */
import { useState, useEffect, useRef } from "react";
import { Crown, Sparkles, PartyPopper, ArrowRight, X } from "lucide-react";
import { Button } from "./ui/button";

interface SubscriptionSuccessModalProps {
  open: boolean;
  onClose: () => void;
  tier?: string;
}

// Generate random confetti particles
function generateConfetti(count: number) {
  const colors = ["#C6E36C", "#FFD700", "#FF6B6B", "#4ECDC4", "#A78BFA", "#F472B6", "#60A5FA", "#34D399"];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 2 + Math.random() * 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 4 + Math.random() * 8,
    rotation: Math.random() * 360,
    type: Math.random() > 0.5 ? "rect" : "circle" as "rect" | "circle",
  }));
}

export function SubscriptionSuccessModal({ open, onClose, tier }: SubscriptionSuccessModalProps) {
  const [confetti] = useState(() => generateConfetti(60));
  const [sparkles] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: 15 + Math.random() * 70,
      y: 10 + Math.random() * 80,
      delay: Math.random() * 2,
      size: 8 + Math.random() * 16,
    }))
  );
  const modalRef = useRef<HTMLDivElement>(null);

  // Auto-close after 12 seconds
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, 12000);
    return () => clearTimeout(timer);
  }, [open, onClose]);

  if (!open) return null;

  const tierName = tier === "STUDIO_PRO" || tier === "STUDIO PRO"
    ? "Studio Pro"
    : tier === "PRO"
    ? "Pro"
    : "Pro";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
        style={{ animation: "fadeIn 0.3s ease-out both" }}
      />

      {/* Confetti layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map((c) => (
          <div
            key={c.id}
            className="absolute"
            style={{
              left: `${c.x}%`,
              top: "-5%",
              width: c.type === "rect" ? `${c.size}px` : `${c.size}px`,
              height: c.type === "rect" ? `${c.size * 0.6}px` : `${c.size}px`,
              backgroundColor: c.color,
              borderRadius: c.type === "circle" ? "50%" : "2px",
              transform: `rotate(${c.rotation}deg)`,
              animation: `confettiFall ${c.duration}s ${c.delay}s ease-in both`,
              opacity: 0.9,
            }}
          />
        ))}
      </div>

      {/* Sparkles layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {sparkles.map((s) => (
          <div
            key={s.id}
            className="absolute"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              animation: `sparkle 1.5s ${s.delay}s ease-in-out infinite`,
            }}
          >
            <Sparkles
              className="text-yellow-400"
              style={{ width: s.size, height: s.size, filter: "drop-shadow(0 0 6px rgba(255,215,0,0.6))" }}
            />
          </div>
        ))}
      </div>

      {/* Modal card */}
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-gradient-to-b from-[#1a1f36] to-[#0d1117] border border-[rgba(198,227,108,0.25)] rounded-3xl overflow-hidden shadow-2xl"
        style={{ animation: "celebrateIn 0.5s cubic-bezier(.22,1,.36,1) both" }}
      >
        {/* Top glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-32 rounded-full blur-3xl"
          style={{ background: "radial-gradient(ellipse, rgba(198,227,108,0.25) 0%, transparent 70%)" }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[#1a1f36]/80 border border-[rgba(168,187,238,0.12)] flex items-center justify-center text-gray-500 hover:text-white transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative px-8 pt-10 pb-8 text-center">
          {/* Icon */}
          <div
            className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-[#C6E36C]/20 to-[#C6E36C]/5 border border-[#C6E36C]/30 flex items-center justify-center mb-6"
            style={{ animation: "bounceIn 0.6s 0.3s cubic-bezier(.68,-0.55,.27,1.55) both" }}
          >
            <PartyPopper className="w-10 h-10 text-[#C6E36C]" />
          </div>

          {/* Title */}
          <h2
            className="text-2xl font-bold text-white mb-2"
            style={{ animation: "fadeSlideUp 0.5s 0.4s ease-out both" }}
          >
            ¡Bienvenido a {tierName}! 🎉
          </h2>

          {/* Subtitle */}
          <p
            className="text-sm text-gray-400 mb-6 max-w-xs mx-auto"
            style={{ animation: "fadeSlideUp 0.5s 0.5s ease-out both" }}
          >
            Tu suscripción se activó correctamente. Ahora tienes acceso a todas las herramientas avanzadas de Vorea Studio.
          </p>

          {/* 🎁 Welcome Rewards */}
          <div
            className="bg-gradient-to-r from-[rgba(255,215,0,0.08)] to-[rgba(198,227,108,0.08)] border border-yellow-500/20 rounded-2xl p-4 mb-4 text-left"
            style={{ animation: "fadeSlideUp 0.5s 0.55s ease-out both" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🎁</span>
              <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">
                Recompensas de bienvenida
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  icon: "🎯",
                  label: tierName === "Studio Pro" ? "+100 créditos" : "+30 créditos",
                  sub: "GCode Export",
                },
                {
                  icon: "⭐",
                  label: "Early Adopter",
                  sub: "Badge exclusivo",
                },
                {
                  icon: "⚡",
                  label: "Cola prioritaria",
                  sub: "Renders rápidos",
                },
              ].map((reward, i) => (
                <div
                  key={reward.label}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)]"
                  style={{ animation: `rewardPop 0.4s ${0.7 + i * 0.15}s cubic-bezier(.68,-0.55,.27,1.55) both` }}
                >
                  <span className="text-xl">{reward.icon}</span>
                  <span className="text-[10px] font-bold text-white leading-tight text-center">{reward.label}</span>
                  <span className="text-[9px] text-gray-500 leading-tight text-center">{reward.sub}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upgrade perks */}
          <div
            className="bg-[rgba(198,227,108,0.06)] border border-[#C6E36C]/15 rounded-2xl p-4 mb-6 text-left"
            style={{ animation: "fadeSlideUp 0.5s 0.65s ease-out both" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Crown className="w-4 h-4 text-[#C6E36C]" />
              <span className="text-xs font-semibold text-[#C6E36C] uppercase tracking-wider">
                Tus nuevos beneficios
              </span>
            </div>
            <ul className="space-y-2">
              {(tierName === "Studio Pro"
                ? [
                    "Generaciones IA ilimitadas",
                    "API access + Colaboración en equipo",
                    "Exportación SCAD editable",
                    "Soporte dedicado 24/7",
                  ]
                : [
                    "Proyectos ilimitados",
                    "20 generaciones IA por día",
                    "Exportación STL, OBJ, 3MF",
                    "Soporte prioritario",
                  ]
              ).map((perk) => (
                <li key={perk} className="flex items-center gap-2 text-xs text-gray-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C6E36C]" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <Button
            onClick={onClose}
            className="w-full gap-2 text-sm bg-gradient-to-r from-[#C6E36C] to-[#a8c94e] text-[#0d1117] hover:opacity-90 font-semibold"
            style={{ animation: "fadeSlideUp 0.5s 0.8s ease-out both" }}
          >
            <Sparkles className="w-4 h-4" />
            ¡Empezar a crear!
            <ArrowRight className="w-4 h-4" />
          </Button>

          {/* Vorea branding */}
          <p
            className="text-[10px] text-gray-600 mt-4"
            style={{ animation: "fadeSlideUp 0.5s 0.8s ease-out both" }}
          >
            Gracias por confiar en Vorea Studio — voreastudio.com
          </p>
        </div>

        {/* Animations */}
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes celebrateIn {
            from { opacity: 0; transform: scale(0.8) translateY(30px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes bounceIn {
            from { opacity: 0; transform: scale(0.3); }
            50%  { opacity: 1; transform: scale(1.1); }
            to   { transform: scale(1); }
          }
          @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes confettiFall {
            0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
            100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
          }
          @keyframes sparkle {
            0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
            50%      { opacity: 1; transform: scale(1.2) rotate(180deg); }
          }
          @keyframes rewardPop {
            from { opacity: 0; transform: scale(0.3) translateY(10px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}
