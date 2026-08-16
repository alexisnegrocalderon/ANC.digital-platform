import { parseCookie } from "cookie";
import { jwtVerify, SignJWT } from "jose";
import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { decodeOAuthState, COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE } from "../shared/const";
import { users } from "../drizzle/schema";
import { getDb, requireDb } from "./db";

const EXCHANGE_TOKEN_PATH = "/webdev.v1.WebDevAuthPublicService/ExchangeToken";
const GET_USER_INFO_PATH = "/webdev.v1.WebDevAuthPublicService/GetUserInfo";

type OAuthTokenResponse = {
  accessToken: string;
};

type OAuthUserInfo = {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  platform?: string | null;
};

export type AuthenticatedUser = {
  id: number;
  authSubject: string;
  email: string | null;
  name: string | null;
  platformRole: "user" | "platform_admin";
};

function getEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function getJwtSecret() {
  const configured = getEnv("JWT_SECRET");
  if (configured) return new TextEncoder().encode(configured);
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required for production sessions.");
  }
  return new TextEncoder().encode("anc-platform-development-session-secret");
}

function getOAuthConfig() {
  const appId = getEnv("VITE_APP_ID");
  const serverUrl = getEnv("OAUTH_SERVER_URL");
  if (!appId || !serverUrl) {
    throw new Error("VITE_APP_ID and OAUTH_SERVER_URL are required for Manus OAuth.");
  }
  return { appId, serverUrl: serverUrl.replace(/\/$/, "") };
}

function getQueryParam(req: Request, key: string) {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const values = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto?.split(",") ?? [];
  return values.some((value) => value.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(req: Request) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none" as const,
    secure: isSecureRequest(req),
  };
}

function getOAuthStateCookieOptions(req: Request) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? ("none" as const) : ("lax" as const),
    secure,
    maxAge: 10 * 60 * 1000,
  };
}

export async function exchangeCodeForToken(code: string, state: string): Promise<OAuthTokenResponse> {
  const { appId, serverUrl } = getOAuthConfig();
  const { redirectUri } = decodeOAuthState(state);
  if (!redirectUri) throw new Error("OAuth state has no redirect URI.");

  const response = await fetch(`${serverUrl}${EXCHANGE_TOKEN_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clientId: appId,
      grantType: "authorization_code",
      code,
      redirectUri,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`OAuth token exchange failed with ${response.status}.`);
  return (await response.json()) as OAuthTokenResponse;
}

export async function getOAuthUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  const { serverUrl } = getOAuthConfig();
  const response = await fetch(`${serverUrl}${GET_USER_INFO_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessToken }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`OAuth user info failed with ${response.status}.`);
  return (await response.json()) as OAuthUserInfo;
}

export async function upsertOAuthUser(userInfo: OAuthUserInfo) {
  if (!userInfo.openId) throw new Error("OAuth user info has no openId.");
  const db = requireDb();
  const row = {
    authSubject: userInfo.openId,
    name: userInfo.name?.trim() || null,
    email: userInfo.email?.trim() || null,
    lastSignedInAt: new Date(),
  };
  const result = await db
    .insert(users)
    .values(row)
    .onConflictDoUpdate({
      target: users.authSubject,
      set: {
        name: row.name,
        email: row.email,
        lastSignedInAt: row.lastSignedInAt,
        updatedAt: new Date(),
      },
    })
    .returning();
  return result[0];
}

export async function createSessionToken(user: Pick<AuthenticatedUser, "authSubject" | "name">) {
  const { appId } = getOAuthConfig();
  return new SignJWT({
    authSubject: user.authSubject,
    appId,
    name: user.name ?? "",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
    .sign(getJwtSecret());
}

export async function verifySession(cookieValue: string | undefined | null) {
  if (!cookieValue) return null;
  try {
    const { payload } = await jwtVerify(cookieValue, getJwtSecret(), { algorithms: ["HS256"] });
    const authSubject = payload.authSubject;
    const appId = payload.appId;
    if (typeof authSubject !== "string" || typeof appId !== "string") return null;
    if (appId !== getEnv("VITE_APP_ID")) return null;
    return { authSubject };
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  const cookies = parseCookie(req.headers.cookie ?? "");
  const session = await verifySession(cookies[COOKIE_NAME]);
  if (!session) return null;
  const db = getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.authSubject, session.authSubject)).limit(1);
  const user = result[0];
  if (!user) return null;
  await db.update(users).set({ lastSignedInAt: new Date() }).where(eq(users.id, user.id));
  return {
    id: user.id,
    authSubject: user.authSubject,
    email: user.email,
    name: user.name,
    platformRole: user.platformRole === "platform_admin" ? "platform_admin" : "user",
  };
}

export function registerAuthRoutes(app: Express) {
  app.get("/api/auth/login", (req: Request, res: Response) => {
    const origin = getQueryParam(req, "origin");
    if (!origin) {
      res.status(400).json({ error: "origin is required" });
      return;
    }
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      res.status(400).json({ error: "origin must be a valid URL" });
      return;
    }
    const local = parsedOrigin.hostname === "localhost" || parsedOrigin.hostname === "127.0.0.1";
    if (!local && parsedOrigin.protocol !== "https:") {
      res.status(400).json({ error: "origin must use HTTPS outside localhost" });
      return;
    }
    const { url, nonce } = getLoginUrl(parsedOrigin.origin);
    res.cookie(OAUTH_STATE_COOKIE, nonce, getOAuthStateCookieOptions(req));
    res.redirect(302, url);
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookie(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, getOAuthStateCookieOptions(req));

    try {
      const token = await exchangeCodeForToken(code, state);
      const userInfo = await getOAuthUserInfo(token.accessToken);
      const user = await upsertOAuthUser(userInfo);
      const sessionToken = await createSessionToken({
        authSubject: user.authSubject,
        name: user.name,
      });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

export function getLoginUrl(origin: string) {
  const appId = getEnv("VITE_APP_ID");
  const portalUrl = getEnv("VITE_OAUTH_PORTAL_URL");
  if (!appId || !portalUrl) throw new Error("VITE_APP_ID and VITE_OAUTH_PORTAL_URL are required for login.");
  const redirectUri = `${origin.replace(/\/$/, "")}/api/oauth/callback`;
  const nonce = crypto.randomUUID();
  const state = btoa(JSON.stringify({ redirectUri, nonce }));
  return { url: `${portalUrl.replace(/\/$/, "")}/login?${new URLSearchParams({ app_id: appId, redirect_url: redirectUri, state })}`, nonce };
}
