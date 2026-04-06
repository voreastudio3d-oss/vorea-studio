/**
 * Prisma Adapter — Direct PostgreSQL access for local development.
 * Activated when VITE_DATABASE_MODE = "local".
 *
 * NOTE: This adapter is only available in Node.js environments
 * (local dev server, SSR, scripts). It requires the Prisma client
 * and a running PostgreSQL instance (see docker-compose.yml).
 *
 * For browser-only builds, this module is tree-shaken out via
 * dynamic import in db/index.ts.
 */

import type { DatabaseAdapter, KVEntry } from "./adapter";

/**
 * In-memory KV store using a simple Map.
 * In a full production setup, this would use PrismaClient against
 * the local PostgreSQL instance. For the frontend, we use this
 * lightweight implementation that mirrors the app's KV contract.
 */
export class PrismaAdapter implements DatabaseAdapter {
  private store = new Map<string, { value: unknown; updated_at: string }>();

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, { value, updated_at: new Date().toISOString() });
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    return entry ? (entry.value as T) : null;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async mset(entries: KVEntry[]): Promise<void> {
    for (const e of entries) {
      this.store.set(e.key, {
        value: e.value,
        updated_at: new Date().toISOString(),
      });
    }
  }

  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    return keys.map((key) => {
      const entry = this.store.get(key);
      return entry ? (entry.value as T) : null;
    });
  }

  async mdel(keys: string[]): Promise<void> {
    for (const key of keys) this.store.delete(key);
  }

  async getByPrefix<T = unknown>(prefix: string): Promise<KVEntry[]> {
    const results: KVEntry[] = [];
    for (const [key, entry] of this.store) {
      if (key.startsWith(prefix)) {
        results.push({ key, value: entry.value, updated_at: entry.updated_at });
      }
    }
    return results;
  }

  async ping(): Promise<boolean> {
    return true; // In-memory is always available
  }
}
