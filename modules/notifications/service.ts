import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { appointmentNotifications } from "../../drizzle/schema";
import type { DatabaseLike } from "../bookings/service";
import { resolveWhatsAppCredentials, sendWhatsAppTemplate } from "./whatsapp";

const MAX_ATTEMPTS = 5;

function retryAt(attemptCount: number) {
  const delayMinutes = Math.min(60, 2 ** Math.max(0, attemptCount - 1));
  return new Date(Date.now() + delayMinutes * 60_000);
}

export async function processDueAppointmentNotifications(db: DatabaseLike, limit = 20) {
  const due = await db
    .select()
    .from(appointmentNotifications)
    .where(
      and(
        inArray(appointmentNotifications.status, ["queued", "retrying"]),
        lte(appointmentNotifications.nextAttemptAt, new Date()),
      ),
    )
    .orderBy(asc(appointmentNotifications.nextAttemptAt))
    .limit(Math.min(100, Math.max(1, limit)));

  const results: Array<{ id: number; status: string; error?: string }> = [];
  for (const notification of due) {
    const claimed = await db
      .update(appointmentNotifications)
      .set({
        status: "processing",
        attemptCount: sql`${appointmentNotifications.attemptCount} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(appointmentNotifications.id, notification.id),
          inArray(appointmentNotifications.status, ["queued", "retrying"]),
          lte(appointmentNotifications.nextAttemptAt, new Date()),
        ),
      )
      .returning();
    const row = claimed[0];
    if (!row) continue;

    try {
      const credentials = await resolveWhatsAppCredentials(db, row.businessId);
      const configuredTemplate = credentials.templates[row.eventType] ?? row.templateName;
      if (!configuredTemplate) {
        throw new Error(`No WhatsApp template configured for ${row.eventType}.`);
      }
      const result = await sendWhatsAppTemplate(credentials, {
        to: row.recipient,
        templateName: configuredTemplate,
        language: row.templateLanguage || credentials.defaultLanguage,
        params: row.templateParams,
      });
      await db
        .update(appointmentNotifications)
        .set({
          status: "sent",
          providerMessageId: result.providerMessageId,
          sentAt: new Date(),
          nextAttemptAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(appointmentNotifications.id, row.id));
      results.push({ id: row.id, status: "sent" });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown WhatsApp delivery error";
      const requiresConfiguration = /No active WhatsApp account configured|No WhatsApp template configured/i.test(message);
      const nextStatus = requiresConfiguration
        ? "manual_required"
        : row.attemptCount >= MAX_ATTEMPTS
          ? "failed"
          : "retrying";
      await db
        .update(appointmentNotifications)
        .set({
          status: nextStatus,
          lastError: message,
          nextAttemptAt: nextStatus === "retrying" ? retryAt(row.attemptCount) : new Date(),
          updatedAt: new Date(),
        })
        .where(eq(appointmentNotifications.id, row.id));
      results.push({ id: row.id, status: nextStatus, error: message });
    }
  }
  return results;
}

export async function updateWhatsAppDeliveryStatuses(
  db: DatabaseLike,
  statuses: Array<{ providerMessageId: string; status: string; errors?: unknown }>,
) {
  const results = [];
  for (const status of statuses) {
    const nextStatus =
      status.status === "delivered"
        ? "delivered"
        : status.status === "read"
          ? "read"
          : status.status === "failed"
            ? "failed"
            : status.status === "sent"
              ? "sent"
              : "sent";
    const updated = await db
      .update(appointmentNotifications)
      .set({
        status: nextStatus,
        lastError: status.errors ? JSON.stringify(status.errors).slice(0, 500) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(appointmentNotifications.providerMessageId, status.providerMessageId))
      .returning({ id: appointmentNotifications.id, status: appointmentNotifications.status });
    results.push(...updated);
  }
  return results;
}
