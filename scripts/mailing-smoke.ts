import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { notificationOutbox } from "../drizzle/schema";
import { requireDb } from "../server/db";
import { listEmailOutbox, processDueEmailNotifications, queueEmail } from "../modules/mailing/service";

async function main() {
  const db = requireDb();
  const businessId = Number(process.env.SMOKE_BUSINESS_ID ?? 1);
  const token = `mailing-smoke-${Date.now()}`;
  const input = {
    entityType: "course",
    entityId: token,
    eventType: "course_welcome",
    recipient: `${token}@example.test`,
    subject: "Bienvenida",
    templateName: "course_welcome",
    payload: { name: "Smoke" },
    idempotencyKey: token,
  };
  let outboxId: number | undefined;
  try {
    const first = await queueEmail(db, businessId, input);
    const duplicate = await queueEmail(db, businessId, input);
    outboxId = first?.id;
    const processed = await processDueEmailNotifications(db, 10);
    const rows = await listEmailOutbox(db, businessId, 100);
    const current = rows.find((row: { id: number; status: string }) => row.id === outboxId);
    if (!first || !duplicate || first.id !== duplicate.id || current?.status !== "manual_required" || processed.length !== 1) {
      throw new Error("Mailing smoke assertion failed");
    }
    console.log(JSON.stringify({ ok: true, id: current.id, status: current.status, duplicateId: duplicate.id }, null, 2));
  } finally {
    if (outboxId) await db.delete(notificationOutbox).where(and(eq(notificationOutbox.id, outboxId), eq(notificationOutbox.businessId, businessId)));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
