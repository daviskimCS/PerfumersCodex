import type { Citation } from '@/lib/types'

import { CitationLink } from './citation-link'
import { citationNumber } from './citations'

/**
 * The numbered superscript for one `sourceId`.
 *
 * Renders nothing when the row carries no source — `OlfactiveDescription`
 * and `UsageGuidance` both have a nullable `sourceId` on purpose (the maker's
 * own bench experience), and a phantom "[0]" would misrepresent that. The
 * panels say so in words instead.
 */
export function Cite({
  sources,
  sourceId,
}: {
  sources: Citation[]
  sourceId: string | null
}) {
  const number = citationNumber(sources, sourceId)
  if (number === null) return null
  return <CitationLink number={number} />
}
