import express from "express";
import type { Request, Response } from "express";
import type { RouteTarget } from "./routeTarget";
import { parseCookie } from "cookie";
import { eq } from "drizzle-orm";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticatorTransportFuture,
  WebAuthnCredential,
} from "@simplewebauthn/server";
import { COOKIE_NAME, ONE_YEAR_MS, WEBAUTHN_CHALLENGE_COOKIE } from "../shared/const";
import { users, webauthnCredentials } from "../drizzle/schema";
import { requireDb } from "./db";
import { createSessionToken, getAuthenticatedUser, getSessionCookieOptions } from "./auth";

function getChallengeCookie(req: Request): string | undefined {
  return parseCookie(req.headers.cookie ?? "")[WEBAUTHN_CHALLENGE_COOKIE];
}

function getRelyingParty() {
  const raw = process.env.PUBLIC_APP_URL?.trim();
  if (!raw) throw new Error("PUBLIC_APP_URL is required for WebAuthn.");
  const url = new URL(raw);
  // Accept both the apex and "www." host: Vercel/DNS may redirect one to the other (e.g.
  // ancdigital.cl -> www.ancdigital.cl), so the browser's actual origin during the WebAuthn
  // ceremony can differ from whichever variant PUBLIC_APP_URL happens to be set to.
  const bareHost = url.hostname.replace(/^www\./, "");
  return {
    rpID: bareHost,
    rpName: "ANC Platform",
    expectedOrigin: [`${url.protocol}//${bareHost}`, `${url.protocol}//www.${bareHost}`],
  };
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const values = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto?.split(",") ?? [];
  return values.some((value) => value.trim().toLowerCase() === "https");
}

function getChallengeCookieOptions(req: Request) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? ("none" as const) : ("lax" as const),
    secure,
    maxAge: 5 * 60 * 1000,
  };
}

function encodePublicKey(publicKey: Uint8Array): string {
  return Buffer.from(publicKey).toString("base64url");
}

function decodePublicKey(publicKey: string): Uint8Array<ArrayBuffer> {
  const buffer = Buffer.from(publicKey, "base64url");
  const copy = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(copy).set(buffer);
  return new Uint8Array(copy);
}

const jsonBody = express.json({ limit: "1mb" });

export function registerWebauthnRoutes(app: RouteTarget) {
  app.post("/api/webauthn/register/options", jsonBody, async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    try {
      const { rpID, rpName } = getRelyingParty();
      const db = requireDb();
      const existing = await db
        .select()
        .from(webauthnCredentials)
        .where(eq(webauthnCredentials.userId, user.id));

      const options = await generateRegistrationOptions({
        rpID,
        rpName,
        userID: new TextEncoder().encode(String(user.id)),
        userName: user.email ?? user.name ?? `user-${user.id}`,
        userDisplayName: user.name ?? user.email ?? `Usuario ${user.id}`,
        attestationType: "none",
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "preferred",
          userVerification: "required",
        },
        excludeCredentials: existing.map((credential) => ({
          id: credential.credentialId,
          transports: (credential.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
        })),
      });

      res.cookie(WEBAUTHN_CHALLENGE_COOKIE, options.challenge, getChallengeCookieOptions(req));
      res.json(options);
    } catch (error) {
      console.error("[WebAuthn] register/options failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "Could not start passkey registration." });
    }
  });

  app.post("/api/webauthn/register/verify", jsonBody, async (req: Request, res: Response) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    const expectedChallenge = getChallengeCookie(req);
    if (!expectedChallenge) {
      res.status(400).json({ error: "No pending passkey registration challenge." });
      return;
    }
    res.clearCookie(WEBAUTHN_CHALLENGE_COOKIE, getChallengeCookieOptions(req));

    try {
      const { rpID, expectedOrigin } = getRelyingParty();
      const verification = await verifyRegistrationResponse({
        response: req.body,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });

      if (!verification.verified || !verification.registrationInfo) {
        res.status(400).json({ error: "Passkey registration could not be verified." });
        return;
      }

      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      const db = requireDb();
      await db.insert(webauthnCredentials).values({
        userId: user.id,
        credentialId: credential.id,
        publicKey: encodePublicKey(credential.publicKey),
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports ?? [],
      });

      res.json({ ok: true });
    } catch (error) {
      console.error("[WebAuthn] register/verify failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "Could not verify passkey registration." });
    }
  });

  app.post("/api/webauthn/login/options", jsonBody, async (req: Request, res: Response) => {
    try {
      const { rpID } = getRelyingParty();
      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: "required",
        allowCredentials: [],
      });
      res.cookie(WEBAUTHN_CHALLENGE_COOKIE, options.challenge, getChallengeCookieOptions(req));
      res.json(options);
    } catch (error) {
      console.error("[WebAuthn] login/options failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "Could not start passkey login." });
    }
  });

  app.post("/api/webauthn/login/verify", jsonBody, async (req: Request, res: Response) => {
    const expectedChallenge = getChallengeCookie(req);
    if (!expectedChallenge) {
      res.status(400).json({ error: "No pending passkey login challenge." });
      return;
    }
    res.clearCookie(WEBAUTHN_CHALLENGE_COOKIE, getChallengeCookieOptions(req));

    const credentialId: unknown = req.body?.id;
    if (typeof credentialId !== "string" || !credentialId) {
      res.status(400).json({ error: "Invalid passkey response." });
      return;
    }

    try {
      const db = requireDb();
      const rows = await db
        .select()
        .from(webauthnCredentials)
        .where(eq(webauthnCredentials.credentialId, credentialId))
        .limit(1);
      const stored = rows[0];
      if (!stored) {
        res.status(400).json({ error: "Passkey is not registered." });
        return;
      }

      const { rpID, expectedOrigin } = getRelyingParty();
      const webAuthnCredential: WebAuthnCredential = {
        id: stored.credentialId,
        publicKey: decodePublicKey(stored.publicKey),
        counter: stored.counter,
        transports: (stored.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
      };

      const verification = await verifyAuthenticationResponse({
        response: req.body,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
        credential: webAuthnCredential,
        requireUserVerification: true,
      });

      if (!verification.verified) {
        res.status(400).json({ error: "Passkey login could not be verified." });
        return;
      }

      await db
        .update(webauthnCredentials)
        .set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() })
        .where(eq(webauthnCredentials.id, stored.id));

      const [userRow] = await db.select().from(users).where(eq(users.id, stored.userId)).limit(1);
      if (!userRow) {
        res.status(500).json({ error: "Passkey user could not be found." });
        return;
      }

      const sessionToken = await createSessionToken({
        authSubject: userRow.authSubject,
        name: userRow.name,
      });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.json({ ok: true });
    } catch (error) {
      console.error("[WebAuthn] login/verify failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "Could not verify passkey login." });
    }
  });
}
