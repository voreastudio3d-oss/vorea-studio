// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

type KvState = { store: Map<string, any> };

const kvState = vi.hoisted<KvState>(() => ({ store: new Map<string, any>() }));

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
  mset: async () => {},
  mget: async () => [],
  mdel: async () => {},
  getByPrefix: async (prefix: string) =>
    [...kvState.store.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, value]) => clone(value)),
}));

vi.mock("../auth.js", () => ({
  getUserIdFromHeader: () => null,
  getUserById: async () => null,
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

describe("app contact integration", () => {
  beforeEach(() => {
    vi.resetModules();
    kvState.store.clear();
    process.env.PAYPAL_CLIENT_ID = "test-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
    process.env.PAYPAL_MODE = "sandbox";
    delete process.env.RESEND_API_KEY;
  });

  it("stores contact submissions and returns a reference id", async () => {
    const app = await loadApp();
    const response = await app.request("/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Martín",
        email: "martin@example.com",
        subject: "Alianza",
        message: "Quiero conversar sobre una integración.",
        pageUrl: "https://voreastudio3d.com/contacto",
      }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.contactId).toMatch(/^ct_/);

    const stored = kvState.store.get(`contact:${json.contactId}`);
    expect(stored.name).toBe("Martín");
    expect(stored.email).toBe("martin@example.com");
    expect(stored.subject).toBe("Alianza");
  });
});
