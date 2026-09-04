ALTER TABLE "sources" ADD COLUMN "key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "sources_key_uniq" ON "sources" USING btree ("key");