/**
 * reward-triggers tests — fireReward, fire-and-forget behavior.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTriggerAction = vi.fn();

vi.mock("../api-client", () => ({
  RewardsApi: {
    triggerAction: (...args: any[]) => mockTriggerAction(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

describe("reward-triggers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fireReward calls RewardsApi.triggerAction", async () => {
    mockTriggerAction.mockResolvedValue({ success: true, xpAwarded: 10 });

    const { fireReward } = await import("../reward-triggers");
    fireReward("first_model");

    // Give time for the async void to resolve
    await vi.waitFor(() => {
      expect(mockTriggerAction).toHaveBeenCalledWith("", "first_model");
    });
  });

  it("fireReward does not throw on API error", async () => {
    mockTriggerAction.mockRejectedValue(new Error("Network error"));

    const { fireReward } = await import("../reward-triggers");

    // Should not throw
    expect(() => fireReward("export_stl")).not.toThrow();

    // Wait for async to settle
    await new Promise((r) => setTimeout(r, 50));
  });

  it("fireReward shows toast on XP gain", async () => {
    const { toast } = await import("sonner");
    mockTriggerAction.mockResolvedValue({
      success: true,
      xpAwarded: 25,
      leveledUp: false,
      bonusCredits: 0,
    });

    const { fireReward } = await import("../reward-triggers");
    fireReward("publish_model");

    await vi.waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.stringContaining("+25 XP"),
        expect.any(Object)
      );
    });
  });

  it("fireReward does nothing when success=false", async () => {
    const { toast } = await import("sonner");
    vi.mocked(toast).mockClear();
    mockTriggerAction.mockResolvedValue({ success: false });

    const { fireReward } = await import("../reward-triggers");
    fireReward("daily_login");

    await new Promise((r) => setTimeout(r, 50));
    expect(toast).not.toHaveBeenCalled();
  });
});
