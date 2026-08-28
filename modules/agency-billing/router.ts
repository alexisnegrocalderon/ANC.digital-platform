import { z } from "zod";
import { platformAdminProcedure, router } from "../../server/trpc";
import { PAYMENT_PROVIDERS } from "../../shared/payment";
import {
  AGENCY_COLLECTION_MODES,
  addInstallment,
  cancelSubscription,
  createAgreement,
  createInstallmentPaymentLink,
  createSubscription,
  deleteInstallment,
  getAgreement,
  listAgreements,
  markInstallmentPaid,
  processDueInstallmentReminders,
  recreateSubscription,
  sendInstallmentReminderNow,
  setCollectionMode,
  updateInstallment,
  waiveInstallment,
} from "./service";

const collectionModeSchema = z.enum(AGENCY_COLLECTION_MODES);
const providerSchema = z.enum(PAYMENT_PROVIDERS);
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const frequencyTypeSchema = z.enum(["days", "months"]);

export const agencyBillingRouter = router({
  agreements: router({
    list: platformAdminProcedure
      .input(z.object({ businessId: z.number().int().positive().optional() }).optional())
      .query(({ ctx, input }) => listAgreements(ctx.db, input?.businessId)),
    get: platformAdminProcedure
      .input(z.object({ agreementId: z.number().int().positive() }))
      .query(({ ctx, input }) => getAgreement(ctx.db, input.agreementId)),
    create: platformAdminProcedure
      .input(
        z.object({
          businessId: z.number().int().positive(),
          title: z.string().min(1).max(220),
          collectionMode: collectionModeSchema.optional(),
          currency: z.string().length(3).optional(),
          notes: z.string().max(2000).optional(),
          installments: z
            .array(z.object({ dueDate: dateStringSchema, amountCents: z.number().int().positive() }))
            .optional(),
        }),
      )
      .mutation(({ ctx, input }) => createAgreement(ctx.db, { ...input, actorUserId: ctx.user?.id })),
    setCollectionMode: platformAdminProcedure
      .input(z.object({ agreementId: z.number().int().positive(), collectionMode: collectionModeSchema }))
      .mutation(({ ctx, input }) => setCollectionMode(ctx.db, { ...input, actorUserId: ctx.user?.id })),
  }),

  installments: router({
    add: platformAdminProcedure
      .input(
        z.object({
          agreementId: z.number().int().positive(),
          dueDate: dateStringSchema,
          amountCents: z.number().int().positive(),
          sequence: z.number().int().positive().optional(),
        }),
      )
      .mutation(({ ctx, input }) => addInstallment(ctx.db, { ...input, actorUserId: ctx.user?.id })),
    update: platformAdminProcedure
      .input(
        z.object({
          installmentId: z.number().int().positive(),
          dueDate: dateStringSchema.optional(),
          amountCents: z.number().int().positive().optional(),
          paymentMethodNote: z.string().max(240).optional(),
        }),
      )
      .mutation(({ ctx, input }) => updateInstallment(ctx.db, { ...input, actorUserId: ctx.user?.id })),
    markPaid: platformAdminProcedure
      .input(
        z.object({
          installmentId: z.number().int().positive(),
          paidAmountCents: z.number().int().positive().optional(),
          paidAt: z.coerce.date().optional(),
          paymentMethodNote: z.string().max(240).optional(),
        }),
      )
      .mutation(({ ctx, input }) => markInstallmentPaid(ctx.db, { ...input, actorUserId: ctx.user?.id })),
    waive: platformAdminProcedure
      .input(z.object({ installmentId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => waiveInstallment(ctx.db, { ...input, actorUserId: ctx.user?.id })),
    delete: platformAdminProcedure
      .input(z.object({ installmentId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => deleteInstallment(ctx.db, { ...input, actorUserId: ctx.user?.id })),
    resendReminder: platformAdminProcedure
      .input(z.object({ installmentId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => sendInstallmentReminderNow(ctx.db, input.installmentId)),
    createPaymentLink: platformAdminProcedure
      .input(
        z.object({
          installmentId: z.number().int().positive(),
          provider: providerSchema,
          successUrl: z.string().url().optional(),
          cancelUrl: z.string().url().optional(),
        }),
      )
      .mutation(({ ctx, input }) => createInstallmentPaymentLink(ctx.db, input)),
  }),

  subscriptions: router({
    create: platformAdminProcedure
      .input(
        z.object({
          agreementId: z.number().int().positive(),
          payerEmail: z.string().email(),
          frequencyType: frequencyTypeSchema,
          frequency: z.number().int().positive(),
          amountCents: z.number().int().positive(),
          currency: z.string().length(3).optional(),
          startDate: dateStringSchema.optional(),
        }),
      )
      .mutation(({ ctx, input }) => createSubscription(ctx.db, { ...input, actorUserId: ctx.user?.id })),
    cancel: platformAdminProcedure
      .input(z.object({ subscriptionId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => cancelSubscription(ctx.db, { ...input, actorUserId: ctx.user?.id })),
    recreate: platformAdminProcedure
      .input(
        z.object({
          subscriptionId: z.number().int().positive(),
          amountCents: z.number().int().positive().optional(),
          frequency: z.number().int().positive().optional(),
          frequencyType: frequencyTypeSchema.optional(),
        }),
      )
      .mutation(({ ctx, input }) => recreateSubscription(ctx.db, { ...input, actorUserId: ctx.user?.id })),
  }),

  jobs: router({
    processReminders: platformAdminProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).optional() }).optional())
      .mutation(({ ctx, input }) => processDueInstallmentReminders(ctx.db, input?.limit)),
  }),
});
