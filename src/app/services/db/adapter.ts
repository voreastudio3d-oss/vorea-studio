/**
 * Database Adapter Interface — Abstracts storage backend.
 *
 * Two eras of implementation have existed in this repo:
 *  1. legacy Supabase KV adapter (removed)
 *  2. Prisma/self-hosted PostgreSQL adapter (current direction)
 *
 * The active adapter is selected by VITE_DATABASE_MODE env var.
 */

export interface KVEntry {
  key: string;
  value: unknown;
  updated_at?: string;
}

/**
 * Minimal key-value interface matching the repo's KV access pattern.
 * This is the bridge layer — components use this interface and never
 * interact with the underlying persistence layer directly.
 */
export interface DatabaseAdapter {
  /** Store a value under a key */
  set(key: string, value: unknown): Promise<void>;

  /** Retrieve a value by key */
  get<T = unknown>(key: string): Promise<T | null>;

  /** Delete a key */
  del(key: string): Promise<void>;

  /** Batch set */
  mset(entries: KVEntry[]): Promise<void>;

  /** Batch get */
  mget<T = unknown>(keys: string[]): Promise<(T | null)[]>;

  /** Batch delete */
  mdel(keys: string[]): Promise<void>;

  /** Get all entries matching a key prefix */
  getByPrefix<T = unknown>(prefix: string): Promise<KVEntry[]>;

  /** Health check — is the database reachable? */
  ping(): Promise<boolean>;
}
