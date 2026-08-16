import { z } from "zod";
import { moduleEnabledProcedure, router, businessManagerProcedure } from "../../server/trpc";
import {
  archiveCatalogueItem,
  createCatalogueItem,
  getCatalogueItem,
  listCatalogueItems,
  updateCatalogueItem,
} from "./service";

const catalogueInput = z.object({
  slug: z.string().min(2).max(120),
  itemType: z.enum(["product", "service", "ticket", "membership"]).optional(),
  name: z.string().min(1).max(180),
  description: z.string().max(4000).optional(),
  priceCents: z.number().int().min(0).max(2_000_000_000).optional(),
  currency: z.string().length(3).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const catalogueUpdate = catalogueInput.partial().extend({ id: z.number().int().positive() });

export const catalogueRouter = router({
  list: moduleEnabledProcedure("catalogue")
    .input(z.object({ search: z.string().max(180).optional(), status: z.string().max(32).optional(), itemType: z.string().max(32).optional() }).optional())
    .query(({ ctx, input }) => listCatalogueItems(ctx.db, ctx.businessId, input ?? {})),

  get: moduleEnabledProcedure("catalogue")
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => getCatalogueItem(ctx.db, ctx.businessId, input.id)),

  create: businessManagerProcedure
    .use(({ ctx, next }) => next({ ctx }))
    .input(catalogueInput)
    .mutation(({ ctx, input }) => createCatalogueItem(ctx.db, ctx.businessId, input)),

  update: businessManagerProcedure
    .input(catalogueUpdate)
    .mutation(({ ctx, input }) => {
      const { id, ...values } = input;
      return updateCatalogueItem(ctx.db, ctx.businessId, id, values);
    }),

  archive: businessManagerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => archiveCatalogueItem(ctx.db, ctx.businessId, input.id)),
});
