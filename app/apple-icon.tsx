import { ImageResponse } from 'next/og'

/**
 * The iOS home-screen / pinned-tab icon, 180x180.
 *
 * SQUARE AND FULL-BLEED, unlike app/icon.svg. iOS applies its own squircle
 * mask and its own shadow, so an icon that arrives already rounded gets
 * rounded twice and shows a pale halo in the corners. The tile therefore fills
 * the canvas edge to edge and the mark is inset instead — roughly 62% of the
 * width, which is where Apple's own icon grid puts a glyph.
 *
 * The mark is the same open codex as app/icon.svg; see the long note there for
 * why it is drawn the way it is. It arrives as an SVG data URI rather than as
 * JSX because Satori (which is what `next/og` renders with) lays out flexbox
 * and text, not paths — an `<img>` is the supported way to get vector artwork
 * into an ImageResponse.
 *
 * No data is read here, so the route is statically optimised: generated once
 * at build time, with no request-time failure mode.
 */

// app/globals.css: brand (light) and chrome-foreground.
const BRAND = '#7c4726'
const MARK_INK = '#f6efe6'

const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><g fill="${MARK_INK}"><path d="M4.6 9.6 C7.4 6.9 11.8 7.2 15 9.8 L15 25.2 C11.8 22.6 7.4 22.3 4.6 25.0 Z"/><path d="M27.4 9.6 C24.6 6.9 20.2 7.2 17 9.8 L17 25.2 C20.2 22.6 24.6 22.3 27.4 25.0 Z"/></g></svg>`

const MARK_SRC = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString('base64')}`

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: BRAND,
      }}
    >
      {/*
          The mark's own artboard is 32 units wide and the pages span 23 of
          them, so rendering the artboard at 164px puts the glyph at 118px —
          65% of 180, with the rest as the margin iOS expects.

          A raw img, not next/image: next/image is a React component that needs
          the Next runtime, and Satori renders plain elements.
        */}
      <img src={MARK_SRC} width={164} height={164} alt="" />
    </div>,
    { ...size }
  )
}
