/**
 * AI Quick Fix tests — prompt building, Gemini call, cooldown.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateQuickFixWithGemini } from "../ai-quick-fix";

describe("ai-quick-fix", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    process.env.GEMINI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GEMINI_API_KEY;
  });

  it("returns null when GEMINI_API_KEY is not set", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await generateQuickFixWithGemini("cube();", "syntax error");
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends request to Gemini API with correct payload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: "cube([10,10,10]);" }] } }],
        }),
    });

    const result = await generateQuickFixWithGemini(
      "cueb([10,10,10]);",
      "Unknown module 'cueb'"
    );
    expect(result).toBe("cube([10,10,10]);");
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].text).toContain("cueb");
    expect(body.contents[0].parts[0].text).toContain("Unknown module");
  });

  it("returns null on HTTP error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    const result = await generateQuickFixWithGemini("bad();", "error");
    expect(result).toBeNull();
  });

  it("strips markdown code blocks from response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: "```openscad\ncube([5,5,5]);\n```" }] } }],
        }),
    });

    const result = await generateQuickFixWithGemini("source", "error");
    expect(result).toBe("cube([5,5,5]);");
  });

  it("returns null when response has no text", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ candidates: [{ content: { parts: [] } }] }),
    });

    const result = await generateQuickFixWithGemini("source", "error");
    expect(result).toBeNull();
  });

  it("handles fetch exceptions gracefully", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));
    const result = await generateQuickFixWithGemini("src", "err");
    expect(result).toBeNull();
  });
});
