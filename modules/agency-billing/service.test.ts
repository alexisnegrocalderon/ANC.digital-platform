import { beforeEach, describe, expect, it } from "vitest";
import {
  agencyAgreements,
  agencyInstallments,
  agencySubscriptions,
  auditEvents,
  businesses,
  memberships,
  notificationOutbox,
  users,
} from "../../drizzle/schema";
import { createFakeDb, type FakeDb } from "./testFakeDb";
import {
  addInstallment,
  createAgreement,
  deleteInstallment,
  markInstallmentPaid,
  processDueInstallmentReminders,
  reconcileAuthorizedPayment,
  updateInstallment,
  waiveInstallment,
} from "./service";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysFromToday(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return isoDate(date);
}

let db: FakeDb;

function seedBusinessWithOwner(businessId: number, email = "owner@example.test") {
  db.seed(businesses, [
    { id: businessId, slug: `client-${businessId}`, name: `Client ${businessId}`, status: "active" },
  ]);
  db.seed(users, [{ id: businessId, authSubject: `auth-${businessId}`, platformRole: "user", email }]);
  db.seed(memberships, [
    { id: businessId, businessId, userId: businessId, roleKey: "owner", status: "active" },
  ]);
}

beforeEach(() => {
  db = createFakeDb();
});

describe("agreements + installments CRUD with audit logging", () => {
  it("createAgreement creates the agreement, its installments, and an audit event", async () => {
    seedBusinessWithOwner(1);

    const { agreement, installments } = await createAgreement(db, {
      businessId: 1,
      title: "Plataforma web 2026",
      collectionMode: "manual_link",
      currency: "clp",
      installments: [
        { dueDate: daysFromToday(30), amountCents: 500_000 },
        { dueDate: daysFromToday(60), amountCents: 500_000 },
      ],
      actorUserId: 9,
    });

    expect(agreement.currency).toBe("CLP");
    expect(agreement.totalAmountCents).toBe(1_000_000);
    expect(installments).toHaveLength(2);
    expect(installments[0].sequence).toBe(1);
    expect(installments[1].sequence).toBe(2);

    const audit = db.dump(auditEvents);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: "agency_agreement.created",
      entityType: "agency_agreement",
      entityId: String(agreement.id),
      actorUserId: 9,
    });
  });

  it("addInstallment auto-increments the sequence within an agreement", async () => {
    seedBusinessWithOwner(1);
    const { agreement } = await createAgreement(db, { businessId: 1, title: "Acuerdo", installments: [] });
    const first = await addInstallment(db, { agreementId: agreement.id, dueDate: daysFromToday(10), amountCents: 100_000 });
    const second = await addInstallment(db, { agreementId: agreement.id, dueDate: daysFromToday(40), amountCents: 100_000 });
    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
  });

  it("updateInstallment changes date/amount and logs a before/after audit event", async () => {
    seedBusinessWithOwner(1);
    const { agreement, installments } = await createAgreement(db, {
      businessId: 1,
      title: "Acuerdo",
      installments: [{ dueDate: daysFromToday(10), amountCents: 100_000 }],
    });
    const installment = installments[0];

    const updated = await updateInstallment(db, {
      installmentId: installment.id,
      dueDate: daysFromToday(15),
      amountCents: 150_000,
      actorUserId: 7,
    });

    expect(updated.dueDate).toBe(daysFromToday(15));
    expect(updated.amountCents).toBe(150_000);

    const audit = db.dump(auditEvents).find((row: any) => row.action === "agency_installment.updated");
    expect(audit).toBeTruthy();
    expect((audit as any).metadata.before.amountCents).toBe(100_000);
    expect((audit as any).metadata.after.amountCents).toBe(150_000);
    void agreement;
  });

  it("resets status to scheduled when an overdue installment's date is manually edited", async () => {
    seedBusinessWithOwner(1);
    const { installments } = await createAgreement(db, {
      businessId: 1,
      title: "Acuerdo",
      installments: [{ dueDate: daysFromToday(-5), amountCents: 100_000 }],
    });
    // Force the installment into "overdue" the way the reminder job would.
    await updateInstallment(db, { installmentId: installments[0].id, paymentMethodNote: "noop" });
    const rows = db.dump(agencyInstallments) as any[];
    rows[0].status = "overdue";

    const updated = await updateInstallment(db, { installmentId: installments[0].id, dueDate: daysFromToday(20) });
    expect(updated.status).toBe("scheduled");
  });

  it("markInstallmentPaid records the paid amount and an audit event", async () => {
    seedBusinessWithOwner(1);
    const { installments } = await createAgreement(db, {
      businessId: 1,
      title: "Acuerdo",
      installments: [{ dueDate: daysFromToday(5), amountCents: 200_000 }],
    });
    const paid = await markInstallmentPaid(db, { installmentId: installments[0].id, paidAmountCents: 190_000 });
    expect(paid.status).toBe("paid");
    expect(paid.paidAmountCents).toBe(190_000);
    expect(db.dump(auditEvents).some((row: any) => row.action === "agency_installment.marked_paid")).toBe(true);
  });

  it("waiveInstallment and deleteInstallment both log audit events", async () => {
    seedBusinessWithOwner(1);
    const { installments } = await createAgreement(db, {
      businessId: 1,
      title: "Acuerdo",
      installments: [
        { dueDate: daysFromToday(5), amountCents: 10_000 },
        { dueDate: daysFromToday(10), amountCents: 10_000 },
      ],
    });

    const waived = await waiveInstallment(db, { installmentId: installments[0].id });
    expect(waived.status).toBe("waived");

    const deleted = await deleteInstallment(db, { installmentId: installments[1].id });
    expect(deleted.deleted).toBe(true);
    expect(db.dump(agencyInstallments)).toHaveLength(1);

    const actions = db.dump(auditEvents).map((row: any) => row.action);
    expect(actions).toContain("agency_installment.waived");
    expect(actions).toContain("agency_installment.deleted");
  });
});

describe("processDueInstallmentReminders", () => {
  it("queues exactly one reminder per due-date window, even across repeated runs", async () => {
    seedBusinessWithOwner(1);
    const { installments } = await createAgreement(db, {
      businessId: 1,
      title: "Acuerdo",
      collectionMode: "mp_subscription", // skip the manual payment-link branch entirely
      installments: [{ dueDate: daysFromToday(1), amountCents: 100_000 }], // due tomorrow -> offset -1 window
    });

    const firstRun = await processDueInstallmentReminders(db);
    expect(firstRun.some((r) => r.installmentId === installments[0].id && r.action === "reminder_queued")).toBe(true);

    await processDueInstallmentReminders(db);
    // Same day, same window: the idempotency key repeats, so no second email row is created
    // even though the job ran again and still reports the installment as due for a reminder.
    const outboxRows = db.dump(notificationOutbox);
    expect(outboxRows).toHaveLength(1);

    const updatedInstallment = db.dump(agencyInstallments)[0] as any;
    expect(updatedInstallment.status).toBe("reminder_sent");
  });

  it("marks an installment overdue and queues an overdue reminder within the +1 day window", async () => {
    seedBusinessWithOwner(1);
    const { installments } = await createAgreement(db, {
      businessId: 1,
      title: "Acuerdo",
      collectionMode: "mp_subscription",
      installments: [{ dueDate: daysFromToday(-1), amountCents: 100_000 }], // 1 day overdue -> offset +1 window
    });

    await processDueInstallmentReminders(db);

    const updatedInstallment = db.dump(agencyInstallments).find((row: any) => row.id === installments[0].id) as any;
    expect(updatedInstallment.status).toBe("overdue");
    expect(db.dump(notificationOutbox)).toHaveLength(1);
  });

  it("marks a long-overdue installment overdue even outside the exact reminder windows", async () => {
    seedBusinessWithOwner(1);
    const { installments } = await createAgreement(db, {
      businessId: 1,
      title: "Acuerdo",
      collectionMode: "mp_subscription",
      installments: [{ dueDate: daysFromToday(-10), amountCents: 100_000 }], // outside [-7,-1,0,1,3]
    });

    await processDueInstallmentReminders(db);

    const updatedInstallment = db.dump(agencyInstallments).find((row: any) => row.id === installments[0].id) as any;
    expect(updatedInstallment.status).toBe("overdue");
    // No exact-window reminder email is queued for this catch-up path.
    expect(db.dump(notificationOutbox)).toHaveLength(0);
  });

  it("skips installments for a business with no resolvable billing contact email", async () => {
    db.seed(businesses, [{ id: 2, slug: "client-2", name: "Client 2", status: "active" }]);
    const { installments } = await createAgreement(db, {
      businessId: 2,
      title: "Acuerdo",
      collectionMode: "mp_subscription",
      installments: [{ dueDate: daysFromToday(1), amountCents: 50_000 }],
    });

    const results = await processDueInstallmentReminders(db);
    expect(results.find((r) => r.installmentId === installments[0].id)?.action).toBe("skipped_no_recipient");
    expect(db.dump(notificationOutbox)).toHaveLength(0);
  });
});

describe("reconcileAuthorizedPayment (Mercado Pago subscription webhook reconciliation)", () => {
  it("marks the next unpaid installment paid and does not double-mark on a webhook retry", async () => {
    seedBusinessWithOwner(1);
    const { agreement, installments } = await createAgreement(db, {
      businessId: 1,
      title: "Acuerdo",
      collectionMode: "mp_subscription",
      installments: [{ dueDate: daysFromToday(5), amountCents: 300_000 }],
    });
    db.seed(agencySubscriptions, [
      {
        id: 1,
        businessId: 1,
        agreementId: agreement.id,
        provider: "mercadopago",
        externalPreapprovalId: "preapproval-123",
        status: "authorized",
        payerEmail: "owner@example.test",
        frequencyType: "months",
        frequency: 1,
        amountCents: 300_000,
        currency: "CLP",
      },
    ]);

    const first = await reconcileAuthorizedPayment(db, {
      externalPreapprovalId: "preapproval-123",
      amountCents: 300_000,
      authorizedPaymentId: "auth-payment-1",
    });
    expect(first.matched).toBe(true);
    if (first.matched) expect(first.installment.id).toBe(installments[0].id);

    const paidInstallment = db.dump(agencyInstallments).find((row: any) => row.id === installments[0].id) as any;
    expect(paidInstallment.status).toBe("paid");
    expect(paidInstallment.paidAmountCents).toBe(300_000);

    // A retried webhook delivery for the same event should find nothing left to (re)charge —
    // the only installment on this agreement is already paid.
    const retry = await reconcileAuthorizedPayment(db, {
      externalPreapprovalId: "preapproval-123",
      amountCents: 300_000,
      authorizedPaymentId: "auth-payment-1",
    });
    expect(retry.matched).toBe(false);
    if (!retry.matched) expect(retry.reason).toBe("no_unpaid_installment");

    // Still just one paid installment recorded — no duplicate payment was created.
    const allInstallments = db.dump(agencyInstallments) as any[];
    expect(allInstallments.filter((row) => row.status === "paid")).toHaveLength(1);
  });

  it("returns unmatched when the preapproval id is unknown", async () => {
    const result = await reconcileAuthorizedPayment(db, {
      externalPreapprovalId: "does-not-exist",
      amountCents: 100_000,
      authorizedPaymentId: "auth-payment-x",
    });
    expect(result.matched).toBe(false);
    if (!result.matched) expect(result.reason).toBe("subscription_not_found");
  });
});
