const env =
  ((typeof import.meta !== "undefined" && import.meta.env) || {}) as Record<
    string,
    string | undefined
  >;

const MEASUREMENT_ID = String(env.VITE_GA4_MEASUREMENT_ID || "").trim();
let bootstrapped = false;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: any[]) => void;
  }
}

/* ─── Internal-route guard ─────────────────────────────────────────────────── */

const INTERNAL_PREFIXES = ["/admin", "/docs"];

/** Returns true for admin/docs/internal routes that must never generate analytics */
export function isInternalRoute(path: string): boolean {
  const normalized = path.replace(/^\/[a-z]{2}\//, "/");
  return INTERNAL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/* ─── Bootstrap ────────────────────────────────────────────────────────────── */

function ensureScriptTag(src: string) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

export function initAnalytics() {
  if (bootstrapped || !MEASUREMENT_ID || typeof window === "undefined") return;
  if (isInternalRoute(window.location.pathname)) return;
  bootstrapped = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(...args: any[]) {
      window.dataLayer?.push(args);
    };

  ensureScriptTag(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`);
  window.gtag("js", new Date());

  // Capture UTM params from URL and forward to GA4 config
  const utmParams = extractUtmParams();

  window.gtag("config", MEASUREMENT_ID, {
    send_page_view: false,
    ...utmParams,
  });
}

/* ─── UTM helpers ──────────────────────────────────────────────────────────── */

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

function extractUtmParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const val = params.get(key);
    if (val) result[key] = val;
  }
  // Persist to sessionStorage so SPA navigations keep UTMs
  if (Object.keys(result).length > 0) {
    try { sessionStorage.setItem("vorea_utm", JSON.stringify(result)); } catch { /* noop */ }
  }
  // Fallback: read from sessionStorage
  if (Object.keys(result).length === 0) {
    try {
      const stored = sessionStorage.getItem("vorea_utm");
      if (stored) return JSON.parse(stored);
    } catch { /* noop */ }
  }
  return result;
}

/** Get current UTM params (from URL or session) for enriching events */
export function getUtmParams(): Record<string, string> {
  return extractUtmParams();
}

/* ─── Event helpers ────────────────────────────────────────────────────────── */

export function trackAnalyticsEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | null | undefined>
) {
  if (!MEASUREMENT_ID || typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (isInternalRoute(window.location.pathname)) return;
  window.gtag("event", eventName, params || {});
}

export function trackPageView(pathname: string, title?: string) {
  if (!MEASUREMENT_ID || typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (isInternalRoute(pathname)) return;
  window.gtag("event", "page_view", {
    page_path: pathname,
    page_title: title || document.title,
  });
}
