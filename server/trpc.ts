import { initTRPC, TRPCError } from "@trpc/server";
import type { AppContext } from "./context";
import { and, eq } from "drizzle-orm";
import { businessModules } from "../drizzle/schema";
import type { ModuleKey } from "../shared/module";
import {
  BUSINESS_ADMIN_ROLES,
  BUSINESS_MANAGER_ROLES,
  type BusinessRole,
} from "../shared/auth";

const t = initTRPC.context<AppContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const businessProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.businessId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A business context is required for this operation.",
    });
  }
  if (process.env.NODE_ENV === "production" && (!ctx.user || !ctx.businessRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "An active business membership is required.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      businessId: ctx.businessId,
    },
  });
});

export const databaseProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.db) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Database is not configured. Add the pooled Neon connection string first.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      db: ctx.db,
    },
  });
});

export const businessDatabaseProcedure = businessProcedure.use(({ ctx, next }) => {
  if (!ctx.db) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Database is not configured. Add the pooled Neon connection string first.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      db: ctx.db,
      businessId: ctx.businessId,
    },
  });
});

export const businessManagerProcedure = businessDatabaseProcedure.use(({ ctx, next }) => {
  if (
    !ctx.businessRole ||
    !(BUSINESS_MANAGER_ROLES as readonly BusinessRole[]).includes(ctx.businessRole)
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Business manager permission required." });
  }
  return next({ ctx: { ...ctx, businessRole: ctx.businessRole } });
});

export async function requireModuleEnabled(db: any, businessId: number, moduleKey: ModuleKey) {
  const [flag] = await db
    .select({ enabled: businessModules.enabled })
    .from(businessModules)
    .where(
      and(
        eq(businessModules.businessId, businessId),
        eq(businessModules.moduleKey, moduleKey),
      ),
    )
    .limit(1);

  if (!flag?.enabled) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Module ${moduleKey} is not enabled for this business.`,
    });
  }
}

export const moduleEnabledProcedure = (moduleKey: ModuleKey) =>
  businessDatabaseProcedure.use(async ({ ctx, next }) => {
    await requireModuleEnabled(ctx.db, ctx.businessId, moduleKey);
    return next({ ctx: { ...ctx, businessId: ctx.businessId } });
  });

export const businessAdminProcedure = businessDatabaseProcedure.use(({ ctx, next }) => {
  if (
    !ctx.businessRole ||
    !(BUSINESS_ADMIN_ROLES as readonly BusinessRole[]).includes(ctx.businessRole)
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Business administrator permission required." });
  }
  return next({ ctx: { ...ctx, businessRole: ctx.businessRole } });
});

export const platformAdminProcedure = databaseProcedure.use(({ ctx, next }) => {
  const developmentDemo =
    process.env.NODE_ENV !== "production" && process.env.DEV_BUSINESS_CONTEXT_ENABLED === "true";
  if (!developmentDemo && (!ctx.user || ctx.user.platformRole !== "platform_admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform administrator permission required." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// Compatibility export used by the module admin router.
export const adminDatabaseProcedure = platformAdminProcedure;
