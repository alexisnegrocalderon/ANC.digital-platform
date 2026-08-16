import { and, eq, sql } from "drizzle-orm";
import { appointments, catalogueItems, customers, orders } from "../../drizzle/schema";

type Database = any;

export async function getBusinessOverview(db: Database, businessId: number) {
  const [catalogue, customerSummary, orderSummary, appointmentSummary] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${catalogueItems.status} = 'active')`,
      })
      .from(catalogueItems)
      .where(eq(catalogueItems.businessId, businessId)),
    db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${customers.status} = 'active')`,
      })
      .from(customers)
      .where(eq(customers.businessId, businessId)),
    db
      .select({
        total: sql<number>`count(*)`,
        paid: sql<number>`count(*) filter (where ${orders.paymentStatus} = 'paid')`,
        grossCents: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.paymentStatus} = 'paid'), 0)`,
      })
      .from(orders)
      .where(eq(orders.businessId, businessId)),
    db
      .select({
        total: sql<number>`count(*)`,
        upcoming: sql<number>`count(*) filter (where ${appointments.startsAt} >= now() and ${appointments.status} in ('pending', 'confirmed'))`,
      })
      .from(appointments)
      .where(eq(appointments.businessId, businessId)),
  ]);

  return {
    catalogue: catalogue[0] ?? { total: 0, active: 0 },
    customers: customerSummary[0] ?? { total: 0, active: 0 },
    orders: orderSummary[0] ?? { total: 0, paid: 0, grossCents: 0 },
    appointments: appointmentSummary[0] ?? { total: 0, upcoming: 0 },
    generatedAt: new Date().toISOString(),
  };
}

export async function getOrderSummary(db: Database, businessId: number) {
  const [summary] = await db
    .select({
      total: sql<number>`count(*)`,
      pending: sql<number>`count(*) filter (where ${orders.status} = 'pending')`,
      paid: sql<number>`count(*) filter (where ${orders.paymentStatus} = 'paid')`,
      cancelled: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')`,
      grossCents: sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${orders.paymentStatus} = 'paid'), 0)`,
    })
    .from(orders)
    .where(and(eq(orders.businessId, businessId)));
  return summary ?? { total: 0, pending: 0, paid: 0, cancelled: 0, grossCents: 0 };
}
