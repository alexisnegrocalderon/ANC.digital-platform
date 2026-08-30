import { createHmac } from "node:crypto";
import type {
  CheckoutResult,
  CreateCheckoutInput,
  NormalizedWebhookEvent,
  PaymentProvider,
} from "../../shared/payment";

export type ProviderCredentials = {
  accessToken: string;
  webhookSecret: string;
  publicKey?: string | null;
  // Present only for a MercadoPago account connected through marketplace OAuth (see
  // server/mercadoPagoConnect.ts). Its presence is the signal `createCheckout` uses to
  // split off ANC's marketplace commission — it is never set for the legacy manual
  // access-token flow, which behaves exactly as before.
  sellerUserId?: string | null;
};

function mercadoPagoMarketplaceFeeCents(amountCents: number) {
  const commissionBps = Number(process.env.MERCADOPAGO_MARKETPLACE_COMMISSION_BPS ?? 150);
  return Math.round((amountCents * commissionBps) / 10000);
}

export type PaymentAdapter = {
  provider: PaymentProvider;
  createCheckout(input: CreateCheckoutInput, credentials: ProviderCredentials): Promise<CheckoutResult>;
  verifyWebhook(input: {
    rawBody: string;
    headers: Record<string, string | string[] | undefined>;
    query: Record<string, string | string[] | undefined>;
    credentials: ProviderCredentials;
  }): boolean;
  normalizeWebhook(input: {
    rawBody: string;
    headers: Record<string, string | string[] | undefined>;
    query: Record<string, string | string[] | undefined>;
    credentials: ProviderCredentials;
  }): Promise<NormalizedWebhookEvent>;
};

export function requireHttpUrl(value: string, name: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${name} must use http or https.`);
  }
  return value;
}

export async function readJsonResponse(response: Response) {
  const raw = await response.text();
  let payload: unknown = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { raw };
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `Payment provider returned HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as Record<string, any>;
}

function headerValue(headers: Record<string, string | string[] | undefined>, name: string) {
  const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  return Array.isArray(value) ? value[0] : value;
}

function queryValue(query: Record<string, string | string[] | undefined>, name: string) {
  const value = query[name];
  return Array.isArray(value) ? value[0] : value;
}

function parseMercadoPagoSignature(value: string) {
  const values = new Map<string, string>();
  for (const part of value.split(",")) {
    const [key, ...rest] = part.trim().split("=");
    if (key && rest.length > 0) values.set(key, rest.join("="));
  }
  return values;
}

function constantTimeHexEqual(actual: string, expected: string) {
  if (!/^[0-9a-f]+$/i.test(actual) || !/^[0-9a-f]+$/i.test(expected)) return false;
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export function verifyMercadoPagoSignature(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  query: Record<string, string | string[] | undefined>,
  secret: string,
) {
  void rawBody;
  const xSignature = headerValue(headers, "x-signature");
  const xRequestId = headerValue(headers, "x-request-id");
  if (!xSignature || !secret) return false;

  const parsed = parseMercadoPagoSignature(xSignature);
  const timestamp = parsed.get("ts");
  const receivedHash = parsed.get("v1");
  if (!timestamp || !receivedHash) return false;

  const dataId = queryValue(query, "data.id") ?? queryValue(query, "id");
  const manifest = [
    dataId ? `id:${dataId};` : "",
    xRequestId ? `request-id:${xRequestId};` : "",
    `ts:${timestamp};`,
  ].join("");
  const expectedHash = createHmac("sha256", secret).update(manifest).digest("hex");
  return constantTimeHexEqual(expectedHash, receivedHash);
}

function centsToMajorUnits(amountCents: number, currency: string) {
  const zeroDecimalCurrencies = new Set(["CLP", "JPY", "KRW"]);
  return zeroDecimalCurrencies.has(currency.toUpperCase())
    ? amountCents.toFixed(0)
    : (amountCents / 100).toFixed(2);
}

function currencyForStripe(currency: string) {
  return currency.toLowerCase();
}

const stripeAdapter: PaymentAdapter = {
  provider: "stripe",
  async createCheckout(input, credentials) {
    const publicUrl = requireHttpUrl(process.env.PUBLIC_APP_URL ?? "", "PUBLIC_APP_URL");
    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("success_url", input.successUrl || `${publicUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    body.set("cancel_url", input.cancelUrl || `${publicUrl}/?payment=cancelled`);
    body.set("client_reference_id", input.orderNumber);
    body.set("customer_email", input.customerEmail);
    body.set("currency", currencyForStripe(input.currency));
    body.set("metadata[business_id]", String(input.businessId));
    body.set("metadata[order_id]", String(input.orderId));
    body.set("metadata[order_number]", input.orderNumber);
    input.items.forEach((item, index) => {
      body.set(`line_items[${index}][price_data][currency]`, currencyForStripe(item.currency));
      body.set(`line_items[${index}][price_data][product_data][name]`, item.title);
      body.set(`line_items[${index}][price_data][unit_amount]`, String(item.unitPriceCents));
      body.set(`line_items[${index}][quantity]`, String(item.quantity));
    });

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": input.idempotencyKey ?? "",
      },
      body,
    });
    const payload = await readJsonResponse(response);
    if (!payload.id || !payload.url) throw new Error("Stripe did not return a checkout session URL.");
    return {
      provider: "stripe",
      idempotencyKey: input.idempotencyKey ?? "",
      externalId: String(payload.id),
      checkoutUrl: String(payload.url),
      state: payload.payment_status === "paid" ? "approved" : "pending",
      providerStatus: String(payload.status ?? payload.payment_status ?? "open"),
    };
  },
  verifyWebhook({ rawBody, headers, credentials }) {
    const signature = headerValue(headers, "stripe-signature");
    if (!signature || !credentials.webhookSecret) return false;
    const match = signature.match(/(?:^|,)t=(\d+)(?:,|$)/);
    const signatures = [...signature.matchAll(/(?:^|,)v1=([^,]+)/g)].map((entry) => entry[1]);
    if (!match || signatures.length === 0) return false;
    const timestamp = Number(match[1]);
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
    const expected = createHmac("sha256", credentials.webhookSecret)
      .update(`${match[1]}.${rawBody}`, "utf8")
      .digest("hex");
    return signatures.some((candidate) => constantTimeHexEqual(candidate, expected));
  },
  async normalizeWebhook({ rawBody }) {
    const event = JSON.parse(rawBody) as Record<string, any>;
    const object = event.data?.object ?? {};
    const metadata = object.metadata ?? {};
    const eventType = String(event.type ?? "unknown");
    const state =
      eventType === "checkout.session.completed" && object.payment_status === "paid"
        ? "approved"
        : eventType === "checkout.session.expired"
          ? "expired"
          : eventType === "payment_intent.payment_failed"
            ? "failed"
            : "pending";
    return {
      provider: "stripe",
      externalEventId: String(event.id ?? object.id),
      eventType,
      externalPaymentId: typeof object.payment_intent === "string" ? object.payment_intent : undefined,
      externalOrderId: metadata.order_id ? String(metadata.order_id) : undefined,
      externalReference: object.client_reference_id
        ? String(object.client_reference_id)
        : metadata.order_number
          ? String(metadata.order_number)
          : undefined,
      state,
      providerStatus: String(object.payment_status ?? object.status ?? "unknown"),
      failureCode: object.last_payment_error?.code,
      failureMessage: object.last_payment_error?.message,
      metadata,
    };
  },
};

const mercadoPagoAdapter: PaymentAdapter = {
  provider: "mercadopago",
  async createCheckout(input, credentials) {
    const publicUrl = requireHttpUrl(process.env.PUBLIC_APP_URL ?? "", "PUBLIC_APP_URL");
    const notificationUrl = `${publicUrl}/api/payments/webhooks/mercadopago/${encodeURIComponent(input.businessSlug)}`;
    // A seller connected via marketplace OAuth (see server/mercadoPagoConnect.ts) gets its
    // access token used here instead of a manually pasted one, and MercadoPago splits an
    // automatic commission to ANC's own account via `marketplace_fee`. Accounts still on the
    // legacy manual-token flow have no `sellerUserId` and this block is skipped entirely, so
    // that path is byte-for-byte unchanged.
    const marketplaceFee = credentials.sellerUserId
      ? mercadoPagoMarketplaceFeeCents(input.amountCents)
      : null;
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: input.items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          unit_price: Number(centsToMajorUnits(item.unitPriceCents, item.currency)),
          currency_id: item.currency.toUpperCase(),
        })),
        payer: { email: input.customerEmail },
        external_reference: input.orderNumber,
        notification_url: notificationUrl,
        back_urls: {
          success: input.successUrl || `${publicUrl}/?payment=success`,
          failure: input.cancelUrl || `${publicUrl}/?payment=failed`,
          pending: `${publicUrl}/?payment=pending`,
        },
        auto_return: "approved",
        ...(marketplaceFee !== null ? { marketplace_fee: marketplaceFee } : {}),
      }),
    });
    const payload = await readJsonResponse(response);
    const checkoutUrl = payload.init_point ?? payload.sandbox_init_point;
    if (!payload.id || !checkoutUrl) throw new Error("MercadoPago did not return a checkout URL.");
    return {
      provider: "mercadopago",
      idempotencyKey: input.idempotencyKey ?? "",
      externalId: String(payload.id),
      checkoutUrl: String(checkoutUrl),
      state: "pending",
      providerStatus: "created",
    };
  },
  verifyWebhook({ rawBody, headers, query, credentials }) {
    return verifyMercadoPagoSignature(rawBody, headers, query, credentials.webhookSecret);
  },
  async normalizeWebhook({ rawBody, query, credentials }) {
    const notification = JSON.parse(rawBody) as Record<string, any>;
    const externalId = String(notification.data?.id ?? queryValue(query, "data.id") ?? "");
    const topic = String(notification.type ?? notification.topic ?? "payment");
    if (!externalId) throw new Error("MercadoPago webhook is missing data.id.");

    const resourcePath =
      topic === "merchant_order"
        ? `https://api.mercadopago.com/merchant_orders/${encodeURIComponent(externalId)}`
        : topic === "orders"
          ? `https://api.mercadopago.com/v1/orders/${encodeURIComponent(externalId)}`
          : `https://api.mercadopago.com/v1/payments/${encodeURIComponent(externalId)}`;
    const response = await fetch(resourcePath, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    });
    const resource = await readJsonResponse(response);
    const status = String(resource.status ?? resource.order_status ?? resource.transactions?.payments?.[0]?.status ?? "pending");
    const state =
      status === "approved" || status === "processed"
        ? "approved"
        : ["rejected", "cancelled", "cancelled_by_user"].includes(status)
          ? "failed"
          : status === "expired"
            ? "expired"
            : "pending";
    const payment = resource.transactions?.payments?.[0];
    return {
      provider: "mercadopago",
      externalEventId: String(notification.id ?? `${topic}:${externalId}`),
      eventType: String(notification.action ?? `${topic}.${status}`),
      externalPaymentId: String(resource.id ?? payment?.id ?? externalId),
      externalOrderId: topic === "orders" ? externalId : undefined,
      externalReference: resource.external_reference,
      state,
      providerStatus: status,
      failureCode: resource.status_detail,
      failureMessage: resource.status_detail,
      metadata: { topic, resourceId: externalId },
    };
  },
};

export const PAYMENT_ADAPTERS: Record<PaymentProvider, PaymentAdapter> = {
  stripe: stripeAdapter,
  mercadopago: mercadoPagoAdapter,
};

export function getPaymentAdapter(provider: PaymentProvider) {
  return PAYMENT_ADAPTERS[provider];
}
