import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireLoggedInInteraction } from "../protected-auth-interactions";

const toastMocks = vi.hoisted(() => ({
  toastFn: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMocks.toastFn,
}));

describe("requireLoggedInInteraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens auth and shows a message for logged out users", () => {
    const onAuthRequired = vi.fn();

    const allowed = requireLoggedInInteraction({
      isLoggedIn: false,
      onAuthRequired,
      authMessage: "Inicia sesión para continuar.",
    });

    expect(allowed).toBe(false);
    expect(onAuthRequired).toHaveBeenCalledTimes(1);
    expect(toastMocks.toastFn).toHaveBeenCalledWith("Inicia sesión para continuar.");
  });

  it("allows the interaction when the user is logged in", () => {
    const onAuthRequired = vi.fn();

    const allowed = requireLoggedInInteraction({
      isLoggedIn: true,
      onAuthRequired,
      authMessage: "Inicia sesión para continuar.",
    });

    expect(allowed).toBe(true);
    expect(onAuthRequired).not.toHaveBeenCalled();
    expect(toastMocks.toastFn).not.toHaveBeenCalled();
  });
});
