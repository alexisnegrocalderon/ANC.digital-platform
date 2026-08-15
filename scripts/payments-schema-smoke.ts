import "dotenv/config";
import { sql } from "drizzle-orm";
import { getDb } from "../server/db";

const db = getDb();
if (!db) throw new Error("DATABASE_URL is not configured.");

const rows = await db.execute<{ table_name: string }>(sql`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_name in ('payment_provider_accounts', 'payment_attempts', 'payment_webhook_events')
  order by table_name
`);

const tables = rows.rows.map((row) => row.table_name);
const expected = ["payment_attempts", "payment_provider_accounts", "payment_webhook_events"];
if (tables.join(",") !== expected.join(",")) {
  throw new Error(`Payment schema incomplete: ${tables.join(",")}`);
}

console.log(JSON.stringify({ ok: true, tables }, null, 2));
