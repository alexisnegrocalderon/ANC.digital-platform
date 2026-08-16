import { z } from "zod";
import type { ModuleKey } from "../shared/module";
import { MODULE_MANIFESTS } from "../modules/core/registry";
import {
  getAdminActivationPlan,
  getAdminModuleCatalog,
  getModuleAdminHealth,
  getModuleChangeAudit,
  listBusinessesForAdmin,
  disableAdminModules,
  enableAdminModules,
  updateAdminModuleSettings,
} from "./services/moduleAdmin";
import { adminDatabaseProcedure, router } from "./trpc";

const moduleKeySchema = z.enum(Object.keys(MODULE_MANIFESTS) as [ModuleKey, ...ModuleKey[]]);
const businessInput = z.object({ businessId: z.number().int().positive() });

export const adminRouter = router({
  businesses: router({
    list: adminDatabaseProcedure.query(({ ctx }) => listBusinessesForAdmin(ctx.db)),
  }),
  modules: router({
    catalog: adminDatabaseProcedure
      .input(businessInput.optional())
      .query(({ ctx, input }) => getAdminModuleCatalog(ctx.db, input?.businessId)),
    get: adminDatabaseProcedure
      .input(z.object({ key: moduleKeySchema, businessId: z.number().int().positive().optional() }))
      .query(async ({ ctx, input }) => {
        const modules = await getAdminModuleCatalog(ctx.db, input.businessId);
        return modules.find((module) => module.key === input.key) ?? null;
      }),
    resolveActivationPlan: adminDatabaseProcedure
      .input(z.object({ moduleKeys: z.array(moduleKeySchema).min(1) }))
      .query(({ input }) => getAdminActivationPlan(input.moduleKeys as ModuleKey[])),
  }),
  businessModules: router({
    list: adminDatabaseProcedure
      .input(businessInput)
      .query(({ ctx, input }) => getAdminModuleCatalog(ctx.db, input.businessId)),
    enable: adminDatabaseProcedure
      .input(businessInput.extend({ moduleKeys: z.array(moduleKeySchema).min(1) }))
      .mutation(({ ctx, input }) =>
        enableAdminModules(ctx.db, input.businessId, input.moduleKeys as ModuleKey[], ctx.user?.id),
      ),
    disable: adminDatabaseProcedure
      .input(businessInput.extend({ moduleKeys: z.array(moduleKeySchema).min(1) }))
      .mutation(({ ctx, input }) =>
        disableAdminModules(ctx.db, input.businessId, input.moduleKeys as ModuleKey[], ctx.user?.id),
      ),
    updateSettings: adminDatabaseProcedure
      .input(
        businessInput.extend({
          moduleKey: moduleKeySchema,
          settings: z.record(z.string(), z.unknown()),
        }),
      )
      .mutation(({ ctx, input }) =>
        updateAdminModuleSettings(
          ctx.db,
          input.businessId,
          input.moduleKey as ModuleKey,
          input.settings,
          ctx.user?.id,
        ),
      ),
    health: adminDatabaseProcedure
      .input(businessInput)
      .query(({ ctx, input }) => getModuleAdminHealth(ctx.db, input.businessId)),
  }),
  audit: router({
    moduleChanges: adminDatabaseProcedure
      .input(businessInput.extend({ limit: z.number().int().positive().max(100).optional() }))
      .query(({ ctx, input }) => getModuleChangeAudit(ctx.db, input.businessId, input.limit)),
  }),
});
