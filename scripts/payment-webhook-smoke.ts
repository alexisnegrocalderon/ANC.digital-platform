import "dotenv/config";
import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { orders, paymentAttempts, paymentWebhookEvents } from "../drizzle/schema";
import { getDb } from "../server/db";

const db = getDb();
if (!db) throw new Error("DATABASE_URL is not configured.");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "test-webhook-secret";
const businessId = 1;
const order = (
  await db.select().from(orders).where(eq(orders.businessId, businessId)).limit(1)
)[0];
if (!order) throw new Error("Smoke test requires the demo order seeded in Neon.");

const stamp = Date.now();
const externalPaymentId = `pi_webhook_smoke_${stamp}`;
const eventId = `evt_webhook_smoke_${stamp}`;
await db.insert(paymentAttempts).values({
  businessId,
  orderId: order.id,
  provider: "stripe",
  operation: "checkout",
  idempotencyKey: `smoke-${stamp}`,
  externalId: externalPaymentId,
  externalReference: order.orderNumber,
  amountCents: order.totalCents,
  currency: order.currency,
  state: "pending",
  providerStatus: "open",
  metadata: { smoke: true },
});

const body = JSON.stringify({
  id: eventId,
  type: "checkout.session.completed",
  data: {
    object: {
      id: `cs_webhook_smoke_${stamp}`,
      client_reference_id: order.orderNumber,
      payment_intent: externalPaymentId,
      payment_status: "paid",
      status: "complete",
      metadata: { order_id: String(order.id), order_number: order.orderNumber },
    },
  },
});
const timestamp = Math.floor(Date.now() / 1000);
const signature = createHmac("sha256", webhookSecret)
  .update(`${timestamp}.${body}`, "utf8")
  .digest("hex");
const headers = {
  "content-type": "application/json",
  "stripe-signature": `t=${timestamp},v1=${signature}`,
};

const first = await fetch(`http://127.0.0.1:${process.env.SMOKE_PORT ?? "3011"}/api/payments/webhooks/stripe/anc-demo`, {
  method: "POST",
  headers,
  body,
});
const firstPayload = await first.json();
if (first.status !== 200 || firstPayload.received !== true) {
  throw new Error(`First webhook failed: ${first.status} ${JSON.stringify(firstPayload)}`);
}

let webhookStatus = "";
for (let attempt = 0; attempt < 20; attempt += 1) {
  const event = (
    await db
      .select()
      .from(paymentWebhookEvents)
      .where(
        and(
          eq(paymentWebhookEvents.businessId, businessId),
          eq(paymentWebhookEvents.provider, "stripe"),
          eq(paymentWebhookEvents.externalEventId, eventId),
        ),
      )
      .limit(1)
  )[0];
  webhookStatus = event?.status ?? "";
  if (webhookStatus === "processed") break;
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (webhookStatus !== "processed") throw new Error(`Webhook was not processed: ${webhookStatus}`);

const second = await fetch(`http://127.0.0.1:${process.env.SMOKE_PORT ?? "3011"}/api/payments/webhooks/stripe/anc-demo`, {
  method: "POST",
  headers,
  body,
});
const secondPayload = await second.json();
if (second.status !== 200 || secondPayload.duplicate !== true) {
  throw new Error(`Duplicate webhook was not acknowledged: ${second.status} ${JSON.stringify(secondPayload)}`);
}

const updatedOrder = (
  await db.select().from(orders).where(eq(orders.id, order.id)).limit(1)
)[0];
if (updatedOrder?.paymentStatus !== "paid") {
  throw new Error(`Order was not marked paid: ${updatedOrder?.paymentStatus}`);
}

console.log(JSON.stringify({ ok: true, firstStatus: first.status, duplicateStatus: second.status, webhookStatus, paymentStatus: updatedOrder.paymentStatus }, null, 2));
