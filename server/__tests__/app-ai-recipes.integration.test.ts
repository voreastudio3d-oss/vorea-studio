// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

type KvState = { store: Map<string, any> };
type AuthState = { tokens: Map<string, string> };

const kvState = vi.hoisted<KvState>(() => ({ store: new Map<string, any>() }));
const authState = vi.hoisted<AuthState>(() => ({ tokens: new Map<string, string>() }));

function clone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
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
  getUserById: async (id: string) => ({
    id,
    email: `${id}@test.local`,
    role: "user",
    tier: "FREE",
  }),
  updateUser: async () => {},
  deleteUser: async () => {},
}));

vi.mock("../community-repository.js", () => ({
  createCommunityRepository: () => ({
    getAllModels: async () => [],
    getAllModelsRaw: async () => [],
    getModel: async () => null,
    upsertModel: async () => {},
    deleteModel: async () => {},
    getTag: async () => null,
    upsertTag: async () => {},
    listTags: async () => [],
    getLike: async () => null,
    upsertLike: async () => {},
    deleteLike: async () => {},
    listLikesByModel: async () => [],
    getUserProfile: async () => null,
    upsertUserProfile: async () => {},
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

describe("app ai recipes integration", () => {
  beforeEach(() => {
    vi.resetModules();
    kvState.store.clear();
    authState.tokens.clear();
    authState.tokens.set("token-a", "user_a");
    authState.tokens.set("token-b", "user_b");
    process.env.PAYPAL_CLIENT_ID = "test-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
    process.env.PAYPAL_MODE = "sandbox";
  });

  it("requires auth and persists recipes isolated by user", async () => {
    const app = await loadApp();

    const unauthorized = await requestJson(app, "/api/ai/recipes");
    expect(unauthorized.status).toBe(401);

    const create = await requestJson(app, "/api/ai/recipes", {
      method: "POST",
      token: "token-a",
      body: {
        name: "Caja base",
        prompt: "Caja organizadora",
        engine: "fdm",
        quality: "draft",
        familyHint: "storage-box",
        parameterOverrides: { width: 130 },
      },
    });
    expect(create.status).toBe(200);
    const createdJson = await create.json();
    expect(createdJson.recipe?.id).toBeTruthy();

    const listA = await requestJson(app, "/api/ai/recipes", { token: "token-a" });
    expect(listA.status).toBe(200);
    const listAJson = await listA.json();
    expect(listAJson.recipes).toHaveLength(1);
    expect(listAJson.recipes[0].name).toBe("Caja base");

    const listB = await requestJson(app, "/api/ai/recipes", { token: "token-b" });
    expect(listB.status).toBe(200);
    const listBJson = await listB.json();
    expect(listBJson.recipes).toHaveLength(0);

    const update = await requestJson(app, "/api/ai/recipes", {
      method: "POST",
      token: "token-a",
      body: {
        id: createdJson.recipe.id,
        name: "Caja base v2",
        prompt: "Caja organizadora reforzada",
        engine: "fdm",
        quality: "final",
        familyHint: "storage-box",
        parameterOverrides: { width: 145, wall: 3 },
      },
    });
    expect(update.status).toBe(200);
    const updateJson = await update.json();
    expect(updateJson.recipe.name).toBe("Caja base v2");
    expect(updateJson.recipe.quality).toBe("final");

    const remove = await requestJson(app, `/api/ai/recipes/${createdJson.recipe.id}`, {
      method: "DELETE",
      token: "token-a",
    });
    expect(remove.status).toBe(200);

    const listAfterDelete = await requestJson(app, "/api/ai/recipes", { token: "token-a" });
    const listAfterDeleteJson = await listAfterDelete.json();
    expect(listAfterDeleteJson.recipes).toHaveLength(0);
  });
});
