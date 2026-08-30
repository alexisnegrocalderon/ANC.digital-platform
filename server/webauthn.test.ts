import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { WEBAUTHN_CHALLENGE_COOKIE, COOKIE_NAME } from "../shared/const";
import { users, webauthnCredentials } from "../drizzle/schema";
import { createFakeDb, type FakeDb } from "../modules/agency-billing/testFakeDb";

const generateRegistrationOptions = vi.fn();
const verifyRegistrationResponse = vi.fn();
const generateAuthenticationOptions = vi.fn();
const verifyAuthenticationResponse = vi.fn();

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: (...args: unknown[]) => generateRegistrationOptions(...args),
  verifyRegistrationResponse: (...args: unknown[]) => verifyRegistrationResponse(...args),
  generateAuthenticationOptions: (...args: unknown[]) => generateAuthenticationOptions(...args),
  verifyAuthenticationResponse: (...args: unknown[]) => verifyAuthenticationResponse(...args),
}));

let db: FakeDb;

vi.mock("./db", () => ({
  requireDb: () => db,
}));

const getAuthenticatedUser = vi.fn();
const createSessionToken = vi.fn(async (_user: unknown) => "fake-session-token");
const getSessionCookieOptions = vi.fn((_req: unknown) => ({
  httpOnly: true,
  path: "/",
  sameSite: "none" as const,
  secure: true,
}));

vi.mock("./auth", () => ({
  getAuthenticatedUser: (req: unknown) => getAuthenticatedUser(req),
  createSessionToken: (user: unknown) => createSessionToken(user),
  getSessionCookieOptions: (req: unknown) => getSessionCookieOptions(req),
}));

// Imported after the mocks above so ./webauthn picks up the mocked modules.
const { registerWebauthnRoutes } = await import("./webauthn");

type RouteHandler = (req: Request, res: Response) => unknown | Promise<unknown>;

function collectRoutes() {
  const routes = new Map<string, RouteHandler>();
  const fakeApp = {
    post: (path: string, ...handlers: RouteHandler[]) => {
      routes.set(path, handlers[handlers.length - 1]);
    },
  };
  registerWebauthnRoutes(fakeApp as any);
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
  return res as Response & { json: ReturnType<typeof vi.fn>; cookie: ReturnType<typeof vi.fn>; clearCookie: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn> };
}

beforeEach(() => {
  db = createFakeDb();
  process.env.PUBLIC_APP_URL = "https://admin.ancdigital.cl";
  generateRegistrationOptions.mockReset();
  verifyRegistrationResponse.mockReset();
  generateAuthenticationOptions.mockReset();
  verifyAuthenticationResponse.mockReset();
  getAuthenticatedUser.mockReset();
  createSessionToken.mockReset().mockResolvedValue("fake-session-token");
  getSessionCookieOptions.mockReset().mockReturnValue({ httpOnly: true, path: "/", sameSite: "none", secure: true });
});

const authenticatedUser = {
  id: 7,
  authSubject: "auth-7",
  email: "owner@example.test",
  name: "Owner",
  platformRole: "user" as const,
};

describe("POST /api/webauthn/register/options", () => {
  it("requires an authenticated session", async () => {
    getAuthenticatedUser.mockResolvedValue(null);
    const routes = collectRoutes();
    const req = fakeReq();
    const res = fakeRes();

    await routes.get("/api/webauthn/register/options")!(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(generateRegistrationOptions).not.toHaveBeenCalled();
  });

  it("generates platform-attachment options, excludes existing credentials, and sets the challenge cookie", async () => {
    getAuthenticatedUser.mockResolvedValue(authenticatedUser);
    db.seed(users, [{ id: 7, authSubject: "auth-7", email: "owner@example.test", name: "Owner" }]);
    db.seed(webauthnCredentials, [
      { id: 1, userId: 7, credentialId: "existing-cred", publicKey: "abc", counter: 0, transports: ["internal"] },
    ]);
    generateRegistrationOptions.mockResolvedValue({ challenge: "reg-challenge", rp: { id: "admin.ancdigital.cl" } });

    const routes = collectRoutes();
    const req = fakeReq();
    const res = fakeRes();

    await routes.get("/api/webauthn/register/options")!(req, res);

    expect(generateRegistrationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        rpID: "admin.ancdigital.cl",
        rpName: "ANC Platform",
        authenticatorSelection: expect.objectContaining({
          authenticatorAttachment: "platform",
          userVerification: "required",
        }),
        excludeCredentials: [{ id: "existing-cred", transports: ["internal"] }],
      }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      WEBAUTHN_CHALLENGE_COOKIE,
      "reg-challenge",
      expect.objectContaining({ httpOnly: true }),
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ challenge: "reg-challenge" }));
  });
});

describe("POST /api/webauthn/register/verify", () => {
  it("rejects when there is no pending challenge cookie", async () => {
    getAuthenticatedUser.mockResolvedValue(authenticatedUser);
    const routes = collectRoutes();
    const req = fakeReq();
    const res = fakeRes();

    await routes.get("/api/webauthn/register/verify")!(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(verifyRegistrationResponse).not.toHaveBeenCalled();
  });

  it("stores a new credential row on successful verification", async () => {
    getAuthenticatedUser.mockResolvedValue(authenticatedUser);
    verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: "new-credential-id",
          publicKey: new Uint8Array([1, 2, 3, 4]),
          counter: 0,
          transports: ["internal", "hybrid"],
        },
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
      },
    });

    const routes = collectRoutes();
    const req = fakeReq({
      headers: { cookie: `${WEBAUTHN_CHALLENGE_COOKIE}=reg-challenge` } as any,
      body: { id: "new-credential-id", response: {} } as any,
    });
    const res = fakeRes();

    await routes.get("/api/webauthn/register/verify")!(req, res);

    expect(verifyRegistrationResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: "reg-challenge",
        expectedOrigin: ["https://admin.ancdigital.cl", "https://www.admin.ancdigital.cl"],
        expectedRPID: "admin.ancdigital.cl",
      }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(WEBAUTHN_CHALLENGE_COOKIE, expect.anything());
    expect(res.json).toHaveBeenCalledWith({ ok: true });

    const stored = db.dump(webauthnCredentials);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ userId: 7, credentialId: "new-credential-id", counter: 0 });
  });

  it("returns 400 when the verification fails", async () => {
    getAuthenticatedUser.mockResolvedValue(authenticatedUser);
    verifyRegistrationResponse.mockResolvedValue({ verified: false });

    const routes = collectRoutes();
    const req = fakeReq({
      headers: { cookie: `${WEBAUTHN_CHALLENGE_COOKIE}=reg-challenge` } as any,
      body: { id: "new-credential-id" } as any,
    });
    const res = fakeRes();

    await routes.get("/api/webauthn/register/verify")!(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.dump(webauthnCredentials)).toHaveLength(0);
  });
});

describe("POST /api/webauthn/login/options", () => {
  it("is public and issues a usernameless challenge", async () => {
    generateAuthenticationOptions.mockResolvedValue({ challenge: "login-challenge" });
    const routes = collectRoutes();
    const req = fakeReq();
    const res = fakeRes();

    await routes.get("/api/webauthn/login/options")!(req, res);

    expect(getAuthenticatedUser).not.toHaveBeenCalled();
    expect(generateAuthenticationOptions).toHaveBeenCalledWith(
      expect.objectContaining({ rpID: "admin.ancdigital.cl", userVerification: "required", allowCredentials: [] }),
    );
    expect(res.cookie).toHaveBeenCalledWith(WEBAUTHN_CHALLENGE_COOKIE, "login-challenge", expect.anything());
    expect(res.json).toHaveBeenCalledWith({ challenge: "login-challenge" });
  });
});

describe("POST /api/webauthn/login/verify", () => {
  it("rejects an unknown credential id", async () => {
    const routes = collectRoutes();
    const req = fakeReq({
      headers: { cookie: `${WEBAUTHN_CHALLENGE_COOKIE}=login-challenge` } as any,
      body: { id: "unknown-credential" } as any,
    });
    const res = fakeRes();

    await routes.get("/api/webauthn/login/verify")!(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(verifyAuthenticationResponse).not.toHaveBeenCalled();
  });

  it("verifies against the stored credential, updates the counter, and mints a session cookie", async () => {
    db.seed(users, [{ id: 7, authSubject: "auth-7", email: "owner@example.test", name: "Owner" }]);
    db.seed(webauthnCredentials, [
      { id: 1, userId: 7, credentialId: "known-credential", publicKey: Buffer.from([1, 2, 3]).toString("base64url"), counter: 4, transports: ["internal"] },
    ]);
    verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 5 },
    });

    const routes = collectRoutes();
    const req = fakeReq({
      headers: { cookie: `${WEBAUTHN_CHALLENGE_COOKIE}=login-challenge` } as any,
      body: { id: "known-credential", response: {} } as any,
    });
    const res = fakeRes();

    await routes.get("/api/webauthn/login/verify")!(req, res);

    expect(verifyAuthenticationResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: "login-challenge",
        credential: expect.objectContaining({ id: "known-credential", counter: 4 }),
      }),
    );
    expect(createSessionToken).toHaveBeenCalledWith({ authSubject: "auth-7", name: "Owner" });
    expect(res.cookie).toHaveBeenCalledWith(COOKIE_NAME, "fake-session-token", expect.anything());
    expect(res.json).toHaveBeenCalledWith({ ok: true });

    const stored = db.dump(webauthnCredentials);
    expect(stored[0]).toMatchObject({ counter: 5 });
    expect(stored[0].lastUsedAt).toBeInstanceOf(Date);
  });

  it("returns 400 when verification fails", async () => {
    db.seed(users, [{ id: 7, authSubject: "auth-7", email: "owner@example.test", name: "Owner" }]);
    db.seed(webauthnCredentials, [
      { id: 1, userId: 7, credentialId: "known-credential", publicKey: Buffer.from([1, 2, 3]).toString("base64url"), counter: 4, transports: ["internal"] },
    ]);
    verifyAuthenticationResponse.mockResolvedValue({ verified: false });

    const routes = collectRoutes();
    const req = fakeReq({
      headers: { cookie: `${WEBAUTHN_CHALLENGE_COOKIE}=login-challenge` } as any,
      body: { id: "known-credential", response: {} } as any,
    });
    const res = fakeRes();

    await routes.get("/api/webauthn/login/verify")!(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(createSessionToken).not.toHaveBeenCalled();
  });
});
