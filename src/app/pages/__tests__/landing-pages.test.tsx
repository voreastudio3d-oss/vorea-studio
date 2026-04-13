/**
 * Render tests for landing pages — AICreatorsLanding, EducationLanding, MakerLanding.
 * Uses actual render() to cover JSX lines.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { I18nProvider } from "../../services/i18n-context";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../services/analytics", () => ({
  trackAnalyticsEvent: vi.fn(),
}));

vi.mock("../../services/public-plan-pricing", () => ({
  usePublicPlanPricing: () => ({
    freePriceLabel: "$0",
    proPriceLabel: "$9.99",
    monthlySuffix: "/month",
  }),
}));

vi.mock("../../nav", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/" }),
  Link: ({ children, to, ...rest }: any) => createElement("a", { href: to, ...rest }, children),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(I18nProvider, null, children);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AICreatorsLanding
// ═══════════════════════════════════════════════════════════════════════════════

describe("AICreatorsLanding", () => {
  it("renders without crashing", async () => {
    const { default: AICreatorsLanding } = await import("../AICreatorsLanding");
    const { container } = render(<AICreatorsLanding />, { wrapper: Wrapper });
    expect(container.firstChild).not.toBeNull();
  });

  it("contains hero section", async () => {
    const { default: AICreatorsLanding } = await import("../AICreatorsLanding");
    const { container } = render(<AICreatorsLanding />, { wrapper: Wrapper });
    // Should render h1 heading
    const h1 = container.querySelector("h1");
    expect(h1).not.toBeNull();
  });

  it("renders CTA buttons", async () => {
    const { default: AICreatorsLanding } = await import("../AICreatorsLanding");
    render(<AICreatorsLanding />, { wrapper: Wrapper });
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EducationLanding
// ═══════════════════════════════════════════════════════════════════════════════

describe("EducationLanding", () => {
  it("renders without crashing", async () => {
    const { default: EducationLanding } = await import("../EducationLanding");
    const { container } = render(<EducationLanding />, { wrapper: Wrapper });
    expect(container.firstChild).not.toBeNull();
  });

  it("contains hero section with heading", async () => {
    const { default: EducationLanding } = await import("../EducationLanding");
    const { container } = render(<EducationLanding />, { wrapper: Wrapper });
    const h1 = container.querySelector("h1");
    expect(h1).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MakerLanding
// ═══════════════════════════════════════════════════════════════════════════════

describe("MakerLanding", () => {
  it("renders without crashing", async () => {
    const { MakerLanding } = await import("../MakerLanding");
    const { container } = render(<MakerLanding />, { wrapper: Wrapper });
    expect(container.firstChild).not.toBeNull();
  });

  it("contains heading", async () => {
    const { MakerLanding } = await import("../MakerLanding");
    const { container } = render(<MakerLanding />, { wrapper: Wrapper });
    const headings = container.querySelectorAll("h1, h2");
    expect(headings.length).toBeGreaterThan(0);
  });
});
