import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { accessLogs } from "../../drizzle/schema";
import { moduleEnabledProcedure, router } from "../../server/trpc";
import { validateTicket } from "../events/service";

export const accessRouter = router({
  validate: moduleEnabledProcedure("access")
    .input(z.object({ eventId: z.number().int().positive(), code: z.string().min(8).max(96) }))
    .mutation(({ ctx, input }) => validateTicket(ctx.db, ctx.businessId, input)),

  logs: moduleEnabledProcedure("access")
    .input(z.object({ eventId: z.number().int().positive().optional(), limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(({ ctx, input }) => {
      const filters = [eq(accessLogs.businessId, ctx.businessId)];
      if (input?.eventId) filters.push(eq(accessLogs.eventId, input.eventId));
      return ctx.db
        .select()
        .from(accessLogs)
        .where(and(...filters))
        .orderBy(desc(accessLogs.scannedAt))
        .limit(input?.limit ?? 50);
    }),
});
