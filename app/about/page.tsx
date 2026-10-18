import type { Metadata } from 'next'
import Link from 'next/link'

import {
  LEGAL_LINK_CLASSNAME,
  LegalList,
  LegalSection,
} from '@/components/legal/legal-page'
import { Field, FieldList } from '@/components/material/section'

/**
 * How to read the site, for new readers and beginner perfumers.
 *
 * Every claim here describes what the code or the data rules actually do, so
 * re-check it against these when either changes:
 *
 *   material types        lib/types.ts `MaterialType`
 *   hero, families        app/materials/[slug]/page.tsx; families carry no
 *                         source (docs/data-strategy.md, "Olfactive" layer)
 *   names and identifiers components/material/identity.tsx
 *   olfactive             components/material/olfactive-panel.tsx
 *   IFRA, GHS             components/material/safety-panel.tsx; one row per
 *                         category 1-11 at the strictest subcategory, Category
 *                         12 not stored: data repo DATA-DECISIONS D9 and
 *                         usage-categories.SOURCE.md. Rewrite the table
 *                         paragraph when IFRA codes (5A, 10B, 12) become rows.
 *                         Majority GHS only: DATA-DECISIONS D14a
 *   usage                 components/material/usage-panel.tsx; "typical use"
 *                         is a share of the concentrate per
 *                         docs/database-schema.md `usage_guidance`
 *   sources, research     components/material/sources-panel.tsx,
 *                         docs/data-strategy.md, lib/db/published.ts
 *   computed, similar     components/material/computed-properties.tsx,
 *                         components/material/similar-materials.tsx (the 0.3
 *                         floor and the band words come from there)
 *   predictions           components/material/odor-predictions.tsx
 *
 * Presentation only: nothing here reads the database, so no material's review
 * fingerprint is touched. No `loading.tsx` / `error.tsx`: static text with no
 * failure mode, like /privacy and /terms (docs/architecture.md D4).
 *
 * The prose primitives come from the legal pages' shell so the three text
 * pages share one heading and list treatment; the glossaries reuse the
 * material page's own definition list, so a term reads the same in both.
 */

export const metadata: Metadata = {
  title: 'How to read Perfumers Codex',
  description:
    'What the data on a Perfumers Codex material page means: IFRA limits and categories, GHS hazards, olfactive notes, similarity scores, and where each fact comes from.',
}

const CONTENTS = [
  { id: 'material', label: 'What a material is here' },
  { id: 'top', label: 'The top of a page' },
  { id: 'olfactive', label: 'Olfactive' },
  { id: 'ifra', label: 'Safety: IFRA limits' },
  { id: 'ghs', label: 'Safety: GHS hazards' },
  { id: 'usage', label: 'Usage' },
  { id: 'sources', label: 'Sources and citations' },
  { id: 'computed', label: 'Computed values and similar materials' },
  { id: 'finding', label: 'Finding materials' },
  { id: 'not', label: 'What this site is not' },
  { id: 'account', label: 'Accounts' },
] as const

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <div className="mx-auto w-full max-w-measure">
        <h1 className="text-3xl">How to read Perfumers Codex</h1>

        <p className="mt-8 text-lg text-balance">
          Perfumers Codex is a small reference for the raw materials perfumers
          work with, where each fact links to the document it came from. This
          page explains what you are looking at on a material page, where each
          part comes from, and what the site does not do.
        </p>

        <nav aria-label="On this page" className="mt-10">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            On this page
          </p>
          <ol className="mt-3 space-y-1">
            {CONTENTS.map(({ id, label }) => (
              <li key={id}>
                <a href={`#${id}`} className={LEGAL_LINK_CLASSNAME}>
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12">
          <LegalSection id="material" heading="What a material is here">
            <p>
              A material is one ingredient you can buy and weigh out at the
              bench. Each one has its own page, and the small label above its
              name says which of three kinds it is:
            </p>
            <FieldList>
              <Field
                term="Synthetic"
                value="A molecule made by chemical synthesis, such as Iso E Super."
              />
              <Field
                term="Natural"
                value="An extract of a plant or other natural source, such as an absolute. A natural is a mixture of many molecules, so it has no single structure: its page shows no structure drawing, no similar materials and no computed values."
              />
              <Field
                term="Isolate"
                value="A single molecule separated out of a natural material."
              />
            </FieldList>
            <p>
              The catalogue is small on purpose. A material appears only after I
              have reviewed everything its page shows, so it grows slowly, and
              depth comes before coverage.
            </p>
          </LegalSection>

          <LegalSection id="top" heading="The top of a page">
            <FieldList>
              <Field
                term="CAS number"
                value="The registry number the Chemical Abstracts Service gives a substance. Trade names vary from supplier to supplier; the CAS number is the surest way to tell whether two products are the same material. Typing one into search goes straight to its page."
              />
              <Field
                term="Formula and weight"
                value="The molecular formula (which atoms, and how many of each) and the molecular weight in grams per mole."
              />
              <Field
                term="Families"
                value="The olfactive group I place a material in, such as Woody. Families are my own editorial grouping, not a cited fact, and the set of families is still being settled, so treat them as a way to browse rather than a classification."
              />
              <Field
                term="Structure drawing"
                value="A two-dimensional drawing of the molecule, made by the RDKit chemistry software from the material's SMILES string. It is a picture of the chemistry, not a cited fact."
              />
            </FieldList>
            <p>
              Below that, <strong>Names and identifiers</strong> folds away the
              rest: trade names, supplier names, other names, abbreviations and
              systematic names. One molecule is often sold under many names, and
              each name here cites the document it came from. No name is added
              without one.
            </p>
            <FieldList>
              <Field
                term="IUPAC name"
                value="The systematic chemical name, built by fixed rules from the structure."
              />
              <Field
                term="SMILES"
                value="A line of text that spells out a molecule's structure so software can read it. The drawing, the computed values and the similarity scores are all worked out from it."
              />
            </FieldList>
          </LegalSection>

          <LegalSection id="olfactive" heading="Olfactive">
            <p>
              A description of how the material smells, written by hand at the
              bench. Descriptions are never generated by software.
            </p>
            <FieldList>
              <Field
                term="Key facets"
                value="A few words that sum up the material's character."
              />
              <Field
                term="Tenacity"
                value="How long the material lasts, from low to very high."
              />
              <Field
                term="Projection"
                value="How far it carries from the skin or blotter, from low to high."
              />
            </FieldList>
            <p>
              Not every page has all of these yet. When a description carries no
              citation, the page says it was written from my own bench
              experience. Read it as one perfumer’s impression, not a
              measurement: noses differ, and a material can smell quite
              different at different dilutions and in different company.
            </p>
          </LegalSection>

          <LegalSection id="ifra" heading="Safety: IFRA limits">
            <p>
              IFRA, the International Fragrance Association, is the fragrance
              industry’s self-regulatory body. Its Standards limit how much of
              an ingredient may be used, ban it, or set conditions on it,
              depending on the kind of product it goes into.
            </p>
            <p>
              <strong>Categories.</strong> IFRA sorts products by how they touch
              the body: lip products are Category 1, deodorants Category 2, fine
              fragrance (perfume, eau de toilette, cologne) Category 4,
              rinse-off soaps and shampoos Category 9, and products not meant to
              touch the skin, such as candles, Category 12. Some categories are
              split into lettered subcategories with limits of their own: 5A to
              5D, 7A and 7B, 10A and 10B, 11A and 11B. Body lotions (5A) and
              baby creams (5D), for example, can carry very different limits for
              the same material.
            </p>
            <p>
              The table has one row for each of Categories 1 to 11, with IFRA’s
              description of the products it covers. Where a category’s
              subcategories have different limits, the row shows the strictest
              of them, and the note under it lists every subcategory’s own
              limit: read the note and use the limit for the product you are
              actually making. Category 12 is not in the table yet, so check the
              Standard itself for it. Category 4 is highlighted because it is
              the row most readers look for first.
            </p>
            <p>
              <strong>The limit</strong> is the highest share of the material
              allowed in the <em>finished product</em>: the perfume or lotion as
              it is sold, not your fragrance concentrate. If your concentrate
              makes up 20% of a finished perfume and a material is 10% of the
              concentrate, the finished perfume contains 2% of that material.
              That 2% is the number to compare with the limit.
            </p>
            <FieldList>
              <Field
                term="“5% maximum”"
                value="A restriction: no more than that share in the finished product for that category."
              />
              <Field
                term="Prohibited"
                value="The material must not be used in that category at all."
              />
              <Field
                term="Specification"
                value="IFRA sets a condition on the material itself, such as a purity requirement, rather than only a percentage."
              />
            </FieldList>
            <p>
              <strong>Amendment and verified date.</strong> IFRA revises its
              Standards in numbered amendments. The badge names the amendment
              that issued the Standard. A Standard stays in force through later
              amendments until IFRA revises it, so an older number is not
              necessarily out of date. The verified date is when the limit was
              last checked against IFRA’s own documents.
            </p>
            <p>
              <strong>“No IFRA Standard”</strong> means the complete index of
              Standards for the named amendment was checked and this material is
              not in it. It is a statement about that amendment, not a statement
              that the material is safe at any dose.{' '}
              <strong>“No IFRA limits recorded yet”</strong> is different: it
              means nobody has checked.
            </p>
          </LegalSection>

          <LegalSection id="ghs" heading="Safety: GHS hazards">
            <p>
              GHS, the Globally Harmonized System, gives each kind of hazard a
              code, such as H317, “may cause an allergic skin reaction”. Each
              code on a page cites the safety data sheet or classification it
              came from. When companies classify a material differently, only
              the classification most of them agree on is recorded.
            </p>
            <p>
              “No GHS hazard codes recorded” does not mean a material is free of
              hazards. Every safety section ends with the same line, and it is
              the most important one on the site:
            </p>
            {/* Quoted verbatim from components/material/safety-panel.tsx, as
                /terms does: if one is reworded, reword the others with it. */}
            <p className="text-lg">
              This page is a reference, not a regulatory authority. Check the
              current IFRA standard and the supplier’s safety data sheet before
              you formulate.
            </p>
          </LegalSection>

          <LegalSection id="usage" heading="Usage">
            <FieldList>
              <Field
                term="Typical use"
                value="The range of concentrations the material is commonly used at, as a share of the fragrance concentrate, not of the finished product."
              />
              <Field
                term="Note"
                value="Other guidance, such as a manufacturer's recommended level, quoted from its source. A manufacturer's level is not an IFRA limit, and the page says so where it applies. Where the two differ, the IFRA limit is the one that binds."
              />
              <Field
                term="Dilution"
                value="How the material is usually diluted to work with."
              />
              <Field
                term="Landmark uses"
                value="Well-documented perfumes known to use the material, each cited from an interview, a book or a perfumer's own account. A short list of examples, not a complete one."
              />
            </FieldList>
          </LegalSection>

          <LegalSection id="sources" heading="Sources and citations">
            <p>
              The small numbers after a fact, like{' '}
              <span className="font-mono text-sm">[2]</span>, link to the
              Sources list at the foot of the page. Each entry gives the
              document’s title, what kind of source it is (an IFRA Standard, a
              safety data sheet, PubChem, a manufacturer’s page and so on), and
              the date it was accessed.
            </p>
            <p>
              Identity, names, IFRA limits, “No IFRA Standard” findings, GHS
              hazards and landmark uses must each carry a source: the database
              refuses them without one. Olfactive descriptions and usage
              guidance may be uncited, and when they are, the page says they
              come from my own bench experience.
            </p>
            <p>
              Cited facts are researched from primary sources with the help of
              AI agents. Each fact is then checked again against its source by
              two independent checks that try to disprove it, and is kept only
              if both confirm it; nothing is taken from an AI model’s memory. I
              review the whole page before it is published, and if anything it
              shows changes later, the page is hidden until I review it again.
            </p>
            <p>
              If you find a mistake, corrections with a source behind them are
              welcome; the{' '}
              <Link href="/terms#corrections" className={LEGAL_LINK_CLASSNAME}>
                terms
              </Link>{' '}
              say how to send one.
            </p>
          </LegalSection>

          <LegalSection
            id="computed"
            heading="Computed values and similar materials"
          >
            <p>
              Below the main sections, some pages show values worked out from
              the structure by RDKit, labelled with the RDKit version that
              produced them. They are calculations, not measurements and not
              cited facts, and none of them tells you how a material smells or
              how long it lasts.
            </p>
            <FieldList>
              <Field
                term="logP"
                value="How strongly the molecule prefers oil to water, on a log scale. Higher is more oil-soluble; each step of 1 is ten times more."
              />
              <Field
                term="TPSA"
                value="Polar surface area: the part of the molecule's surface made up of oxygen and nitrogen atoms and their hydrogens. Lower is less polar."
              />
              <Field
                term="Heavy atoms"
                value="Every atom except hydrogen, a rough measure of the molecule's size."
              />
            </FieldList>
            <p>
              <strong>Structurally similar</strong> compares the molecule with
              the other published materials and scores how many structural
              fragments they share, from 0 (none) to 1 (identical). Scores below
              0.3 are noise and are not shown; 0.3 to 0.5 is distantly related,
              0.5 to 0.7 related, and 0.7 or more a close analogue. With a small
              catalogue, most pages have no neighbour above 0.3, so the section
              does not appear.
            </p>
            <p>
              Similar structure does not mean similar smell. Molecules that look
              almost identical on paper can smell nothing alike, and molecules
              that smell alike can look nothing alike.
            </p>
            <p>
              A page may one day carry a box labelled{' '}
              <strong>Experimental</strong> with predicted odor descriptors.
              That would be the output of a computer model, kept apart from the
              description and never presented as one. No page shows it today.
            </p>
          </LegalSection>

          <LegalSection id="finding" heading="Finding materials">
            <LegalList>
              <li>
                <strong>Search</strong> (the search box, or Cmd-K / Ctrl-K)
                matches names, trade names and other synonyms, and forgives
                small typos. A CAS number goes straight to its material.
              </li>
              <li>
                <Link href="/materials" className={LEGAL_LINK_CLASSNAME}>
                  Materials
                </Link>{' '}
                lists everything published, and filters by family or by
                structural class, such as lactone or macrocyclic ketone.
                Structural classes are worked out from the structure, not
                assigned by hand.
              </li>
              <li>
                <Link href="/structure" className={LEGAL_LINK_CLASSNAME}>
                  Structure search
                </Link>{' '}
                matches a pattern written in SMARTS, a notation for parts of a
                molecule. It is for readers who already know some chemistry.
              </li>
            </LegalList>
          </LegalSection>

          <LegalSection id="not" heading="What this site is not">
            <LegalList>
              <li>
                Not safety, regulatory or legal advice, and not a substitute for
                the current IFRA Standard or for your supplier’s safety data
                sheet for the batch you actually bought.
              </li>
              <li>
                Not a formula book. There are no formulas or accords here, and
                no doses beyond what a cited source states.
              </li>
              <li>
                Not complete. An empty section usually means not researched yet,
                and the page says which.
              </li>
              <li>Not a price list, a supplier directory or a ratings site.</li>
            </LegalList>
          </LegalSection>

          <LegalSection id="account" heading="Accounts">
            <p>
              You don’t need an account to read anything. With one, you can
              bookmark materials and keep a private note on each. Notes are
              visible only to you and never appear beside the cited facts. The{' '}
              <Link href="/privacy" className={LEGAL_LINK_CLASSNAME}>
                privacy policy
              </Link>{' '}
              and the{' '}
              <Link href="/terms" className={LEGAL_LINK_CLASSNAME}>
                terms
              </Link>{' '}
              cover the rest.
            </p>
          </LegalSection>
        </div>
      </div>
    </div>
  )
}
