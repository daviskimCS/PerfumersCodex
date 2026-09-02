/**
 * The material detail page's tab set, as data.
 *
 * Deliberately a plain module with no `'use client'` directive: `page.tsx` (a
 * server component) parses `?tab=` with `parseMaterialTab` before rendering,
 * and a server component that imports from a `'use client'` module gets client
 * *references* rather than callable functions. Keeping the ids and the parser
 * here lets both sides of the boundary share one definition.
 */

export const MATERIAL_TAB_IDS = [
  'safety',
  'olfactive',
  'usage',
  'sources',
] as const

export type MaterialTabId = (typeof MATERIAL_TAB_IDS)[number]

/**
 * The tab a bare `/materials/<slug>` opens on — the first in the declared
 * order. Safety is what a perfumer at the bench is most often checking, and
 * "first tab wins" is the least surprising rule for anyone arriving without a
 * `?tab=` param.
 */
export const DEFAULT_MATERIAL_TAB: MaterialTabId = 'safety'

export const MATERIAL_TAB_LABELS: Record<MaterialTabId, string> = {
  safety: 'Safety',
  olfactive: 'Olfactive',
  usage: 'Usage',
  sources: 'Sources',
}

function isMaterialTabId(value: string): value is MaterialTabId {
  return (MATERIAL_TAB_IDS as readonly string[]).includes(value)
}

/**
 * `?tab=` → a tab id, never throwing. Anything unrecognised (a typo, a repeated
 * param, a removed tab id from an old bookmark) quietly falls back to the
 * default rather than 404ing: the tab is a view preference, not an identity.
 */
export function parseMaterialTab(
  value: string | string[] | undefined
): MaterialTabId {
  const first = Array.isArray(value) ? value[0] : value
  if (typeof first === 'string' && isMaterialTabId(first)) return first
  return DEFAULT_MATERIAL_TAB
}
