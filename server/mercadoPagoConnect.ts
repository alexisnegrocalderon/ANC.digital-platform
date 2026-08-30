import { parseCookie } from "cookie";
import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { MERCADOPAGO_OAUTH_STATE_COOKIE } from "../shared/const";
import { memberships, paymentProviderAccounts, type PaymentProviderAccount } from "../drizzle/schema";
import { BUSINESS_ADMIN_ROLES, type BusinessRole } from "../shared/auth";
import { decryptPaymentSecret, encryptPaymentSecret } from "./services/paymentSecrets";
import { readJsonResponse, requireHttpUrl } from "../modules/payments/providers";
import { getAuthenticatedUser, isSecureRequest } from "./auth";
import { requireDb } from "./db";

// Kept structurally compatible with modules/payments/service.ts's DatabaseLike (= any).
type DatabaseLike = any;

const AUTHORIZE_URL = "https://auth.mercadopago.com/authorization";
const TOKEN_URL = "https://api.mercadopago.com/oauth/token";
// Refresh a bit before the token actually expires so a checkout in flight never hits an
// expired seller access token.
const REFRESH_SAFETY_MARGIN_MS = 5 * 60 * 1000;

function getEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) throw new Error(`${name} is required to connect Mercado Pago as a marketplace.`);
  return value;
}

function getQueryParam(req: Request, key: string) {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getMercadoPagoStateCookieOptions(req: Request) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? ("none" as const) : ("lax" as const),
    secure,
    maxAge: 10 * 60 * 1000,
  };
}

function getRedirectUri() {
  const publicUrl = requireHttpUrl(process.env.PUBLIC_APP_URL ?? "", "PUBLIC_APP_URL");
  return `${publicUrl.replace(/\/$/, "")}/api/payments/mercadopago/callback`;
}

async function requireBusinessAdmin(db: DatabaseLike, userId: number, businessId: number) {
  const rows = await db
    .select({ roleKey: memberships.roleKey })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.businessId, businessId),
        eq(memberships.status, "active"),
      ),
    )
    .limit(1);
  const role = rows[0]?.roleKey as BusinessRole | undefined;
  return Boolean(role && (BUSINESS_ADMIN_ROLES as readonly BusinessRole[]).includes(role));
}

/**
 * Returns a valid, decrypted MercadoPago access token for a marketplace-OAuth-connected
 * account, refreshing it against MercadoPago first if it is at or near expiry. Persists the
 * refreshed access/refresh tokens (re-encrypted) back onto the account row.
 */
export async function ensureFreshMercadoPagoToken(
  db: DatabaseLike,
  account: Pick<PaymentProviderAccount, "id" | "encryptedAccessToken" | "encryptedRefreshToken" | "tokenExpiresAt">,
): Promise<string> {
  if (!account.encryptedAccessToken) {
    throw new Error("Mercado Pago account has no stored access token.");
  }

  const expiresAtMs = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : null;
  const isExpiringSoon = expiresAtMs === null || expiresAtMs - Date.now() <= REFRESH_SAFETY_MARGIN_MS;
  if (!isExpiringSoon) {
    return decryptPaymentSecret(account.encryptedAccessToken);
  }
  if (!account.encryptedRefreshToken) {
    // Nothing to refresh with; fall back to whatever access token we have.
    return decryptPaymentSecret(account.encryptedAccessToken);
  }

  const clientId = requireEnv("MERCADOPAGO_MARKETPLACE_CLIENT_ID");
  const clientSecret = requireEnv("MERCADOPAGO_MARKETPLACE_CLIENT_SECRET");
  const refreshToken = decryptPaymentSecret(account.encryptedRefreshToken);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const payload = await readJsonResponse(response);
  const newAccessToken = String(payload.access_token ?? "");
  if (!newAccessToken) throw new Error("Mercado Pago did not return a refreshed access token.");
  const newRefreshToken = payload.refresh_token ? String(payload.refresh_token) : refreshToken;
  const expiresInSeconds = Number(payload.expires_in ?? 0);
  const newTokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  await db
    .update(paymentProviderAccounts)
    .set({
      encryptedAccessToken: encryptPaymentSecret(newAccessToken),
      encryptedRefreshToken: encryptPaymentSecret(newRefreshToken),
      tokenExpiresAt: newTokenExpiresAt,
      updatedAt: new Date(),
    })
    .where(eq(paymentProviderAccounts.id, account.id));

  return newAccessToken;
}

export function registerMercadoPagoConnectRoutes(app: Express) {
  app.get("/api/payments/mercadopago/authorize", async (req: Request, res: Response) => {
    const businessId = Number(getQueryParam(req, "businessId"));
    if (!Number.isInteger(businessId) || businessId <= 0) {
      res.status(400).json({ error: "businessId is required" });
      return;
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    const db = requireDb();
    const isAdmin = await requireBusinessAdmin(db, user.id, businessId);
    if (!isAdmin) {
      res.status(403).json({ error: "Business administrator permission required." });
      return;
    }

    let clientId: string;
    let redirectUri: string;
    try {
      clientId = requireEnv("MERCADOPAGO_MARKETPLACE_CLIENT_ID");
      redirectUri = getRedirectUri();
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Mercado Pago is not configured." });
      return;
    }

    const nonce = crypto.randomUUID();
    const state = btoa(JSON.stringify({ businessId, nonce }));
    res.cookie(MERCADOPAGO_OAUTH_STATE_COOKIE, nonce, getMercadoPagoStateCookieOptions(req));

    const url = `${AUTHORIZE_URL}?${new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      platform_id: "mp",
      redirect_uri: redirectUri,
      state,
    })}`;
    res.redirect(302, url);
  });

  app.get("/api/payments/mercadopago/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const fail = (reason: string) => {
      console.error("[MercadoPagoConnect] Callback failed", reason);
      res.redirect(302, "/?mercadopago=error");
    };

    if (!code || !state) {
      fail("missing code or state");
      return;
    }

    let decoded: { businessId?: number; nonce?: string };
    try {
      decoded = JSON.parse(atob(state));
    } catch {
      fail("unparseable state");
      return;
    }

    const expectedNonce = parseCookie(req.headers.cookie ?? "")[MERCADOPAGO_OAUTH_STATE_COOKIE];
    if (!decoded.nonce || decoded.nonce !== expectedNonce) {
      fail("invalid state nonce");
      return;
    }
    res.clearCookie(MERCADOPAGO_OAUTH_STATE_COOKIE, getMercadoPagoStateCookieOptions(req));

    const businessId = Number(decoded.businessId);
    if (!Number.isInteger(businessId) || businessId <= 0) {
      fail("invalid businessId in state");
      return;
    }

    try {
      const clientId = requireEnv("MERCADOPAGO_MARKETPLACE_CLIENT_ID");
      const clientSecret = requireEnv("MERCADOPAGO_MARKETPLACE_CLIENT_SECRET");
      const redirectUri = getRedirectUri();

      const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      });
      const payload = await readJsonResponse(response);
      const accessToken = String(payload.access_token ?? "");
      const refreshToken = String(payload.refresh_token ?? "");
      const sellerUserId = payload.user_id !== undefined ? String(payload.user_id) : null;
      if (!accessToken || !refreshToken || !sellerUserId) {
        throw new Error("Mercado Pago did not return the expected OAuth fields.");
      }
      const expiresInSeconds = Number(payload.expires_in ?? 0);
      const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);
      const publicKey = payload.public_key ? String(payload.public_key) : null;

      const db = requireDb();
      const values = {
        businessId,
        provider: "mercadopago" as const,
        status: "active",
        publicKey,
        encryptedAccessToken: encryptPaymentSecret(accessToken),
        encryptedRefreshToken: encryptPaymentSecret(refreshToken),
        tokenExpiresAt,
        sellerUserId,
        updatedAt: new Date(),
      };
      await db
        .insert(paymentProviderAccounts)
        .values(values)
        .onConflictDoUpdate({
          target: [paymentProviderAccounts.businessId, paymentProviderAccounts.provider],
          set: values,
        });

      res.redirect(302, "/?mercadopago=connected");
    } catch (error) {
      fail(error instanceof Error ? error.message : "unknown error");
    }
  });
}
