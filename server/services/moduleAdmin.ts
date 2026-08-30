import { and, desc, eq } from "drizzle-orm";
import {
  auditEvents,
  businessModules,
  businesses,
  moduleCatalog,
} from "../../drizzle/schema";
import { BUSINESS_PRESETS, MODULE_MANIFESTS } from "../../modules/core/registry";
import {
  ModuleActivationError,
  resolveActivationPlan,
  validateModuleSettings,
} from "../../modules/core/activation";
import type { ModuleKey } from "../../shared/module";
import { disableBusinessModules, enableBusinessModules } from "./businessModules";

const MATURITY_BLOCKED = new Set(["planned", "contract-ready", "scaffolded"]);

export type OnboardingChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  doneAt: string | null;
};

export const DEFAULT_ONBOARDING_CHECKLIST: OnboardingChecklistItem[] = [
  { key: "repo_created", label: "Repo creado desde la plantilla", done: false, doneAt: null },
  { key: "vercel_connected", label: "Proyecto Vercel conectado", done: false, doneAt: null },
  { key: "database_created", label: "Base de datos Neon creada", done: false, doneAt: null },
  { key: "migrations_run", label: "Migraciones corridas", done: false, doneAt: null },
  { key: "modules_configured", label: "Módulos activados", done: false, doneAt: null },
  { key: "branding_applied", label: "Marca y colores aplicados al sitio", done: false, doneAt: null },
  { key: "domain_connected", label: "Dominio conectado", done: false, doneAt: null },
  { key: "delivered", label: "Entregado al cliente", done: false, doneAt: null },
];

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
      brandColor: businesses.brandColor,
      logoUrl: businesses.logoUrl,
      repoUrl: businesses.repoUrl,
      vercelUrl: businesses.vercelUrl,
      notes: businesses.notes,
      onboardingChecklist: businesses.onboardingChecklist,
    })
    .from(businesses)
    .orderBy(businesses.name);
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export async function createBusinessForAdmin(
  db: any,
  input: {
    name: string;
    slug?: string;
    currency?: string;
    timezone?: string;
    brandColor?: string;
    logoUrl?: string;
    repoUrl?: string;
    vercelUrl?: string;
    notes?: string;
  },
) {
  const name = input.name.trim();
  if (!name) throw new Error("El nombre del negocio es obligatorio.");
  const baseSlug = slugify(input.slug?.trim() || name) || `negocio-${Date.now()}`;

  let slug = baseSlug;
  let attempt = 1;
  while (true) {
    const existing = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, slug)).limit(1);
    if (existing.length === 0) break;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  const [row] = await db
    .insert(businesses)
    .values({
      name,
      slug,
      currency: input.currency?.trim() || undefined,
      timezone: input.timezone?.trim() || undefined,
      brandColor: input.brandColor?.trim() || undefined,
      logoUrl: input.logoUrl?.trim() || undefined,
      repoUrl: input.repoUrl?.trim() || undefined,
      vercelUrl: input.vercelUrl?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      onboardingChecklist: DEFAULT_ONBOARDING_CHECKLIST.map((item) => ({ ...item })),
    })
    .returning();
  return row;
}

export async function updateBusinessDetails(
  db: any,
  input: {
    businessId: number;
    brandColor?: string | null;
    logoUrl?: string | null;
    repoUrl?: string | null;
    vercelUrl?: string | null;
    notes?: string | null;
  },
) {
  const { businessId, ...fields } = input;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if ("brandColor" in fields) updates.brandColor = fields.brandColor?.trim() || null;
  if ("logoUrl" in fields) updates.logoUrl = fields.logoUrl?.trim() || null;
  if ("repoUrl" in fields) updates.repoUrl = fields.repoUrl?.trim() || null;
  if ("vercelUrl" in fields) updates.vercelUrl = fields.vercelUrl?.trim() || null;
  if ("notes" in fields) updates.notes = fields.notes?.trim() || null;

  const [row] = await db
    .update(businesses)
    .set(updates)
    .where(eq(businesses.id, businessId))
    .returning();
  if (!row) throw new Error(`Business ${businessId} not found.`);
  return row;
}

export async function toggleBusinessChecklistItem(
  db: any,
  input: { businessId: number; key: string; done: boolean },
) {
  const [row] = await db.select().from(businesses).where(eq(businesses.id, input.businessId)).limit(1);
  if (!row) throw new Error(`Business ${input.businessId} not found.`);

  const checklist: OnboardingChecklistItem[] = Array.isArray(row.onboardingChecklist)
    ? row.onboardingChecklist
    : [];
  const index = checklist.findIndex((item) => item.key === input.key);
  if (index === -1) {
    throw new Error(`Checklist item "${input.key}" not found for business ${input.businessId}.`);
  }

  const updatedChecklist = checklist.map((item, itemIndex) =>
    itemIndex === index
      ? { ...item, done: input.done, doneAt: input.done ? new Date().toISOString() : null }
      : item,
  );

  const [updated] = await db
    .update(businesses)
    .set({ onboardingChecklist: updatedChecklist, updatedAt: new Date() })
    .where(eq(businesses.id, input.businessId))
    .returning();
  return updated;
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

export async function applyAdminPreset(
  db: any,
  businessId: number,
  presetKey: string,
  actorUserId?: number | null,
  idempotencyKey?: string | null,
) {
  const preset = BUSINESS_PRESETS.find((candidate) => candidate.key === presetKey);
  if (!preset) throw new ModuleActivationError(`Unknown business preset: ${presetKey}.`);
  const result = await enableAdminModules(db, businessId, preset.moduleKeys, actorUserId, idempotencyKey);
  return { preset, result };
}

export async function enableAdminModules(
  db: any,
  businessId: number,
  moduleKeys: ModuleKey[],
  actorUserId?: number | null,
  idempotencyKey?: string | null,
) {
  const plan = resolveActivationPlan(moduleKeys);
  const blocked = plan.ordered.filter((key) => MATURITY_BLOCKED.has(MODULE_MANIFESTS[key].maturity));
  if (blocked.length > 0) {
    throw new ModuleActivationError(
      `Estos módulos todavía no están implementados y no se pueden activar para un cliente real: ${blocked.join(", ")}.`,
    );
  }
  return enableBusinessModules(db, businessId, plan.ordered, actorUserId, idempotencyKey);
}

export async function disableAdminModules(
  db: any,
  businessId: number,
  moduleKeys: ModuleKey[],
  actorUserId?: number | null,
  idempotencyKey?: string | null,
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
  return disableBusinessModules(db, businessId, moduleKeys, actorUserId, idempotencyKey);
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
