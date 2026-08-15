import { z } from "zod";
import { businessDatabaseProcedure, router } from "../../server/trpc";
import {
  createEvent,
  createOrder,
  createTicketType,
  getEventBySlug,
  getEventTicketTypes,
  listPublishedEvents,
  publishEvent,
  validateTicket,
} from "./service";

export const eventsRouter = router({
  listPublished: businessDatabaseProcedure.query(({ ctx }) =>
    listPublishedEvents(ctx.db, ctx.businessId),
  ),
  getBySlug: businessDatabaseProcedure
    .input(z.object({ slug: z.string().min(1).max(120) }))
    .query(({ ctx, input }) => getEventBySlug(ctx.db, ctx.businessId, input.slug)),
  getTicketTypes: businessDatabaseProcedure
    .input(z.object({ eventId: z.number().int().positive() }))
    .query(({ ctx, input }) => getEventTicketTypes(ctx.db, ctx.businessId, input.eventId)),
  create: businessDatabaseProcedure
    .input(
      z.object({
        slug: z.string().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        name: z.string().min(2).max(220),
        description: z.string().max(5000).optional(),
        venue: z.string().max(220).optional(),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date().optional(),
        capacity: z.number().int().positive().optional(),
      }),
    )
    .mutation(({ ctx, input }) => createEvent(ctx.db, ctx.businessId, input)),
  publish: businessDatabaseProcedure
    .input(z.object({ eventId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => publishEvent(ctx.db, ctx.businessId, input.eventId)),
  createTicketType: businessDatabaseProcedure
    .input(
      z.object({
        eventId: z.number().int().positive(),
        name: z.string().min(1).max(160),
        description: z.string().max(5000).optional(),
        priceCents: z.number().int().nonnegative(),
        currency: z.string().length(3).optional(),
        quantity: z.number().int().positive().optional(),
      }),
    )
    .mutation(({ ctx, input }) => createTicketType(ctx.db, ctx.businessId, input)),
  createOrder: businessDatabaseProcedure
    .input(
      z.object({
        eventId: z.number().int().positive(),
        ticketTypeId: z.number().int().positive(),
        quantity: z.number().int().positive().max(20),
        customerEmail: z.string().email(),
        customerName: z.string().max(180).optional(),
      }),
    )
    .mutation(({ ctx, input }) => createOrder(ctx.db, ctx.businessId, input)),
  validateTicket: businessDatabaseProcedure
    .input(
      z.object({
        eventId: z.number().int().positive(),
        code: z.string().min(8).max(96),
      }),
    )
    .mutation(({ ctx, input }) => validateTicket(ctx.db, ctx.businessId, input)),
});
