import type { MaterialDetail } from '@/lib/types'

import { Cite } from './cite'
import { synonymTypeLabel } from './format'
import { Field, FieldList, PanelSection } from './section'

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
        <Field
          term="Synonyms"
          value={
            synonyms.length === 0 ? null : (
              <ul className="space-y-1">
                {synonyms.map((synonym) => (
                  <li key={`${synonym.type}:${synonym.name}`}>
                    {synonym.name}{' '}
                    <span className="text-sm text-muted-foreground">
                      {synonymTypeLabel(synonym.type)}
                    </span>
                    <Cite
                      sources={material.sources}
                      sourceId={synonym.sourceId}
                    />
                  </li>
                ))}
              </ul>
            )
          }
        />
      </FieldList>
    </PanelSection>
  )
}
