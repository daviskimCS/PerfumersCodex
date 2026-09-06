CREATE TABLE "material_ifra_absences" (
	"material_id" uuid NOT NULL,
	"ifra_amendment_version" text NOT NULL,
	"source_id" uuid NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"notes" text,
	CONSTRAINT "material_ifra_absences_material_id_ifra_amendment_version_pk" PRIMARY KEY("material_id","ifra_amendment_version")
);
--> statement-breakpoint
ALTER TABLE "material_ifra_absences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "material_synonyms" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "identity_source_id" uuid;--> statement-breakpoint
ALTER TABLE "material_ifra_absences" ADD CONSTRAINT "material_ifra_absences_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_ifra_absences" ADD CONSTRAINT "material_ifra_absences_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_ifra_absences_material_id_idx" ON "material_ifra_absences" USING btree ("material_id");--> statement-breakpoint
ALTER TABLE "material_synonyms" ADD CONSTRAINT "material_synonyms_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_identity_source_id_sources_id_fk" FOREIGN KEY ("identity_source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;