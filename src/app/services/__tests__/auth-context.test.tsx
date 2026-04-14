/**
 * auth-context tests — Provider, useAuth hook, login/logout/register flows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { AuthProvider, useAuth } from "../auth-context";

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockProfile = {
  id: "user-1",
  displayName: "Test User",
  username: "@test",
  email: "test@vorea.com",
  tier: "FREE",
  role: "user",
  avatarUrl: null,
  bio: null,
  website: null,
  phone: null,
  countryCode: "UY",
  regionCode: "UY",
  defaultLocale: "es",
  billingProfile: null,
  emailVerifiedAt: null,
  phoneVerifiedAt: null,
  banned: false,
  createdAt: "2024-01-01",
};

const mockApiMethods = vi.hoisted(() => ({
  signin: vi.fn(),
  signup: vi.fn(),
  signout: vi.fn(),
  getProfileEnvelope: vi.fn(),
  getSession: vi.fn(),
  updateProfile: vi.fn(),
  googleSignIn: vi.fn(),
}));

const mockToolCredits = vi.hoisted(() => ({
  getMine: vi.fn(() => Promise.resolve({ balance: 100 })),
}));

vi.mock("../api-client", () => ({
  AuthApi: mockApiMethods,
  ToolCreditsApi: mockToolCredits,
  getStoredToken: vi.fn(() => null),
  setStoredToken: vi.fn(),
  getCachedAccessToken: vi.fn(() => null),
  setCachedAccessToken: vi.fn(),
}));

vi.mock("../storage", () => ({
  UserService: {
    update: vi.fn(),
    get: vi.fn(() => null),
    clear: vi.fn(),
  },
}));

vi.mock("../../../../utils/config/info", () => ({
  apiUrl: "http://localhost:3001",
  ownerEmail: "owner@vorea.com",
}));

vi.mock("../session-cleanup", () => ({
  clearSensitiveLocalStateOnLogout: vi.fn(),
}));

vi.mock("../analytics", () => ({
  trackAnalyticsEvent: vi.fn(),
}));

function wrapper({ children }: { children: ReactNode }) {
  return createElement(AuthProvider, null, children);
}

describe("auth-context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiMethods.getProfileEnvelope.mockResolvedValue({
      profile: null,
      regionPolicy: null,
    });
  });

  it("useAuth returns default values outside provider", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it("provider resolves to not-loading state", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("login sets user and isLoggedIn", async () => {
    mockApiMethods.signin.mockResolvedValue({
      user: { id: "user-1", displayName: "Test", tier: "FREE" },
      session: { access_token: "jwt-token" },
    });
    mockApiMethods.getProfileEnvelope.mockResolvedValue({
      profile: mockProfile,
      regionPolicy: { allowed: true },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login("test@vorea.com", "password123");
    });

    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.user?.email).toBe("test@vorea.com");
    expect(result.current.user?.displayName).toBe("Test User");
  });

  it("login throws on failure", async () => {
    mockApiMethods.signin.mockRejectedValue(new Error("Invalid credentials"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(() => result.current.login("bad@email.com", "wrong"))
    ).rejects.toThrow("Invalid credentials");

    expect(result.current.isLoggedIn).toBe(false);
  });

  it("register creates user and sets state", async () => {
    mockApiMethods.signup.mockResolvedValue({
      user: { id: "user-2" },
      profile: mockProfile,
    });
    mockApiMethods.getProfileEnvelope.mockResolvedValue({
      profile: { ...mockProfile, id: "user-2", email: "new@vorea.com" },
      regionPolicy: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.register({
        displayName: "New User",
        username: "@newuser",
        email: "new@vorea.com",
        password: "SecureP@ss1",
      });
    });

    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.user?.email).toBe("new@vorea.com");
  });

  it("register throws on failure", async () => {
    mockApiMethods.signup.mockRejectedValue(new Error("Email ya registrado"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(() =>
        result.current.register({
          displayName: "Dup",
          username: "@dup",
          email: "dup@vorea.com",
          password: "SecureP@ss1",
        })
      )
    ).rejects.toThrow("Email ya registrado");
  });

  it("logout clears state", async () => {
    // First login
    mockApiMethods.signin.mockResolvedValue({
      user: { id: "user-1" },
      session: { access_token: "jwt" },
    });
    mockApiMethods.getProfileEnvelope.mockResolvedValue({
      profile: mockProfile,
      regionPolicy: null,
    });
    mockApiMethods.signout.mockResolvedValue(undefined);

    // Mock window.location.reload
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login("test@vorea.com", "pass");
    });

    expect(result.current.isLoggedIn).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("upgradeTier throws when not logged in", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(() => result.current.upgradeTier("PRO"))
    ).rejects.toThrow("Debes iniciar sesion");
  });

  it("refreshCredits fetches credit balance", async () => {
    mockToolCredits.getMine.mockResolvedValue({ balance: 42 });

    // Login first
    mockApiMethods.signin.mockResolvedValue({
      user: { id: "user-1" },
      session: { access_token: "jwt" },
    });
    mockApiMethods.getProfileEnvelope.mockResolvedValue({
      profile: mockProfile,
      regionPolicy: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login("test@vorea.com", "pass");
    });

    await act(async () => {
      await result.current.refreshCredits();
    });

    expect(result.current.creditBalance).toBe(42);
  });

  it("socialLogin with google sets user", async () => {
    mockApiMethods.googleSignIn.mockResolvedValue({
      token: "google-jwt",
      profile: mockProfile,
    });
    mockApiMethods.getProfileEnvelope.mockResolvedValue({
      profile: mockProfile,
      regionPolicy: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.socialLogin("google", "google-credential-token");
    });

    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.user?.email).toBe("test@vorea.com");
  });

  it("socialLogin throws for unsupported provider", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(() => result.current.socialLogin("instagram"))
    ).rejects.toThrow("not supported");
  });

  it("auto-grants superadmin for owner email", async () => {
    const ownerProfile = { ...mockProfile, email: "owner@vorea.com", role: "user" };
    mockApiMethods.signin.mockResolvedValue({
      user: { id: "owner-1" },
      session: { access_token: "jwt" },
    });
    mockApiMethods.getProfileEnvelope.mockResolvedValue({
      profile: ownerProfile,
      regionPolicy: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login("owner@vorea.com", "pass");
    });

    expect(result.current.isSuperAdmin).toBe(true);
    expect(result.current.user?.role).toBe("superadmin");
  });
});
