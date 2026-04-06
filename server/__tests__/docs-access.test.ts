// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const kvMocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  verifyJwt: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock("../kv.js", () => kvMocks);
vi.mock("../auth.js", () => authMocks);

describe("docs-access", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
    const req = new Request("http://localhost/docs", {
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=jwt-token`,
      },
    });
    const c: any = {
      req: {
        header: (name: string) => req.headers.get(name) || undefined,
      },
    };

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
    const req = new Request("http://localhost/docs", {
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=jwt-token`,
      },
    });
    const c: any = {
      req: {
        header: (name: string) => req.headers.get(name) || undefined,
      },
    };

    await expect(hasSuperAdminAccessFromContext(c)).resolves.toBe(false);
  });
});
