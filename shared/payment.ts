export const PAYMENT_PROVIDERS = ["stripe", "mercadopago"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_STATES = [
  "created",
  "pending",
  "requires_action",
  "approved",
  "failed",
  "cancelled",
  "expired",
  "refunded",
  "partially_refunded",
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export type PaymentCheckoutItem = {
  title: string;
  quantity: number;
  unitPriceCents: number;
  currency: string;
};

export type CreateCheckoutInput = {
  businessId: number;
  businessSlug: string;
  orderId: number;
  orderNumber: string;
  customerEmail: string;
  currency: string;
  amountCents: number;
  items: PaymentCheckoutItem[];
  successUrl: string;
  cancelUrl: string;
  idempotencyKey?: string;
};

export type CheckoutResult = {
  provider: PaymentProvider;
  idempotencyKey: string;
  externalId: string;
  checkoutUrl: string;
  state: PaymentState;
  providerStatus?: string;
};

export type NormalizedWebhookEvent = {
  provider: PaymentProvider;
  externalEventId: string;
  eventType: string;
  externalPaymentId?: string;
  externalOrderId?: string;
  externalReference?: string;
  state: PaymentState;
  providerStatus?: string;
  failureCode?: string;
  failureMessage?: string;
  metadata?: Record<string, unknown>;
};

export const FINAL_PAYMENT_STATES = new Set<PaymentState>([
  "approved",
  "failed",
  "cancelled",
  "expired",
  "refunded",
  "partially_refunded",
]);

const ALLOWED_TRANSITIONS: Record<PaymentState, readonly PaymentState[]> = {
  created: ["pending", "cancelled", "expired", "failed"],
  pending: ["requires_action", "approved", "failed", "cancelled", "expired"],
  requires_action: ["pending", "approved", "failed", "cancelled", "expired"],
  approved: ["refunded", "partially_refunded"],
  failed: ["pending", "cancelled"],
  cancelled: [],
  expired: [],
  refunded: [],
  partially_refunded: ["refunded"],
};

export function canTransitionPaymentState(from: PaymentState, to: PaymentState) {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertPaymentStateTransition(from: string, to: PaymentState) {
  if (!PAYMENT_STATES.includes(from as PaymentState)) {
    throw new Error(`Unknown current payment state: ${from}`);
  }
  if (!canTransitionPaymentState(from as PaymentState, to)) {
    throw new Error(`Invalid payment state transition: ${from} -> ${to}`);
  }
}
