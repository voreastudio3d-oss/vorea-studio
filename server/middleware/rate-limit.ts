import { createMiddleware } from "hono/factory";

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (c: any) => string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitCheckResult {
  count: number;
  limit: number;
  limited: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number;
}

// ─── Distributed backend (KV/PostgreSQL) ──────────────────────────────────────
//
// When DATABASE_URL is configured, rate limit counters are stored in the
// kv_store table (already present in the project). Keys have the prefix
// `rl:` and consist of a JSONB payload with `count` and `resetAt`.
//
// This makes rate limiting work across multiple Railway instances without
// any additional infrastructure like Redis.
//
// When DATABASE_URL is not set (tests, quick local dev), the module falls
// back to the same in-memory Map that was used before.
// ──────────────────────────────────────────────────────────────────────────────

let _kvBackend: typeof import("../kv.js") | null = null;
let _backendResolved = false;

async function getKvBackend(): Promise<typeof import("../kv.js") | null> {
  if (_backendResolved) return _kvBackend;
  _backendResolved = true;

  // Only use KV backend when there is a real database
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    _kvBackend = await import("../kv.js");
    return _kvBackend;
  } catch {
    return null;
  }
}

// ─── In-memory fallback (dev / tests / no-DB) ────────────────────────────────

const memoryStore = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) {
      memoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ─── Core rate limit logic ──────────────────────────────────────────────────

function computeResult(
  entry: RateLimitEntry,
  maxRequests: number
): RateLimitCheckResult {
  const now = Date.now();
  const limited = entry.count > maxRequests;
  return {
    count: entry.count,
    limit: maxRequests,
    limited,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
    retryAfter: limited ? Math.ceil((entry.resetAt - now) / 1000) : 0,
  };
}

/**
 * Attempts distributed rate limit check via KV/PostgreSQL.
 * Returns null if the distributed backend is unavailable —
 * caller should fall back to in-memory.
 */
async function consumeDistributed(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitCheckResult | null> {
  const kv = await getKvBackend();
  if (!kv) return null;

  const rlKey = `rl:${key}`;
  const now = Date.now();

  try {
    const existing = (await kv.get(rlKey)) as RateLimitEntry | null;

    let entry: RateLimitEntry;
    if (!existing || now > existing.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
    } else {
      entry = { count: existing.count + 1, resetAt: existing.resetAt };
    }

    await kv.set(rlKey, entry);
    return computeResult(entry, maxRequests);
  } catch (err: any) {
    // If KV fails (e.g. DB connection issue), don't block the request —
    // fall back gracefully to in-memory.
    console.warn(`[rate-limit] distributed backend error, falling back: ${err.message}`);
    return null;
  }
}

function consumeMemory(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitCheckResult {
  const now = Date.now();
  let entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
  } else {
    entry.count++;
  }

  memoryStore.set(key, entry);
  return computeResult(entry, maxRequests);
}

// ─── Public API (unchanged interface) ───────────────────────────────────────

/**
 * Helper to determine client IP from Hono context.
 * Useful behind Cloudflare or proxy.
 */
export function getClientIp(c: any): string {
  const forwarded = c.req.header("x-forwarded-for");
  return (
    c.req.header("cf-connecting-ip") ||
    (forwarded ? forwarded.split(",")[0].trim() : "") ||
    c.req.header("x-real-ip") ||
    "127.0.0.1"
  );
}

/**
 * Consume a rate limit check for a given key.
 *
 * **Distributed by default:** when DATABASE_URL is set, uses KV/PostgreSQL
 * as the backing store so that rate limits are shared across multiple
 * server instances.
 *
 * Falls back transparently to in-memory if no database is configured or
 * if the database is temporarily unavailable.
 */
export async function consumeRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitCheckResult> {
  const distributed = await consumeDistributed(key, maxRequests, windowMs);
  if (distributed) return distributed;
  return consumeMemory(key, maxRequests, windowMs);
}

/**
 * Synchronous in-memory variant — used by test helpers and cold paths that
 * cannot await. Prefer the async `consumeRateLimit` for production code.
 */
export function consumeRateLimitSync(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitCheckResult {
  return consumeMemory(key, maxRequests, windowMs);
}

export function applyRateLimitHeaders(c: any, result: RateLimitCheckResult): void {
  c.header("X-RateLimit-Limit", result.limit.toString());
  c.header("X-RateLimit-Remaining", result.remaining.toString());
  c.header("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000).toString());

  if (result.limited) {
    c.header("Retry-After", result.retryAfter.toString());
  }
}

/**
 * Rate limiting middleware for Hono apps using sliding window approach.
 */
export function rateLimiter(options: RateLimiterOptions) {
  return createMiddleware(async (c, next) => {
    const key = options.keyGenerator ? options.keyGenerator(c) : getClientIp(c);
    const result = await consumeRateLimit(key, options.maxRequests, options.windowMs);

    applyRateLimitHeaders(c, result);

    if (result.limited) {
      return c.json(
        {
          error: options.message || "Demasiadas peticiones. Por favor, inténtelo de nuevo más tarde.",
          retryAfter: result.retryAfter,
        },
        429
      );
    }

    await next();
  });
}

/**
 * Resets the distributed backend resolution (for testing purposes).
 */
export function _resetBackendForTesting(): void {
  _kvBackend = null;
  _backendResolved = false;
  memoryStore.clear();
}
