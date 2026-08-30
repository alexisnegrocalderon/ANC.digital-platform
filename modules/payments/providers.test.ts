import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPaymentAdapter } from "./providers";

const credentials = {
  accessToken: "test-access-token",
  webhookSecret: "test-webhook-secret",
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PUBLIC_APP_URL;
});

describe("payment provider adapters", () => {
  const checkoutInput = {
    businessId: 1,
    businessSlug: "anc-demo",
    orderId: 1,
    orderNumber: "ANC-TEST-1",
    customerEmail: "qa@example.test",
    currency: "CLP",
    amountCents: 15000,
    items: [{ title: "Entrada", quantity: 1, unitPriceCents: 15000, currency: "CLP" }],
    successUrl: "https://example.test/success",
    cancelUrl: "https://example.test/cancel",
    idempotencyKey: "anc-stripe-checkout-order-1",
  };

  it("passes the local idempotency key to Stripe", async () => {
    process.env.PUBLIC_APP_URL = "https://example.test";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ "Idempotency-Key": checkoutInput.idempotencyKey });
      return new Response(JSON.stringify({ id: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1", status: "open" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await getPaymentAdapter("stripe").createCheckout(checkoutInput, credentials);
    expect(result.externalId).toBe("cs_test_1");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("creates a MercadoPago preference with the external reference", async () => {
    process.env.PUBLIC_APP_URL = "https://example.test";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.external_reference).toBe(checkoutInput.orderNumber);
      expect((init?.headers as Record<string, string>)["X-Idempotency-Key"]).toBeUndefined();
      return new Response(JSON.stringify({ id: "pref_test_1", init_point: "https://mercadopago.test/pref_test_1" }), { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await getPaymentAdapter("mercadopago").createCheckout(checkoutInput, credentials);
    expect(result.externalId).toBe("pref_test_1");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("mercadopago marketplace commission split", () => {
  afterEach(() => {
    delete process.env.MERCADOPAGO_MARKETPLACE_COMMISSION_BPS;
  });

  const checkoutInput = {
    businessId: 1,
    businessSlug: "anc-demo",
    orderId: 1,
    orderNumber: "ANC-TEST-1",
    customerEmail: "qa@example.test",
    currency: "CLP",
    amountCents: 20000,
    items: [{ title: "Entrada", quantity: 1, unitPriceCents: 20000, currency: "CLP" }],
    successUrl: "https://example.test/success",
    cancelUrl: "https://example.test/cancel",
    idempotencyKey: "anc-mercadopago-checkout-order-1",
  };

  it("adds marketplace_fee for an OAuth-connected (sellerUserId present) account, using the default 1.5% commission", async () => {
    process.env.PUBLIC_APP_URL = "https://example.test";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.marketplace_fee).toBe(300); // 20000 * 150bps / 10000
      return new Response(JSON.stringify({ id: "pref_oauth_1", init_point: "https://mercadopago.test/pref_oauth_1" }), { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await getPaymentAdapter("mercadopago").createCheckout(checkoutInput, {
      ...credentials,
      sellerUserId: "collector-123",
    });
    expect(result.externalId).toBe("pref_oauth_1");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("honors a custom MERCADOPAGO_MARKETPLACE_COMMISSION_BPS", async () => {
    process.env.PUBLIC_APP_URL = "https://example.test";
    process.env.MERCADOPAGO_MARKETPLACE_COMMISSION_BPS = "500"; // 5%
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.marketplace_fee).toBe(1000); // 20000 * 500bps / 10000
      return new Response(JSON.stringify({ id: "pref_oauth_2", init_point: "https://mercadopago.test/pref_oauth_2" }), { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await getPaymentAdapter("mercadopago").createCheckout(checkoutInput, {
      ...credentials,
      sellerUserId: "collector-123",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("omits marketplace_fee for a legacy manual-access-token account (no sellerUserId), unchanged from before", async () => {
    process.env.PUBLIC_APP_URL = "https://example.test";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body).not.toHaveProperty("marketplace_fee");
      return new Response(JSON.stringify({ id: "pref_manual_1", init_point: "https://mercadopago.test/pref_manual_1" }), { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await getPaymentAdapter("mercadopago").createCheckout(checkoutInput, credentials);
    expect(result.externalId).toBe("pref_manual_1");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("payment webhook signatures", () => {
  it("verifies Stripe with the exact raw body", () => {
    const body = JSON.stringify({ id: "evt_test", type: "checkout.session.completed", data: { object: {} } });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", credentials.webhookSecret)
      .update(`${timestamp}.${body}`, "utf8")
      .digest("hex");
    const adapter = getPaymentAdapter("stripe");
    const headers = { "stripe-signature": `t=${timestamp},v1=${signature}` };

    expect(adapter.verifyWebhook({ rawBody: body, headers, query: {}, credentials })).toBe(true);
    expect(adapter.verifyWebhook({ rawBody: `${body} `, headers, query: {}, credentials })).toBe(false);
  });

  it("verifies MercadoPago using data.id and request id", () => {
    const body = JSON.stringify({ id: 987, type: "payment", data: { id: "12345" } });
    const timestamp = "1704908010";
    const manifest = `id:12345;request-id:req-1;ts:${timestamp};`;
    const signature = createHmac("sha256", credentials.webhookSecret).update(manifest).digest("hex");
    const adapter = getPaymentAdapter("mercadopago");
    const headers = {
      "x-signature": `ts=${timestamp},v1=${signature}`,
      "x-request-id": "req-1",
    };

    expect(
      adapter.verifyWebhook({ rawBody: body, headers, query: { "data.id": "12345" }, credentials }),
    ).toBe(true);
    expect(
      adapter.verifyWebhook({ rawBody: body, headers, query: { "data.id": "99999" }, credentials }),
    ).toBe(false);
  });
});
