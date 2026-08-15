import "dotenv/config";
import { eq } from "drizzle-orm";
import { businessModules, businesses, moduleCatalog, siteSettings } from "../drizzle/schema";
import { resolveActivationPlan } from "../modules/core/activation";
import { BUSINESS_PRESETS } from "../modules/core/registry";
import { getDb } from "../server/db";
import { syncModuleCatalog } from "../server/services/moduleCatalog";

const db = getDb();

if (!db) {
  throw new Error("DATABASE_URL is required to seed ANC Platform.");
}

const syncedModules = await syncModuleCatalog();
const preset = BUSINESS_PRESETS[0];
const activationPlan = resolveActivationPlan(preset.moduleKeys);

const existingBusiness = await db
  .select()
  .from(businesses)
  .where(eq(businesses.slug, "anc-demo"))
  .limit(1);

const business = existingBusiness[0]
  ? existingBusiness[0]
  : (
      await db
        .insert(businesses)
        .values({
          slug: "anc-demo",
          name: "ANC Platform Demo",
          legalName: "ANC Platform Demo",
          timezone: "America/Santiago",
          currency: "CLP",
          locale: "es-CL",
        })
        .returning()
    )[0];

if (!business) throw new Error("Unable to create or load demo business.");

await db
  .insert(siteSettings)
  .values({
    businessId: business.id,
    publicName: "ANC Platform Demo",
    theme: {
      primary: "#896ADA",
      background: "#141414",
      surface: "#F1F0ED",
    },
    content: {
      headline: "Una base propia. Muchas formas de crecer.",
    },
  })
  .onConflictDoNothing({ target: siteSettings.businessId });

await db
  .insert(businessModules)
  .values(
    activationPlan.ordered.map((moduleKey) => ({
      businessId: business.id,
      moduleKey,
      enabled: true,
      settings: {},
    })),
  )
  .onConflictDoNothing();

const catalogCount = await db.select().from(moduleCatalog);
const enabledCount = await db
  .select()
  .from(businessModules)
  .where(eq(businessModules.businessId, business.id));

console.log(
  JSON.stringify(
    {
      ok: true,
      business: { id: business.id, slug: business.slug },
      syncedModules,
      catalogRows: catalogCount.length,
      enabledModules: enabledCount.length,
      preset: preset.key,
    },
    null,
    2,
  ),
);
