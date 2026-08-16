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
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_enrollments_business_course_learner_unique" ON "course_enrollments" USING btree ("business_id","course_id","learner_email");--> statement-breakpoint
CREATE INDEX "course_enrollments_business_course_idx" ON "course_enrollments" USING btree ("business_id","course_id");--> statement-breakpoint
CREATE INDEX "course_enrollments_business_learner_idx" ON "course_enrollments" USING btree ("business_id","learner_email");--> statement-breakpoint
CREATE UNIQUE INDEX "course_lessons_business_course_position_unique" ON "course_lessons" USING btree ("business_id","course_id","position");--> statement-breakpoint
CREATE INDEX "course_lessons_business_course_idx" ON "course_lessons" USING btree ("business_id","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_business_slug_unique" ON "courses" USING btree ("business_id","slug");--> statement-breakpoint
CREATE INDEX "courses_business_status_idx" ON "courses" USING btree ("business_id","status");