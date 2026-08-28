import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  agencyAgreements,
  agencyInstallments,
  agencySubscriptions,
  auditEvents,
  businesses,
  memberships,
  orders,
  users,
} from "../../drizzle/schema";
import {
  createOrReusePaymentAttempt,
  resolveProviderCredentials,
  updatePaymentAttemptExternal,
} from "../payments/service";
import { getPaymentAdapter } from "../payments/providers";
import type { PaymentProvider } from "../../shared/payment";
import { queueEmail } from "../mailing/service";
import { buildInstallmentReminderEmail } from "./emailTemplates";
import { cancelPreapproval, createPreapproval } from "./mpSubscriptionAdapter";

export type DatabaseLike = any;

export const AGENCY_AGREEMENT_STATUSES = ["active", "completed", "cancelled"] as const;
export type AgencyAgreementStatus = (typeof AGENCY_AGREEMENT_STATUSES)[number];

export const AGENCY_COLLECTION_MODES = ["manual_link", "mp_subscription"] as const;
export type AgencyCollectionMode = (typeof AGENCY_COLLECTION_MODES)[number];

export const AGENCY_INSTALLMENT_STATUSES = [
  "scheduled",
  "reminder_sent",
  "overdue",
  "paid",
  "waived",
  "cancelled",
] as const;
export type AgencyInstallmentStatus = (typeof AGENCY_INSTALLMENT_STATUSES)[number];

/** Reminder offsets relative to the due date: negative = days before, 0 = due day, positive = days overdue. */
export const REMINDER_OFFSET_DAYS = [-7, -1, 0, 1, 3] as const;

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysToDateStr(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function logAudit(
  db: DatabaseLike,
  input: {
    businessId: number;
    actorUserId?: number | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  },
) {
  await db.insert(auditEvents).values({
    businessId: input.businessId,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? {},
  });
}

// ---------------------------------------------------------------------------
// Agreements
// ---------------------------------------------------------------------------

export async function listAgreements(db: DatabaseLike, businessId?: number) {
  const conditions = businessId ? [eq(agencyAgreements.businessId, businessId)] : [];
  return db
    .select({
      agreement: agencyAgreements,
      businessName: businesses.name,
      businessSlug: businesses.slug,
    })
    .from(agencyAgreements)
    .innerJoin(businesses, eq(businesses.id, agencyAgreements.businessId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(agencyAgreements.createdAt));
}

export async function getAgreement(db: DatabaseLike, agreementId: number) {
  const [agreement] = await db
    .select()
    .from(agencyAgreements)
    .where(eq(agencyAgreements.id, agreementId))
    .limit(1);
  if (!agreement) return null;

  const installments = await db
    .select()
    .from(agencyInstallments)
    .where(eq(agencyInstallments.agreementId, agreementId))
    .orderBy(asc(agencyInstallments.sequence));

  const subscriptions = await db
    .select()
    .from(agencySubscriptions)
    .where(eq(agencySubscriptions.agreementId, agreementId))
    .orderBy(desc(agencySubscriptions.createdAt));

  return { agreement, installments, subscriptions };
}

export async function createAgreement(
  db: DatabaseLike,
  input: {
    businessId: number;
    title: string;
    collectionMode?: AgencyCollectionMode;
    currency?: string;
    notes?: string;
    installments?: Array<{ dueDate: string; amountCents: number }>;
    actorUserId?: number | null;
  },
) {
  const currency = (input.currency ?? "CLP").toUpperCase();
  const totalAmountCents = (input.installments ?? []).reduce((sum, item) => sum + item.amountCents, 0);

  const [agreement] = await db
    .insert(agencyAgreements)
    .values({
      businessId: input.businessId,
      title: input.title,
      status: "active",
      collectionMode: input.collectionMode ?? "manual_link",
      currency,
      totalAmountCents,
      notes: input.notes,
    })
    .returning();

  const installments = [];
  let sequence = 1;
  for (const item of input.installments ?? []) {
    const [row] = await db
      .insert(agencyInstallments)
      .values({
        businessId: input.businessId,
        agreementId: agreement.id,
        sequence,
        dueDate: item.dueDate,
        amountCents: item.amountCents,
        currency,
        status: "scheduled",
      })
      .returning();
    installments.push(row);
    sequence += 1;
  }

  await logAudit(db, {
    businessId: input.businessId,
    actorUserId: input.actorUserId,
    action: "agency_agreement.created",
    entityType: "agency_agreement",
    entityId: String(agreement.id),
    metadata: {
      title: agreement.title,
      collectionMode: agreement.collectionMode,
      installmentCount: installments.length,
    },
  });

  return { agreement, installments };
}

export async function setCollectionMode(
  db: DatabaseLike,
  input: { agreementId: number; collectionMode: AgencyCollectionMode; actorUserId?: number | null },
) {
  const [existing] = await db
    .select()
    .from(agencyAgreements)
    .where(eq(agencyAgreements.id, input.agreementId))
    .limit(1);
  if (!existing) throw new Error("Agreement not found.");

  const [updated] = await db
    .update(agencyAgreements)
    .set({ collectionMode: input.collectionMode, updatedAt: new Date() })
    .where(eq(agencyAgreements.id, input.agreementId))
    .returning();

  await logAudit(db, {
    businessId: existing.businessId,
    actorUserId: input.actorUserId,
    action: "agency_agreement.collection_mode_changed",
    entityType: "agency_agreement",
    entityId: String(existing.id),
    metadata: { from: existing.collectionMode, to: input.collectionMode },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Installments
// ---------------------------------------------------------------------------

export async function addInstallment(
  db: DatabaseLike,
  input: {
    agreementId: number;
    dueDate: string;
    amountCents: number;
    sequence?: number;
    actorUserId?: number | null;
  },
) {
  const [agreement] = await db
    .select()
    .from(agencyAgreements)
    .where(eq(agencyAgreements.id, input.agreementId))
    .limit(1);
  if (!agreement) throw new Error("Agreement not found.");

  let sequence = input.sequence;
  if (!sequence) {
    const existing = await db
      .select({ sequence: agencyInstallments.sequence })
      .from(agencyInstallments)
      .where(eq(agencyInstallments.agreementId, input.agreementId));
    sequence = existing.reduce((max: number, row: { sequence: number }) => Math.max(max, row.sequence), 0) + 1;
  }

  const [installment] = await db
    .insert(agencyInstallments)
    .values({
      businessId: agreement.businessId,
      agreementId: input.agreementId,
      sequence,
      dueDate: input.dueDate,
      amountCents: input.amountCents,
      currency: agreement.currency,
      status: "scheduled",
      lastEditedByUserId: input.actorUserId ?? null,
    })
    .returning();

  await logAudit(db, {
    businessId: agreement.businessId,
    actorUserId: input.actorUserId,
    action: "agency_installment.created",
    entityType: "agency_installment",
    entityId: String(installment.id),
    metadata: { dueDate: installment.dueDate, amountCents: installment.amountCents },
  });

  return installment;
}

export async function updateInstallment(
  db: DatabaseLike,
  input: {
    installmentId: number;
    dueDate?: string;
    amountCents?: number;
    paymentMethodNote?: string;
    actorUserId?: number | null;
  },
) {
  const [existing] = await db
    .select()
    .from(agencyInstallments)
    .where(eq(agencyInstallments.id, input.installmentId))
    .limit(1);
  if (!existing) throw new Error("Installment not found.");

  const patch: Record<string, unknown> = { updatedAt: new Date(), lastEditedByUserId: input.actorUserId ?? null };
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate;
  if (input.amountCents !== undefined) patch.amountCents = input.amountCents;
  if (input.paymentMethodNote !== undefined) patch.paymentMethodNote = input.paymentMethodNote;
  // A manual date/amount edit on an already-reminded or overdue installment restarts the reminder cadence.
  if (
    (existing.status === "reminder_sent" || existing.status === "overdue") &&
    (input.dueDate !== undefined || input.amountCents !== undefined)
  ) {
    patch.status = "scheduled";
  }

  const [updated] = await db
    .update(agencyInstallments)
    .set(patch)
    .where(eq(agencyInstallments.id, input.installmentId))
    .returning();

  await logAudit(db, {
    businessId: existing.businessId,
    actorUserId: input.actorUserId,
    action: "agency_installment.updated",
    entityType: "agency_installment",
    entityId: String(existing.id),
    metadata: {
      before: { dueDate: existing.dueDate, amountCents: existing.amountCents, status: existing.status },
      after: { dueDate: updated.dueDate, amountCents: updated.amountCents, status: updated.status },
    },
  });

  return updated;
}

export async function markInstallmentPaid(
  db: DatabaseLike,
  input: {
    installmentId: number;
    paidAmountCents?: number;
    paidAt?: Date;
    paymentMethodNote?: string;
    actorUserId?: number | null;
  },
) {
  const [existing] = await db
    .select()
    .from(agencyInstallments)
    .where(eq(agencyInstallments.id, input.installmentId))
    .limit(1);
  if (!existing) throw new Error("Installment not found.");

  const [updated] = await db
    .update(agencyInstallments)
    .set({
      status: "paid",
      paidAt: input.paidAt ?? new Date(),
      paidAmountCents: input.paidAmountCents ?? existing.amountCents,
      paymentMethodNote: input.paymentMethodNote ?? existing.paymentMethodNote,
      lastEditedByUserId: input.actorUserId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(agencyInstallments.id, input.installmentId))
    .returning();

  await logAudit(db, {
    businessId: existing.businessId,
    actorUserId: input.actorUserId,
    action: "agency_installment.marked_paid",
    entityType: "agency_installment",
    entityId: String(existing.id),
    metadata: { paidAmountCents: updated.paidAmountCents },
  });

  return updated;
}

export async function waiveInstallment(
  db: DatabaseLike,
  input: { installmentId: number; actorUserId?: number | null },
) {
  const [existing] = await db
    .select()
    .from(agencyInstallments)
    .where(eq(agencyInstallments.id, input.installmentId))
    .limit(1);
  if (!existing) throw new Error("Installment not found.");

  const [updated] = await db
    .update(agencyInstallments)
    .set({ status: "waived", lastEditedByUserId: input.actorUserId ?? null, updatedAt: new Date() })
    .where(eq(agencyInstallments.id, input.installmentId))
    .returning();

  await logAudit(db, {
    businessId: existing.businessId,
    actorUserId: input.actorUserId,
    action: "agency_installment.waived",
    entityType: "agency_installment",
    entityId: String(existing.id),
  });

  return updated;
}

export async function deleteInstallment(
  db: DatabaseLike,
  input: { installmentId: number; actorUserId?: number | null },
) {
  const [existing] = await db
    .select()
    .from(agencyInstallments)
    .where(eq(agencyInstallments.id, input.installmentId))
    .limit(1);
  if (!existing) throw new Error("Installment not found.");

  await db.delete(agencyInstallments).where(eq(agencyInstallments.id, input.installmentId));

  await logAudit(db, {
    businessId: existing.businessId,
    actorUserId: input.actorUserId,
    action: "agency_installment.deleted",
    entityType: "agency_installment",
    entityId: String(existing.id),
  });

  return { deleted: true as const, id: existing.id };
}

// ---------------------------------------------------------------------------
// Billing contact resolution (used for reminder recipients and order emails)
// ---------------------------------------------------------------------------

export async function resolveBillingContactEmail(db: DatabaseLike, businessId: number): Promise<string | null> {
  const rows = await db
    .select({ email: users.email, roleKey: memberships.roleKey })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.businessId, businessId), eq(memberships.status, "active")))
    .orderBy(asc(memberships.id));

  const owner = rows.find((row: { roleKey: string; email: string | null }) => row.roleKey === "owner" && row.email);
  if (owner?.email) return owner.email;
  const anyWithEmail = rows.find((row: { email: string | null }) => row.email);
  return anyWithEmail?.email ?? null;
}

// ---------------------------------------------------------------------------
// Manual payment links (reuses modules/payments checkout logic via a synthetic order)
// ---------------------------------------------------------------------------

function syntheticOrderNumber(businessId: number, installmentId: number) {
  return `AGENCY-${businessId}-${installmentId}`;
}

async function getOrCreateSyntheticOrder(
  db: DatabaseLike,
  input: { businessId: number; installmentId: number; amountCents: number; currency: string; customerEmail: string },
) {
  const orderNumber = syntheticOrderNumber(input.businessId, input.installmentId);
  const existing = await db
    .select()
    .from(orders)
    .where(and(eq(orders.businessId, input.businessId), eq(orders.orderNumber, orderNumber)))
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(orders)
    .values({
      businessId: input.businessId,
      orderNumber,
      customerEmail: input.customerEmail,
      totalCents: input.amountCents,
      currency: input.currency,
      status: "pending",
      paymentStatus: "pending",
      source: "agency_billing",
    })
    .onConflictDoNothing({ target: [orders.businessId, orders.orderNumber] })
    .returning();
  if (inserted[0]) return inserted[0];

  const concurrent = await db
    .select()
    .from(orders)
    .where(and(eq(orders.businessId, input.businessId), eq(orders.orderNumber, orderNumber)))
    .limit(1);
  if (!concurrent[0]) throw new Error("Unable to create or reuse the synthetic agency order.");
  return concurrent[0];
}

export async function createInstallmentPaymentLink(
  db: DatabaseLike,
  input: {
    installmentId: number;
    provider: PaymentProvider;
    successUrl?: string;
    cancelUrl?: string;
  },
) {
  const [installment] = await db
    .select()
    .from(agencyInstallments)
    .where(eq(agencyInstallments.id, input.installmentId))
    .limit(1);
  if (!installment) throw new Error("Installment not found.");

  const [agreement] = await db
    .select()
    .from(agencyAgreements)
    .where(eq(agencyAgreements.id, installment.agreementId))
    .limit(1);
  if (!agreement) throw new Error("Agreement not found for installment.");

  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, installment.businessId))
    .limit(1);
  if (!business) throw new Error("Business not found for installment.");

  const customerEmail = await resolveBillingContactEmail(db, installment.businessId);
  if (!customerEmail) throw new Error("No billing contact email configured for this business.");

  const order = await getOrCreateSyntheticOrder(db, {
    businessId: installment.businessId,
    installmentId: installment.id,
    amountCents: installment.amountCents,
    currency: installment.currency,
    customerEmail,
  });

  const attempt = await createOrReusePaymentAttempt(db, {
    businessId: installment.businessId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    provider: input.provider,
    amountCents: installment.amountCents,
    currency: installment.currency,
  });

  if (!installment.paymentAttemptId) {
    await db
      .update(agencyInstallments)
      .set({ paymentAttemptId: attempt.id, updatedAt: new Date() })
      .where(eq(agencyInstallments.id, installment.id));
  }

  if (attempt.externalId && attempt.checkoutUrl) {
    return {
      attemptId: attempt.id,
      orderId: order.id,
      provider: attempt.provider,
      checkoutUrl: attempt.checkoutUrl,
      state: attempt.state,
      reused: true as const,
    };
  }

  const credentials = await resolveProviderCredentials(db, installment.businessId, input.provider);
  const adapter = getPaymentAdapter(input.provider);
  const result = await adapter.createCheckout(
    {
      businessId: installment.businessId,
      businessSlug: business.slug,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerEmail,
      amountCents: installment.amountCents,
      currency: installment.currency,
      items: [
        {
          title: `${agreement.title} — cuota #${installment.sequence}`,
          quantity: 1,
          unitPriceCents: installment.amountCents,
          currency: installment.currency,
        },
      ],
      successUrl: input.successUrl ?? "",
      cancelUrl: input.cancelUrl ?? "",
      idempotencyKey: attempt.idempotencyKey,
    },
    credentials,
  );

  const updated = await updatePaymentAttemptExternal(db, installment.businessId, attempt.id, {
    externalId: result.externalId,
    checkoutUrl: result.checkoutUrl,
    state: result.state,
    providerStatus: result.providerStatus,
  });

  return {
    attemptId: updated?.id ?? attempt.id,
    orderId: order.id,
    provider: result.provider,
    checkoutUrl: result.checkoutUrl,
    state: result.state,
    reused: false as const,
  };
}

// ---------------------------------------------------------------------------
// Reminders (scheduled/cron job)
// ---------------------------------------------------------------------------

function reminderIdempotencyKey(installmentId: number, offsetDays: number, dueDate: string) {
  return `agency-installment-${installmentId}-offset-${offsetDays}-due-${dueDate}`;
}

async function queueSingleInstallmentReminder(
  db: DatabaseLike,
  input: {
    installment: typeof agencyInstallments.$inferSelect;
    agreement: typeof agencyAgreements.$inferSelect;
    businessName: string;
    offsetDays: number;
    forced?: boolean;
  },
): Promise<{ installmentId: number; action: string; offsetDays?: number; error?: string }> {
  const { installment, agreement, businessName, offsetDays, forced } = input;
  try {
    const recipient = await resolveBillingContactEmail(db, installment.businessId);
    if (!recipient) {
      return { installmentId: installment.id, action: "skipped_no_recipient", offsetDays };
    }

    let paymentUrl: string | undefined;
    if (agreement.collectionMode === "manual_link") {
      try {
        const link = await createInstallmentPaymentLink(db, {
          installmentId: installment.id,
          provider: "mercadopago",
        });
        paymentUrl = link.checkoutUrl;
      } catch {
        // Payment provider might not be configured yet; still send the reminder without a link.
        paymentUrl = undefined;
      }
    }

    const email = buildInstallmentReminderEmail({
      businessName,
      installmentSequence: installment.sequence,
      dueDate: installment.dueDate,
      amountCents: installment.amountCents,
      currency: installment.currency,
      paymentUrl,
      offsetDays,
    });

    const idempotencyKey = forced
      ? `${reminderIdempotencyKey(installment.id, offsetDays, installment.dueDate)}-manual-${Date.now()}`
      : reminderIdempotencyKey(installment.id, offsetDays, installment.dueDate);

    await queueEmail(db, installment.businessId, {
      entityType: "agency_installment",
      entityId: String(installment.id),
      eventType: offsetDays > 0 ? "agency_installment.overdue_reminder" : "agency_installment.due_reminder",
      recipient,
      subject: email.subject,
      templateName: "agency-installment-reminder",
      payload: { html: email.html, text: email.text, offsetDays },
      idempotencyKey,
    });

    const nextStatus = offsetDays > 0 ? "overdue" : "reminder_sent";
    if (installment.status !== nextStatus) {
      await db
        .update(agencyInstallments)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(agencyInstallments.id, installment.id));
    }

    return { installmentId: installment.id, action: "reminder_queued", offsetDays };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown reminder error";
    return { installmentId: installment.id, action: "error", offsetDays, error: message };
  }
}

/**
 * Force-queue a reminder for one installment right now, regardless of whether it currently
 * falls inside a scheduled reminder window. Used by the "resend reminder" admin action, which
 * would otherwise silently no-op for an installment that isn't due today.
 */
export async function sendInstallmentReminderNow(db: DatabaseLike, installmentId: number) {
  const [row] = await db
    .select({
      installment: agencyInstallments,
      agreement: agencyAgreements,
      businessName: businesses.name,
    })
    .from(agencyInstallments)
    .innerJoin(agencyAgreements, eq(agencyAgreements.id, agencyInstallments.agreementId))
    .innerJoin(businesses, eq(businesses.id, agencyInstallments.businessId))
    .where(eq(agencyInstallments.id, installmentId))
    .limit(1);
  if (!row) throw new Error("Installment not found.");
  if (row.installment.status === "paid" || row.installment.status === "waived" || row.installment.status === "cancelled") {
    throw new Error(`Cannot send a reminder for an installment with status "${row.installment.status}".`);
  }

  const today = todayDateStr();
  const dueDate = new Date(`${row.installment.dueDate}T00:00:00.000Z`);
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const offsetDays = Math.round((todayDate.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));

  return queueSingleInstallmentReminder(db, {
    installment: row.installment,
    agreement: row.agreement,
    businessName: row.businessName,
    offsetDays,
    forced: true,
  });
}

export async function processDueInstallmentReminders(db: DatabaseLike, limit = 50) {
  const today = todayDateStr();
  const candidates = await db
    .select({
      installment: agencyInstallments,
      agreement: agencyAgreements,
      businessName: businesses.name,
    })
    .from(agencyInstallments)
    .innerJoin(agencyAgreements, eq(agencyAgreements.id, agencyInstallments.agreementId))
    .innerJoin(businesses, eq(businesses.id, agencyInstallments.businessId))
    .where(inArray(agencyInstallments.status, ["scheduled", "reminder_sent", "overdue"]))
    .orderBy(asc(agencyInstallments.dueDate))
    .limit(Math.min(200, Math.max(1, limit)));

  const results: Array<{ installmentId: number; action: string; offsetDays?: number; error?: string }> = [];

  for (const row of candidates) {
    const { installment, agreement, businessName } = row;
    const matchedOffset = REMINDER_OFFSET_DAYS.find(
      (offset) => addDaysToDateStr(installment.dueDate, offset) === today,
    );

    if (matchedOffset === undefined) {
      // Not within a reminder window today, but still catch installments that slipped past due
      // without ever hitting an exact window (e.g. job did not run on the exact day).
      if (installment.dueDate < today && installment.status !== "overdue") {
        await db
          .update(agencyInstallments)
          .set({ status: "overdue", updatedAt: new Date() })
          .where(eq(agencyInstallments.id, installment.id));
        results.push({ installmentId: installment.id, action: "marked_overdue" });
      }
      continue;
    }

    results.push(
      await queueSingleInstallmentReminder(db, { installment, agreement, businessName, offsetDays: matchedOffset }),
    );
  }

  return results;
}

// ---------------------------------------------------------------------------
// Mercado Pago subscriptions (preapprovals)
// ---------------------------------------------------------------------------

export async function createSubscription(
  db: DatabaseLike,
  input: {
    agreementId: number;
    payerEmail: string;
    frequencyType: "days" | "months";
    frequency: number;
    amountCents: number;
    currency?: string;
    startDate?: string;
    actorUserId?: number | null;
  },
) {
  const [agreement] = await db
    .select()
    .from(agencyAgreements)
    .where(eq(agencyAgreements.id, input.agreementId))
    .limit(1);
  if (!agreement) throw new Error("Agreement not found.");

  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, agreement.businessId))
    .limit(1);
  if (!business) throw new Error("Business not found for agreement.");

  const currency = (input.currency ?? agreement.currency ?? "CLP").toUpperCase();
  const credentials = await resolveProviderCredentials(db, agreement.businessId, "mercadopago");

  const preapproval = await createPreapproval(
    {
      reason: agreement.title,
      payerEmail: input.payerEmail,
      externalReference: `agency-agreement-${agreement.id}`,
      frequency: input.frequency,
      frequencyType: input.frequencyType,
      amountCents: input.amountCents,
      currency,
      businessSlug: business.slug,
      startDate: input.startDate,
    },
    credentials,
  );

  const [subscription] = await db
    .insert(agencySubscriptions)
    .values({
      businessId: agreement.businessId,
      agreementId: agreement.id,
      provider: "mercadopago",
      externalPreapprovalId: preapproval.externalPreapprovalId,
      status: preapproval.status,
      payerEmail: input.payerEmail,
      frequencyType: input.frequencyType,
      frequency: input.frequency,
      amountCents: input.amountCents,
      currency,
      startDate: input.startDate ?? null,
      metadata: preapproval.raw,
    })
    .returning();

  if (agreement.collectionMode !== "mp_subscription") {
    await db
      .update(agencyAgreements)
      .set({ collectionMode: "mp_subscription", updatedAt: new Date() })
      .where(eq(agencyAgreements.id, agreement.id));
  }

  await logAudit(db, {
    businessId: agreement.businessId,
    actorUserId: input.actorUserId,
    action: "agency_subscription.created",
    entityType: "agency_subscription",
    entityId: String(subscription.id),
    metadata: { externalPreapprovalId: subscription.externalPreapprovalId, status: subscription.status },
  });

  return subscription;
}

export async function cancelSubscription(
  db: DatabaseLike,
  input: { subscriptionId: number; actorUserId?: number | null },
) {
  const [existing] = await db
    .select()
    .from(agencySubscriptions)
    .where(eq(agencySubscriptions.id, input.subscriptionId))
    .limit(1);
  if (!existing) throw new Error("Subscription not found.");

  const credentials = await resolveProviderCredentials(db, existing.businessId, "mercadopago");
  await cancelPreapproval(existing.externalPreapprovalId, credentials);

  const [updated] = await db
    .update(agencySubscriptions)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(agencySubscriptions.id, input.subscriptionId))
    .returning();

  await logAudit(db, {
    businessId: existing.businessId,
    actorUserId: input.actorUserId,
    action: "agency_subscription.cancelled",
    entityType: "agency_subscription",
    entityId: String(existing.id),
  });

  return updated;
}

/**
 * Cancels the current preapproval and creates a fresh one with the same (or overridden) terms.
 * Manual installment edits never sync automatically to Mercado Pago — this explicit action is
 * the only way to change what an active subscription actually charges.
 */
export async function recreateSubscription(
  db: DatabaseLike,
  input: {
    subscriptionId: number;
    amountCents?: number;
    frequency?: number;
    frequencyType?: "days" | "months";
    actorUserId?: number | null;
  },
) {
  const [existing] = await db
    .select()
    .from(agencySubscriptions)
    .where(eq(agencySubscriptions.id, input.subscriptionId))
    .limit(1);
  if (!existing) throw new Error("Subscription not found.");

  await cancelSubscription(db, { subscriptionId: existing.id, actorUserId: input.actorUserId });

  const created = await createSubscription(db, {
    agreementId: existing.agreementId,
    payerEmail: existing.payerEmail ?? "",
    frequencyType: (input.frequencyType ?? existing.frequencyType) as "days" | "months",
    frequency: input.frequency ?? existing.frequency,
    amountCents: input.amountCents ?? existing.amountCents,
    currency: existing.currency,
    actorUserId: input.actorUserId,
  });

  await logAudit(db, {
    businessId: existing.businessId,
    actorUserId: input.actorUserId,
    action: "agency_subscription.recreated",
    entityType: "agency_subscription",
    entityId: String(created.id),
    metadata: { previousSubscriptionId: existing.id },
  });

  return created;
}

/**
 * Called from the Mercado Pago subscription webhook when an authorized_payment is approved.
 * Marks the next unpaid installment (by sequence) of the subscription's agreement as paid.
 * Idempotency for retries is handled by paymentWebhookEvents at the webhook layer, not here.
 */
export async function reconcileAuthorizedPayment(
  db: DatabaseLike,
  input: {
    externalPreapprovalId: string;
    amountCents: number;
    authorizedPaymentId: string;
  },
) {
  const [subscription] = await db
    .select()
    .from(agencySubscriptions)
    .where(eq(agencySubscriptions.externalPreapprovalId, input.externalPreapprovalId))
    .limit(1);
  if (!subscription) return { matched: false as const, reason: "subscription_not_found" as const };

  const [nextInstallment] = await db
    .select()
    .from(agencyInstallments)
    .where(
      and(
        eq(agencyInstallments.agreementId, subscription.agreementId),
        inArray(agencyInstallments.status, ["scheduled", "reminder_sent", "overdue"]),
      ),
    )
    .orderBy(asc(agencyInstallments.sequence))
    .limit(1);

  if (!nextInstallment) return { matched: false as const, reason: "no_unpaid_installment" as const };

  const [updated] = await db
    .update(agencyInstallments)
    .set({
      status: "paid",
      paidAt: new Date(),
      paidAmountCents: input.amountCents,
      paymentMethodNote: "mercadopago_subscription",
      mpPreapprovalId: input.externalPreapprovalId,
      updatedAt: new Date(),
    })
    .where(eq(agencyInstallments.id, nextInstallment.id))
    .returning();

  await logAudit(db, {
    businessId: subscription.businessId,
    action: "agency_installment.paid_via_subscription",
    entityType: "agency_installment",
    entityId: String(nextInstallment.id),
    metadata: { externalPreapprovalId: input.externalPreapprovalId, authorizedPaymentId: input.authorizedPaymentId },
  });

  return { matched: true as const, installment: updated };
}

export async function updateSubscriptionStatus(
  db: DatabaseLike,
  input: { externalPreapprovalId: string; status: string; metadata?: Record<string, unknown> },
) {
  const result = await db
    .update(agencySubscriptions)
    .set({ status: input.status, metadata: input.metadata, updatedAt: new Date() })
    .where(eq(agencySubscriptions.externalPreapprovalId, input.externalPreapprovalId))
    .returning();
  return result[0] ?? null;
}
