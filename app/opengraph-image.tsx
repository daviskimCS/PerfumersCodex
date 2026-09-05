import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * The site-wide Open Graph card.
 *
 * Next's file convention picks this up automatically and emits the og:image
 * tags — app/layout.tsx does not need (and does not have) an `images` entry.
 *
 * TYPEFACE. JetBrains Mono Regular, the family the site itself sets
 * (app/layout.tsx), read from the repository's own copy under assets/fonts.
 * `ImageResponse` needs font *data* in ttf/otf/woff, so the next/font face the
 * pages use is no help here; this is the static 400 instance from the same
 * release. One weight, because Satori does not synthesise bold and the cards
 * build their hierarchy from size, colour and letter-spacing instead.
 *
 * Supplying `fonts` is not decoration. Without it `next/og` renders its
 * bundled Geist and, for any glyph Geist lacks, fetches Noto Sans from
 * fonts.googleapis.com + fonts.gstatic.com at REQUEST time — and perfumery
 * names are full of glyphs Geist lacks (α-ionone, β-caryophyllene,
 * γ-undecalactone). Every such card was a hidden third-party dependency with
 * tofu as its failure mode, and Satori falls back per WORD, so the whole
 * Greek-prefixed name would set in a different face. JetBrains Mono carries
 * Greek natively, so with it supplied there is no glyph left for that path to
 * fetch (docs/maker-todo.md, item 5).
 *
 * `process.cwd()` plus a literal path is the loading pattern Next documents
 * for this, and output file tracing follows it: the font is listed in each
 * card route's route.js.nft.json under .next/server/app, so it ships in the
 * serverless bundle with no next.config change.
 *
 * Nothing here depends on the request — the font comes off disk, not the
 * network — so this route stays statically optimised: it is generated once at
 * build time and cannot fail at request time.
 */

const FONT_PATH = join(
  process.cwd(),
  'assets/fonts/jetbrains-mono/JetBrainsMono-Regular.ttf'
)

type CardFonts = NonNullable<
  ConstructorParameters<typeof ImageResponse>[1]
>['fonts']

// Read once per process, not once per card: the per-material route is
// force-dynamic and would otherwise hit the disk on every share.
let fontData: Promise<Buffer> | undefined

/**
 * The `fonts` option every card passes to ImageResponse.
 *
 * Resolves to `undefined` — next/og's default face — only if the file cannot
 * be read. That is a deployment defect (the font missing from the traced
 * bundle), not a request-time condition, and it is logged as one; but a card
 * in the wrong face beats a 500, which every social platform caches as a
 * broken image for a long time. The per-material route's own promise is that
 * it never throws, and this keeps that promise for the font as well as the
 * database.
 */
export async function cardFonts(): Promise<CardFonts> {
  try {
    fontData ??= readFile(FONT_PATH)
    return [
      {
        name: 'JetBrains Mono',
        data: await fontData,
        weight: 400,
        style: 'normal',
      },
    ]
  } catch (error) {
    fontData = undefined
    console.error(
      `[opengraph-image] could not read ${FONT_PATH}; rendering in next/og's default face`,
      error
    )
    return undefined
  }
}

// Palette. Literal hexes because Satori has no cascade to read tokens from —
// these are the values recorded beside the tokens in app/globals.css.
const PAPER = '#faf2e8' // background
const INK = '#1a1713' // foreground
const INK_MUTED = '#615b55' // muted-foreground
const BRAND_MUTED = '#e9c3ab' // brand-muted (hairline)
const CHROME = '#4a2d1d' // chrome — the site's header/footer rail
const CHROME_INK = '#f6efe6' // chrome-foreground
const CHROME_INK_MUTED = '#cdbcab' // chrome-muted-foreground

/**
 * The mark from app/icon.svg, minus the dark-mode block — this card has a
 * fixed light ground, so there is nothing to respond to. Kept as a string
 * rather than read off disk: a runtime `readFile` of a source file is not
 * covered by Next's output file tracing and would 500 on Vercel.
 */
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><rect width="32" height="32" rx="6.5" fill="#7c4726"/><g fill="#f6efe6"><path d="M4.6 9.6 C7.4 6.9 11.8 7.2 15 9.8 L15 25.2 C11.8 22.6 7.4 22.3 4.6 25.0 Z"/><path d="M27.4 9.6 C24.6 6.9 20.2 7.2 17 9.8 L17 25.2 C20.2 22.6 24.6 22.3 27.4 25.0 Z"/></g></svg>`

export const MARK_SRC = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString('base64')}`

/**
 * The rippled grain of the site background, flattened into what Satori can
 * actually draw: a vertical multi-stop gradient. The real thing is two
 * turbulence tiles over two gradients (app/globals.css, BACKGROUND) and none
 * of that survives a flexbox-only renderer — but the banding does, and the
 * banding is what the texture reads as at card size.
 */
export const PAPER_GRAIN =
  'linear-gradient(to bottom, #faf2e8 0%, #f8eddf 16%, #faf2e8 33%, #f6e9d9 52%, #faf2e8 68%, #f7ebdd 86%, #faf2e8 100%)'

export const alt =
  'Perfumers Codex — an open-source, curated aromachemical reference for working perfumers.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * The bottom rail, shared by this card and the per-material one. It is the
 * site's footer: an opaque deep-brown band with cream type.
 */
export function CardRail() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 88,
        paddingLeft: 88,
        paddingRight: 88,
        backgroundColor: CHROME,
        color: CHROME_INK,
        fontSize: 24,
        letterSpacing: '0.14em',
      }}
    >
      <div style={{ display: 'flex' }}>PERFUMERSCODEX.COM</div>
      <div style={{ display: 'flex', color: CHROME_INK_MUTED }}>
        CITATION-DRIVEN
      </div>
    </div>
  )
}

/** The paper field every card is built on: top rule, body, bottom rail. */
export function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: PAPER,
        backgroundImage: PAPER_GRAIN,
        color: INK,
        // Inherited by everything on the card, including the rail. Only one
        // family is ever supplied, but naming it keeps the intent legible.
        fontFamily: 'JetBrains Mono',
      }}
    >
      {/* The header rail, reduced to its edge — the site's frame, not its UI. */}
      <div style={{ display: 'flex', height: 14, backgroundColor: CHROME }} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          paddingLeft: 88,
          paddingRight: 88,
        }}
      >
        {children}
      </div>
      <CardRail />
    </div>
  )
}

export default async function OpengraphImage() {
  return new ImageResponse(
    <CardShell>
      {/* A raw <img>, not next/image: next/image is a React component that
            needs the Next runtime, and Satori renders plain elements. */}
      <img src={MARK_SRC} width={96} height={96} alt="" />
      <div
        style={{
          display: 'flex',
          marginTop: 44,
          fontSize: 88,
          letterSpacing: '-0.022em',
          color: INK,
        }}
      >
        Perfumers Codex
      </div>
      <div
        style={{
          display: 'flex',
          marginTop: 34,
          width: 148,
          height: 3,
          backgroundColor: BRAND_MUTED,
        }}
      />
      <div
        style={{
          display: 'flex',
          marginTop: 34,
          maxWidth: 900,
          fontSize: 34,
          lineHeight: 1.45,
          color: INK_MUTED,
        }}
      >
        An open-source, public, curated aromachemical reference for working
        perfumers.
      </div>
    </CardShell>,
    { ...size, fonts: await cardFonts() }
  )
}
