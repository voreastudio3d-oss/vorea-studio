/**
 * Auth module unit tests — pure JWT + password functions only.
 * DB-dependent CRUD functions are tested in integration tests.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock pg to avoid real DB connections
vi.mock("pg", () => {
  function Pool() {
    return { query: vi.fn().mockResolvedValue({ rows: [] }) };
  }
  return { default: { Pool }, Pool };
});

// Mock profile-region-policy
vi.mock("../profile-region-policy.js", () => ({
  resolveRegionCode: vi.fn(() => "UY"),
  normalizeCountryCode: vi.fn((c: string) => c?.toUpperCase()),
}));

let auth: typeof import("../auth.js");

beforeAll(async () => {
  auth = await import("../auth.js");
});

describe("auth — JWT functions", () => {
  it("signJwt returns a non-empty string", () => {
    const token = auth.signJwt("user-1", "test@example.com", "user");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  it("verifyJwt decodes a valid token", () => {
    const token = auth.signJwt("user-2", "admin@vorea.com", "admin");
    const payload = auth.verifyJwt(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("user-2");
    expect(payload!.email).toBe("admin@vorea.com");
    expect(payload!.role).toBe("admin");
  });

  it("verifyJwt returns null for invalid token", () => {
    expect(auth.verifyJwt("invalid.token.here")).toBeNull();
  });

  it("verifyJwt returns null for empty string", () => {
    expect(auth.verifyJwt("")).toBeNull();
  });

  it("JWT payload contains iat and exp", () => {
    const token = auth.signJwt("user-3", "t@t.com", "user");
    const payload = auth.verifyJwt(token);
    expect(payload!.iat).toBeDefined();
    expect(payload!.exp).toBeDefined();
    expect(payload!.exp!).toBeGreaterThan(payload!.iat!);
  });
});

describe("auth — password functions", () => {
  it("hashPassword returns a bcrypt hash", async () => {
    const hash = await auth.hashPassword("MySecureP@ss1");
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash.length).toBeGreaterThan(50);
  });

  it("verifyPassword returns true for correct password", async () => {
    const hash = await auth.hashPassword("correctPassword");
    expect(await auth.verifyPassword("correctPassword", hash)).toBe(true);
  });

  it("verifyPassword returns false for wrong password", async () => {
    const hash = await auth.hashPassword("correctPassword");
    expect(await auth.verifyPassword("wrongPassword", hash)).toBe(false);
  });

  it("different passwords produce different hashes", async () => {
    const h1 = await auth.hashPassword("password1");
    const h2 = await auth.hashPassword("password2");
    expect(h1).not.toBe(h2);
  });
});

describe("auth — getUserIdFromHeader", () => {
  it("extracts user id from valid Bearer header", () => {
    const token = auth.signJwt("user-42", "u@v.com", "user");
    const id = auth.getUserIdFromHeader(`Bearer ${token}`);
    expect(id).toBe("user-42");
  });

  it("returns null for missing header", () => {
    expect(auth.getUserIdFromHeader(undefined as any)).toBeNull();
    expect(auth.getUserIdFromHeader("")).toBeNull();
  });

  it("returns null for non-Bearer header", () => {
    expect(auth.getUserIdFromHeader("Basic dXNlcjpwYXNz")).toBeNull();
  });
});

describe("auth — toPublicProfile", () => {
  it("strips sensitive fields from user object", () => {
    const user = {
      id: "u-1",
      email: "test@test.com",
      password_hash: "$2b$12$abcdef",
      display_name: "Test User",
      username: "@test",
      tier: "FREE",
      role: "user",
      avatar_url: null,
      bio: null,
      website: null,
      phone: null,
      country_code: "UY",
      region_code: "UY",
      default_locale: "es",
      billing_profile: null,
      email_verified_at: null,
      phone_verified_at: null,
      banned: false,
      provider: "email",
      google_id: null,
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    };
    const profile = auth.toPublicProfile(user);
    expect(profile).not.toHaveProperty("password_hash");
    expect(profile).toHaveProperty("id");
    expect(profile).toHaveProperty("email");
    // toPublicProfile converts snake_case to camelCase
    expect(profile.id).toBe("u-1");
  });
});
