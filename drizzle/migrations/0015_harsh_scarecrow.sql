ALTER TABLE "businesses" ADD COLUMN "brand_color" varchar(7);--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "logo_url" varchar(500);--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "repo_url" varchar(500);--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "vercel_url" varchar(500);--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "onboarding_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL;