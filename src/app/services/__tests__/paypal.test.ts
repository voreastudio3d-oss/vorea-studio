// @ts-nocheck
/**
 * paypal service tests — PayPalService.createOrder, captureOrder logic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../../utils/config/info", () => ({
  apiUrl: "http://localhost:3001",
}));

vi.mock("../api-client", () => ({
  getCachedAccessToken: vi.fn(() => "test-jwt"),
}));

describe("paypal service", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let PayPalService: any;

  beforeEach(async () => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    // Dynamic import to get fresh module
    const mod = await import("../paypal");
    PayPalService = mod.PayPalService;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createOrder sends correct payload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "ORDER-123", status: "CREATED" }),
    });

    const result = await PayPalService.createOrder("pack-50", "50 Credits", 4.99);
    expect(result.id).toBe("ORDER-123");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/paypal/create-order",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ packId: "pack-50", packName: "50 Credits", price: 4.99 }),
      })
    );
  });

  it("captureOrder sends correct payload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "COMPLETED", credits: 50 }),
    });

    const result = await PayPalService.captureOrder("ORDER-123", "pack-50");
    expect(result.status).toBe("COMPLETED");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/paypal/capture-order",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("throws on server error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Orden inválida" }),
    });

    await expect(PayPalService.createOrder("bad", "Bad", 0)).rejects.toThrow("Orden inválida");
  });

  it("includes auth token in headers", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "ORDER-1" }),
    });

    await PayPalService.createOrder("pack-1", "Pack", 1);
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer test-jwt");
  });
});
