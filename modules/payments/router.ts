import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  businesses,
  orderItems,
  orders,
  paymentAttempts,
  ticketTypes,
} from "../../drizzle/schema";
import { PAYMENT_PROVIDERS, type PaymentProvider } from "../../shared/payment";
import { moduleEnabledProcedure, router } from "../../server/trpc";
import {
  createOrReusePaymentAttempt,
  resolveProviderCredentials,
  updatePaymentAttemptExternal,
  upsertProviderCredentials,
} from "./service";
import { getPaymentAdapter } from "./providers";

const providerSchema = z.enum(PAYMENT_PROVIDERS);

export const paymentsRouter = router({
  createCheckout: moduleEnabledProcedure("payments")
    .input(
      z.object({
        provider: providerSchema,
        orderId: z.number().int().positive(),
        successUrl: z.string().url().optional(),
        cancelUrl: z.string().url().optional(),
        idempotencyKey: z.string().min(1).max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orderRows = await ctx.db
        .select({
          order: orders,
          business: businesses,
        })
        .from(orders)
        .innerJoin(businesses, eq(businesses.id, orders.businessId))
        .where(and(eq(orders.businessId, ctx.businessId), eq(orders.id, input.orderId)))
        .limit(1);
      const row = orderRows[0];
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found for this business." });
      }
      if (row.order.paymentStatus === "paid") {
        throw new TRPCError({ code: "CONFLICT", message: "Order is already paid." });
      }

      const lineItemRows = await ctx.db
        .select({
          title: ticketTypes.name,
          quantity: orderItems.quantity,
          unitPriceCents: orderItems.unitPriceCents,
        })
        .from(orderItems)
        .innerJoin(ticketTypes, eq(ticketTypes.id, orderItems.ticketTypeId))
        .where(and(eq(orderItems.businessId, ctx.businessId), eq(orderItems.orderId, row.order.id)));
      if (lineItemRows.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order has no payable items." });
      }

      const attempt = await createOrReusePaymentAttempt(ctx.db, {
        businessId: ctx.businessId,
        orderId: row.order.id,
        orderNumber: row.order.orderNumber,
        provider: input.provider,
        amountCents: row.order.totalCents,
        currency: row.order.currency,
        idempotencyKey: input.idempotencyKey,
      });
      if (attempt.externalId && attempt.checkoutUrl) {
        return {
          attemptId: attempt.id,
          provider: attempt.provider,
          externalId: attempt.externalId,
          checkoutUrl: attempt.checkoutUrl,
          state: attempt.state,
          reused: true,
        };
      }

      const lineItems = lineItemRows.map((item) => ({ ...item, currency: row.order.currency }));

      let credentials;
      try {
        credentials = await resolveProviderCredentials(ctx.db, ctx.businessId, input.provider);
      } catch (error) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: error instanceof Error ? error.message : "Payment provider credentials are not configured.",
        });
      }

      const adapter = getPaymentAdapter(input.provider as PaymentProvider);
      const result = await adapter.createCheckout(
        {
          businessId: ctx.businessId,
          businessSlug: row.business.slug,
          orderId: row.order.id,
          orderNumber: row.order.orderNumber,
          customerEmail: row.order.customerEmail,
          amountCents: row.order.totalCents,
          currency: row.order.currency,
          items: lineItems,
          successUrl: input.successUrl ?? "",
          cancelUrl: input.cancelUrl ?? "",
          idempotencyKey: attempt.idempotencyKey,
        },
        credentials,
      );
      const updated = await updatePaymentAttemptExternal(ctx.db, ctx.businessId, attempt.id, {
        externalId: result.externalId,
        checkoutUrl: result.checkoutUrl,
        state: result.state,
        providerStatus: result.providerStatus,
      });
      return {
        attemptId: updated?.id ?? attempt.id,
        provider: result.provider,
        externalId: result.externalId,
        checkoutUrl: result.checkoutUrl,
        state: result.state,
        reused: false,
      };
    }),

  getStatus: moduleEnabledProcedure("payments")
    .input(z.object({ orderId: z.number().int().positive(), provider: providerSchema.optional() }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(paymentAttempts.businessId, ctx.businessId), eq(paymentAttempts.orderId, input.orderId)];
      if (input.provider) conditions.push(eq(paymentAttempts.provider, input.provider));
      return ctx.db
        .select()
        .from(paymentAttempts)
        .where(and(...conditions))
        .orderBy(paymentAttempts.createdAt);
    }),

  configureProvider: moduleEnabledProcedure("payments")
    .input(
      z.object({
        provider: providerSchema,
        accessToken: z.string().min(1),
        webhookSecret: z.string().min(1),
        publicKey: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV === "production" && !ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication is required to configure payments." });
      }
      return upsertProviderCredentials(ctx.db, ctx.businessId, input.provider, input);
    }),
});
