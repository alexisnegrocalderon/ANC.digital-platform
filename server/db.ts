import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../drizzle/schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || null;
}

export function getDb() {
  if (dbInstance) return dbInstance;

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) return null;

  const sql = neon(databaseUrl);
  dbInstance = drizzle({ client: sql, schema });
  return dbInstance;
}

export function requireDb() {
  const db = getDb();
  if (!db) {
    throw new Error(
      "DATABASE_URL is not configured. Add the pooled Neon connection string before using database procedures.",
    );
  }
  return db;
}

export function databaseStatus() {
  return {
    configured: Boolean(getDatabaseUrl()),
    driver: "neon-http",
    connectionMode: "pooled-runtime",
  } as const;
}
