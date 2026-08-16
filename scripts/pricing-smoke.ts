import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { catalogueItems, pricingRules } from "../drizzle/schema";
import { requireDb } from "../server/db";
import { createCatalogueItem } from "../modules/catalogue/service";
import { createPricingRule, getEffectivePrice } from "../modules/pricing/service";

async function main() {
  const db = requireDb();
  const businessId = Number(process.env.SMOKE_BUSINESS_ID ?? 1);
  const token = `pricing-smoke-${Date.now()}`;
  const slug = `pricing-${token}`;
  let itemId: number | undefined;
  let ruleId: number | undefined;

  try {
    const item = await createCatalogueItem(db, businessId, {
      slug,
      itemType: "service",
      name: "Pricing smoke",
      priceCents: 10000,
      status: "active",
    });
    itemId = item.id;
    const rule = await createPricingRule(db, businessId, {
      catalogueItemId: item.id,
      name: "Descuento smoke",
      ruleType: "percentage",
      value: 1500,
      priority: 10,
      status: "active",
    });
    ruleId = rule.id;
    const effective = await getEffectivePrice(db, businessId, item.id);
    if (!effective || effective.priceCents !== 8500) throw new Error("Pricing smoke assertion failed");
    console.log(JSON.stringify({ ok: true, basePriceCents: effective.basePriceCents, priceCents: effective.priceCents, ruleId }, null, 2));
  } finally {
    if (ruleId) await db.delete(pricingRules).where(and(eq(pricingRules.id, ruleId), eq(pricingRules.businessId, businessId)));
    if (itemId) await db.delete(catalogueItems).where(and(eq(catalogueItems.id, itemId), eq(catalogueItems.businessId, businessId)));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
