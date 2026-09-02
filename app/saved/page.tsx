import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bookmark } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { MaterialCard, MaterialCardGrid } from '@/components/material-card'
import { Button } from '@/components/ui/button'
import { getCurrentUserId, getSavedMaterials } from '@/lib/db/bookmarks'

/**
 * The reader's own shelf (W5-B / P3-A).
 *
 * Gated the way `/account` is: a server component that asks
 * `supabase.auth.getUser()` — which validates the token against the auth
 * server — and sends anyone without a session to `/login`. The list itself is
 * read through the Supabase client, so Row-Level Security, not this page, is
 * what decides whose rows come back.
 *
 * The cards are the shared `components/material-card.tsx`, the same unit the
 * index and the family pages use, so three lists of materials cannot drift
 * into three different-looking things.
 */

// Without this Next statically prerenders the route and the query runs at
// build time, so `next build` starts depending on a live database (CI has
// none). The deliberate caching pass comes after seeding settles (wave-4.md,
// constraint 3) — and a per-reader page would need care there in any case.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Saved',
  // One person's private shelf; nothing here belongs in a search index.
  robots: { index: false },
}

export default async function SavedPage() {
  // Throws rather than redirecting when the auth service itself is
  // unreachable — bouncing a signed-in reader to /login over a network blip
  // would be a lie about their session (the distinction lives in
  // lib/db/bookmarks.ts, and app/account/page.tsx draws the same line).
  const userId = await getCurrentUserId()
  if (userId === null) redirect('/login')

  const materials = await getSavedMaterials()

  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <h1 className="text-3xl">Saved</h1>
      <p className="mt-3 max-w-measure text-muted-foreground">
        The materials you have kept, most recent first. Only you can see this
        list.
      </p>

      {materials.length === 0 ? (
        // Signed in, nothing saved — a real state, not a failure. Content
        // passed to the one shared empty state (D4), with the way onward.
        <EmptyState
          className="mt-12"
          icon={Bookmark}
          title="Nothing saved yet"
          description="Save a material from its page and it will be waiting here — a shortlist you can come back to at the bench."
          action={
            <Button asChild variant="outline" size="lg">
              <Link href="/materials">Browse materials</Link>
            </Button>
          }
        />
      ) : (
        <section aria-labelledby="saved-materials-heading" className="mt-12">
          {/* The h2 the cards' h3 headings sit under, keeping the outline
              h1 → h2 → h3 (the contract in material-card.tsx). */}
          <h2
            id="saved-materials-heading"
            className="text-sm font-normal text-muted-foreground"
          >
            {materials.length}{' '}
            {materials.length === 1 ? 'material' : 'materials'}
          </h2>

          <MaterialCardGrid className="mt-4">
            {materials.map((material) => (
              <li key={material.id}>
                <MaterialCard material={material} />
              </li>
            ))}
          </MaterialCardGrid>
        </section>
      )}
    </div>
  )
}
