import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { bookingServices, bookingStaff } from "../drizzle/schema";
import { getDb } from "../server/db";
import { BookingConflictError, createAppointment, getAvailableSlots } from "../modules/bookings/service";

const db = getDb();
if (!db) throw new Error("DATABASE_URL is not configured.");
const businessId = 1;
const service = (await db.select().from(bookingServices).where(and(eq(bookingServices.businessId, businessId), eq(bookingServices.slug, "consultoria-demo"))).limit(1))[0];
const staff = (await db.select().from(bookingStaff).where(and(eq(bookingStaff.businessId, businessId), eq(bookingStaff.name, "Ana Demo"))).limit(1))[0];
if (!service || !staff) throw new Error("Run pnpm run seed:bookings first.");
const slots = await getAvailableSlots(db, {
  businessId,
  serviceId: service.id,
  staffId: staff.id,
  from: new Date(Date.now() + 2 * 60 * 60 * 1000),
  to: new Date(Date.now() + 14 * 86_400_000),
});
const slot = slots[0];
if (!slot) throw new Error("No free slot available for concurrency test.");

const attempts = await Promise.allSettled([
  createAppointment(db, {
    businessId,
    serviceId: service.id,
    staffId: staff.id,
    customerName: "Concurrent A",
    customerPhoneE164: "+56912345671",
    startsAt: slot.startsAt,
    idempotencyKey: `concurrency-a-${Date.now()}`,
    source: "concurrency-smoke",
  }),
  createAppointment(db, {
    businessId,
    serviceId: service.id,
    staffId: staff.id,
    customerName: "Concurrent B",
    customerPhoneE164: "+56912345672",
    startsAt: slot.startsAt,
    idempotencyKey: `concurrency-b-${Date.now()}`,
    source: "concurrency-smoke",
  }),
]);
const fulfilled = attempts.filter((attempt) => attempt.status === "fulfilled");
const conflicts = attempts.filter((attempt) => attempt.status === "rejected" && attempt.reason instanceof BookingConflictError);
if (fulfilled.length !== 1 || conflicts.length !== 1) {
  throw new Error(`Expected one winner and one conflict; got ${JSON.stringify(attempts.map((attempt) => attempt.status))}`);
}
console.log(JSON.stringify({ ok: true, slot: slot.startsAt.toISOString(), winners: fulfilled.length, conflicts: conflicts.length }, null, 2));
