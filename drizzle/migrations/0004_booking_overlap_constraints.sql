CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_valid_time_range"
  CHECK ("starts_at" < "ends_at");
--> statement-breakpoint
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_active_overlap"
  EXCLUDE USING gist (
    "business_id" WITH =,
    "staff_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("status" IN ('pending', 'confirmed', 'checked_in', 'rescheduled'));
