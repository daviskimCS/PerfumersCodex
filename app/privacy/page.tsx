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
 *   Google sign-in        app/(auth)/actions.ts `signInWithGoogle` (scopes:
 *                         email, profile — tests/integration/google…)
 *   sign-in records       Supabase Auth's own tables: auth.sessions (ip,
 *                         user_agent), auth.audit_log_entries (email, ip).
 *                         Verified against the auth server's migrations and
 *                         a local stack on 2026-10-12 (docs/legal/account-data.md)
 *   export                app/account/export/route.ts, lib/account/export.ts
 *   password reset        app/(auth)/actions.ts `requestPasswordReset`
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
            <strong className="font-medium">If you sign in with Google:</strong>{' '}
            your name, email address, profile picture address and Google
            account id, which Google passes to Supabase when you choose
            “Continue with Google”. The site asks Google for nothing else — no
            contacts, no calendar, no Drive, no access to your Google account
            after you have signed in.
          </li>
          <li>
            <strong className="font-medium">Your password.</strong> It is
            passed straight through to Supabase Auth, which stores it. This
            project’s own database has no password column — sign-in is not
            something I built, and it is not something I want to hold.
          </li>
          <li>
            <strong className="font-medium">Sign-in records.</strong> Supabase
            Auth, the sign-in service, keeps a record of each signed-in session
            (the IP address and browser it came from, and when) and a log of
            sign-in events such as signing in, changing a password or deleting
            the account (your email address, the IP address and the time). This
            is the one place your IP address is stored, and only if you have an
            account. It exists to keep accounts secure: to spot someone else
            signing in as you, and to investigate abuse.
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
            Reading the site records no IP address — not in the search log, not
            anywhere else. The only stored IP addresses are the sign-in records
            above, and only for people with an account. (Every visitor’s
            address still reaches the host that serves the page; see below.)
          </li>
          <li>
            No profile, no behavioural scoring, no cross-site tracking, no
            data broker, no third-party analytics beyond the cookieless one
            named above.
          </li>
          <li>
            No third-party fonts, images or embeds. The typeface is served
            from this site, and structure diagrams are drawn by this site
            from the molecule’s SMILES string rather than fetched from
            somewhere else, so reading a material page does not quietly
            announce you to another company.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="cookies" heading="Cookies">
        <p>
          Three, all strictly necessary, all named here because a policy that
          says “we use cookies” without saying which ones is telling you
          nothing. There is no consent banner because there is nothing to
          consent to — none of them tracks you.
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
          <li>
            <strong className="font-medium">The Google sign-in verifier</strong>{' '}
            — set for the few seconds between pressing “Continue with Google”
            and coming back, so the sign-in can only be finished in the browser
            that started it. It holds a random one-time value and is replaced by
            the authentication cookie when you return.
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
          Two companies always, and Google only if you choose it. Each has its
          own privacy policy, and Supabase and Vercel process this data on my
          behalf under their data processing terms.
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
          {/* Written for Google sign-in switched ON, because Google's OAuth
              verification reads this page before it lets the provider go
              live, and the page must already describe what Google sends.
              While the provider is off (docs/maker-todo.md item 4) the
              button returns "isn't available" and nothing reaches Google,
              so every sentence below stays true either way. */}
          <li>
            <strong className="font-medium">Google</strong> — only if you
            choose “Continue with Google”. Google then knows you used your
            Google account to sign in here, and sends Supabase the four things
            listed above. The site uses them only to create and sign in to your
            account, never for advertising, and never passes them to anyone
            else. Its use of information received from Google APIs adheres to
            the{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className={LEGAL_LINK_CLASSNAME}
            >
              Google API Services User Data Policy
            </a>
            , including its Limited Use requirements. You can cut the link from
            your Google account’s third-party connections page at any time;
            deleting your account here removes what Google sent.
          </li>
        </LegalList>
      </LegalSection>

      {/* GDPR Art. 13(1)(c) and (f): the purpose and legal basis of each
          kind of processing, and where the data goes. See
          docs/legal/account-data.md for the reasoning; a lawyer should
          confirm it before launch. */}
      <LegalSection id="basis" heading="Why, and on what basis">
        <LegalList>
          <li>
            <strong className="font-medium">
              Your account, saved materials and notes
            </strong>{' '}
            exist because you asked for them: holding them is how the site
            provides the account you signed up for under the{' '}
            <Link href="/terms" className={LEGAL_LINK_CLASSNAME}>
              terms
            </Link>
            . Giving an email address is required only for an account; reading
            the codex needs nothing.
          </li>
          <li>
            <strong className="font-medium">Sign-in records</strong> are kept
            because keeping accounts secure is a legitimate interest of yours
            and mine, and the records hold no more than that needs.
          </li>
          <li>
            <strong className="font-medium">
              The search log and analytics
            </strong>{' '}
            hold nothing that identifies you, so there is no personal data to
            have a basis for.
          </li>
          <li>
            Nothing here makes automated decisions about you, and nothing is
            used for advertising or sold.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="where" heading="Where it is stored">
        <p>
          Supabase stores the database and the sign-in service in{' '}
          <LegalPlaceholder>
            maker: the Supabase project&apos;s region (Project Settings →
            General), e.g. &quot;the United States (AWS us-east-1)&quot;
          </LegalPlaceholder>
          . Vercel serves pages from its network worldwide. If you are in the UK
          or the European Economic Area, using an account therefore means your
          data is handled outside it; both companies cover that transfer in
          their data processing terms with the European Commission’s standard
          contractual clauses (and the UK addendum).
        </p>
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
          {/* Checked 2026-10-12 against a local Supabase auth server: deleting
              a user removes auth.sessions, auth.identities and
              auth.refresh_tokens rows (tests/integration/email-password…),
              but auth.audit_log_entries is not keyed to the user and keeps
              the email address, including in the deletion event itself. The
              fix is a nightly pg_cron purge at 30 days
              (docs/maker-todo.md item 12). Update this item when it is done. */}
          <li>
            <strong className="font-medium">Sign-in records.</strong> Session
            records go when you sign out, when the session expires, or when you
            delete the account. The sign-in event log is kept for{' '}
            <LegalPlaceholder>
              maker: the retention period once item 12 in docs/maker-todo.md is
              done
            </LegalPlaceholder>
            . It is not tied to your account row, so deleting your account does
            not remove its past entries straight away; they are removed when
            that period runs out.
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
            offers no undo, and cannot restore any of it afterwards. The one
            exception is the sign-in event log described under{' '}
            <a href="#retention" className={LEGAL_LINK_CLASSNAME}>
              how long any of it is kept
            </a>
            , whose past entries age out rather than going at once. The codex
            itself is unaffected — it stays public and free to read without an
            account.
          </li>
          <li>
            <strong className="font-medium">Take a copy with you.</strong> The{' '}
            <Link href="/account" className={LEGAL_LINK_CLASSNAME}>
              account page
            </Link>{' '}
            has a “Download your data” button: one file with your account
            details, how you sign in (including what Google sent, if you use
            it), your saved materials and your notes, in a format any program
            can read. For a copy of your sign-in records, email me.
          </li>
          <li>
            <strong className="font-medium">
              Anything else the law where you live gives you
            </strong>{' '}
            — access, correction, portability, restriction, objection. Write to
            me and I will answer within a month, without making you argue about
            it. If you are in the UK or the EEA you can also complain to your
            data protection regulator (in the UK, the Information
            Commissioner’s Office), though I would like the chance to put it
            right first.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="security" heading="If something goes wrong">
        <p>
          Passwords are stored only as one-way hashes by Supabase. Every
          person’s notes and saved materials are walled off from everyone else’s
          by the database itself, and that wall is tested automatically, with
          real test accounts, on every proposed change to the code.
        </p>
        <p>
          If a breach ever exposes account data, I will email the people
          affected without undue delay, say what was exposed and what to do, and
          notify the regulators the law requires me to tell.
        </p>
      </LegalSection>

      <LegalSection id="children" heading="Children">
        <p>
          Accounts are for people aged 16 and over. The codex is a working
          reference for perfumers and is not aimed at children; if you believe a
          child has made an account, tell me and I will delete it.
        </p>
      </LegalSection>

      <LegalSection id="contact" heading="Contact">
        <p>
          The site is run by Davis Kim, who decides what happens to the data
          described here (in data protection terms, the controller). One person
          maintains it, and email reaches him directly:{' '}
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
          <strong className="font-medium">12 October 2026:</strong> added the
          sign-in records Supabase keeps (the earlier version wrongly said no IP
          address was stored anywhere), what Google sends if you sign in with
          it, the reasons and legal basis for each kind of data, where it is
          stored, the new “Download your data” button and password reset, and
          the sections on breaches and children.
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
