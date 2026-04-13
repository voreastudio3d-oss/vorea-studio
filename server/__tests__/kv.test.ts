// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => ({
  store: new Map<string, any>(),
}));

const mockClient = {
  query: vi.fn(async (sql: string, params?: any[]) => {
    if (sql.includes("CREATE TABLE")) return { rows: [] };

    if (sql.includes("INSERT INTO kv_store")) {
      const key = params![0] as string;
      const value = JSON.parse(params![1] as string);
      rows.store.set(key, value);
      return { rows: [] };
    }

    if (sql.includes("SELECT value FROM kv_store WHERE key = $1 LIMIT 1")) {
      const key = params![0] as string;
      if (rows.store.has(key)) {
        return { rows: [{ value: rows.store.get(key) }] };
      }
      return { rows: [] };
    }

    if (sql.includes("key = ANY($1)") && sql.includes("SELECT")) {
      const keys = params![0] as string[];
      const matched = keys
        .filter((k) => rows.store.has(k))
        .map((k) => ({ key: k, value: rows.store.get(k) }));
      return { rows: matched };
    }

    if (sql.includes("LIKE $1")) {
      const prefix = (params![0] as string).replace("%", "");
      const matched = [...rows.store.entries()]
        .filter(([k]) => k.startsWith(prefix))
        .map(([, v]) => ({ value: v }));
      return { rows: matched };
    }

    if (sql.includes("DELETE FROM kv_store WHERE key = $1")) {
      rows.store.delete(params![0] as string);
      return { rows: [] };
    }

    if (sql.includes("DELETE FROM kv_store WHERE key = ANY")) {
      const keys = params![0] as string[];
      keys.forEach((k) => rows.store.delete(k));
      return { rows: [] };
    }

    return { rows: [] };
  }),
  release: vi.fn(),
};

vi.mock("pg", () => {
  function Pool() {
    return {
      query: mockClient.query,
      connect: async () => mockClient,
    };
  }
  return { default: { Pool } };
});

describe("kv store", () => {
  beforeEach(() => {
    vi.resetModules();
    rows.store.clear();
    mockClient.query.mockClear();
  });

  it("sets and gets a value", async () => {
    const kv = await import("../kv.js");
    await kv.set("key1", { foo: "bar" });
    const result = await kv.get("key1");
    expect(result).toEqual({ foo: "bar" });
  });

  it("returns null for missing key", async () => {
    const kv = await import("../kv.js");
    const result = await kv.get("nonexistent");
    expect(result).toBeNull();
  });

  it("deletes a key", async () => {
    const kv = await import("../kv.js");
    await kv.set("key2", "value");
    await kv.del("key2");
    const result = await kv.get("key2");
    expect(result).toBeNull();
  });

  it("batch sets and gets multiple keys", async () => {
    const kv = await import("../kv.js");
    await kv.mset(["a", "b", "c"], [1, 2, 3]);
    const results = await kv.mget(["a", "b", "c", "d"]);
    expect(results).toEqual([1, 2, 3, null]);
  });

  it("returns empty array for mget with no keys", async () => {
    const kv = await import("../kv.js");
    const results = await kv.mget([]);
    expect(results).toEqual([]);
  });

  it("batch deletes multiple keys", async () => {
    const kv = await import("../kv.js");
    await kv.mset(["x", "y"], [10, 20]);
    await kv.mdel(["x", "y"]);
    const results = await kv.mget(["x", "y"]);
    expect(results).toEqual([null, null]);
  });

  it("gets values by prefix", async () => {
    const kv = await import("../kv.js");
    await kv.set("user:1:name", "Alice");
    await kv.set("user:1:email", "alice@test.com");
    await kv.set("other:key", "nope");
    const results = await kv.getByPrefix("user:1:");
    expect(results).toHaveLength(2);
    expect(results).toContain("Alice");
    expect(results).toContain("alice@test.com");
  });
});
