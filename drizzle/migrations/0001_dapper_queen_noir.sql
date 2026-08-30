ALTER TABLE "payment_provider_accounts" ADD COLUMN "encrypted_refresh_token" text;--> statement-breakpoint
ALTER TABLE "payment_provider_accounts" ADD COLUMN "token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_provider_accounts" ADD COLUMN "seller_user_id" varchar(120);