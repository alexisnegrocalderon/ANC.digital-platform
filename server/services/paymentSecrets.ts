import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function getEncryptionKey() {
  const raw = process.env.PAYMENTS_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("PAYMENTS_ENCRYPTION_KEY is required to store payment secrets.");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("PAYMENTS_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

export function encryptPaymentSecret(value: string) {
  if (!value) throw new Error("Payment secret cannot be empty.");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptPaymentSecret(payload: string) {
  const [ivEncoded, authTagEncoded, ciphertextEncoded] = payload.split(".");
  if (!ivEncoded || !authTagEncoded || !ciphertextEncoded) {
    throw new Error("Invalid encrypted payment secret format.");
  }

  const iv = Buffer.from(ivEncoded, "base64url");
  const authTag = Buffer.from(authTagEncoded, "base64url");
  const ciphertext = Buffer.from(ciphertextEncoded, "base64url");
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error("Invalid encrypted payment secret components.");
  }

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function hasPaymentEncryptionKey() {
  return Boolean(process.env.PAYMENTS_ENCRYPTION_KEY?.trim());
}
