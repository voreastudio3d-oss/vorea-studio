/**
 * TierGate component tests
 * Tests: renders children when user has sufficient tier, shows locked overlay otherwise.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { TierGate } from "../TierGate";

// Mock dependencies
vi.mock("../../services/auth-context", () => ({
  useAuth: vi.fn(() => ({
    isLoggedIn: false,
    user: null,
  })),
}));

vi.mock("../../nav", () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

vi.mock("../AuthDialog", () => ({
  AuthDialog: () => null,
}));

import { useAuth } from "../../services/auth-context";

const mockedUseAuth = vi.mocked(useAuth);
function renderTierGate(
  props: { requiredTier: "FREE" | "PRO" | "STUDIO PRO"; featureName?: string; blur?: boolean },
  children: ReactNode = createElement("div", null, "Content")
) {
  return render(createElement(TierGate, { ...props, children }));
}

describe("TierGate", () => {
  it("renders children when user has sufficient tier", () => {
    mockedUseAuth.mockReturnValue({
      isLoggedIn: true,
      user: { tier: "STUDIO PRO" } as any,
    } as any);

    renderTierGate(
      { requiredTier: "PRO" },
      createElement("div", { "data-testid": "content" }, "Premium Content")
    );

    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders children when user tier equals required tier", () => {
    mockedUseAuth.mockReturnValue({
      isLoggedIn: true,
      user: { tier: "PRO" } as any,
    } as any);

    renderTierGate(
      { requiredTier: "PRO" },
      createElement("span", null, "Exact Match")
    );

    expect(screen.getByText("Exact Match")).toBeInTheDocument();
  });

  it("shows locked overlay when user tier is insufficient", () => {
    mockedUseAuth.mockReturnValue({
      isLoggedIn: true,
      user: { tier: "FREE" } as any,
    } as any);

    renderTierGate(
      { requiredTier: "PRO", featureName: "AI Studio" },
      createElement("div", null, "Hidden Content")
    );

    expect(screen.getByText(/AI Studio requiere PRO/)).toBeInTheDocument();
    expect(screen.getByText(/Actualiza tu plan/)).toBeInTheDocument();
  });

  it("shows login CTA when user is not logged in", () => {
    mockedUseAuth.mockReturnValue({
      isLoggedIn: false,
      user: null,
    } as any);

    renderTierGate({ requiredTier: "PRO" });

    expect(screen.getByText(/Ingresar/)).toBeInTheDocument();
    expect(screen.getByText(/Inicia sesion/)).toBeInTheDocument();
  });

  it("shows upgrade CTA when logged in with lower tier", () => {
    mockedUseAuth.mockReturnValue({
      isLoggedIn: true,
      user: { tier: "FREE" } as any,
    } as any);

    renderTierGate({ requiredTier: "STUDIO PRO" });

    expect(screen.getByText(/Ver Planes/)).toBeInTheDocument();
  });

  it("renders blurred content by default", () => {
    mockedUseAuth.mockReturnValue({
      isLoggedIn: false,
      user: null,
    } as any);

    const { container } = renderTierGate(
      { requiredTier: "PRO" },
      createElement("div", null, "Blurred")
    );

    const blurredEl = container.querySelector(".blur-sm");
    expect(blurredEl).not.toBeNull();
  });

  it("hides content completely when blur=false", () => {
    mockedUseAuth.mockReturnValue({
      isLoggedIn: false,
      user: null,
    } as any);

    const { container } = renderTierGate(
      { requiredTier: "PRO", blur: false },
      createElement("div", { "data-testid": "hidden" }, "No Blur")
    );

    const blurredEl = container.querySelector(".blur-sm");
    expect(blurredEl).toBeNull();
  });

  it("uses generic message when featureName not provided", () => {
    mockedUseAuth.mockReturnValue({
      isLoggedIn: true,
      user: { tier: "FREE" } as any,
    } as any);

    renderTierGate({ requiredTier: "PRO" });

    expect(screen.getByText(/Requiere plan PRO/)).toBeInTheDocument();
  });
});
