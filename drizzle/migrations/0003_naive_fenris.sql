CREATE TABLE "appointment_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"appointment_id" integer NOT NULL,
	"channel" varchar(32) DEFAULT 'whatsapp' NOT NULL,
	"event_type" varchar(96) NOT NULL,
	"recipient" varchar(32) NOT NULL,
	"template_name" varchar(160) NOT NULL,
	"template_language" varchar(16) DEFAULT 'es_CL' NOT NULL,
	"template_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"provider_message_id" varchar(255),
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"staff_id" integer NOT NULL,
	"customer_name" varchar(180) NOT NULL,
	"customer_email" varchar(320),
	"customer_phone_e164" varchar(32) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" varchar(64) DEFAULT 'America/Santiago' NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"source" varchar(32) DEFAULT 'web' NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"notes" text,
	"cancellation_reason" varchar(240),
	"rescheduled_from_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_availability_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"staff_id" integer,
	"date" varchar(10) NOT NULL,
	"kind" varchar(32) DEFAULT 'blocked' NOT NULL,
	"start_local" varchar(5),
	"end_local" varchar(5),
	"reason" varchar(240),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_availability_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"staff_id" integer,
	"weekday" integer NOT NULL,
	"start_local" varchar(5) NOT NULL,
	"end_local" varchar(5) NOT NULL,
	"timezone" varchar(64) DEFAULT 'America/Santiago' NOT NULL,
	"slot_interval_minutes" integer DEFAULT 30 NOT NULL,
	"valid_from" varchar(10),
	"valid_until" varchar(10),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text,
	"duration_minutes" integer NOT NULL,
	"buffer_before_minutes" integer DEFAULT 0 NOT NULL,
	"buffer_after_minutes" integer DEFAULT 0 NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'CLP' NOT NULL,
	"min_notice_minutes" integer DEFAULT 60 NOT NULL,
	"max_advance_days" integer DEFAULT 90 NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"name" varchar(180) NOT NULL,
	"email" varchar(320),
	"phone_e164" varchar(32),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"waba_id" varchar(128) NOT NULL,
	"phone_number_id" varchar(128) NOT NULL,
	"display_phone_number" varchar(32),
	"encrypted_access_token" text NOT NULL,
	"encrypted_app_secret" text NOT NULL,
	"encrypted_verify_token" text NOT NULL,
	"default_language" varchar(16) DEFAULT 'es_CL' NOT NULL,
	"templates" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_notifications" ADD CONSTRAINT "appointment_notifications_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notifications" ADD CONSTRAINT "appointment_notifications_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_booking_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."booking_services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_id_booking_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."booking_staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_availability_overrides" ADD CONSTRAINT "booking_availability_overrides_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_availability_overrides" ADD CONSTRAINT "booking_availability_overrides_staff_id_booking_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."booking_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_availability_rules" ADD CONSTRAINT "booking_availability_rules_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_availability_rules" ADD CONSTRAINT "booking_availability_rules_staff_id_booking_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."booking_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_staff" ADD CONSTRAINT "booking_staff_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_notifications_business_idempotency_unique" ON "appointment_notifications" USING btree ("business_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "appointment_notifications_due_idx" ON "appointment_notifications" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "appointment_notifications_appointment_idx" ON "appointment_notifications" USING btree ("business_id","appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_business_idempotency_unique" ON "appointments" USING btree ("business_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "appointments_business_starts_idx" ON "appointments" USING btree ("business_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_staff_starts_idx" ON "appointments" USING btree ("staff_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_business_status_idx" ON "appointments" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "booking_availability_overrides_business_date_idx" ON "booking_availability_overrides" USING btree ("business_id","date");--> statement-breakpoint
CREATE INDEX "booking_availability_overrides_staff_date_idx" ON "booking_availability_overrides" USING btree ("staff_id","date");--> statement-breakpoint
CREATE INDEX "booking_availability_rules_business_weekday_idx" ON "booking_availability_rules" USING btree ("business_id","weekday","status");--> statement-breakpoint
CREATE INDEX "booking_availability_rules_staff_idx" ON "booking_availability_rules" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_services_business_slug_unique" ON "booking_services" USING btree ("business_id","slug");--> statement-breakpoint
CREATE INDEX "booking_services_business_status_idx" ON "booking_services" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "booking_staff_business_status_idx" ON "booking_staff" USING btree ("business_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_accounts_business_phone_unique" ON "whatsapp_accounts" USING btree ("business_id","phone_number_id");--> statement-breakpoint
CREATE INDEX "whatsapp_accounts_business_status_idx" ON "whatsapp_accounts" USING btree ("business_id","status");