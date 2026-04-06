/**
 * Auth Module — Self-hosted authentication (JWT + bcrypt)
 * Uses local PostgreSQL table `auth_users` for user authentication.
 * Replaces all Supabase auth functionality.
 *
 * Features:
 * - Password hashing with bcrypt (12 rounds)
 * - JWT tokens (7-day expiry)
 * - Auto-creates auth_users table on first use
 * - Google OAuth support (stores provider + google_id)
 *
 * This module is 100% self-hosted — no external auth dependencies.
 */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pg from "pg";
import crypto from "node:crypto";
import { resolveRegionCode, normalizeCountryCode } from "./profile-region-policy.js";

// ─── Configuration ────────────────────────────────────────────────────────────

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://vorea:vorea_dev@localhost:5432/vorea_studio";

const RAW_JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_SECRET = RAW_JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";
const BCRYPT_ROUNDS = 12;

if (!RAW_JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET es obligatorio en producción.");
  }
  console.warn("[auth] JWT_SECRET no está configurado. Usando fallback inseguro solo para desarrollo local.");
}

// ─── Database Pool (reuse from kv.ts pattern) ─────────────────────────────────

let _pool: pg.Pool | null = null;

function pool(): pg.Pool {
  if (!_pool) {
    _pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });
  }
  return _pool;
}

// ─── Ensure auth_users table exists ───────────────────────────────────────────

let _tableReady = false;

async function ensureAuthTables(): Promise<void> {
  if (_tableReady) return;
  await pool().query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      display_name TEXT NOT NULL DEFAULT '',
      username TEXT UNIQUE NOT NULL,
      tier TEXT NOT NULL DEFAULT 'FREE',
      role TEXT NOT NULL DEFAULT 'user',
      avatar_url TEXT,
      bio TEXT,
      website TEXT,
      phone TEXT,
      country_code TEXT,
      region_code TEXT,
      default_locale TEXT,
      billing_profile JSONB,
      email_verified_at TIMESTAMPTZ,
      phone_verified_at TIMESTAMPTZ,
      banned BOOLEAN NOT NULL DEFAULT false,
      provider TEXT NOT NULL DEFAULT 'email',
      google_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool().query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS phone TEXT`);
  await pool().query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS country_code TEXT`);
  await pool().query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS region_code TEXT`);
  await pool().query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS default_locale TEXT`);
  await pool().query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS billing_profile JSONB`);
  await pool().query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ`);
  await pool().query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ`);
  _tableReady = true;
}

// ─── JWT Functions ────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;  // user id
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function signJwt(userId: string, email: string, role: string): string {
  return jwt.sign(
    { sub: userId, email, role } as JwtPayload,
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// ─── Password Functions ───────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── User Types ───────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  password_hash: string | null;
  display_name: string;
  username: string;
  tier: string;
  role: string;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  phone: string | null;
  country_code: string | null;
  region_code: string | null;
  default_locale: string | null;
  billing_profile: Record<string, unknown> | null;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  banned: boolean;
  provider: string;
  google_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── User CRUD ────────────────────────────────────────────────────────────────

export async function createUser(
  email: string,
  password: string | null,
  metadata: {
    displayName?: string;
    username?: string;
    tier?: string;
    role?: string;
    avatarUrl?: string;
    provider?: string;
    googleId?: string;
  } = {}
): Promise<AuthUser> {
  await ensureAuthTables();

  const id = crypto.randomUUID();
  const passwordHash = password ? await hashPassword(password) : null;
  const displayName = metadata.displayName || email.split("@")[0];
  const username = metadata.username || `@${email.split("@")[0]}`;
  const tier = metadata.tier || "FREE";
  const role = metadata.role || "user";
  const provider = metadata.provider || "email";

  const { rows } = await pool().query(
    `INSERT INTO auth_users (id, email, password_hash, display_name, username, tier, role, avatar_url, provider, google_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [id, email, passwordHash, displayName, username, tier, role, metadata.avatarUrl || null, provider, metadata.googleId || null]
  );

  return rows[0] as AuthUser;
}

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  await ensureAuthTables();
  const { rows } = await pool().query(
    "SELECT * FROM auth_users WHERE email = $1 LIMIT 1",
    [email]
  );
  return rows.length > 0 ? (rows[0] as AuthUser) : null;
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  await ensureAuthTables();
  const { rows } = await pool().query(
    "SELECT * FROM auth_users WHERE id = $1 LIMIT 1",
    [id]
  );
  return rows.length > 0 ? (rows[0] as AuthUser) : null;
}

export async function getUserByGoogleId(googleId: string): Promise<AuthUser | null> {
  await ensureAuthTables();
  const { rows } = await pool().query(
    "SELECT * FROM auth_users WHERE google_id = $1 LIMIT 1",
    [googleId]
  );
  return rows.length > 0 ? (rows[0] as AuthUser) : null;
}

export async function updateUser(
  id: string,
  patch: Record<string, unknown>
): Promise<AuthUser | null> {
  await ensureAuthTables();

  // Whitelist allowed fields
  const allowed = [
    "display_name", "username", "tier", "role", "avatar_url",
    "bio", "website", "phone", "country_code", "region_code",
    "default_locale", "billing_profile", "email_verified_at", "phone_verified_at",
    "banned", "password_hash", "provider", "google_id"
  ];

  const setClauses: string[] = ["updated_at = NOW()"];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of allowed) {
    // Support camelCase → snake_case mapping
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const val = patch[key] ?? patch[camelKey];
    if (val !== undefined) {
      setClauses.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }
  }

  if (values.length === 0) {
    return getUserById(id);
  }

  values.push(id);
  const { rows } = await pool().query(
    `UPDATE auth_users SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );

  return rows.length > 0 ? (rows[0] as AuthUser) : null;
}

export async function deleteUser(id: string): Promise<boolean> {
  await ensureAuthTables();
  const { rowCount } = await pool().query(
    "DELETE FROM auth_users WHERE id = $1",
    [id]
  );
  return (rowCount ?? 0) > 0;
}

export async function listUsers(): Promise<AuthUser[]> {
  await ensureAuthTables();
  const { rows } = await pool().query(
    "SELECT * FROM auth_users ORDER BY created_at DESC"
  );
  return rows as AuthUser[];
}

// ─── Helper: Extract user ID from Authorization header ────────────────────────

export function getUserIdFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  if (!token) return null;
  const payload = verifyJwt(token);
  return payload?.sub ?? null;
}

// ─── Helper: Convert DB row to public profile ─────────────────────────────────

export function toPublicProfile(user: AuthUser): Record<string, unknown> {
  return {
    id: user.id,
    displayName: user.display_name,
    username: user.username,
    email: user.email,
    tier: user.tier,
    role: user.role,
    avatarUrl: user.avatar_url,
    bio: user.bio,
    website: user.website,
    phone: user.phone,
    countryCode: user.country_code,
    regionCode: user.region_code,
    defaultLocale: user.default_locale,
    billingProfile: user.billing_profile,
    emailVerifiedAt: user.email_verified_at,
    phoneVerifiedAt: user.phone_verified_at,
    banned: user.banned,
    createdAt: user.created_at,
  };
}

// ─── Regional Aggregation ─────────────────────────────────────────────────────

export interface RegionalStats {
  byRegion: Record<string, number>;
  byCountry: Array<{ country: string; count: number }>;
  totalWithCountry: number;
  totalWithoutCountry: number;
  total: number;
}

export async function getRegionalStats(): Promise<RegionalStats> {
  await ensureAuthTables();

  const regionResult = await pool().query(
    `SELECT COALESCE(region_code, 'UNKNOWN') AS region, COUNT(*)::int AS cnt
     FROM auth_users
     WHERE banned = false
     GROUP BY region_code
     ORDER BY cnt DESC`
  );

  const countryResult = await pool().query(
    `SELECT country_code AS country, COUNT(*)::int AS cnt
     FROM auth_users
     WHERE banned = false AND country_code IS NOT NULL AND country_code != ''
     GROUP BY country_code
     ORDER BY cnt DESC
     LIMIT 20`
  );

  const totalResult = await pool().query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(CASE WHEN country_code IS NOT NULL AND country_code != '' THEN 1 END)::int AS with_country
     FROM auth_users WHERE banned = false`
  );

  const byRegion: Record<string, number> = {};
  for (const row of regionResult.rows) {
    byRegion[row.region] = row.cnt;
  }

  const total = totalResult.rows[0]?.total || 0;
  const totalWithCountry = totalResult.rows[0]?.with_country || 0;

  return {
    byRegion,
    byCountry: countryResult.rows.map((r: any) => ({ country: r.country, count: r.cnt })),
    totalWithCountry,
    totalWithoutCountry: total - totalWithCountry,
    total,
  };
}

// ─── IP-based Country Detection ───────────────────────────────────────────────

/**
 * Extract country code from infrastructure headers (CF-IPCountry, X-Vercel-IP-Country, etc.)
 * and update the user's country_code + region_code if not yet set.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function updateUserGeoFromHeaders(
  userId: string,
  headers: Record<string, string | string[] | undefined>
): Promise<void> {
  try {
    // Extract country from infrastructure headers
    const raw =
      headers["cf-ipcountry"] ||
      headers["x-vercel-ip-country"] ||
      headers["x-country-code"] ||
      headers["x-real-country"] ||
      null;
    if (!raw) return;

    const cc = normalizeCountryCode(typeof raw === "string" ? raw : raw[0]);
    if (!cc || cc === "XX" || cc === "T1") return; // Tor/unknown

    // Only update if user doesn't already have a country set
    const { rows } = await pool().query(
      "SELECT country_code FROM auth_users WHERE id = $1",
      [userId]
    );
    if (rows.length === 0) return;
    if (rows[0].country_code) return; // Already set, don't overwrite

    const regionCode = resolveRegionCode(cc);
    await pool().query(
      "UPDATE auth_users SET country_code = $1, region_code = $2 WHERE id = $3",
      [cc, regionCode, userId]
    );
    console.log(`[geo] user ${userId} → ${cc} (${regionCode})`);
  } catch (e: any) {
    console.log(`[geo] updateUserGeo error for ${userId}: ${e.message}`);
  }
}
