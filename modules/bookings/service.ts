import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import {
  appointmentNotifications,
  appointments,
  bookingAvailabilityOverrides,
  bookingAvailabilityRules,
  bookingServices,
  bookingStaff,
  businesses,
} from "../../drizzle/schema";
import {
  APPOINTMENT_ACTIVE_STATES,
  APPOINTMENT_NOTIFICATION_EVENTS,
  appointmentIdempotencyKey,
  assertAppointmentTransition,
  normalizePhoneE164,
  type AppointmentNotificationEvent,
  type AppointmentState,
} from "../../shared/booking";
import { enumerateLocalDateKeys, localTimeToUtc, localWeekday } from "./time";

export type DatabaseLike = any;

export class BookingConflictError extends Error {
  code = "BOOKING_CONFLICT" as const;
}

export class BookingValidationError extends Error {
  code = "BOOKING_VALIDATION" as const;
}

type AvailabilityInput = {
  businessId: number;
  serviceId: number;
  staffId?: number;
  from: Date;
  to: Date;
};

type Slot = {
  staffId: number;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
};

function asDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new BookingValidationError("Invalid date.");
  return date;
}

function isOverlap(start: Date, end: Date, otherStart: Date, otherEnd: Date) {
  return start < otherEnd && end > otherStart;
}

function isDatabaseBookingConflict(error: unknown) {
  const candidate = error as { message?: string; code?: string; cause?: { message?: string; code?: string; constraint?: string; cause?: { message?: string; code?: string } } };
  const haystack = [
    candidate?.message,
    candidate?.code,
    candidate?.cause?.message,
    candidate?.cause?.code,
    candidate?.cause?.constraint,
    candidate?.cause?.cause?.message,
    candidate?.cause?.cause?.code,
  ].filter(Boolean).join(" ");
  return /appointments_no_active_overlap|23P01|exclusion|overlap/i.test(haystack);
}

function notificationTemplate(eventType: AppointmentNotificationEvent) {
  return {
    "appointment.confirmed": "appointment_confirmed",
    "appointment.reminder_24h": "appointment_reminder_24h",
    "appointment.reminder_2h": "appointment_reminder_2h",
    "appointment.cancelled": "appointment_cancelled",
    "appointment.rescheduled": "appointment_rescheduled",
  }[eventType];
}

export async function queueAppointmentNotification(
  db: DatabaseLike,
  input: {
    businessId: number;
    appointmentId: number;
    eventType: AppointmentNotificationEvent;
    recipient: string;
    customerName: string;
    serviceName: string;
    startsAt: Date;
    timezone: string;
    scheduledAt?: Date;
  },
) {
  if (!APPOINTMENT_NOTIFICATION_EVENTS.includes(input.eventType)) {
    throw new BookingValidationError(`Unsupported notification event: ${input.eventType}`);
  }
  const scheduledAt = input.scheduledAt ?? new Date();
  const idempotencyKey = `appointment-${input.appointmentId}-${input.eventType}`;
  const params = {
    customer_name: input.customerName,
    service_name: input.serviceName,
    appointment_start: input.startsAt.toISOString(),
    timezone: input.timezone,
    appointment_id: String(input.appointmentId),
  };
  const result = await db
    .insert(appointmentNotifications)
    .values({
      businessId: input.businessId,
      appointmentId: input.appointmentId,
      channel: "whatsapp",
      eventType: input.eventType,
      recipient: input.recipient,
      templateName: notificationTemplate(input.eventType),
      templateLanguage: "es_CL",
      templateParams: params,
      idempotencyKey,
      scheduledAt,
      nextAttemptAt: scheduledAt,
      status: "queued",
      attemptCount: 0,
    })
    .onConflictDoNothing({
      target: [appointmentNotifications.businessId, appointmentNotifications.idempotencyKey],
    })
    .returning();
  return result[0] ?? null;
}

async function getBookingContext(db: DatabaseLike, businessId: number, serviceId: number, staffId: number) {
  const rows = await db
    .select({ business: businesses, service: bookingServices, staff: bookingStaff })
    .from(bookingServices)
    .innerJoin(businesses, eq(businesses.id, bookingServices.businessId))
    .innerJoin(bookingStaff, eq(bookingStaff.businessId, bookingServices.businessId))
    .where(
      and(
        eq(bookingServices.businessId, businessId),
        eq(bookingServices.id, serviceId),
        eq(bookingServices.status, "active"),
        eq(bookingStaff.businessId, businessId),
        eq(bookingStaff.id, staffId),
        eq(bookingStaff.status, "active"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function getActiveAppointments(db: DatabaseLike, businessId: number, staffIds: number[], from: Date, to: Date) {
  if (staffIds.length === 0) return [];
  return db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.businessId, businessId),
        inArray(appointments.staffId, staffIds),
        inArray(appointments.status, [...APPOINTMENT_ACTIVE_STATES]),
        lt(appointments.startsAt, to),
        gt(appointments.endsAt, from),
      ),
    )
    .orderBy(asc(appointments.startsAt));
}

export async function getAvailableSlots(db: DatabaseLike, input: AvailabilityInput): Promise<Slot[]> {
  const service = await db
    .select()
    .from(bookingServices)
    .where(
      and(
        eq(bookingServices.businessId, input.businessId),
        eq(bookingServices.id, input.serviceId),
        eq(bookingServices.status, "active"),
      ),
    )
    .limit(1);
  const serviceRow = service[0];
  if (!serviceRow) throw new BookingValidationError("Booking service not found.");
  const staffRows = await db
    .select()
    .from(bookingStaff)
    .where(
      and(
        eq(bookingStaff.businessId, input.businessId),
        eq(bookingStaff.status, "active"),
        input.staffId ? eq(bookingStaff.id, input.staffId) : undefined,
      ),
    );
  if (staffRows.length === 0) return [];

  const business = await db
    .select({ timezone: businesses.timezone })
    .from(businesses)
    .where(eq(businesses.id, input.businessId))
    .limit(1);
  const defaultTimezone = business[0]?.timezone ?? "America/Santiago";
  const rangeStart = asDate(input.from);
  const rangeEnd = asDate(input.to);
  if (rangeEnd <= rangeStart) throw new BookingValidationError("Availability range is invalid.");
  const appointmentsRows = await getActiveAppointments(
    db,
    input.businessId,
    staffRows.map((staff: { id: number }) => staff.id),
    new Date(rangeStart.getTime() - (serviceRow.bufferBeforeMinutes + serviceRow.bufferAfterMinutes) * 60_000),
    new Date(rangeEnd.getTime() + (serviceRow.bufferBeforeMinutes + serviceRow.bufferAfterMinutes) * 60_000),
  );
  const rules = await db
    .select()
    .from(bookingAvailabilityRules)
    .where(
      and(
        eq(bookingAvailabilityRules.businessId, input.businessId),
        eq(bookingAvailabilityRules.status, "active"),
      ),
    );
  const overrides = await db
    .select()
    .from(bookingAvailabilityOverrides)
    .where(eq(bookingAvailabilityOverrides.businessId, input.businessId));

  const slots: Slot[] = [];
  const dateKeys = enumerateLocalDateKeys(rangeStart, rangeEnd, defaultTimezone);
  for (const staff of staffRows) {
    const staffRules = rules.filter((rule: typeof bookingAvailabilityRules.$inferSelect) => !rule.staffId || rule.staffId === staff.id);
    for (const dateKey of dateKeys) {
      const dateAtNoon = new Date(`${dateKey}T12:00:00.000Z`);
      for (const rule of staffRules) {
        if (localWeekday(dateAtNoon, rule.timezone) !== rule.weekday) continue;
        if (rule.validFrom && dateKey < rule.validFrom) continue;
        if (rule.validUntil && dateKey > rule.validUntil) continue;
        const dateOverride = overrides.filter(
          (override: typeof bookingAvailabilityOverrides.$inferSelect) =>
            override.date === dateKey && (!override.staffId || override.staffId === staff.id),
        );
        if (dateOverride.some((override: typeof bookingAvailabilityOverrides.$inferSelect) => override.kind === "blocked" && !override.startLocal)) {
          continue;
        }
        const ruleStart = localTimeToUtc(dateKey, rule.startLocal, rule.timezone);
        const ruleEnd = localTimeToUtc(dateKey, rule.endLocal, rule.timezone);
        const stepMinutes = Math.max(5, rule.slotIntervalMinutes);
        const serviceDuration = serviceRow.durationMinutes * 60_000;
        for (
          let cursor = ruleStart.getTime();
          cursor + serviceDuration <= ruleEnd.getTime();
          cursor += stepMinutes * 60_000
        ) {
          const slotStart = new Date(cursor);
          const slotEnd = new Date(cursor + serviceDuration);
          const bufferedStart = new Date(slotStart.getTime() - serviceRow.bufferBeforeMinutes * 60_000);
          const bufferedEnd = new Date(slotEnd.getTime() + serviceRow.bufferAfterMinutes * 60_000);
          if (slotStart < rangeStart || slotEnd > rangeEnd) continue;
          if (slotStart.getTime() - Date.now() < serviceRow.minNoticeMinutes * 60_000) continue;
          if (slotStart.getTime() - Date.now() > serviceRow.maxAdvanceDays * 86_400_000) continue;
          if (dateOverride.some((override: typeof bookingAvailabilityOverrides.$inferSelect) => {
            if (override.kind !== "blocked") return false;
            if (!override.startLocal || !override.endLocal) return true;
            const blockStart = localTimeToUtc(dateKey, override.startLocal, rule.timezone);
            const blockEnd = localTimeToUtc(dateKey, override.endLocal, rule.timezone);
            return isOverlap(bufferedStart, bufferedEnd, blockStart, blockEnd);
          })) continue;
          if (appointmentsRows.some((appointment: typeof appointments.$inferSelect) =>
            appointment.staffId === staff.id &&
            isOverlap(bufferedStart, bufferedEnd, appointment.startsAt, appointment.endsAt),
          )) continue;
          slots.push({ staffId: staff.id, startsAt: slotStart, endsAt: slotEnd, timezone: rule.timezone || defaultTimezone });
        }
      }
    }
  }
  return slots.sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
}

export async function createAppointment(
  db: DatabaseLike,
  input: {
    businessId: number;
    serviceId: number;
    staffId: number;
    customerName: string;
    customerEmail?: string;
    customerPhoneE164: string;
    startsAt: Date | string;
    idempotencyKey: string;
    source?: string;
    notes?: string;
  },
) {
  const context = await getBookingContext(db, input.businessId, input.serviceId, input.staffId);
  if (!context) throw new BookingValidationError("Service or staff member not found.");
  const normalizedPhone = normalizePhoneE164(input.customerPhoneE164);
  const startsAt = asDate(input.startsAt);
  const endsAt = new Date(startsAt.getTime() + context.service.durationMinutes * 60_000);
  const now = Date.now();
  if (startsAt.getTime() - now < context.service.minNoticeMinutes * 60_000) {
    throw new BookingValidationError("Appointment does not meet the minimum notice window.");
  }
  if (startsAt.getTime() - now > context.service.maxAdvanceDays * 86_400_000) {
    throw new BookingValidationError("Appointment is beyond the maximum advance window.");
  }
  const normalizedKey = appointmentIdempotencyKey(input.businessId, input.idempotencyKey);
  const existing = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.businessId, input.businessId), eq(appointments.idempotencyKey, normalizedKey)))
    .limit(1);
  if (existing[0]) return { appointment: existing[0], reused: true } as const;

  const conflicts = await getActiveAppointments(
    db,
    input.businessId,
    [input.staffId],
    new Date(startsAt.getTime() - context.service.bufferBeforeMinutes * 60_000),
    new Date(endsAt.getTime() + context.service.bufferAfterMinutes * 60_000),
  );
  if (conflicts.some((appointment: typeof appointments.$inferSelect) => isOverlap(
    new Date(startsAt.getTime() - context.service.bufferBeforeMinutes * 60_000),
    new Date(endsAt.getTime() + context.service.bufferAfterMinutes * 60_000),
    appointment.startsAt,
    appointment.endsAt,
  ))) {
    throw new BookingConflictError("The selected slot is no longer available.");
  }

  let inserted;
  try {
    inserted = await db
      .insert(appointments)
      .values({
        businessId: input.businessId,
        serviceId: input.serviceId,
        staffId: input.staffId,
        customerName: input.customerName.trim(),
        customerEmail: input.customerEmail?.trim() || null,
        customerPhoneE164: normalizedPhone,
        startsAt,
        endsAt,
        timezone: context.business.timezone,
        status: "confirmed",
        source: input.source ?? "web",
        idempotencyKey: normalizedKey,
        notes: input.notes?.trim() || null,
      })
      .returning();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reserve appointment.";
    if (isDatabaseBookingConflict(error) || /appointments_business_idempotency_unique/i.test(message)) {
      throw new BookingConflictError("The selected slot is no longer available.");
    }
    throw error;
  }
  const appointment = inserted[0];
  if (!appointment) throw new Error("Appointment was not created.");
  await queueAppointmentNotification(db, {
    businessId: input.businessId,
    appointmentId: appointment.id,
    eventType: "appointment.confirmed",
    recipient: normalizedPhone,
    customerName: appointment.customerName,
    serviceName: context.service.name,
    startsAt,
    timezone: context.business.timezone,
  });
  await queueAppointmentNotification(db, {
    businessId: input.businessId,
    appointmentId: appointment.id,
    eventType: "appointment.reminder_24h",
    recipient: normalizedPhone,
    customerName: appointment.customerName,
    serviceName: context.service.name,
    startsAt,
    timezone: context.business.timezone,
    scheduledAt: new Date(startsAt.getTime() - 86_400_000),
  });
  await queueAppointmentNotification(db, {
    businessId: input.businessId,
    appointmentId: appointment.id,
    eventType: "appointment.reminder_2h",
    recipient: normalizedPhone,
    customerName: appointment.customerName,
    serviceName: context.service.name,
    startsAt,
    timezone: context.business.timezone,
    scheduledAt: new Date(startsAt.getTime() - 2 * 3_600_000),
  });
  return { appointment, reused: false } as const;
}

export async function transitionAppointment(
  db: DatabaseLike,
  input: { businessId: number; appointmentId: number; to: AppointmentState; reason?: string },
) {
  const currentRows = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.businessId, input.businessId), eq(appointments.id, input.appointmentId)))
    .limit(1);
  const current = currentRows[0];
  if (!current) throw new BookingValidationError("Appointment not found.");
  assertAppointmentTransition(current.status, input.to);
  const updated = await db
    .update(appointments)
    .set({
      status: input.to,
      cancellationReason: input.reason ?? current.cancellationReason,
      updatedAt: new Date(),
    })
    .where(and(eq(appointments.businessId, input.businessId), eq(appointments.id, input.appointmentId)))
    .returning();
  return updated[0] ?? current;
}

export async function cancelAppointment(db: DatabaseLike, businessId: number, appointmentId: number, reason?: string) {
  const appointment = await transitionAppointment(db, { businessId, appointmentId, to: "cancelled", reason });
  await db.insert(appointmentNotifications).values({
    businessId,
    appointmentId,
    channel: "whatsapp",
    eventType: "appointment.cancelled",
    recipient: appointment.customerPhoneE164,
    templateName: "appointment_cancelled",
    templateLanguage: "es_CL",
    templateParams: { customer_name: appointment.customerName, appointment_id: String(appointment.id) },
    idempotencyKey: `appointment-${appointment.id}-appointment.cancelled`,
    scheduledAt: new Date(),
    nextAttemptAt: new Date(),
    status: "queued",
    attemptCount: 0,
  }).onConflictDoNothing({ target: [appointmentNotifications.businessId, appointmentNotifications.idempotencyKey] });
  return appointment;
}
