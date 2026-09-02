import { ImageResponse } from 'next/og'

/**
 * The site-wide Open Graph card.
 *
 * Next's file convention picks this up automatically and emits the og:image
 * tags — app/layout.tsx does not need (and does not have) an `images` entry.
 *
 * TYPEFACE. The site is monospaced (Geist Mono, loaded through next/font), but
 * `ImageResponse` needs font *data*, not a family name, and next/font resolves
 * to a woff2 subset that Satori cannot parse (ttf/otf/woff only). Fetching a
 * ttf from a third-party host at request time would make every social preview
 * depend on that host being up, which wave-7.md forbids. So this card renders
 * in `next/og`'s built-in default, which in Next 16 is Geist Regular read off
 * disk from next's own bundle — no network, no dependency, and the same
 * family as `--font-sans-alt`, which app/layout.tsx already loads. It is one
 * weight (400) and Satori does not synthesise bold, so the hierarchy here is
 * built from size, colour and letter-spacing rather than from weight.
 *
 * No data is read, so this route stays statically optimised: it is generated
 * once at build time and cannot fail at request time.
 */

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

export default function OpengraphImage() {
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
    { ...size }
  )
}
