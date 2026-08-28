import { readJsonResponse, requireHttpUrl, verifyMercadoPagoSignature } from "../payments/providers";
import type { ProviderCredentials } from "../payments/providers";

const PREAPPROVAL_BASE_URL = "https://api.mercadopago.com/preapproval";
const AUTHORIZED_PAYMENT_BASE_URL = "https://api.mercadopago.com/authorized_payments";

export type CreatePreapprovalInput = {
  reason: string;
  payerEmail: string;
  externalReference: string;
  frequency: number;
  frequencyType: "days" | "months";
  amountCents: number;
  currency: string;
  businessSlug: string;
  startDate?: string;
};

export type PreapprovalResult = {
  externalPreapprovalId: string;
  status: string;
  raw: Record<string, unknown>;
};

function centsToMajorUnits(amountCents: number, currency: string) {
  const zeroDecimalCurrencies = new Set(["CLP", "JPY", "KRW"]);
  return zeroDecimalCurrencies.has(currency.toUpperCase())
    ? amountCents
    : Number((amountCents / 100).toFixed(2));
}

export async function createPreapproval(
  input: CreatePreapprovalInput,
  credentials: ProviderCredentials,
): Promise<PreapprovalResult> {
  const publicUrl = requireHttpUrl(process.env.PUBLIC_APP_URL ?? "", "PUBLIC_APP_URL");
  const notificationUrl = `${publicUrl}/api/payments/webhooks/mercadopago-subscription/${encodeURIComponent(input.businessSlug)}`;
  const backUrl = `${publicUrl}/?agency_subscription=confirmed`;

  const response = await fetch(PREAPPROVAL_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason: input.reason,
      external_reference: input.externalReference,
      payer_email: input.payerEmail,
      back_url: backUrl,
      notification_url: notificationUrl,
      auto_recurring: {
        frequency: input.frequency,
        frequency_type: input.frequencyType,
        transaction_amount: centsToMajorUnits(input.amountCents, input.currency),
        currency_id: input.currency.toUpperCase(),
        start_date: input.startDate,
      },
      status: "pending",
    }),
  });
  const payload = await readJsonResponse(response);
  if (!payload.id) throw new Error("MercadoPago did not return a preapproval id.");
  return {
    externalPreapprovalId: String(payload.id),
    status: String(payload.status ?? "pending"),
    raw: payload,
  };
}

export async function getPreapproval(
  preapprovalId: string,
  credentials: ProviderCredentials,
): Promise<Record<string, any>> {
  const response = await fetch(`${PREAPPROVAL_BASE_URL}/${encodeURIComponent(preapprovalId)}`, {
    headers: { Authorization: `Bearer ${credentials.accessToken}` },
  });
  return readJsonResponse(response);
}

export async function cancelPreapproval(
  preapprovalId: string,
  credentials: ProviderCredentials,
): Promise<Record<string, any>> {
  const response = await fetch(`${PREAPPROVAL_BASE_URL}/${encodeURIComponent(preapprovalId)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "cancelled" }),
  });
  return readJsonResponse(response);
}

export async function getAuthorizedPayment(
  authorizedPaymentId: string,
  credentials: ProviderCredentials,
): Promise<Record<string, any>> {
  const response = await fetch(`${AUTHORIZED_PAYMENT_BASE_URL}/${encodeURIComponent(authorizedPaymentId)}`, {
    headers: { Authorization: `Bearer ${credentials.accessToken}` },
  });
  return readJsonResponse(response);
}

/** Reuses the same HMAC verification scheme as the single-checkout MercadoPago adapter. */
export function verifySubscriptionWebhookSignature(input: {
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  credentials: ProviderCredentials;
}) {
  return verifyMercadoPagoSignature(input.rawBody, input.headers, input.query, input.credentials.webhookSecret);
}
