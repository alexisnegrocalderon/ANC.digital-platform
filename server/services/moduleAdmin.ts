import { and, desc, eq } from "drizzle-orm";
import {
  auditEvents,
  businessModules,
  businesses,
  moduleCatalog,
} from "../../drizzle/schema";
import { MODULE_MANIFESTS } from "../../modules/core/registry";
import {
  ModuleActivationError,
  resolveActivationPlan,
  validateModuleSettings,
} from "../../modules/core/activation";
import type { ModuleKey } from "../../shared/module";
import { disableBusinessModules, enableBusinessModules } from "./businessModules";

const MATURITY_BLOCKED = new Set(["planned", "contract-ready", "scaffolded"]);

type ModuleAdminStatus = "active" | "pending_setup" | "blocked" | "error" | "disabled";

function settingsConfigured(settings: Record<string, unknown>, checklist: string[]) {
  if (checklist.length === 0) return true;
  return Object.keys(settings).length > 0;
}

function getStatus(
  enabled: boolean,
  maturity: string,
  requiresSetup: boolean,
  settings: Record<string, unknown>,
  setupChecklist: string[],
): ModuleAdminStatus {
  if (!enabled) return "disabled";
  if (MATURITY_BLOCKED.has(maturity)) return "blocked";
  if (requiresSetup && !settingsConfigured(settings, setupChecklist)) return "pending_setup";
  return "active";
}

export async function listBusinessesForAdmin(db: any) {
  return db
    .select({
      id: businesses.id,
      slug: businesses.slug,
      name: businesses.name,
      status: businesses.status,
      timezone: businesses.timezone,
      currency: businesses.currency,
    })
    .from(businesses)
    .orderBy(businesses.name);
}

export async function getAdminModuleCatalog(db: any, businessId?: number) {
  const [catalogRows, enabledRows] = await Promise.all([
    db.select().from(moduleCatalog).where(eq(moduleCatalog.active, true)),
    businessId
      ? db.select().from(businessModules).where(eq(businessModules.businessId, businessId))
      : Promise.resolve([]),
  ]);

  const businessState = new Map<string, any>(
    enabledRows.map((row: any) => [row.moduleKey as string, row] as [string, any]),
  );
  return Object.values(MODULE_MANIFESTS).map((manifest) => {
    const catalogRow = catalogRows.find((row: any) => row.moduleKey === manifest.key);
    const current = businessState.get(manifest.key);
    const settings = (current?.settings ?? {}) as Record<string, unknown>;
    const status = getStatus(
      current?.enabled === true,
      manifest.maturity,
      manifest.requiresSetup,
      settings,
      manifest.setupChecklist,
    );
    return {
      key: manifest.key,
      displayName: manifest.displayName,
      description: manifest.description,
      category: manifest.category,
      version: manifest.version,
      skillKey: manifest.skillKey,
      maturity: manifest.maturity,
      requiresSetup: manifest.requiresSetup,
      setupChecklist: manifest.setupChecklist,
      capabilities: manifest.capabilities,
      dependencies: manifest.dependencies,
      verticals: manifest.verticals,
      enabled: current?.enabled === true,
      settings,
      status,
      statusReason:
        status === "blocked"
          ? `Runtime pendiente de implementación completa (${manifest.maturity}).`
          : status === "pending_setup"
            ? "Completa el checklist de configuración del negocio."
            : status === "disabled"
              ? "No está habilitado para este negocio."
              : "Configuración mínima disponible.",
      catalogMetadata: catalogRow?.metadata ?? {},
    };
  });
}

export function getAdminActivationPlan(moduleKeys: ModuleKey[]) {
  return resolveActivationPlan(moduleKeys);
}

export async function enableAdminModules(
  db: any,
  businessId: number,
  moduleKeys: ModuleKey[],
  actorUserId?: number | null,
) {
  const plan = resolveActivationPlan(moduleKeys);
  const blocked = plan.ordered.filter((key) => MATURITY_BLOCKED.has(MODULE_MANIFESTS[key].maturity));
  if (blocked.length > 0) {
    throw new ModuleActivationError(
      `Modules are not activatable until their runtime is implemented: ${blocked.join(", ")}.`,
    );
  }
  return enableBusinessModules(db, businessId, plan.ordered, actorUserId);
}

export async function disableAdminModules(
  db: any,
  businessId: number,
  moduleKeys: ModuleKey[],
  actorUserId?: number | null,
) {
  const catalog = await getAdminModuleCatalog(db, businessId);
  const active = new Set(catalog.filter((module) => module.enabled).map((module) => module.key));
  const dependents = catalog
    .filter(
      (module) =>
        active.has(module.key) &&
        module.dependencies.some((dependency) => moduleKeys.includes(dependency)),
    )
    .map((module) => module.key);
  if (dependents.length > 0) {
    throw new ModuleActivationError(
      `Disable dependent modules first: ${[...new Set(dependents)].join(", ")}.`,
    );
  }
  return disableBusinessModules(db, businessId, moduleKeys, actorUserId);
}

export async function updateAdminModuleSettings(
  db: any,
  businessId: number,
  moduleKey: ModuleKey,
  settings: Record<string, unknown>,
  actorUserId?: number | null,
) {
  const validated = validateModuleSettings(moduleKey, settings);
  const result = await db
    .update(businessModules)
    .set({ settings: validated, updatedAt: new Date() })
    .where(and(eq(businessModules.businessId, businessId), eq(businessModules.moduleKey, moduleKey)))
    .returning();
  if (!result[0]) {
    throw new ModuleActivationError(`Module ${moduleKey} is not enabled for this business.`);
  }
  await db.insert(auditEvents).values({
    businessId,
    actorUserId: actorUserId ?? null,
    action: "business_modules.settings_updated",
    entityType: "business_modules",
    entityId: String(businessId),
    metadata: { moduleKey, settings: validated },
  });
  return result[0];
}

export async function getModuleAdminHealth(db: any, businessId: number) {
  const catalog = await getAdminModuleCatalog(db, businessId);
  return catalog.map((module) => ({
    moduleKey: module.key,
    status: module.status,
    enabled: module.enabled,
    maturity: module.maturity,
    requiresSetup: module.requiresSetup,
    setupChecklist: module.setupChecklist,
    checkedAt: new Date().toISOString(),
  }));
}

export async function getModuleChangeAudit(db: any, businessId: number, limit = 50) {
  return db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.businessId, businessId), eq(auditEvents.entityType, "business_modules")))
    .orderBy(desc(auditEvents.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}
