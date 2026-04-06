export type RegionCode =
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

export interface RegionPolicy {
  regionCode: RegionCode;
  recommendedAuthProviders: string[];
  recommendedPaymentProviders: string[];
  phoneVerificationRecommended: boolean;
  billingAddressRecommended: boolean;
  requiresStepUpOnPayment: boolean;
}

const COUNTRY_REGION_MAP: Record<string, RegionCode> = {
  AR: "LATAM",
  BO: "LATAM",
  BR: "LATAM",
  CL: "LATAM",
  CO: "LATAM",
  CR: "LATAM",
  DO: "LATAM",
  EC: "LATAM",
  GT: "LATAM",
  HN: "LATAM",
  MX: "LATAM",
  NI: "LATAM",
  PA: "LATAM",
  PE: "LATAM",
  PY: "LATAM",
  SV: "LATAM",
  UY: "LATAM",
  VE: "LATAM",
  CA: "NORTH_AMERICA",
  US: "NORTH_AMERICA",
  AT: "EUROPE",
  BE: "EUROPE",
  CH: "EUROPE",
  DE: "EUROPE",
  DK: "EUROPE",
  ES: "EUROPE",
  FI: "EUROPE",
  FR: "EUROPE",
  GB: "EUROPE",
  IE: "EUROPE",
  IT: "EUROPE",
  NL: "EUROPE",
  NO: "EUROPE",
  PL: "EUROPE",
  PT: "EUROPE",
  SE: "EUROPE",
  AU: "APAC",
  CN: "APAC",
  HK: "APAC",
  ID: "APAC",
  IN: "APAC",
  JP: "APAC",
  KR: "APAC",
  MY: "APAC",
  NZ: "APAC",
  PH: "APAC",
  SG: "APAC",
  TH: "APAC",
  TW: "APAC",
  VN: "APAC",
  AE: "AFRICA_MIDDLE_EAST",
  BH: "AFRICA_MIDDLE_EAST",
  EG: "AFRICA_MIDDLE_EAST",
  IL: "AFRICA_MIDDLE_EAST",
  JO: "AFRICA_MIDDLE_EAST",
  KE: "AFRICA_MIDDLE_EAST",
  KW: "AFRICA_MIDDLE_EAST",
  MA: "AFRICA_MIDDLE_EAST",
  NG: "AFRICA_MIDDLE_EAST",
  OM: "AFRICA_MIDDLE_EAST",
  QA: "AFRICA_MIDDLE_EAST",
  SA: "AFRICA_MIDDLE_EAST",
  TR: "AFRICA_MIDDLE_EAST",
  ZA: "AFRICA_MIDDLE_EAST",
};

const REGION_POLICIES: Record<RegionCode, Omit<RegionPolicy, "regionCode">> = {
  LATAM: {
    recommendedAuthProviders: ["google", "apple", "facebook"],
    recommendedPaymentProviders: ["paypal", "stripe", "mercado_pago"],
    phoneVerificationRecommended: true,
    billingAddressRecommended: true,
    requiresStepUpOnPayment: true,
  },
  NORTH_AMERICA: {
    recommendedAuthProviders: ["google", "apple"],
    recommendedPaymentProviders: ["stripe", "paypal"],
    phoneVerificationRecommended: false,
    billingAddressRecommended: true,
    requiresStepUpOnPayment: true,
  },
  EUROPE: {
    recommendedAuthProviders: ["google", "apple"],
    recommendedPaymentProviders: ["stripe", "paypal", "paddle"],
    phoneVerificationRecommended: false,
    billingAddressRecommended: true,
    requiresStepUpOnPayment: true,
  },
  APAC: {
    recommendedAuthProviders: ["google", "apple"],
    recommendedPaymentProviders: ["stripe", "paypal"],
    phoneVerificationRecommended: true,
    billingAddressRecommended: true,
    requiresStepUpOnPayment: true,
  },
  AFRICA_MIDDLE_EAST: {
    recommendedAuthProviders: ["google", "apple"],
    recommendedPaymentProviders: ["paypal", "stripe"],
    phoneVerificationRecommended: true,
    billingAddressRecommended: true,
    requiresStepUpOnPayment: true,
  },
  GLOBAL: {
    recommendedAuthProviders: ["google"],
    recommendedPaymentProviders: ["paypal", "stripe"],
    phoneVerificationRecommended: false,
    billingAddressRecommended: false,
    requiresStepUpOnPayment: false,
  },
};

function sanitizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function normalizeCountryCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

export function normalizeLocaleCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toLowerCase().replace("_", "-");
  const [base] = normalized.split("-");
  return /^[a-z]{2}$/.test(base) ? base : null;
}

export function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return null;
  }
  return `${hasPlus ? "+" : ""}${digits}`;
}

export function sanitizeBillingProfile(input: unknown): BillingProfile | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const billing = input as Record<string, unknown>;
  const sanitized: BillingProfile = {
    fullName: sanitizeText(billing.fullName, 120),
    companyName: sanitizeText(billing.companyName, 120),
    taxId: sanitizeText(billing.taxId, 64),
    addressLine1: sanitizeText(billing.addressLine1, 160),
    addressLine2: sanitizeText(billing.addressLine2, 160),
    city: sanitizeText(billing.city, 96),
    state: sanitizeText(billing.state, 96),
    postalCode: sanitizeText(billing.postalCode, 32),
    countryCode: normalizeCountryCode(billing.countryCode),
  };

  const hasContent = Object.values(sanitized).some(Boolean);
  return hasContent ? sanitized : null;
}

export function resolveRegionCode(countryCode: unknown): RegionCode {
  const normalizedCountry = normalizeCountryCode(countryCode);
  if (!normalizedCountry) return "GLOBAL";
  return COUNTRY_REGION_MAP[normalizedCountry] || "GLOBAL";
}

export function buildRegionPolicy(input: {
  countryCode?: unknown;
  regionCode?: unknown;
}): RegionPolicy {
  const resolvedRegion =
    typeof input.regionCode === "string" && input.regionCode in REGION_POLICIES
      ? (input.regionCode as RegionCode)
      : resolveRegionCode(input.countryCode);

  return {
    regionCode: resolvedRegion,
    ...REGION_POLICIES[resolvedRegion],
  };
}
