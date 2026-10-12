import { Fingerprint } from 'lucide-react'

import type { Citation, MaterialDetail, SynonymType } from '@/lib/types'

import { Cite } from './cite'
import { Field, FieldList, PanelSection } from './section'

type Synonym = MaterialDetail['synonyms'][number]

/**
 * Synonyms grouped by kind, in the order a perfumer looks for them. Each group
 * is one row of names that wrap, not one line per name: Iso E Super carries 21
 * trade names, and a line each made the Identity block a page long.
 */
const SYNONYM_GROUPS: { type: SynonymType; label: string }[] = [
  { type: 'trade_name', label: 'Trade names' },
  { type: 'supplier_name', label: 'Supplier names' },
  { type: 'common_name', label: 'Other names' },
  { type: 'abbreviation', label: 'Abbreviations' },
  { type: 'iupac', label: 'Systematic names' },
]

/** Names a reader can scan in one line; anything past it folds away. */
const NAMES_SHOWN = 12

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
 * One group's names. Long groups show the first `NAMES_SHOWN` and fold the
 * rest into a native `<details>`: no client code, keyboard-operable as is, and
 * browsers open it themselves when find-in-page matches a folded name.
 * Systematic names are folded whole: IUPAC and CAS-index spellings of one
 * structure are search fodder, not reading, and one of them already heads the
 * block as the IUPAC name.
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
  const shown = foldAll ? [] : names.slice(0, NAMES_SHOWN)
  const folded = foldAll ? names : names.slice(NAMES_SHOWN)

  return (
    <div className="space-y-2">
      {shown.length > 0 ? <NameList names={shown} sources={sources} /> : null}
      {folded.length > 0 ? (
        <details className="group">
          <summary className="w-fit cursor-pointer rounded-sm text-sm text-brand underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <span className="group-open:hidden">
              {foldAll
                ? `Show ${folded.length} systematic ${folded.length === 1 ? 'name' : 'names'}`
                : `Show ${folded.length} more`}
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

/**
 * The identifier block that sits under the hero and above the tabs.
 *
 * Cited in two grains. The identity scalars (IUPAC name, formula, weight,
 * SMILES — and the CAS number in the hero) all come from ONE record, so
 * `identitySourceId` is cited once, on the section title, rather than four
 * times down the list. Synonyms are cited per row: they come from different
 * documents (PubChem's list, TGSC, the IFRA Standard's commercial names), and
 * each carries its own `sourceId`. `Field` drops absent values, so a natural
 * with no SMILES and no formula simply shows fewer rows instead of a column
 * of dashes.
 */
export function MaterialIdentity({ material }: { material: MaterialDetail }) {
  // The IUPAC name is also stored as an `iupac` synonym so search can find it
  // (perfumers-codex-data DATA-DECISIONS D4); listing it twice here is noise.
  const synonyms = material.synonyms.filter(
    (synonym) =>
      !(synonym.type === 'iupac' && synonym.name === material.iupacName)
  )
  const hasAnyIdentifier =
    material.iupacName !== null ||
    material.molecularFormula !== null ||
    material.molecularWeight !== null ||
    material.smiles !== null ||
    synonyms.length > 0

  // Not an empty state: an entry with no secondary identifiers is complete as
  // it stands (the hero already carries name, type, and CAS). A block
  // announcing its own emptiness here would be noise, not information.
  if (!hasAnyIdentifier) return null

  return (
    <PanelSection
      title={
        <>
          Identity
          <Cite
            sources={material.sources}
            sourceId={material.identitySourceId}
          />
        </>
      }
      icon={Fingerprint}
      className="mt-12"
    >
      <FieldList>
        <Field term="IUPAC name" value={material.iupacName} />
        <Field
          term="Molecular formula"
          value={material.molecularFormula}
          mono
        />
        <Field
          term="Molecular weight"
          value={
            material.molecularWeight === null
              ? null
              : `${material.molecularWeight} g/mol`
          }
          mono
        />
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
    </PanelSection>
  )
}
