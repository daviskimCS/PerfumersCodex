ALTER TABLE "material_synonyms" ALTER COLUMN "source_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ALTER COLUMN "identity_source_id" SET NOT NULL;