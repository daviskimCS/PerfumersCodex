/**
 * App-facing domain contracts.
 *
 * CONTRACT-LOCKED (docs/architecture.md D3). Subagents READ this file and
 * conform to it; they must never modify it. Changes go through the maker.
 *
 * These are hand-written view models derived from docs/database-schema.md,
 * deliberately NOT inferred from the Drizzle schema — UI work stays decoupled
 * from the schema layer so the two can be built in parallel. `lib/db/`
 * functions map Drizzle rows onto these shapes; `tsc` catches any drift.
 *
 * Conventions: camelCase mirrors of snake_case columns; DB enums become
 * string-literal unions; timestamps are ISO strings.
 */

export type MaterialType = 'synthetic' | 'natural' | 'isolate';
export type SourceType =
  | 'ifra'
  | 'sds'
  | 'pubchem'
  | 'gsc'
  | 'perfumer_blog'
  | 'book'
  | 'interview'
  | 'other';
export type SynonymType =
  | 'trade_name'
  | 'iupac'
  | 'common_name'
  | 'abbreviation'
  | 'supplier_name';
export type RestrictionType = 'restriction' | 'prohibition' | 'specification';
export type Tenacity = 'low' | 'medium' | 'high' | 'very_high';
export type Projection = 'low' | 'medium' | 'high';

export interface Citation {
  id: string;
  type: SourceType;
  title: string;
  url: string | null;
  author: string | null;
  publishedAt: string | null;
  accessedAt: string;
}

export interface FamilyRef {
  slug: string;
  name: string;
}

export interface MaterialSummary {
  id: string;
  slug: string;
  canonicalName: string;
  materialType: MaterialType;
  casNumber: string | null;
  families: FamilyRef[];
}

export interface UsageLimit {
  categoryId: number; // 1–11, IFRA numbering
  categoryName: string;
  restrictionType: RestrictionType;
  maxPct: number | null; // null = no numeric limit; read together with restrictionType
  notes: string | null;
  ifraAmendmentVersion: string; // e.g. "51st" — display prominently (data-strategy.md)
  verifiedAt: string;
  sourceId: string;
}

export interface Hazard {
  code: string; // e.g. "H317"
  description: string;
  category: string;
  sourceId: string;
}

export interface OlfactiveDescription {
  description: string;
  tenacity: Tenacity | null;
  projection: Projection | null;
  keyFacets: string[];
  sourceId: string | null; // null = written from the maker's own experience
}

export interface UsageGuidance {
  typicalPctMin: number | null;
  typicalPctMax: number | null;
  thresholdNote: string | null;
  dilutionNote: string | null;
  sourceId: string | null;
}

export interface LandmarkUse {
  perfumeName: string;
  house: string | null;
  year: number | null;
  notes: string | null;
  sourceId: string;
}

export interface ComputedProperties {
  logp: number | null;
  tpsa: number | null;
  heavyAtomCount: number | null;
  rdkitVersion: string; // provenance — always shown alongside the values
}

export interface SimilarMaterial {
  slug: string;
  canonicalName: string;
  tanimoto: number; // 0–1
  rdkitVersion: string;
}

export interface OdorPrediction {
  descriptor: string;
  probability: number; // 0–1
  modelVersion: string; // e.g. "sor-v0.1" — always shown
}

export interface MaterialDetail extends MaterialSummary {
  iupacName: string | null;
  smiles: string | null; // null = natural/mixture → hide ALL structure features
  molecularFormula: string | null;
  molecularWeight: number | null;
  synonyms: { name: string; type: SynonymType }[];
  usageLimits: UsageLimit[];
  hazards: Hazard[];
  olfactive: OlfactiveDescription | null;
  usageGuidance: UsageGuidance | null;
  landmarkUses: LandmarkUse[];
  computed: ComputedProperties | null;
  similar: SimilarMaterial[];
  odorPredictions: OdorPrediction[]; // renders ONLY in the labeled experimental module
  /**
   * Every sourceId above resolves here. Citation superscript number =
   * index in this array + 1, so ordering is part of the contract.
   */
  sources: Citation[];
}

/**
 * 0 CAS exact · 1 canonical-name exact · 2 synonym exact ·
 * 3 prefix/trigram · 4 full-text
 */
export type MatchTier = 0 | 1 | 2 | 3 | 4;

export interface SearchResult {
  id: string;
  slug: string;
  canonicalName: string;
  casNumber: string | null;
  matchTier: MatchTier;
  matchedSynonym: string | null; // set when the hit came via a synonym → UI shows "matched: OTNE"
}
