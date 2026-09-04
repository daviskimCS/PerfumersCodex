import type { Metadata } from 'next'

import { HideSiteChrome } from '@/components/gate/hide-site-chrome'
import { UnlockForm } from '@/components/gate/unlock-form'

/**
 * `/unlock` — the one route the pre-launch gate leaves open.
 *
 * A Server Component whose only job is the page's metadata; the form is
 * `components/gate/unlock-form.tsx` (the split
 * `app/(auth)/login/page.tsx` documents).
 *
 * IT DOES NOT READ THE GATE'S STATE. Rendering "the gate is off" or a 404
 * based on `isGateEnabled()` would be a build-time decision, not a run-time
 * one: `next build` runs with no environment (CI), so whatever this page
 * concluded at build time could be baked into a prerender and then served by a
 * gated deployment. The form renders unconditionally and the action decides —
 * where the answer is always current.
 *
 * The chrome is hidden here for the same reason as on the pre-launch page: the
 * header's search field and "Sign in" link describe the site to someone who
 * has not yet been let into it.
 *
 * Nothing is fetched, so no `loading.tsx` / `error.tsx` (D4).
 */
export const metadata: Metadata = {
  title: 'Unlock',
  description: 'Enter the password to preview Perfumers Codex before launch.',
  // Never indexed: it is a password prompt, and it is temporary.
  robots: { index: false, follow: false },
}

export default function UnlockPage() {
  return (
    <>
      <HideSiteChrome />
      <UnlockForm />
    </>
  )
}
