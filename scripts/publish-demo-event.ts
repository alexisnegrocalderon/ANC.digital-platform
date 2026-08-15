import "dotenv/config";
import { eq } from "drizzle-orm";
import { events } from "../drizzle/schema";
import { publishEvent } from "../modules/events/service";
import { getDb } from "../server/db";

const db = getDb();
if (!db) throw new Error("DATABASE_URL is required to publish the demo event.");

const existing = await db.select().from(events).where(eq(events.id, 1)).limit(1);
if (!existing[0]) throw new Error("Demo event id=1 does not exist. Run pnpm run seed:events first.");

const event =
  existing[0].status === "published" ? existing[0] : await publishEvent(db, 1, existing[0].id);

console.log(
  JSON.stringify(
    {
      ok: Boolean(event),
      event: event ? { id: event.id, slug: event.slug, status: event.status } : null,
    },
    null,
    2,
  ),
);
