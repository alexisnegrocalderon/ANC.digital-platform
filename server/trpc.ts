import { initTRPC, TRPCError } from "@trpc/server";
import type { AppContext } from "./context";

const t = initTRPC.context<AppContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const businessProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.businessId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A business context is required for this operation.",
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

export const adminDatabaseProcedure = databaseProcedure.use(({ ctx, next }) => {
  // Development can exercise the admin shell with the demo business context.
  // Production remains fail-closed until auth/memberships provide a real role.
  if (process.env.NODE_ENV === "production" && !ctx.user) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "An authenticated administrative session is required for this operation.",
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
