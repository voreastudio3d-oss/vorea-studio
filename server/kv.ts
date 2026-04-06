/**
 * KV Store — PostgreSQL adapter (self-hosted)
 * Uses local PostgreSQL table `kv_store` for key-value storage.
 * Replaces the previous Supabase-based implementation.
 *
 * Uses the `pg` driver directly (already a project dependency)
 * for maximum simplicity — no ORM configuration issues.
 *
 * This module is 100% self-hosted — no external service dependencies.
 */

import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://vorea:vorea_dev@localhost:5432/vorea_studio";

// Singleton pool (reuse connections across requests)
let _pool: pg.Pool | null = null;

function pool(): pg.Pool {
  if (!_pool) {
    _pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });
  }
  return _pool;
}

// Ensure the table exists on first use
let _tableReady = false;
async function ensureTable(): Promise<void> {
  if (_tableReady) return;
  await pool().query(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}',
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  _tableReady = true;
}

export const set = async (key: string, value: any): Promise<void> => {
  await ensureTable();
  await pool().query(
    `INSERT INTO kv_store (key, value, "updatedAt")
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, "updatedAt" = NOW()`,
    [key, JSON.stringify(value)]
  );
};

export const get = async (key: string): Promise<any> => {
  await ensureTable();
  const { rows } = await pool().query(
    "SELECT value FROM kv_store WHERE key = $1 LIMIT 1",
    [key]
  );
  return rows.length > 0 ? rows[0].value : null;
};

export const del = async (key: string): Promise<void> => {
  await ensureTable();
  await pool().query("DELETE FROM kv_store WHERE key = $1", [key]);
};

export const mset = async (keys: string[], values: any[]): Promise<void> => {
  await ensureTable();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < keys.length; i++) {
      await client.query(
        `INSERT INTO kv_store (key, value, "updatedAt")
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, "updatedAt" = NOW()`,
        [keys[i], JSON.stringify(values[i])]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

export const mget = async (keys: string[]): Promise<any[]> => {
  await ensureTable();
  if (keys.length === 0) return [];
  const { rows } = await pool().query(
    "SELECT key, value FROM kv_store WHERE key = ANY($1)",
    [keys]
  );
  const map = new Map(rows.map((r: any) => [r.key, r.value]));
  return keys.map((k) => map.get(k) ?? null);
};

export const mdel = async (keys: string[]): Promise<void> => {
  await ensureTable();
  if (keys.length === 0) return;
  await pool().query("DELETE FROM kv_store WHERE key = ANY($1)", [keys]);
};

export const getByPrefix = async (prefix: string): Promise<any[]> => {
  await ensureTable();
  const { rows } = await pool().query(
    "SELECT value FROM kv_store WHERE key LIKE $1",
    [prefix + "%"]
  );
  return rows.map((r: any) => r.value);
};
