import { and, desc, eq, ilike, or } from "drizzle-orm";
import { customers } from "../../drizzle/schema";

type Database = any;

export type CustomerInput = {
  externalKey?: string;
  name: string;
  email?: string;
  phoneE164?: string;
  status?: "active" | "inactive" | "archived";
  consent?: Record<string, unknown>;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export function cleanPhone(phone?: string) {
  if (!phone) return undefined;
  const normalized = phone.trim().replace(/[\s()-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : undefined;
}

export async function listCustomers(
  db: Database,
  businessId: number,
  options: { search?: string; status?: string } = {},
) {
  const filters = [eq(customers.businessId, businessId)];
  if (options.status) filters.push(eq(customers.status, options.status));
  if (options.search?.trim()) {
    const search = `%${options.search.trim()}%`;
    filters.push(or(ilike(customers.name, search), ilike(customers.email, search))!);
  }

  return db
    .select()
    .from(customers)
    .where(and(...filters))
    .orderBy(desc(customers.createdAt));
}

export async function createCustomer(db: Database, businessId: number, input: CustomerInput) {
  const [customer] = await db
    .insert(customers)
    .values({
      businessId,
      externalKey: input.externalKey?.trim() || null,
      name: input.name.trim(),
      email: input.email?.trim().toLowerCase() || null,
      phoneE164: cleanPhone(input.phoneE164) ?? null,
      status: input.status ?? "active",
      consent: input.consent ?? {},
      tags: input.tags ?? [],
      metadata: input.metadata ?? {},
    })
    .returning();
  return customer;
}

export async function updateCustomer(
  db: Database,
  businessId: number,
  id: number,
  input: Partial<CustomerInput>,
) {
  const [customer] = await db
    .update(customers)
    .set({
      ...(input.externalKey !== undefined ? { externalKey: input.externalKey?.trim() || null } : {}),
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email?.trim().toLowerCase() || null } : {}),
      ...(input.phoneE164 !== undefined ? { phoneE164: cleanPhone(input.phoneE164) ?? null } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.consent ? { consent: input.consent } : {}),
      ...(input.tags ? { tags: input.tags } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(customers.id, id), eq(customers.businessId, businessId)))
    .returning();
  return customer ?? null;
}

export async function archiveCustomer(db: Database, businessId: number, id: number) {
  return updateCustomer(db, businessId, id, { status: "archived" });
}
