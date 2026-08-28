import { z } from "zod";
import type { ModuleKey } from "../shared/module";
import { BUSINESS_ROLE_KEYS } from "../shared/auth";
import { BUSINESS_PRESETS, MODULE_MANIFESTS } from "../modules/core/registry";
import {
  applyAdminPreset,
  getAdminActivationPlan,
  getAdminModuleCatalog,
  getModuleAdminHealth,
  getModuleChangeAudit,
  listBusinessesForAdmin,
  disableAdminModules,
  enableAdminModules,
  updateAdminModuleSettings,
} from "./services/moduleAdmin";
import { listBusinessMemberships, revokeBusinessMembership, setBusinessMembershipRole } from "./services/memberships";
import { agencyBillingRouter } from "../modules/agency-billing/router";
import { adminDatabaseProcedure, router } from "./trpc";

const businessRoleSchema = z.enum([...BUSINESS_ROLE_KEYS] as [string, ...string[]]);
const presetKeySchema = z.enum(BUSINESS_PRESETS.map((preset) => preset.key) as [string, ...string[]]);
const moduleKeySchema = z.enum(Object.keys(MODULE_MANIFESTS) as [ModuleKey, ...ModuleKey[]]);
const businessInput = z.object({ businessId: z.number().int().positive() });

export const adminRouter = router({
  billing: agencyBillingRouter,
  businesses: router({
    list: adminDatabaseProcedure.query(({ ctx }) => listBusinessesForAdmin(ctx.db)),
  }),
  presets: router({
    list: adminDatabaseProcedure.query(() => BUSINESS_PRESETS),
    applyPreset: adminDatabaseProcedure
      .input(businessInput.extend({ presetKey: presetKeySchema, idempotencyKey: z.string().min(8).max(160).optional() }))
      .mutation(({ ctx, input }) =>
        applyAdminPreset(ctx.db, input.businessId, input.presetKey, ctx.user?.id, input.idempotencyKey),
      ),
  }),
  memberships: router({
    list: adminDatabaseProcedure
      .input(businessInput)
      .query(({ ctx, input }) => listBusinessMemberships(ctx.db, input.businessId)),
    setRole: adminDatabaseProcedure
      .input(businessInput.extend({ userId: z.number().int().positive(), roleKey: businessRoleSchema }))
      .mutation(({ ctx, input }) =>
        setBusinessMembershipRole(ctx.db, {
          businessId: input.businessId,
          userId: input.userId,
          roleKey: input.roleKey,
          actorUserId: ctx.user?.id,
        }),
      ),
    revoke: adminDatabaseProcedure
      .input(businessInput.extend({ userId: z.number().int().positive() }))
      .mutation(({ ctx, input }) =>
        revokeBusinessMembership(ctx.db, {
          businessId: input.businessId,
          userId: input.userId,
          actorUserId: ctx.user?.id,
        }),
      ),
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
      .input(businessInput.extend({ moduleKeys: z.array(moduleKeySchema).min(1), idempotencyKey: z.string().min(8).max(160).optional() }))
      .mutation(({ ctx, input }) =>
        enableAdminModules(ctx.db, input.businessId, input.moduleKeys as ModuleKey[], ctx.user?.id, input.idempotencyKey),
      ),
    disable: adminDatabaseProcedure
      .input(businessInput.extend({ moduleKeys: z.array(moduleKeySchema).min(1), idempotencyKey: z.string().min(8).max(160).optional() }))
      .mutation(({ ctx, input }) =>
        disableAdminModules(ctx.db, input.businessId, input.moduleKeys as ModuleKey[], ctx.user?.id, input.idempotencyKey),
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
