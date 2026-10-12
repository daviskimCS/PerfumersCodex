'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { BookOpen, Droplet, ShieldCheck, SprayCan } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  MATERIAL_TAB_IDS,
  MATERIAL_TAB_LABELS,
  type MaterialTabId,
} from './tabs-config'

/**
 * The tabbed body of a material page.
 *
 * Panels arrive as *rendered server content* through the `panels` prop — each
 * one is a server component element created in `page.tsx`, rendered on the
 * server, and slotted into this client tree. So the whole tab body stays a
 * server render; only the switching is client work.
 *
 * URL-addressable both ways:
 * - inbound, `page.tsx` reads `?tab=` and passes it as `initialTab`, so a
 *   deep link or a reload lands on the right tab with the right HTML;
 * - outbound, switching rewrites `?tab=` with `window.history.replaceState`,
 *   which Next integrates with the router (app/getting-started/linking-and-
 *   navigating § Native History API). `replaceState`, not `pushState`: the tab
 *   is a view preference, and four tabs' worth of history entries would turn
 *   the browser's Back button into "undo my last glance".
 *
 * The bar is an underlined row with an icon per tab, not a muted pill: it is
 * the page's section navigation and has to read as one. On a phone the four
 * tabs split the width evenly, icon over label, so even a 320px screen fits
 * all four without scrolling. Nothing in it scrolls: the
 * old `overflow-x-auto` wrapper also made the box scroll vertically (CSS
 * computes `overflow-y: auto` beside it), and the active underline and focus
 * ring overflowed it by a few pixels, so the bar showed a scrollbar.
 */

const TAB_ICONS: Record<MaterialTabId, LucideIcon> = {
  safety: ShieldCheck,
  olfactive: SprayCan,
  usage: Droplet,
  sources: BookOpen,
}

interface MaterialTabsControl {
  /** Switch tabs; with an anchor, also jump to that element once it mounts. */
  show: (tab: MaterialTabId, anchorId?: string) => void
}

const MaterialTabsContext = createContext<MaterialTabsControl | null>(null)

/**
 * Null outside a `<MaterialTabs>` — citation superscripts are also legible on
 * their own, so consumers degrade to a plain link rather than throwing.
 */
export function useMaterialTabs(): MaterialTabsControl | null {
  return useContext(MaterialTabsContext)
}

/**
 * Scroll to a source entry and put focus on it, so following "[3]" by keyboard
 * lands the reader *at* source 3 rather than leaving them where they were.
 *
 * The retry is a safety net, not the mechanism: callers invoke this after
 * React has committed the newly-active panel, so the element normally exists
 * on the first try.
 */
function jumpToAnchor(anchorId: string, retries = 3): void {
  const element = document.getElementById(anchorId)
  if (element === null) {
    if (retries > 0) {
      requestAnimationFrame(() => jumpToAnchor(anchorId, retries - 1))
    }
    return
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({
    behavior: reduced ? 'auto' : 'smooth',
    block: 'center',
  })
  // The source entries carry tabIndex={-1} so this can land.
  element.focus({ preventScroll: true })
}

export function MaterialTabs({
  initialTab,
  panels,
}: {
  initialTab: MaterialTabId
  panels: Record<MaterialTabId, ReactNode>
}) {
  const [tab, setTab] = useState<MaterialTabId>(initialTab)

  /**
   * An anchor waiting for the panel that contains it.
   *
   * A ref rather than state: this is a one-shot instruction to the commit that
   * is already scheduled, not something the UI renders. Radix mounts a tab's
   * content only when that tab becomes active, so the target element does not
   * exist at click time — and the click also destroys the superscript the
   * reader clicked, which drops focus to `<body>`. Both are settled by the
   * time effects run, which is why the jump happens there.
   */
  const pendingAnchor = useRef<string | null>(null)

  useEffect(() => {
    const anchorId = pendingAnchor.current
    if (anchorId === null) return
    pendingAnchor.current = null
    jumpToAnchor(anchorId)
  }, [tab])

  const show = useCallback(
    (next: MaterialTabId, anchorId?: string) => {
      setTab(next)

      const url = new URL(window.location.href)
      url.searchParams.set('tab', next)
      url.hash = anchorId ? `#${anchorId}` : ''
      window.history.replaceState(
        null,
        '',
        `${url.pathname}${url.search}${url.hash}`
      )

      if (anchorId === undefined) return
      if (next === tab) {
        // Already on that panel, so no commit is coming to wait for.
        jumpToAnchor(anchorId)
      } else {
        pendingAnchor.current = anchorId
      }
    },
    [tab]
  )

  const control = useMemo<MaterialTabsControl>(() => ({ show }), [show])

  return (
    <MaterialTabsContext.Provider value={control}>
      <Tabs
        value={tab}
        onValueChange={(value) => show(value as MaterialTabId)}
        className="gap-6"
      >
        <TabsList
          variant="line"
          aria-label="Material sections"
          className="grid w-full grid-cols-4 gap-0 rounded-none border-b border-border p-0 group-data-horizontal/tabs:h-auto md:flex md:justify-start md:gap-6"
        >
          {MATERIAL_TAB_IDS.map((id) => {
            const Icon = TAB_ICONS[id]
            return (
              <TabsTrigger
                key={id}
                value={id}
                className="h-14 flex-none flex-col gap-1 rounded-none px-0 text-xs group-data-horizontal/tabs:after:bottom-[-1px] md:h-12 md:flex-row md:gap-2 md:text-base"
              >
                <Icon aria-hidden="true" strokeWidth={1.75} />
                {MATERIAL_TAB_LABELS[id]}
              </TabsTrigger>
            )
          })}
        </TabsList>
        {MATERIAL_TAB_IDS.map((id) => (
          <TabsContent key={id} value={id} className="text-base">
            {panels[id]}
          </TabsContent>
        ))}
      </Tabs>
    </MaterialTabsContext.Provider>
  )
}
