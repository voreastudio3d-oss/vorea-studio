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
  phone: string | null;
  country_code: string | null;
  region_code: string | null;
  default_locale: string | null;
  billing_profile: Record<string, unknown> | null;
  email_verified_at: string | null;
  phone_verified_at: string | null;
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
    emailVerifiedAt: user.email_verified_at,
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
    password_hash: overrides.password_hash ?? "hash:Actual123!",
    display_name: overrides.display_name || "Test User",
    username: overrides.username || `@${id}`,
    tier: overrides.tier || "FREE",
    role: overrides.role || "user",
    avatar_url: overrides.avatar_url ?? null,
    bio: overrides.bio ?? null,
    website: overrides.website ?? null,
    phone: overrides.phone ?? null,
    country_code: overrides.country_code ?? "UY",
    region_code: overrides.region_code ?? "LATAM",
    default_locale: overrides.default_locale ?? "es",
    billing_profile: overrides.billing_profile ?? null,
    email_verified_at: overrides.email_verified_at ?? null,
    phone_verified_at: overrides.phone_verified_at ?? null,
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

async function postJson(app: any, path: string, body: Record<string, unknown>, token?: string) {
  return app.request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("app auth email verification integration", () => {
  beforeEach(() => {
    vi.resetModules();
    kvState.store.clear();
    authState.tokens.clear();
    authState.users.clear();
    delete process.env.RESEND_API_KEY;
    process.env.NODE_ENV = "test";
  });

  it("issues a short-lived email verification code and verifies the current email", async () => {
    authState.tokens.set("token-email", "user-email");
    authState.users.set(
      "user-email",
      makeUser({
        id: "user-email",
        email: "email@test.local",
        email_verified_at: null,
      })
    );
    await kvState.store.set("user:user-email:profile", {
      id: "user-email",
      email: "email@test.local",
      emailVerifiedAt: null,
    });

    const app = await loadApp();
    const requestRes = await postJson(
      app,
      "/api/auth/request-email-verification",
      {},
      "token-email"
    );

    expect(requestRes.status).toBe(200);
    const requestJson = await requestRes.json();
    expect(requestJson.codeDev).toMatch(/^\d{6}$/);
    expect(kvState.store.get("email_verify:user-email")).toBeTruthy();

    const verifyRes = await postJson(
      app,
      "/api/auth/verify-email",
      { code: requestJson.codeDev },
      "token-email"
    );

    expect(verifyRes.status).toBe(200);
    const verifyJson = await verifyRes.json();
    expect(verifyJson.verifiedAt).toBeTruthy();
    expect(authState.users.get("user-email")?.email_verified_at).toBeTruthy();
    expect(kvState.store.get("email_verify:user-email")).toBeUndefined();
    expect(kvState.store.get("user:user-email:profile")?.emailVerifiedAt).toBeTruthy();
  });

  it("rejects an invalid email verification code", async () => {
    authState.tokens.set("token-email", "user-email");
    authState.users.set(
      "user-email",
      makeUser({
        id: "user-email",
        email: "email@test.local",
        email_verified_at: null,
      })
    );
    await kvState.store.set("email_verify:user-email", {
      code: "123456",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    });

    const app = await loadApp();
    const verifyRes = await postJson(
      app,
      "/api/auth/verify-email",
      { code: "654321" },
      "token-email"
    );

    expect(verifyRes.status).toBe(400);
    const verifyJson = await verifyRes.json();
    expect(verifyJson.error).toContain("inválido");
    expect(authState.users.get("user-email")?.email_verified_at).toBeNull();
  });
});
