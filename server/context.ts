import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { and, eq } from "drizzle-orm";
import { memberships } from "../drizzle/schema";
import { BUSINESS_ROLE_KEYS, type BusinessRole } from "../shared/auth";
import { databaseStatus, getDb } from "./db";
import { getAuthenticatedUser, type AuthenticatedUser } from "./auth";

export type AppContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
  businessId: number | null;
  businessRole: BusinessRole | null;
  db: ReturnType<typeof getDb>;
  database: ReturnType<typeof databaseStatus>;
};

export async function createContext({ req, res }: CreateExpressContextOptions): Promise<AppContext> {
  const db = getDb();
  const user = await getAuthenticatedUser(req);
  let businessId: number | null = null;
  let businessRole: BusinessRole | null = null;

  if (user && db) {
    const requestedBusinessId = Number(req.header("x-business-id"));
    const conditions = [eq(memberships.userId, user.id), eq(memberships.status, "active")];
    if (Number.isInteger(requestedBusinessId) && requestedBusinessId > 0) {
      conditions.push(eq(memberships.businessId, requestedBusinessId));
    }
    const membership = await db
      .select({ businessId: memberships.businessId, roleKey: memberships.roleKey })
      .from(memberships)
      .where(and(...conditions))
      .limit(1);
    const active = membership[0];
    if (active) {
      businessId = active.businessId;
      businessRole = BUSINESS_ROLE_KEYS.includes(active.roleKey as BusinessRole)
        ? (active.roleKey as BusinessRole)
        : "viewer";
    }
  } else if (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_BUSINESS_CONTEXT_ENABLED === "true"
  ) {
    const demoBusinessId = Number(req.header("x-business-id"));
    if (Number.isInteger(demoBusinessId) && demoBusinessId > 0) {
      businessId = demoBusinessId;
      businessRole = "owner";
    }
  }

  return {
    req,
    res,
    user,
    businessId,
    businessRole,
    db,
    database: databaseStatus(),
  };
}
