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

describe("app ai history integration", () => {
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

  it("requires auth and persists history isolated by user", async () => {
    const app = await loadApp();

    const unauthorized = await requestJson(app, "/api/ai/history");
    expect(unauthorized.status).toBe(401);

    const create = await requestJson(app, "/api/ai/history", {
      method: "POST",
      token: "token-a",
      body: {
        prompt: "Caja organizadora reforzada",
        engine: "fdm",
        quality: "draft",
        modelName: "Caja Utilitaria Parametrica",
        scadCode: "cube([120, 90, 60]);",
        spec: {
          version: "1.0",
          prompt: "Caja organizadora reforzada",
          engine: "fdm",
          family: "storage-box",
          intent: "storage",
          qualityProfile: "draft",
          printProfile: "fdm",
          tags: ["caja", "taller"],
          constraints: { min_wall_thickness_mm: 1.6 },
          parameters: [
            {
              name: "width",
              type: "number",
              defaultValue: 120,
              min: 80,
              max: 240,
              step: 5,
              description: "Ancho total",
            },
          ],
          warnings: [],
        },
        validation: {
          valid: true,
          errors: [],
          warnings: [],
        },
        compilePreview: {
          quality: "draft",
          score: 16,
          level: "light",
          estimatedMs: 224,
          metrics: {
            primitives: 1,
            booleans: 0,
            loops: 0,
            detailHints: 0,
          },
          warnings: [],
        },
      },
    });
    expect(create.status).toBe(200);
    const createdJson = await create.json();
    expect(createdJson.entry?.id).toBeTruthy();
    expect(createdJson.entry.version).toBe("1.1");
    expect(createdJson.entry.familyHint).toBe("storage-box");
    expect(createdJson.entry.parameterOverrides).toEqual({ width: 120 });

    const listA = await requestJson(app, "/api/ai/history", { token: "token-a" });
    expect(listA.status).toBe(200);
    const listAJson = await listA.json();
    expect(listAJson.history).toHaveLength(1);
    expect(listAJson.history[0].modelName).toBe("Caja Utilitaria Parametrica");
    expect(listAJson.history[0].version).toBe("1.1");
    expect(listAJson.history[0].familyHint).toBe("storage-box");

    const listB = await requestJson(app, "/api/ai/history", { token: "token-b" });
    expect(listB.status).toBe(200);
    const listBJson = await listB.json();
    expect(listBJson.history).toHaveLength(0);

    const update = await requestJson(app, "/api/ai/history", {
      method: "POST",
      token: "token-a",
      body: {
        id: createdJson.entry.id,
        prompt: "Caja organizadora reforzada con labio",
        engine: "fdm",
        quality: "final",
        modelName: "Caja Utilitaria Parametrica v2",
        scadCode: "difference() { cube([145, 90, 72]); cube([139, 84, 68]); }",
        spec: {
          version: "1.0",
          prompt: "Caja organizadora reforzada con labio",
          engine: "fdm",
          family: "storage-box",
          intent: "storage",
          qualityProfile: "final",
          printProfile: "fdm",
          tags: ["caja", "taller"],
          constraints: { min_wall_thickness_mm: 2.2 },
          parameters: [],
          warnings: ["Final quality aumenta detalle."],
        },
        validation: {
          valid: true,
          errors: [],
          warnings: [],
        },
        compilePreview: {
          quality: "final",
          score: 84,
          level: "medium",
          estimatedMs: 1176,
          metrics: {
            primitives: 2,
            booleans: 1,
            loops: 0,
            detailHints: 1,
          },
          warnings: [],
        },
      },
    });
    expect(update.status).toBe(200);
    const updateJson = await update.json();
    expect(updateJson.entry.modelName).toBe("Caja Utilitaria Parametrica v2");
    expect(updateJson.entry.quality).toBe("final");
    expect(updateJson.entry.familyHint).toBe("storage-box");
    expect(updateJson.entry.parameterOverrides).toEqual({});

    const remove = await requestJson(app, `/api/ai/history/${createdJson.entry.id}`, {
      method: "DELETE",
      token: "token-a",
    });
    expect(remove.status).toBe(200);

    const listAfterDelete = await requestJson(app, "/api/ai/history", { token: "token-a" });
    const listAfterDeleteJson = await listAfterDelete.json();
    expect(listAfterDeleteJson.history).toHaveLength(0);
  });

  it("upgrades legacy v1.0 history records on read", async () => {
    kvState.store.set("ai:history:user_a", [
      {
        id: "legacy_ai_entry",
        version: "1.0",
        prompt: "Soporte celular",
        engine: "fdm",
        quality: "draft",
        modelName: "Soporte simple",
        scadCode: "cube([80, 40, 50]);",
        spec: {
          version: "1.0",
          prompt: "Soporte celular",
          engine: "fdm",
          family: "phone-stand",
          intent: "support",
          qualityProfile: "draft",
          printProfile: "fdm",
          tags: ["soporte"],
          constraints: { min_wall_thickness_mm: 1.6 },
          parameters: [
            {
              name: "angle",
              type: "number",
              defaultValue: 72,
              min: 45,
              max: 80,
              step: 1,
              description: "Angulo",
            },
          ],
          warnings: [],
        },
        validation: {
          valid: true,
          errors: [],
          warnings: [],
        },
        compilePreview: {
          quality: "draft",
          score: 20,
          level: "light",
          estimatedMs: 220,
          metrics: {
            primitives: 2,
            booleans: 0,
            loops: 0,
            detailHints: 0,
          },
          warnings: [],
        },
        createdAt: "2026-03-22T11:00:00.000Z",
        updatedAt: "2026-03-22T11:20:00.000Z",
      },
    ]);

    const app = await loadApp();
    const response = await requestJson(app, "/api/ai/history", { token: "token-a" });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.history).toHaveLength(1);
    expect(json.history[0].version).toBe("1.1");
    expect(json.history[0].familyHint).toBe("phone-stand");
    expect(json.history[0].parameterOverrides).toEqual({ angle: 72 });
  });
});
