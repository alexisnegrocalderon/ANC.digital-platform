import { z } from "zod";
import { businessManagerProcedure, moduleEnabledProcedure, router } from "../../server/trpc";
import { archiveCustomer, createCustomer, listCustomers, updateCustomer } from "./service";

const customerInput = z.object({
  externalKey: z.string().max(160).optional(),
  name: z.string().min(1).max(180),
  email: z.string().email().max(320).optional(),
  phoneE164: z.string().max(32).optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
  consent: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string().max(64)).max(50).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const crmRouter = router({
  list: moduleEnabledProcedure("crm")
    .input(z.object({ search: z.string().max(180).optional(), status: z.string().max(32).optional() }).optional())
    .query(({ ctx, input }) => listCustomers(ctx.db, ctx.businessId, input ?? {})),

  create: businessManagerProcedure
    .input(customerInput)
    .mutation(({ ctx, input }) => createCustomer(ctx.db, ctx.businessId, input)),

  update: businessManagerProcedure
    .input(customerInput.partial().extend({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => {
      const { id, ...values } = input;
      return updateCustomer(ctx.db, ctx.businessId, id, values);
    }),

  archive: businessManagerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => archiveCustomer(ctx.db, ctx.businessId, input.id)),
});
