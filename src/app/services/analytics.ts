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
  window.gtag("config", MEASUREMENT_ID, {
    send_page_view: false,
  });
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
