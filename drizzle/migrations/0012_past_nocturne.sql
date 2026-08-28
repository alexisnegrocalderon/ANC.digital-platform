CREATE TABLE "agency_agreements" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"title" varchar(220) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"collection_mode" varchar(32) DEFAULT 'manual_link' NOT NULL,
	"currency" varchar(3) DEFAULT 'CLP' NOT NULL,
	"total_amount_cents" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agency_installments" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"agreement_id" integer NOT NULL,
	"sequence" integer NOT NULL,
	"due_date" varchar(10) NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'CLP' NOT NULL,
	"status" varchar(32) DEFAULT 'scheduled' NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_amount_cents" integer,
	"payment_method_note" varchar(240),
	"mp_preapproval_id" varchar(255),
	"payment_attempt_id" integer,
	"last_edited_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agency_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"agreement_id" integer NOT NULL,
	"provider" varchar(32) DEFAULT 'mercadopago' NOT NULL,
	"external_preapproval_id" varchar(255) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"payer_email" varchar(320),
	"frequency_type" varchar(32) DEFAULT 'months' NOT NULL,
	"frequency" integer DEFAULT 1 NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'CLP' NOT NULL,
	"start_date" varchar(10),
	"end_date" varchar(10),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agency_agreements" ADD CONSTRAINT "agency_agreements_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_installments" ADD CONSTRAINT "agency_installments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_installments" ADD CONSTRAINT "agency_installments_agreement_id_agency_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agency_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_installments" ADD CONSTRAINT "agency_installments_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_installments" ADD CONSTRAINT "agency_installments_last_edited_by_user_id_users_id_fk" FOREIGN KEY ("last_edited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_subscriptions" ADD CONSTRAINT "agency_subscriptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_subscriptions" ADD CONSTRAINT "agency_subscriptions_agreement_id_agency_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agency_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agency_agreements_business_idx" ON "agency_agreements" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "agency_agreements_business_status_idx" ON "agency_agreements" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "agency_installments_business_idx" ON "agency_installments" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agency_installments_agreement_sequence_unique" ON "agency_installments" USING btree ("agreement_id","sequence");--> statement-breakpoint
CREATE INDEX "agency_installments_status_due_date_idx" ON "agency_installments" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX "agency_subscriptions_business_idx" ON "agency_subscriptions" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agency_subscriptions_business_external_unique" ON "agency_subscriptions" USING btree ("business_id","external_preapproval_id");--> statement-breakpoint
CREATE INDEX "agency_subscriptions_agreement_idx" ON "agency_subscriptions" USING btree ("agreement_id");