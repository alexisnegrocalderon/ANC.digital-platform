import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { appointmentNotifications, bookingServices, bookingStaff } from "../drizzle/schema";
import { getDb } from "../server/db";
import { BookingConflictError, createAppointment, getAvailableSlots } from "../modules/bookings/service";

const db = getDb();
if (!db) throw new Error("DATABASE_URL is not configured.");
const businessId = 1;
const service = (await db.select().from(bookingServices).where(and(eq(bookingServices.businessId, businessId), eq(bookingServices.slug, "consultoria-demo"))).limit(1))[0];
const staff = (await db.select().from(bookingStaff).where(and(eq(bookingStaff.businessId, businessId), eq(bookingStaff.name, "Ana Demo"))).limit(1))[0];
if (!service || !staff) throw new Error("Run pnpm run seed:bookings first.");

const from = new Date(Date.now() + 2 * 60 * 60 * 1000);
const to = new Date(Date.now() + 10 * 86_400_000);
const slots = await getAvailableSlots(db, { businessId, serviceId: service.id, staffId: staff.id, from, to });
const slot = slots[0];
if (!slot) throw new Error("No booking slot available in the seeded range.");

const idempotencyKey = `smoke-${Date.now()}`;
const first = await createAppointment(db, {
  businessId,
  serviceId: service.id,
  staffId: staff.id,
  customerName: "Cliente Smoke",
  customerEmail: "smoke@example.test",
  customerPhoneE164: "+56912345678",
  startsAt: slot.startsAt,
  idempotencyKey,
  source: "smoke",
});
const reused = await createAppointment(db, {
  businessId,
  serviceId: service.id,
  staffId: staff.id,
  customerName: "Cliente Smoke",
  customerEmail: "smoke@example.test",
  customerPhoneE164: "+56912345678",
  startsAt: slot.startsAt,
  idempotencyKey,
  source: "smoke",
});
if (!reused.reused || reused.appointment.id !== first.appointment.id) {
  throw new Error("Appointment idempotency did not reuse the original appointment.");
}

let conflictDetected = false;
try {
  await createAppointment(db, {
    businessId,
    serviceId: service.id,
    staffId: staff.id,
    customerName: "Cliente Conflict",
    customerEmail: "conflict@example.test",
    customerPhoneE164: "+56912345679",
    startsAt: slot.startsAt,
    idempotencyKey: `${idempotencyKey}-conflict`,
    source: "smoke",
  });
} catch (error) {
  conflictDetected = error instanceof BookingConflictError;
}
if (!conflictDetected) throw new Error("Overlapping appointment was not rejected.");

const notifications = await db
  .select()
  .from(appointmentNotifications)
  .where(and(eq(appointmentNotifications.businessId, businessId), eq(appointmentNotifications.appointmentId, first.appointment.id)));
if (notifications.length !== 3) throw new Error(`Expected 3 notifications, found ${notifications.length}.`);

console.log(JSON.stringify({ ok: true, slot: { startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString() }, appointmentId: first.appointment.id, reused: reused.reused, conflictDetected, notifications: notifications.map((notification) => notification.eventType) }, null, 2));
