ALTER TABLE "correction_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "families" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "hazard_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "landmark_uses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "material_computed_properties" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "material_descriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "material_families" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "material_hazards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "material_similarity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "material_synonyms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "material_usage_guidance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "material_usage_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "odor_predictions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "search_queries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usage_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_saved_materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "user_notes_select_own" ON "user_notes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "user_notes"."user_id");--> statement-breakpoint
CREATE POLICY "user_notes_insert_own" ON "user_notes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "user_notes"."user_id");--> statement-breakpoint
CREATE POLICY "user_notes_update_own" ON "user_notes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "user_notes"."user_id") WITH CHECK ((select auth.uid()) = "user_notes"."user_id");--> statement-breakpoint
CREATE POLICY "user_notes_delete_own" ON "user_notes" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "user_notes"."user_id");--> statement-breakpoint
CREATE POLICY "user_saved_materials_select_own" ON "user_saved_materials" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "user_saved_materials"."user_id");--> statement-breakpoint
CREATE POLICY "user_saved_materials_insert_own" ON "user_saved_materials" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "user_saved_materials"."user_id");--> statement-breakpoint
CREATE POLICY "user_saved_materials_delete_own" ON "user_saved_materials" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "user_saved_materials"."user_id");