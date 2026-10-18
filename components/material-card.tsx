import Link from 'next/link'

import { humanize } from '@/components/material/format'
import { isSafeStructureSvg } from '@/lib/structure/svg'
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
export function MaterialCard({
  material,
  structureSvg,
}: {
  material: MaterialSummary
  /**
   * The stored drawing, from `listStructureThumbnails`. `undefined` renders
   * the card without a thumbnail column at all (the structure search, which
   * has no drawings to hand); `null` means "looked, there is none".
   */
  structureSvg?: string | null
}) {
  const withThumbnail = structureSvg !== undefined
  return (
    <Link
      href={`/materials/${material.slug}`}
      className="group flex h-full gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-strong hover:bg-accent"
    >
      {withThumbnail ? (
        <CardStructure
          svg={structureSvg}
          isMixture={material.materialType === 'natural'}
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
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
              <li key={family.slug} className="max-w-full min-w-0">
                {/* The thumbnail narrowed this column, so a long family name
                    truncates instead of pushing past the card's edge; the
                    full name is on the material page. */}
                <Badge variant="outline" className="block max-w-full truncate">
                  {family.name}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Link>
  )
}

/**
 * The card's structure thumbnail: the site's one kind of image, on the list
 * that most needed one. The same stored RDKit drawing the material page
 * shows, re-checked before it is inlined for the same reason it is there (a
 * hand-edited row must not put markup on the page RDKit never drew). Bonds
 * are thickened in CSS, since strokes drawn for a 320px plate vanish at
 * thumbnail size. Static: the draw-in animation belongs to the page.
 *
 * Decorative (`aria-hidden`): the card's link text already names the
 * material, and "structure diagram of Iso E Super" read out once per card
 * would only lengthen every list for a screen reader.
 */
function CardStructure({
  svg,
  isMixture,
}: {
  svg: string | null
  isMixture: boolean
}) {
  const safe = svg !== null && isSafeStructureSvg(svg)
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex h-[4.5rem] w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border p-1.5 text-foreground',
        safe ? 'border-border bg-surface' : 'border-dashed border-border'
      )}
    >
      {safe ? (
        <div
          className="card-structure size-full [&>svg]:size-full"
          // Checked by isSafeStructureSvg just above; see structure.tsx.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <span className="px-1 text-center font-mono text-2xs text-muted-foreground">
          {isMixture ? 'mixture' : 'no drawing'}
        </span>
      )}
    </div>
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
export function MaterialCardSkeleton({
  className,
  withThumbnail = true,
}: {
  className?: string
  /** Matches `MaterialCard`'s `structureSvg`: false where cards have none. */
  withThumbnail?: boolean
}) {
  return (
    <div
      className={cn(
        'flex gap-4 rounded-xl border border-border bg-card p-4',
        className
      )}
    >
      {withThumbnail ? (
        <Skeleton className="h-[4.5rem] w-24 shrink-0 rounded-lg" />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mt-2 h-5 w-40 max-w-full" />
        <Skeleton className="mt-1 h-4 w-24" />
        <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
          <Skeleton className="h-5 w-20 rounded-4xl" />
        </div>
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
