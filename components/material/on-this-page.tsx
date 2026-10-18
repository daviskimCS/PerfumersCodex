'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

/**
 * The links in a material page's "On this page" list, with the section being
 * read marked as current.
 *
 * The current section is the last one whose top has passed a line a third of
 * the way down the window (never above the page's scroll-padding, where a
 * followed link puts a section's top). Past the end of the last section, in
 * the computed properties below the sections, none is current.
 *
 * Following a link marks its section at once and holds it until the scroll
 * the link started has stopped, so the mark does not flick through the
 * sections in between, and a section whose top cannot reach the line (the
 * last one on a short page) still ends up marked.
 *
 * The links stay ordinary in-page links. The smooth scroll is the page's own
 * `scroll-behavior` (globals.css), so the address, history, and where Tab
 * goes next are the browser's, as before. Without JavaScript nothing is
 * marked and every link still works.
 */
export function OnThisPageLinks({
  sections,
}: {
  sections: readonly { id: string; label: string }[]
}) {
  const [current, setCurrent] = useState<string | null>(null)
  const follow = useRef<(id: string) => void>(undefined)

  useEffect(() => {
    const ids = sections.map(({ id }) => id)
    let frame = 0
    let hold: number | undefined

    const release = () => {
      hold = undefined
    }
    const holdFor = () => {
      window.clearTimeout(hold)
      hold = window.setTimeout(release, 150)
    }

    const measure = () => {
      frame = 0
      if (hold !== undefined) return

      const padding =
        parseFloat(
          getComputedStyle(document.documentElement).scrollPaddingTop
        ) || 0
      const line = Math.max(padding + 8, window.innerHeight / 3)

      let next: string | null = null
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top
        if (top !== undefined && top <= line) next = id
      }
      const last = document.getElementById(ids[ids.length - 1])
      if (last && last.getBoundingClientRect().bottom <= line) next = null

      setCurrent(next)
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure)
    }

    const onScroll = () => {
      if (hold !== undefined) holdFor()
      schedule()
    }
    follow.current = (id) => {
      setCurrent(id)
      holdFor()
    }
    // Back and Forward between sections land without a click on the list.
    const onHashChange = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (ids.includes(id)) follow.current?.(id)
    }

    schedule()

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('hashchange', onHashChange)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(hold)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [sections])

  return (
    <ul className="flex gap-5 overflow-x-auto py-3 text-sm md:mt-3 md:flex-col md:gap-2 md:overflow-visible md:border-l md:border-border md:py-0">
      {sections.map(({ id, label }) => {
        const isCurrent = id === current
        return (
          <li key={id} className="shrink-0">
            <a
              href={`#${id}`}
              aria-current={isCurrent ? 'true' : undefined}
              onClick={() => follow.current?.(id)}
              className={cn(
                'rounded-sm text-muted-foreground underline-offset-4 outline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring md:-ml-px md:block md:border-l-2 md:border-transparent md:pl-3',
                isCurrent &&
                  'text-foreground underline decoration-brand decoration-2 md:border-brand md:no-underline md:hover:underline md:hover:decoration-1'
              )}
            >
              {label}
            </a>
          </li>
        )
      })}
    </ul>
  )
}
