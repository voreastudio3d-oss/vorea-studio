/**
 * api-client unit tests — token management & API wrapper logic.
 * Tests pure functions + fetchApi mocking via global.fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getStoredToken,
  setStoredToken,
  setCachedAccessToken,
  getCachedAccessToken,
  AuthApi,
  GCodeApi,
  CreditsApi,
} from "../api-client";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

// Mock analytics
vi.mock("../analytics", () => ({
  trackAnalyticsEvent: vi.fn(),
}));

// Mock config
vi.mock("../../../../utils/config/info", () => ({
  apiUrl: "http://localhost:3001",
}));

describe("api-client — token management", () => {
  beforeEach(() => localStorage.clear());

  it("getStoredToken returns null when no token", () => {
    expect(getStoredToken()).toBeNull();
  });

  it("setStoredToken stores a value", () => {
    setStoredToken("test-jwt-123");
    expect(getStoredToken()).toBe("test-jwt-123");
  });

  it("setStoredToken(null) clears the token", () => {
    setStoredToken("abc");
    setStoredToken(null);
    expect(getStoredToken()).toBeNull();
  });

  it("setCachedAccessToken is an alias for setStoredToken", () => {
    setCachedAccessToken("legacy-token");
    expect(getCachedAccessToken()).toBe("legacy-token");
  });
});

describe("api-client — AuthApi", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("signup stores token on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ token: "new-jwt", user: { id: "u1" } }),
      clone: function () { return this; },
    });

    const result = await AuthApi.signup({
      email: "test@vorea.com",
      password: "SecureP@ss1",
    });

    expect(result.token).toBe("new-jwt");
    expect(getStoredToken()).toBe("new-jwt");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/auth/signup",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("signup throws on error response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "Email ya registrado" }),
      clone: function () { return this; },
    });

    await expect(AuthApi.signup({ email: "dup@vorea.com", password: "Pass1!" }))
      .rejects.toThrow("Email ya registrado");
  });

  it("signin returns session and stores token", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        token: "signin-jwt",
        user: { id: "u2" },
        profile: { displayName: "Test" },
      }),
      clone: function () { return this; },
    });

    const result = await AuthApi.signin("user@vorea.com", "pass");
    expect(result.session.access_token).toBe("signin-jwt");
    expect(result.user.id).toBe("u2");
    expect(getStoredToken()).toBe("signin-jwt");
  });

  it("signout clears token", async () => {
    setStoredToken("existing-token");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      clone: function () { return this; },
    });

    await AuthApi.signout();
    expect(getStoredToken()).toBeNull();
  });

  it("signout clears token even on network error", async () => {
    setStoredToken("existing-token");
    fetchMock.mockRejectedValueOnce(new Error("Network down"));

    await AuthApi.signout();
    expect(getStoredToken()).toBeNull();
  });

  it("getSession returns null when no token", async () => {
    const session = await AuthApi.getSession();
    expect(session).toBeNull();
  });

  it("getSession returns token when valid", async () => {
    setStoredToken("valid-jwt");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ profile: {} }),
      clone: function () { return this; },
    });

    const session = await AuthApi.getSession();
    expect(session?.access_token).toBe("valid-jwt");
  });

  it("getSession clears token when server returns 401", async () => {
    setStoredToken("expired-jwt");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
      clone: function () { return this; },
    });

    const session = await AuthApi.getSession();
    expect(session).toBeNull();
    expect(getStoredToken()).toBeNull();
  });

  it("getProfileEnvelope returns null profile on error", async () => {
    setStoredToken("some-token");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
      clone: function () { return this; },
    });

    const result = await AuthApi.getProfileEnvelope();
    expect(result.profile).toBeNull();
    expect(result.regionPolicy).toBeNull();
  });

  it("updateProfile sends PUT request", async () => {
    setStoredToken("token");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ profile: { displayName: "Updated" } }),
      clone: function () { return this; },
    });

    const profile = await AuthApi.updateProfile({ displayName: "Updated" });
    expect(profile.displayName).toBe("Updated");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/auth/me",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("googleSignIn stores token", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ token: "google-jwt", user: { id: "g1" } }),
    });

    const result = await AuthApi.googleSignIn("google-credential");
    expect(result.token).toBe("google-jwt");
    expect(getStoredToken()).toBe("google-jwt");
  });

  it("getGoogleConfig returns configured:false on error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));
    const config = await AuthApi.getGoogleConfig();
    expect(config.configured).toBe(false);
  });
});

describe("api-client — GCodeApi", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  it("list returns items on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [{ id: "g1", name: "test.gcode" }] }),
      clone: function () { return this; },
    });

    const items = await GCodeApi.list();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("test.gcode");
  });

  it("list returns empty array on error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Server error"),
      clone: function () { return this; },
    });

    const items = await GCodeApi.list();
    expect(items).toEqual([]);
  });

  it("save sends POST with name and gcode", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ item: { id: "new-1", name: "cube.gcode" } }),
      clone: function () { return this; },
    });

    const item = await GCodeApi.save("cube.gcode", "G28\nG1 X10 Y10");
    expect(item.name).toBe("cube.gcode");
  });

  it("remove sends DELETE request", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      clone: function () { return this; },
    });

    const result = await GCodeApi.remove("g1");
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/gcode/g1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

describe("api-client — CreditsApi", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  it("get returns credits on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ credits: 42 }),
      clone: function () { return this; },
    });

    const credits = await CreditsApi.get();
    expect(credits).toBe(42);
  });

  it("get returns null on error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
      clone: function () { return this; },
    });

    const credits = await CreditsApi.get();
    expect(credits).toBeNull();
  });

  it("consume throws when no credits", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "Sin creditos" }),
      clone: function () { return this; },
    });

    await expect(CreditsApi.consume()).rejects.toThrow("Sin creditos");
  });

  it("purchase sends packId and credits", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ balance: 100 }),
      clone: function () { return this; },
    });

    const result = await CreditsApi.purchase("pack-1", 50);
    expect(result.balance).toBe(100);
  });
});

describe("api-client — rate limit handling", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  it("shows toast on 429 response", async () => {
    const { toast } = await import("sonner");
    vi.mocked(toast.error).mockClear();

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: "Rate limited" }),
      clone: function () {
        return {
          json: () => Promise.resolve({ error: "Demasiadas peticiones" }),
        };
      },
    });

    // Trigger a fetchApi call via a public method
    await CreditsApi.get();
    expect(toast.error).toHaveBeenCalled();
  });
});
