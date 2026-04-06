// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

type KvState = { store: Map<string, any> };
type AuthState = { tokens: Map<string, string> };
type CommunityState = {
  models: Map<string, any>;
  likes: Map<string, any>;
  tags: Map<string, any>;
  profiles: Map<string, any>;
};

const kvState = vi.hoisted<KvState>(() => ({ store: new Map<string, any>() }));
const authState = vi.hoisted<AuthState>(() => ({ tokens: new Map<string, string>() }));
const communityState = vi.hoisted<CommunityState>(() => ({
  models: new Map<string, any>(),
  likes: new Map<string, any>(),
  tags: new Map<string, any>(),
  profiles: new Map<string, any>(),
}));

function clone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function dedupeCommunityModels(models: any[]): any[] {
  const byKey = new Map<string, any>();
  for (const model of models) {
    const modelType = model?.modelType || (model?.reliefConfig ? "relief" : "parametric");
    const key = `${String(model?.authorId || "").toLowerCase()}::${String(model?.title || "").toLowerCase()}::${String(modelType).toLowerCase()}`;
    const current = byKey.get(key);
    const rank = String(model?.status || "").toLowerCase() === "published" ? 2 : 1;
    const currentRank = String(current?.status || "").toLowerCase() === "published" ? 2 : 1;
    if (!current || rank > currentRank) {
      byKey.set(key, model);
    }
  }
  return [...byKey.values()].map((item) => clone(item));
}

vi.mock("../kv.js", () => ({
  set: async (key: string, value: any) => {
    kvState.store.set(key, clone(value));
  },
  get: async (key: string) => (kvState.store.has(key) ? clone(kvState.store.get(key)) : null),
  del: async (key: string) => {
    kvState.store.delete(key);
  },
  mset: async (keys: string[], values: any[]) => {
    keys.forEach((key, index) => kvState.store.set(key, clone(values[index])));
  },
  mget: async (keys: string[]) => keys.map((key) => (kvState.store.has(key) ? clone(kvState.store.get(key)) : null)),
  mdel: async (keys: string[]) => {
    keys.forEach((key) => kvState.store.delete(key));
  },
  getByPrefix: async (prefix: string) => {
    const values: any[] = [];
    for (const [key, value] of kvState.store.entries()) {
      if (key.startsWith(prefix)) values.push(clone(value));
    }
    return values;
  },
}));

vi.mock("../auth.js", () => ({
  getUserIdFromHeader: (authorization?: string) => {
    if (!authorization?.startsWith("Bearer ")) return null;
    return authState.tokens.get(authorization.slice("Bearer ".length)) || null;
  },
  getUserById: async (id: string) => {
    const profile = kvState.store.get(`user:${id}:profile`) || {};
    return {
      id,
      email: profile.email || `${id}@test.local`,
      role: profile.role || "user",
      tier: profile.tier || "FREE",
    };
  },
  updateUser: async () => {},
  deleteUser: async () => {},
}));

vi.mock("../community-repository.js", () => ({
  createCommunityRepository: () => ({
    getAllModels: async () => dedupeCommunityModels([...communityState.models.values()]),
    getAllModelsRaw: async () => [...communityState.models.values()].map((m) => clone(m)),
    getModel: async (id: string) => (communityState.models.has(id) ? clone(communityState.models.get(id)) : null),
    upsertModel: async (id: string, model: any) => {
      communityState.models.set(id, clone(model));
    },
    deleteModel: async (id: string) => {
      communityState.models.delete(id);
    },
    getTag: async (tag: string) => (communityState.tags.has(tag) ? clone(communityState.tags.get(tag)) : null),
    upsertTag: async (tag: string, data: any) => {
      communityState.tags.set(tag, clone(data));
    },
    listTags: async () => [...communityState.tags.values()].map((t) => clone(t)),
    getLike: async (modelId: string, userId: string) => {
      const key = `${modelId}:${userId}`;
      return communityState.likes.has(key) ? clone(communityState.likes.get(key)) : null;
    },
    upsertLike: async (modelId: string, userId: string, data: any) => {
      communityState.likes.set(`${modelId}:${userId}`, clone(data));
    },
    deleteLike: async (modelId: string, userId: string) => {
      communityState.likes.delete(`${modelId}:${userId}`);
    },
    listLikesByModel: async (modelId: string) =>
      [...communityState.likes.entries()]
        .filter(([key]) => key.startsWith(`${modelId}:`))
        .map(([, value]) => clone(value)),
    getUserProfile: async (userId: string) =>
      (communityState.profiles.has(userId) ? clone(communityState.profiles.get(userId)) : null),
    upsertUserProfile: async (userId: string, profile: any) => {
      communityState.profiles.set(userId, clone(profile));
    },
  }),
}));

async function loadApp() {
  const mod = await import("../app.ts");
  return mod.default;
}

async function requestJson(
  app: any,
  path: string,
  options: { method?: string; token?: string; body?: Record<string, unknown> } = {}
) {
  const { method = "GET", token, body } = options;
  return app.request(path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("app community integration", () => {
  beforeEach(() => {
    vi.resetModules();
    kvState.store.clear();
    authState.tokens.clear();
    communityState.models.clear();
    communityState.likes.clear();
    communityState.tags.clear();
    communityState.profiles.clear();
    authState.tokens.set("token-owner", "u_owner");
    authState.tokens.set("token-user", "u_user");
    authState.tokens.set("token-admin", "u_admin");
    process.env.PAYPAL_CLIENT_ID = "test-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
    process.env.PAYPAL_MODE = "sandbox";
  });

  it("hides draft detail from anonymous viewers but allows owner", async () => {
    communityState.models.set("cm_draft_1", {
      id: "cm_draft_1",
      title: "Draft Gear",
      authorId: "u_owner",
      authorName: "Owner",
      authorUsername: "@owner",
      scadSource: "cube(10);",
      status: "draft",
      thumbnailUrl: "/api/uploads/thumbnail/t1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const app = await loadApp();
    const anonymous = await requestJson(app, "/api/community/models/cm_draft_1");
    expect(anonymous.status).toBe(404);

    const owner = await requestJson(app, "/api/community/models/cm_draft_1", { token: "token-owner" });
    expect(owner.status).toBe(200);
    const payload = await owner.json();
    expect(payload.model.id).toBe("cm_draft_1");
    expect(payload.model.slug).toBe("draft-gear");
    expect(payload.model.canonicalPath).toContain("/borrador/cm_draft_1/");
    expect(Array.isArray(payload.model.media)).toBe(true);
    expect(payload.model.media.length).toBeGreaterThan(0);
  });

  it("blocks likes and comments on drafts", async () => {
    communityState.models.set("cm_draft_2", {
      id: "cm_draft_2",
      title: "Draft Model",
      authorId: "u_owner",
      authorName: "Owner",
      authorUsername: "@owner",
      scadSource: "cube(5);",
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const app = await loadApp();
    const likeRes = await requestJson(app, "/api/community/models/cm_draft_2/like", {
      method: "POST",
      token: "token-user",
    });
    expect(likeRes.status).toBe(403);

    const commentRes = await requestJson(app, "/api/community/models/cm_draft_2/comments", {
      method: "POST",
      token: "token-user",
      body: { text: "hola" },
    });
    expect(commentRes.status).toBe(403);
  });

  it("lists all community models for superadmin with search", async () => {
    kvState.store.set("user:u_admin:profile", {
      id: "u_admin",
      email: "admin@test.local",
      role: "superadmin",
      tier: "STUDIO PRO",
    });
    kvState.store.set("user:u_user:profile", {
      id: "u_user",
      email: "user@test.local",
      role: "user",
      tier: "FREE",
    });

    communityState.models.set("cm_gear_1", {
      id: "cm_gear_1",
      title: "Parametric Gear",
      authorId: "u_user",
      authorName: "User",
      authorUsername: "@user",
      status: "published",
      likes: 10,
      downloads: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    communityState.models.set("cm_box_1", {
      id: "cm_box_1",
      title: "Storage Box",
      authorId: "u_user",
      authorName: "User",
      authorUsername: "@user",
      status: "draft",
      likes: 0,
      downloads: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const app = await loadApp();

    const denied = await requestJson(app, "/api/admin/community/models?q=gear", { token: "token-user" });
    expect(denied.status).toBe(403);

    const ok = await requestJson(app, "/api/admin/community/models?q=gear&status=all", { token: "token-admin" });
    expect(ok.status).toBe(200);
    const payload = await ok.json();
    expect(payload.total).toBe(1);
    expect(payload.models[0].id).toBe("cm_gear_1");
  });

  it("keeps the owner's draft visible even when a published model shares title and type", async () => {
    communityState.models.set("cm_pub_1", {
      id: "cm_pub_1",
      title: "Gallery Fixture",
      authorId: "u_owner",
      authorName: "Owner",
      authorUsername: "@owner",
      modelType: "parametric",
      status: "published",
      createdAt: new Date("2026-03-18T10:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-03-18T10:00:00.000Z").toISOString(),
    });
    communityState.models.set("cm_draft_same", {
      id: "cm_draft_same",
      title: "Gallery Fixture",
      authorId: "u_owner",
      authorName: "Owner",
      authorUsername: "@owner",
      modelType: "parametric",
      status: "draft",
      createdAt: new Date("2026-03-19T10:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-03-19T10:00:00.000Z").toISOString(),
    });

    const app = await loadApp();
    const response = await requestJson(
      app,
      "/api/community/models?authorId=u_owner&status=all&limit=20",
      { token: "token-owner" }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.total).toBe(2);
    expect(payload.models.map((m: any) => m.id)).toEqual(expect.arrayContaining(["cm_pub_1", "cm_draft_same"]));
  });

  it("enforces tier image size limit on community image uploads", async () => {
    kvState.store.set("user:u_user:profile", {
      id: "u_user",
      email: "user@test.local",
      role: "user",
      tier: "FREE",
    });
    kvState.store.set("admin:image_limits", {
      free: { maxBytes: 64, resizePx: 1024 },
      pro: { maxBytes: 10 * 1024 * 1024, resizePx: 2048 },
      studioPro: { maxBytes: 25 * 1024 * 1024, resizePx: null },
    });

    const app = await loadApp();

    const ok = await requestJson(app, "/api/uploads/community-image", {
      method: "POST",
      token: "token-user",
      body: { data: "data:image/png;base64,AAAA" },
    });
    expect(ok.status).toBe(200);

    const oversizedBase64 = Buffer.from("x".repeat(512)).toString("base64");
    const blocked = await requestJson(app, "/api/uploads/community-image", {
      method: "POST",
      token: "token-user",
      body: { data: `data:image/png;base64,${oversizedBase64}` },
    });
    expect(blocked.status).toBe(400);
  });
});
