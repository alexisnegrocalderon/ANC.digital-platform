import { z } from "zod";
import { businessManagerProcedure, moduleEnabledProcedure, router } from "../../server/trpc";
import { listEmailOutbox, processDueEmailNotifications, queueEmail } from "./service";

const queueInput = z.object({
  entityType: z.string().min(1).max(64),
  entityId: z.string().max(128).optional(),
  eventType: z.string().min(1).max(96),
  recipient: z.string().email(),
  subject: z.string().min(1).max(240),
  templateName: z.string().min(1).max(160),
  payload: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().min(8).max(255),
  scheduledAt: z.coerce.date().optional(),
});

export const mailingRouter = router({
  outbox: moduleEnabledProcedure("notifications")
    .input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
    .query(({ ctx, input }) => listEmailOutbox(ctx.db, ctx.businessId, input?.limit)),
  queue: businessManagerProcedure.input(queueInput).mutation(({ ctx, input }) => queueEmail(ctx.db, ctx.businessId, input)),
  process: businessManagerProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).optional() }).optional())
    .mutation(({ ctx, input }) => processDueEmailNotifications(ctx.db, input?.limit)),
});
