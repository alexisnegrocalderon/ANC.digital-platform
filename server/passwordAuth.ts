import bcrypt from "bcryptjs";
import express from "express";
import type { Request, Response } from "express";
import type { RouteTarget } from "./routeTarget";
import { eq } from "drizzle-orm";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { users } from "../drizzle/schema";
import { requireDb } from "./db";
import { createSessionToken, getSessionCookieOptions } from "./auth";

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 8;
const GENERIC_LOGIN_ERROR = "Credenciales inválidas.";

const jsonBody = express.json({ limit: "1mb" });

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function issueSessionCookie(res: Response, req: Request, user: { authSubject: string; name: string | null }) {
  const sessionToken = await createSessionToken({ authSubject: user.authSubject, name: user.name });
  res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
}

export function registerPasswordAuthRoutes(app: RouteTarget) {
  app.post("/api/auth/password/login", jsonBody, async (req: Request, res: Response) => {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || !password) {
      res.status(401).json({ error: GENERIC_LOGIN_ERROR });
      return;
    }

    try {
      const db = requireDb();
      const rows = await db.select().from(users);
      const candidate = rows.find((row) => normalizeEmail(row.email) === email);

      if (!candidate || !candidate.passwordHash) {
        // Run a hash comparison anyway so the response time doesn't leak whether the email exists.
        await bcrypt.compare(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali");
        res.status(401).json({ error: GENERIC_LOGIN_ERROR });
        return;
      }

      const valid = await bcrypt.compare(password, candidate.passwordHash);
      if (!valid) {
        res.status(401).json({ error: GENERIC_LOGIN_ERROR });
        return;
      }

      await db.update(users).set({ lastSignedInAt: new Date() }).where(eq(users.id, candidate.id));
      await issueSessionCookie(res, req, candidate);
      res.json({ ok: true });
    } catch (error) {
      console.error("[PasswordAuth] login failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "No se pudo iniciar sesión." });
    }
  });

  app.post("/api/auth/password/setup", jsonBody, async (req: Request, res: Response) => {
    const expectedSecret = process.env.ADMIN_SETUP_SECRET?.trim();
    const providedSecret = typeof req.body?.secret === "string" ? req.body.secret : "";
    if (!expectedSecret || providedSecret !== expectedSecret) {
      res.status(403).json({ error: "No autorizado." });
      return;
    }

    try {
      const db = requireDb();
      const existingUsers = await db.select().from(users);
      const alreadyBootstrapped = existingUsers.some((row) => Boolean(row.passwordHash));
      if (alreadyBootstrapped) {
        res.status(403).json({ error: "Setup already completed." });
        return;
      }

      const email = normalizeEmail(req.body?.email);
      const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";

      if (!email || !email.includes("@")) {
        res.status(400).json({ error: "Ingresá un email válido." });
        return;
      }
      if (!name) {
        res.status(400).json({ error: "Ingresá un nombre." });
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` });
        return;
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      const [created] = await db
        .insert(users)
        .values({
          authSubject: `local:${crypto.randomUUID()}`,
          email,
          name,
          passwordHash,
          platformRole: "platform_admin",
          lastSignedInAt: new Date(),
        })
        .returning();

      if (!created) {
        res.status(500).json({ error: "No se pudo crear la cuenta." });
        return;
      }

      await issueSessionCookie(res, req, created);
      res.json({ ok: true });
    } catch (error) {
      console.error("[PasswordAuth] setup failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "No se pudo completar el setup." });
    }
  });

  // Recovery for a forgotten password: gated by the same one-time ADMIN_SETUP_SECRET used for
  // initial bootstrap (unlike setup, this one doesn't self-disable — the owner keeps the secret
  // around specifically to regain access). Resets the single existing platform_admin account
  // rather than requiring the email, since that's often exactly what's been forgotten too.
  app.post("/api/auth/password/reset", jsonBody, async (req: Request, res: Response) => {
    const expectedSecret = process.env.ADMIN_SETUP_SECRET?.trim();
    const providedSecret = typeof req.body?.secret === "string" ? req.body.secret : "";
    if (!expectedSecret || providedSecret !== expectedSecret) {
      res.status(403).json({ error: "No autorizado." });
      return;
    }

    try {
      const password = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
      if (password.length < MIN_PASSWORD_LENGTH) {
        res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` });
        return;
      }

      const db = requireDb();
      const existingUsers = await db.select().from(users);
      const admin = existingUsers.find((row) => row.platformRole === "platform_admin" && row.passwordHash);
      if (!admin) {
        res.status(404).json({ error: "No hay ninguna cuenta de administrador para restablecer." });
        return;
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      await db.update(users).set({ passwordHash, lastSignedInAt: new Date() }).where(eq(users.id, admin.id));

      await issueSessionCookie(res, req, admin);
      res.json({ ok: true, email: admin.email });
    } catch (error) {
      console.error("[PasswordAuth] reset failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "No se pudo restablecer la contraseña." });
    }
  });
}
