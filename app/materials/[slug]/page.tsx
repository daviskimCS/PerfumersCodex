import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getMaterialBySlug } from '@/lib/db/materials'

// Without this, `next build` statically prerenders the route and the DB query
// runs at build time — so the build starts depending on a live database,
// which CI does not have. The real caching strategy is a later, deliberate
// decision (wave-3.md W3-B).
export const dynamic = 'force-dynamic'

// generateMetadata and the page body both need the material; React's cache()
// dedupes them to one DB read per request.
const getMaterial = cache(getMaterialBySlug)

interface Params {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const material = await getMaterial(slug)
  if (!material) notFound()
  return {
    // First real exercise of the root layout's title.template
    // ("%s · Perfumers Codex").
    title: material.canonicalName,
    description: `${material.canonicalName} in the Perfumers Codex — identifiers, cited safety data, and usage guidance.`,
  }
}

/** 'very_high' → 'very high', for rendering enum literals as text. */
function humanize(value: string): string {
  return value.replaceAll('_', ' ')
}

/** ISO timestamp → the date part, plenty for an unstyled milestone. */
function datePart(iso: string): string {
  return iso.slice(0, 10)
}

/** One dt/dd pair; renders nothing when the value is absent. */
function Field({ term, value }: { term: string; value: ReactNode }) {
  if (value === null || value === undefined) return null
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{term}</dt>
      <dd>{value}</dd>
    </div>
  )
}

// Deliberately structured-but-unstyled (P1-F is "ugly but real"; the designed
// page is P2-G). Sections with no rows are omitted: on a curated reference,
// absence of e.g. hazard rows is data ("none recorded"), not a pending state.
export default async function MaterialPage({ params }: Params) {
  const { slug } = await params
  const material = await getMaterial(slug)
  // A wrong slug is a 404, not an error state (docs/architecture.md D4).
  if (!material) notFound()

  // Citation numbering is structural (lib/types.ts): superscript number =
  // index in `sources` + 1. Superscripts link to the numbered entry in the
  // Sources list; the entry itself links out to the source URL when one
  // exists (books and interviews have none).
  const numberOf = new Map(
    material.sources.map((source, index) => [source.id, index + 1])
  )
  const cite = (sourceId: string | null): ReactNode => {
    if (sourceId === null) return null
    const number = numberOf.get(sourceId)
    if (number === undefined) return null
    return (
      <sup>
        <a href={`#source-${number}`} aria-label={`Source ${number}`}>
          [{number}]
        </a>
      </sup>
    )
  }

  return (
    <article className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {material.canonicalName}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {humanize(material.materialType)}
          {material.families.length > 0
            ? ` · ${material.families.map((family) => family.name).join(', ')}`
            : null}
        </p>
      </header>

      <section className="mt-10">
        <h2 className="text-2xl">Identity</h2>
        <dl className="mt-4 space-y-3">
          <Field term="CAS number" value={material.casNumber} />
          <Field term="IUPAC name" value={material.iupacName} />
          <Field term="Molecular formula" value={material.molecularFormula} />
          <Field term="Molecular weight" value={material.molecularWeight} />
          {/* NULL smiles = natural/mixture → nothing structure-related. */}
          <Field
            term="SMILES"
            value={
              material.smiles ? (
                <code className="font-mono text-sm">{material.smiles}</code>
              ) : null
            }
          />
        </dl>
      </section>

      {material.synonyms.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl">Synonyms</h2>
          <ul className="mt-4 space-y-1">
            {material.synonyms.map((synonym) => (
              <li key={`${synonym.type}:${synonym.name}`}>
                {synonym.name}{' '}
                <span className="text-sm text-muted-foreground">
                  ({humanize(synonym.type)})
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {material.olfactive ? (
        <section className="mt-10">
          <h2 className="text-2xl">Olfactive description</h2>
          <p className="mt-4">
            {material.olfactive.description}
            {cite(material.olfactive.sourceId)}
          </p>
          <dl className="mt-4 space-y-3">
            <Field
              term="Tenacity"
              value={
                material.olfactive.tenacity
                  ? humanize(material.olfactive.tenacity)
                  : null
              }
            />
            <Field term="Projection" value={material.olfactive.projection} />
            <Field
              term="Key facets"
              value={
                material.olfactive.keyFacets.length > 0
                  ? material.olfactive.keyFacets.join(', ')
                  : null
              }
            />
          </dl>
        </section>
      ) : null}

      {material.usageLimits.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl">IFRA usage limits</h2>
          <ul className="mt-4 space-y-2">
            {material.usageLimits.map((limit) => (
              <li key={`${limit.categoryId}:${limit.ifraAmendmentVersion}`}>
                Category {limit.categoryId} — {limit.categoryName}:{' '}
                {humanize(limit.restrictionType)}
                {limit.maxPct !== null ? `, max ${limit.maxPct}%` : null}{' '}
                <span className="text-sm text-muted-foreground">
                  ({limit.ifraAmendmentVersion} amendment, verified{' '}
                  {datePart(limit.verifiedAt)})
                </span>
                {limit.notes ? ` — ${limit.notes}` : null}
                {cite(limit.sourceId)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {material.hazards.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl">Hazards</h2>
          <ul className="mt-4 space-y-2">
            {material.hazards.map((hazard) => (
              <li key={hazard.code}>
                {hazard.code} — {hazard.description}{' '}
                <span className="text-sm text-muted-foreground">
                  ({hazard.category})
                </span>
                {cite(hazard.sourceId)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {material.usageGuidance ? (
        <section className="mt-10">
          <h2 className="text-2xl">
            Usage guidance{cite(material.usageGuidance.sourceId)}
          </h2>
          <dl className="mt-4 space-y-3">
            <Field
              term="Typical use, minimum"
              value={
                material.usageGuidance.typicalPctMin !== null
                  ? `${material.usageGuidance.typicalPctMin}%`
                  : null
              }
            />
            <Field
              term="Typical use, maximum"
              value={
                material.usageGuidance.typicalPctMax !== null
                  ? `${material.usageGuidance.typicalPctMax}%`
                  : null
              }
            />
            <Field
              term="Threshold"
              value={material.usageGuidance.thresholdNote}
            />
            <Field
              term="Dilution"
              value={material.usageGuidance.dilutionNote}
            />
          </dl>
        </section>
      ) : null}

      {material.landmarkUses.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl">Landmark uses</h2>
          <ul className="mt-4 space-y-2">
            {material.landmarkUses.map((use) => (
              <li key={`${use.perfumeName}:${use.house ?? ''}`}>
                {use.perfumeName}
                {use.house ? `, ${use.house}` : null}
                {use.year !== null ? ` (${use.year})` : null}
                {use.notes ? ` — ${use.notes}` : null}
                {cite(use.sourceId)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Structure-derived values — never rendered for NULL-SMILES materials. */}
      {material.smiles && material.computed ? (
        <section className="mt-10">
          <h2 className="text-2xl">Computed properties</h2>
          <dl className="mt-4 space-y-3">
            <Field term="logP" value={material.computed.logp} />
            <Field term="TPSA" value={material.computed.tpsa} />
            <Field
              term="Heavy atom count"
              value={material.computed.heavyAtomCount}
            />
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">
            Computed with RDKit {material.computed.rdkitVersion} — a
            deterministic recomputation, not a cited fact.
          </p>
        </section>
      ) : null}

      {material.smiles && material.similar.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl">Structurally similar materials</h2>
          <ul className="mt-4 space-y-2">
            {material.similar.map((neighbor) => (
              <li key={neighbor.slug}>
                <Link
                  href={`/materials/${neighbor.slug}`}
                  className="underline underline-offset-4 hover:no-underline"
                >
                  {neighbor.canonicalName}
                </Link>{' '}
                <span className="text-sm text-muted-foreground">
                  (Tanimoto {neighbor.tanimoto}, RDKit {neighbor.rdkitVersion})
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Model output: schema-separated, clearly labeled, never presented as
          editorial content (AGENTS.md). */}
      {material.odorPredictions.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl">Model odor predictions</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Experimental output of a structure–odor model — not an editorial
            description, and not reviewed like one.
          </p>
          <ul className="mt-4 space-y-1">
            {material.odorPredictions.map((prediction) => (
              <li key={`${prediction.modelVersion}:${prediction.descriptor}`}>
                {prediction.descriptor}{' '}
                <span className="text-sm text-muted-foreground">
                  (probability {prediction.probability}, model{' '}
                  {prediction.modelVersion})
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {material.sources.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl">Sources</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-6">
            {material.sources.map((source, index) => (
              <li key={source.id} id={`source-${index + 1}`}>
                {source.url ? (
                  <a
                    href={source.url}
                    className="underline underline-offset-4 hover:no-underline"
                  >
                    {source.title}
                  </a>
                ) : (
                  source.title
                )}
                {source.author ? `, ${source.author}` : null}{' '}
                <span className="text-sm text-muted-foreground">
                  ({humanize(source.type)}
                  {source.publishedAt
                    ? `, published ${source.publishedAt}`
                    : null}
                  , accessed {datePart(source.accessedAt)})
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  )
}
