import "dotenv/config";
import { sql } from "drizzle-orm";
import { getDb } from "../server/db";

const db = getDb();
if (!db) throw new Error("DATABASE_URL is not configured.");

const rows = await db.execute<{ table_name: string }>(sql`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_name in (
      'booking_services',
      'booking_staff',
      'booking_availability_rules',
      'booking_availability_overrides',
      'appointments',
      'appointment_notifications',
      'whatsapp_accounts'
    )
  order by table_name
`);
const tables = rows.rows.map((row) => row.table_name);
const expected = [
  "appointment_notifications",
  "appointments",
  "booking_availability_overrides",
  "booking_availability_rules",
  "booking_services",
  "booking_staff",
  "whatsapp_accounts",
];
if (tables.join(",") !== expected.join(",")) {
  throw new Error(`Booking schema incomplete: ${tables.join(",")}`);
}
console.log(JSON.stringify({ ok: true, tables }, null, 2));
