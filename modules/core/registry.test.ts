import { describe, expect, it } from "vitest";
import { BUSINESS_PRESETS, MODULE_MANIFESTS } from "./registry";

const manifestKeys = Object.keys(MODULE_MANIFESTS);

function assertNoDependencyCycle(key: string, path: string[] = []) {
  if (path.includes(key)) {
    throw new Error(`Dependency cycle detected: ${[...path, key].join(" -> ")}`);
  }

  const manifest = MODULE_MANIFESTS[key as keyof typeof MODULE_MANIFESTS];
  if (!manifest) throw new Error(`Missing manifest for ${key}`);

  for (const dependency of manifest.dependencies) {
    assertNoDependencyCycle(dependency, [...path, key]);
  }
}

describe("module registry", () => {
  it("contains twenty registered modules", () => {
    expect(manifestKeys).toHaveLength(20);
    expect(new Set(manifestKeys).size).toBe(20);
  });

  it("has valid dependencies and no cycles", () => {
    for (const manifest of Object.values(MODULE_MANIFESTS)) {
      for (const dependency of manifest.dependencies) {
        expect(MODULE_MANIFESTS[dependency]).toBeDefined();
      }
      assertNoDependencyCycle(manifest.key);
    }
  });

  it("has complete metadata for the admin catalog", () => {
    for (const manifest of Object.values(MODULE_MANIFESTS)) {
      expect(manifest.skillKey).toMatch(/^modulo-/);
      expect(["offer", "commerce", "customer", "operations", "intelligence"]).toContain(manifest.category);
      expect(["implemented", "implemented-hardening", "scaffolded", "contract-ready", "planned"]).toContain(manifest.maturity);
      expect(manifest.setupChecklist.length).toBeGreaterThan(0);
      expect(manifest.capabilities.length).toBeGreaterThan(0);
    }
  });

  it("provides reusable vertical presets", () => {
    expect(BUSINESS_PRESETS.map((preset) => preset.key)).toEqual([
      "events",
      "restaurant",
      "salon",
      "retail",
      "gym",
      "services",
    ]);

    for (const preset of BUSINESS_PRESETS) {
      expect(preset.moduleKeys.length).toBeGreaterThan(0);
      for (const moduleKey of preset.moduleKeys) {
        expect(MODULE_MANIFESTS[moduleKey]).toBeDefined();
      }
    }
  });
});
