// @vitest-environment node

import { describe, expect, it, beforeEach, vi } from "vitest";

describe("crypto", () => {
  const TEST_KEY_HEX =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  beforeEach(() => {
    vi.resetModules();
    process.env.ENCRYPTION_MASTER_KEY = TEST_KEY_HEX;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_MASTER_KEY;
  });

  it("encrypts and decrypts back to the original plaintext", async () => {
    const { encrypt, decrypt } = await import("../crypto.js");
    const secret = "sk-abc123-my-secret-api-key";
    const payload = encrypt(secret);

    expect(payload.encryptedData).toBeDefined();
    expect(payload.iv).toBeDefined();
    expect(payload.authTag).toBeDefined();
    expect(payload.encryptedData).not.toBe(secret);

    const decrypted = decrypt(payload);
    expect(decrypted).toBe(secret);
  });

  it("produces different ciphertexts for the same input (random IV)", async () => {
    const { encrypt } = await import("../crypto.js");
    const a = encrypt("hello");
    const b = encrypt("hello");
    expect(a.encryptedData).not.toBe(b.encryptedData);
    expect(a.iv).not.toBe(b.iv);
  });

  it("throws on decrypt with tampered auth tag", async () => {
    const { encrypt, decrypt } = await import("../crypto.js");
    const payload = encrypt("test-data");
    payload.authTag = "00".repeat(16);
    expect(() => decrypt(payload)).toThrow();
  });

  it("throws when ENCRYPTION_MASTER_KEY is not set", async () => {
    delete process.env.ENCRYPTION_MASTER_KEY;
    const { encrypt } = await import("../crypto.js");
    expect(() => encrypt("hello")).toThrow("ENCRYPTION_MASTER_KEY");
  });

  it("throws when ENCRYPTION_MASTER_KEY is wrong length", async () => {
    process.env.ENCRYPTION_MASTER_KEY = "abcd";
    const { encrypt } = await import("../crypto.js");
    expect(() => encrypt("hello")).toThrow("32 bytes");
  });

  it("masks long keys showing first 4 and last 4 chars", async () => {
    const { maskKey } = await import("../crypto.js");
    const masked = maskKey("sk-abcdefghijklmnop");
    expect(masked.startsWith("sk-a")).toBe(true);
    expect(masked.endsWith("mnop")).toBe(true);
    expect(masked).toContain("•");
  });

  it("fully masks short keys", async () => {
    const { maskKey } = await import("../crypto.js");
    expect(maskKey("short")).toBe("••••••••");
  });

  it("validates known providers", async () => {
    const { isValidProvider, SUPPORTED_PROVIDERS } = await import(
      "../crypto.js"
    );
    expect(SUPPORTED_PROVIDERS).toContain("openai");
    expect(SUPPORTED_PROVIDERS).toContain("tripo");
    expect(isValidProvider("openai")).toBe(true);
    expect(isValidProvider("gemini")).toBe(true);
    expect(isValidProvider("unknown-provider")).toBe(false);
  });
});
