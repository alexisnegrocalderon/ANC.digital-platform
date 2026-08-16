import { and, eq, gte, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  appointments,
  bookingAvailabilityRules,
  bookingServices,
  bookingStaff,
} from "../../drizzle/schema";
import { moduleEnabledProcedure, router } from "../../server/trpc";
import {
  BookingConflictError,
  BookingValidationError,
  cancelAppointment,
  createAppointment,
  getAvailableSlots,
} from "./service";

const isoDate = z.string().datetime({ offset: true });

function bookingError(error: unknown): never {
  if (error instanceof BookingConflictError) {
    throw new TRPCError({ code: "CONFLICT", message: error.message });
  }
  if (error instanceof BookingValidationError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw error;
}

export const bookingsRouter = router({
  listServices: moduleEnabledProcedure("reservations").query(({ ctx }) =>
    ctx.db
      .select()
      .from(bookingServices)
      .where(and(eq(bookingServices.businessId, ctx.businessId), eq(bookingServices.status, "active"))),
  ),

  listStaff: moduleEnabledProcedure("reservations").query(({ ctx }) =>
    ctx.db
      .select()
      .from(bookingStaff)
      .where(and(eq(bookingStaff.businessId, ctx.businessId), eq(bookingStaff.status, "active"))),
  ),

  getAvailability: moduleEnabledProcedure("reservations")
    .input(
      z.object({
        serviceId: z.number().int().positive(),
        staffId: z.number().int().positive().optional(),
        from: isoDate,
        to: isoDate,
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const slots = await getAvailableSlots(ctx.db, {
          businessId: ctx.businessId,
          serviceId: input.serviceId,
          staffId: input.staffId,
          from: new Date(input.from),
          to: new Date(input.to),
        });
        return slots.map((slot) => ({
          staffId: slot.staffId,
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
          timezone: slot.timezone,
        }));
      } catch (error) {
        return bookingError(error);
      }
    }),

  createAppointment: moduleEnabledProcedure("reservations")
    .input(
      z.object({
        serviceId: z.number().int().positive(),
        staffId: z.number().int().positive(),
        customerName: z.string().min(2).max(180),
        customerEmail: z.string().email().optional(),
        customerPhoneE164: z.string().min(8).max(20),
        startsAt: isoDate,
        idempotencyKey: z.string().min(4).max(180),
        source: z.string().max(32).optional(),
        notes: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createAppointment(ctx.db, {
          businessId: ctx.businessId,
          ...input,
          startsAt: new Date(input.startsAt),
        });
      } catch (error) {
        return bookingError(error);
      }
    }),

  cancelAppointment: moduleEnabledProcedure("reservations")
    .input(z.object({ appointmentId: z.number().int().positive(), reason: z.string().max(240).optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await cancelAppointment(ctx.db, ctx.businessId, input.appointmentId, input.reason);
      } catch (error) {
        return bookingError(error);
      }
    }),

  listAgenda: moduleEnabledProcedure("reservations")
    .input(
      z.object({
        from: isoDate,
        to: isoDate,
        staffId: z.number().int().positive().optional(),
        status: z.string().max(32).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(appointments.businessId, ctx.businessId),
        gte(appointments.startsAt, new Date(input.from)),
        lt(appointments.startsAt, new Date(input.to)),
      ];
      if (input.staffId) conditions.push(eq(appointments.staffId, input.staffId));
      if (input.status) conditions.push(eq(appointments.status, input.status));
      return ctx.db.select().from(appointments).where(and(...conditions));
    }),

  configureService: moduleEnabledProcedure("reservations")
    .input(
      z.object({
        slug: z.string().regex(/^[a-z0-9-]+$/).max(120),
        name: z.string().min(2).max(180),
        description: z.string().max(2000).optional(),
        durationMinutes: z.number().int().min(5).max(1440),
        bufferBeforeMinutes: z.number().int().min(0).max(240).optional(),
        bufferAfterMinutes: z.number().int().min(0).max(240).optional(),
        priceCents: z.number().int().min(0).max(100_000_000).optional(),
        currency: z.string().length(3).default("CLP"),
        minNoticeMinutes: z.number().int().min(0).max(43_200).optional(),
        maxAdvanceDays: z.number().int().min(1).max(730).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV === "production" && !ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication is required to configure bookings." });
      }
      return ctx.db
        .insert(bookingServices)
        .values({
          businessId: ctx.businessId,
          ...input,
          description: input.description ?? null,
          bufferBeforeMinutes: input.bufferBeforeMinutes ?? 0,
          bufferAfterMinutes: input.bufferAfterMinutes ?? 0,
          priceCents: input.priceCents ?? 0,
          minNoticeMinutes: input.minNoticeMinutes ?? 60,
          maxAdvanceDays: input.maxAdvanceDays ?? 90,
          currency: input.currency.toUpperCase(),
        })
        .onConflictDoUpdate({
          target: [bookingServices.businessId, bookingServices.slug],
          set: { ...input, description: input.description ?? null, updatedAt: new Date() },
        })
        .returning();
    }),

  configureStaff: moduleEnabledProcedure("reservations")
    .input(
      z.object({
        name: z.string().min(2).max(180),
        email: z.string().email().optional(),
        phoneE164: z.string().min(8).max(20).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV === "production" && !ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication is required to configure bookings." });
      }
      return ctx.db.insert(bookingStaff).values({ businessId: ctx.businessId, ...input }).returning();
    }),

  configureAvailability: moduleEnabledProcedure("reservations")
    .input(
      z.object({
        staffId: z.number().int().positive().optional(),
        weekday: z.number().int().min(0).max(6),
        startLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        endLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        timezone: z.string().min(3).max(64).default("America/Santiago"),
        slotIntervalMinutes: z.number().int().min(5).max(240).default(30),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV === "production" && !ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication is required to configure bookings." });
      }
      if (input.startLocal >= input.endLocal) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Availability end time must be after start time." });
      }
      return ctx.db.insert(bookingAvailabilityRules).values({ businessId: ctx.businessId, ...input }).returning();
    }),
});
