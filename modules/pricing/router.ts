import { z } from "zod";
import { businessManagerProcedure, moduleEnabledProcedure, router } from "../../server/trpc";
import { createPricingRule, getEffectivePrice, listPricingRules } from "./service";

const pricingRuleInput = z.object({
  catalogueItemId: z.number().int().positive(),
  name: z.string().min(1).max(160),
  ruleType: z.enum(["fixed", "percentage", "amount"]).optional(),
  value: z.number().int().nonnegative(),
  priority: z.number().int().min(-1000).max(1000).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const pricingRouter = router({
  list: moduleEnabledProcedure("pricing")
    .input(z.object({ catalogueItemId: z.number().int().positive().optional() }).optional())
    .query(({ ctx, input }) => listPricingRules(ctx.db, ctx.businessId, input?.catalogueItemId)),
  effective: moduleEnabledProcedure("pricing")
    .input(z.object({ catalogueItemId: z.number().int().positive(), at: z.coerce.date().optional() }))
    .query(({ ctx, input }) => getEffectivePrice(ctx.db, ctx.businessId, input.catalogueItemId, input.at)),
  create: businessManagerProcedure
    .input(pricingRuleInput)
    .mutation(({ ctx, input }) => createPricingRule(ctx.db, ctx.businessId, input)),
});
