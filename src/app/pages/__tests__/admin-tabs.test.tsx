/**
 * Admin tab page render tests — ActivityTab, CreditsTab, RegionalStatsTab,
 * FeedbackAdmin, AiStudioAdminTab, CommunityTab.
 * These all depend on AdminApi for their data.
 */
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { I18nProvider } from "../../services/i18n-context";

// ── Shared mocks ──────────────────────────────────────────────────────────
vi.mock("../../services/auth-context", () => ({
  useAuth: () => ({
    isLoggedIn: true,
    user: { id: "u_1", displayName: "Admin", email: "admin@vorea.studio", tier: "STUDIO PRO", username: "@admin", isSuperAdmin: true },
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    socialLogin: vi.fn(),
    upgradeTier: vi.fn(),
    refreshUser: vi.fn(),
    refreshCredits: vi.fn(),
    credits: { balance: 100, monthlyAllocation: 500, monthlyBalance: 500, topupBalance: 0, totalUsed: 0 },
  }),
}));

vi.mock("../../nav", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => ({}),
  useLocation: () => ({ pathname: "/admin", search: "" }),
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

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock("../../services/api-client", () => ({
  AdminApi: {
    getStats: vi.fn(() => Promise.resolve({ users: 0, models: 0, exports: 0 })),
    listUsers: vi.fn(() => Promise.resolve([])),
    getActivity: vi.fn(() => Promise.resolve([])),
    getCreditsOverview: vi.fn(() => Promise.resolve({ total: 0, used: 0, remaining: 0 })),
    getRegionalStats: vi.fn(() => Promise.resolve([])),
    getCommunityStats: vi.fn(() => Promise.resolve({ models: 0, likes: 0, downloads: 0 })),
    listCommunityModels: vi.fn(() => Promise.resolve([])),
    getAIConfig: vi.fn(() => Promise.resolve(null)),
    saveAIConfig: vi.fn(() => Promise.resolve({})),
    getAIBudget: vi.fn(() => Promise.resolve(null)),
    saveAIBudget: vi.fn(() => Promise.resolve({})),
    getAIProviderSnapshot: vi.fn(() => Promise.resolve(null)),
  },
  AiStudioAdminApi: {
    getProviderConfig: vi.fn(() => Promise.resolve(null)),
    saveProviderConfig: vi.fn(() => Promise.resolve({})),
    getBudget: vi.fn(() => Promise.resolve(null)),
    saveBudget: vi.fn(() => Promise.resolve({})),
    getProviderSnapshot: vi.fn(() => Promise.resolve(null)),
  },
  AiStudioCMSApi: {
    getPublicFamilies: vi.fn(() => Promise.resolve([])),
    listFamilies: vi.fn(() => Promise.resolve([])),
    getFamily: vi.fn(() => Promise.resolve(null)),
    createFamily: vi.fn(() => Promise.resolve({})),
    updateFamily: vi.fn(() => Promise.resolve({})),
  },
  FeedbackApi: {
    list: vi.fn(() => Promise.resolve([])),
    submit: vi.fn(() => Promise.resolve({ feedbackId: "fb_1" })),
  },
  TelemetryApi: {
    query: vi.fn(() => Promise.resolve([])),
  },
  CommunityApi: {
    list: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    getPublished: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    adminList: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
  },
  ContentApi: {
    getHero: vi.fn(() => Promise.resolve(null)),
    getHeroBanner: vi.fn(() => Promise.resolve(null)),
  },
  CreditsApi: { get: vi.fn(() => Promise.resolve(0)) },
  GCodeApi: { list: vi.fn(() => Promise.resolve([])) },
  ToolCreditsApi: { getMine: vi.fn(() => Promise.resolve({ balance: 100 })) },
  getStoredToken: vi.fn(() => "jwt-test"),
  setStoredToken: vi.fn(),
}));

vi.mock("../../services/reward-triggers", () => ({
  fireReward: vi.fn(),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(I18nProvider, null, children);
}

// ── Admin Tab Tests ──────────────────────────────────────────────────────

describe("ActivityTab", () => {
  it("renders without crashing", async () => {
    const { ActivityTab } = await import("../ActivityTab");
    const { container } = render(createElement(ActivityTab), { wrapper: Wrapper });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

describe("CreditsTab", () => {
  it("can be imported without errors", async () => {
    const { CreditsTab } = await import("../CreditsTab");
    expect(CreditsTab).toBeDefined();
  });
});

describe("RegionalStatsTab", () => {
  it("can be imported without errors", async () => {
    const { RegionalStatsTab } = await import("../RegionalStatsTab");
    expect(RegionalStatsTab).toBeDefined();
  });
});

describe("FeedbackAdmin", () => {
  it("can be imported without errors", async () => {
    const { FeedbackAdmin } = await import("../FeedbackAdmin");
    expect(FeedbackAdmin).toBeDefined();
  });
});

describe("AiStudioAdminTab", () => {
  it("can be imported without errors", async () => {
    const { AiStudioAdminTab } = await import("../AiStudioAdminTab");
    expect(AiStudioAdminTab).toBeDefined();
  });
});

describe("CommunityTab", () => {
  it("can be imported without errors", async () => {
    const { CommunityTab } = await import("../CommunityTab");
    expect(CommunityTab).toBeDefined();
  });
});
