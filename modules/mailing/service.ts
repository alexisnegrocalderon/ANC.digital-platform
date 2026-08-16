import { Resend } from "resend";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { notificationOutbox } from "../../drizzle/schema";

type Database = any;
const MAX_ATTEMPTS = 5;

function retryAt(attemptCount: number) {
  const delayMinutes = Math.min(60, 2 ** Math.max(0, attemptCount - 1));
  return new Date(Date.now() + delayMinutes * 60_000);
}

export type QueueEmailInput = {
  entityType: string;
  entityId?: string;
  eventType: string;
  recipient: string;
  subject: string;
  templateName: string;
  payload?: Record<string, unknown>;
  idempotencyKey: string;
  scheduledAt?: Date;
};

export async function queueEmail(db: Database, businessId: number, input: QueueEmailInput) {
  const scheduledAt = input.scheduledAt ?? new Date();
  const [row] = await db
    .insert(notificationOutbox)
    .values({
      businessId,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      channel: "email",
      eventType: input.eventType,
      recipient: input.recipient.trim().toLowerCase(),
      subject: input.subject.trim(),
      templateName: input.templateName,
      payload: input.payload ?? {},
      idempotencyKey: input.idempotencyKey,
      scheduledAt,
      nextAttemptAt: scheduledAt,
      status: "queued",
    })
    .onConflictDoNothing({ target: [notificationOutbox.businessId, notificationOutbox.idempotencyKey] })
    .returning();
  if (row) return row;
  const [existing] = await db
    .select()
    .from(notificationOutbox)
    .where(and(eq(notificationOutbox.businessId, businessId), eq(notificationOutbox.idempotencyKey, input.idempotencyKey)))
    .limit(1);
  return existing ?? null;
}

export async function listEmailOutbox(db: Database, businessId: number, limit = 50) {
  return db
    .select()
    .from(notificationOutbox)
    .where(and(eq(notificationOutbox.businessId, businessId), eq(notificationOutbox.channel, "email")))
    .orderBy(asc(notificationOutbox.createdAt))
    .limit(Math.min(100, Math.max(1, limit)));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function payloadRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function configuredResend() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function configuredFromAddress() {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) throw new Error("RESEND_FROM_EMAIL is required when Resend is enabled.");
  if (process.env.NODE_ENV === "production" && from.toLowerCase().includes("@resend.dev")) {
    throw new Error("RESEND_FROM_EMAIL must use a verified client domain in production.");
  }
  return from;
}

async function sendEmailThroughConfiguredProvider(row: typeof notificationOutbox.$inferSelect): Promise<{ providerMessageId: string }> {
  const resend = configuredResend();
  if (!resend) throw new Error("No active email provider configured for this business.");

  const from = configuredFromAddress();
  const payload = payloadRecord(row.payload);
  const plainText = typeof payload.text === "string" ? payload.text : `Notificación ${row.eventType}: ${row.subject}`;
  const html = typeof payload.html === "string"
    ? payload.html
    : `<p>${escapeHtml(plainText).replace(/\n/g, "<br />")}</p>`;
  const idempotencyKey = `email/${row.businessId}/${row.id}/${row.idempotencyKey}`.slice(0, 256);
  const { data, error } = await resend.emails.send({
    from,
    to: [row.recipient],
    subject: row.subject,
    html,
    text: plainText,
  }, { idempotencyKey });

  if (error) throw new Error(`Resend email delivery failed: ${error.message}`);
  if (!data?.id) throw new Error("Resend did not return a provider message id.");
  return { providerMessageId: data.id };
}

function isManualEmailConfigurationError(message: string) {
  return /No active email provider configured|RESEND_(API_KEY|FROM_EMAIL)|verified client domain|domain|sender|from address/i.test(message);
}

export async function processDueEmailNotifications(db: Database, limit = 20) {
  const due = await db
    .select()
    .from(notificationOutbox)
    .where(and(inArray(notificationOutbox.status, ["queued", "retrying"]), lte(notificationOutbox.nextAttemptAt, new Date()), eq(notificationOutbox.channel, "email")))
    .orderBy(asc(notificationOutbox.nextAttemptAt))
    .limit(Math.min(100, Math.max(1, limit)));

  const results: Array<{ id: number; status: string; error?: string }> = [];
  for (const notification of due) {
    const [claimed] = await db
      .update(notificationOutbox)
      .set({ status: "processing", attemptCount: sql`${notificationOutbox.attemptCount} + 1`, updatedAt: new Date() })
      .where(and(eq(notificationOutbox.id, notification.id), inArray(notificationOutbox.status, ["queued", "retrying"]), lte(notificationOutbox.nextAttemptAt, new Date())))
      .returning();
    if (!claimed) continue;
    try {
      const result = await sendEmailThroughConfiguredProvider(claimed);
      await db.update(notificationOutbox).set({ status: "sent", providerMessageId: result.providerMessageId, sentAt: new Date(), nextAttemptAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(notificationOutbox.id, claimed.id));
      results.push({ id: claimed.id, status: "sent" });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown email delivery error";
      const nextStatus = isManualEmailConfigurationError(message) ? "manual_required" : claimed.attemptCount >= MAX_ATTEMPTS ? "failed" : "retrying";
      await db.update(notificationOutbox).set({ status: nextStatus, lastError: message, nextAttemptAt: nextStatus === "retrying" ? retryAt(claimed.attemptCount) : new Date(), updatedAt: new Date() }).where(eq(notificationOutbox.id, claimed.id));
      results.push({ id: claimed.id, status: nextStatus, error: message });
    }
  }
  return results;
}
