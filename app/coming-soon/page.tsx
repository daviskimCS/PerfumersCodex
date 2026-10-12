import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'

import { HideSiteChrome } from '@/components/gate/hide-site-chrome'
import { isGateEnabled } from '@/lib/gate'

/**
 * The pre-launch page — everything the public sees while the gate is closed.
 *
 * `proxy.ts` REWRITES every gated request here, so this one file renders at
 * `/`, at `/materials`, at `/search`, and at every other address someone tries.
 * The URL in the address bar is whatever they typed; only the body is this.
 *
 * WHAT IT MUST NOT DO, and the reason the file is this short: no material
 * names, no counts, no links into the site, no "coming soon: search and 500
 * materials". A construction page that describes what is behind it is a
 * catalogue with extra steps. The copy is the scaffold's own, which the real
 * homepage replaced in Wave 5 (commit 1155788) — it was written for exactly
 * this moment and says only what is true of the project as a whole.
 *
 * There is no link to `/unlock` on purpose. Anyone who is meant to get in is
 * being told the password by the maker, and can be told the address in the
 * same sentence; a visible "enter password" affordance only tells everyone
 * else that there is something here worth trying to open.
 *
 * No `loading.tsx` / `error.tsx` beside it (docs/architecture.md D4): the
 * segment fetches nothing and has no failure mode of its own, so both files
 * would be scaffolding for states that cannot occur.
 */
export const metadata: Metadata = {
  // `absolute` because this page answers to every URL on the site. The
  // template's "%s · Perfumers Codex" would read as a section that exists.
  title: { absolute: 'Perfumers Codex' },
  description:
    'A curated, citation-driven aromachemical reference for working perfumers. Launching Spring 2027.',
  // A construction page is not what this domain should be indexed for, and
  // every gated URL currently answers with it — indexing them would put the
  // whole route structure in a search engine under the wrong description.
  robots: { index: false, follow: false },
  // No canonical: it would differ per request URL and mean nothing while the
  // site is one page.
  alternates: {},
}

export default async function ComingSoonPage() {
  // With the gate off, nothing rewrites here, and a direct visit would show a
  // stale "launching Spring 2027" page on a live site. `connection()` keeps
  // the check at request time, so a build without the env var cannot bake a
  // 404 into a gated deployment (the trap app/unlock/page.tsx describes).
  await connection()
  if (!isGateEnabled()) notFound()

  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section md:px-gutter-lg">
      <HideSiteChrome />
      <div className="max-w-measure text-center">
        <h1 className="font-display text-3xl md:text-4xl">Perfumers Codex</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          A curated, citation-driven aromachemical reference for working
          perfumers. Under construction — launching Spring 2027.
        </p>
      </div>
    </div>
  )
}
