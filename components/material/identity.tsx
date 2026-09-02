import type { MaterialDetail } from '@/lib/types'

import { humanize } from './format'
import { Field, FieldList, PanelSection } from './section'

/**
 * The identifier block that sits under the hero and above the tabs.
 *
 * Everything here is uncited by design — these are canonical identifiers from
 * PubChem-class sources rather than fact rows, and `lib/types.ts` gives none of
 * them a `sourceId`. `Field` drops absent values, so a natural with no SMILES
 * and no formula simply shows fewer rows instead of a column of dashes.
 */
export function MaterialIdentity({ material }: { material: MaterialDetail }) {
  const hasAnyIdentifier =
    material.iupacName !== null ||
    material.molecularFormula !== null ||
    material.molecularWeight !== null ||
    material.smiles !== null ||
    material.synonyms.length > 0

  // Not an empty state: an entry with no secondary identifiers is complete as
  // it stands (the hero already carries name, type, and CAS). A block
  // announcing its own emptiness here would be noise, not information.
  if (!hasAnyIdentifier) return null

  return (
    <PanelSection title="Identity" className="mt-12">
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
            material.synonyms.length === 0 ? null : (
              <ul className="space-y-1">
                {material.synonyms.map((synonym) => (
                  <li key={`${synonym.type}:${synonym.name}`}>
                    {synonym.name}{' '}
                    <span className="text-sm text-muted-foreground">
                      {humanize(synonym.type)}
                    </span>
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
