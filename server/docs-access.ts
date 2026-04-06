import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import * as auth from "./auth.js";
import * as kv from "./kv.js";

export const AUTH_COOKIE_NAME = "vorea_session";
const SUPERADMIN_EMAILS = new Set(["admin@vorea.studio", "vorea.studio3d@gmail.com", "martindaguerre@gmail.com"]);

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, AUTH_COOKIE_NAME, {
    path: "/",
  });
}

export function getRequestToken(c: Context): string | null {
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim() || null;
  }
  const cookieHeader = c.req.header("Cookie") || "";
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(`${AUTH_COOKIE_NAME}=`.length)) || null;
}

export async function hasSuperAdminAccessFromContext(c: Context): Promise<boolean> {
  const token = getRequestToken(c);
  if (!token) return false;

  const payload = auth.verifyJwt(token);
  const userId = payload?.sub;
  if (!userId) return false;

  try {
    const [profile, dbUser] = await Promise.all([
      kv.get(`user:${userId}:profile`),
      auth.getUserById(userId),
    ]);

    if (profile?.role === "superadmin") return true;
    if (dbUser?.role === "superadmin") return true;

    const email = dbUser?.email || profile?.email;
    return !!email && SUPERADMIN_EMAILS.has(String(email).toLowerCase());
  } catch {
    return false;
  }
}

export function isProtectedDocsPath(pathname: string): boolean {
  return pathname === "/docs" || pathname.startsWith("/docs/") || pathname === "/openapi.json";
}
