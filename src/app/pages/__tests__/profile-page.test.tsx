import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NavProvider } from "../../nav";
import { Profile } from "../Profile";

const authState = vi.hoisted(() => ({
  isLoggedIn: false,
  loading: false,
  user: null as any,
  creditBalance: null as number | null,
  refreshCredits: vi.fn(),
}));

vi.mock("../../services/auth-context", () => ({
  useAuth: () => authState,
}));

vi.mock("../../services/hooks", () => ({
  useUserProfile: () => ({
    user: {
      displayName: "Alex Maker",
      username: "@alex_maker",
      tier: "STUDIO PRO",
    },
    updateUser: vi.fn(),
  }),
}));

vi.mock("../../services/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        "profile.title": "Mi Perfil",
        "profile.notLoggedIn": "Inicia sesión para ver y gestionar tu perfil.",
        "profile.loginButton": "Iniciar sesión",
        "nav.home": "Inicio",
      }[key] ?? key),
  }),
}));

vi.mock("../../services/business-config", () => ({
  getToolCredits: () => Promise.resolve({ monthlyCredits: { FREE: 6, PRO: 200, "STUDIO PRO": 500 } }),
}));

vi.mock("../../services/api-client", () => ({
  RewardsApi: { getMyRewards: vi.fn() },
  CreditsApi: { get: vi.fn() },
  CommunityApi: { listModels: vi.fn(), deleteModel: vi.fn(), updateModel: vi.fn() },
  ActivityApi: { getMyActivity: vi.fn() },
  SubscriptionsApi: { getMySubscription: vi.fn() },
}));

vi.mock("../../services/paypal", () => ({
  PayPalService: { captureOrder: vi.fn() },
}));

vi.mock("../../components/AuthDialog", () => ({
  AuthDialog: ({ open }: { open: boolean }) => (open ? <div>Auth Dialog</div> : null),
}));

vi.mock("../../components/VaultUI", () => ({
  VaultUI: () => <div>Vault UI</div>,
}));

vi.mock("../../components/SubscriptionSuccessModal", () => ({
  SubscriptionSuccessModal: () => null,
}));

function renderWithProviders(node: ReactNode) {
  return render(<NavProvider>{node}</NavProvider>);
}

describe("profile page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isLoggedIn = false;
    authState.loading = false;
    authState.user = null;
    authState.creditBalance = null;
    window.history.replaceState({}, "", "/perfil");
  });

  it("shows a private access gate instead of seeded profile data when logged out", async () => {
    renderWithProviders(<Profile />);

    expect(screen.getByRole("heading", { name: "Mi Perfil" })).toBeInTheDocument();
    expect(screen.getByText("Inicia sesión para ver y gestionar tu perfil.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.queryByText("Alex Maker")).not.toBeInTheDocument();
    expect(screen.queryByText("@alex_maker")).not.toBeInTheDocument();
  });
});
