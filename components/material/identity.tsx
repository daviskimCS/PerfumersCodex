import { ChevronDown, Fingerprint } from 'lucide-react'

import type { Citation, MaterialDetail, SynonymType } from '@/lib/types'

import { Cite } from './cite'
import { Field, FieldList, SectionIcon } from './section'

type Synonym = MaterialDetail['synonyms'][number]

/**
 * Synonyms grouped by kind, in the order a perfumer looks for them. Each group
 * is one row of names that wrap, not one line per name: Iso E Super carries 21
 * trade names, and a line each made the Identity block a page long.
 */
const SYNONYM_GROUPS: {
  type: SynonymType
  label: string
  /** Singular noun for the folded block's one-line summary. */
  noun: string
}[] = [
  { type: 'trade_name', label: 'Trade names', noun: 'trade name' },
  { type: 'supplier_name', label: 'Supplier names', noun: 'supplier name' },
  { type: 'common_name', label: 'Other names', noun: 'other name' },
  { type: 'abbreviation', label: 'Abbreviations', noun: 'abbreviation' },
  { type: 'iupac', label: 'Systematic names', noun: 'systematic name' },
]

function NameList({
  names,
  sources,
}: {
  names: Synonym[]
  sources: Citation[]
}) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1">
      {names.map((synonym) => (
        <li key={synonym.name} className="min-w-0 break-words">
          {synonym.name}
          <Cite sources={sources} sourceId={synonym.sourceId} />
        </li>
      ))}
    </ul>
  )
}

/**
 * One group's names, all of them: the whole block is already folded behind
 * its summary line, so a second fold inside it would only add a click.
 * Systematic names stay folded in a native `<details>`: IUPAC and CAS-index
 * spellings of one structure are search fodder, not reading, and one of them
 * already heads the block as the IUPAC name.
 */
function SynonymGroup({
  type,
  names,
  sources,
}: {
  type: SynonymType
  names: Synonym[]
  sources: Citation[]
}) {
  const foldAll = type === 'iupac'
  const shown = foldAll ? [] : names
  const folded = foldAll ? names : []

  return (
    <div className="space-y-2">
      {shown.length > 0 ? <NameList names={shown} sources={sources} /> : null}
      {folded.length > 0 ? (
        <details className="group">
          <summary className="w-fit cursor-pointer rounded-sm text-sm text-brand underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <span className="group-open:hidden">
              {`Show ${folded.length} systematic ${folded.length === 1 ? 'name' : 'names'}`}
            </span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <div className="mt-2">
            <NameList names={folded} sources={sources} />
          </div>
        </details>
      ) : null}
    </div>
  )
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * What the folded block holds, in one line: "21 trade names, 5 other names,
 * 2 abbreviations, IUPAC name, SMILES". A reader can tell from the summary
 * whether the name they came for is likely in there without opening it.
 */
function identitySummary(
  material: MaterialDetail,
  synonyms: Synonym[]
): string {
  const parts = SYNONYM_GROUPS.flatMap(({ type, noun }) => {
    const count = synonyms.filter((synonym) => synonym.type === type).length
    return count === 0 ? [] : [plural(count, noun)]
  })
  if (material.iupacName !== null) parts.push('IUPAC name')
  if (material.smiles !== null) parts.push('SMILES')
  return parts.join(', ')
}

/**
 * Names and identifiers, folded under the hero into one summary line.
 *
 * Folded because of where it sits. Open, it put roughly two phone screens of
 * names (Iso E Super carries 21 trade names) between the hero and the first
 * thing most readers came for, the odor and the IFRA limits. The facts a
 * reader checks at a glance (CAS, formula, weight) are in the hero; this
 * block is for looking a name up. A native `<details>`: no client code,
 * keyboard-operable, and browsers open it themselves when find-in-page
 * matches a folded name, so nothing in it is lost to Ctrl-F.
 *
 * Cited in two grains. The identity scalars (IUPAC name, formula, weight,
 * SMILES — and the CAS number in the hero) all come from ONE record, so
 * `identitySourceId` is cited once, on the summary, rather than down the
 * list. Synonyms are cited per row: they come from different documents
 * (PubChem's list, TGSC, the IFRA Standard's commercial names), and each
 * carries its own `sourceId`. `Field` drops absent values, so a natural with
 * no SMILES simply shows fewer rows instead of a column of dashes.
 */
export function MaterialIdentity({ material }: { material: MaterialDetail }) {
  // The IUPAC name is also stored as an `iupac` synonym so search can find it
  // (perfumers-codex-data DATA-DECISIONS D4); listing it twice here is noise.
  const synonyms = material.synonyms.filter(
    (synonym) =>
      !(synonym.type === 'iupac' && synonym.name === material.iupacName)
  )
  // Formula and weight render in the hero, so they no longer count here.
  const hasAnyIdentifier =
    material.iupacName !== null ||
    material.smiles !== null ||
    synonyms.length > 0

  // Not an empty state: an entry with no secondary identifiers is complete as
  // it stands (the hero already carries name, type, CAS and formula). A block
  // announcing its own emptiness here would be noise, not information.
  if (!hasAnyIdentifier) return null

  return (
    <section aria-labelledby="identity-heading" className="mt-12">
      <details className="group/identity border-y border-border">
        <summary className="flex cursor-pointer list-none items-start gap-2 py-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          {/* Top-aligned: on a phone the summary wraps to several lines. */}
          <span className="mt-0.5">
            <SectionIcon icon={Fingerprint} />
          </span>
          <span className="min-w-0 flex-1">
            <h2 id="identity-heading" className="inline text-base font-medium">
              Names and identifiers
            </h2>
            <Cite
              sources={material.sources}
              sourceId={material.identitySourceId}
            />
            <span className="text-sm text-muted-foreground">
              {' · '}
              {identitySummary(material, synonyms)}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open/identity:rotate-180"
          />
        </summary>
        <div className="pb-4">
          <FieldList>
            <Field term="IUPAC name" value={material.iupacName} />
            <Field term="SMILES" value={material.smiles} mono />
            {SYNONYM_GROUPS.map(({ type, label }) => {
              const names = synonyms.filter((synonym) => synonym.type === type)
              return (
                <Field
                  key={type}
                  term={label}
                  value={
                    names.length === 0 ? null : (
                      <SynonymGroup
                        type={type}
                        names={names}
                        sources={material.sources}
                      />
                    )
                  }
                />
              )
            })}
          </FieldList>
        </div>
      </details>
    </section>
  )
}
