CREATE TYPE "public"."correction_status" AS ENUM('new', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."material_type" AS ENUM('synthetic', 'natural', 'isolate');--> statement-breakpoint
CREATE TYPE "public"."projection" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."restriction_type" AS ENUM('restriction', 'prohibition', 'specification');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('ifra', 'sds', 'pubchem', 'gsc', 'perfumer_blog', 'book', 'interview', 'other');--> statement-breakpoint
CREATE TYPE "public"."synonym_type" AS ENUM('trade_name', 'iupac', 'common_name', 'abbreviation', 'supplier_name');--> statement-breakpoint
CREATE TYPE "public"."tenacity" AS ENUM('low', 'medium', 'high', 'very_high');--> statement-breakpoint
CREATE TABLE "correction_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid,
	"email" text,
	"body" text NOT NULL,
	"status" "correction_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"parent_family_id" uuid,
	CONSTRAINT "families_name_unique" UNIQUE("name"),
	CONSTRAINT "families_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "hazard_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landmark_uses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"perfume_name" text NOT NULL,
	"house" text,
	"year" smallint,
	"notes" text,
	"source_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_computed_properties" (
	"material_id" uuid PRIMARY KEY NOT NULL,
	"logp" numeric,
	"tpsa" numeric,
	"heavy_atom_count" integer,
	"rdkit_version" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_descriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"description" text NOT NULL,
	"tenacity" "tenacity",
	"projection" "projection",
	"key_facets" text[] DEFAULT '{}' NOT NULL,
	"source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "material_families" (
	"material_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	CONSTRAINT "material_families_pk" PRIMARY KEY("material_id","family_id")
);
--> statement-breakpoint
CREATE TABLE "material_hazards" (
	"material_id" uuid NOT NULL,
	"hazard_code" text NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "material_hazards_pk" PRIMARY KEY("material_id","hazard_code")
);
--> statement-breakpoint
CREATE TABLE "material_similarity" (
	"material_id" uuid NOT NULL,
	"similar_material_id" uuid NOT NULL,
	"tanimoto" numeric NOT NULL,
	"rdkit_version" text NOT NULL,
	CONSTRAINT "material_similarity_pk" PRIMARY KEY("material_id","similar_material_id"),
	CONSTRAINT "material_similarity_not_self_check" CHECK ("material_similarity"."material_id" <> "material_similarity"."similar_material_id"),
	CONSTRAINT "material_similarity_tanimoto_range_check" CHECK ("material_similarity"."tanimoto" BETWEEN 0 AND 1)
);
--> statement-breakpoint
CREATE TABLE "material_synonyms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"name" text NOT NULL,
	"synonym_type" "synonym_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_usage_guidance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"typical_pct_min" numeric,
	"typical_pct_max" numeric,
	"threshold_note" text,
	"dilution_note" text,
	"source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_usage_guidance_material_id_unique" UNIQUE("material_id"),
	CONSTRAINT "material_usage_guidance_typical_pct_min_range_check" CHECK ("material_usage_guidance"."typical_pct_min" BETWEEN 0 AND 100),
	CONSTRAINT "material_usage_guidance_typical_pct_max_range_check" CHECK ("material_usage_guidance"."typical_pct_max" BETWEEN 0 AND 100),
	CONSTRAINT "material_usage_guidance_typical_pct_order_check" CHECK ("material_usage_guidance"."typical_pct_max" >= "material_usage_guidance"."typical_pct_min")
);
--> statement-breakpoint
CREATE TABLE "material_usage_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"category_id" smallint NOT NULL,
	"restriction_type" "restriction_type" DEFAULT 'restriction' NOT NULL,
	"max_pct" numeric,
	"notes" text,
	"source_id" uuid NOT NULL,
	"ifra_amendment_version" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	CONSTRAINT "material_usage_limits_material_category_amendment_uniq" UNIQUE("material_id","category_id","ifra_amendment_version"),
	CONSTRAINT "material_usage_limits_max_pct_range_check" CHECK ("material_usage_limits"."max_pct" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"canonical_name" text NOT NULL,
	"material_type" "material_type" NOT NULL,
	"cas_number" text,
	"iupac_name" text,
	"smiles" text,
	"molecular_formula" text,
	"molecular_weight" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "materials_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "odor_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"descriptor" text NOT NULL,
	"probability" numeric NOT NULL,
	"model_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "odor_predictions_material_descriptor_model_uniq" UNIQUE("material_id","descriptor","model_version"),
	CONSTRAINT "odor_predictions_probability_range_check" CHECK ("odor_predictions"."probability" BETWEEN 0 AND 1)
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"result_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "source_type" NOT NULL,
	"url" text,
	"title" text NOT NULL,
	"author" text,
	"published_at" date,
	"accessed_at" timestamp with time zone NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "usage_categories" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "usage_categories_id_range_check" CHECK ("usage_categories"."id" BETWEEN 1 AND 11)
);
--> statement-breakpoint
CREATE TABLE "user_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_notes_user_material_uniq" UNIQUE("user_id","material_id")
);
--> statement-breakpoint
CREATE TABLE "user_saved_materials" (
	"user_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_saved_materials_pk" PRIMARY KEY("user_id","material_id")
);
--> statement-breakpoint
ALTER TABLE "correction_submissions" ADD CONSTRAINT "correction_submissions_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "families" ADD CONSTRAINT "families_parent_family_id_families_id_fk" FOREIGN KEY ("parent_family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landmark_uses" ADD CONSTRAINT "landmark_uses_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landmark_uses" ADD CONSTRAINT "landmark_uses_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_computed_properties" ADD CONSTRAINT "material_computed_properties_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_descriptions" ADD CONSTRAINT "material_descriptions_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_descriptions" ADD CONSTRAINT "material_descriptions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_families" ADD CONSTRAINT "material_families_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_families" ADD CONSTRAINT "material_families_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_hazards" ADD CONSTRAINT "material_hazards_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_hazards" ADD CONSTRAINT "material_hazards_hazard_code_hazard_codes_code_fk" FOREIGN KEY ("hazard_code") REFERENCES "public"."hazard_codes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_hazards" ADD CONSTRAINT "material_hazards_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_similarity" ADD CONSTRAINT "material_similarity_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_similarity" ADD CONSTRAINT "material_similarity_similar_material_id_materials_id_fk" FOREIGN KEY ("similar_material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_synonyms" ADD CONSTRAINT "material_synonyms_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_usage_guidance" ADD CONSTRAINT "material_usage_guidance_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_usage_guidance" ADD CONSTRAINT "material_usage_guidance_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_usage_limits" ADD CONSTRAINT "material_usage_limits_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_usage_limits" ADD CONSTRAINT "material_usage_limits_category_id_usage_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."usage_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_usage_limits" ADD CONSTRAINT "material_usage_limits_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odor_predictions" ADD CONSTRAINT "odor_predictions_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saved_materials" ADD CONSTRAINT "user_saved_materials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saved_materials" ADD CONSTRAINT "user_saved_materials_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "material_descriptions_active_material_uniq" ON "material_descriptions" USING btree ("material_id") WHERE "material_descriptions"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "material_synonyms_material_id_idx" ON "material_synonyms" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "materials_cas_number_idx" ON "materials" USING btree ("cas_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_url_uniq" ON "sources" USING btree ("url") WHERE "sources"."url" IS NOT NULL;