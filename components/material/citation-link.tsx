import { sourceAnchorId } from './citations'

/**
 * One numbered citation superscript.
 *
 * The number is structural, not decorative: it is the index of the source in
 * `MaterialDetail.sources` plus one (see `lib/types.ts` and the ordering
 * contract in `lib/db/materials.ts`). `components/material/citations.tsx`
 * resolves a `sourceId` to that number; this component only renders it.
 *
 * The Sources list is on the same page (`sections.tsx`), so this is a plain
 * in-page link, like a footnote. Its entry is focusable and highlights as the
 * `:target`, so a keyboard reader who follows "[3]" lands at source 3. Older
 * links of the form `?tab=sources#source-3` still land, because the query is
 * ignored and the fragment does the work.
 */
export function CitationLink({ number }: { number: number }) {
  return (
    <sup className="ms-0.5 text-2xs">
      <a
        href={`#${sourceAnchorId(number)}`}
        aria-label={`Source ${number}`}
        className="rounded-sm px-px text-brand underline-offset-2 hover:underline"
      >
        {number}
      </a>
    </sup>
  )
}
