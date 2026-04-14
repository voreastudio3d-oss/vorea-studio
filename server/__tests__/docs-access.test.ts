// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const kvMocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  verifyJwt: vi.fn(),
  getUserById: vi.fn(),
}));

const cookieMocks = vi.hoisted(() => ({
  deleteCookie: vi.fn(),
  setCookie: vi.fn(),
}));

vi.mock("../kv.js", () => kvMocks);
vi.mock("../auth.js", () => authMocks);
vi.mock("hono/cookie", () => cookieMocks);

function createContext(headers: Record<string, string> = {}) {
  const req = new Request("http://localhost/docs", { headers });
  return {
    req: {
      header: (name: string) => req.headers.get(name) || undefined,
    },
  } as any;
}

describe("docs-access", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.NODE_ENV;
  });

  it("detects protected docs paths", async () => {
    const { isProtectedDocsPath } = await import("../docs-access.ts");
    expect(isProtectedDocsPath("/docs")).toBe(true);
    expect(isProtectedDocsPath("/docs/api/endpoint-matrix.md")).toBe(true);
    expect(isProtectedDocsPath("/openapi.json")).toBe(true);
    expect(isProtectedDocsPath("/")).toBe(false);
  });

  it("allows access for a superadmin JWT stored in the session cookie", async () => {
    authMocks.verifyJwt.mockReturnValue({ sub: "u_admin" });
    authMocks.getUserById.mockResolvedValue({
      id: "u_admin",
      email: "admin@test.local",
      role: "superadmin",
    });
    kvMocks.get.mockResolvedValue(null);

    const { hasSuperAdminAccessFromContext, AUTH_COOKIE_NAME } = await import("../docs-access.ts");
    const c = createContext({
      Cookie: `${AUTH_COOKIE_NAME}=jwt-token`,
    });

    await expect(hasSuperAdminAccessFromContext(c)).resolves.toBe(true);
  });

  it("denies access for a regular user", async () => {
    authMocks.verifyJwt.mockReturnValue({ sub: "u_user" });
    authMocks.getUserById.mockResolvedValue({
      id: "u_user",
      email: "user@test.local",
      role: "user",
    });
    kvMocks.get.mockResolvedValue({ id: "u_user", email: "user@test.local", role: "user" });

    const { hasSuperAdminAccessFromContext, AUTH_COOKIE_NAME } = await import("../docs-access.ts");
    const c = createContext({
      Cookie: `${AUTH_COOKIE_NAME}=jwt-token`,
    });

    await expect(hasSuperAdminAccessFromContext(c)).resolves.toBe(false);
  });

  it("prefers bearer authorization tokens over cookies", async () => {
    const { getRequestToken, AUTH_COOKIE_NAME } = await import("../docs-access.ts");

    const c = createContext({
      Authorization: "Bearer api-token",
      Cookie: `${AUTH_COOKIE_NAME}=cookie-token`,
    });

    expect(getRequestToken(c)).toBe("api-token");
  });

  it("reads and decodes the session token from cookies", async () => {
    const { getRequestToken, AUTH_COOKIE_NAME } = await import("../docs-access.ts");

    const c = createContext({
      Cookie: `theme=dark; ${AUTH_COOKIE_NAME}=jwt%20token%2Bencoded`,
    });

    expect(getRequestToken(c)).toBe("jwt token+encoded");
  });

  it("returns null when the bearer token is blank", async () => {
    const { getRequestToken } = await import("../docs-access.ts");

    expect(getRequestToken(createContext({ Authorization: "Bearer   " }))).toBeNull();
  });

  it("returns false when no token is present", async () => {
    const { hasSuperAdminAccessFromContext } = await import("../docs-access.ts");

    await expect(hasSuperAdminAccessFromContext(createContext())).resolves.toBe(false);
    expect(authMocks.verifyJwt).not.toHaveBeenCalled();
  });

  it("returns false when the jwt payload has no subject", async () => {
    authMocks.verifyJwt.mockReturnValue({});

    const { hasSuperAdminAccessFromContext, AUTH_COOKIE_NAME } = await import("../docs-access.ts");

    await expect(
      hasSuperAdminAccessFromContext(createContext({ Cookie: `${AUTH_COOKIE_NAME}=jwt-token` }))
    ).resolves.toBe(false);
    expect(authMocks.getUserById).not.toHaveBeenCalled();
  });

  it("accepts superadmin access from the cached profile even without a db user", async () => {
    authMocks.verifyJwt.mockReturnValue({ sub: "u_cached" });
    authMocks.getUserById.mockResolvedValue(null);
    kvMocks.get.mockResolvedValue({ id: "u_cached", role: "superadmin" });

    const { hasSuperAdminAccessFromContext, AUTH_COOKIE_NAME } = await import("../docs-access.ts");

    await expect(
      hasSuperAdminAccessFromContext(createContext({ Cookie: `${AUTH_COOKIE_NAME}=jwt-token` }))
    ).resolves.toBe(true);
  });

  it("accepts configured superadmin emails case-insensitively", async () => {
    authMocks.verifyJwt.mockReturnValue({ sub: "u_owner" });
    authMocks.getUserById.mockResolvedValue({
      id: "u_owner",
      email: "MartinDaguerre@Gmail.com",
      role: "user",
    });
    kvMocks.get.mockResolvedValue(null);

    const { hasSuperAdminAccessFromContext, AUTH_COOKIE_NAME } = await import("../docs-access.ts");

    await expect(
      hasSuperAdminAccessFromContext(createContext({ Cookie: `${AUTH_COOKIE_NAME}=jwt-token` }))
    ).resolves.toBe(true);
  });

  it("returns false when loading profile data throws", async () => {
    authMocks.verifyJwt.mockReturnValue({ sub: "u_broken" });
    authMocks.getUserById.mockRejectedValue(new Error("db offline"));
    kvMocks.get.mockResolvedValue(null);

    const { hasSuperAdminAccessFromContext, AUTH_COOKIE_NAME } = await import("../docs-access.ts");

    await expect(
      hasSuperAdminAccessFromContext(createContext({ Cookie: `${AUTH_COOKIE_NAME}=jwt-token` }))
    ).resolves.toBe(false);
  });

  it("sets the auth cookie with production-safe options", async () => {
    process.env.NODE_ENV = "production";
    const { setSessionCookie, AUTH_COOKIE_NAME } = await import("../docs-access.ts");

    setSessionCookie({} as any, "signed-token");

    expect(cookieMocks.setCookie).toHaveBeenCalledWith(
      {},
      AUTH_COOKIE_NAME,
      "signed-token",
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        path: "/",
      })
    );
  });

  it("clears the auth cookie from the root path", async () => {
    const { clearSessionCookie, AUTH_COOKIE_NAME } = await import("../docs-access.ts");

    clearSessionCookie({} as any);

    expect(cookieMocks.deleteCookie).toHaveBeenCalledWith(
      {},
      AUTH_COOKIE_NAME,
      expect.objectContaining({ path: "/" })
    );
  });
});
