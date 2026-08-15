import { getModuleManifest, MODULE_MANIFESTS } from "./registry";
import type { ModuleKey } from "../../shared/module";

export type ActivationPlan = {
  requested: ModuleKey[];
  ordered: ModuleKey[];
};

export class ModuleActivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModuleActivationError";
  }
}

export function resolveActivationPlan(requested: ModuleKey[]): ActivationPlan {
  const ordered: ModuleKey[] = [];
  const visiting = new Set<ModuleKey>();
  const visited = new Set<ModuleKey>();

  const visit = (moduleKey: ModuleKey) => {
    if (visited.has(moduleKey)) return;
    if (visiting.has(moduleKey)) {
      throw new ModuleActivationError(`Module dependency cycle includes ${moduleKey}.`);
    }

    const module = getModuleManifest(moduleKey);
    if (!module) {
      throw new ModuleActivationError(`Unknown module ${moduleKey}.`);
    }

    visiting.add(moduleKey);
    for (const dependency of module.dependencies) visit(dependency);
    visiting.delete(moduleKey);
    visited.add(moduleKey);
    ordered.push(moduleKey);
  };

  for (const moduleKey of requested) visit(moduleKey);

  return { requested: [...new Set(requested)], ordered };
}

export function validateModuleSettings(moduleKey: ModuleKey, settings: Record<string, unknown>) {
  const module = MODULE_MANIFESTS[moduleKey];
  if (!module) throw new ModuleActivationError(`Unknown module ${moduleKey}.`);

  const allowedKeys = new Set(Object.keys(module.defaultSettings));
  const unknownKeys = Object.keys(settings).filter((key) => allowedKeys.size > 0 && !allowedKeys.has(key));

  if (unknownKeys.length > 0) {
    throw new ModuleActivationError(
      `Unsupported settings for ${moduleKey}: ${unknownKeys.join(", ")}.`,
    );
  }

  return {
    ...module.defaultSettings,
    ...settings,
  };
}
