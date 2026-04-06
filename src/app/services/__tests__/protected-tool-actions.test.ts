import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumeProtectedToolAction } from "../protected-tool-actions";

const apiMocks = vi.hoisted(() => ({
  consume: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  toastFn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../api-client", () => ({
  ToolActionsApi: apiMocks,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(toastMocks.toastFn, {
    error: toastMocks.error,
  }),
}));

describe("consumeProtectedToolAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens auth without calling the API when the user is logged out", async () => {
    const onAuthRequired = vi.fn();

    const allowed = await consumeProtectedToolAction({
      isLoggedIn: false,
      toolId: "studio",
      actionId: "download_stl",
      onAuthRequired,
      authMessage: "Inicia sesión para exportar.",
    });

    expect(allowed).toBe(false);
    expect(onAuthRequired).toHaveBeenCalledTimes(1);
    expect(apiMocks.consume).not.toHaveBeenCalled();
    expect(toastMocks.toastFn).toHaveBeenCalledWith("Inicia sesión para exportar.");
  });

  it("opens auth when the server reports an expired or missing session", async () => {
    const onAuthRequired = vi.fn();
    apiMocks.consume.mockRejectedValueOnce(new Error("Autenticación requerida"));

    const allowed = await consumeProtectedToolAction({
      isLoggedIn: true,
      toolId: "makerworld",
      actionId: "download_prep",
      onAuthRequired,
      authMessage: "Inicia sesión para continuar.",
    });

    expect(allowed).toBe(false);
    expect(onAuthRequired).toHaveBeenCalledTimes(1);
    expect(toastMocks.toastFn).toHaveBeenCalledWith("Inicia sesión para continuar.");
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it("surfaces plan errors without forcing the auth dialog", async () => {
    const onAuthRequired = vi.fn();
    apiMocks.consume.mockRejectedValueOnce(new Error("Tu plan no incluye esta acción."));

    const allowed = await consumeProtectedToolAction({
      isLoggedIn: true,
      toolId: "studio",
      actionId: "download_obj",
      onAuthRequired,
      authMessage: "Inicia sesión para exportar.",
    });

    expect(allowed).toBe(false);
    expect(onAuthRequired).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledWith("Tu plan no incluye esta acción.");
  });

  it("returns true when the gated action succeeds", async () => {
    const onAuthRequired = vi.fn();
    const onConsumed = vi.fn();
    apiMocks.consume.mockResolvedValueOnce({ success: true });

    const allowed = await consumeProtectedToolAction({
      isLoggedIn: true,
      toolId: "relief",
      actionId: "export_stl",
      onAuthRequired,
      authMessage: "Inicia sesión para exportar.",
      onConsumed,
    });

    expect(allowed).toBe(true);
    expect(apiMocks.consume).toHaveBeenCalledWith("relief", "export_stl");
    expect(onAuthRequired).not.toHaveBeenCalled();
    expect(onConsumed).toHaveBeenCalledTimes(1);
    expect(toastMocks.error).not.toHaveBeenCalled();
  });
});
