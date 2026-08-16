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
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_outbox_business_idempotency_unique" ON "notification_outbox" USING btree ("business_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "notification_outbox_due_idx" ON "notification_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notification_outbox_business_entity_idx" ON "notification_outbox" USING btree ("business_id","entity_type","entity_id");