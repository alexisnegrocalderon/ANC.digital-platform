import { sql } from "drizzle-orm";
import { moduleCatalog } from "../../drizzle/schema";
import { MODULE_MANIFESTS } from "../../modules/core/registry";
import { requireDb } from "../db";

export async function syncModuleCatalog() {
  const db = requireDb();
  const values = Object.values(MODULE_MANIFESTS).map((module) => ({
    moduleKey: module.key,
    displayName: module.displayName,
    description: module.description,
    version: module.version,
    active: true,
    metadata: {
      dependencies: module.dependencies,
      verticals: module.verticals,
      permissions: module.permissions,
    },
  }));

  await db
    .insert(moduleCatalog)
    .values(values)
    .onConflictDoUpdate({
      target: moduleCatalog.moduleKey,
      set: {
        displayName: sql`excluded.display_name`,
        description: sql`excluded.description`,
        version: sql`excluded.version`,
        active: sql`excluded.active`,
        metadata: sql`excluded.metadata`,
        updatedAt: sql`now()`,
      },
    });

  return values.length;
}
