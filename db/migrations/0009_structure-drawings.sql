-- Structure drawings (2026-10-02). The 2D diagram on a material page is drawn
-- once by the seed (scripts/draw.ts) and stored here, instead of being drawn
-- in every reader's browser with the 6.6 MB RDKit WASM. Derived from
-- materials.smiles and stamped with rdkit_version, like the computed
-- properties. Editorial table: RLS on, no policies (deny-by-default, 0002).
--
-- ORDER: apply this BEFORE deploying the code that reads it, or every
-- material page fails. The new field also changes every material's review
-- fingerprint, so re-seed after deploying and before publishing anything.
CREATE TABLE "material_structure_drawings" (
	"material_id" uuid PRIMARY KEY NOT NULL,
	"svg" text NOT NULL,
	"rdkit_version" text NOT NULL,
	"drawn_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_structure_drawings_svg_check" CHECK ("material_structure_drawings"."svg" LIKE '<svg %' AND "material_structure_drawings"."svg" LIKE '%</svg>')
);
--> statement-breakpoint
ALTER TABLE "material_structure_drawings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "material_structure_drawings" ADD CONSTRAINT "material_structure_drawings_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;