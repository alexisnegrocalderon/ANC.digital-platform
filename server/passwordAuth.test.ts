import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { COOKIE_NAME } from "../shared/const";
import { users } from "../drizzle/schema";
import { createFakeDb, type FakeDb } from "./testFakeDb";

let db: FakeDb;

vi.mock("./db", () => ({
  requireDb: () => db,
}));

const createSessionToken = vi.fn(async (_user: unknown) => "fake-session-token");
const getSessionCookieOptions = vi.fn((_req: unknown) => ({
  httpOnly: true,
  path: "/",
  sameSite: "none" as const,
  secure: true,
}));

vi.mock("./auth", () => ({
  createSessionToken: (user: unknown) => createSessionToken(user),
  getSessionCookieOptions: (req: unknown) => getSessionCookieOptions(req),
}));

// Imported after the mocks above so ./passwordAuth picks up the mocked modules.
const { registerPasswordAuthRoutes } = await import("./passwordAuth");

type RouteHandler = (req: Request, res: Response) => unknown | Promise<unknown>;

function collectRoutes() {
  const routes = new Map<string, RouteHandler>();
  const fakeApp = {
    post: (path: string, ...handlers: RouteHandler[]) => {
      routes.set(path, handlers[handlers.length - 1]);
    },
  };
  registerPasswordAuthRoutes(fakeApp as any);
  return routes;
}

function fakeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    body: {},
    ...overrides,
  } as Request;
}

function fakeRes() {
  const res: Partial<Response> & { statusCode: number } = {
    statusCode: 200,
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    status: vi.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
  };
  return res as Response & { json: ReturnType<typeof vi.fn>; cookie: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn> };
}

const originalEnv = { ...process.env };

beforeEach(() => {
  db = createFakeDb();
  process.env = { ...originalEnv };
  process.env.ADMIN_SETUP_SECRET = "test-setup-secret";
  createSessionToken.mockReset().mockResolvedValue("fake-session-token");
  getSessionCookieOptions.mockReset().mockReturnValue({ httpOnly: true, path: "/", sameSite: "none", secure: true });
});

describe("bcrypt hashing", () => {
  it("round-trips a password through hash and compare", async () => {
    const hash = await bcrypt.hash("correct horse battery staple", 12);
    await expect(bcrypt.compare("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(bcrypt.compare("wrong password", hash)).resolves.toBe(false);
  });
});

describe("POST /api/auth/password/setup", () => {
  it("rejects a wrong or missing secret", async () => {
    const routes = collectRoutes();
    const req = fakeReq({ body: { secret: "nope", email: "owner@example.test", password: "supersecret1", name: "Owner" } });
    const res = fakeRes();

    await routes.get("/api/auth/password/setup")!(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(db.dump(users)).toHaveLength(0);
  });

  it("creates the first admin user and logs them in", async () => {
    const routes = collectRoutes();
    const req = fakeReq({
      body: {
        secret: "test-setup-secret",
        email: "Owner@Example.test",
        password: "supersecret1",
        name: "Owner",
      },
    });
    const res = fakeRes();

    await routes.get("/api/auth/password/setup")!(req, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(res.cookie).toHaveBeenCalledWith(COOKIE_NAME, "fake-session-token", expect.anything());

    const stored = db.dump(users);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ email: "owner@example.test", platformRole: "platform_admin" });
    expect(String(stored[0].authSubject)).toMatch(/^local:/);
    expect(stored[0].passwordHash).toBeTruthy();
    expect(stored[0].passwordHash).not.toBe("supersecret1");
  });

  it("rejects a second setup attempt once a password user already exists (bootstrap guard)", async () => {
    db.seed(users, [
      { id: 1, authSubject: "local:existing", email: "owner@example.test", name: "Owner", passwordHash: "some-hash" },
    ]);
    const routes = collectRoutes();
    const req = fakeReq({
      body: { secret: "test-setup-secret", email: "second@example.test", password: "supersecret1", name: "Second" },
    });
    const res = fakeRes();

    await routes.get("/api/auth/password/setup")!(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(db.dump(users)).toHaveLength(1);
    expect(createSessionToken).not.toHaveBeenCalled();
  });

  it("rejects a weak password with a 400", async () => {
    const routes = collectRoutes();
    const req = fakeReq({
      body: { secret: "test-setup-secret", email: "owner@example.test", password: "short", name: "Owner" },
    });
    const res = fakeRes();

    await routes.get("/api/auth/password/setup")!(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.dump(users)).toHaveLength(0);
  });
});

describe("POST /api/auth/password/login", () => {
  it("logs in with correct credentials and issues a session cookie", async () => {
    const passwordHash = await bcrypt.hash("supersecret1", 12);
    db.seed(users, [
      { id: 1, authSubject: "local:existing", email: "owner@example.test", name: "Owner", passwordHash },
    ]);

    const routes = collectRoutes();
    const req = fakeReq({ body: { email: "owner@example.test", password: "supersecret1" } });
    const res = fakeRes();

    await routes.get("/api/auth/password/login")!(req, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(createSessionToken).toHaveBeenCalledWith({ authSubject: "local:existing", name: "Owner" });
    expect(res.cookie).toHaveBeenCalledWith(COOKIE_NAME, "fake-session-token", expect.anything());
  });

  it("rejects an unknown email with a generic message", async () => {
    const routes = collectRoutes();
    const req = fakeReq({ body: { email: "nobody@example.test", password: "supersecret1" } });
    const res = fakeRes();

    await routes.get("/api/auth/password/login")!(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Credenciales inválidas." });
    expect(createSessionToken).not.toHaveBeenCalled();
  });

  it("rejects a wrong password with the same generic message", async () => {
    const passwordHash = await bcrypt.hash("supersecret1", 12);
    db.seed(users, [
      { id: 1, authSubject: "local:existing", email: "owner@example.test", name: "Owner", passwordHash },
    ]);

    const routes = collectRoutes();
    const req = fakeReq({ body: { email: "owner@example.test", password: "wrong-password" } });
    const res = fakeRes();

    await routes.get("/api/auth/password/login")!(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Credenciales inválidas." });
    expect(createSessionToken).not.toHaveBeenCalled();
  });
});
