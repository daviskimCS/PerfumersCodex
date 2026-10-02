/**
 * The stored 2D structure diagram: how the seed turns RDKit's raw SVG into the
 * markup a material page inlines, and the check that markup must pass on its
 * way into the database and again on its way out to the page.
 *
 * Pure and database-free, so the seed (`scripts/draw.ts`) and the page
 * (`components/material/structure.tsx`) share one definition and Vitest runs
 * it without RDKit or Postgres.
 */

/**
 * Drawn at 2x the plate's CSS size so the vector has room for its labels.
 * These are the options the browser used when it drew the diagram itself, so
 * a stored drawing looks the same as the ones readers saw before.
 */
export const STRUCTURE_DRAW_OPTIONS = {
  width: 640,
  height: 480,
  backgroundColour: [0, 0, 0, 0],
  bondLineWidth: 1.4,
  addStereoAnnotation: true,
} as const

/**
 * Narrows RDKit's SVG to markup that is safe to inline in an HTML body and
 * that follows the page's ink in both colour modes. Returns null when the
 * input is not an SVG at all.
 *
 * - Drops the XML prolog and comments: a prolog is invalid inside an HTML
 *   body, and comments are bytes nobody reads.
 * - Drops the background `<rect>`. RDKit paints it in `#00000000` (black with
 *   zero alpha), and the old in-browser version turned that into the invalid
 *   colour `currentColor00` by rewriting `#000000` as a prefix. A browser
 *   discards an invalid fill and falls back to black, so the plate showed a
 *   solid black box behind the molecule. A transparent background is the
 *   same as no background, so the rect goes entirely.
 * - Swaps pure black, as a whole six-digit colour only, for `currentColor`,
 *   so the carbon skeleton inherits the page's ink and heteroatoms keep the
 *   CPK colours a chemist expects to read.
 * - Removes the root element's fixed pixel size and keeps its `viewBox`, so
 *   the drawing scales with its plate. Only the root loses them: inner
 *   elements carry width/height of their own.
 */
export function adaptStructureSvg(raw: string): string | null {
  const start = raw.indexOf('<svg')
  if (start === -1) return null

  const body = raw
    .slice(start)
    .replaceAll(/<!--[\s\S]*?-->/g, '')
    .replace(/<rect\b[^>]*>\s*<\/rect>|<rect\b[^>]*\/>/, '')
    .replaceAll(/#000000(?![0-9a-f])/gi, 'currentColor')

  const tagEnd = body.indexOf('>')
  if (tagEnd === -1) return null
  const openTag = body
    .slice(0, tagEnd)
    .replace(/\s(?:width|height)=(?:'[^']*'|"[^"]*")/g, '')
    .replaceAll(/\s+/g, ' ')

  // Line breaks between elements are RDKit's formatting, not content.
  return (openTag + body.slice(tagEnd)).replaceAll(/>\s+</g, '><').trim()
}

/** The only elements RDKit's drawer emits for a structure (2025.03). */
const ALLOWED_ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'ellipse',
  'circle',
  'polygon',
  'polyline',
  'line',
])

/** The only attributes those elements carry. No event handler, no link. */
const ALLOWED_ATTRIBUTES = new Set([
  'version',
  'baseProfile',
  'xmlns',
  'xmlns:rdkit',
  'xmlns:xlink',
  'xml:space',
  'viewBox',
  'class',
  'style',
  'd',
  'x',
  'y',
  'width',
  'height',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x1',
  'y1',
  'x2',
  'y2',
  'points',
  'fill',
  'stroke',
  'stroke-width',
  'opacity',
])

/**
 * True when `svg` is a structure drawing this app will inline: one `<svg>`
 * root built only from the elements and attributes RDKit's drawer emits.
 *
 * The page inlines the stored markup with `dangerouslySetInnerHTML`, so this
 * is an allowlist, not a blocklist: a `<script>`, a `<foreignObject>`, an
 * `onload=` or an `href` fails because it is not on the list, not because
 * someone remembered to forbid it. The seed refuses to store a drawing that
 * fails, and the page refuses to render one, so a row written by hand in the
 * SQL editor cannot put markup on a page that RDKit would never have drawn.
 */
export function isSafeStructureSvg(svg: string): boolean {
  if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) return false
  // Entities and CDATA are how markup hides inside markup; RDKit uses neither.
  if (svg.includes('&') || svg.includes('<!')) return false
  // Inline styles are allowed, so CSS that loads or runs anything is not.
  if (/url\s*\(|javascript:|expression\s*\(|@import/i.test(svg)) return false

  const tags = svg.match(/<[^>]*>/g) ?? []
  // Every `<` must open a tag the scan above saw; a stray one means markup
  // the tag regex could not read.
  if (tags.length !== (svg.match(/</g) ?? []).length) return false

  let roots = 0
  for (const tag of tags) {
    const name = /^<\/?([A-Za-z][\w:-]*)/.exec(tag)?.[1]
    if (name === undefined || !ALLOWED_ELEMENTS.has(name)) return false
    if (name === 'svg' && !tag.startsWith('</')) roots += 1
    if (tag.startsWith('</')) continue

    // Whatever remains of the tag once every allowed `name='value'` pair is
    // removed must be empty (or a self-closing slash).
    const rest = tag
      .slice(name.length + 1, -1)
      .replaceAll(
        /\s([A-Za-z][\w:-]*)=(?:'[^'<>]*'|"[^"<>]*")/g,
        (pair, attribute: string) =>
          ALLOWED_ATTRIBUTES.has(attribute) ? '' : pair
      )
    if (!/^\s*\/?\s*$/.test(rest)) return false
  }
  return roots === 1
}
