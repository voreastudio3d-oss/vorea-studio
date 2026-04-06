/**
 * Application configuration.
 * CRIT-3 FIX: All values read from environment variables only — no hardcoded keys.
 *
 * Note: Supabase-specific exports removed during Phase B auth migration.
 * Now only provides apiUrl and ownerEmail for the self-hosted auth system.
 */

const env: Record<string, string> = (typeof import.meta !== "undefined" && import.meta.env) || {};

function requireEnv(key: string, fallback?: string): string {
  const val = env[key] || fallback;
  if (!val) {
    console.error(`[Config] Missing required env var: ${key}. Check your .env file.`);
    return "";
  }
  return val;
}

export const apiUrl: string =
  requireEnv("VITE_API_URL", "/api");

export const ownerEmail: string =
  requireEnv("VITE_OWNER_EMAIL");