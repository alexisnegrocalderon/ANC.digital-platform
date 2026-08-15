import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { databaseStatus, getDb } from "./db";

export type SessionUser = {
  id: number;
  authSubject: string;
  email: string | null;
  name: string | null;
};

export async function createContext({ req, res }: CreateExpressContextOptions) {
  const businessIdHeader = req.header("x-business-id");
  const businessId = businessIdHeader ? Number(businessIdHeader) : null;

  return {
    req,
    res,
    user: null as SessionUser | null,
    businessId: Number.isInteger(businessId) && businessId && businessId > 0 ? businessId : null,
    db: getDb(),
    database: databaseStatus(),
  };
}

export type AppContext = Awaited<ReturnType<typeof createContext>>;
