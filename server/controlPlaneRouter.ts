import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { Router, type Express, type Request, type Response } from "express";
import { z } from "zod";
import {
  auditEvents,
  businesses,
  businessModules,
  controlPlaneIdempotency,
  moduleCatalog,
} from "../drizzle/schema";
import { MODULE_MANIFESTS } from "../modules/core/registry";
import { ModuleActivationError, resolveActivationPlan, validateModuleSettings } from "../modules/core/activation";
import type { ModuleKey } from "../shared/module";
import {
  ControlPlaneAuthError,
  controlPlaneClientId,
  requireControlPlaneScope,
  requestId,
  verifyControlPlaneRequest,
  type ControlPlaneScope,
} from "./controlPlaneAuth";
import { getDb, requireDb } from "./db";

const createBusinessSchema = z.object({
  externalProjectId: z.string().min(1).max(180),
  environment: z.enum(["sandbox", "staging", "production"]),
  name: z.string().min(2).max(180),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(96),
  vertical: z.string().max(120).optional(),
  timezone: z.string().min(3).max(64).default("America/Santiago"),
  currency: z.string().length(3).default("CLP"),
  publicUrl: z.string().url().optional(),
});

const operationSchema = z.object({
  operation: z.enum(["enable", "disable"]),
  moduleKeys: z.array(z.string().min(1).max(96)).min(1).max(20),
  cascade: z.boolean().default(false),
  reason: z.string().max(240).optional(),
});

const presetSchema = z.object({
  selectedModuleKeys: z.array(z.string().min(1).max(96)).min(1).max(20).optional(),
  mode: z.literal("apply").default("apply"),
});

function sendError(response: Response, status: number, code: string, message: string, requestIdValue: string, details?: unknown, retryable = false) {
  return response.status(status).json({
    error: { code, message, details, retryable },
    requestId: requestIdValue,
  });
}

function hashBody(body: unknown) {
  return createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");
}

function idempotencyKey(request: Request) {
  const value = request.header("idempotency-key")?.trim();
  if (!value || value.length > 180) {
    throw new ControlPlaneAuthError(400, "INVALID_REQUEST", "Idempotency-Key is required and must be at most 180 characters.");
  }
  return value;
}

async function startIdempotency(request: Request, operation: string, body: unknown, clientId: string) {
  const db = requireDb();
  const key = idempotencyKey(request);
  const id = requestId(request);
  const requestHash = hashBody(body);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db
    .insert(controlPlaneIdempotency)
    .values({ clientId, idempotencyKey: key, requestHash, operation, status: "processing", response: {}, requestId: id, expiresAt })
    .onConflictDoNothing({ target: [controlPlaneIdempotency.clientId, controlPlaneIdempotency.idempotencyKey] });

  const [record] = await db
    .select()
    .from(controlPlaneIdempotency)
    .where(and(eq(controlPlaneIdempotency.clientId, clientId), eq(controlPlaneIdempotency.idempotencyKey, key)))
    .limit(1);
  if (!record) throw new Error("Unable to create idempotency record.");
  if (record.requestHash !== requestHash) {
    throw new ControlPlaneAuthError(409, "IDEMPOTENCY_CONFLICT", "Idempotency-Key was already used with a different request body.");
  }
  if (record.status === "applied") return { db, key, id, record, replayed: true as const };
  if (record.status === "processing" && record.requestId !== id) {
    throw new ControlPlaneAuthError(409, "IDEMPOTENCY_IN_PROGRESS", "The same operation is already being processed.");
  }
  return { db, key, id, record, replayed: false as const };
}

async function finishIdempotency(db: ReturnType<typeof requireDb>, clientId: string, key: string, status: "applied" | "failed", response: Record<string, unknown>) {
  await db
    .update(controlPlaneIdempotency)
    .set({ status, response })
    .where(and(eq(controlPlaneIdempotency.clientId, clientId), eq(controlPlaneIdempotency.idempotencyKey, key)));
}

function moduleKeys(values: string[]) {
  return values as ModuleKey[];
}

function resolveOperation(moduleKeysRequested: ModuleKey[], enabledKeys: Set<string>, operation: "enable" | "disable", cascade: boolean) {
  if (operation === "enable") {
    const plan = resolveActivationPlan(moduleKeysRequested);
    return {
      requested: plan.requested,
      resolved: plan.ordered,
      alreadyEnabled: plan.ordered.filter((key) => enabledKeys.has(key)),
      willChange: plan.ordered.filter((key) => !enabledKeys.has(key)),
      blocked: [],
    };
  }

  const requested = [...new Set(moduleKeysRequested)];
  const dependents = Object.values(MODULE_MANIFESTS)
    .filter((manifest) => manifest.dependencies.some((dependency) => requested.includes(dependency)) && enabledKeys.has(manifest.key))
    .map((manifest) => manifest.key);
  if (dependents.length > 0 && !cascade) {
    throw new ControlPlaneAuthError(409, "MODULE_HAS_DEPENDENTS", "Cannot disable a module while dependent modules are active.",);
  }
  const resolved = cascade ? [...new Set([...requested, ...dependents])] : requested;
  return {
    requested,
    resolved,
    alreadyEnabled: resolved.filter((key) => enabledKeys.has(key)),
    willChange: resolved.filter((key) => enabledKeys.has(key)),
    blocked: dependents,
  };
}

function scopeFor(operation: string): ControlPlaneScope {
  return operation === "read" ? "platform.modules.read" : "platform.modules.write";
}

export function registerControlPlaneRoutes(app: Express) {
  const router = Router();

  router.use(async (request, _response, next) => {
    try {
      const claims = await verifyControlPlaneRequest(request);
      request.controlPlaneClaims = claims;
      next();
    } catch (error) {
      next(error);
    }
  });

  router.post("/businesses", async (request, response) => {
    const id = requestId(request);
    try {
      const claims = request.controlPlaneClaims!;
      requireControlPlaneScope(claims, "platform.business.write");
      const input = createBusinessSchema.parse(request.body);
      const clientId = controlPlaneClientId(claims);
      const idem = await startIdempotency(request, "business.create", input, clientId);
      if (idem.replayed) return response.status(200).json({ data: idem.record.response, replayed: true, requestId: id });

      const db = idem.db;
      const [existing] = await db
        .select()
        .from(businesses)
        .where(and(eq(businesses.externalProjectId, input.externalProjectId), eq(businesses.environment, input.environment)))
        .limit(1);
      const business = existing ?? (await db.insert(businesses).values({ ...input, currency: input.currency.toUpperCase() }).returning())[0];
      if (!business) throw new Error("Business could not be created.");

      const data = {
        businessId: business.id,
        slug: business.slug,
        status: business.status,
        environment: business.environment,
        created: !existing,
        links: {
          modules: `/api/v1/control-plane/businesses/${business.id}/modules`,
          health: `/api/v1/control-plane/businesses/${business.id}/health`,
        },
      };
      await finishIdempotency(db, clientId, idem.key, "applied", data);
      return response.status(existing ? 200 : 201).json({ data, requestId: id });
    } catch (error) {
      return handleControlPlaneError(error, response, id);
    }
  });

  router.get("/businesses/:businessId", async (request, response) => {
    const id = requestId(request);
    try {
      const claims = request.controlPlaneClaims!;
      requireControlPlaneScope(claims, "platform.business.read");
      const [business] = await requireDb().select().from(businesses).where(eq(businesses.id, Number(request.params.businessId))).limit(1);
      if (!business) return sendError(response, 404, "BUSINESS_NOT_FOUND", "Business not found.", id);
      return response.json({ data: business, requestId: id });
    } catch (error) {
      return handleControlPlaneError(error, response, id);
    }
  });

  router.get("/businesses/:businessId/modules", async (request, response) => {
    const id = requestId(request);
    try {
      const claims = request.controlPlaneClaims!;
      requireControlPlaneScope(claims, "platform.modules.read");
      const businessId = Number(request.params.businessId);
      const rows = await requireDb()
        .select({ catalog: moduleCatalog, flag: businessModules })
        .from(moduleCatalog)
        .leftJoin(businessModules, and(eq(businessModules.moduleKey, moduleCatalog.moduleKey), eq(businessModules.businessId, businessId)));
      return response.json({ data: { businessId, modules: rows.map(({ catalog, flag }) => ({
        key: catalog.moduleKey,
        displayName: catalog.displayName,
        description: catalog.description,
        version: catalog.version,
        enabled: flag?.enabled ?? false,
        settings: flag?.settings ?? {},
        metadata: catalog.metadata,
      })) }, requestId: id });
    } catch (error) {
      return handleControlPlaneError(error, response, id);
    }
  });

  router.get("/businesses/:businessId/health", async (request, response) => {
    const id = requestId(request);
    try {
      requireControlPlaneScope(request.controlPlaneClaims!, "platform.health.read");
      const businessId = Number(request.params.businessId);
      const [business] = await requireDb().select({ id: businesses.id, status: businesses.status }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
      if (!business) return sendError(response, 404, "BUSINESS_NOT_FOUND", "Business not found.", id);
      return response.json({ data: { businessId, status: business.status, core: "healthy", database: "configured", checkedAt: new Date().toISOString() }, requestId: id });
    } catch (error) {
      return handleControlPlaneError(error, response, id);
    }
  });

  const preview = async (request: Request, response: Response) => {
    const id = requestId(request);
    try {
      requireControlPlaneScope(request.controlPlaneClaims!, "platform.modules.read");
      const input = operationSchema.parse(request.body);
      const businessId = Number(request.params.businessId);
      const rows = await requireDb().select({ moduleKey: businessModules.moduleKey, enabled: businessModules.enabled }).from(businessModules).where(eq(businessModules.businessId, businessId));
      const plan = resolveOperation(moduleKeys(input.moduleKeys), new Set(rows.filter((row) => row.enabled).map((row) => row.moduleKey)), input.operation, input.cascade);
      return response.json({ data: plan, requestId: id });
    } catch (error) {
      return handleControlPlaneError(error, response, id);
    }
  };

  router.post("/businesses/:businessId/modules/operations/preview", preview);

  router.post("/businesses/:businessId/modules/operations", async (request, response) => {
    const id = requestId(request);
    try {
      const claims = request.controlPlaneClaims!;
      requireControlPlaneScope(claims, "platform.modules.write");
      const input = operationSchema.parse(request.body);
      const businessId = Number(request.params.businessId);
      const clientId = controlPlaneClientId(claims);
      const idem = await startIdempotency(request, `business.modules.${input.operation}`, { businessId, ...input }, clientId);
      if (idem.replayed) return response.status(200).json({ data: idem.record.response, replayed: true, requestId: id });

      const db = idem.db;
      const rows = await db.select({ moduleKey: businessModules.moduleKey, enabled: businessModules.enabled }).from(businessModules).where(eq(businessModules.businessId, businessId));
      const plan = resolveOperation(moduleKeys(input.moduleKeys), new Set(rows.filter((row) => row.enabled).map((row) => row.moduleKey)), input.operation, input.cascade);
      for (const moduleKey of plan.resolved) {
        const settings = validateModuleSettings(moduleKey, {});
        await db.insert(businessModules).values({ businessId, moduleKey, enabled: input.operation === "enable", settings, disabledAt: input.operation === "disable" ? new Date() : null }).onConflictDoUpdate({ target: [businessModules.businessId, businessModules.moduleKey], set: { enabled: input.operation === "enable", settings, disabledAt: input.operation === "disable" ? new Date() : null, updatedAt: new Date() } });
      }
      const result = { operationId: randomUUID(), status: "applied", ...plan };
      await db.insert(auditEvents).values({ businessId, action: `control_plane.modules.${input.operation}`, entityType: "business_modules", entityId: String(businessId), metadata: { ...result, reason: input.reason, clientId } });
      await finishIdempotency(db, clientId, idem.key, "applied", result);
      return response.status(200).json({ data: result, requestId: id });
    } catch (error) {
      return handleControlPlaneError(error, response, id);
    }
  });

  router.post("/businesses/:businessId/presets/:presetKey/apply", async (request, response) => {
    const id = requestId(request);
    try {
      const claims = request.controlPlaneClaims!;
      requireControlPlaneScope(claims, "platform.modules.write");
      const input = presetSchema.parse(request.body ?? {});
      const requested = input.selectedModuleKeys ?? presetModules(request.params.presetKey);
      const businessId = Number(request.params.businessId);
      const clientId = controlPlaneClientId(claims);
      const idem = await startIdempotency(request, `business.preset.${request.params.presetKey}`, { businessId, preset: request.params.presetKey, requested }, clientId);
      if (idem.replayed) return response.status(200).json({ data: idem.record.response, replayed: true, requestId: id });
      const rows = await idem.db.select({ moduleKey: businessModules.moduleKey, enabled: businessModules.enabled }).from(businessModules).where(eq(businessModules.businessId, businessId));
      const plan = resolveOperation(moduleKeys(requested), new Set(rows.filter((row) => row.enabled).map((row) => row.moduleKey)), "enable", false);
      for (const moduleKey of plan.resolved) {
        await idem.db.insert(businessModules).values({ businessId, moduleKey, enabled: true, settings: validateModuleSettings(moduleKey, {}) }).onConflictDoUpdate({ target: [businessModules.businessId, businessModules.moduleKey], set: { enabled: true, disabledAt: null, updatedAt: new Date() } });
      }
      const result = { presetKey: request.params.presetKey, status: "applied", ...plan };
      await idem.db.insert(auditEvents).values({ businessId, action: "control_plane.preset.applied", entityType: "business_modules", entityId: String(businessId), metadata: { ...result, clientId } });
      await finishIdempotency(idem.db, clientId, idem.key, "applied", result);
      return response.status(200).json({ data: result, requestId: id });
    } catch (error) {
      return handleControlPlaneError(error, response, id);
    }
  });

  app.use("/api/v1/control-plane", router);
}

function presetModules(presetKey: string): string[] {
  const presets: Record<string, string[]> = {
    events: ["catalogue", "orders", "payments", "ticketing", "access", "notifications", "reporting"],
    restaurant: ["catalogue", "pricing", "orders", "payments", "pos", "inventory", "notifications", "reporting"],
    salon: ["catalogue", "crm", "reservations", "notifications", "payments", "reporting"],
    retail: ["catalogue", "pricing", "orders", "payments", "inventory", "delivery", "reporting"],
    gym: ["crm", "reservations", "payments", "notifications", "loyalty", "reporting"],
    services: ["catalogue", "crm", "reservations", "payments", "notifications", "reporting"],
  };
  const modules = presets[presetKey];
  if (!modules) throw new ControlPlaneAuthError(422, "PRESET_NOT_FOUND", `Unknown preset ${presetKey}.`);
  return modules;
}

function handleControlPlaneError(error: unknown, response: Response, id: string) {
  if (error instanceof ControlPlaneAuthError) return sendError(response, error.status, error.code, error.message, id, undefined, error.status >= 500);
  if (error instanceof z.ZodError) return sendError(response, 400, "INVALID_REQUEST", "Request body is invalid.", id, error.flatten());
  if (error instanceof ModuleActivationError) return sendError(response, 422, "MODULE_NOT_AVAILABLE", error.message, id);
  console.error("[control-plane] request failed", { requestId: id, error });
  return sendError(response, 500, "INTERNAL_ERROR", "Control-plane operation failed.", id, undefined, true);
}

declare global {
  namespace Express {
    interface Request {
      controlPlaneClaims?: import("./controlPlaneAuth").ControlPlaneClaims;
    }
  }
}
