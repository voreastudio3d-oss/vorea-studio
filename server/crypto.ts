/**
 * Crypto utility for BYOK (Bring Your Own Key) vault.
 * Uses AES-256-GCM authenticated encryption to store third-party API keys.
 *
 * Security:
 * - MASTER_KEY stored as env var ENCRYPTION_MASTER_KEY (32 bytes hex)
 * - Random 16-byte IV per encryption operation
 * - GCM auth tag ensures integrity on decryption
 * - Decrypted keys are NEVER logged
 */

import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getMasterKey(): Buffer {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_MASTER_KEY env var is required for BYOK vault. " +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_MASTER_KEY must be exactly 32 bytes (64 hex chars)");
  }
  return buf;
}

export interface EncryptedPayload {
  encryptedData: string; // base64
  iv: string;            // hex
  authTag: string;       // hex
}

/**
 * Encrypt a plaintext string (e.g. an API key) using AES-256-GCM.
 */
export function encrypt(plainText: string): EncryptedPayload {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted.toString("base64"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypt an encrypted payload back to plaintext.
 * Throws if the auth tag doesn't match (tampered data).
 */
export function decrypt(payload: EncryptedPayload): string {
  const masterKey = getMasterKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    masterKey,
    Buffer.from(payload.iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.encryptedData, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Mask an API key for display (e.g. "sk-abc...xyz").
 */
export function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}${"•".repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`;
}

/** Supported AI providers for BYOK */
export const SUPPORTED_PROVIDERS = [
  "tripo",    // Tripo AI – text/image to 3D
  "meshy",    // Meshy AI – text/image to 3D
  "hitem3d",  // Hitem3D – text to 3D
  "openai",   // OpenAI – GPT models
  "gemini",   // Google Gemini
] as const;

export type AIProvider = typeof SUPPORTED_PROVIDERS[number];

export function isValidProvider(provider: string): provider is AIProvider {
  return SUPPORTED_PROVIDERS.includes(provider as AIProvider);
}
