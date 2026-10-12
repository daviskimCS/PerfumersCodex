import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'

import { HideSiteChrome } from '@/components/gate/hide-site-chrome'
import { UnlockForm } from '@/components/gate/unlock-form'
import { isGateEnabled } from '@/lib/gate'

/**
 * `/unlock` — the one route the pre-launch gate leaves open.
 *
 * A Server Component whose only job is the page's metadata; the form is
 * `components/gate/unlock-form.tsx` (the split
 * `app/(auth)/login/page.tsx` documents).
 *
 * It 404s when the gate is off, so a public site has no password prompt
 * lying around. That check must run per request, not at build time: `next
 * build` runs with no environment (CI), and a build-time answer could be baked
 * into a prerender and served by a gated deployment. `connection()` makes the
 * page wait for a request before it reads the gate's state.
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

export default async function UnlockPage() {
  await connection()
  if (!isGateEnabled()) notFound()

  return (
    <>
      <HideSiteChrome />
      <UnlockForm />
    </>
  )
}
