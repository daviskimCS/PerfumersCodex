CREATE TABLE "chemical_classes" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"smarts" text NOT NULL,
	"description" text NOT NULL,
	"sort_order" smallint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chemical_classes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "material_chemical_classes" (
	"material_id" uuid NOT NULL,
	"class_slug" text NOT NULL,
	"rdkit_version" text NOT NULL,
	CONSTRAINT "material_chemical_classes_material_id_class_slug_pk" PRIMARY KEY("material_id","class_slug")
);
--> statement-breakpoint
ALTER TABLE "material_chemical_classes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "material_chemical_classes" ADD CONSTRAINT "material_chemical_classes_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_chemical_classes" ADD CONSTRAINT "material_chemical_classes_class_slug_chemical_classes_slug_fk" FOREIGN KEY ("class_slug") REFERENCES "public"."chemical_classes"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_chemical_classes_class_slug_idx" ON "material_chemical_classes" USING btree ("class_slug");