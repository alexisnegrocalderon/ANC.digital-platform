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
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_catalogue_item_id_catalogue_items_id_fk" FOREIGN KEY ("catalogue_item_id") REFERENCES "public"."catalogue_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pricing_rules_business_item_idx" ON "pricing_rules" USING btree ("business_id","catalogue_item_id");--> statement-breakpoint
CREATE INDEX "pricing_rules_business_status_idx" ON "pricing_rules" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "pricing_rules_active_window_idx" ON "pricing_rules" USING btree ("starts_at","ends_at");