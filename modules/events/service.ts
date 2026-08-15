import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { events, orderItems, orders, ticketTypes, tickets, accessLogs } from "../../drizzle/schema";

export type DatabaseLike = any;

export async function listPublishedEvents(db: DatabaseLike, businessId: number) {
  return db
    .select()
    .from(events)
    .where(and(eq(events.businessId, businessId), eq(events.status, "published")))
    .orderBy(asc(events.startsAt));
}

export async function getEventBySlug(db: DatabaseLike, businessId: number, slug: string) {
  const result = await db
    .select()
    .from(events)
    .where(and(eq(events.businessId, businessId), eq(events.slug, slug)))
    .limit(1);
  return result[0] ?? null;
}

export async function getEventTicketTypes(db: DatabaseLike, businessId: number, eventId: number) {
  return db
    .select()
    .from(ticketTypes)
    .where(and(eq(ticketTypes.businessId, businessId), eq(ticketTypes.eventId, eventId)))
    .orderBy(asc(ticketTypes.priceCents));
}

export async function createEvent(
  db: DatabaseLike,
  businessId: number,
  input: {
    slug: string;
    name: string;
    description?: string;
    venue?: string;
    startsAt: Date;
    endsAt?: Date;
    capacity?: number;
  },
) {
  const result = await db
    .insert(events)
    .values({
      businessId,
      slug: input.slug,
      name: input.name,
      description: input.description,
      venue: input.venue,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      capacity: input.capacity,
      status: "draft",
    })
    .returning();

  return result[0];
}

export async function publishEvent(db: DatabaseLike, businessId: number, eventId: number) {
  const result = await db
    .update(events)
    .set({ status: "published", updatedAt: new Date() })
    .where(and(eq(events.id, eventId), eq(events.businessId, businessId), eq(events.status, "draft")))
    .returning();

  return result[0] ?? null;
}

export async function createTicketType(
  db: DatabaseLike,
  businessId: number,
  input: {
    eventId: number;
    name: string;
    description?: string;
    priceCents: number;
    currency?: string;
    quantity?: number;
  },
) {
  const event = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, input.eventId), eq(events.businessId, businessId)))
    .limit(1);

  if (!event[0]) throw new Error("Event does not belong to this business.");

  const result = await db
    .insert(ticketTypes)
    .values({
      businessId,
      eventId: input.eventId,
      name: input.name,
      description: input.description,
      priceCents: input.priceCents,
      currency: input.currency ?? "CLP",
      quantity: input.quantity,
      status: "active",
    })
    .returning();

  return result[0];
}

export async function createOrder(
  db: DatabaseLike,
  businessId: number,
  input: {
    eventId: number;
    ticketTypeId: number;
    quantity: number;
    customerEmail: string;
    customerName?: string;
  },
) {
  const available = await db
    .select()
    .from(ticketTypes)
    .where(
      and(
        eq(ticketTypes.id, input.ticketTypeId),
        eq(ticketTypes.eventId, input.eventId),
        eq(ticketTypes.businessId, businessId),
        eq(ticketTypes.status, "active"),
        sql`(${ticketTypes.quantity} is null or ${ticketTypes.sold} + ${input.quantity} <= ${ticketTypes.quantity})`,
      ),
    )
    .limit(1);

  const ticketType = available[0];
  if (!ticketType) throw new Error("Ticket type is unavailable or sold out.");

  const totalCents = ticketType.priceCents * input.quantity;
  const orderNumber = `ANC-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
  const orderResult = await db
    .insert(orders)
    .values({
      businessId,
      orderNumber,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      totalCents,
      currency: ticketType.currency,
      status: "confirmed",
      paymentStatus: "pending",
      source: "web",
    })
    .returning();

  const order = orderResult[0];
  if (!order) throw new Error("Unable to create order.");

  await db.insert(orderItems).values({
    businessId,
    orderId: order.id,
    ticketTypeId: ticketType.id,
    quantity: input.quantity,
    unitPriceCents: ticketType.priceCents,
    lineTotalCents: totalCents,
  });

  await db
    .update(ticketTypes)
    .set({ sold: sql`${ticketTypes.sold} + ${input.quantity}`, updatedAt: new Date() })
    .where(eq(ticketTypes.id, ticketType.id));

  const generatedTickets = Array.from({ length: input.quantity }, () => ({
    businessId,
    eventId: input.eventId,
    orderId: order.id,
    ticketTypeId: ticketType.id,
    code: `ANC-${nanoid(18).toUpperCase()}`,
    attendeeName: input.customerName,
    status: "valid",
  }));

  const ticketRows = await db.insert(tickets).values(generatedTickets).returning();
  return { order, tickets: ticketRows };
}

export async function validateTicket(
  db: DatabaseLike,
  businessId: number,
  input: { eventId: number; code: string; operatorUserId?: number | null },
) {
  const result = await db
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.businessId, businessId),
        eq(tickets.eventId, input.eventId),
        eq(tickets.code, input.code),
      ),
    )
    .limit(1);

  const ticket = result[0];
  if (!ticket) return { valid: false, result: "not_found" as const };

  if (ticket.status !== "valid") {
    await db.insert(accessLogs).values({
      businessId,
      eventId: input.eventId,
      ticketId: ticket.id,
      result: "already_used",
      operatorUserId: input.operatorUserId ?? null,
    });
    return { valid: false, result: "already_used" as const, ticket };
  }

  const updated = await db
    .update(tickets)
    .set({ status: "used", checkedInAt: new Date() })
    .where(and(eq(tickets.id, ticket.id), eq(tickets.status, "valid")))
    .returning();

  if (!updated[0]) {
    await db.insert(accessLogs).values({
      businessId,
      eventId: input.eventId,
      ticketId: ticket.id,
      result: "already_used",
      operatorUserId: input.operatorUserId ?? null,
    });
    return { valid: false, result: "already_used" as const, ticket };
  }

  await db.insert(accessLogs).values({
    businessId,
    eventId: input.eventId,
    ticketId: ticket.id,
    result: "accepted",
    operatorUserId: input.operatorUserId ?? null,
  });

  return { valid: true, result: "accepted" as const, ticket: updated[0] };
}
