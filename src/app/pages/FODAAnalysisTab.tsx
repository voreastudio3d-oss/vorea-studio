import { useState } from "react";
import { Shield, TrendingUp, AlertTriangle, Target } from "lucide-react";

interface FodaItem {
  text: string;
  impact: "high" | "medium" | "low";
}

interface FodaQuadrant {
  id: string;
  label: string;
  labelEn: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  items: FodaItem[];
}

const FODA_DATA: FodaQuadrant[] = [
  {
    id: "strengths",
    label: "Fortalezas",
    labelEn: "Strengths",
    icon: <Shield className="w-5 h-5" />,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    items: [
      { text: "Motor IA multi-proveedor (5 LLMs) con routing, fallback y budget breaker", impact: "high" },
      { text: "Pipeline paramétrico completo: prompt → SCAD → mesh → 3MF/STL", impact: "high" },
      { text: "Exportación multi-color 3MF (hybrid + slic3r-strict) con geometría manifold", impact: "high" },
      { text: "Monetización diversificada: suscripciones + créditos + donaciones", impact: "medium" },
      { text: "1400+ tests, 91%+ coverage, governance automatizada", impact: "medium" },
      { text: "Stack moderno (React 18 + Vite + Hono + Prisma 7.5)", impact: "low" },
    ],
  },
  {
    id: "weaknesses",
    label: "Debilidades",
    labelEn: "Weaknesses",
    icon: <AlertTriangle className="w-5 h-5" />,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    items: [
      { text: "Dependencia total de proveedores IA externos (sin modelo propio)", impact: "high" },
      { text: "Single-developer bottleneck (bus factor = 1)", impact: "high" },
      { text: "Motor SCAD interpretado con limitaciones vs OpenSCAD nativo", impact: "medium" },
      { text: "Base de usuarios sin validar, ratio conversión desconocido", impact: "medium" },
      { text: "Documentación API incompleta", impact: "low" },
      { text: "Sin staging environment dedicado, deploy manual", impact: "low" },
    ],
  },
  {
    id: "opportunities",
    label: "Oportunidades",
    labelEn: "Opportunities",
    icon: <TrendingUp className="w-5 h-5" />,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    items: [
      { text: "Mercado 3D printing: $16B proyectado 2027, FDM multi-color en expansión", impact: "high" },
      { text: "AI-native design: ningún competidor ofrece generación SCAD paramétrica", impact: "high" },
      { text: "Nichos educación y makers con landings dedicadas", impact: "medium" },
      { text: "API pública B2B como servicio de generación para otras plataformas", impact: "medium" },
      { text: "Marketplace de diseños paramétricos (creator economy)", impact: "medium" },
      { text: "Expansión multi-idioma a hispanos y asiáticos", impact: "low" },
    ],
  },
  {
    id: "threats",
    label: "Amenazas",
    labelEn: "Threats",
    icon: <Target className="w-5 h-5" />,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    items: [
      { text: "Competidores con capital (MakerWorld/Bambu Lab, Thangs $15M)", impact: "high" },
      { text: "Incrementos de costo en APIs IA (OpenAI/Anthropic pricing)", impact: "high" },
      { text: "EU AI Act y regulaciones IA emergentes", impact: "medium" },
      { text: "Fatiga de suscripciones vs herramientas gratuitas", impact: "medium" },
      { text: "Downtime de proveedores (Gemini 429s observados)", impact: "low" },
      { text: "Patent trolls en espacio de generación 3D", impact: "low" },
    ],
  },
];

const ROADMAP = [
  { month: "Abril 2026", label: "Estabilidad", detail: "Relief manifold ✅, governance ✅, monetization smoke ✅", done: true },
  { month: "Mayo 2026", label: "Motor IA v2", detail: "Self-healing SCAD v2, Kimi tuning, prompt library" },
  { month: "Junio 2026", label: "Comunidad", detail: "Marketplace beta, creator profiles, model sharing" },
  { month: "Julio 2026", label: "Educación", detail: "STEM curriculum, classroom licensing, tutorials" },
  { month: "Agosto 2026", label: "API pública", detail: "REST API v1 beta, developer docs, sandbox" },
  { month: "Septiembre 2026", label: "Escala", detail: "CDN, auto-scaling, monitoring, Series A prep" },
];

const IMPACT_BADGE: Record<string, string> = {
  high: "bg-red-500/20 text-red-300 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  low: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export function FODAAnalysisTab() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Análisis FODA — Q2 2026</h2>
        <p className="text-sm text-white/50 mt-1">Evaluación estratégica de Vorea Studio 3D</p>
      </div>

      {/* FODA Quadrant Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FODA_DATA.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setExpanded(expanded === q.id ? null : q.id)}
            className={`${q.bgColor} ${q.borderColor} border rounded-lg p-4 text-left transition-all hover:brightness-110 w-full`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className={q.color}>{q.icon}</span>
              <h3 className={`font-semibold ${q.color}`}>{q.label}</h3>
              <span className="text-xs text-white/30 ml-auto">{q.labelEn}</span>
            </div>
            <ul className="space-y-2">
              {q.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border mt-0.5 shrink-0 ${IMPACT_BADGE[item.impact]}`}>
                    {item.impact === "high" ? "ALTO" : item.impact === "medium" ? "MEDIO" : "BAJO"}
                  </span>
                  <span className="text-white/80">{item.text}</span>
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      {/* Roadmap Timeline */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-4">Roadmap 6 Meses</h3>
        <div className="space-y-3">
          {ROADMAP.map((r, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full shrink-0 ${r.done ? "bg-emerald-500" : "bg-white/20"}`} />
                {i < ROADMAP.length - 1 && <div className="w-px h-6 bg-white/10" />}
              </div>
              <div className="flex-1 -mt-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white/60">{r.month}</span>
                  <span className={`text-sm font-semibold ${r.done ? "text-emerald-400" : "text-white"}`}>{r.label}</span>
                </div>
                <p className="text-xs text-white/40 mt-0.5">{r.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
