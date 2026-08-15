CREATE TABLE "payment_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"provider" varchar(32) NOT NULL,
	"operation" varchar(32) DEFAULT 'checkout' NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"external_id" varchar(255),
	"external_reference" varchar(255),
	"checkout_url" text,
	"amount_cents" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"state" varchar(32) DEFAULT 'created' NOT NULL,
	"provider_status" varchar(64),
	"failure_code" varchar(120),
	"failure_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_provider_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"provider" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"public_key" text,
	"encrypted_access_token" text,
	"encrypted_webhook_secret" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"provider" varchar(32) NOT NULL,
	"external_event_id" varchar(255) NOT NULL,
	"event_type" varchar(160) NOT NULL,
	"payload_hash" varchar(128) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'received' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_provider_accounts" ADD CONSTRAINT "payment_provider_accounts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_business_provider_idempotency_unique" ON "payment_attempts" USING btree ("business_id","provider","operation","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_business_provider_external_unique" ON "payment_attempts" USING btree ("business_id","provider","external_id");--> statement-breakpoint
CREATE INDEX "payment_attempts_order_idx" ON "payment_attempts" USING btree ("business_id","order_id");--> statement-breakpoint
CREATE INDEX "payment_attempts_external_reference_idx" ON "payment_attempts" USING btree ("business_id","provider","external_reference");--> statement-breakpoint
CREATE INDEX "payment_attempts_business_state_idx" ON "payment_attempts" USING btree ("business_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_accounts_business_provider_unique" ON "payment_provider_accounts" USING btree ("business_id","provider");--> statement-breakpoint
CREATE INDEX "payment_provider_accounts_business_status_idx" ON "payment_provider_accounts" USING btree ("business_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhook_events_business_provider_event_unique" ON "payment_webhook_events" USING btree ("business_id","provider","external_event_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_business_status_idx" ON "payment_webhook_events" USING btree ("business_id","status");