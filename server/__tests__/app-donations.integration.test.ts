// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

type KvState = {
  store: Map<string, any>;
};

type AuthState = {
  tokens: Map<string, string>;
};

const kvState = vi.hoisted<KvState>(() => ({
  store: new Map<string, any>(),
}));

const authState = vi.hoisted<AuthState>(() => ({
  tokens: new Map<string, string>(),
}));

function clone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

vi.mock("../kv.js", () => ({
  set: async (key: string, value: any) => {
    kvState.store.set(key, clone(value));
  },
  get: async (key: string) => {
    return kvState.store.has(key) ? clone(kvState.store.get(key)) : null;
  },
  del: async (key: string) => {
    kvState.store.delete(key);
  },
  mset: async (keys: string[], values: any[]) => {
    keys.forEach((key, index) => {
      kvState.store.set(key, clone(values[index]));
    });
  },
  mget: async (keys: string[]) => {
    return keys.map((key) =>
      kvState.store.has(key) ? clone(kvState.store.get(key)) : null
    );
  },
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
    const token = authorization.slice("Bearer ".length);
    return authState.tokens.get(token) || null;
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

function jsonResponse(status: number, payload: any): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function loadApp() {
  const mod = await import("../app.ts");
  return mod.default;
}

async function postJson(
  app: any,
  path: string,
  body: Record<string, unknown>,
  token?: string
) {
  return app.request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function putJson(
  app: any,
  path: string,
  body: Record<string, unknown>,
  token?: string
) {
  return app.request(path, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("app donations integration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    kvState.store.clear();
    authState.tokens.clear();
    authState.tokens.set("token-user", "user_1");
    authState.tokens.set("token-admin", "admin_1");
    process.env.PAYPAL_CLIENT_ID = "test-client-id";
    process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
    process.env.PAYPAL_MODE = "sandbox";
  });

  it("creates a donation order and stores expected metadata", async () => {
    kvState.store.set("user:user_1:profile", {
      id: "user_1",
      displayName: "Martín",
      username: "@martin",
      avatarUrl: null,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "paypal-token" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: "DON_ORDER_1",
          status: "CREATED",
          links: [{ rel: "approve", href: "https://paypal.test/approve/DON_ORDER_1" }],
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const app = await loadApp();
    const res = await postJson(
      app,
      "/api/donations/create-order",
      { tierId: "aliado", isPublic: true, message: "Gracias por empujar Vorea." },
      "token-user"
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.orderId).toBe("DON_ORDER_1");
    expect(json.approveUrl).toContain("paypal.test/approve");

    expect(kvState.store.get("paypal:donation:order:DON_ORDER_1")).toEqual(
      expect.objectContaining({
        userId: "user_1",
        tierId: "aliado",
        visibility: "public",
        expectedAmountUsd: 15,
      })
    );
  });

  it("captures a donation, updates rewards and keeps the operation idempotent", async () => {
    kvState.store.set("user:user_1:profile", {
      id: "user_1",
      displayName: "Martín",
      username: "@martin",
      avatarUrl: null,
    });
    kvState.store.set("paypal:donation:order:DON_ORDER_2", {
      orderId: "DON_ORDER_2",
      userId: "user_1",
      tierId: "aliado",
      visibility: "public",
      message: "Vamos por más herramientas.",
      expectedAmountUsd: 15,
      expectedCurrency: "USD",
      status: "CREATED",
      createdAt: new Date("2026-03-23T10:00:00.000Z").toISOString(),
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "paypal-token" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          status: "COMPLETED",
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: "CAPTURE_1",
                    status: "COMPLETED",
                    amount: { currency_code: "USD", value: "15.00" },
                  },
                ],
              },
            },
          ],
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const app = await loadApp();
    const res = await postJson(
      app,
      "/api/donations/capture-order",
      { orderId: "DON_ORDER_2" },
      "token-user"
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.tierId).toBe("aliado");
    expect(json.badgeId).toBe("contributor_aliado");

    expect(kvState.store.get("user:user_1:contributor")).toEqual(
      expect.objectContaining({
        tierId: "aliado",
        totalDonatedUsd: 15,
        donationCount: 1,
        publicContributor: true,
      })
    );
    expect(kvState.store.get("user:user_1:rewards")).toEqual(
      expect.objectContaining({
        badges: expect.arrayContaining(["contributor_aliado"]),
      })
    );
    expect(kvState.store.get("contributors:public")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "user_1",
          tierId: "aliado",
        }),
      ])
    );

    const again = await postJson(
      app,
      "/api/donations/capture-order",
      { orderId: "DON_ORDER_2" },
      "token-user"
    );
    expect(again.status).toBe(200);
    const againJson = await again.json();
    expect(againJson.alreadyProcessed).toBe(true);
    expect(againJson.totalDonatedUsd).toBe(15);
  });

  it("returns a public contributors payload without exposing exact totals", async () => {
    kvState.store.set("contributors:public", [
      {
        userId: "user_1",
        displayName: "Martín",
        username: "@martin",
        avatarUrl: null,
        tierId: "mecenas",
        badgeId: "contributor_mecenas",
        donationCount: 3,
        totalDonatedUsd: 999,
        lastDonatedAt: "2026-03-23T10:00:00.000Z",
        joinedAt: "2026-03-21T10:00:00.000Z",
        message: "Adelante.",
      },
    ]);

    const app = await loadApp();
    const res = await app.request("/api/contributors");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.stats.publicContributors).toBe(1);
    expect(json.contributors[0].tierId).toBe("mecenas");
    expect(json.contributors[0].totalDonatedUsd).toBeUndefined();
    expect(Array.isArray(json.tiers)).toBe(true);
  });

  it("lets a superadmin list donation operations while denying normal users", async () => {
    kvState.store.set("user:admin_1:profile", {
      id: "admin_1",
      email: "admin@test.local",
      displayName: "Admin",
      username: "@admin",
      role: "superadmin",
    });
    kvState.store.set("paypal:donation:order:DON_ORDER_3", {
      orderId: "DON_ORDER_3",
      userId: "user_1",
      tierId: "mecenas",
      visibility: "public",
      expectedAmountUsd: 75,
      expectedCurrency: "USD",
      status: "COMPLETED",
      createdAt: "2026-03-23T10:00:00.000Z",
      capturedAt: "2026-03-23T10:05:00.000Z",
      capturedAmountUsd: 75,
      capturedCurrency: "USD",
      captureId: "CAPTURE_3",
      donationId: "don_3",
    });
    kvState.store.set("donation:entry:don_3", {
      id: "don_3",
      userId: "user_1",
      orderId: "DON_ORDER_3",
      amountUsd: 75,
      currency: "USD",
      awardedTierId: "mecenas",
      visibility: "public",
      completedAt: "2026-03-23T10:05:00.000Z",
      status: "COMPLETED",
    });
    kvState.store.set("user:user_1:profile", {
      id: "user_1",
      displayName: "Martín",
      username: "@martin",
      avatarUrl: null,
    });
    kvState.store.set("user:user_1:contributor", {
      userId: "user_1",
      displayName: "Martín",
      username: "@martin",
      avatarUrl: null,
      totalDonatedUsd: 75,
      donationCount: 1,
      tierId: "mecenas",
      badgeId: "contributor_mecenas",
      publicContributor: true,
      lastDonatedAt: "2026-03-23T10:05:00.000Z",
      joinedAt: "2026-03-23T10:05:00.000Z",
      message: "Seguimos.",
    });

    const app = await loadApp();

    const denied = await app.request("/api/admin/donations", {
      headers: { Authorization: "Bearer token-user" },
    });
    expect(denied.status).toBe(403);

    const ok = await app.request("/api/admin/donations?status=completed", {
      headers: { Authorization: "Bearer token-admin" },
    });
    expect(ok.status).toBe(200);

    const json = await ok.json();
    expect(json.stats.completedOrders).toBe(1);
    expect(json.donations[0].orderId).toBe("DON_ORDER_3");
    expect(json.contributors[0].publicContributor).toBe(true);
  });

  it("updates contributor visibility for self-service and superadmin moderation", async () => {
    kvState.store.set("user:admin_1:profile", {
      id: "admin_1",
      email: "admin@test.local",
      displayName: "Admin",
      username: "@admin",
      role: "superadmin",
    });
    kvState.store.set("user:user_1:profile", {
      id: "user_1",
      displayName: "Martín",
      username: "@martin",
      avatarUrl: null,
    });
    kvState.store.set("user:user_1:contributor", {
      userId: "user_1",
      displayName: "Martín",
      username: "@martin",
      avatarUrl: null,
      totalDonatedUsd: 15,
      donationCount: 1,
      tierId: "aliado",
      badgeId: "contributor_aliado",
      publicContributor: true,
      lastDonatedAt: "2026-03-23T10:05:00.000Z",
      joinedAt: "2026-03-23T10:05:00.000Z",
      message: "Mensaje inicial.",
    });
    kvState.store.set("contributors:public", [
      {
        userId: "user_1",
        displayName: "Martín",
        username: "@martin",
        avatarUrl: null,
        tierId: "aliado",
        badgeId: "contributor_aliado",
        donationCount: 1,
        lastDonatedAt: "2026-03-23T10:05:00.000Z",
        joinedAt: "2026-03-23T10:05:00.000Z",
        message: "Mensaje inicial.",
      },
    ]);

    const app = await loadApp();

    const selfUpdate = await putJson(
      app,
      "/api/donations/me",
      { publicContributor: false, message: "No debería persistir" },
      "token-user"
    );
    expect(selfUpdate.status).toBe(200);
    expect(kvState.store.get("contributors:public")).toEqual([]);
    expect(kvState.store.get("user:user_1:contributor")).toEqual(
      expect.objectContaining({
        publicContributor: false,
        message: null,
      })
    );

    const adminUpdate = await putJson(
      app,
      "/api/admin/contributors/user_1",
      { publicContributor: true, message: "Visible otra vez." },
      "token-admin"
    );
    expect(adminUpdate.status).toBe(200);
    expect(kvState.store.get("contributors:public")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "user_1",
          message: "Visible otra vez.",
        }),
      ])
    );
    expect(kvState.store.get("user:user_1:contributor")).toEqual(
      expect.objectContaining({
        publicContributor: true,
        message: "Visible otra vez.",
      })
    );
  });
});
