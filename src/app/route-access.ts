import type { LucideIcon } from "lucide-react";
import {
  Code,
  Image as ImageIcon,
  MessageSquare,
  Printer,
  Sparkles,
  Waves,
  Wrench,
} from "lucide-react";

export type RouteAccessLevel = "public" | "trial" | "auth" | "superadmin";

type RouteAccessPolicy = {
  match: string;
  access: RouteAccessLevel;
  mode?: "exact" | "prefix";
};

export type ToolNavItem = {
  key: string;
  route: string;
  icon: LucideIcon;
  desc: string;
  color: string;
  access: RouteAccessLevel;
  activePrefixes: string[];
};

const ROUTE_ACCESS_POLICIES: RouteAccessPolicy[] = [
  { match: "/", access: "public" },
  { match: "/plans", access: "public" },
  { match: "/news", access: "public", mode: "prefix" },
  { match: "/model", access: "public", mode: "prefix" },
  { match: "/user", access: "public", mode: "prefix" },
  { match: "/terms", access: "public" },
  { match: "/privacy", access: "public" },
  { match: "/contact", access: "public" },
  { match: "/community", access: "public" },
  { match: "/contributors", access: "public" },
  { match: "/for", access: "public", mode: "prefix" },
  { match: "/studio", access: "trial", mode: "prefix" },

  { match: "/organic", access: "trial", mode: "prefix" },
  { match: "/relief", access: "trial", mode: "prefix" },
  { match: "/makerworld", access: "trial", mode: "prefix" },
  { match: "/ai-studio", access: "trial", mode: "prefix" },
  { match: "/profile", access: "auth", mode: "prefix" },
  { match: "/gcode-collection", access: "auth", mode: "prefix" },
  { match: "/admin", access: "superadmin", mode: "prefix" },
];

export const TOOL_NAV_ITEMS: ToolNavItem[] = [
  {
    key: "nav.tool.studio",
    route: "/studio?mode=parametric",
    icon: Wrench,
    desc: "Diseño SCAD paramétrico en vivo",
    color: "text-[#C6E36C]",
    access: "trial",
    activePrefixes: ["/studio"],
  },
  {
    key: "nav.tool.organic",
    route: "/organic",
    icon: Waves,
    desc: "Deformación y generadores 2D a 3D",
    color: "text-red-400",
    access: "trial",
    activePrefixes: ["/organic"],
  },
  {
    key: "nav.tool.relief",
    route: "/relief",
    icon: ImageIcon,
    desc: "Crea mallas complejas desde imágenes",
    color: "text-cyan-400",
    access: "trial",
    activePrefixes: ["/relief"],
  },
  {
    key: "nav.tool.aiStudio",
    route: "/ai-studio",
    icon: Sparkles,
    desc: "Generación Text-to-3D inteligente",
    color: "text-purple-400",
    access: "trial",
    activePrefixes: ["/ai-studio"],
  },
  {
    key: "nav.tool.makerworld",
    route: "/makerworld",
    icon: Printer,
    desc: "Lint y preparación para MakerWorld",
    color: "text-orange-400",
    access: "trial",
    activePrefixes: ["/makerworld"],
  },
  {
    key: "nav.tool.gcode",
    route: "/gcode-collection",
    icon: Code,
    desc: "Tus archivos listos para imprimir",
    color: "text-gray-400",
    access: "auth",
    activePrefixes: ["/gcode-collection"],
  },
];

function normalizePath(pathname: string): string {
  const value = String(pathname || "/").trim() || "/";
  if (value === "/") return "/";
  return value.startsWith("/") ? value.replace(/\/+$/, "") : `/${value.replace(/\/+$/, "")}`;
}

function matchesPolicy(pathname: string, policy: RouteAccessPolicy): boolean {
  const normalized = normalizePath(pathname);
  const match = normalizePath(policy.match);
  if (policy.mode === "prefix") {
    return normalized === match || normalized.startsWith(`${match}/`);
  }
  return normalized === match;
}

export function getRouteAccessLevel(pathname: string): RouteAccessLevel {
  for (const policy of ROUTE_ACCESS_POLICIES) {
    if (matchesPolicy(pathname, policy)) return policy.access;
  }
  return "public";
}

export function isAuthRoute(pathname: string): boolean {
  return getRouteAccessLevel(pathname) === "auth";
}

export function isSuperAdminRoute(pathname: string): boolean {
  return getRouteAccessLevel(pathname) === "superadmin";
}

export function isToolRouteActive(item: ToolNavItem, pathname: string): boolean {
  const normalized = normalizePath(pathname);
  return item.activePrefixes.some((prefix) => {
    const match = normalizePath(prefix);
    return normalized === match || normalized.startsWith(`${match}/`);
  });
}

export function getVisibleToolNavItems(input: {
  isLoggedIn: boolean;
  isSuperAdmin: boolean;
}): ToolNavItem[] {
  return TOOL_NAV_ITEMS.filter((item) => {
    if (item.access === "trial") return true;
    if (item.access === "auth") return input.isLoggedIn;
    if (item.access === "superadmin") return input.isSuperAdmin;
    return true;
  });
}
