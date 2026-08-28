import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  agencyAgreements,
  agencyInstallments,
  agencySubscriptions,
  businesses,
  paymentWebhookEvents,
} from "../drizzle/schema";
import { getDb } from "../server/db";

// This smoke test requires:
//  - DATABASE_URL pointing at a real (test) Neon database with the agency billing migration applied,
//  - a running server (see SMOKE_PORT below) with MERCADOPAGO_ACCESS_TOKEN / MERCADOPAGO_WEBHOOK_SECRET
//    configured (or a payment_provider_accounts row for the demo business) pointing at a Mercado Pago
//    sandbox account that actually has the `authorized_payments/{id}` resource used below,
//  - network access to https://api.mercadopago.com from the running server process.
// It mirrors scripts/payment-webhook-smoke.ts, but the Mercado Pago subscription webhook only carries a
// resource id, so the server always fetches the authoritative resource from Mercado Pago before
// reconciling — unlike the single-checkout Stripe smoke test, this cannot be fully self-contained.

const db = getDb();
if (!db) throw new Error("DATABASE_URL is not configured.");

const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "test-webhook-secret";
const businessSlug = process.env.SMOKE_BUSINESS_SLUG ?? "anc-demo";

const business = (
  await db.select().from(businesses).where(eq(businesses.slug, businessSlug)).limit(1)
)[0];
if (!business) throw new Error(`Smoke test requires business "${businessSlug}" to be seeded.`);

const stamp = Date.now();
const [agreement] = await db
  .insert(agencyAgreements)
  .values({
    businessId: business.id,
    title: `Smoke agreement ${stamp}`,
    status: "active",
    collectionMode: "mp_subscription",
    currency: "CLP",
    totalAmountCents: 100_000,
  })
  .returning();

const [installment] = await db
  .insert(agencyInstallments)
  .values({
    businessId: business.id,
    agreementId: agreement.id,
    sequence: 1,
    dueDate: new Date().toISOString().slice(0, 10),
    amountCents: 100_000,
    currency: "CLP",
    status: "scheduled",
  })
  .returning();

const externalPreapprovalId = `smoke-preapproval-${stamp}`;
await db.insert(agencySubscriptions).values({
  businessId: business.id,
  agreementId: agreement.id,
  provider: "mercadopago",
  externalPreapprovalId,
  status: "authorized",
  payerEmail: "smoke@example.test",
  frequencyType: "months",
  frequency: 1,
  amountCents: 100_000,
  currency: "CLP",
});

const authorizedPaymentId = `smoke-authorized-payment-${stamp}`;
const body = JSON.stringify({
  id: randomUUID(),
  type: "subscription_authorized_payment",
  data: { id: authorizedPaymentId },
});

const requestId = `req-${stamp}`;
const timestamp = Math.floor(Date.now() / 1000);
const manifest = `id:${authorizedPaymentId};request-id:${requestId};ts:${timestamp};`;
const signature = createHmac("sha256", webhookSecret).update(manifest).digest("hex");
const headers = {
  "content-type": "application/json",
  "x-signature": `ts=${timestamp},v1=${signature}`,
  "x-request-id": requestId,
};

const url = `http://127.0.0.1:${process.env.SMOKE_PORT ?? "3011"}/api/payments/webhooks/mercadopago-subscription/${businessSlug}`;
const first = await fetch(url, { method: "POST", headers, body });
const firstPayload = await first.json();
if (first.status !== 200 || firstPayload.received !== true) {
  throw new Error(`First webhook failed: ${first.status} ${JSON.stringify(firstPayload)}`);
}

let eventStatus = "";
for (let attempt = 0; attempt < 20; attempt += 1) {
  const event = (
    await db
      .select()
      .from(paymentWebhookEvents)
      .where(
        and(
          eq(paymentWebhookEvents.businessId, business.id),
          eq(paymentWebhookEvents.provider, "mercadopago"),
        ),
      )
      .orderBy(paymentWebhookEvents.createdAt)
  ).at(-1);
  eventStatus = event?.status ?? "";
  if (eventStatus === "processed") break;
  await new Promise((resolve) => setTimeout(resolve, 150));
}
if (eventStatus !== "processed") throw new Error(`Webhook was not processed: ${eventStatus}`);

const second = await fetch(url, { method: "POST", headers, body });
const secondPayload = await second.json();
if (second.status !== 200 || secondPayload.duplicate !== true) {
  throw new Error(`Duplicate webhook was not acknowledged: ${second.status} ${JSON.stringify(secondPayload)}`);
}

const updatedInstallment = (
  await db.select().from(agencyInstallments).where(eq(agencyInstallments.id, installment.id)).limit(1)
)[0];
if (updatedInstallment?.status !== "paid") {
  throw new Error(`Installment was not marked paid: ${updatedInstallment?.status}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      firstStatus: first.status,
      duplicateStatus: second.status,
      eventStatus,
      installmentStatus: updatedInstallment.status,
    },
    null,
    2,
  ),
);
