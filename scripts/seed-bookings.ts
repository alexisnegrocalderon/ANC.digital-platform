import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { bookingAvailabilityRules, bookingServices, bookingStaff } from "../drizzle/schema";
import { getDb } from "../server/db";

const db = getDb();
if (!db) throw new Error("DATABASE_URL is not configured.");
const businessId = 1;

const existingService = (
  await db
    .select()
    .from(bookingServices)
    .where(and(eq(bookingServices.businessId, businessId), eq(bookingServices.slug, "consultoria-demo")))
    .limit(1)
)[0];
const service = existingService ?? (
  await db
    .insert(bookingServices)
    .values({
      businessId,
      slug: "consultoria-demo",
      name: "Consultoría demo",
      description: "Servicio de demostración del módulo de reservas.",
      durationMinutes: 60,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 15,
      priceCents: 25000,
      currency: "CLP",
      minNoticeMinutes: 60,
      maxAdvanceDays: 90,
      status: "active",
    })
    .returning()
)[0];
if (!service) throw new Error("Unable to seed booking service.");

const existingStaff = (
  await db
    .select()
    .from(bookingStaff)
    .where(and(eq(bookingStaff.businessId, businessId), eq(bookingStaff.name, "Ana Demo")))
    .limit(1)
)[0];
const staff = existingStaff ?? (
  await db
    .insert(bookingStaff)
    .values({ businessId, name: "Ana Demo", phoneE164: "+56912345678", status: "active" })
    .returning()
)[0];
if (!staff) throw new Error("Unable to seed booking staff.");

const existingRules = await db
  .select()
  .from(bookingAvailabilityRules)
  .where(and(eq(bookingAvailabilityRules.businessId, businessId), eq(bookingAvailabilityRules.staffId, staff.id)));
if (existingRules.length === 0) {
  await db.insert(bookingAvailabilityRules).values(
    [1, 2, 3, 4, 5].map((weekday) => ({
      businessId,
      staffId: staff.id,
      weekday,
      startLocal: "09:00",
      endLocal: "17:00",
      timezone: "America/Santiago",
      slotIntervalMinutes: 60,
      status: "active",
    })),
  );
}

console.log(JSON.stringify({ ok: true, businessId, serviceId: service.id, staffId: staff.id }, null, 2));
