-- Two small constraints from the October 2026 code review.
--
-- landmark_uses had no index on material_id; every other child table read
-- per material has one.
--
-- One live, non-natural material per CAS number (DATA-DECISIONS D6 in the
-- data repository: a grade with the same CAS and molecule is a synonym).
-- Naturals are exempt because two extracts of one plant share a CAS.
-- Fails loudly if two live materials already share one; none do (checked
-- against PerfumersCodexData c2dd854 and the four fixtures). Renaming a
-- slug now means pruning the old row before seeding the new one.
CREATE INDEX "landmark_uses_material_id_idx" ON "landmark_uses" USING btree ("material_id");--> statement-breakpoint
CREATE UNIQUE INDEX "materials_cas_number_live_uniq" ON "materials" USING btree ("cas_number") WHERE "materials"."cas_number" IS NOT NULL AND "materials"."deleted_at" IS NULL AND "materials"."material_type" <> 'natural';