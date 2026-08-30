CREATE TABLE "access_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"ticket_id" integer NOT NULL,
	"result" varchar(32) NOT NULL,
	"operator_user_id" integer,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer,
	"actor_user_id" integer,
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(120) NOT NULL,
	"entity_id" varchar(160),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "business_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"module_key" varchar(96) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(96) NOT NULL,
	"name" varchar(180) NOT NULL,
	"legal_name" varchar(240),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"environment" varchar(32) DEFAULT 'development' NOT NULL,
	"external_project_id" varchar(180),
	"public_url" varchar(500),
	"timezone" varchar(64) DEFAULT 'America/Santiago' NOT NULL,
	"currency" varchar(3) DEFAULT 'CLP' NOT NULL,
	"locale" varchar(16) DEFAULT 'es-CL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalogue_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"slug" varchar(120) NOT NULL,
	"item_type" varchar(32) DEFAULT 'product' NOT NULL,
	"name" varchar(180) NOT NULL,
	"description" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'CLP' NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_plane_idempotency" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" varchar(120) NOT NULL,
	"idempotency_key" varchar(180) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"operation" varchar(120) NOT NULL,
	"status" varchar(32) DEFAULT 'processing' NOT NULL,
	"response" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"request_id" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"customer_id" integer,
	"learner_email" varchar(320) NOT NULL,
	"learner_name" varchar(180),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_lessons" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"title" varchar(220) NOT NULL,
	"position" integer NOT NULL,
	"content_type" varchar(32) DEFAULT 'video' NOT NULL,
	"content_url" text,
	"duration_minutes" integer,
	"preview" boolean DEFAULT false NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"slug" varchar(120) NOT NULL,
	"title" varchar(220) NOT NULL,
	"description" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'CLP' NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"external_key" varchar(160),
	"name" varchar(180) NOT NULL,
	"email" varchar(320),
	"phone_e164" varchar(32),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"consent" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"event_type" varchar(160) NOT NULL,
	"aggregate_type" varchar(120) NOT NULL,
	"aggregate_id" varchar(160) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(220) NOT NULL,
	"description" text,
	"venue" varchar(220),
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"capacity" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"uploaded_by_user_id" integer,
	"storage_key" varchar(512) NOT NULL,
	"url" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(160) NOT NULL,
	"byte_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role_key" varchar(64) DEFAULT 'owner' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_catalog" (
	"module_key" varchar(96) PRIMARY KEY NOT NULL,
	"display_name" varchar(180) NOT NULL,
	"description" text,
	"version" varchar(32) DEFAULT '0.1.0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_flag_operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"actor_user_id" integer,
	"idempotency_key" varchar(180) NOT NULL,
	"operation" varchar(32) NOT NULL,
	"requested_modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolved_modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" varchar(128),
	"channel" varchar(32) DEFAULT 'email' NOT NULL,
	"event_type" varchar(96) NOT NULL,
	"recipient" varchar(320) NOT NULL,
	"subject" varchar(240) NOT NULL,
	"template_name" varchar(160) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
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
CREATE TABLE "notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"user_id" integer,
	"channel" varchar(32) NOT NULL,
	"event_type" varchar(160) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"ticket_type_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"line_total_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"order_number" varchar(64) NOT NULL,
	"customer_email" varchar(320) NOT NULL,
	"customer_name" varchar(180),
	"total_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'CLP' NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"payment_status" varchar(32) DEFAULT 'pending' NOT NULL,
	"source" varchar(32) DEFAULT 'web' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "pricing_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"catalogue_item_id" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"rule_type" varchar(32) DEFAULT 'fixed' NOT NULL,
	"value" integer NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"public_name" varchar(180),
	"logo_file_id" integer,
	"theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"navigation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'CLP' NOT NULL,
	"quantity" integer,
	"sold" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"ticket_type_id" integer NOT NULL,
	"code" varchar(96) NOT NULL,
	"attendee_name" varchar(180),
	"status" varchar(32) DEFAULT 'valid' NOT NULL,
	"checked_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"auth_subject" varchar(160) NOT NULL,
	"platform_role" varchar(32) DEFAULT 'user' NOT NULL,
	"email" varchar(320),
	"name" varchar(180),
	"avatar_url" text,
	"password_hash" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_signed_in_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webauthn_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"device_type" varchar(20),
	"backed_up" boolean DEFAULT false NOT NULL,
	"transports" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"nickname" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
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
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_operator_user_id_users_id_fk" FOREIGN KEY ("operator_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notifications" ADD CONSTRAINT "appointment_notifications_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_notifications" ADD CONSTRAINT "appointment_notifications_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_booking_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."booking_services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_id_booking_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."booking_staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_availability_overrides" ADD CONSTRAINT "booking_availability_overrides_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_availability_overrides" ADD CONSTRAINT "booking_availability_overrides_staff_id_booking_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."booking_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_availability_rules" ADD CONSTRAINT "booking_availability_rules_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_availability_rules" ADD CONSTRAINT "booking_availability_rules_staff_id_booking_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."booking_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_staff" ADD CONSTRAINT "booking_staff_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_modules" ADD CONSTRAINT "business_modules_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_modules" ADD CONSTRAINT "business_modules_module_key_module_catalog_module_key_fk" FOREIGN KEY ("module_key") REFERENCES "public"."module_catalog"("module_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogue_items" ADD CONSTRAINT "catalogue_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_flag_operations" ADD CONSTRAINT "module_flag_operations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_flag_operations" ADD CONSTRAINT "module_flag_operations_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_provider_accounts" ADD CONSTRAINT "payment_provider_accounts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_catalogue_item_id_catalogue_items_id_fk" FOREIGN KEY ("catalogue_item_id") REFERENCES "public"."catalogue_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_logs_event_scanned_idx" ON "access_logs" USING btree ("business_id","event_id","scanned_at");--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_notifications_business_idempotency_unique" ON "appointment_notifications" USING btree ("business_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "appointment_notifications_due_idx" ON "appointment_notifications" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "appointment_notifications_appointment_idx" ON "appointment_notifications" USING btree ("business_id","appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_business_idempotency_unique" ON "appointments" USING btree ("business_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "appointments_business_starts_idx" ON "appointments" USING btree ("business_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_staff_starts_idx" ON "appointments" USING btree ("staff_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_business_status_idx" ON "appointments" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "audit_events_business_created_idx" ON "audit_events" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "booking_availability_overrides_business_date_idx" ON "booking_availability_overrides" USING btree ("business_id","date");--> statement-breakpoint
CREATE INDEX "booking_availability_overrides_staff_date_idx" ON "booking_availability_overrides" USING btree ("staff_id","date");--> statement-breakpoint
CREATE INDEX "booking_availability_rules_business_weekday_idx" ON "booking_availability_rules" USING btree ("business_id","weekday","status");--> statement-breakpoint
CREATE INDEX "booking_availability_rules_staff_idx" ON "booking_availability_rules" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_services_business_slug_unique" ON "booking_services" USING btree ("business_id","slug");--> statement-breakpoint
CREATE INDEX "booking_services_business_status_idx" ON "booking_services" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "booking_staff_business_status_idx" ON "booking_staff" USING btree ("business_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "business_modules_business_module_unique" ON "business_modules" USING btree ("business_id","module_key");--> statement-breakpoint
CREATE INDEX "business_modules_business_enabled_idx" ON "business_modules" USING btree ("business_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_slug_unique" ON "businesses" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_external_project_environment_unique" ON "businesses" USING btree ("external_project_id","environment");--> statement-breakpoint
CREATE INDEX "businesses_status_idx" ON "businesses" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "catalogue_items_business_slug_unique" ON "catalogue_items" USING btree ("business_id","slug");--> statement-breakpoint
CREATE INDEX "catalogue_items_business_status_idx" ON "catalogue_items" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "catalogue_items_business_type_idx" ON "catalogue_items" USING btree ("business_id","item_type");--> statement-breakpoint
CREATE UNIQUE INDEX "control_plane_idempotency_client_key_unique" ON "control_plane_idempotency" USING btree ("client_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "control_plane_idempotency_status_idx" ON "control_plane_idempotency" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "course_enrollments_business_course_learner_unique" ON "course_enrollments" USING btree ("business_id","course_id","learner_email");--> statement-breakpoint
CREATE INDEX "course_enrollments_business_course_idx" ON "course_enrollments" USING btree ("business_id","course_id");--> statement-breakpoint
CREATE INDEX "course_enrollments_business_learner_idx" ON "course_enrollments" USING btree ("business_id","learner_email");--> statement-breakpoint
CREATE UNIQUE INDEX "course_lessons_business_course_position_unique" ON "course_lessons" USING btree ("business_id","course_id","position");--> statement-breakpoint
CREATE INDEX "course_lessons_business_course_idx" ON "course_lessons" USING btree ("business_id","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_business_slug_unique" ON "courses" USING btree ("business_id","slug");--> statement-breakpoint
CREATE INDEX "courses_business_status_idx" ON "courses" USING btree ("business_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_business_external_key_unique" ON "customers" USING btree ("business_id","external_key");--> statement-breakpoint
CREATE INDEX "customers_business_status_idx" ON "customers" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "customers_business_email_idx" ON "customers" USING btree ("business_id","email");--> statement-breakpoint
CREATE INDEX "domain_events_business_occurred_idx" ON "domain_events" USING btree ("business_id","occurred_at");--> statement-breakpoint
CREATE INDEX "domain_events_unprocessed_idx" ON "domain_events" USING btree ("processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "events_business_slug_unique" ON "events" USING btree ("business_id","slug");--> statement-breakpoint
CREATE INDEX "events_business_status_idx" ON "events" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "files_business_idx" ON "files" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_storage_key_unique" ON "files" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_business_user_unique" ON "memberships" USING btree ("business_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_business_idx" ON "memberships" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "module_flag_operations_business_key_unique" ON "module_flag_operations" USING btree ("business_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "module_flag_operations_business_created_idx" ON "module_flag_operations" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_outbox_business_idempotency_unique" ON "notification_outbox" USING btree ("business_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "notification_outbox_due_idx" ON "notification_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notification_outbox_business_entity_idx" ON "notification_outbox" USING btree ("business_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_unique" ON "notification_preferences" USING btree ("business_id","user_id","channel","event_type");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_business_idx" ON "order_items" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_business_order_number_unique" ON "orders" USING btree ("business_id","order_number");--> statement-breakpoint
CREATE INDEX "orders_business_created_idx" ON "orders" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_business_provider_idempotency_unique" ON "payment_attempts" USING btree ("business_id","provider","operation","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_business_provider_external_unique" ON "payment_attempts" USING btree ("business_id","provider","external_id");--> statement-breakpoint
CREATE INDEX "payment_attempts_order_idx" ON "payment_attempts" USING btree ("business_id","order_id");--> statement-breakpoint
CREATE INDEX "payment_attempts_external_reference_idx" ON "payment_attempts" USING btree ("business_id","provider","external_reference");--> statement-breakpoint
CREATE INDEX "payment_attempts_business_state_idx" ON "payment_attempts" USING btree ("business_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_accounts_business_provider_unique" ON "payment_provider_accounts" USING btree ("business_id","provider");--> statement-breakpoint
CREATE INDEX "payment_provider_accounts_business_status_idx" ON "payment_provider_accounts" USING btree ("business_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhook_events_business_provider_event_unique" ON "payment_webhook_events" USING btree ("business_id","provider","external_event_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_business_status_idx" ON "payment_webhook_events" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "pricing_rules_business_item_idx" ON "pricing_rules" USING btree ("business_id","catalogue_item_id");--> statement-breakpoint
CREATE INDEX "pricing_rules_business_status_idx" ON "pricing_rules" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "pricing_rules_active_window_idx" ON "pricing_rules" USING btree ("starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "site_settings_business_unique" ON "site_settings" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_types_event_name_unique" ON "ticket_types" USING btree ("event_id","name");--> statement-breakpoint
CREATE INDEX "ticket_types_business_event_idx" ON "ticket_types" USING btree ("business_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_code_unique" ON "tickets" USING btree ("code");--> statement-breakpoint
CREATE INDEX "tickets_business_event_idx" ON "tickets" USING btree ("business_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_subject_unique" ON "users" USING btree ("auth_subject");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "webauthn_credentials_credential_id_unique" ON "webauthn_credentials" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "webauthn_credentials_user_idx" ON "webauthn_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_accounts_business_phone_unique" ON "whatsapp_accounts" USING btree ("business_id","phone_number_id");--> statement-breakpoint
CREATE INDEX "whatsapp_accounts_business_status_idx" ON "whatsapp_accounts" USING btree ("business_id","status");