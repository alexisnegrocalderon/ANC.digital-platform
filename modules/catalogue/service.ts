import { and, desc, eq, ilike } from "drizzle-orm";
import { catalogueItems } from "../../drizzle/schema";

type Database = any;

export type CatalogueItemInput = {
  slug: string;
  itemType?: "product" | "service" | "ticket" | "membership";
  name: string;
  description?: string;
  priceCents?: number;
  currency?: string;
  status?: "draft" | "active" | "archived";
  metadata?: Record<string, unknown>;
};

export function cleanSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

export async function listCatalogueItems(
  db: Database,
  businessId: number,
  options: { search?: string; status?: string; itemType?: string } = {},
) {
  const filters = [eq(catalogueItems.businessId, businessId)];
  if (options.status) filters.push(eq(catalogueItems.status, options.status));
  if (options.itemType) filters.push(eq(catalogueItems.itemType, options.itemType));
  if (options.search?.trim()) filters.push(ilike(catalogueItems.name, `%${options.search.trim()}%`));

  return db
    .select()
    .from(catalogueItems)
    .where(and(...filters))
    .orderBy(desc(catalogueItems.createdAt));
}

export async function createCatalogueItem(db: Database, businessId: number, input: CatalogueItemInput) {
  const slug = cleanSlug(input.slug || input.name);
  const [item] = await db
    .insert(catalogueItems)
    .values({
      businessId,
      slug,
      itemType: input.itemType ?? "product",
      name: input.name.trim(),
      description: input.description?.trim() || null,
      priceCents: input.priceCents ?? 0,
      currency: (input.currency ?? "CLP").toUpperCase(),
      status: input.status ?? "draft",
      metadata: input.metadata ?? {},
    })
    .returning();
  return item;
}

export async function updateCatalogueItem(
  db: Database,
  businessId: number,
  id: number,
  input: Partial<CatalogueItemInput>,
) {
  const [item] = await db
    .update(catalogueItems)
    .set({
      ...(input.slug ? { slug: cleanSlug(input.slug) } : {}),
      ...(input.itemType ? { itemType: input.itemType } : {}),
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
      ...(input.currency ? { currency: input.currency.toUpperCase() } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(catalogueItems.id, id), eq(catalogueItems.businessId, businessId)))
    .returning();
  return item ?? null;
}

export async function archiveCatalogueItem(db: Database, businessId: number, id: number) {
  return updateCatalogueItem(db, businessId, id, { status: "archived" });
}

export async function getCatalogueItem(db: Database, businessId: number, id: number) {
  const [item] = await db
    .select()
    .from(catalogueItems)
    .where(and(eq(catalogueItems.id, id), eq(catalogueItems.businessId, businessId)))
    .limit(1);
  return item ?? null;
}
