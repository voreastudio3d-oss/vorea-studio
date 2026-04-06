export type PublicRouteMeta = {
  title: string;
  description: string;
};

export type PublicRouteLocale = "es" | "en" | "pt";

export function normalizePublicRouteLocale(locale: string): PublicRouteLocale {
  const value = String(locale || "es").trim().toLowerCase();
  if (value.startsWith("en")) return "en";
  if (value.startsWith("pt")) return "pt";
  return "es";
}

const PUBLIC_ROUTE_META: Record<PublicRouteLocale, Record<string, PublicRouteMeta>> = {
  en: {
    "/": {
      title: "Vorea Studio | Parametric 3D, community and AI Studio",
      description: "Design parametric 3D models, explore the maker community and try AI Studio workflows in Vorea Studio.",
    },
    "/plans": {
      title: "Plans and credits | Vorea Studio",
      description: "Compare Vorea Studio plans, credits and paid features for parametric, community and AI-assisted workflows.",
    },
    "/contact": {
      title: "Contact | Vorea Studio",
      description: "Contact the Vorea Studio team for support, partnerships or commercial requests.",
    },
    "/contributors": {
      title: "Contributors | Vorea Studio",
      description: "Meet the people who voluntarily support improvements and experimentation across Vorea Studio.",
    },
    "/community": {
      title: "Community | Vorea Studio",
      description: "Explore public 3D models, creators and shared experiments from the Vorea Studio community.",
    },
    "/for/makers": {
      title: "Parametric 3D design for makers | Vorea Studio",
      description: "Create, customize and export parametric 3D models from your browser. Start free and export when your design is ready.",
    },
    "/for/ai-creators": {
      title: "AI Studio for 3D creators | Vorea Studio",
      description: "Start from a text prompt and refine editable parametric 3D models with AI Studio.",
    },
    "/for/education": {
      title: "Parametric 3D design for education | Vorea Studio",
      description: "Teach geometry, design and computational thinking with browser-based parametric 3D modeling.",
    },
  },
  es: {
    "/": {
      title: "Vorea Studio | 3D paramétrico, comunidad y AI Studio",
      description: "Diseña modelos 3D paramétricos, explora la comunidad maker y prueba flujos AI Studio en Vorea Studio.",
    },
    "/plans": {
      title: "Planes y créditos | Vorea Studio",
      description: "Consulta planes, créditos y funciones pagas de Vorea Studio para flujos paramétricos, comunidad e IA asistida.",
    },
    "/contact": {
      title: "Contacto | Vorea Studio",
      description: "Contacta al equipo de Vorea Studio para soporte, alianzas o consultas comerciales.",
    },
    "/contributors": {
      title: "Colaboradores | Vorea Studio",
      description: "Conoce a quienes apoyan voluntariamente mejoras y experimentación dentro de Vorea Studio.",
    },
    "/community": {
      title: "Comunidad | Vorea Studio",
      description: "Explora modelos 3D públicos, creadores y experimentos compartidos de la comunidad de Vorea Studio.",
    },
    "/for/makers": {
      title: "Diseño paramétrico 3D para makers | Vorea Studio",
      description: "Creá, personalizá y exportá modelos 3D paramétricos desde el navegador. Empezá gratis y exportá cuando tu diseño esté listo.",
    },
    "/for/ai-creators": {
      title: "AI Studio para creadores 3D | Vorea Studio",
      description: "Partí de un prompt y refiná modelos 3D paramétricos editables con AI Studio.",
    },
    "/for/education": {
      title: "Diseño 3D paramétrico para educación | Vorea Studio",
      description: "Enseñá geometría, diseño y pensamiento computacional con modelado 3D paramétrico en navegador.",
    },
  },
  pt: {
    "/": {
      title: "Vorea Studio | 3D paramétrico, comunidade e AI Studio",
      description: "Crie modelos 3D paramétricos, explore a comunidade maker e experimente fluxos do AI Studio na Vorea.",
    },
    "/plans": {
      title: "Planos e créditos | Vorea Studio",
      description: "Compare planos, créditos e recursos pagos da Vorea Studio para fluxos paramétricos, comunidade e IA assistida.",
    },
    "/contact": {
      title: "Contato | Vorea Studio",
      description: "Fale com a equipe da Vorea Studio para suporte, parcerias ou consultas comerciais.",
    },
    "/contributors": {
      title: "Colaboradores | Vorea Studio",
      description: "Conheça as pessoas que apoiam voluntariamente melhorias e experimentação dentro da Vorea Studio.",
    },
    "/community": {
      title: "Comunidade | Vorea Studio",
      description: "Explore modelos 3D públicos, criadores e experimentos compartilhados da comunidade Vorea Studio.",
    },
    "/for/makers": {
      title: "Design 3D paramétrico para makers | Vorea Studio",
      description: "Crie, personalize e exporte modelos 3D paramétricos direto do navegador. Comece grátis e exporte quando o design estiver pronto.",
    },
    "/for/ai-creators": {
      title: "AI Studio para criadores 3D | Vorea Studio",
      description: "Comece com um prompt e refine modelos 3D paramétricos editáveis com o AI Studio.",
    },
    "/for/education": {
      title: "Design 3D paramétrico para educação | Vorea Studio",
      description: "Ensine geometria, design e pensamento computacional com modelagem 3D paramétrica no navegador.",
    },
  },
};

export function getPublicRouteMeta(pathname: string, locale: string): PublicRouteMeta | null {
  const normalizedLocale = normalizePublicRouteLocale(locale);
  return PUBLIC_ROUTE_META[normalizedLocale][pathname] || null;
}
