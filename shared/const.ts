export const COOKIE_NAME = "anc_session";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const OAUTH_STATE_COOKIE = "__Host-oauth_state";
export const WEBAUTHN_CHALLENGE_COOKIE = "__Host-webauthn_challenge";
export const UNAUTHED_ERR_MSG = "Authentication required.";
export const NOT_ADMIN_ERR_MSG = "Administrative permission required.";

export type OAuthState = {
  redirectUri: string;
  nonce?: string;
};

export function encodeOAuthState(state: OAuthState): string {
  return btoa(JSON.stringify(state));
}

export function decodeOAuthState(state: string): OAuthState {
  let decoded: string;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }

  try {
    const parsed: unknown = JSON.parse(decoded);
    if (
      parsed &&
      typeof parsed === "object" &&
      "redirectUri" in parsed &&
      typeof parsed.redirectUri === "string"
    ) {
      return parsed as OAuthState;
    }
  } catch {
    // Legacy state values may contain only base64-encoded redirect URI.
  }

  return { redirectUri: decoded };
}
