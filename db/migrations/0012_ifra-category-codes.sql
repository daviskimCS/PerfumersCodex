-- IFRA categories keyed by IFRA's own code ("4", "5A", "10B", "12").
--
-- Since the 49th Amendment the Standards publish Categories 1-12, with 5, 7,
-- 10 and 11 split into subcategories carrying different limits. The old key
-- was an integer CHECKed to 1-11, so a split category could hold only its
-- strictest subcategory and Category 12 could not be stored at all.
--
-- Existing rows keep their meaning: integer 4 becomes the code '4'. The
-- parent rows '5', '7', '10' and '11' stay until the re-seed replaces every
-- material's limits with subcategory rows; after that nothing references
-- them (the seed never deletes reference rows, like chemical classes).
--
-- The foreign key is dropped and re-added around the type change: Postgres
-- refuses to alter either side while it links a smallint to a text column.
ALTER TABLE "material_usage_limits" DROP CONSTRAINT "material_usage_limits_category_id_usage_categories_id_fk";--> statement-breakpoint
ALTER TABLE "usage_categories" DROP CONSTRAINT "usage_categories_id_range_check";--> statement-breakpoint
ALTER TABLE "usage_categories" ALTER COLUMN "id" SET DATA TYPE text USING "id"::text;--> statement-breakpoint
ALTER TABLE "material_usage_limits" ALTER COLUMN "category_id" SET DATA TYPE text USING "category_id"::text;--> statement-breakpoint
ALTER TABLE "material_usage_limits" ADD CONSTRAINT "material_usage_limits_category_id_usage_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."usage_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Interim order for the existing rows (above anything the seed writes); the
-- seed sets every row it upserts from the file's order.
ALTER TABLE "usage_categories" ADD COLUMN "sort_order" smallint;--> statement-breakpoint
UPDATE "usage_categories" SET "sort_order" = 1000 + "id"::smallint;--> statement-breakpoint
ALTER TABLE "usage_categories" ALTER COLUMN "sort_order" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_categories" ADD CONSTRAINT "usage_categories_id_code_check" CHECK ("usage_categories"."id" ~ '^([1-9]|1[0-2])[A-D]?$');--> statement-breakpoint
-- IFRA prints "No Restriction" for some categories (often 12). The check
-- compares as text: a new enum value cannot be used in the transaction that
-- adds it, and the migrator runs pending files in one transaction.
ALTER TYPE "public"."restriction_type" ADD VALUE 'no_restriction';--> statement-breakpoint
ALTER TABLE "material_usage_limits" ADD CONSTRAINT "material_usage_limits_no_restriction_check" CHECK ("material_usage_limits"."restriction_type"::text <> 'no_restriction' OR "material_usage_limits"."max_pct" IS NULL);
