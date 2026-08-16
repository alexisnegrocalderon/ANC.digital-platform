import { and, eq, inArray } from "drizzle-orm";
import { auditEvents, businessModules, moduleFlagOperations } from "../../drizzle/schema";
import type { ModuleKey } from "../../shared/module";
import { MODULE_MANIFESTS } from "../../modules/core/registry";
import { resolveActivationPlan } from "../../modules/core/activation";
import { syncModuleCatalog } from "./moduleCatalog";

type Db = any;

type FlagOperationResult = {
  requested: ModuleKey[];
  resolved: ModuleKey[];
  operation: "enable" | "disable";
  businessId: number;
  idempotencyKey: string;
};

function normalizeOperationKey(
  operation: "enable" | "disable",
  businessId: number,
  moduleKeys: ModuleKey[],
  idempotencyKey?: string | null,
) {
  const provided = idempotencyKey?.trim();
  const base = provided || `${businessId}:${[...moduleKeys].sort().join(",")}`;
  return `${operation}:${base}`.slice(0, 180);
}

async function replayIfPresent(tx: Db, businessId: number, operationKey: string) {
  const existing = await tx
    .select()
    .from(moduleFlagOperations)
    .where(
      and(
        eq(moduleFlagOperations.businessId, businessId),
        eq(moduleFlagOperations.idempotencyKey, operationKey),
      ),
    )
    .limit(1);
  if (!existing[0]) return null;
  return {
    ...(existing[0].result as FlagOperationResult),
    idempotentReplay: true,
  };
}

export async function enableBusinessModules(
  db: Db,
  businessId: number,
  requestedModuleKeys: ModuleKey[],
  actorUserId?: number | null,
  idempotencyKey?: string | null,
) {
  const plan = resolveActivationPlan(requestedModuleKeys);
  const operationKey = normalizeOperationKey("enable", businessId, plan.requested, idempotencyKey);
  await syncModuleCatalog();

  return db.transaction(async (tx: Db) => {
    const replay = await replayIfPresent(tx, businessId, operationKey);
    if (replay) return replay;

    const result: FlagOperationResult = {
      requested: plan.requested,
      resolved: plan.ordered,
      operation: "enable",
      businessId,
      idempotencyKey: operationKey,
    };

    const insertedOperation = await tx
      .insert(moduleFlagOperations)
      .values({
        businessId,
        actorUserId: actorUserId ?? null,
        idempotencyKey: operationKey,
        operation: "enable",
        requestedModules: plan.requested,
        resolvedModules: plan.ordered,
        result,
      })
      .onConflictDoNothing({
        target: [moduleFlagOperations.businessId, moduleFlagOperations.idempotencyKey],
      })
      .returning({ id: moduleFlagOperations.id });

    if (!insertedOperation[0]) {
      const concurrentReplay = await replayIfPresent(tx, businessId, operationKey);
      if (concurrentReplay) return concurrentReplay;
    }

    await tx
      .insert(businessModules)
      .values(
        plan.ordered.map((moduleKey) => ({
          businessId,
          moduleKey,
          enabled: true,
          settings: MODULE_MANIFESTS[moduleKey].defaultSettings,
          disabledAt: null,
        })),
      )
      .onConflictDoUpdate({
        target: [businessModules.businessId, businessModules.moduleKey],
        set: {
          enabled: true,
          disabledAt: null,
          updatedAt: new Date(),
        },
      });

    await tx.insert(auditEvents).values({
      businessId,
      actorUserId: actorUserId ?? null,
      action: "business_modules.enabled",
      entityType: "business_modules",
      entityId: String(businessId),
      metadata: {
        requested: plan.requested,
        resolved: plan.ordered,
        idempotencyKey: operationKey,
      },
    });

    return result;
  });
}

export async function disableBusinessModules(
  db: Db,
  businessId: number,
  moduleKeys: ModuleKey[],
  actorUserId?: number | null,
  idempotencyKey?: string | null,
) {
  if (moduleKeys.length === 0) return { disabled: [] as ModuleKey[] };
  const operationKey = normalizeOperationKey("disable", businessId, moduleKeys, idempotencyKey);

  return db.transaction(async (tx: Db) => {
    const replay = await replayIfPresent(tx, businessId, operationKey);
    if (replay) return replay;

    const result: FlagOperationResult = {
      requested: moduleKeys,
      resolved: moduleKeys,
      operation: "disable",
      businessId,
      idempotencyKey: operationKey,
    };

    const insertedOperation = await tx
      .insert(moduleFlagOperations)
      .values({
        businessId,
        actorUserId: actorUserId ?? null,
        idempotencyKey: operationKey,
        operation: "disable",
        requestedModules: moduleKeys,
        resolvedModules: moduleKeys,
        result,
      })
      .onConflictDoNothing({
        target: [moduleFlagOperations.businessId, moduleFlagOperations.idempotencyKey],
      })
      .returning({ id: moduleFlagOperations.id });

    if (!insertedOperation[0]) {
      const concurrentReplay = await replayIfPresent(tx, businessId, operationKey);
      if (concurrentReplay) return concurrentReplay;
    }

    await tx
      .update(businessModules)
      .set({ enabled: false, disabledAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(businessModules.businessId, businessId),
          inArray(businessModules.moduleKey, moduleKeys),
        ),
      );

    await tx.insert(auditEvents).values({
      businessId,
      actorUserId: actorUserId ?? null,
      action: "business_modules.disabled",
      entityType: "business_modules",
      entityId: String(businessId),
      metadata: { disabled: moduleKeys, idempotencyKey: operationKey },
    });

    return result;
  });
}
