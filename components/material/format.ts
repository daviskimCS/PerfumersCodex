import type { SourceType, SynonymType } from '@/lib/types'

/**
 * Display formatting shared by the material detail page and its panels.
 *
 * Nothing here invents precision: numeric values render as the database
 * returned them, except where a value is explicitly a *computed similarity*
 * (Tanimoto) or a *model probability*, which are rounded for reading and
 * labelled as such at the call site.
 */

/** `'very_high'` → `'very high'`, for rendering enum literals as prose. */
export function humanize(value: string): string {
  return value.replaceAll('_', ' ')
}

/**
 * Labels for the enums whose members are not prose once the underscores go:
 * `iupac` is an acronym, `gsc` is opaque to a perfumer, and `ifra` names a
 * document. Both maps are typed `Record<Enum, string>`, so adding a member to
 * `lib/types.ts` without a label here is a compile error, not a raw key on the
 * page.
 */
export const SYNONYM_TYPE_LABELS: Record<SynonymType, string> = {
  trade_name: 'trade name',
  iupac: 'IUPAC',
  common_name: 'common name',
  abbreviation: 'abbreviation',
  supplier_name: 'supplier name',
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  ifra: 'IFRA Standard',
  sds: 'Safety data sheet',
  pubchem: 'PubChem',
  gsc: 'The Good Scents Company',
  perfumer_blog: "Perfumer's blog",
  book: 'Book',
  interview: 'Interview',
  other: 'Other',
}

export function synonymTypeLabel(type: SynonymType): string {
  return SYNONYM_TYPE_LABELS[type]
}

export function sourceTypeLabel(type: SourceType): string {
  return SOURCE_TYPE_LABELS[type]
}

/** ISO timestamp → the date part. Verification dates are day-resolution facts. */
export function datePart(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * Natural (digit-aware) comparison, so `sor-v0.10` sorts after `sor-v0.9`
 * rather than before it the way a plain string compare would.
 */
const VERSION_COLLATOR = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
})

export function compareVersions(a: string, b: string): number {
  return VERSION_COLLATOR.compare(a, b)
}
