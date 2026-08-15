import { and, eq, inArray, sql } from "drizzle-orm";
import { auditEvents, businessModules } from "../../drizzle/schema";
import type { ModuleKey } from "../../shared/module";
import { resolveActivationPlan } from "../../modules/core/activation";
import { syncModuleCatalog } from "./moduleCatalog";

export async function enableBusinessModules(
  db: any,
  businessId: number,
  requestedModuleKeys: ModuleKey[],
  actorUserId?: number | null,
) {
  const plan = resolveActivationPlan(requestedModuleKeys);
  await syncModuleCatalog();

  await db
    .insert(businessModules)
    .values(
      plan.ordered.map((moduleKey) => ({
        businessId,
        moduleKey,
        enabled: true,
        settings: {},
        disabledAt: null,
      })),
    )
    .onConflictDoUpdate({
      target: [businessModules.businessId, businessModules.moduleKey],
      set: {
        enabled: true,
        disabledAt: null,
        updatedAt: sql`now()`,
      },
    });

  await db.insert(auditEvents).values({
    businessId,
    actorUserId: actorUserId ?? null,
    action: "business_modules.enabled",
    entityType: "business_modules",
    entityId: String(businessId),
    metadata: {
      requested: plan.requested,
      resolved: plan.ordered,
    },
  });

  return plan;
}

export async function disableBusinessModules(
  db: any,
  businessId: number,
  moduleKeys: ModuleKey[],
  actorUserId?: number | null,
) {
  if (moduleKeys.length === 0) return { disabled: [] as ModuleKey[] };

  await db
    .update(businessModules)
    .set({ enabled: false, disabledAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(businessModules.businessId, businessId),
        inArray(businessModules.moduleKey, moduleKeys),
      ),
    );

  await db.insert(auditEvents).values({
    businessId,
    actorUserId: actorUserId ?? null,
    action: "business_modules.disabled",
    entityType: "business_modules",
    entityId: String(businessId),
    metadata: { disabled: moduleKeys },
  });

  return { disabled: moduleKeys };
}
