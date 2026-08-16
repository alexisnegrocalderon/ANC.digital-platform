import fs from "node:fs/promises";
import path from "node:path";
import { MODULE_MANIFESTS } from "../modules/core/registry";

const catalogPath = path.resolve(process.cwd(), "docs/modules/module-catalog.md");
const catalog = await fs.readFile(catalogPath, "utf8");
const registryKeys = Object.keys(MODULE_MANIFESTS).sort();
const documentedKeys = [...catalog.matchAll(/\|\s*\d+\s*\|\s*`([^`]+)`\s*\|/g)].map((match) => match[1]).sort();
const duplicateKeys = documentedKeys.filter((key, index) => documentedKeys.indexOf(key) !== index);
const missingKeys = registryKeys.filter((key) => !documentedKeys.includes(key));
const extraKeys = documentedKeys.filter((key) => !registryKeys.includes(key));

if (registryKeys.length !== 20) {
  throw new Error(`Expected exactly 20 registry modules, found ${registryKeys.length}.`);
}
if (documentedKeys.length !== 20) {
  throw new Error(`Expected exactly 20 documented modules, found ${documentedKeys.length}.`);
}
if (duplicateKeys.length || missingKeys.length || extraKeys.length) {
  throw new Error(JSON.stringify({ duplicateKeys, missingKeys, extraKeys }, null, 2));
}

for (const [key, manifest] of Object.entries(MODULE_MANIFESTS)) {
  for (const dependency of manifest.dependencies) {
    if (!MODULE_MANIFESTS[dependency]) {
      throw new Error(`${key} depends on unknown module ${dependency}.`);
    }
  }
}

console.log(JSON.stringify({ ok: true, moduleCount: registryKeys.length, keys: registryKeys }, null, 2));
