-- The review gate (2026-10-02). Readers see a material only when
--   deleted_at IS NULL AND reviewed_hash = content_hash
-- Both are fingerprints of what the material's page renders
-- (lib/review/fingerprint.ts). content_hash is refreshed by the seed;
-- reviewed_hash is written only by `npm run db:review publish`. All three columns are nullable,
-- so every existing row arrives unreviewed (NULL never equals anything): the
-- first deploy of the code that reads them hides everything until reviewed.
-- See lib/db/published.ts and db/schema.ts.
ALTER TABLE "materials" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "reviewed_hash" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_review_stamp_check" CHECK (("materials"."reviewed_hash" IS NULL) = ("materials"."reviewed_at" IS NULL));