/**
 * GA4 Data API v1 client — server-only.
 * Authenticates with a Google Cloud service account and runs reports against
 * the GA4 Data API to extract actionable metrics for the AI insights system.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Ga4MetricRow {
  dimensions: Record<string, string>;
  metrics: Record<string, number>;
}

export interface Ga4Report {
  rows: Ga4MetricRow[];
}

export interface Ga4MetricsBundle {
  period: string;
  fetchedAt: string;
  overview: {
    sessions: number;
    activeUsers: number;
    newUsers: number;
    bounceRate: number;
  };
  topEvents: Ga4MetricRow[];
  toolUsage: Ga4MetricRow[];
  exportEvents: Ga4MetricRow[];
  signupFunnel: Ga4MetricRow[];
  topPages: Ga4MetricRow[];
  pricingClicks: Ga4MetricRow[];
}

// ─── Service Account JWT Auth ────────────────────────────────────────────────

const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GA4_API = "https://analyticsdata.googleapis.com/v1beta";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export function isGa4Configured(): boolean {
  return Boolean(
    String(process.env.GA4_PROPERTY_ID || "").trim() &&
    String(process.env.GA4_SERVICE_ACCOUNT_KEY || "").trim()
  );
}

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

async function getServiceAccountKey(): Promise<{
  client_email: string;
  private_key: string;
} | null> {
  const raw = process.env.GA4_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function signJwt(payload: string, privateKeyPem: string): Promise<string> {
  const crypto = await import("crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(payload);
  sign.end();
  const signature = sign.sign(privateKeyPem, "base64url");
  return signature;
}

async function getAccessToken(): Promise<string | null> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60_000) {
    return cachedAccessToken.token;
  }

  const key = await getServiceAccountKey();
  if (!key) {
    console.log("[ga4] GA4_SERVICE_ACCOUNT_KEY not configured");
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: GA4_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );

  const signature = await signJwt(`${header}.${claims}`, key.private_key);
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    console.log(`[ga4] Token exchange failed: ${res.status}`);
    return null;
  }

  const data = await res.json();
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedAccessToken.token;
}

// ─── GA4 Report Runner ───────────────────────────────────────────────────────

function getPropertyId(): string | null {
  const propertyId = String(process.env.GA4_PROPERTY_ID || "").trim();
  if (!propertyId) {
    console.log("[ga4] GA4_PROPERTY_ID not configured");
    return null;
  }
  return propertyId;
}

function periodToDays(period: string): number {
  if (period === "90d") return 90;
  if (period === "30d") return 30;
  return 7;
}

async function runReport(
  propertyId: string,
  token: string,
  dimensions: string[],
  metrics: string[],
  dateRange: { startDate: string; endDate: string },
  dimensionFilter?: Record<string, unknown>,
  limit = 25
): Promise<Ga4MetricRow[]> {
  const url = `${GA4_API}/properties/${propertyId}:runReport`;

  const body: Record<string, unknown> = {
    dateRanges: [dateRange],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    limit,
  };
  if (dimensionFilter) {
    body.dimensionFilter = dimensionFilter;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.log(`[ga4] runReport error ${res.status}: ${err.slice(0, 300)}`);
    return [];
  }

  const data = await res.json();
  if (!data.rows) return [];

  return data.rows.map((row: any) => ({
    dimensions: Object.fromEntries(
      (row.dimensionValues || []).map((v: any, i: number) => [
        dimensions[i],
        v.value,
      ])
    ),
    metrics: Object.fromEntries(
      (row.metricValues || []).map((v: any, i: number) => [
        metrics[i],
        parseFloat(v.value) || 0,
      ])
    ),
  }));
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function fetchGa4Metrics(
  period: string = "7d"
): Promise<Ga4MetricsBundle | null> {
  const propertyId = getPropertyId();
  if (!propertyId) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const days = periodToDays(period);
  const dateRange = { startDate: `${days}daysAgo`, endDate: "today" };

  const [overview, topEvents, toolUsage, exportEvents, signupFunnel, topPages, pricingClicks] =
    await Promise.all([
      // Overview metrics
      runReport(propertyId, token, [], ["sessions", "activeUsers", "newUsers", "bounceRate"], dateRange),

      // Top events by count
      runReport(propertyId, token, ["eventName"], ["eventCount"], dateRange, undefined, 20),

      // Tool usage (open_tool events by customEvent:tool)
      runReport(
        propertyId,
        token,
        ["customEvent:tool"],
        ["eventCount"],
        dateRange,
        {
          filter: {
            fieldName: "eventName",
            stringFilter: { value: "open_tool", matchType: "EXACT" },
          },
        },
        15
      ),

      // Export events
      runReport(
        propertyId,
        token,
        ["eventName"],
        ["eventCount"],
        dateRange,
        {
          filter: {
            fieldName: "eventName",
            stringFilter: { value: "export_", matchType: "BEGINS_WITH" },
          },
        },
        10
      ),

      // Signup funnel events
      runReport(
        propertyId,
        token,
        ["eventName"],
        ["eventCount"],
        dateRange,
        {
          filter: {
            fieldName: "eventName",
            inListFilter: {
              values: [
                { value: "sign_up_start" },
                { value: "sign_up_complete" },
                { value: "landing_view" },
                { value: "pricing_plan_click" },
              ],
            },
          },
        },
        10
      ),

      // Top pages
      runReport(propertyId, token, ["pagePath"], ["screenPageViews", "activeUsers"], dateRange, undefined, 15),

      // Pricing clicks by plan
      runReport(
        propertyId,
        token,
        ["customEvent:plan"],
        ["eventCount"],
        dateRange,
        {
          filter: {
            fieldName: "eventName",
            stringFilter: { value: "pricing_plan_click", matchType: "EXACT" },
          },
        },
        5
      ),
    ]);

  const ov = overview[0] || { dimensions: {}, metrics: {} };

  return {
    period,
    fetchedAt: new Date().toISOString(),
    overview: {
      sessions: ov.metrics.sessions || 0,
      activeUsers: ov.metrics.activeUsers || 0,
      newUsers: ov.metrics.newUsers || 0,
      bounceRate: ov.metrics.bounceRate || 0,
    },
    topEvents,
    toolUsage,
    exportEvents,
    signupFunnel,
    topPages,
    pricingClicks,
  };
}

/**
 * Generate mock metrics for development/testing when GA4 is not configured.
 */
export function generateMockMetrics(period: string): Ga4MetricsBundle {
  return {
    period,
    fetchedAt: new Date().toISOString(),
    overview: {
      sessions: 1247,
      activeUsers: 843,
      newUsers: 312,
      bounceRate: 0.42,
    },
    topEvents: [
      { dimensions: { eventName: "page_view" }, metrics: { eventCount: 4521 } },
      { dimensions: { eventName: "open_tool" }, metrics: { eventCount: 1834 } },
      { dimensions: { eventName: "landing_view" }, metrics: { eventCount: 967 } },
      { dimensions: { eventName: "export_stl" }, metrics: { eventCount: 234 } },
      { dimensions: { eventName: "sign_up_complete" }, metrics: { eventCount: 89 } },
      { dimensions: { eventName: "export_obj" }, metrics: { eventCount: 67 } },
      { dimensions: { eventName: "makerworld_lint" }, metrics: { eventCount: 156 } },
      { dimensions: { eventName: "pricing_plan_click" }, metrics: { eventCount: 124 } },
      { dimensions: { eventName: "sign_up_start" }, metrics: { eventCount: 198 } },
      { dimensions: { eventName: "export_scad" }, metrics: { eventCount: 45 } },
    ],
    toolUsage: [
      { dimensions: { "customEvent:tool": "studio" }, metrics: { eventCount: 612 } },
      { dimensions: { "customEvent:tool": "relief" }, metrics: { eventCount: 287 } },
      { dimensions: { "customEvent:tool": "ai_studio" }, metrics: { eventCount: 341 } },
      { dimensions: { "customEvent:tool": "organic" }, metrics: { eventCount: 198 } },
      { dimensions: { "customEvent:tool": "makerworld" }, metrics: { eventCount: 156 } },
      { dimensions: { "customEvent:tool": "pricing" }, metrics: { eventCount: 124 } },
      { dimensions: { "customEvent:tool": "community" }, metrics: { eventCount: 89 } },
      { dimensions: { "customEvent:tool": "gcode" }, metrics: { eventCount: 27 } },
    ],
    exportEvents: [
      { dimensions: { eventName: "export_stl" }, metrics: { eventCount: 234 } },
      { dimensions: { eventName: "export_obj" }, metrics: { eventCount: 67 } },
      { dimensions: { eventName: "export_scad" }, metrics: { eventCount: 45 } },
    ],
    signupFunnel: [
      { dimensions: { eventName: "landing_view" }, metrics: { eventCount: 967 } },
      { dimensions: { eventName: "sign_up_start" }, metrics: { eventCount: 198 } },
      { dimensions: { eventName: "sign_up_complete" }, metrics: { eventCount: 89 } },
      { dimensions: { eventName: "pricing_plan_click" }, metrics: { eventCount: 124 } },
    ],
    topPages: [
      { dimensions: { pagePath: "/" }, metrics: { screenPageViews: 1823, activeUsers: 654 } },
      { dimensions: { pagePath: "/studio" }, metrics: { screenPageViews: 612, activeUsers: 387 } },
      { dimensions: { pagePath: "/ai-studio" }, metrics: { screenPageViews: 341, activeUsers: 201 } },
      { dimensions: { pagePath: "/planes" }, metrics: { screenPageViews: 298, activeUsers: 178 } },
      { dimensions: { pagePath: "/relief" }, metrics: { screenPageViews: 287, activeUsers: 156 } },
      { dimensions: { pagePath: "/noticias" }, metrics: { screenPageViews: 234, activeUsers: 123 } },
    ],
    pricingClicks: [
      { dimensions: { "customEvent:plan": "PRO" }, metrics: { eventCount: 78 } },
      { dimensions: { "customEvent:plan": "STUDIO PRO" }, metrics: { eventCount: 46 } },
    ],
  };
}
