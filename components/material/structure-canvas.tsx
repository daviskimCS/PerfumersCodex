'use client'

import { useEffect, useState } from 'react'

import { loadRDKit } from './rdkit'
import { StructurePlate } from './structure-plate'

/**
 * The RDKit.js half of the structure viewer — the only component in the app
 * that draws a molecule.
 *
 * It is reached exclusively through `next/dynamic(..., { ssr: false })` in
 * `./structure.tsx`, so this file and everything it pulls in live in their own
 * async chunk. The 6.6 MB WASM payload is fetched by `loadRDKit()` inside an
 * effect — i.e. after mount, never during the initial page load (AGENTS.md:
 * "never in the critical path"; docs/cheminformatics.md: the Lighthouse budget
 * depends on it).
 *
 * Every failure path is quiet. A missing WASM asset, a WebAssembly-less
 * browser, or a SMILES string RDKit cannot parse all end at the same muted
 * line — never an error boundary. The structure diagram is context; the cited
 * data on the rest of the page is the actual reference, and it stands alone.
 */

/** Drawn at 2x the plate's CSS size so the vector has room for its labels. */
const DRAW_WIDTH = 640
const DRAW_HEIGHT = 480

type Phase = 'loading' | 'drawn' | 'unavailable'

/**
 * RDKit paints carbon skeletons in literal black, which disappears on the dark
 * palette. Swapping only pure black for `currentColor` lets the skeleton
 * inherit the page's ink in both modes while heteroatoms keep the CPK colours
 * a chemist expects to read.
 *
 * Also strips the XML prolog (RDKit emits one; it is invalid inside an HTML
 * body) and the fixed pixel dimensions, so the diagram scales with its plate.
 */
function adaptSvg(raw: string): string | null {
  const start = raw.indexOf('<svg')
  if (start === -1) return null

  const inked = raw.slice(start).replaceAll(/#000000/gi, 'currentColor')

  // Only the root <svg> loses its fixed dimensions; the viewBox stays, so the
  // drawing scales to the plate. Scoped to the opening tag because RDKit also
  // emits width/height on inner elements, and stripping those would collapse
  // them.
  const tagEnd = inked.indexOf('>')
  if (tagEnd === -1) return null
  const openTag = inked
    .slice(0, tagEnd)
    .replace(/\s(?:width|height)=(?:'[^']*'|"[^"]*")/g, '')

  return openTag + inked.slice(tagEnd)
}

export default function StructureCanvas({
  smiles,
  name,
}: {
  smiles: string
  name: string
}) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function draw() {
      const rdkit = await loadRDKit()
      if (cancelled) return

      const mol = rdkit.get_mol(smiles)
      try {
        if (mol === null || !mol.is_valid()) {
          throw new Error('RDKit could not parse this SMILES')
        }
        const drawn = adaptSvg(
          mol.get_svg_with_highlights(
            JSON.stringify({
              width: DRAW_WIDTH,
              height: DRAW_HEIGHT,
              backgroundColour: [0, 0, 0, 0],
              bondLineWidth: 1.4,
              addStereoAnnotation: true,
            })
          )
        )
        if (cancelled) return
        if (drawn === null) throw new Error('RDKit returned no SVG')
        setSvg(drawn)
        setPhase('drawn')
      } finally {
        mol?.delete()
      }
    }

    draw().catch(() => {
      if (!cancelled) setPhase('unavailable')
    })

    return () => {
      cancelled = true
    }
  }, [smiles])

  if (phase === 'unavailable') {
    return (
      <StructurePlate>
        <p className="px-4 text-center text-xs text-muted-foreground">
          Structure diagram unavailable. The SMILES string is on the Identity
          list below.
        </p>
      </StructurePlate>
    )
  }

  if (phase === 'loading' || svg === null) {
    return <StructurePlate busy />
  }

  return (
    <StructurePlate>
      <div
        role="img"
        aria-label={`Two-dimensional structure diagram of ${name}`}
        className="size-full text-foreground [&>svg]:size-full"
        // RDKit's own output, drawn from a SMILES string this app stored, then
        // narrowed by adaptSvg to the markup after `<svg`. No third-party or
        // user-supplied markup reaches this.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </StructurePlate>
  )
}
