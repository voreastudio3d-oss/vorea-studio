/**
 * Core data types for the Vorea Studio mock persistence layer.
 * Designed to map 1:1 to a future MongoDB schema.
 */

// ─── User ─────────────────────────────────────────────────────────────────────

export type MembershipTier = "FREE" | "PRO" | "STUDIO PRO";
export type UserRole = "user" | "admin" | "superadmin";
export type UserRegionCode =
  | "LATAM"
  | "NORTH_AMERICA"
  | "EUROPE"
  | "APAC"
  | "AFRICA_MIDDLE_EAST"
  | "GLOBAL";

export interface BillingProfile {
  fullName?: string | null;
  companyName?: string | null;
  taxId?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
}

export interface RegionPolicySummary {
  regionCode: UserRegionCode;
  recommendedAuthProviders: string[];
  recommendedPaymentProviders: string[];
  phoneVerificationRecommended: boolean;
  billingAddressRecommended: boolean;
  requiresStepUpOnPayment: boolean;
}

export interface UserProfile {
  id: string;
  displayName: string;
  username: string; // e.g. "@alex_maker"
  email: string;
  tier: MembershipTier;
  role?: UserRole;
  avatarUrl?: string;
  bio?: string | null;
  website?: string | null;
  phone?: string | null;
  countryCode?: string | null;
  regionCode?: UserRegionCode | null;
  defaultLocale?: string | null;
  billingProfile?: BillingProfile | null;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  createdAt: string; // ISO
  banned?: boolean;
  lastLoginAt?: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthState {
  isLoggedIn: boolean;
  user: UserProfile | null;
}

// ─── Membership Plans ─────────────────────────────────────────────────────────

export interface MembershipPlan {
  tier: MembershipTier;
  name: string;
  price: number; // USD/month, 0 = free
  yearlyPrice: number; // USD/year
  features: string[];
  highlighted?: boolean;
}

// ─── Model / Project ──────────────────────────────────────────────────────────

export type ModelStatus = "Draft" | "Published";

export interface SceneParams {
  radius: number;
  height: number;
  resolution: number;
}

export interface ModelProject {
  id: string;
  title: string;
  status: ModelStatus;
  params: SceneParams;
  wireframe: boolean;
  likes: number;
  downloads: number;
  thumbnailUrl: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

// ─── GCode Export Credits ─────────────────────────────────────────────────────

export interface GCodeExportCredits {
  freeUsed: number;          // How many of the 6 free exports have been used
  purchasedCredits: number;  // Remaining purchased credits
  totalExported: number;     // Lifetime export count
  lastExportAt?: string;     // ISO
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: number;         // USD
  pricePerCredit: number; // computed
  popular?: boolean;
}

// ─── Universal Credit System ──────────────────────────────────────────────────

export interface ToolAction {
  actionId: string;
  labelKey: string;
  creditCost: number;
  limits: { free: number | null; pro: number | null; studioPro: number | null };
  limitPeriod: string;
}

export interface ToolConfig {
  label: string;
  actions: ToolAction[];
}

export interface ToolCreditConfig {
  creditValueUsd: number;
  monthlyCredits: Record<string, number>;
  tools: Record<string, ToolConfig>;
}

export interface UserCredits {
  balance: number;          // Current credit balance
  monthlyAllocation: number;// Credits allocated per month for the user's tier
  monthlyBalance?: number;  // Remaining monthly credits before consuming top-up
  topupBalance?: number;    // One-time purchased credits that survive monthly reset
  totalUsed: number;        // Lifetime credits consumed
  lastResetAt?: string;     // ISO date of last monthly reset
}
