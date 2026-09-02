'use client'

import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * The homepage's search entry point.
 *
 * Coupled to `components/search-command.tsx` by an event name and nothing
 * else: it dispatches the documented `open-search` CustomEvent that the
 * palette publishes, and never imports, mounts, or reaches into it. That is
 * the whole point of the contract — the homepage cannot break the palette by
 * knowing too much about it.
 *
 * A plain anchor rather than `next/link`: the click almost never navigates,
 * so prefetching `/search` would be work done for nothing. With no JS the
 * anchor simply goes to `/search`, the server-rendered half of the same
 * feature. Modified clicks (⌘/ctrl/shift/alt, middle button) are left alone
 * so "open in a new tab" still means that.
 */
export function HomeSearchButton() {
  return (
    <Button asChild size="lg">
      <a
        href="/search"
        onClick={(event) => {
          if (
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          ) {
            return
          }
          event.preventDefault()
          window.dispatchEvent(new CustomEvent('open-search'))
        }}
      >
        <Search aria-hidden="true" />
        Search materials
      </a>
    </Button>
  )
}
