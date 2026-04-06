/**
 * Auth context – provides reactive login state to the entire app.
 * Self-hosted auth: JWT-based with localStorage persistence.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { UserProfile, MembershipTier, UserRole, RegionPolicySummary } from "./types";
import { UserService } from "./storage";
import { AuthApi, ToolCreditsApi, setStoredToken, getStoredToken } from "./api-client";
import { ownerEmail as OWNER_EMAIL } from "../../../utils/config/info";
import { clearSensitiveLocalStateOnLogout } from "./session-cleanup";
import { trackAnalyticsEvent } from "./analytics";

interface AuthContextValue {
  isLoggedIn: boolean;
  user: UserProfile | null;
  loading: boolean;
  isSuperAdmin: boolean;
  regionPolicy: RegionPolicySummary | null;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (data: {
    displayName: string;
    username: string;
    email: string;
    password: string;
  }) => Promise<UserProfile>;
  logout: () => Promise<void>;
  upgradeTier: (tier: MembershipTier) => Promise<void>;
  refreshUser: () => Promise<void>;
  creditBalance: number | null;
  refreshCredits: () => Promise<void>;
  isOnline: boolean;
  socialLogin: (provider: "google" | "instagram", credential?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  isLoggedIn: false,
  user: null,
  loading: true,
  isSuperAdmin: false,
  regionPolicy: null,
  login: async () => null as any,
  register: async () => null as any,
  logout: async () => {},
  upgradeTier: async () => {},
  refreshUser: async () => {},
  creditBalance: null,
  refreshCredits: async () => {},
  isOnline: false,
  socialLogin: async () => {},
});

function mapApiProfileToUserProfile(profile: Record<string, any>): UserProfile {
  return {
    id: profile.id,
    displayName: profile.displayName || profile.display_name || "",
    username: profile.username || "",
    email: profile.email || "",
    tier: (profile.tier || "FREE") as MembershipTier,
    role: profile.role as UserRole | undefined,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio ?? null,
    website: profile.website ?? null,
    phone: profile.phone ?? null,
    countryCode: profile.countryCode ?? null,
    regionCode: profile.regionCode ?? null,
    defaultLocale: profile.defaultLocale ?? null,
    billingProfile: profile.billingProfile ?? null,
    emailVerifiedAt: profile.emailVerifiedAt ?? null,
    phoneVerifiedAt: profile.phoneVerifiedAt ?? null,
    banned: Boolean(profile.banned ?? false),
    createdAt: profile.createdAt || new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [regionPolicy, setRegionPolicy] = useState<RegionPolicySummary | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  // Fetch credit balance from server
  const fetchCreditBalance = useCallback(async () => {
    try {
      const toolCredits = await ToolCreditsApi.getMine().catch(() => null);
      if (toolCredits) {
        setCreditBalance(toolCredits.balance);
        return;
      }
      setCreditBalance(null);
    } catch {
      // Silently fail
    }
  }, []);

  // ─── Check for existing JWT token on mount ──────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      let token = getStoredToken();
      if (!token) {
        // Check URL for token from OAuth callback
        const urlParams = new URLSearchParams(window.location.search);
        const oauthToken = urlParams.get("token");
        if (oauthToken) {
          setStoredToken(oauthToken);
          token = oauthToken;
          // Clean the URL
          urlParams.delete("token");
          const nextSearch = urlParams.toString();
          const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
          window.history.replaceState({}, "", nextUrl);
        } else {
          setIsLoggedIn(false);
          setUser(null);
          setIsOnline(false);
          setIsSuperAdmin(false);
          setCreditBalance(null);
          setLoading(false);
          return;
        }
      }

      try {
        // Verify token is valid by fetching profile
        const { profile, regionPolicy: nextRegionPolicy } = await AuthApi.getProfileEnvelope();
        if (cancelled) return;

        if (profile) {
          const userProfile = mapApiProfileToUserProfile(profile);

          // Auto-grant superadmin for owner email
          const isOwner = userProfile.email === OWNER_EMAIL;
          if (isOwner && userProfile.role !== "superadmin") {
            userProfile.role = "superadmin";
          }

          setUser(userProfile);
          setRegionPolicy(nextRegionPolicy);
          setIsLoggedIn(true);
          setIsOnline(true);
          if (profile.role === "superadmin" || isOwner) setIsSuperAdmin(true);
          UserService.update(userProfile);
          // Fetch credit balance
          fetchCreditBalance();
        } else {
          // Token invalid — clear it
          setStoredToken(null);
          setIsLoggedIn(false);
          setUser(null);
          setRegionPolicy(null);
          setIsOnline(false);
          setIsSuperAdmin(false);
          setCreditBalance(null);
        }
      } catch (e) {
        console.log("Session check failed:", e, token ? "(token present)" : "(no token)");
        setStoredToken(null);
        setIsLoggedIn(false);
        setUser(null);
        setRegionPolicy(null);
        setIsOnline(false);
        setIsSuperAdmin(false);
        setCreditBalance(null);
      }
      setLoading(false);
    }

    checkExistingSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Login ──────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    try {
      // Try real auth first
      const result = await AuthApi.signin(email, password);
      setIsOnline(true);

      // Fetch profile from server
      const { profile, regionPolicy: nextRegionPolicy } = await AuthApi.getProfileEnvelope();
      const userProfile: UserProfile = profile
        ? mapApiProfileToUserProfile(profile)
        : {
            id: result.user.id,
            displayName: result.user.displayName || email.split("@")[0],
            username: result.user.username || `@${email.split("@")[0]}`,
            email,
            tier: (result.user.tier || "FREE") as MembershipTier,
            createdAt: result.user.createdAt || new Date().toISOString(),
          };

      // Auto-grant superadmin for owner email
      const isOwner = email === OWNER_EMAIL;
      if (isOwner && userProfile.role !== "superadmin") {
        userProfile.role = "superadmin";
      }
      setIsLoggedIn(true);
      setUser(userProfile);
      setRegionPolicy(nextRegionPolicy);
      // Sync to localStorage
      UserService.update(userProfile);
      if (userProfile.role === "superadmin" || isOwner) setIsSuperAdmin(true);
      // Fetch credit balance
      fetchCreditBalance();
      trackAnalyticsEvent("sign_up_complete", { tool: "auth", surface: "account", method: "email" });
      return userProfile;
    } catch (e: any) {
      throw new Error(e?.message || "Login failed. Check your credentials.");
    }
  }, []);

  // ─── Register ───────────────────────────────────────────────────────
  const register = useCallback(
    async (data: {
      displayName: string;
      username: string;
      email: string;
      password: string;
    }) => {
      try {
        // Signup (also stores token and auto-signin)
        const result = await AuthApi.signup({
          email: data.email,
          password: data.password,
          displayName: data.displayName,
          username: data.username,
        });

        setIsOnline(true);
        const { profile, regionPolicy: nextRegionPolicy } = await AuthApi.getProfileEnvelope();

        const userProfile: UserProfile = profile
          ? mapApiProfileToUserProfile(profile)
          : {
              id: result.user?.id || result.profile?.id || "",
              displayName: data.displayName,
              username: data.username.startsWith("@") ? data.username : `@${data.username}`,
              email: data.email,
              tier: "FREE",
              createdAt: new Date().toISOString(),
            };

        setIsLoggedIn(true);
        setUser(userProfile);
        setRegionPolicy(nextRegionPolicy);
        // Sync to localStorage
        UserService.update(userProfile);
        fetchCreditBalance();
        trackAnalyticsEvent("sign_up_complete", { tool: "auth", surface: "account", method: "register" });
        return userProfile;
      } catch (e: any) {
        throw new Error(e?.message || "Registration failed. Please try again.");
      }
    },
    [fetchCreditBalance],
  );

  // ─── Logout ─────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await AuthApi.signout();
    clearSensitiveLocalStateOnLogout();
    setStoredToken(null);
    setIsLoggedIn(false);
    setUser(null);
    setRegionPolicy(null);
    setIsOnline(false);
    setCreditBalance(null);
    setIsSuperAdmin(false);
    window.location.reload();
  }, []);

  // ─── Upgrade tier ───────────────────────────────────────────────────
  const upgradeTier = useCallback(async (tier: MembershipTier) => {
    if (!isLoggedIn || !user) {
      throw new Error("Debes iniciar sesion para cambiar de plan.");
    }
    if (!isOnline) {
      throw new Error("No hay sesion online activa. Vuelve a iniciar sesion.");
    }
    try {
      const updated = await AuthApi.updateProfile({ tier });
      const profile: UserProfile = {
        ...user,
        tier,
        ...(updated || {}),
      };
      setUser(profile);
      UserService.update({ tier });
      fetchCreditBalance();
    } catch (e: any) {
      console.log("Upgrade tier error:", e.message);
      throw new Error(e?.message || "No se pudo actualizar el plan.");
    }
  }, [isLoggedIn, user, isOnline, fetchCreditBalance]);

  // ─── Refresh user ───────────────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const { profile, regionPolicy: nextRegionPolicy } = await AuthApi.getProfileEnvelope();
      if (profile) {
        const userProfile = mapApiProfileToUserProfile(profile);
        setUser(userProfile);
        setRegionPolicy(nextRegionPolicy);
        setIsLoggedIn(true);
        setIsOnline(true);
        setIsSuperAdmin(userProfile.role === "superadmin" || userProfile.email === OWNER_EMAIL);
        UserService.update(userProfile);
        fetchCreditBalance();
        return;
      }
      setStoredToken(null);
      setIsLoggedIn(false);
      setUser(null);
      setRegionPolicy(null);
      setIsOnline(false);
      setIsSuperAdmin(false);
      setCreditBalance(null);
    } catch {
      setIsOnline(false);
      throw new Error("No se pudo refrescar la sesion.");
    }
  }, [fetchCreditBalance]);

  // ─── Refresh credits ────────────────────────────────────────────────
  const refreshCredits = useCallback(async () => {
    await fetchCreditBalance();
  }, [fetchCreditBalance]);

  // ─── Social Login ───────────────────────────────────────────────────
  const socialLogin = useCallback(async (provider: "google" | "instagram", credential?: string) => {
    try {
      if (provider === "google" && credential) {
        const result = await AuthApi.googleSignIn(credential);
        const { profile, regionPolicy: nextRegionPolicy } = await AuthApi.getProfileEnvelope();
        const resolvedProfile = profile ?? result.profile;
        if (resolvedProfile) {
          const userProfile = mapApiProfileToUserProfile(resolvedProfile);
          setUser(userProfile);
          setRegionPolicy(nextRegionPolicy);
          setIsLoggedIn(true);
          setIsOnline(true);
          setIsSuperAdmin(userProfile.role === "superadmin" || userProfile.email === OWNER_EMAIL);
          UserService.update(userProfile);
          fetchCreditBalance();
          trackAnalyticsEvent("sign_up_complete", { tool: "auth", surface: "account", method: "google" });
        }
        return result;
      }
      // Future: handle other providers
      throw new Error(`Provider ${provider} not supported`);
    } catch (e: any) {
      console.log("Social login failed:", e.message);
      throw e;
    }
  }, [fetchCreditBalance]);


  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        user,
        loading,
        isSuperAdmin,
        regionPolicy,
        login,
        register,
        logout,
        upgradeTier,
        refreshUser,
        creditBalance,
        refreshCredits,
        isOnline,
        socialLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
