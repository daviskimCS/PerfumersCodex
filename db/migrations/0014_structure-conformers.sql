-- 3D conformers (2026-10-20). One computed low-energy 3D shape per material,
-- for the "View in 3D" model on its page. Computed once by the seed
-- (scripts/conformer.ts, OpenChemLib, MMFF94s+) from materials.smiles and
-- stamped with openchemlib_version, like the structure drawings (0009).
-- Mixtures, macrocycles and very flexible molecules get no row. Editorial
-- table: RLS on, no policies (deny-by-default, 0002).
--
-- ORDER: apply this BEFORE deploying the code that reads it, or every
-- material page fails. A material with no row keeps its review fingerprint
-- (lib/review/fingerprint.ts), so deploying changes nothing a reader sees;
-- the next seed adds the rows, and every material that gains one needs
-- `npm run db:review publish` again before it is public.
CREATE TABLE "material_conformers" (
	"material_id" uuid PRIMARY KEY NOT NULL,
	"molfile" text NOT NULL,
	"smiles" text NOT NULL,
	"openchemlib_version" text NOT NULL,
	"method" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_conformers_molfile_check" CHECK ("material_conformers"."molfile" LIKE '%V2000%' AND "material_conformers"."molfile" LIKE '%M  END%')
);
--> statement-breakpoint
ALTER TABLE "material_conformers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "material_conformers" ADD CONSTRAINT "material_conformers_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;