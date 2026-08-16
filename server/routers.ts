import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { businessModules, businesses, moduleCatalog } from "../drizzle/schema";
import { MODULE_MANIFESTS, BUSINESS_PRESETS } from "../modules/core/registry";
import { enableBusinessModules, disableBusinessModules } from "./services/businessModules";
import { eventsRouter } from "../modules/events/router";
import { paymentsRouter } from "../modules/payments/router";
import { reservationsRouter } from "../modules/reservations/router";
import { notificationsRouter } from "../modules/notifications/router";
import { adminRouter } from "./adminRouter";
import type { ModuleKey } from "../shared/module";
import { businessDatabaseProcedure, databaseProcedure, publicProcedure, router } from "./trpc";

export const moduleKeySchema = z.enum(Object.keys(MODULE_MANIFESTS) as [ModuleKey, ...ModuleKey[]]);

export const appRouter = router({
  system: router({
    health: publicProcedure.query(({ ctx }) => ({
      ok: true,
      service: "anc-platform",
      database: ctx.database,
      timestamp: new Date().toISOString(),
    })),
  }),
  modules: router({
    list: publicProcedure.query(() =>
      Object.values(MODULE_MANIFESTS).map(
        ({
          key,
          version,
          displayName,
          description,
          category,
          dependencies,
          skillKey,
          maturity,
          requiresSetup,
          setupChecklist,
          capabilities,
          verticals,
        }) => ({
          key,
          version,
          displayName,
          description,
          category,
          dependencies,
          skillKey,
          maturity,
          requiresSetup,
          setupChecklist,
          capabilities,
          verticals,
        }),
      ),
    ),
    catalog: databaseProcedure.query(async ({ ctx }) => {
      return ctx.db.select().from(moduleCatalog).where(eq(moduleCatalog.active, true));
    }),
    get: publicProcedure.input(z.object({ key: z.string() })).query(({ input }) => {
      const module = MODULE_MANIFESTS[input.key as keyof typeof MODULE_MANIFESTS];
      if (!module) throw new Error(`Unknown module key: ${input.key}`);
      return module;
    }),
  }),
  presets: router({
    list: publicProcedure.query(() => BUSINESS_PRESETS),
  }),
  events: eventsRouter,
  payments: paymentsRouter,
  reservations: reservationsRouter,
  notifications: notificationsRouter,
  admin: adminRouter,
  business: router({
    current: businessDatabaseProcedure.query(async ({ ctx }) => {
      const result = await ctx.db
        .select()
        .from(businesses)
        .where(eq(businesses.id, ctx.businessId))
        .limit(1);
      return result[0] ?? null;
    }),
    enabledModules: businessDatabaseProcedure.query(async ({ ctx }) => {
      return ctx.db
        .select({
          moduleKey: businessModules.moduleKey,
          enabled: businessModules.enabled,
          settings: businessModules.settings,
          displayName: moduleCatalog.displayName,
          description: moduleCatalog.description,
          version: moduleCatalog.version,
        })
        .from(businessModules)
        .innerJoin(moduleCatalog, eq(moduleCatalog.moduleKey, businessModules.moduleKey))
        .where(
          and(
            eq(businessModules.businessId, ctx.businessId),
            eq(businessModules.enabled, true),
          ),
        );
    }),
    enableModules: businessDatabaseProcedure
      .input(z.object({ moduleKeys: z.array(moduleKeySchema).min(1) }))
      .mutation(async ({ ctx, input }) => {
        return enableBusinessModules(ctx.db, ctx.businessId, input.moduleKeys, ctx.user?.id);
      }),
    disableModules: businessDatabaseProcedure
      .input(z.object({ moduleKeys: z.array(moduleKeySchema).min(1) }))
      .mutation(async ({ ctx, input }) => {
        return disableBusinessModules(ctx.db, ctx.businessId, input.moduleKeys, ctx.user?.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
