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
ALTER TABLE "module_flag_operations" ADD CONSTRAINT "module_flag_operations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_flag_operations" ADD CONSTRAINT "module_flag_operations_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "module_flag_operations_business_key_unique" ON "module_flag_operations" USING btree ("business_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "module_flag_operations_business_created_idx" ON "module_flag_operations" USING btree ("business_id","created_at");