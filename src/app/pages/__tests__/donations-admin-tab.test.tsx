import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DonationsAdminTab } from "../DonationsAdminTab";

const adminMocks = vi.hoisted(() => ({
  listDonations: vi.fn(),
  updateContributorVisibility: vi.fn(),
}));

vi.mock("../../services/api-client", () => ({
  AdminApi: {
    listDonations: (...args: any[]) => adminMocks.listDonations(...args),
    updateContributorVisibility: (...args: any[]) => adminMocks.updateContributorVisibility(...args),
  },
}));

describe("donations admin tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMocks.listDonations.mockResolvedValue({
      stats: {
        totalOrders: 1,
        completedOrders: 1,
        failedOrders: 0,
        publicContributors: 1,
        uniqueContributors: 1,
        totalCapturedUsd: 75,
      },
      donations: [
        {
          orderId: "DON_ORDER_9",
          donationId: "don_9",
          userId: "user_1",
          displayName: "Martín",
          username: "@martin",
          avatarUrl: null,
          tierId: "mecenas",
          awardedTierId: "mecenas",
          badgeId: "contributor_mecenas",
          amountUsd: 75,
          currency: "USD",
          status: "COMPLETED",
          visibility: "public",
          publicContributor: true,
          currentMessage: "Mensaje admin.",
          createdAt: "2026-03-23T10:00:00.000Z",
          completedAt: "2026-03-23T10:05:00.000Z",
          lastDonatedAt: "2026-03-23T10:05:00.000Z",
          captureId: "CAP_9",
        },
      ],
      contributors: [
        {
          userId: "user_1",
          displayName: "Martín",
          username: "@martin",
          avatarUrl: null,
          totalDonatedUsd: 75,
          donationCount: 1,
          tierId: "mecenas",
          badgeId: "contributor_mecenas",
          publicContributor: true,
          lastDonatedAt: "2026-03-23T10:05:00.000Z",
          joinedAt: "2026-03-23T10:05:00.000Z",
          message: "Mensaje admin.",
        },
      ],
    });
    adminMocks.updateContributorVisibility.mockResolvedValue({
      userId: "user_1",
      displayName: "Martín",
      username: "@martin",
      avatarUrl: null,
      totalDonatedUsd: 75,
      donationCount: 1,
      tierId: "mecenas",
      badgeId: "contributor_mecenas",
      publicContributor: false,
      lastDonatedAt: "2026-03-23T10:05:00.000Z",
      joinedAt: "2026-03-23T10:05:00.000Z",
      message: null,
    });
  });

  it("renders stats and recent donations", async () => {
    render(<DonationsAdminTab />);

    expect(await screen.findByText("Órdenes")).toBeInTheDocument();
    expect(screen.getAllByText("Martín").length).toBeGreaterThan(0);
    expect(screen.getByText(/DON_ORDER_9/i)).toBeInTheDocument();
    expect(screen.getAllByText(/USD 75.00/i).length).toBeGreaterThan(0);
  });

  it("saves contributor visibility changes", async () => {
    render(<DonationsAdminTab />);

    const checkbox = await screen.findByRole("checkbox");
    fireEvent.click(checkbox);

    const button = screen.getByRole("button", { name: /Guardar visibilidad/i });
    fireEvent.click(button);

    await waitFor(() =>
      expect(adminMocks.updateContributorVisibility).toHaveBeenCalledWith("user_1", {
        publicContributor: false,
        message: null,
      })
    );
  });
});
