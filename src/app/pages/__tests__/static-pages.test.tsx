/**
 * Static & light page render tests — Privacy, Terms, BenchmarkPage,
 * Landing pages (MakerLanding, AICreatorsLanding, EducationLanding),
 * Leaderboard, Contact.
 *
 * These pages have minimal dependencies and can be rendered with light mocking.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
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
  useLocation: () => ({ pathname: "/", search: "" }),
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

vi.mock("../../services/public-plan-pricing", () => ({
  usePublicPlanPricing: () => ({
    freePlan: { tier: "FREE", name: "Free", price: 0, yearlyPrice: 0, features: [] },
    proPlan: { tier: "PRO", name: "Pro", price: 12, yearlyPrice: 99, features: [] },
    freePriceLabel: "$0",
    proPriceLabel: "$12",
    monthlySuffix: "/mo",
  }),
  formatUsdPlanPrice: (n: number) => `$${n}`,
  getMonthlyPlanSuffix: () => "/mo",
}));

vi.mock("../../services/api-client", () => ({
  RewardsApi: {
    getLeaderboard: vi.fn(() => Promise.resolve({ users: [], period: "monthly" })),
  },
  CommunityApi: {
    list: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    getPublished: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
  },
  ContentApi: {
    getHero: vi.fn(() => Promise.resolve(null)),
    getHeroBanner: vi.fn(() => Promise.resolve(null)),
  },
  AdminApi: {
    getStats: vi.fn(() => Promise.resolve({})),
  },
  CreditsApi: { get: vi.fn(() => Promise.resolve(0)) },
  GCodeApi: { list: vi.fn(() => Promise.resolve([])) },
  FeedbackApi: { submit: vi.fn(() => Promise.resolve({ feedbackId: "fb_1" })) },
  getStoredToken: vi.fn(() => null),
  setStoredToken: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(I18nProvider, null, children);
}

// ── Privacy ──────────────────────────────────────────────────────────────
describe("Privacy page", () => {
  it("renders without crashing", async () => {
    const { Privacy } = await import("../Privacy");
    const { container } = render(createElement(Privacy), { wrapper: Wrapper });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

// ── Terms ────────────────────────────────────────────────────────────────
describe("Terms page", () => {
  it("renders without crashing", async () => {
    const { Terms } = await import("../Terms");
    const { container } = render(createElement(Terms), { wrapper: Wrapper });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

// ── BenchmarkPage ────────────────────────────────────────────────────────
describe("BenchmarkPage", () => {
  it("can be imported without errors", async () => {
    const mod = await import("../BenchmarkPage");
    expect(mod.default).toBeDefined();
  });
});

// ── MakerLanding ─────────────────────────────────────────────────────────
describe("MakerLanding page", () => {
  it("renders without crashing", async () => {
    const { MakerLanding } = await import("../MakerLanding");
    const { container } = render(createElement(MakerLanding), { wrapper: Wrapper });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

// ── AICreatorsLanding ────────────────────────────────────────────────────
describe("AICreatorsLanding page", () => {
  it("renders without crashing", async () => {
    const mod = await import("../AICreatorsLanding");
    const AICLanding = mod.default;
    const { container } = render(createElement(AICLanding), { wrapper: Wrapper });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

// ── EducationLanding ─────────────────────────────────────────────────────
describe("EducationLanding page", () => {
  it("renders without crashing", async () => {
    const mod = await import("../EducationLanding");
    const EducLanding = mod.default;
    const { container } = render(createElement(EducLanding), { wrapper: Wrapper });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

// ── Leaderboard ──────────────────────────────────────────────────────────
describe("Leaderboard page", () => {
  it("renders without crashing", async () => {
    const { Leaderboard } = await import("../Leaderboard");
    const { container } = render(createElement(Leaderboard), { wrapper: Wrapper });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
