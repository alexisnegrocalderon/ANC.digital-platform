import { beforeEach, describe, expect, it } from "vitest";
import {
  decryptPaymentSecret,
  encryptPaymentSecret,
  hasPaymentEncryptionKey,
} from "./paymentSecrets";

const originalKey = process.env.PAYMENTS_ENCRYPTION_KEY;
const testKey = Buffer.alloc(32, 7).toString("base64");

beforeEach(() => {
  process.env.PAYMENTS_ENCRYPTION_KEY = testKey;
});

describe("payment secret encryption", () => {
  it("round trips without storing plaintext", () => {
    const encrypted = encryptPaymentSecret("provider-secret");
    expect(encrypted).not.toContain("provider-secret");
    expect(decryptPaymentSecret(encrypted)).toBe("provider-secret");
  });

  it("requires a 32-byte base64 key", () => {
    process.env.PAYMENTS_ENCRYPTION_KEY = Buffer.alloc(8, 1).toString("base64");
    expect(() => encryptPaymentSecret("secret")).toThrow("32-byte key");
  });

  it("reports whether encryption is configured", () => {
    expect(hasPaymentEncryptionKey()).toBe(true);
    delete process.env.PAYMENTS_ENCRYPTION_KEY;
    expect(hasPaymentEncryptionKey()).toBe(false);
  });
});

if (originalKey === undefined) delete process.env.PAYMENTS_ENCRYPTION_KEY;
else process.env.PAYMENTS_ENCRYPTION_KEY = originalKey;
