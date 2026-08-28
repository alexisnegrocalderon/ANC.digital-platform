import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { businesses } from "../../drizzle/schema";
import { getDb } from "../../server/db";
import { markWebhookEvent, recordWebhookEvent, resolveProviderCredentials } from "../payments/service";
import { getAuthorizedPayment, getPreapproval, verifySubscriptionWebhookSignature } from "./mpSubscriptionAdapter";
import { reconcileAuthorizedPayment, updateSubscriptionStatus } from "./service";

function headersFromRequest(request: Request) {
  return Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key, value])) as Record<
    string,
    string | string[] | undefined
  >;
}

function queryFromRequest(request: Request) {
  return Object.fromEntries(Object.entries(request.query).map(([key, value]) => [key, value])) as Record<
    string,
    string | string[] | undefined
  >;
}

function envelopeFromPayload(rawBody: string) {
  const payload = JSON.parse(rawBody) as Record<string, any>;
  const topic = String(payload.type ?? payload.topic ?? payload.action ?? "unknown");
  const resourceId = payload.data?.id ? String(payload.data.id) : undefined;
  const rawId = payload.id ? String(payload.id) : resourceId ? `${topic}:${resourceId}` : "";
  if (!rawId) throw new Error("Webhook event identifier is required.");
  // Prefix so subscription events never collide with the single-checkout payment_webhook_events namespace.
  const eventType = topic.includes("authorized_payment")
    ? `subscription_authorized_payment.${topic}`
    : `subscription_preapproval.${topic}`;
  return { topic, resourceId, externalEventId: `subscription:${rawId}`, eventType };
}

async function processRecordedWebhook(input: {
  db: any;
  businessId: number;
  eventId: number;
  topic: string;
  resourceId?: string;
  credentials: Awaited<ReturnType<typeof resolveProviderCredentials>>;
}) {
  try {
    if (!input.resourceId) throw new Error("Webhook payload is missing a resource id.");

    if (input.topic.includes("authorized_payment")) {
      const payment = await getAuthorizedPayment(input.resourceId, input.credentials);
      const status = String(payment.status ?? "");
      if (status === "approved" || status === "processed") {
        const preapprovalId = String(payment.preapproval_id ?? "");
        const amountCents = Math.round(Number(payment.transaction_amount ?? 0) * 100);
        const result = await reconcileAuthorizedPayment(input.db, {
          externalPreapprovalId: preapprovalId,
          amountCents,
          authorizedPaymentId: input.resourceId,
        });
        await markWebhookEvent(
          input.db,
          input.businessId,
          input.eventId,
          result.matched ? "processed" : "ignored",
          result.matched ? undefined : result.reason,
        );
      } else {
        await markWebhookEvent(input.db, input.businessId, input.eventId, "ignored", `payment_status:${status}`);
      }
      return;
    }

    // Preapproval lifecycle event (authorized/paused/cancelled/pending).
    const preapproval = await getPreapproval(input.resourceId, input.credentials);
    await updateSubscriptionStatus(input.db, {
      externalPreapprovalId: input.resourceId,
      status: String(preapproval.status ?? "pending"),
      metadata: preapproval,
    });
    await markWebhookEvent(input.db, input.businessId, input.eventId, "processed");
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown webhook processing error";
    await markWebhookEvent(input.db, input.businessId, input.eventId, "failed", message);
    console.error("[AgencyBilling] mercadopago-subscription webhook processing failed", {
      businessId: input.businessId,
      eventId: input.eventId,
      message,
    });
  }
}

export async function handleAgencySubscriptionWebhook(businessSlug: string, request: Request, response: Response) {
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
    envelope = envelopeFromPayload(rawBody);
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : "Webhook payload is invalid." });
  }

  const headers = headersFromRequest(request);
  const query = queryFromRequest(request);
  let credentials;
  try {
    credentials = await resolveProviderCredentials(db, business.id, "mercadopago");
  } catch {
    return response.status(503).json({ error: "Webhook credentials are not configured." });
  }

  if (!verifySubscriptionWebhookSignature({ rawBody, headers, query, credentials })) {
    return response.status(401).json({ error: "Invalid webhook signature." });
  }

  const recorded = await recordWebhookEvent(db, {
    businessId: business.id,
    provider: "mercadopago",
    externalEventId: envelope.externalEventId,
    eventType: envelope.eventType,
    rawBody,
  });
  if (!recorded.isNew && recorded.event.status === "processed") {
    return response.status(200).json({ received: true, duplicate: true });
  }

  response.status(200).json({ received: true });
  void processRecordedWebhook({
    db,
    businessId: business.id,
    eventId: recorded.event.id,
    topic: envelope.topic,
    resourceId: envelope.resourceId,
    credentials,
  });
}
