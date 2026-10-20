import type { Metadata } from 'next'
import Link from 'next/link'
import { ScatterChart } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { VolatilityChart } from '@/components/volatility-chart'
import { getVolatilityMap } from '@/lib/db/volatility'

/**
 * The volatility map: every published material with a structure, placed by
 * molecular weight and computed logP.
 *
 * Read per request like every editorial page: no cache, so a re-seed that
 * hides a material takes it off the map at once (AGENTS.md, review gate).
 * `?highlight=<slug>` marks one material, which is how a material page links
 * here. The chart is never embedded on a material page: that page's
 * fingerprint covers its own data only (lib/db/volatility.ts).
 */

// Without this Next prerenders the page and queries the database at build
// time, which CI has none of — the same reason as /materials.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Volatility map',
  description:
    'Every published material with a known structure, plotted by molecular weight against computed logP: a rough guide to which lift first and which linger.',
}

type RawSearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

const LINK_CLASSNAME =
  'text-brand underline underline-offset-4 hover:no-underline'

export default async function VolatilityPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const requested = first((await searchParams).highlight)?.trim() || null
  const { points, publishedCount } = await getVolatilityMap()

  // Only a slug that is actually plotted is honoured. Anything else (a
  // natural, an unpublished or mistyped slug) gets a note that names
  // nothing, so the page never confirms what an unpublished slug is.
  const highlighted =
    requested === null
      ? undefined
      : points.find((point) => point.slug === requested)
  const notPlotted = publishedCount - points.length
  const rdkitVersions = [...new Set(points.map((point) => point.rdkitVersion))]

  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      {highlighted === undefined ? null : (
        <p className="mb-4 text-sm">
          <Link
            href={`/materials/${highlighted.slug}`}
            className={LINK_CLASSNAME}
          >
            ← Back to {highlighted.canonicalName}
          </Link>
        </p>
      )}
      <h1 className="text-3xl">Volatility map</h1>
      <p className="mt-3 max-w-measure text-muted-foreground">
        Every published material with a known structure, placed by molecular
        weight and computed logP. Lighter molecules tend to evaporate sooner, so
        the left of the map leans toward top notes and the right toward base
        notes.
      </p>
      <p className="mt-3 max-w-measure text-sm text-muted-foreground">
        A proxy, not a measurement. Vapour pressure, odour threshold and the
        rest of the formula decide how long a material actually lasts on a
        blotter or on skin, and polar molecules that hydrogen-bond can linger
        far longer than their weight suggests. Molecular weight comes from each
        material&rsquo;s cited identity record; logP is calculated from the
        structure
        {rdkitVersions.length === 0 ? null : (
          <> with RDKit {rdkitVersions.join(', ')}</>
        )}
        , so it is context rather than a cited fact.
      </p>

      {requested !== null && highlighted === undefined ? (
        <p
          role="status"
          className="mt-6 max-w-measure border-l-2 border-border-strong pl-3 text-sm text-muted-foreground"
        >
          That material isn&rsquo;t on the map. Only published materials with a
          single structure and a computed logP are plotted; naturals are
          mixtures and have neither.
        </p>
      ) : null}

      {points.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={ScatterChart}
          title="Nothing to plot yet"
          description="The map shows published materials with a known structure, and none has been published yet. Every entry is reviewed by hand first."
        />
      ) : (
        <>
          <figure className="mt-10">
            <VolatilityChart
              points={points}
              highlight={highlighted?.slug ?? null}
            />
            <figcaption className="mt-4 max-w-measure text-sm text-muted-foreground">
              {points.length} {points.length === 1 ? 'material' : 'materials'}{' '}
              plotted. Select a point to open its page.
              {notPlotted > 0 ? (
                <>
                  {' '}
                  {notPlotted} published{' '}
                  {notPlotted === 1 ? 'material is' : 'materials are'} not
                  shown: a natural has no single structure, so it has no logP.
                </>
              ) : null}
            </figcaption>
          </figure>

          <section aria-labelledby="volatility-table-heading" className="mt-12">
            <h2 id="volatility-table-heading" className="text-xl">
              Every plotted material
            </h2>
            <table className="mt-4 w-full max-w-2xl border-collapse text-left">
              <caption className="sr-only">
                Molecular weight and computed logP for each plotted material,
                lightest first
              </caption>
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Material
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    Mol. weight (g/mol)
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    logP
                  </th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => {
                  const isHighlight = point.slug === highlighted?.slug
                  return (
                    <tr
                      key={point.slug}
                      aria-current={isHighlight ? 'true' : undefined}
                      className={
                        isHighlight
                          ? 'border-b border-border/60 bg-brand-subtle'
                          : 'border-b border-border/60'
                      }
                    >
                      <th
                        scope="row"
                        className={
                          isHighlight
                            ? 'py-2.5 pr-4 pl-2 font-medium shadow-[inset_3px_0_0_var(--brand)]'
                            : 'py-2.5 pr-4 pl-2 font-normal'
                        }
                      >
                        <Link
                          href={`/materials/${point.slug}`}
                          className={LINK_CLASSNAME}
                        >
                          {point.canonicalName}
                        </Link>
                      </th>
                      <td className="py-2.5 pr-4 text-right font-mono text-sm tabular-nums">
                        {point.molecularWeight}
                      </td>
                      <td className="py-2.5 text-right font-mono text-sm tabular-nums">
                        {point.logp}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  )
}
