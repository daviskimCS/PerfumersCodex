import { ImageResponse } from 'next/og'

import GenericOpengraphImage, {
  CardShell,
  MARK_SRC,
  size,
} from '@/app/opengraph-image'
import { humanize } from '@/components/material/format'
import { getMaterialBySlug } from '@/lib/db/materials'

/**
 * The per-material Open Graph card.
 *
 * WHAT IT MAY SAY. The canonical name and the material type, and nothing else.
 * Every other field on a material is a cited fact — CAS number, IFRA limit,
 * GHS hazard, olfactive description — and AGENTS.md is explicit that a cited
 * fact belongs next to its citation. A share card cannot carry a citation, so
 * it cannot carry the fact. Name and type are identity, not claims.
 *
 * IT MUST NOT THROW. A card that 500s does not fall back to the site-wide one;
 * it produces a broken image in every social preview, on every platform, and
 * the platforms cache that for a long time. So the database read is wrapped,
 * and both a missing material and an unreachable database render the generic
 * card by calling the site-wide route's own component — not a copy of it, so
 * the two cannot drift.
 */

// Mirrors the page's own choice (app/materials/[slug]/page.tsx): without it,
// `next build` would try to prerender this image and the build would start
// depending on a live database, which CI does not have. The deliberate
// caching pass is still deferred (wave-4.md).
export const dynamic = 'force-dynamic'

// app/globals.css tokens.
const INK = '#1a1713' // foreground
const BRAND = '#7c4726' // brand
const BRAND_SUBTLE = '#fde3d2' // brand-subtle
const BRAND_MUTED = '#e9c3ab' // brand-muted

export const alt = 'A material in the Perfumers Codex.'
export { size }
export const contentType = 'image/png'

/**
 * Long names wrap rather than overflow, but there is a point past which
 * wrapping alone stops being enough — so the type steps down first, and a
 * pathological name is cut. 78 characters is well past any real canonical
 * name; it exists so a bad row cannot produce a card with text running off
 * the edge.
 */
function nameFontSize(name: string): number {
  if (name.length > 44) return 52
  if (name.length > 28) return 66
  if (name.length > 18) return 78
  return 92
}

function clamp(name: string): string {
  return name.length > 78 ? `${name.slice(0, 77)}…` : name
}

export default async function MaterialOpengraphImage({
  params,
}: {
  // Next 16: `params` is a promise on metadata image routes too.
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const material = await getMaterialBySlug(slug).catch(() => null)
  // Unknown slug, soft-deleted row, or a database that did not answer — all
  // three are the same thing to a social crawler, and all three get the card
  // that always works.
  if (!material) return GenericOpengraphImage()

  const name = clamp(material.canonicalName)

  return new ImageResponse(
    <CardShell>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          color: BRAND,
          fontSize: 24,
          letterSpacing: '0.16em',
        }}
      >
        {/* A raw <img>, not next/image — see app/opengraph-image.tsx. */}
        <img src={MARK_SRC} width={52} height={52} alt="" />
        <div style={{ display: 'flex' }}>PERFUMERS CODEX</div>
      </div>

      <div
        style={{
          display: 'flex',
          marginTop: 40,
          maxWidth: 1024,
          fontSize: nameFontSize(name),
          lineHeight: 1.12,
          letterSpacing: '-0.022em',
          color: INK,
        }}
      >
        {name}
      </div>

      <div
        style={{
          display: 'flex',
          marginTop: 36,
          width: 148,
          height: 3,
          backgroundColor: BRAND_MUTED,
        }}
      />

      <div style={{ display: 'flex', marginTop: 36 }}>
        <div
          style={{
            display: 'flex',
            paddingTop: 12,
            paddingBottom: 12,
            paddingLeft: 30,
            // 4px less than the left. Letter-spacing is applied after the
            // last glyph too, so an evenly-padded tracked label sits visibly
            // left of centre in its pill; this takes that trailing space back.
            paddingRight: 26,
            borderRadius: 999,
            border: `2px solid ${BRAND_MUTED}`,
            backgroundColor: BRAND_SUBTLE,
            color: BRAND,
            fontSize: 26,
            letterSpacing: '0.14em',
          }}
        >
          {/* The same enum-to-prose helper the detail page uses, so the card
              and the page can never disagree about how a type is spelled. */}
          {humanize(material.materialType).toUpperCase()}
        </div>
      </div>
    </CardShell>,
    { ...size }
  )
}
