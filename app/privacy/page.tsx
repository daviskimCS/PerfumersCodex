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
 * The privacy policy (P4-E) — a launch blocker in docs/quality-checklist.md.
 *
 * Every claim below was read out of the code before it was written down, and
 * the sources are cited in comments so the next person to touch this page can
 * re-check them rather than trust it:
 *
 *   search log            db/schema.ts `searchQueries`, lib/db/search.ts
 *   accounts              app/(auth)/actions.ts
 *   bookmarks / notes     db/schema.ts `userSavedMaterials`, `userNotes`
 *   deletion              app/account/actions.ts `deleteAccount`
 *   analytics             app/layout.tsx (<Analytics />)
 *   cookies               lib/gate.ts, lib/supabase/server.ts
 *   browser storage       components/theme-toggle.tsx, lib/search/recent.ts
 *
 * If any of those change, this page changes in the same commit. A privacy
 * policy that lags the code is worse than none — it is a promise the software
 * has stopped keeping.
 *
 * No `loading.tsx` / `error.tsx`: static text, nothing fetched, no failure
 * mode (docs/architecture.md D4; the reasoning is written out in
 * app/coming-soon/page.tsx).
 */

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'What Perfumers Codex collects, what it deliberately does not, and how to delete everything it holds about you.',
  // `robots` is left at the site default on purpose: both legal documents
  // should be indexable once the pre-launch gate comes down. (While the gate
  // is up, proxy.ts rewrites this route to the construction page anyway, and
  // that page carries its own noindex.)
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      lead="Perfumers Codex is meant to be read without an account, and it is built to know as little about you as it can while still working."
    >
      {/* Lead with the unusual, true thing rather than burying it under a
          "what we collect" heading: the search log has no identity columns at
          all, which is not what a reader expects and is the single most
          load-bearing privacy fact about the site. */}
      <LegalSection id="searches" heading="Searches are recorded, but not you">
        <p>
          Every search on this site is written to a log. That log has three
          things in it: the search text after it is trimmed and lowercased, how
          many results came back, and the moment it happened.
        </p>
        <p>
          There is no user id, no IP address, no session key and no device
          identifier in it — not blank, not hashed, but{' '}
          <em>absent from the table</em>. Nothing in the database can attach a
          search to a person, and that stays true whether you are signed in or
          not.
        </p>
        <p>
          It exists for one reason: a search that returns zero results is
          usually a gap in the synonym table — a trade name or an abbreviation
          the codex does not know yet. Reading the misses is how the reference
          gets better at answering the names perfumers actually use.
        </p>
      </LegalSection>

      <LegalSection id="collects" heading="What the site collects">
        <p>
          Reading the codex needs no account and collects nothing that
          identifies you. Everything below is either the search log above, or
          something you get only by choosing to sign up.
        </p>
        <LegalList>
          <li>
            <strong className="font-medium">
              Your email address, if you make an account.
            </strong>{' '}
            It is your sign-in and the address confirmation and password-reset
            mail goes to.
          </li>
          <li>
            <strong className="font-medium">Your password.</strong> It is
            passed straight through to Supabase Auth, which stores it. This
            project’s own database has no password column — sign-in is not
            something I built, and it is not something I want to hold.
          </li>
          <li>
            <strong className="font-medium">Saved materials.</strong> Your
            account id, the material’s id, and when you saved it. That is the
            whole row.
          </li>
          <li>
            <strong className="font-medium">Private notes.</strong> Your
            account id, the material’s id, the text you wrote, and when you
            wrote and last changed it.
          </li>
          <li>
            <strong className="font-medium">Page views, in aggregate.</strong>{' '}
            The site uses Vercel Web Analytics, which is cookieless and stores
            no IP addresses. It counts visits to pages; it does not follow you
            between them or across other sites.
          </li>
        </LegalList>
        <p>
          Your notes and saved materials are yours. The database enforces that
          with row-level security: every read and write is scoped to the row’s
          owner, so no other reader — signed in or not — can reach them, and
          the site has no screen anywhere that shows one person’s notes to
          another.
        </p>
        <p>
          I should be straight about the limit of that. I administer the
          database, so I <em>can</em> read what is in it. I don’t, and I have
          no reason to, but a policy that told you it was technically
          impossible would be a promise the software does not enforce. Write
          notes accordingly.
        </p>
      </LegalSection>

      <LegalSection id="does-not" heading="What the site does not do">
        <LegalList>
          <li>No tracking cookies, and no advertising of any kind.</li>
          <li>
            No selling, renting or sharing of anything here. There is no
            business model that would want it.
          </li>
          <li>
            The application never records your IP address — not in the search
            log, not anywhere else. (Your address still reaches the host that
            serves the page; see below.)
          </li>
          <li>
            No profile, no behavioural scoring, no cross-site tracking, no
            data broker, no third-party analytics beyond the cookieless one
            named above.
          </li>
          <li>
            No third-party fonts, images or embeds. The typeface is served
            from this site, and structure diagrams are drawn in your browser
            from the molecule’s SMILES string rather than fetched from
            somewhere else, so reading a material page does not quietly
            announce you to another company.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="cookies" heading="Cookies">
        <p>
          Two, both strictly necessary, both named here because a policy that
          says “we use cookies” without saying which ones is telling you
          nothing. There is no consent banner because there is nothing to
          consent to — neither cookie tracks you.
        </p>
        <LegalList>
          <li>
            <code className="font-mono text-sm">pc_gate</code> — set only while
            the pre-launch gate is up, and only after someone enters the shared
            construction password. It holds a signed token saying the password
            was entered; it does not say who entered it. HTTP-only, and it
            expires after 30 days. It disappears entirely when the site opens
            to the public.
          </li>
          <li>
            <strong className="font-medium">
              The Supabase authentication cookie
            </strong>{' '}
            — set when you sign in, so that you stay signed in. It carries your
            session token. Signing out removes it.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection
        id="browser-storage"
        heading="Things kept in your browser, not on the server"
      >
        <p>
          Two small conveniences live in your browser’s local storage. Neither
          is sent to the server, and clearing your browser’s site data removes
          both.
        </p>
        <LegalList>
          <li>
            <code className="font-mono text-sm">theme</code> — whether you
            chose light, dark, or to follow your system.
          </li>
          <li>
            <code className="font-mono text-sm">
              perfumers-codex:recent-searches
            </code>{' '}
            — your last five searches, so the search palette can offer them
            back to you. This list stays on your device; the server never
            receives it.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="processors" heading="Who else handles any of this">
        <p>
          Two companies, each with its own privacy policy, and one that is not
          involved yet.
        </p>
        <LegalList>
          <li>
            <strong className="font-medium">Supabase</strong> — the database
            and the authentication service. Accounts, saved materials, notes
            and the search log all sit there.
          </li>
          <li>
            <strong className="font-medium">Vercel</strong> — hosting and the
            analytics described above. Every page is served from Vercel, and a
            request cannot reach any server without carrying the address it
            came from, so Vercel sees network-level details of your visit that
            this application never records or stores.
          </li>
          {/* Deliberately worded in the present tense and checked against
              app/(auth)/actions.ts: `signInWithGoogle` probes
              /auth/v1/settings and returns GOOGLE_UNAVAILABLE when the
              provider is off, which it currently is (docs/maker-todo.md item
              4). Nothing is sent to Google. Rewrite this bullet in the same
              commit that enables the provider. */}
          <li>
            <strong className="font-medium">Google</strong> — not yet. There is
            a “Continue with Google” button on the sign-in and sign-up pages,
            but the provider is not switched on: pressing it returns a notice
            saying Google sign-in isn’t available, and no data about you
            reaches Google. This page will be updated before that changes.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="retention" heading="How long any of it is kept">
        <LegalList>
          {/* THE RETENTION CLAIM. db/schema.ts and docs/database-schema.md
              both used to say these rows were purged after ~90 days by a
              Supabase scheduled job. That job does not exist — checked
              against the live database on 2026-09-05: no pg_cron extension,
              no cron schema, no job, oldest row still present. Both comments
              are now corrected and cross-referenced with this page
              (docs/maker-todo.md item 6b). If the purge is ever built, this
              sentence and those two comments change together. */}
          <li>
            <strong className="font-medium">Search entries</strong> are kept
            indefinitely today. I intend to delete them after about 90 days,
            but the scheduled job that would do it does not exist yet, and I am
            not going to describe a retention period the database does not
            enforce. When that job is running, this sentence will say so.
          </li>
          <li>
            <strong className="font-medium">
              Your account, saved materials and notes
            </strong>{' '}
            are kept for as long as your account exists, and go when it goes.
          </li>
          <li>
            <strong className="font-medium">Analytics</strong> are counts held
            by Vercel under its own retention. Nothing in them identifies you.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="rights" heading="Your data, and how to get at it">
        <LegalList>
          <li>
            <strong className="font-medium">
              See or change your email address, or set a new password
            </strong>{' '}
            on the{' '}
            <Link href="/account" className={LEGAL_LINK_CLASSNAME}>
              account page
            </Link>
            .
          </li>
          <li>
            <strong className="font-medium">
              Delete everything, yourself, at any time.
            </strong>{' '}
            The same{' '}
            <Link href="/account" className={LEGAL_LINK_CLASSNAME}>
              account page
            </Link>{' '}
            has a delete button. It removes your sign-in, your saved materials
            and your private notes immediately. It is a real deletion, not a
            flag on a row that stays behind: the application keeps no copy,
            offers no undo, and cannot restore any of it afterwards. The codex
            itself is unaffected — it stays public and free to read without an
            account.
          </li>
          <li>
            {/* No self-serve export exists (no route, no action). Stated as a
                commitment rather than a feature, so the page does not describe
                a button that is not there. MAKER: this is a promise you are
                making — say so or strike it. */}
            <strong className="font-medium">Ask for a copy.</strong> There is
            no export button yet. Email me and I will send you what your rows
            contain — that is your account’s email address, your saved
            materials and your notes, which is all of it.
          </li>
          <li>
            <strong className="font-medium">
              Anything else the law where you live gives you
            </strong>{' '}
            — access, correction, portability, objection, complaint to a
            regulator. Write to me and I will deal with it rather than make you
            argue about it.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="contact" heading="Contact">
        <p>
          One person maintains this site, and email reaches him directly:{' '}
          {/* MAKER: hello@perfumerscodex.com is planned but NOT set up — it is
              a Week 20 item in docs/maker-todo.md, alongside Resend. Put the
              address you actually read here, and replace this placeholder. */}
          <LegalPlaceholder>
            maker: contact email — hello@perfumerscodex.com is planned but not
            live yet
          </LegalPlaceholder>
        </p>
      </LegalSection>

      <LegalSection id="changes" heading="If this changes">
        <p>
          The date at the top of this page changes with it, and anything that
          alters what is collected or who sees it will be described here rather
          than folded in quietly.
        </p>
        <p>
          This page is a file in the project’s source repository. Once that
          repository is public, the full history of every word on it is public
          with it — which is the point of writing the policy from the code
          instead of from a template.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
