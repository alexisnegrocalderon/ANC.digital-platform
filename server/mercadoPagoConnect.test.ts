import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptPaymentSecret, decryptPaymentSecret } from "./services/paymentSecrets";
import { ensureFreshMercadoPagoToken } from "./mercadoPagoConnect";

const testKey = Buffer.alloc(32, 9).toString("base64");

function makeFakeDb() {
  const calls: any[] = [];
  return {
    calls,
    update() {
      return {
        set(values: any) {
          calls.push(values);
          return {
            where() {
              return Promise.resolve();
            },
          };
        },
      };
    },
  };
}

beforeEach(() => {
  process.env.PAYMENTS_ENCRYPTION_KEY = testKey;
  process.env.MERCADOPAGO_MARKETPLACE_CLIENT_ID = "test-client-id";
  process.env.MERCADOPAGO_MARKETPLACE_CLIENT_SECRET = "test-client-secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PAYMENTS_ENCRYPTION_KEY;
  delete process.env.MERCADOPAGO_MARKETPLACE_CLIENT_ID;
  delete process.env.MERCADOPAGO_MARKETPLACE_CLIENT_SECRET;
});

describe("ensureFreshMercadoPagoToken", () => {
  it("returns the stored access token as-is when it is not close to expiring, without calling MercadoPago", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const db = makeFakeDb();

    const account = {
      id: 1,
      encryptedAccessToken: encryptPaymentSecret("still-fresh-access-token"),
      encryptedRefreshToken: encryptPaymentSecret("some-refresh-token"),
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // an hour from now
    };

    const token = await ensureFreshMercadoPagoToken(db, account);

    expect(token).toBe("still-fresh-access-token");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.calls).toHaveLength(0);
  });

  it("refreshes and persists a new access/refresh token pair when the current one is expiring soon", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://api.mercadopago.com/oauth/token");
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        client_id: "test-client-id",
        client_secret: "test-client-secret",
        grant_type: "refresh_token",
        refresh_token: "old-refresh-token",
      });
      return new Response(
        JSON.stringify({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 21600,
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const db = makeFakeDb();

    const account = {
      id: 1,
      encryptedAccessToken: encryptPaymentSecret("about-to-expire-access-token"),
      encryptedRefreshToken: encryptPaymentSecret("old-refresh-token"),
      tokenExpiresAt: new Date(Date.now() + 60 * 1000), // one minute from now, inside the safety margin
    };

    const token = await ensureFreshMercadoPagoToken(db, account);

    expect(token).toBe("new-access-token");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(db.calls).toHaveLength(1);
    expect(decryptPaymentSecret(db.calls[0].encryptedAccessToken)).toBe("new-access-token");
    expect(decryptPaymentSecret(db.calls[0].encryptedRefreshToken)).toBe("new-refresh-token");
    expect(db.calls[0].tokenExpiresAt).toBeInstanceOf(Date);
  });

  it("also refreshes when there is no expiry recorded at all", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ access_token: "refreshed-token", refresh_token: "refreshed-refresh-token", expires_in: 3600 }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const db = makeFakeDb();

    const account = {
      id: 1,
      encryptedAccessToken: encryptPaymentSecret("unknown-freshness-token"),
      encryptedRefreshToken: encryptPaymentSecret("some-refresh-token"),
      tokenExpiresAt: null,
    };

    const token = await ensureFreshMercadoPagoToken(db, account);
    expect(token).toBe("refreshed-token");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
