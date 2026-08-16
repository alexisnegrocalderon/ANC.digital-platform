import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { catalogueItems, customers } from "../drizzle/schema";
import { requireDb } from "../server/db";
import { createCatalogueItem, listCatalogueItems } from "../modules/catalogue/service";
import { createCustomer, listCustomers } from "../modules/crm/service";
import { getBusinessOverview } from "../modules/reporting/service";

async function main() {
  const db = requireDb();
  const businessId = Number(process.env.SMOKE_BUSINESS_ID ?? 1);
  const token = `smoke-${Date.now()}`;
  const slug = `servicio-${token}`;
  const externalKey = `customer-${token}`;

  try {
    const item = await createCatalogueItem(db, businessId, {
      slug,
      itemType: "service",
      name: "Servicio smoke",
      priceCents: 15000,
      status: "active",
    });
    const customer = await createCustomer(db, businessId, {
      externalKey,
      name: "Cliente smoke",
      email: `${token}@example.invalid`,
      phoneE164: "+56912345678",
      consent: { marketing: false },
    });
    const catalogue = await listCatalogueItems(db, businessId, { search: "Servicio smoke" });
    const crm = await listCustomers(db, businessId, { search: "Cliente smoke" });
    const overview = await getBusinessOverview(db, businessId);

    if (!item?.id || !customer?.id || catalogue.length !== 1 || crm.length !== 1) {
      throw new Error("Base module smoke assertions failed");
    }
    console.log(JSON.stringify({
      ok: true,
      businessId,
      catalogueMatches: catalogue.length,
      crmMatches: crm.length,
      overview: {
        catalogue: overview.catalogue,
        customers: overview.customers,
      },
    }, null, 2));
  } finally {
    await db.delete(catalogueItems).where(and(eq(catalogueItems.businessId, businessId), eq(catalogueItems.slug, slug)));
    await db.delete(customers).where(and(eq(customers.businessId, businessId), eq(customers.externalKey, externalKey)));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
