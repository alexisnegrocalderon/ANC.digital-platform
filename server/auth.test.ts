import { afterEach, describe, expect, it } from "vitest";
import {
  createSessionToken,
  getSessionCookieOptions,
  verifySession,
} from "./auth";
import { decodeOAuthState, encodeOAuthState } from "../shared/const";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("auth sessions", () => {
  it("signs and verifies a session with the configured app id", async () => {
    process.env.JWT_SECRET = "test-session-secret";
    process.env.VITE_APP_ID = "anc-test-app";
    process.env.OAUTH_SERVER_URL = "https://oauth.test.invalid";
    const token = await createSessionToken({ authSubject: "oauth-user-1", name: "Test User" });
    await expect(verifySession(token)).resolves.toEqual({ authSubject: "oauth-user-1" });
  });

  it("rejects forged or mismatched sessions", async () => {
    process.env.JWT_SECRET = "test-session-secret";
    process.env.VITE_APP_ID = "anc-test-app";
    process.env.OAUTH_SERVER_URL = "https://oauth.test.invalid";
    await expect(verifySession("not-a-jwt")).resolves.toBeNull();

    process.env.VITE_APP_ID = "different-app";
    const token = await createSessionToken({ authSubject: "oauth-user-1", name: "Test User" });
    process.env.VITE_APP_ID = "anc-test-app";
    await expect(verifySession(token)).resolves.toBeNull();
  });
});

describe("oauth state and cookies", () => {
  it("round-trips a redirect URI and nonce", () => {
    const state = encodeOAuthState({ redirectUri: "https://ancdigital.cl/api/oauth/callback", nonce: "nonce-1" });
    expect(decodeOAuthState(state)).toEqual({
      redirectUri: "https://ancdigital.cl/api/oauth/callback",
      nonce: "nonce-1",
    });
  });

  it("fails closed for malformed state", () => {
    expect(decodeOAuthState("%%%not-base64%%%" )).toEqual({ redirectUri: "" });
  });

  it("uses secure session cookie attributes behind HTTPS", () => {
    const request = { protocol: "https", headers: {} } as never;
    expect(getSessionCookieOptions(request)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });
  });
});
