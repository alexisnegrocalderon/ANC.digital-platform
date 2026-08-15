import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { events, ticketTypes } from "../drizzle/schema";
import { createEvent, createTicketType } from "../modules/events/service";
import { getDb } from "../server/db";

const db = getDb();
if (!db) throw new Error("DATABASE_URL is required to seed events.");

const businessId = 1;
const existingEvent = await db
  .select()
  .from(events)
  .where(and(eq(events.businessId, businessId), eq(events.slug, "anc-launch-demo")))
  .limit(1);

const event =
  existingEvent[0] ??
  (await createEvent(db, businessId, {
    slug: "anc-launch-demo",
    name: "ANC Launch Demo",
    description: "Evento demo para validar la primera vertical de ANC Platform.",
    venue: "Santiago, Chile",
    startsAt: new Date("2026-12-12T22:00:00.000Z"),
    endsAt: new Date("2026-12-13T04:00:00.000Z"),
    capacity: 500,
  }));

if (!event) throw new Error("Unable to create demo event.");

const existingTicketType = await db
  .select()
  .from(ticketTypes)
  .where(and(eq(ticketTypes.businessId, businessId), eq(ticketTypes.eventId, event.id)))
  .limit(1);

const ticketType =
  existingTicketType[0] ??
  (await createTicketType(db, businessId, {
    eventId: event.id,
    name: "Entrada general",
    description: "Acceso general al evento demo.",
    priceCents: 15000,
    quantity: 500,
    currency: "CLP",
  }));

console.log(
  JSON.stringify(
    {
      ok: true,
      event: { id: event.id, slug: event.slug, status: event.status },
      ticketType: ticketType ? { id: ticketType.id, name: ticketType.name } : null,
    },
    null,
    2,
  ),
);
