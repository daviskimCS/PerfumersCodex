/**
 * Query normalization — step 1 of the search pipeline (docs/architecture.md
 * D2). Pure and database-free so the Week 5 gold set can run before Phase 0
 * credentials exist.
 */

/**
 * The one definition of "the same query string" in the codebase.
 *
 * Ranking compares the query against candidate names, so both sides run
 * through here — otherwise "Iso  E Super" and "iso e super" would count as
 * different strings and rule 1's exact match would miss on nothing but
 * whitespace.
 */
export function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * CAS registry form: 2–7 digits, 2 digits, 1 check digit.
 *
 * Anchored on purpose. Rule 0 short-circuits the whole pipeline on a CAS hit,
 * so only a query that is *entirely* a CAS number may trigger it — a
 * description search that happens to contain a CAS-shaped substring must not.
 */
const CAS_PATTERN = /^\d{2,7}-\d{2}-\d$/

/**
 * Form check only: no check-digit arithmetic. Rule 0 is an exact lookup on the
 * indexed `cas_number` column (database-schema.md), so a mistyped CAS number
 * simply misses and falls through to the normal pipeline. Validating the check
 * digit here would buy nothing and would reject any supplier-sheet oddity the
 * corpus later has to carry.
 *
 * Expects an already-normalized query — `normalizeQuery` first, then this.
 */
export function isCasNumber(q: string): boolean {
  return CAS_PATTERN.test(q)
}
