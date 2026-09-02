import Link from 'next/link'

import { humanize } from '@/components/material/format'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { MaterialSummary } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * One material as a browse-list row.
 *
 * The single card used by the `/materials` index, `/families/[slug]`, and
 * (W5-B) `/saved`. Three lists that render the same thing three ways is
 * exactly the divergence this file exists to prevent — if a list needs
 * something this cannot show, widen this component rather than opening a
 * second card.
 *
 * Server component. The whole card is one link rather than a link on the
 * title, because a 200px-wide card with a 20px click target is a worse
 * affordance than a slightly less granular one — which is also why the family
 * names render as plain badges and not as links to `/families/[slug]`:
 * interactive elements cannot nest inside an anchor. The family pages and the
 * index's filter row are where family navigation lives.
 *
 * Heading level is fixed at `h3` and that is a contract with the callers:
 * every page using this puts the list under an `h2` section heading, so the
 * document outline stays h1 → h2 → h3.
 */
export function MaterialCard({ material }: { material: MaterialSummary }) {
  return (
    <Link
      href={`/materials/${material.slug}`}
      className="group flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-strong hover:bg-accent"
    >
      {/* Same label treatment as the detail page's hero, so a material reads
          the same in a list as it does on its own page. */}
      <p className="font-mono text-2xs tracking-widest text-muted-foreground uppercase">
        {humanize(material.materialType)}
      </p>

      <h3 className="mt-2 text-base leading-snug font-medium underline-offset-4 group-hover:underline">
        {material.canonicalName}
      </h3>

      {/* Mono because a CAS number is inherently monospaced data (globals.css
          keeps `font-mono` as that semantic name even while every face is the
          same). Naturals carry none, so this is a real absence, not a gap. */}
      {material.casNumber !== null ? (
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          CAS {material.casNumber}
        </p>
      ) : null}

      {material.families.length > 0 ? (
        // `mt-auto` pins the families to the bottom edge so cards in a row
        // line up whether or not the one beside them has a CAS number.
        <ul className="mt-auto flex flex-wrap gap-1.5 pt-4">
          {material.families.map((family) => (
            <li key={family.slug}>
              <Badge variant="outline">{family.name}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </Link>
  )
}

/**
 * The card's skeleton, kept in this file so it cannot drift from the card.
 *
 * Heights are line-heights off the type scale in globals.css — text-2xs is
 * 1rem (h-4), text-xs 1rem, text-base 1.25rem here (leading-snug), Badge is
 * h-5 — rather than eyeballed values, so `loading.tsx` swaps for the real
 * list without the grid jumping.
 */
export function MaterialCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-border bg-card p-4',
        className
      )}
    >
      <Skeleton className="h-4 w-16" />
      <Skeleton className="mt-2 h-5 w-40 max-w-full" />
      <Skeleton className="mt-1 h-4 w-24" />
      <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
        <Skeleton className="h-5 w-20 rounded-4xl" />
      </div>
    </div>
  )
}

/**
 * The grid the three lists share, so their column rhythm cannot diverge.
 * It renders the `<ul>`; children must be `<li>` elements.
 */
export function MaterialCardGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <ul
      className={cn(
        'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {children}
    </ul>
  )
}
