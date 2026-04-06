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
  getUserByEmail: async () => null,
  getUserByGoogleId: async () => null,
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
    phone: overrides.phone ?? null,
    country_code: overrides.country_code ?? null,
    region_code: overrides.region_code ?? null,
    default_locale: overrides.default_locale ?? null,
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

describe("app auth profile integration", () => {
  beforeEach(() => {
    vi.resetModules();
    kvState.store.clear();
    authState.tokens.clear();
    authState.users.clear();
  });

  it("returns canonical profile data plus region policy", async () => {
    authState.tokens.set("token-profile", "user-profile");
    authState.users.set(
      "user-profile",
      makeUser({
        id: "user-profile",
        email: "profile@test.local",
        display_name: "Martina",
        username: "@martina",
        phone: "+59899123456",
        country_code: "UY",
        region_code: "LATAM",
        default_locale: "es",
      })
    );

    const app = await loadApp();
    const res = await app.request("/api/auth/me", {
      headers: {
        Authorization: "Bearer token-profile",
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profile.displayName).toBe("Martina");
    expect(json.profile.countryCode).toBe("UY");
    expect(json.profile.regionCode).toBe("LATAM");
    expect(json.profile.defaultLocale).toBe("es");
    expect(json.regionPolicy.regionCode).toBe("LATAM");
    expect(json.regionPolicy.recommendedPaymentProviders).toContain("mercado_pago");
  });

  it("derives region from country when kv profile carries a stale region code", async () => {
    authState.tokens.set("token-profile", "user-profile");
    authState.users.set(
      "user-profile",
      makeUser({
        id: "user-profile",
        email: "profile@test.local",
        display_name: "Martina",
        username: "@martina",
        country_code: "UY",
        region_code: "LATAM",
      })
    );
    kvState.store.set("user:user-profile:profile", {
      displayName: "Martina",
      username: "@martina",
      countryCode: "UY",
      regionCode: "GLOBAL",
    });

    const app = await loadApp();
    const res = await app.request("/api/auth/me", {
      headers: {
        Authorization: "Bearer token-profile",
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profile.countryCode).toBe("UY");
    expect(json.profile.regionCode).toBe("LATAM");
    expect(json.regionPolicy.regionCode).toBe("LATAM");
  });

  it("normalizes self profile updates and blocks tier escalation", async () => {
    authState.tokens.set("token-profile", "user-profile");
    authState.users.set(
      "user-profile",
      makeUser({
        id: "user-profile",
        email: "profile@test.local",
        display_name: "Martina",
        username: "@martina",
        tier: "FREE",
      })
    );

    const app = await loadApp();
    const res = await app.request("/api/auth/me", {
      method: "PUT",
      headers: {
        Authorization: "Bearer token-profile",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName: " Martina Daguerre ",
        username: "martina.global",
        phone: " +598 99 123 456 ",
        countryCode: "uy",
        defaultLocale: "pt-BR",
        billingProfile: {
          fullName: "Martina Daguerre",
          companyName: "Vorea Studio",
          countryCode: "uy",
        },
        tier: "STUDIO PRO",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.profile.displayName).toBe("Martina Daguerre");
    expect(json.profile.username).toBe("@martina.global");
    expect(json.profile.phone).toBe("+59899123456");
    expect(json.profile.countryCode).toBe("UY");
    expect(json.profile.regionCode).toBe("LATAM");
    expect(json.profile.defaultLocale).toBe("pt");
    expect(json.profile.billingProfile.countryCode).toBe("UY");

    expect(authState.users.get("user-profile")?.tier).toBe("FREE");
    expect(authState.users.get("user-profile")?.country_code).toBe("UY");
    expect(authState.users.get("user-profile")?.region_code).toBe("LATAM");
    expect(kvState.store.get("user:user-profile:profile")?.phone).toBe("+59899123456");
  });
});
