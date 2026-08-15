import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { businesses } from "../../drizzle/schema";
import type { PaymentProvider } from "../../shared/payment";
import { getDb } from "../db";
import {
  applyNormalizedPaymentEvent,
  markWebhookEvent,
  recordWebhookEvent,
  resolveProviderCredentials,
} from "../../modules/payments/service";
import { getPaymentAdapter } from "../../modules/payments/providers";

function headersFromRequest(request: Request) {
  return Object.fromEntries(
    Object.entries(request.headers).map(([key, value]) => [key, value]),
  ) as Record<string, string | string[] | undefined>;
}

function queryFromRequest(request: Request) {
  return Object.fromEntries(
    Object.entries(request.query).map(([key, value]) => [key, value]),
  ) as Record<string, string | string[] | undefined>;
}

function envelopeFromPayload(rawBody: string, provider: PaymentProvider) {
  const payload = JSON.parse(rawBody) as Record<string, any>;
  const type = String(payload.type ?? payload.topic ?? payload.action ?? "unknown");
  const resourceId = payload.data?.id ? String(payload.data.id) : undefined;
  const externalEventId = payload.id
    ? String(payload.id)
    : resourceId
      ? `${type}:${resourceId}`
      : "";
  if (!externalEventId) throw new Error("Webhook event identifier is required.");
  return { payload, type, resourceId, externalEventId, provider };
}

async function processRecordedWebhook(input: {
  db: any;
  businessId: number;
  businessSlug: string;
  provider: PaymentProvider;
  eventId: number;
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
}) {
  try {
    const credentials = await resolveProviderCredentials(input.db, input.businessId, input.provider);
    const adapter = getPaymentAdapter(input.provider);
    const normalized = await adapter.normalizeWebhook({
      rawBody: input.rawBody,
      headers: input.headers,
      query: input.query,
      credentials,
    });
    const result = await applyNormalizedPaymentEvent(input.db, {
      businessId: input.businessId,
      event: normalized,
    });
    await markWebhookEvent(
      input.db,
      input.businessId,
      input.eventId,
      result.matched ? "processed" : "ignored",
      result.matched ? undefined : result.reason,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown webhook processing error";
    await markWebhookEvent(input.db, input.businessId, input.eventId, "failed", message);
    console.error(`[Payments] ${input.provider} webhook processing failed`, {
      businessId: input.businessId,
      eventId: input.eventId,
      message,
    });
  }
}

export async function handlePaymentWebhook(
  provider: PaymentProvider,
  businessSlug: string,
  request: Request,
  response: Response,
) {
  const db = getDb();
  if (!db) return response.status(503).json({ error: "Payment database is unavailable." });

  const businessRows = await db
    .select({ id: businesses.id, slug: businesses.slug })
    .from(businesses)
    .where(and(eq(businesses.slug, businessSlug), eq(businesses.status, "active")))
    .limit(1);
  const business = businessRows[0];
  if (!business) return response.status(404).json({ error: "Business not found." });

  const rawBody = Buffer.isBuffer(request.body)
    ? request.body.toString("utf8")
    : typeof request.body === "string"
      ? request.body
      : "";
  if (!rawBody) return response.status(400).json({ error: "Raw webhook body is required." });

  let envelope;
  try {
    envelope = envelopeFromPayload(rawBody, provider);
  } catch (error) {
    return response.status(400).json({
      error: error instanceof Error ? error.message : "Webhook payload is invalid.",
    });
  }

  const headers = headersFromRequest(request);
  const query = queryFromRequest(request);
  let credentials;
  try {
    credentials = await resolveProviderCredentials(db, business.id, provider);
  } catch {
    return response.status(503).json({ error: "Webhook credentials are not configured." });
  }

  const adapter = getPaymentAdapter(provider);
  if (!adapter.verifyWebhook({ rawBody, headers, query, credentials })) {
    return response.status(401).json({ error: "Invalid webhook signature." });
  }

  const recorded = await recordWebhookEvent(db, {
    businessId: business.id,
    provider,
    externalEventId: envelope.externalEventId,
    eventType: envelope.type,
    rawBody,
  });
  if (!recorded.isNew && recorded.event.status === "processed") {
    return response.status(200).json({ received: true, duplicate: true });
  }

  response.status(200).json({ received: true });
  void processRecordedWebhook({
    db,
    businessId: business.id,
    businessSlug: business.slug,
    provider,
    eventId: recorded.event.id,
    rawBody,
    headers,
    query,
  });
}
