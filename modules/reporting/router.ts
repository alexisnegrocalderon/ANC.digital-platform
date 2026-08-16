import { z } from "zod";
import { moduleEnabledProcedure, router } from "../../server/trpc";
import { getBusinessOverview, getOrderSummary } from "./service";

export const reportingRouter = router({
  overview: moduleEnabledProcedure("reporting").query(({ ctx }) => getBusinessOverview(ctx.db, ctx.businessId)),
  orders: moduleEnabledProcedure("reporting")
    .input(z.object({}).optional())
    .query(({ ctx }) => getOrderSummary(ctx.db, ctx.businessId)),
});
