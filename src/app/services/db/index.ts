/**
 * Database Provider — Selects the active adapter.
 *
 * Usage:
 *   import { db } from "./db";
 *   await db.set("users:123", { name: "Alex" });
 *   const user = await db.get("users:123");
 */

import type { DatabaseAdapter } from "./adapter";

let _instance: DatabaseAdapter | null = null;

/**
 * Get the database adapter singleton.
 * Always uses the KV adapter that calls our self-hosted API.
 */
export async function getDatabase(): Promise<DatabaseAdapter> {
  if (_instance) return _instance;

  const { KVAdapter } = await import("./kv-adapter");
  _instance = new KVAdapter();

  return _instance;
}

/** Shorthand — synchronous access after first init. */
export function db(): DatabaseAdapter {
  if (!_instance) {
    throw new Error(
      "Database not initialized. Call getDatabase() first during app startup."
    );
  }
  return _instance;
}

export type { DatabaseAdapter, KVEntry } from "./adapter";
