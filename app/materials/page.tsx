import type { Metadata } from 'next'
import Link from 'next/link'
import { FlaskConical } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { listMaterials } from '@/lib/db/materials'

// Without this, `next build` statically prerenders the page and the DB query
// runs at build time — so the build starts depending on a live database,
// which CI does not have. The real caching strategy is a later, deliberate
// decision (wave-3.md W3-B).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Materials',
  description:
    'Every material in the Perfumers Codex, listed by canonical name.',
}

// Deliberately plain (P1-F is "ugly but real") — the browse experience with
// filters and type badges is P2-G/P2-H.
export default async function MaterialsPage() {
  const allMaterials = await listMaterials()

  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section md:px-gutter-lg">
      <h1 className="text-3xl font-semibold tracking-tight">Materials</h1>
      {allMaterials.length === 0 ? (
        // The honest state of a reference that is still being written — the
        // corpus is curated by hand and simply has no published entries yet.
        <EmptyState
          icon={FlaskConical}
          title="The reference is being curated"
          description="Every entry is researched, written, and cited by hand, and the first materials haven't been published yet. Check back soon."
        />
      ) : (
        <ul className="mt-8 space-y-2">
          {allMaterials.map((material) => (
            <li key={material.id}>
              <Link
                href={`/materials/${material.slug}`}
                className="underline underline-offset-4 hover:no-underline"
              >
                {material.canonicalName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
