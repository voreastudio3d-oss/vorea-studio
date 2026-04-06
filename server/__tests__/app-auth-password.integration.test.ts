// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

type KvState = {
  store: Map<string, any>;
};

type AuthUserRecord = {
  id: string;
  email: string;
  password_hash: string | null;
  display_name: string;
  username: string;
  tier: string;
  role: string;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  banned: boolean;
  provider: string;
  google_id: string | null;
  created_at: string;
  updated_at: string;
};

type AuthState = {
  tokens: Map<string, string>;
  users: Map<string, AuthUserRecord>;
};

const kvState = vi.hoisted<KvState>(() => ({
  store: new Map<string, any>(),
}));

const authState = vi.hoisted<AuthState>(() => ({
  tokens: new Map<string, string>(),
  users: new Map<string, AuthUserRecord>(),
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
    const token = authorization.slice("Bearer ".length);
    return authState.tokens.get(token) || null;
  },
  getUserById: async (id: string) => {
    return authState.users.has(id) ? clone(authState.users.get(id)!) : null;
  },
  updateUser: async (id: string, patch: Record<string, unknown>) => {
    const user = authState.users.get(id);
    if (!user) return null;
    const next = {
      ...user,
      ...patch,
      updated_at: new Date().toISOString(),
    } as AuthUserRecord;
    authState.users.set(id, next);
    return clone(next);
  },
  hashPassword: async (plain: string) => `hash:${plain}`,
  verifyPassword: async (plain: string, hash: string) => hash === `hash:${plain}`,
  deleteUser: async () => {},
  signJwt: () => "test-token",
  toPublicProfile: (user: AuthUserRecord) => ({
    id: user.id,
    email: user.email,
    role: user.role,
    tier: user.tier,
  }),
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

vi.mock("../subscription-finance.js", () => ({
  getSubscriptionFinanceSummary: async () => ({
    available: false,
    activeSubscriptions: 0,
    mappedActiveSubscriptions: 0,
    unmappedActiveSubscriptions: 0,
    estimatedMonthlyRecurringRevenue: 0,
    estimatedAnnualContractValue: 0,
    activeByTier: {},
    estimatedMonthlyByTier: {},
    breakdown: [],
    unavailableReason: "mocked",
  }),
}));

function makeUser(overrides: Partial<AuthUserRecord>): AuthUserRecord {
  const id = overrides.id || "user-1";
  return {
    id,
    email: overrides.email || `${id}@test.local`,
    password_hash: overrides.password_hash ?? null,
    display_name: overrides.display_name || "Test User",
    username: overrides.username || `@${id}`,
    tier: overrides.tier || "FREE",
    role: overrides.role || "user",
    avatar_url: overrides.avatar_url ?? null,
    bio: overrides.bio ?? null,
    website: overrides.website ?? null,
    banned: overrides.banned ?? false,
    provider: overrides.provider || "email",
    google_id: overrides.google_id ?? null,
    created_at: overrides.created_at || new Date().toISOString(),
    updated_at: overrides.updated_at || new Date().toISOString(),
  };
}

async function loadApp() {
  const mod = await import("../app.ts");
  return mod.default;
}

async function putJson(app: any, path: string, body: Record<string, unknown>, token?: string) {
  return app.request(path, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("app auth password integration", () => {
  beforeEach(() => {
    vi.resetModules();
    kvState.store.clear();
    authState.tokens.clear();
    authState.users.clear();
  });

  it("allows a social account without local password to create one", async () => {
    authState.tokens.set("token-social", "user-social");
    authState.users.set(
      "user-social",
      makeUser({
        id: "user-social",
        email: "social@test.local",
        provider: "google",
        password_hash: null,
      })
    );

    const app = await loadApp();
    const res = await putJson(
      app,
      "/api/auth/me/password",
      { newPassword: "NuevaClave1!" },
      "token-social"
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toContain("creada");
    expect(authState.users.get("user-social")?.password_hash).toBe("hash:NuevaClave1!");
  });

  it("requires current password when the user already has one", async () => {
    authState.tokens.set("token-email", "user-email");
    authState.users.set(
      "user-email",
      makeUser({
        id: "user-email",
        email: "email@test.local",
        provider: "email",
        password_hash: "hash:Actual123!",
      })
    );

    const app = await loadApp();
    const res = await putJson(
      app,
      "/api/auth/me/password",
      { newPassword: "NuevaClave1!" },
      "token-email"
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("contraseña actual");
  });

  it("rejects an incorrect current password for an existing local account", async () => {
    authState.tokens.set("token-email", "user-email");
    authState.users.set(
      "user-email",
      makeUser({
        id: "user-email",
        email: "email@test.local",
        provider: "email",
        password_hash: "hash:Actual123!",
      })
    );

    const app = await loadApp();
    const res = await putJson(
      app,
      "/api/auth/me/password",
      {
        currentPassword: "incorrecta",
        newPassword: "NuevaClave1!",
      },
      "token-email"
    );

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain("incorrecta");
  });
});
