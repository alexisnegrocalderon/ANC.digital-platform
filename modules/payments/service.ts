import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  auditEvents,
  orders,
  paymentAttempts,
  paymentWebhookEvents,
} from "../../drizzle/schema";
import {
  assertPaymentStateTransition,
  type NormalizedWebhookEvent,
  type PaymentProvider,
  type PaymentState,
} from "../../shared/payment";

export type DatabaseLike = any;

type AttemptInput = {
  businessId: number;
  orderId: number;
  provider: PaymentProvider;
  operation?: string;
  amountCents: number;
  currency: string;
  orderNumber: string;
  idempotencyKey?: string;
};

export function createPaymentIdempotencyKey(provider: PaymentProvider, orderId: number) {
  return `anc-${provider}-checkout-order-${orderId}`;
}

export async function createOrReusePaymentAttempt(db: DatabaseLike, input: AttemptInput) {
  const operation = input.operation ?? "checkout";
  const idempotencyKey = input.idempotencyKey ?? createPaymentIdempotencyKey(input.provider, input.orderId);
  const existing = await db
    .select()
    .from(paymentAttempts)
    .where(
      and(
        eq(paymentAttempts.businessId, input.businessId),
        eq(paymentAttempts.provider, input.provider),
        eq(paymentAttempts.operation, operation),
        eq(paymentAttempts.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);

  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(paymentAttempts)
    .values({
      businessId: input.businessId,
      orderId: input.orderId,
      provider: input.provider,
      operation,
      idempotencyKey,
      externalReference: input.orderNumber,
      amountCents: input.amountCents,
      currency: input.currency.toUpperCase(),
      state: "created",
      metadata: {},
    })
    .onConflictDoNothing({
      target: [
        paymentAttempts.businessId,
        paymentAttempts.provider,
        paymentAttempts.operation,
        paymentAttempts.idempotencyKey,
      ],
    })
    .returning();

  if (inserted[0]) return inserted[0];

  const concurrent = await db
    .select()
    .from(paymentAttempts)
    .where(
      and(
        eq(paymentAttempts.businessId, input.businessId),
        eq(paymentAttempts.provider, input.provider),
        eq(paymentAttempts.operation, operation),
        eq(paymentAttempts.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  if (!concurrent[0]) throw new Error("Unable to create or reuse payment attempt.");
  return concurrent[0];
}

export async function updatePaymentAttemptExternal(
  db: DatabaseLike,
  businessId: number,
  attemptId: number,
  input: { externalId: string; checkoutUrl?: string; state?: PaymentState; providerStatus?: string },
) {
  const result = await db
    .update(paymentAttempts)
    .set({
      externalId: input.externalId,
      checkoutUrl: input.checkoutUrl,
      state: input.state,
      providerStatus: input.providerStatus,
      updatedAt: new Date(),
    })
    .where(and(eq(paymentAttempts.id, attemptId), eq(paymentAttempts.businessId, businessId)))
    .returning();
  return result[0] ?? null;
}

export function hashWebhookPayload(rawBody: string) {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 100).map(redactValue);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (/secret|token|authorization|client_secret|card|cvv|security_code|password/i.test(key)) {
      output[key] = "[redacted]";
    } else {
      output[key] = redactValue(nested);
    }
  }
  return output;
}

export function redactWebhookPayload(rawBody: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawBody);
    const redacted = redactValue(parsed);
    return redacted && typeof redacted === "object" && !Array.isArray(redacted)
      ? (redacted as Record<string, unknown>)
      : { value: redacted };
  } catch {
    return { invalidJson: true };
  }
}

export async function recordWebhookEvent(
  db: DatabaseLike,
  input: {
    businessId: number;
    provider: PaymentProvider;
    externalEventId: string;
    eventType: string;
    rawBody: string;
  },
) {
  const inserted = await db
    .insert(paymentWebhookEvents)
    .values({
      businessId: input.businessId,
      provider: input.provider,
      externalEventId: input.externalEventId,
      eventType: input.eventType,
      payloadHash: hashWebhookPayload(input.rawBody),
      payload: redactWebhookPayload(input.rawBody),
      status: "received",
      attemptCount: 0,
    })
    .onConflictDoNothing({
      target: [
        paymentWebhookEvents.businessId,
        paymentWebhookEvents.provider,
        paymentWebhookEvents.externalEventId,
      ],
    })
    .returning();

  if (inserted[0]) return { isNew: true, event: inserted[0] } as const;

  const existing = await db
    .select()
    .from(paymentWebhookEvents)
    .where(
      and(
        eq(paymentWebhookEvents.businessId, input.businessId),
        eq(paymentWebhookEvents.provider, input.provider),
        eq(paymentWebhookEvents.externalEventId, input.externalEventId),
      ),
    )
    .limit(1);
  if (!existing[0]) throw new Error("Unable to record or reuse webhook event.");
  return { isNew: false, event: existing[0] } as const;
}

export async function applyNormalizedPaymentEvent(
  db: DatabaseLike,
  input: { businessId: number; event: NormalizedWebhookEvent },
) {
  const providerIds = [input.event.externalPaymentId, input.event.externalOrderId].filter(
    (value): value is string => Boolean(value),
  );
  if (providerIds.length === 0 && !input.event.externalReference) {
    return { matched: false as const, reason: "missing_reference" as const };
  }

  let current;
  for (const externalId of providerIds) {
    const exact = await db
      .select()
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.businessId, input.businessId),
          eq(paymentAttempts.provider, input.event.provider),
          eq(paymentAttempts.externalId, externalId),
        ),
      )
      .limit(1);
    if (exact[0]) {
      current = exact[0];
      break;
    }
  }

  if (!current && input.event.externalReference) {
    const byReference = await db
      .select()
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.businessId, input.businessId),
          eq(paymentAttempts.provider, input.event.provider),
          eq(paymentAttempts.externalReference, input.event.externalReference),
        ),
      )
      .orderBy(paymentAttempts.createdAt)
      .limit(1);
    current = byReference[0];
  }
  if (!current) return { matched: false as const, reason: "attempt_not_found" as const };

  const nextState = input.event.state;
  assertPaymentStateTransition(current.state, nextState);
  const updatedAttempt = await db
    .update(paymentAttempts)
    .set({
      state: nextState,
      providerStatus: input.event.providerStatus,
      failureCode: input.event.failureCode,
      failureMessage: input.event.failureMessage,
      externalId: input.event.externalPaymentId ?? current.externalId,
      updatedAt: new Date(),
    })
    .where(and(eq(paymentAttempts.id, current.id), eq(paymentAttempts.businessId, input.businessId)))
    .returning();

  const paymentStatus =
    nextState === "approved"
      ? "paid"
      : nextState === "refunded" || nextState === "partially_refunded"
        ? nextState
        : nextState === "failed" || nextState === "cancelled" || nextState === "expired"
          ? nextState
          : "pending";

  await db
    .update(orders)
    .set({ paymentStatus, updatedAt: new Date() })
    .where(and(eq(orders.id, current.orderId), eq(orders.businessId, input.businessId)));

  await db.insert(auditEvents).values({
    businessId: input.businessId,
    action: `payments.${nextState}`,
    entityType: "payment_attempt",
    entityId: String(current.id),
    metadata: {
      provider: input.event.provider,
      externalEventId: input.event.externalEventId,
      eventType: input.event.eventType,
      providerStatus: input.event.providerStatus,
    },
  });

  return { matched: true as const, attempt: updatedAttempt[0] ?? current, orderId: current.orderId };
}

export async function markWebhookEvent(
  db: DatabaseLike,
  businessId: number,
  eventId: number,
  status: "processed" | "failed" | "ignored",
  error?: string,
) {
  const result = await db
    .update(paymentWebhookEvents)
    .set({
      status,
      lastError: error,
      attemptCount: 1,
      processedAt: status === "processed" || status === "ignored" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(paymentWebhookEvents.id, eventId), eq(paymentWebhookEvents.businessId, businessId)))
    .returning();
  return result[0] ?? null;
}


import { paymentProviderAccounts } from "../../drizzle/schema";
import { decryptPaymentSecret, encryptPaymentSecret } from "../../server/services/paymentSecrets";
import type { ProviderCredentials } from "./providers";

export async function upsertProviderCredentials(
  db: DatabaseLike,
  businessId: number,
  provider: PaymentProvider,
  input: { accessToken: string; webhookSecret: string; publicKey?: string },
) {
  const values = {
    businessId,
    provider,
    status: "active",
    publicKey: input.publicKey,
    encryptedAccessToken: encryptPaymentSecret(input.accessToken),
    encryptedWebhookSecret: encryptPaymentSecret(input.webhookSecret),
    metadata: {},
    updatedAt: new Date(),
  };

  const result = await db
    .insert(paymentProviderAccounts)
    .values(values)
    .onConflictDoUpdate({
      target: [paymentProviderAccounts.businessId, paymentProviderAccounts.provider],
      set: values,
    })
    .returning({ id: paymentProviderAccounts.id, provider: paymentProviderAccounts.provider });
  return result[0];
}

function getGlobalCredentials(provider: PaymentProvider): ProviderCredentials | null {
  const accessToken =
    provider === "stripe" ? process.env.STRIPE_SECRET_KEY?.trim() : process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  const webhookSecret =
    provider === "stripe"
      ? process.env.STRIPE_WEBHOOK_SECRET?.trim()
      : process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (!accessToken || !webhookSecret) return null;
  return { accessToken, webhookSecret };
}

export async function resolveProviderCredentials(
  db: DatabaseLike,
  businessId: number,
  provider: PaymentProvider,
): Promise<ProviderCredentials> {
  const configured = await db
    .select()
    .from(paymentProviderAccounts)
    .where(
      and(
        eq(paymentProviderAccounts.businessId, businessId),
        eq(paymentProviderAccounts.provider, provider),
        eq(paymentProviderAccounts.status, "active"),
      ),
    )
    .limit(1);
  const account = configured[0];
  if (account?.encryptedAccessToken && account.encryptedWebhookSecret) {
    return {
      accessToken: decryptPaymentSecret(account.encryptedAccessToken),
      webhookSecret: decryptPaymentSecret(account.encryptedWebhookSecret),
      publicKey: account.publicKey,
    };
  }

  const global = getGlobalCredentials(provider);
  if (global) return global;
  throw new Error(`No active ${provider} credentials configured for business ${businessId}.`);
}
