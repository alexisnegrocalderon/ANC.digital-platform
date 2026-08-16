import { and, asc, desc, eq, lte, or, isNull, gte } from "drizzle-orm";
import { catalogueItems, pricingRules } from "../../drizzle/schema";

type Database = any;

export type PricingRuleInput = {
  catalogueItemId: number;
  name: string;
  ruleType?: "fixed" | "percentage" | "amount";
  value: number;
  priority?: number;
  status?: "draft" | "active" | "archived";
  startsAt?: Date;
  endsAt?: Date;
  metadata?: Record<string, unknown>;
};

export async function listPricingRules(db: Database, businessId: number, catalogueItemId?: number) {
  const filters = [eq(pricingRules.businessId, businessId)];
  if (catalogueItemId) filters.push(eq(pricingRules.catalogueItemId, catalogueItemId));
  return db
    .select({ rule: pricingRules, itemName: catalogueItems.name, itemSlug: catalogueItems.slug })
    .from(pricingRules)
    .innerJoin(catalogueItems, eq(catalogueItems.id, pricingRules.catalogueItemId))
    .where(and(...filters))
    .orderBy(desc(pricingRules.priority), asc(pricingRules.createdAt));
}

export async function createPricingRule(db: Database, businessId: number, input: PricingRuleInput) {
  const [item] = await db
    .select({ id: catalogueItems.id })
    .from(catalogueItems)
    .where(and(eq(catalogueItems.id, input.catalogueItemId), eq(catalogueItems.businessId, businessId)))
    .limit(1);
  if (!item) throw new Error("Catalogue item does not belong to this business.");

  const [rule] = await db
    .insert(pricingRules)
    .values({ businessId, ...input, ruleType: input.ruleType ?? "fixed", status: input.status ?? "draft", metadata: input.metadata ?? {} })
    .returning();
  return rule;
}

export async function getEffectivePrice(db: Database, businessId: number, catalogueItemId: number, at = new Date()) {
  const [item] = await db
    .select()
    .from(catalogueItems)
    .where(and(eq(catalogueItems.id, catalogueItemId), eq(catalogueItems.businessId, businessId)))
    .limit(1);
  if (!item) return null;

  const rules = await db
    .select()
    .from(pricingRules)
    .where(
      and(
        eq(pricingRules.businessId, businessId),
        eq(pricingRules.catalogueItemId, catalogueItemId),
        eq(pricingRules.status, "active"),
        or(isNull(pricingRules.startsAt), lte(pricingRules.startsAt, at)),
        or(isNull(pricingRules.endsAt), gte(pricingRules.endsAt, at)),
      ),
    )
    .orderBy(desc(pricingRules.priority), asc(pricingRules.createdAt));

  const rule = rules[0];
  if (!rule) return { basePriceCents: item.priceCents, priceCents: item.priceCents, currency: item.currency, rule: null };
  const priceCents = rule.ruleType === "percentage"
    ? Math.max(0, Math.round(item.priceCents * (10000 - rule.value) / 10000))
    : rule.ruleType === "amount"
      ? Math.max(0, item.priceCents - rule.value)
      : Math.max(0, rule.value);
  return { basePriceCents: item.priceCents, priceCents, currency: item.currency, rule };
}
