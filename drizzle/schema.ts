import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const businesses = pgTable(
  "businesses",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 96 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    legalName: varchar("legal_name", { length: 240 }),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("America/Santiago"),
    currency: varchar("currency", { length: 3 }).notNull().default("CLP"),
    locale: varchar("locale", { length: 16 }).notNull().default("es-CL"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("businesses_slug_unique").on(table.slug),
    statusIndex: index("businesses_status_idx").on(table.status),
  }),
);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    authSubject: varchar("auth_subject", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }),
    name: varchar("name", { length: 180 }),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    lastSignedInAt: timestamp("last_signed_in_at", { withTimezone: true }),
  },
  (table) => ({
    authSubjectUnique: uniqueIndex("users_auth_subject_unique").on(table.authSubject),
    emailIndex: index("users_email_idx").on(table.email),
  }),
);

export const memberships = pgTable(
  "memberships",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleKey: varchar("role_key", { length: 64 }).notNull().default("owner"),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    businessUserUnique: uniqueIndex("memberships_business_user_unique").on(
      table.businessId,
      table.userId,
    ),
    userIndex: index("memberships_user_idx").on(table.userId),
    businessIndex: index("memberships_business_idx").on(table.businessId),
  }),
);

export const moduleCatalog = pgTable("module_catalog", {
  moduleKey: varchar("module_key", { length: 96 }).primaryKey(),
  displayName: varchar("display_name", { length: 180 }).notNull(),
  description: text("description"),
  version: varchar("version", { length: 32 }).notNull().default("0.1.0"),
  active: boolean("active").notNull().default(true),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const businessModules = pgTable(
  "business_modules",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    moduleKey: varchar("module_key", { length: 96 })
      .notNull()
      .references(() => moduleCatalog.moduleKey, { onDelete: "restrict" }),
    enabled: boolean("enabled").notNull().default(true),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    enabledAt: timestamp("enabled_at", { withTimezone: true }).defaultNow().notNull(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    businessModuleUnique: uniqueIndex("business_modules_business_module_unique").on(
      table.businessId,
      table.moduleKey,
    ),
    businessEnabledIndex: index("business_modules_business_enabled_idx").on(
      table.businessId,
      table.enabled,
    ),
  }),
);

export const siteSettings = pgTable(
  "site_settings",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    publicName: varchar("public_name", { length: 180 }),
    logoFileId: integer("logo_file_id"),
    theme: jsonb("theme").$type<Record<string, unknown>>().notNull().default({}),
    navigation: jsonb("navigation").$type<Record<string, unknown>>().notNull().default({}),
    content: jsonb("content").$type<Record<string, unknown>>().notNull().default({}),
    seo: jsonb("seo").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    businessUnique: uniqueIndex("site_settings_business_unique").on(table.businessId),
  }),
);

export const files = pgTable(
  "files",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    uploadedByUserId: integer("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    url: text("url").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 160 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    businessIndex: index("files_business_idx").on(table.businessId),
    storageKeyUnique: uniqueIndex("files_storage_key_unique").on(table.storageKey),
  }),
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id").references(() => businesses.id, {
      onDelete: "cascade",
    }),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 120 }).notNull(),
    entityId: varchar("entity_id", { length: 160 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    businessCreatedIndex: index("audit_events_business_created_idx").on(
      table.businessId,
      table.createdAt,
    ),
    entityIndex: index("audit_events_entity_idx").on(table.entityType, table.entityId),
  }),
);

export const domainEvents = pgTable(
  "domain_events",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 160 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 120 }).notNull(),
    aggregateId: varchar("aggregate_id", { length: 160 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => ({
    businessOccurredIndex: index("domain_events_business_occurred_idx").on(
      table.businessId,
      table.occurredAt,
    ),
    unprocessedIndex: index("domain_events_unprocessed_idx").on(table.processedAt),
  }),
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 32 }).notNull(),
    eventType: varchar("event_type", { length: 160 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    preferenceUnique: uniqueIndex("notification_preferences_unique").on(
      table.businessId,
      table.userId,
      table.channel,
      table.eventType,
    ),
  }),
);

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: varchar("name", { length: 220 }).notNull(),
    description: text("description"),
    venue: varchar("venue", { length: 220 }),
    status: varchar("status", { length: 32 }).notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    capacity: integer("capacity"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    businessSlugUnique: uniqueIndex("events_business_slug_unique").on(table.businessId, table.slug),
    businessStatusIndex: index("events_business_status_idx").on(table.businessId, table.status),
  }),
);

export const ticketTypes = pgTable(
  "ticket_types",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("CLP"),
    quantity: integer("quantity"),
    sold: integer("sold").notNull().default(0),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventNameUnique: uniqueIndex("ticket_types_event_name_unique").on(table.eventId, table.name),
    businessEventIndex: index("ticket_types_business_event_idx").on(table.businessId, table.eventId),
  }),
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    orderNumber: varchar("order_number", { length: 64 }).notNull(),
    customerEmail: varchar("customer_email", { length: 320 }).notNull(),
    customerName: varchar("customer_name", { length: 180 }),
    totalCents: integer("total_cents").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("CLP"),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    paymentStatus: varchar("payment_status", { length: 32 }).notNull().default("pending"),
    source: varchar("source", { length: 32 }).notNull().default("web"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    businessOrderNumberUnique: uniqueIndex("orders_business_order_number_unique").on(
      table.businessId,
      table.orderNumber,
    ),
    businessCreatedIndex: index("orders_business_created_idx").on(table.businessId, table.createdAt),
  }),
);

export const paymentProviderAccounts = pgTable(
  "payment_provider_accounts",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    publicKey: text("public_key"),
    encryptedAccessToken: text("encrypted_access_token"),
    encryptedWebhookSecret: text("encrypted_webhook_secret"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    businessProviderUnique: uniqueIndex("payment_provider_accounts_business_provider_unique").on(
      table.businessId,
      table.provider,
    ),
    businessStatusIndex: index("payment_provider_accounts_business_status_idx").on(
      table.businessId,
      table.status,
    ),
  }),
);

export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    operation: varchar("operation", { length: 32 }).notNull().default("checkout"),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    externalId: varchar("external_id", { length: 255 }),
    externalReference: varchar("external_reference", { length: 255 }),
    checkoutUrl: text("checkout_url"),
    amountCents: integer("amount_cents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    state: varchar("state", { length: 32 }).notNull().default("created"),
    providerStatus: varchar("provider_status", { length: 64 }),
    failureCode: varchar("failure_code", { length: 120 }),
    failureMessage: text("failure_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    businessProviderIdempotencyUnique: uniqueIndex(
      "payment_attempts_business_provider_idempotency_unique",
    ).on(table.businessId, table.provider, table.operation, table.idempotencyKey),
    businessProviderExternalUnique: uniqueIndex(
      "payment_attempts_business_provider_external_unique",
    ).on(table.businessId, table.provider, table.externalId),
    orderIndex: index("payment_attempts_order_idx").on(table.businessId, table.orderId),
    externalReferenceIndex: index("payment_attempts_external_reference_idx").on(
      table.businessId,
      table.provider,
      table.externalReference,
    ),
    stateIndex: index("payment_attempts_business_state_idx").on(
      table.businessId,
      table.state,
    ),
  }),
);

export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    externalEventId: varchar("external_event_id", { length: 255 }).notNull(),
    eventType: varchar("event_type", { length: 160 }).notNull(),
    payloadHash: varchar("payload_hash", { length: 128 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: varchar("status", { length: 32 }).notNull().default("received"),
    attemptCount: integer("attempt_count").notNull().default(0),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    externalEventUnique: uniqueIndex("payment_webhook_events_business_provider_event_unique").on(
      table.businessId,
      table.provider,
      table.externalEventId,
    ),
    statusIndex: index("payment_webhook_events_business_status_idx").on(
      table.businessId,
      table.status,
    ),
  }),
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    ticketTypeId: integer("ticket_type_id")
      .notNull()
      .references(() => ticketTypes.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
  },
  (table) => ({
    orderIndex: index("order_items_order_idx").on(table.orderId),
    businessIndex: index("order_items_business_idx").on(table.businessId),
  }),
);

export const tickets = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    ticketTypeId: integer("ticket_type_id")
      .notNull()
      .references(() => ticketTypes.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 96 }).notNull(),
    attendeeName: varchar("attendee_name", { length: 180 }),
    status: varchar("status", { length: 32 }).notNull().default("valid"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex("tickets_code_unique").on(table.code),
    businessEventIndex: index("tickets_business_event_idx").on(table.businessId, table.eventId),
  }),
);

export const accessLogs = pgTable(
  "access_logs",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    result: varchar("result", { length: 32 }).notNull(),
    operatorUserId: integer("operator_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    eventScannedIndex: index("access_logs_event_scanned_idx").on(table.businessId, table.eventId, table.scannedAt),
  }),
);

export type Business = typeof businesses.$inferSelect;
export type InsertBusiness = typeof businesses.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type BusinessModule = typeof businessModules.$inferSelect;
export type SiteSettings = typeof siteSettings.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type DomainEvent = typeof domainEvents.$inferSelect;
export type Event = typeof events.$inferSelect;
export type TicketType = typeof ticketTypes.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type PaymentProviderAccount = typeof paymentProviderAccounts.$inferSelect;
export type PaymentAttempt = typeof paymentAttempts.$inferSelect;
export type PaymentWebhookEvent = typeof paymentWebhookEvents.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type AccessLog = typeof accessLogs.$inferSelect;
