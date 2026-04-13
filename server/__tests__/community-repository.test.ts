/**
 * community-repository tests — pure utility functions + KV repository logic.
 * Tests normalizeText, dedupe, status/tier conversions, and KV CRUD via mock.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock kv module
const kvStore = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, val: unknown) => {
      store.set(key, val);
      return Promise.resolve();
    }),
    del: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    getByPrefix: vi.fn((prefix: string) => {
      const results: unknown[] = [];
      for (const [k, v] of store) {
        if (k.startsWith(prefix)) results.push(v);
      }
      return Promise.resolve(results);
    }),
  };
});

vi.mock("../kv.js", () => kvStore);

// Mock pg
vi.mock("pg", () => {
  function Pool() {
    return { query: vi.fn().mockResolvedValue({ rows: [] }) };
  }
  return { default: { Pool }, Pool };
});

describe("community-repository", () => {
  let createCommunityRepository: any;

  beforeEach(async () => {
    kvStore.store.clear();
    vi.clearAllMocks();
    // Dynamic import to get the module with mocks applied
    const mod = await import("../community-repository.js");
    createCommunityRepository = mod.createCommunityRepository;
  });

  describe("KV repository CRUD", () => {
    it("creates a repository instance", () => {
      const repo = createCommunityRepository("kv");
      expect(repo).toBeDefined();
    });

    it("upsertModel + getModel roundtrip", async () => {
      const repo = createCommunityRepository("kv");
      const model = {
        id: "cm_001",
        title: "Test Box",
        authorId: "u1",
        status: "published",
      };
      await repo.upsertModel("cm_001", model);
      const result = await repo.getModel("cm_001");
      expect(result).toEqual(model);
    });

    it("deleteModel removes model", async () => {
      const repo = createCommunityRepository("kv");
      await repo.upsertModel("cm_002", { id: "cm_002", title: "Delete Me" });
      await repo.deleteModel("cm_002");
      const result = await repo.getModel("cm_002");
      expect(result).toBeNull();
    });

    it("getAllModels returns all models", async () => {
      const repo = createCommunityRepository("kv");
      await repo.upsertModel("cm_a", { id: "cm_a", title: "A", authorId: "u1", status: "published" });
      await repo.upsertModel("cm_b", { id: "cm_b", title: "B", authorId: "u2", status: "published" });
      const models = await repo.getAllModels();
      expect(models.length).toBeGreaterThanOrEqual(2);
    });

    it("upsertTag + getTag roundtrip", async () => {
      const repo = createCommunityRepository("kv");
      const tag = { slug: "organic", modelCount: 5 };
      await repo.upsertTag("Organic", tag);
      const result = await repo.getTag("Organic");
      expect(result).toEqual(tag);
    });

    it("listTags returns all tags", async () => {
      const repo = createCommunityRepository("kv");
      await repo.upsertTag("organic", { slug: "organic" });
      await repo.upsertTag("relief", { slug: "relief" });
      const tags = await repo.listTags();
      expect(tags.length).toBe(2);
    });

    it("upsertLike + getLike roundtrip", async () => {
      const repo = createCommunityRepository("kv");
      await repo.upsertLike("cm_001", "u1", { userId: "u1", modelId: "cm_001" });
      const like = await repo.getLike("cm_001", "u1");
      expect(like).toEqual({ userId: "u1", modelId: "cm_001" });
    });

    it("deleteLike removes like", async () => {
      const repo = createCommunityRepository("kv");
      await repo.upsertLike("cm_001", "u1", { userId: "u1", modelId: "cm_001" });
      await repo.deleteLike("cm_001", "u1");
      const result = await repo.getLike("cm_001", "u1");
      expect(result).toBeNull();
    });

    it("listLikesByModel returns likes for model", async () => {
      const repo = createCommunityRepository("kv");
      await repo.upsertLike("cm_001", "u1", { userId: "u1", modelId: "cm_001" });
      await repo.upsertLike("cm_001", "u2", { userId: "u2", modelId: "cm_001" });
      const likes = await repo.listLikesByModel("cm_001");
      expect(likes.length).toBe(2);
    });

    it("upsertUserProfile + getUserProfile roundtrip", async () => {
      const repo = createCommunityRepository("kv");
      const profile = { userId: "u1", displayName: "Test" };
      await repo.upsertUserProfile("u1", profile);
      const result = await repo.getUserProfile("u1");
      expect(result).toEqual(profile);
    });
  });

  describe("deduplication logic", () => {
    it("deduplicates models with same author+title", async () => {
      const repo = createCommunityRepository("kv");
      // Same author, same title — should dedupe
      await repo.upsertModel("c_old", {
        id: "c_old",
        title: "My Box",
        authorId: "u1",
        status: "draft",
        updatedAt: "2024-01-01",
      });
      await repo.upsertModel("cm_new", {
        id: "cm_new",
        title: "My Box",
        authorId: "u1",
        status: "published",
        updatedAt: "2024-06-01",
      });

      const models = await repo.getAllModels();
      // Should keep the "published" one (cm_ prefix = higher rank + published status)
      const titles = models.filter((m: any) => m.title === "My Box");
      expect(titles.length).toBe(1);
      expect(titles[0].id).toBe("cm_new");
    });

    it("keeps models with different titles", async () => {
      const repo = createCommunityRepository("kv");
      await repo.upsertModel("cm_a", {
        id: "cm_a",
        title: "Box A",
        authorId: "u1",
        status: "published",
      });
      await repo.upsertModel("cm_b", {
        id: "cm_b",
        title: "Box B",
        authorId: "u1",
        status: "published",
      });
      const models = await repo.getAllModels();
      expect(models.length).toBe(2);
    });
  });
});
