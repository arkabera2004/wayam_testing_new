import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for the GitHub token at rest. GCM (not CBC) so a tampered
 * ciphertext fails to decrypt rather than silently yielding garbage.
 *
 * The key comes from TOKEN_ENCRYPTION_KEY. It is hashed to 32 bytes so any
 * passphrase length works, and read lazily so a missing key breaks only the
 * integration rather than every build.
 */
function key() {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set, so GitHub tokens cannot be stored securely.",
    );
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  // iv:tag:ciphertext — self-describing, so no separate columns are needed.
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(":");
}

export function decryptToken(stored: string): string {
  const [iv, tag, body] = stored.split(":");
  if (!iv || !tag || !body) throw new Error("Stored token is malformed.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
}

/** Never render a raw token. Shows enough to recognise which one is stored. */
export function maskToken(plain: string): string {
  return plain.length <= 8 ? "•".repeat(plain.length) : `${plain.slice(0, 4)}${"•".repeat(8)}${plain.slice(-4)}`;
}
