/**
 * Community & detail page render tests — Explore, UserPublic, ModelDetail,
 * GCodeCollection.
 */
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { I18nProvider } from "../../services/i18n-context";

// ── Shared mocks ──────────────────────────────────────────────────────────
vi.mock("../../services/auth-context", () => ({
  useAuth: () => ({
    isLoggedIn: false,
    user: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    socialLogin: vi.fn(),
    upgradeTier: vi.fn(),
    refreshUser: vi.fn(),
    refreshCredits: vi.fn(),
    credits: { balance: 0, monthlyAllocation: 0, monthlyBalance: 0, topupBalance: 0, totalUsed: 0 },
  }),
}));

vi.mock("../../nav", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => ({}),
  useLocation: () => ({ pathname: "/explore", search: "" }),
  NavProvider: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

vi.mock("../../services/analytics", () => ({
  trackAnalyticsEvent: vi.fn(),
  trackPageView: vi.fn(),
}));

vi.mock("../../services/telemetry", () => ({
  telemetry: { track: vi.fn() },
  default: { track: vi.fn() },
}));

vi.mock("../../services/telemetry-collector", () => ({
  collectTelemetry: vi.fn(),
}));

vi.mock("../../services/reward-triggers", () => ({
  fireReward: vi.fn(),
}));

vi.mock("../../services/protected-auth-interactions", () => ({
  requireLoggedInInteraction: vi.fn(() => false),
}));

vi.mock("../../services/community-edit-routing", () => ({
  parseCommunityRouteContext: vi.fn(() => null),
  getCommunityPublishMode: vi.fn(() => "create"),
  buildCommunityEditorRoute: vi.fn(() => "/studio"),
}));

vi.mock("../../services/storage", () => ({
  GCodeCollectionService: {
    list: vi.fn(() => []),
    listCloud: vi.fn(() => Promise.resolve([])),
    add: vi.fn(),
    remove: vi.fn(() => true),
    getById: vi.fn(() => null),
  },
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock("../../services/api-client", () => ({
  CommunityApi: {
    list: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    getPublished: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    get: vi.fn(() => Promise.resolve(null)),
    like: vi.fn(() => Promise.resolve({})),
    incrementDownloads: vi.fn(() => Promise.resolve({})),
  },
  ContentApi: {
    getHero: vi.fn(() => Promise.resolve(null)),
    getHeroBanner: vi.fn(() => Promise.resolve(null)),
  },
  GCodeApi: { list: vi.fn(() => Promise.resolve([])) },
  CreditsApi: { get: vi.fn(() => Promise.resolve(0)) },
  RewardsApi: {
    triggerAction: vi.fn(() => Promise.resolve({ success: false })),
  },
  AuthApi: { getGoogleConfig: vi.fn(() => Promise.resolve({ configured: false })) },
  getStoredToken: vi.fn(() => null),
  setStoredToken: vi.fn(),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(I18nProvider, null, children);
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("Explore page", () => {
  it("can be imported without errors", async () => {
    const { Explore } = await import("../Explore");
    expect(Explore).toBeDefined();
  });
});

describe("UserPublic page", () => {
  it("can be imported without errors", async () => {
    const { UserPublic } = await import("../UserPublic");
    expect(UserPublic).toBeDefined();
  });
});

describe("GCodeCollection page", () => {
  it("can be imported without errors", async () => {
    const { GCodeCollection } = await import("../GCodeCollection");
    expect(GCodeCollection).toBeDefined();
  });
});

describe("ModelDetail page", () => {
  it("can be imported without errors", async () => {
    const { ModelDetail } = await import("../ModelDetail");
    expect(ModelDetail).toBeDefined();
  });
});
