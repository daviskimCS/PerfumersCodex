'use client'

import { Hexagon, RotateCcw, Rotate3d } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import type { StructureConformer } from '@/lib/types'

import { StructurePlate } from './structure-plate'
import type { MoleculeViewer, Theme } from './viewer-3d'

type Mode = '2d' | 'loading' | '3d' | 'failed'

/**
 * "View in 3D" beneath the 2D drawing. `children` is the server-rendered 2D
 * plate, which stays the primary picture: it is what the page shows first,
 * and it stays mounted (hidden) while the model is up, so switching back is
 * instant.
 *
 * Nothing 3D is downloaded until the reader presses the button: then
 * `viewer-3d.ts`, and 3Dmol.js with it, arrive as one lazy chunk. The model
 * is the conformer the seed stored (`scripts/conformer.ts`), passed in as
 * text; the browser computes nothing. No auto-spin, so there is no motion
 * the reader did not start.
 */
export function Structure3d({
  conformer,
  name,
  children,
}: {
  conformer: StructureConformer
  name: string
  children: ReactNode
}) {
  const [mode, setMode] = useState<Mode>('2d')
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<MoleculeViewer | null>(null)
  const helpId = useId()
  const showing3d = mode !== '2d'

  // Mount the viewer the first time the model is asked for; keep it after.
  useEffect(() => {
    if (mode !== 'loading' || viewerRef.current !== null) return
    let cancelled = false
    import('./viewer-3d')
      .then(({ mountViewer }) => {
        const container = containerRef.current
        if (cancelled || container === null) return
        viewerRef.current = mountViewer(
          container,
          conformer.molfile,
          currentTheme()
        )
        setMode('3d')
      })
      .catch(() => {
        // A failed chunk download, or a browser without WebGL.
        if (!cancelled) setMode('failed')
      })
    return () => {
      cancelled = true
    }
  }, [mode, conformer.molfile])

  // Follow the theme toggle while the model is up.
  useEffect(() => {
    if (mode !== '3d') return
    const observer = new MutationObserver(() =>
      viewerRef.current?.setTheme(currentTheme())
    )
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    viewerRef.current?.setTheme(currentTheme())
    viewerRef.current?.resize()
    return () => observer.disconnect()
  }, [mode])

  useEffect(() => () => viewerRef.current?.destroy(), [])

  function toggle() {
    if (showing3d) setMode('2d')
    else setMode(viewerRef.current === null ? 'loading' : '3d')
  }

  return (
    <div className="flex flex-col gap-3">
      <div hidden={showing3d}>{children}</div>

      <div hidden={!showing3d}>
        <StructurePlate>
          <div
            className="relative size-full"
            // The page scrolls under a mouse wheel as it does everywhere else;
            // 3Dmol.js would otherwise take the wheel for zoom. Captured here,
            // before it reaches the canvas, and not prevented, so the scroll
            // itself goes ahead. Pinch and the + and − keys still zoom.
            onWheelCapture={(event) => event.stopPropagation()}
          >
            <div
              ref={containerRef}
              role="img"
              tabIndex={mode === '3d' ? 0 : -1}
              aria-label={`Three-dimensional ball-and-stick model of ${name}, including hydrogens`}
              aria-describedby={helpId}
              className="absolute inset-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring"
              onKeyDown={(event) => {
                if (viewerRef.current?.handleKey(event.key)) {
                  event.preventDefault()
                }
              }}
            />
            {mode === 'loading' || mode === 'failed' ? (
              <p
                role="status"
                className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted-foreground"
              >
                {mode === 'loading'
                  ? 'Loading the 3D model…'
                  : '3D view unavailable in this browser. The 2D drawing is unchanged.'}
              </p>
            ) : null}
          </div>
        </StructurePlate>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={toggle}>
          {showing3d ? (
            <>
              <Hexagon aria-hidden="true" />
              View in 2D
            </>
          ) : (
            <>
              <Rotate3d aria-hidden="true" />
              View in 3D
            </>
          )}
        </Button>
        {mode === '3d' ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => viewerRef.current?.reset()}
          >
            <RotateCcw aria-hidden="true" />
            Reset view
          </Button>
        ) : null}
      </div>

      {showing3d ? (
        <p
          id={helpId}
          className="text-xs leading-relaxed text-muted-foreground"
        >
          One computed low-energy shape, not the only one. Drag to rotate; arrow
          keys and + or − also work. Computed with OpenChemLib{' '}
          {conformer.openchemlibVersion}.
        </p>
      ) : null}
    </div>
  )
}

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}
