import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../services/i18n-context";
import { NavProvider } from "../../nav";
import { Membership } from "../Membership";

const authState = vi.hoisted(() => ({
  isLoggedIn: true,
  user: { tier: "FREE" as const, email: "maker@test.local", emailVerifiedAt: null },
  regionPolicy: {
    regionCode: "LATAM" as const,
    recommendedAuthProviders: ["google", "apple"],
    recommendedPaymentProviders: ["paypal", "mercado_pago"],
    phoneVerificationRecommended: true,
    billingAddressRecommended: true,
    requiresStepUpOnPayment: true,
  },
  upgradeTier: vi.fn(),
  refreshUser: vi.fn(),
  refreshCredits: vi.fn(),
}));

const fetchMock = vi.hoisted(() => vi.fn());
const requestEmailVerificationMock = vi.hoisted(() => vi.fn());
const createSubscriptionMock = vi.hoisted(() => vi.fn());

const defaultPlans = vi.hoisted(() => ([
  { tier: "FREE", name: "Free", price: 0, yearlyPrice: 0, highlighted: false },
  { tier: "PRO", name: "Pro", price: 12, yearlyPrice: 99, highlighted: true },
  { tier: "STUDIO PRO", name: "Studio Pro", price: 24, yearlyPrice: 199, highlighted: false },
]));

vi.mock("../../services/auth-context", () => ({
  useAuth: () => authState,
}));

vi.mock("../../services/business-config", () => ({
  DEFAULT_PLANS: defaultPlans,
  getPlans: vi.fn().mockResolvedValue(defaultPlans),
  getLimits: vi.fn().mockResolvedValue(null),
  getActivePromotions: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../services/api-client", () => ({
  AuthApi: {
    requestEmailVerification: requestEmailVerificationMock,
    verifyEmail: vi.fn(),
  },
  PromotionsApi: { validateCoupon: vi.fn() },
  PaypalApi: { createOrder: vi.fn() },
  SubscriptionsApi: { createSubscription: createSubscriptionMock },
}));

vi.mock("../../services/analytics", () => ({
  trackAnalyticsEvent: vi.fn(),
}));

vi.mock("../../components/AuthDialog", () => ({
  AuthDialog: () => null,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

function renderWithProviders(node: ReactNode) {
  return render(
    <I18nProvider>
      <NavProvider>{node}</NavProvider>
    </I18nProvider>
  );
}

describe("membership page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("vorea-locale", "es");
    window.history.replaceState({}, "", "/plans");
    requestEmailVerificationMock.mockResolvedValue({ message: "Código enviado", codeDev: "123456" });
    createSubscriptionMock.mockResolvedValue({ approveUrl: "https://www.paypal.com/checkoutnow?token=abc" });
    fetchMock.mockResolvedValue({
      json: () => Promise.resolve({ creditPacksEnabled: false, creditPacks: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the paused top-up state with localized CTA copy", async () => {
    renderWithProviders(<Membership />);

    expect(
      await screen.findByRole("heading", { name: "La tienda de recargas está pausada" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "El saldo universal sigue activo, pero las recargas puntuales están temporalmente deshabilitadas en este entorno. Por ahora, tu saldo disponible se gestiona desde tu asignación mensual y tu plan activo."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver mi saldo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver planes" })).toBeInTheDocument();
    expect(screen.queryByText(/one-time|top-ups|exports/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/config/business");
  });

  it("requires email verification before starting a paid checkout in step-up regions", async () => {
    renderWithProviders(<Membership />);

    fireEvent.click(await screen.findByRole("button", { name: "Actualizar a Pro" }));

    expect(await screen.findByText("Verifica tu correo para continuar")).toBeInTheDocument();
    expect(requestEmailVerificationMock).toHaveBeenCalledTimes(1);
    expect(createSubscriptionMock).not.toHaveBeenCalled();
    expect(screen.getByText("Latinoamérica")).toBeInTheDocument();
  });
});
