/**
 * History-based navigation system — Vorea Studio
 *
 * Syncs app state with the browser URL so routes are shareable,
 * bookmarkable, back/forward compatible, and deep-linkable.
 *
 * Locale prefix routing:
 *   /:lang/plans → strips lang, exposes /plans to the app
 *   navigate("/plans") → pushes /:lang/plans to the browser
 *
 * Legacy hash routes such as /#/modelo/:id or /#/studio?project=abc
 * are normalized to clean URLs on first load.
 *
 * Legacy Spanish slugs (e.g. /comunidad) are mapped to English on first load.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type AnchorHTMLAttributes,
  type MouseEvent,
} from "react";

// ─── Supported languages ──────────────────────────────────────────────────────

export const SUPPORTED_LANGS = ["es", "en", "pt"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];
export const DEFAULT_LANG: SupportedLang = "es";

function isLang(segment: string): segment is SupportedLang {
  return (SUPPORTED_LANGS as readonly string[]).includes(segment);
}

// ─── Legacy Spanish → English slug mapping ──────────────────────────────────

const LEGACY_SLUG_MAP: Record<string, string> = {
  "/comunidad": "/community",
  "/planes": "/plans",
  "/noticias": "/news",
  "/perfil": "/profile",
  "/contacto": "/contact",
  "/colaboradores": "/contributors",
  "/terminos": "/terms",
  "/privacidad": "/privacy",
  "/modelo": "/model",
  "/comparativa": "/benchmark",
};

function mapLegacySlugs(pathname: string): string {
  // Exact match first
  if (LEGACY_SLUG_MAP[pathname]) return LEGACY_SLUG_MAP[pathname];
  // Prefix match (e.g. /noticias/slug → /news/slug, /modelo/id/name → /model/id/name)
  for (const [legacy, modern] of Object.entries(LEGACY_SLUG_MAP)) {
    if (pathname.startsWith(legacy + "/")) {
      return modern + pathname.slice(legacy.length);
    }
  }
  return pathname;
}

// ─── Static paths (English slugs) ────────────────────────────────────────────

export type StaticPath =
  | "/"
  | "/community"
  | "/studio"
  | "/profile"
  | "/organic"
  | "/ai-studio"
  | "/makerworld"
  | "/news"
  | "/plans"
  | "/gcode-collection"
  | "/admin"
  | "/relief"
  | "/terms"
  | "/privacy"
  | "/contact"
  | "/contributors"
  | "/benchmark";

export type PathName = StaticPath | `/${string}`;

// ─── Nav context ────────────────────────────────────────────────────────────

interface NavCtx {
  /** Bare pathname without /:lang prefix */
  pathname: string;
  search: string;
  navigate: (to: string) => void;
  params: Record<string, string>;
  /** Current language from URL prefix */
  lang: SupportedLang;
}

function mergeSearchStrings(primary: string, secondary: string): string {
  const params = new URLSearchParams(primary || "");
  new URLSearchParams(secondary || "").forEach((value, key) => {
    params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function parseLegacyHashRoute(hash: string): { pathname: string; search: string } {
  const h = hash.replace(/^#/, "") || "/";
  const qIdx = h.indexOf("?");
  if (qIdx >= 0) {
    return {
      pathname: h.slice(0, qIdx) || "/",
      search: h.slice(qIdx),
    };
  }
  return { pathname: h || "/", search: "" };
}

export function resolveLocationState(input: {
  pathname?: string | null;
  search?: string | null;
  hash?: string | null;
}): { pathname: string; search: string } {
  const pathname = input.pathname || "/";
  const search = input.search || "";
  const hash = input.hash || "";

  if (hash.startsWith("#/") || hash.startsWith("#?")) {
    const legacy = parseLegacyHashRoute(hash);
    return {
      pathname: legacy.pathname || "/",
      search: mergeSearchStrings(legacy.search, search),
    };
  }

  return {
    pathname: pathname || "/",
    search,
  };
}

// ─── Lang prefix extraction ────────────────────────────────────────────────

function detectBrowserLang(): SupportedLang {
  const nav = navigator.language || (navigator as any).userLanguage || "";
  const base = nav.split("-")[0].toLowerCase();
  if (isLang(base)) return base;
  return DEFAULT_LANG;
}

export function extractLangFromPath(pathname: string): {
  lang: SupportedLang;
  barePath: string;
} {
  // Match /:lang or /:lang/...
  const match = pathname.match(/^\/([a-z]{2})(\/.*)?$/);
  if (match && isLang(match[1])) {
    const barePath = match[2] || "/";
    return { lang: match[1], barePath };
  }
  // No lang prefix — detect from browser or localStorage
  const stored = localStorage.getItem("vorea-locale") || "";
  const storedBase = stored.split("-")[0].toLowerCase();
  const lang = isLang(storedBase) ? storedBase : detectBrowserLang();
  return { lang, barePath: pathname };
}

// ─── Read location ────────────────────────────────────────────────────────

function readLocation(): { pathname: string; search: string; lang: SupportedLang } {
  const resolved = resolveLocationState({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  });

  if (window.location.hash.startsWith("#/") || window.location.hash.startsWith("#?")) {
    const target = `${resolved.pathname}${resolved.search}`;
    const current = `${window.location.pathname || "/"}${window.location.search || ""}`;
    if (target !== current) {
      window.history.replaceState({}, "", target);
    }
  }

  // Extract lang prefix
  const { lang, barePath } = extractLangFromPath(resolved.pathname);

  // Map legacy Spanish slugs to English
  const modernPath = mapLegacySlugs(barePath);

  // If the URL didn't have a lang prefix, or had legacy slugs, fix the URL
  const expectedBrowserPath = `/${lang}${modernPath === "/" ? "" : modernPath}${resolved.search}`;
  const currentBrowserPath = `${window.location.pathname}${window.location.search}`;
  if (expectedBrowserPath !== currentBrowserPath) {
    window.history.replaceState({}, "", expectedBrowserPath);
  }

  return {
    pathname: modernPath,
    search: resolved.search,
    lang,
  };
}

// ─── Path helpers ────────────────────────────────────────────────────────────

export function matchPath(
  pattern: string,
  path: string
): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

export function pathStartsWith(path: string, prefix: string): boolean {
  if (prefix === "/") return path === "/";
  return path === prefix || path.startsWith(prefix + "/");
}

function normalizeNavigationTarget(to: string): string {
  if (!to) return "/";
  if (to.startsWith("/#/")) {
    return normalizeNavigationTarget(to.slice(2));
  }
  if (to.startsWith("#/") || to.startsWith("#?")) {
    const legacy = parseLegacyHashRoute(to);
    return `${legacy.pathname}${legacy.search}`;
  }
  if (/^https?:\/\//i.test(to)) {
    const url = new URL(to);
    if (url.origin !== window.location.origin) {
      return url.toString();
    }
    return `${url.pathname}${url.search}${url.hash}`;
  }
  return to.startsWith("/") ? to : `/${to.replace(/^\/+/, "")}`;
}

// ─── Provider ────────────────────────────────────────────────────────────────

const NavContext = createContext<NavCtx>({
  pathname: "/",
  search: "",
  navigate: () => {},
  params: {},
  lang: DEFAULT_LANG,
});

export function NavProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(readLocation);
  const previousPath = useRef(state.pathname);

  // Restore scroll to top on path change, similar to browser behavior
  useEffect(() => {
    if (previousPath.current !== state.pathname) {
      // Small timeout ensures the DOM has updated before scrolling
      setTimeout(() => window.scrollTo(0, 0), 0);
      previousPath.current = state.pathname;
    }
  }, [state.pathname]);

  useEffect(() => {
    const onPopState = () => setState(readLocation());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    const target = normalizeNavigationTarget(to);

    // External URLs — navigate directly
    if (/^https?:\/\//i.test(target)) {
      window.location.href = target;
      return;
    }

    // Prepend lang prefix to bare path
    const currentState = readLocation();
    const lang = currentState.lang;
    const fullTarget = target.startsWith(`/${lang}/`) || target === `/${lang}`
      ? target
      : `/${lang}${target.startsWith("/") ? target : `/${target}`}`;

    window.history.pushState({}, "", fullTarget);
    setState(readLocation());
  }, []);

  const ctx = useMemo<NavCtx>(() => ({
    pathname: state.pathname,
    search: state.search,
    navigate,
    params: {},
    lang: state.lang,
  }), [state.pathname, state.search, state.lang, navigate]);

  return (
    <NavContext.Provider value={ctx}>
      {children}
    </NavContext.Provider>
  );
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useLocation(): { pathname: string } {
  const { pathname } = useContext(NavContext);
  return { pathname };
}

export function useNavigate(): (to: string) => void {
  return useContext(NavContext).navigate;
}

export function useLang(): SupportedLang {
  return useContext(NavContext).lang;
}

export function useRouteMatch(pattern: string): Record<string, string> | null {
  const { pathname } = useContext(NavContext);
  return matchPath(pattern, pathname);
}

export function useSearchParams(): [URLSearchParams, (updates: Record<string, string | null>) => void] {
  const { search, navigate, pathname } = useContext(NavContext);
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const sp = new URLSearchParams(search);
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === undefined) {
          sp.delete(k);
        } else {
          sp.set(k, v);
        }
      }
      const qs = sp.toString();
      navigate(qs ? `${pathname}?${qs}` : pathname);
    },
    [search, navigate, pathname]
  );

  return [params, setParams];
}

export function useRawSearch(): string {
  return useContext(NavContext).search;
}

// ─── Link component ────────────────────────────────────────────────────────

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  children: ReactNode;
  className?: string;
}

function isModifiedEvent(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0;
}

function isExternalTarget(href: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(href) && !href.startsWith(window.location.origin);
}

export function Link({ to, children, className, onClick, target, ...rest }: LinkProps) {
  const { navigate, lang } = useContext(NavContext);
  const barePath = normalizeNavigationTarget(to);
  const isExternal = isExternalTarget(barePath);
  // Prepend lang prefix for internal links
  const href = isExternal
    ? barePath
    : `/${lang}${barePath.startsWith("/") ? barePath : `/${barePath}`}`;
  return (
    <a
      href={href}
      target={target}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (target === "_blank" || isModifiedEvent(e) || isExternal) return;
        e.preventDefault();
        navigate(barePath);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
