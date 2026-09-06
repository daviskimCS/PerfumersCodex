import type { Metadata } from 'next'
import Link from 'next/link'

import {
  LEGAL_LINK_CLASSNAME,
  LegalList,
  LegalPage,
  LegalPlaceholder,
  LegalSection,
} from '@/components/legal/legal-page'

/**
 * The terms of service (P4-E) — a launch blocker in docs/quality-checklist.md.
 *
 * Sources for the claims here, so they can be re-checked rather than trusted:
 *
 *   licensing            docs/licensing.md, LICENSE, LICENSE-DATA
 *   the safety sentence  components/material/safety-panel.tsx (quoted verbatim
 *                        so the page and the terms cannot say different things)
 *   odor predictions     AGENTS.md, db/schema.ts `odorPredictions`
 *   accounts / deletion  app/(auth)/actions.ts, app/account/actions.ts
 *   corrections          db/schema.ts `correctionSubmissions` — the table
 *                        exists, the form does not, so this page says so
 *
 * No `loading.tsx` / `error.tsx`: static text, nothing fetched, no failure
 * mode (docs/architecture.md D4).
 */

export const metadata: Metadata = {
  title: 'Terms',
  description:
    'What Perfumers Codex is, what it is not, how its data and code are licensed, and the terms of using it.',
  // `robots` left at the site default: indexable once the pre-launch gate
  // lifts. See the matching note in app/privacy/page.tsx.
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      lead="Perfumers Codex is a free, open reference maintained by one person. These are the terms of using it, and the first of them is the one that matters at the bench."
    >
      <LegalSection id="not" heading="This is a reference, not an authority">
        {/* Quoted verbatim from components/material/safety-panel.tsx so that
            the sentence a reader meets on every material page and the sentence
            in the terms are the same sentence. If one is reworded, reword the
            other in the same commit. */}
        <p className="text-lg">
          This page is a reference, not a regulatory authority. Check the
          current IFRA standard and the supplier’s safety data sheet before you
          formulate.
        </p>
        <p>
          That line sits at the foot of every material’s safety panel, and it
          is the whole of the site’s posture. Concretely:
        </p>
        <LegalList>
          <li>
            Nothing here is safety, regulatory, medical or legal advice. IFRA
            Standards are amended, and an entry reflects the amendment it cites
            — not necessarily the one in force today.
          </li>
          <li>
            The authoritative document for the material in your hand is the
            supplier’s: their safety data sheet and their specification, for
            that batch. This site is not a substitute for either, and it does
            not know what you actually bought.
          </li>
          <li>
            Where an entry records that no IFRA Standard applies, that is a
            statement about a specific amendment that was checked. It is not a
            statement that a material is safe.
          </li>
          <li>
            Predicted odour descriptors are model output. They appear only
            inside a module labelled as experimental, they are stamped with the
            model that produced them, and they are not editorial content. Do
            not read them as findings.
          </li>
          <li>
            Computed values — logP, similarity, structural class — are
            recomputations from a structure, stamped with the software version
            that produced them. They are not cited facts and no one has
            measured them.
          </li>
        </LegalList>
        <p>
          Every fact-bearing statement in the codex carries a citation to the
          source it came from. Follow the citation. That is what it is for, and
          it is the honest way to use this site.
        </p>
      </LegalSection>

      <LegalSection id="what" heading="What the site is">
        <p>
          A curated, citation-driven reference for aromachemicals, written and
          edited by Davis Kim. It is free to read, needs no account, and is
          published as open source. An account adds two things and nothing
          else: saved materials, and private notes.
        </p>
      </LegalSection>

      <LegalSection id="data-licence" heading="Using the material data">
        <p>
          The material data is licensed{' '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            rel="license noopener noreferrer"
            className={LEGAL_LINK_CLASSNAME}
          >
            CC BY-SA 4.0
          </a>
          . You may use it, including commercially, on two conditions:
          attribute it, and license any derivative dataset under the same
          terms.
        </p>
        <p>The attribution I ask for is:</p>
        <blockquote className="border-l-2 border-brand-muted pl-4 text-muted-foreground">
          Material data from Perfumers Codex (https://perfumerscodex.com),
          licensed CC BY-SA 4.0.
        </blockquote>
        <p>
          If you want the dataset in bulk, ask me rather than scraping the
          site. It is licensed for you to have; a copy is easier for both of
          us than thousands of requests.
        </p>
      </LegalSection>

      <LegalSection id="code-licence" heading="Using the code">
        <p>
          The application’s source is licensed{' '}
          <a
            href="https://opensource.org/licenses/MIT"
            rel="license noopener noreferrer"
            className={LEGAL_LINK_CLASSNAME}
          >
            MIT
          </a>
          , © 2026 Davis Kim. Fork it, change it, sell it — keep the copyright
          notice.
        </p>
        <p>
          Two things the licences above do not cover. Chemical structure
          depictions and third-party reference documents belong to whoever
          published them and are cited, not relicensed. And any third-party
          dataset used to train the experimental odour model keeps its own
          licence: it is not part of the material data and is not released
          under CC BY-SA.
        </p>
      </LegalSection>

      <LegalSection id="accounts" heading="Accounts">
        <LegalList>
          <li>
            Give a real email address you can receive mail at — it is how you
            confirm the account and reset the password.
          </li>
          <li>
            Your password is yours to look after. What happens under your
            account is your responsibility; tell me if you think someone else
            has got into it.
          </li>
          <li>
            One account per person. Don’t sign up as someone else, and don’t
            sign up as a program.
          </li>
          <li>
            You can delete your account at any time from the{' '}
            <Link href="/account" className={LEGAL_LINK_CLASSNAME}>
              account page
            </Link>
            . It is immediate and permanent, and it takes your saved materials
            and notes with it.
          </li>
          <li>
            I may suspend or remove an account being used to attack the site,
            to reach other people’s data, or to do something plainly unlawful.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="use" heading="Using the site">
        <p>
          Read it, cite it, build on it, teach from it. The things not to do
          are the obvious ones:
        </p>
        <LegalList>
          <li>
            Don’t attack the site, probe it for holes, or try to reach data
            that is not yours — other people’s notes especially.
          </li>
          <li>
            Don’t hammer it with automated traffic. Requesting it faster than a
            person could read it degrades it for everyone, and the bulk data is
            available for the asking.
          </li>
          <li>
            Don’t use it to impersonate the project, or to present its content
            as regulatory clearance for a product.
          </li>
          <li>
            Notes are a scratchpad, not a records system. Don’t keep anything
            in them that you cannot afford to lose, and don’t put other
            people’s personal information in them.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="corrections" heading="Corrections">
        <p>
          Editorial control rests with me: I write the entries and I decide
          what goes in. That is what keeps the citation standard consistent,
          and it is the project’s whole point of difference.
        </p>
        <p>
          Corrections are genuinely welcome, and an error with a source behind
          it will be fixed. A form for submitting them is planned but not
          built yet, so for now the route is email. If you send a correction,
          you are confirming it is yours to send, and you are letting me
          publish it under the data licence above.
        </p>
      </LegalSection>

      <LegalSection id="warranty" heading="No warranty">
        <p>
          The site is provided as it is, free, with no warranty of any kind —
          not of accuracy, completeness, currency, availability or fitness for
          any purpose. Entries can be wrong. Sources can be superseded. The
          site can be down, and it can lose data.
        </p>
        <p>
          Independent verification is not a formality here. It is the correct
          way to use a reference before you put a material on skin.
        </p>
      </LegalSection>

      <LegalSection id="liability" heading="Limitation of liability">
        <p>
          To the fullest extent the law allows, I am not liable for any loss or
          damage arising from your use of this site or your reliance on
          anything in it — including any formulation, purchase, regulatory or
          commercial decision you take on the strength of it. Where liability
          cannot be excluded, it is limited to the amount you have paid to use
          the site, which is nothing.
        </p>
        <p>
          Nothing here tries to exclude liability that cannot lawfully be
          excluded — including for death or personal injury caused by
          negligence, or for fraud.
        </p>
      </LegalSection>

      <LegalSection id="changes" heading="Changes, and the right to stop">
        <p>
          This is a free project maintained by one person in his own time. I
          may change, move, restrict or withdraw the site or any part of it at
          any time, without notice, and I am not obliged to keep it running.
        </p>
        <p>
          If these terms change, the date at the top of this page changes with
          them. The data and code licences are perpetual and are not affected
          by any of this — anything already released under them stays released.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" heading="Governing law">
        {/* MAKER: deliberately blank. Governing law and venue follow from
            where you are actually resident and where the project is operated,
            and neither the agent that drafted this nor the orchestrator that
            reviewed it should guess. Fill in a jurisdiction (and, if you want
            one, a venue for disputes) and delete this placeholder. */}
        <p>
          These terms are governed by the law of{' '}
          <LegalPlaceholder>
            maker: governing law and venue — to be decided
          </LegalPlaceholder>
          . This clause is deliberately unfilled rather than guessed at.
        </p>
      </LegalSection>

      <LegalSection id="contact" heading="Contact">
        <p>
          Questions about these terms, licensing, or bulk data go to the same
          address as everything else:{' '}
          {/* MAKER: same placeholder as /privacy — hello@perfumerscodex.com is
              a Week 20 item in docs/maker-todo.md and is not set up yet.
              Update both pages together. */}
          <LegalPlaceholder>
            maker: contact email — hello@perfumerscodex.com is planned but not
            live yet
          </LegalPlaceholder>
        </p>
        <p>
          See also the{' '}
          <Link href="/privacy" className={LEGAL_LINK_CLASSNAME}>
            privacy policy
          </Link>
          , which describes what the site collects and how to delete it.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
