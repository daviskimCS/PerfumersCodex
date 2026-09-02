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
