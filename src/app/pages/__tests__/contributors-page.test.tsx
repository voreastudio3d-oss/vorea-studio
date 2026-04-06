import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../services/i18n-context";
import { Contributors } from "../Contributors";

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  getMine: vi.fn(),
  updateMine: vi.fn(),
}));

vi.mock("../../services/api-client", () => ({
  ContributorsApi: {
    list: (...args: any[]) => apiMocks.list(...args),
  },
  DonationsApi: {
    getMine: (...args: any[]) => apiMocks.getMine(...args),
    updateMine: (...args: any[]) => apiMocks.updateMine(...args),
    createOrder: vi.fn(),
    captureOrder: vi.fn(),
  },
}));

vi.mock("../../services/auth-context", () => ({
  useAuth: () => ({
    isLoggedIn: true,
  }),
}));

vi.mock("../../components/AuthDialog", () => ({
  AuthDialog: () => null,
}));

vi.mock("../../services/analytics", () => ({
  trackAnalyticsEvent: vi.fn(),
}));

describe("contributors page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("vorea-locale", "es");
    apiMocks.updateMine.mockResolvedValue({
      summary: {
        userId: "user_me",
        totalDonatedUsd: 75,
        donationCount: 2,
        tierId: "mecenas",
        badgeId: "contributor_mecenas",
        publicContributor: true,
        lastDonatedAt: "2026-03-23T10:00:00.000Z",
        joinedAt: "2026-03-21T10:00:00.000Z",
        message: "Sigamos iterando.",
      },
    });
  });

  it("renders public contributors and my current contribution tier", async () => {
    apiMocks.list.mockResolvedValue({
      tiers: [
        { id: "impulsor", suggestedAmountUsd: 5, minimumTotalUsd: 5, badgeId: "contributor_impulsor" },
        { id: "mecenas", suggestedAmountUsd: 75, minimumTotalUsd: 75, badgeId: "contributor_mecenas" },
      ],
      contributors: [
        {
          userId: "user_public",
          displayName: "Alicia Maker",
          username: "@alicia",
          avatarUrl: null,
          tierId: "mecenas",
          badgeId: "contributor_mecenas",
          donationCount: 2,
          joinedAt: "2026-03-21T10:00:00.000Z",
          lastDonatedAt: "2026-03-23T10:00:00.000Z",
          message: "Gracias por construir esta herramienta.",
        },
      ],
      stats: { publicContributors: 1 },
    });
    apiMocks.getMine.mockResolvedValue({
      tiers: [],
      donations: [],
      summary: {
        userId: "user_me",
        totalDonatedUsd: 75,
        donationCount: 2,
        tierId: "mecenas",
        badgeId: "contributor_mecenas",
        publicContributor: true,
        lastDonatedAt: "2026-03-23T10:00:00.000Z",
        joinedAt: "2026-03-21T10:00:00.000Z",
        message: "Sigamos iterando.",
      },
    });

    render(
      <I18nProvider>
        <Contributors />
      </I18nProvider>
    );

    expect(await screen.findByText(/Colaboradores que están ayudando a crecer a Vorea/i)).toBeInTheDocument();

    await waitFor(() => expect(apiMocks.list).toHaveBeenCalled());
    await waitFor(() => expect(apiMocks.getMine).toHaveBeenCalled());

    expect(screen.getByText("Alicia Maker")).toBeInTheDocument();
    expect(screen.getByText(/Gracias por construir esta herramienta/i)).toBeInTheDocument();
    expect(screen.getAllByText("Mecenas").length).toBeGreaterThan(0);
    expect(screen.getByText(/Tu nivel de colaborador/i)).toBeInTheDocument();
    expect(screen.getByText(/USD 75.00/i)).toBeInTheDocument();
  });

  it("allows an existing contributor to update current visibility", async () => {
    apiMocks.list.mockResolvedValue({
      tiers: FALLBACK_TIERS_FOR_TEST,
      contributors: [],
      stats: { publicContributors: 0 },
    });
    apiMocks.getMine.mockResolvedValue({
      tiers: [],
      donations: [],
      summary: {
        userId: "user_me",
        totalDonatedUsd: 15,
        donationCount: 1,
        tierId: "aliado",
        badgeId: "contributor_aliado",
        publicContributor: true,
        lastDonatedAt: "2026-03-23T10:00:00.000Z",
        joinedAt: "2026-03-21T10:00:00.000Z",
        message: "Mensaje inicial.",
      },
    });

    render(
      <I18nProvider>
        <Contributors />
      </I18nProvider>
    );

    expect(await screen.findByText(/Tu nivel de colaborador/i)).toBeInTheDocument();
    const checkbox = await screen.findByRole("checkbox");
    fireEvent.click(checkbox);

    const button = screen.getByRole("button", { name: /Actualizar reconocimiento/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    await waitFor(() =>
      expect(apiMocks.updateMine).toHaveBeenCalledWith({
        publicContributor: false,
        message: null,
      })
    );
  });
});

const FALLBACK_TIERS_FOR_TEST = [
  { id: "impulsor", suggestedAmountUsd: 5, minimumTotalUsd: 5, badgeId: "contributor_impulsor" },
  { id: "aliado", suggestedAmountUsd: 15, minimumTotalUsd: 15, badgeId: "contributor_aliado" },
];
