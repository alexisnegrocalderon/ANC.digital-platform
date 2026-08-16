import { exportPKCS8, exportSPKI, generateKeyPair, SignJWT } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { ControlPlaneAuthError, requireControlPlaneScope, verifyControlPlaneRequest } from "./controlPlaneAuth";

function requestWithToken(token: string) {
  return {
    header(name: string) {
      return name.toLowerCase() === "authorization" ? `Bearer ${token}` : undefined;
    },
  } as never;
}

describe("control plane Ed25519 JWT", () => {
  beforeEach(async () => {
    const { publicKey, privateKey } = await generateKeyPair("EdDSA", { extractable: true });
    process.env.CONTROL_PLANE_PUBLIC_KEY = await exportSPKI(publicKey);
    process.env.CONTROL_PLANE_PRIVATE_TEST_KEY = await exportPKCS8(privateKey);
    process.env.CONTROL_PLANE_ISSUER = "anc-official-admin";
    process.env.CONTROL_PLANE_AUDIENCE = "anc-platform-core";
    process.env.CONTROL_PLANE_ENVIRONMENT = "production";
  });

  it("accepts a valid signed assertion and required claims", async () => {
    const token = await new SignJWT({ scope: ["platform.modules.read"], environment: "production", client_id: "anc-official-admin" })
      .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
      .setIssuer("anc-official-admin")
      .setSubject("anc-control-plane-client")
      .setAudience("anc-platform-core")
      .setIssuedAt()
      .setExpirationTime("5m")
      .setJti("test-jti")
      .sign(await (await import("jose")).importPKCS8(process.env.CONTROL_PLANE_PRIVATE_TEST_KEY!, "EdDSA"));

    const claims = await verifyControlPlaneRequest(requestWithToken(token));
    expect(claims.client_id).toBe("anc-official-admin");
    expect(() => requireControlPlaneScope(claims, "platform.modules.read")).not.toThrow();
  });

  it("rejects a token without the requested scope", async () => {
    const token = await new SignJWT({ scope: ["platform.modules.read"], environment: "production" })
      .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
      .setIssuer("anc-official-admin")
      .setSubject("anc-control-plane-client")
      .setAudience("anc-platform-core")
      .setIssuedAt()
      .setExpirationTime("5m")
      .setJti("test-jti-scope")
      .sign(await (await import("jose")).importPKCS8(process.env.CONTROL_PLANE_PRIVATE_TEST_KEY!, "EdDSA"));

    const claims = await verifyControlPlaneRequest(requestWithToken(token));
    expect(() => requireControlPlaneScope(claims, "platform.modules.write")).toThrowError(ControlPlaneAuthError);
  });
});
