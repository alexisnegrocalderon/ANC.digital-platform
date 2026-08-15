import { z } from "zod";
import { businessDatabaseProcedure, router } from "../../server/trpc";
import { upsertWhatsAppAccount } from "./whatsapp";
import { processDueAppointmentNotifications } from "./service";

export const notificationsRouter = router({
  configureWhatsApp: businessDatabaseProcedure
    .input(
      z.object({
        wabaId: z.string().min(1).max(128),
        phoneNumberId: z.string().min(1).max(128),
        displayPhoneNumber: z.string().max(32).optional(),
        accessToken: z.string().min(1),
        appSecret: z.string().min(1),
        verifyToken: z.string().min(1),
        defaultLanguage: z.string().min(2).max(16).default("es_CL"),
        templates: z.record(z.string(), z.string()).default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV === "production" && !ctx.user) {
        throw new Error("Authentication is required to configure WhatsApp.");
      }
      return upsertWhatsAppAccount(ctx.db, ctx.businessId, input);
    }),

  processDue: businessDatabaseProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
    .mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV === "production" && !ctx.user) {
        throw new Error("Authentication is required to process notifications.");
      }
      return processDueAppointmentNotifications(ctx.db, input.limit);
    }),
});
