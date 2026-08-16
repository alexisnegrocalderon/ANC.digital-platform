import { and, eq } from "drizzle-orm";
import { auditEvents, memberships, users } from "../../drizzle/schema";
import { BUSINESS_ROLE_KEYS, type BusinessRole } from "../../shared/auth";
import { ModuleActivationError } from "../../modules/core/activation";
import { getDb } from "../db";

type Db = NonNullable<ReturnType<typeof getDb>>;

function assertBusinessRole(roleKey: string): asserts roleKey is BusinessRole {
  if (!BUSINESS_ROLE_KEYS.includes(roleKey as BusinessRole)) {
    throw new ModuleActivationError(`Unsupported business role: ${roleKey}`);
  }
}

export async function listBusinessMemberships(db: Db, businessId: number) {
  return db
    .select({
      membershipId: memberships.id,
      businessId: memberships.businessId,
      userId: users.id,
      authSubject: users.authSubject,
      name: users.name,
      email: users.email,
      roleKey: memberships.roleKey,
      status: memberships.status,
      createdAt: memberships.createdAt,
      updatedAt: memberships.updatedAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.businessId, businessId));
}

export async function setBusinessMembershipRole(
  db: Db,
  input: { businessId: number; userId: number; roleKey: string; actorUserId?: number },
) {
  assertBusinessRole(input.roleKey);
  const existing = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.businessId, input.businessId), eq(memberships.userId, input.userId)))
    .limit(1);

  let membershipId: number;
  if (existing[0]) {
    membershipId = existing[0].id;
    await db
      .update(memberships)
      .set({ roleKey: input.roleKey, status: "active", updatedAt: new Date() })
      .where(eq(memberships.id, membershipId));
  } else {
    const inserted = await db
      .insert(memberships)
      .values({
        businessId: input.businessId,
        userId: input.userId,
        roleKey: input.roleKey,
        status: "active",
      })
      .returning({ id: memberships.id });
    membershipId = inserted[0].id;
  }

  await db.insert(auditEvents).values({
    businessId: input.businessId,
    actorUserId: input.actorUserId ?? null,
    action: "membership.role_changed",
    entityType: "membership",
    entityId: String(membershipId),
    metadata: { userId: input.userId, roleKey: input.roleKey },
  });

  return { membershipId, roleKey: input.roleKey, status: "active" as const };
}

export async function revokeBusinessMembership(
  db: Db,
  input: { businessId: number; userId: number; actorUserId?: number },
) {
  const existing = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.businessId, input.businessId), eq(memberships.userId, input.userId)))
    .limit(1);
  if (!existing[0]) return { revoked: false } as const;

  await db
    .update(memberships)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(memberships.id, existing[0].id));
  await db.insert(auditEvents).values({
    businessId: input.businessId,
    actorUserId: input.actorUserId ?? null,
    action: "membership.revoked",
    entityType: "membership",
    entityId: String(existing[0].id),
    metadata: { userId: input.userId },
  });
  return { revoked: true } as const;
}
