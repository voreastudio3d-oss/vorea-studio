/**
 * KV Adapter — Wraps the backend KV store API.
 * Uses JWT auth token for authentication.
 */

import type { DatabaseAdapter, KVEntry } from "./adapter";
import { getCachedAccessToken } from "../api-client";
import { apiUrl } from "../../../../utils/config/info";

function getHeaders(): Record<string, string> {
  const token = getCachedAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function kvFetch<T = unknown>(
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    method: body ? "POST" : "GET",
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "KV store error");
  return json as T;
}

export class KVAdapter implements DatabaseAdapter {
  async set(key: string, value: unknown): Promise<void> {
    await kvFetch("/kv/set", { key, value });
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const result = await kvFetch<{ value: T | null }>("/kv/get", { key });
    return result.value ?? null;
  }

  async del(key: string): Promise<void> {
    await kvFetch("/kv/del", { key });
  }

  async mset(entries: KVEntry[]): Promise<void> {
    await kvFetch("/kv/mset", {
      entries: entries.map((e) => ({ key: e.key, value: e.value })),
    });
  }

  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    const result = await kvFetch<{ values: (T | null)[] }>("/kv/mget", {
      keys,
    });
    return result.values;
  }

  async mdel(keys: string[]): Promise<void> {
    await kvFetch("/kv/mdel", { keys });
  }

  async getByPrefix<T = unknown>(prefix: string): Promise<KVEntry[]> {
    const result = await kvFetch<{ entries: KVEntry[] }>("/kv/prefix", {
      prefix,
    });
    return result.entries ?? [];
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${apiUrl.replace("/api", "")}/api/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
