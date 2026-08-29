-- Search infrastructure (docs/database-schema.md, "Search infrastructure";
-- CHECKLIST P2-E / wave-3 W3-C). All schema changes are migrations — the
-- pg_trgm extension ships here, never as an ad-hoc dashboard edit (AGENTS.md).
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

-- Trigram GIN indexes serve ranking rule 3 (prefix) and typo tolerance
-- ("galoxolide" still finds galaxolide) — FTS alone can do neither.
CREATE INDEX "materials_canonical_name_trgm_idx" ON "materials" USING GIN ("canonical_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "material_synonyms_name_trgm_idx" ON "material_synonyms" USING GIN ("name" gin_trgm_ops);--> statement-breakpoint

-- material_search_view: verbatim from docs/database-schema.md. 'simple' for
-- names/synonyms (English stemming mangles trade names), 'english' only for
-- descriptions. CAS numbers are deliberately NOT in the vector — rule 0 is an
-- exact-match short-circuit on the indexed cas_number column. Synonyms and
-- descriptions aggregate in lateral subqueries so a material with several
-- synonyms and description rows does not cross-multiply.
CREATE MATERIALIZED VIEW material_search_view AS
SELECT
  m.id,
  m.slug,
  m.canonical_name,
  m.cas_number,
  -- weights: name = A, synonyms = B, description = C
  setweight(to_tsvector('simple', m.canonical_name), 'A') ||
  setweight(to_tsvector('simple', coalesce(syn.names, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(d.description, '')), 'C') AS weighted_vector
FROM materials m
LEFT JOIN LATERAL (
  SELECT string_agg(s.name, ' ') AS names
  FROM material_synonyms s
  WHERE s.material_id = m.id
) syn ON true
LEFT JOIN LATERAL (
  SELECT d.description
  FROM material_descriptions d
  WHERE d.material_id = m.id AND d.deleted_at IS NULL
  ORDER BY d.updated_at DESC
  LIMIT 1
) d ON true
WHERE m.deleted_at IS NULL;--> statement-breakpoint

CREATE UNIQUE INDEX ON material_search_view (id);  -- required for REFRESH ... CONCURRENTLY
--> statement-breakpoint
CREATE INDEX ON material_search_view USING GIN (weighted_vector);
