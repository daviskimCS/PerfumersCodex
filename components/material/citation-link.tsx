'use client'

import type { MouseEvent } from 'react'

import { useMaterialTabs } from './tabs'
import { sourceAnchorId } from './citations'

/**
 * One numbered citation superscript.
 *
 * The number is structural, not decorative: it is the index of the source in
 * `MaterialDetail.sources` plus one (see `lib/types.ts` and the ordering
 * contract in `lib/db/materials.ts`). `components/material/citations.tsx`
 * resolves a `sourceId` to that number; this component only renders it.
 *
 * The target lives in the Sources *tab*, which Radix has not mounted while a
 * reader is on Safety — so a bare `#source-3` anchor would point at nothing.
 * With JS, the click switches tabs and then scrolls. Without it, the `href`
 * is a real URL (`?tab=sources#source-3`) that the server renders directly,
 * so the superscript works either way.
 */
export function CitationLink({ number }: { number: number }) {
  const tabs = useMaterialTabs()
  const anchor = sourceAnchorId(number)

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    // Leave modified clicks alone — opening a citation in a new tab should
    // still hit the server URL.
    if (
      tabs === null ||
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return
    }
    event.preventDefault()
    tabs.show('sources', anchor)
  }

  return (
    <sup className="ms-0.5 text-2xs">
      <a
        href={`?tab=sources#${anchor}`}
        onClick={handleClick}
        aria-label={`Source ${number}`}
        className="rounded-sm px-px text-brand underline-offset-2 hover:underline"
      >
        {number}
      </a>
    </sup>
  )
}
