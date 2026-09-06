import type { Metadata } from 'next'

import { StructureSearch } from '@/components/structure-search/structure-search'
import { listChemicalClasses } from '@/lib/db/chemical-classes'
import { listStructureCandidates } from '@/lib/db/materials'

/**
 * Structure search — the arbitrary-pattern half of the structural axis.
 *
 * `/materials?class=…` filters the classes we precomputed. A pattern a
 * chemist invents has no precomputed rows to filter, so this page ships the
 * corpus's SMILES to the browser and matches there, in RDKit.js. It is the
 * only page in the app that loads WASM for anything but drawing one molecule
 * (docs/cheminformatics.md §1: "runs client-side in RDKit.js over the corpus's
 * SMILES — zero server cost, instant at this corpus size").
 *
 * The server's job is small and deliberate: fetch the candidates and the
 * curated classes, and render the explanation and the class links into the
 * HTML *before* any script runs. That markup is the fallback — see the
 * progressive-enhancement note in `structure-search.tsx`.
 */

// Without this Next statically prerenders the segment and the DB query runs at
// build time, so `next build` starts depending on a live database (CI has
// none). Same reasoning, and same wording, as `app/materials/page.tsx`.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Structure search',
  description:
    'Match a SMARTS pattern against every material in the Perfumers Codex with a recorded structure — functional groups, ring systems, substitution patterns.',
}

type RawSearchParams = Record<string, string | string[] | undefined>

/** `?smarts=a&smarts=b` is not a thing a person types; take the first. */
function readPattern(params: RawSearchParams): string {
  const raw = Array.isArray(params.smarts)
    ? (params.smarts[0] ?? '')
    : (params.smarts ?? '')
  // Not trimmed and not otherwise touched: the box shows what was typed, and
  // the client component decides what counts as an empty pattern.
  return raw.slice(0, 200)
}

export default async function StructurePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const [params, candidates, classes] = await Promise.all([
    searchParams,
    listStructureCandidates(),
    listChemicalClasses(),
  ])

  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <h1 className="text-3xl">Structure search</h1>

      {/* Written for a reader who has never typed a SMARTS pattern, because
          most perfumers have not. */}
      <p className="mt-3 max-w-measure text-muted-foreground">
        This finds every material whose molecule contains a particular
        structural fragment — an ester group, a lactone ring, a substitution
        pattern — written as a SMARTS query. The presets are a starting point:
        each one loads the pattern behind a structural class we already index,
        and you can edit it from there.
      </p>

      <StructureSearch
        candidates={candidates}
        classes={classes}
        pattern={readPattern(params)}
      />
    </div>
  )
}
