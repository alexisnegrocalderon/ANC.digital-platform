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
ALTER TABLE "catalogue_items" ADD CONSTRAINT "catalogue_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catalogue_items_business_slug_unique" ON "catalogue_items" USING btree ("business_id","slug");--> statement-breakpoint
CREATE INDEX "catalogue_items_business_status_idx" ON "catalogue_items" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "catalogue_items_business_type_idx" ON "catalogue_items" USING btree ("business_id","item_type");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_business_external_key_unique" ON "customers" USING btree ("business_id","external_key");--> statement-breakpoint
CREATE INDEX "customers_business_status_idx" ON "customers" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "customers_business_email_idx" ON "customers" USING btree ("business_id","email");