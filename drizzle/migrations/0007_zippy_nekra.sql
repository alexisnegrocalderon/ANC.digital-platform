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
ALTER TABLE "businesses" ADD COLUMN "environment" varchar(32) DEFAULT 'development' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "external_project_id" varchar(180);--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "public_url" varchar(500);--> statement-breakpoint
CREATE UNIQUE INDEX "control_plane_idempotency_client_key_unique" ON "control_plane_idempotency" USING btree ("client_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "control_plane_idempotency_status_idx" ON "control_plane_idempotency" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_external_project_environment_unique" ON "businesses" USING btree ("external_project_id","environment");