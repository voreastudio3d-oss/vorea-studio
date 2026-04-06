import { useLocation, useNavigate, pathStartsWith } from "../nav";
import { ChevronRight, Home } from "lucide-react";
import { useI18n } from "../services/i18n-context";

const TOOL_PAGES = [
  "/organic",
  "/ai-studio",
  "/makerworld",
  "/noticias",
  "/gcode-collection",
  "/admin",
  "/relief",
];

const PAGE_KEYS: Record<string, string> = {
  "/": "breadcrumb.home",
  "/studio": "breadcrumb.studio",
  "/comunidad": "breadcrumb.community",
  "/perfil": "breadcrumb.profile",
  "/organic": "breadcrumb.organic",
  "/ai-studio": "breadcrumb.aiStudio",
  "/makerworld": "breadcrumb.makerworld",
  "/noticias": "breadcrumb.news",
  "/planes": "breadcrumb.plans",
  "/gcode-collection": "breadcrumb.gcode",
  "/admin": "breadcrumb.admin",
  "/relief": "breadcrumb.relief",
  "/terminos": "breadcrumb.terms",
  "/privacidad": "breadcrumb.privacy",
  "/contacto": "breadcrumb.contact",
};

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();

  const basePath = "/" + (pathname.split("/").filter(Boolean)[0] ?? "");
  const isToolPage = TOOL_PAGES.includes(basePath);

  const showBreadcrumbs =
    isToolPage ||
    pathStartsWith(pathname, "/noticias") ||
    basePath === "/planes" ||
    basePath === "/terminos" ||
    basePath === "/privacidad" ||
    basePath === "/contacto" ||
    pathStartsWith(pathname, "/modelo") ||
    pathStartsWith(pathname, "/user");

  if (!showBreadcrumbs) return null;

  const crumbs: Array<{ label: string; route?: string }> = [
    { label: t("breadcrumb.home"), route: "/" },
  ];

  if (isToolPage) {
    crumbs.push({ label: t("nav.tools") });
  }

  if (pathStartsWith(pathname, "/modelo")) {
    crumbs.push({ label: t("nav.community"), route: "/comunidad" });
    crumbs.push({ label: "Modelo" });
  } else if (pathStartsWith(pathname, "/user")) {
    crumbs.push({ label: t("nav.community"), route: "/comunidad" });
    crumbs.push({ label: "Usuario" });
  } else {
    const key = PAGE_KEYS[basePath];
    crumbs.push({ label: key ? t(key) : basePath });
  }

  return (
    <div className="border-b border-[rgba(168,187,238,0.08)] bg-[rgba(26,31,54,0.2)]">
      <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center gap-1.5 text-xs">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />
              )}
              {i === 0 && (
                <Home className="w-3 h-3 mr-0.5 text-gray-500" />
              )}
              {crumb.route && !isLast ? (
                <button
                  onClick={() => navigate(crumb.route!)}
                  className="text-gray-400 hover:text-[#C6E36C] transition-colors"
                >
                  {crumb.label}
                </button>
              ) : (
                <span
                  className={
                    isLast ? "text-[#C6E36C]" : "text-gray-500"
                  }
                >
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
