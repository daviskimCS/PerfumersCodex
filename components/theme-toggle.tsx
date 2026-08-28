'use client'

import * as React from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

// Tailwind needs to see whole class names, so the active styling is a literal
// per option rather than an interpolated string. `in-data-[…]` matches an
// ancestor — here <html>, whose data-theme-pref the inline script in
// app/layout.tsx sets before first paint. That is what keeps the active segment
// correct on load without waiting for hydration.
const OPTIONS = [
  {
    value: 'light',
    label: 'Light',
    Icon: Sun,
    activeClassName:
      'in-data-[theme-pref=light]:bg-secondary in-data-[theme-pref=light]:text-secondary-foreground',
  },
  {
    value: 'dark',
    label: 'Dark',
    Icon: Moon,
    activeClassName:
      'in-data-[theme-pref=dark]:bg-secondary in-data-[theme-pref=dark]:text-secondary-foreground',
  },
  {
    value: 'system',
    label: 'System',
    Icon: Monitor,
    activeClassName:
      'in-data-[theme-pref=system]:bg-secondary in-data-[theme-pref=system]:text-secondary-foreground',
  },
] as const satisfies ReadonlyArray<{
  value: ThemePreference
  label: string
  Icon: typeof Sun
  activeClassName: string
}>

function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). Following the
    // system is the right answer when we cannot know the choice.
    return 'system'
  }
}

/** Writes the same two attributes the inline head script in the layout writes. */
function applyPreference(preference: ThemePreference) {
  const root = document.documentElement
  const dark =
    preference === 'dark' ||
    (preference === 'system' && window.matchMedia(DARK_QUERY).matches)

  root.dataset.themePref = preference
  root.classList.toggle('dark', dark)
}

/* --------------------------------------------------------------------------
   The preference lives in localStorage, which is an external store — so it is
   read through useSyncExternalStore rather than mirrored into state. That gets
   the SSR/hydration story right for free: getServerSnapshot returns the same
   'system' the markup ships with, and React re-reads the real value once
   hydration finishes. No effect writing state, no hydration mismatch.
   -------------------------------------------------------------------------- */

let cachedPreference: ThemePreference | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange)

  // Another tab changed the choice — follow it here too.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return
    cachedPreference = readStoredPreference()
    applyPreference(cachedPreference)
    emit()
  }

  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(onStoreChange)
    window.removeEventListener('storage', onStorage)
  }
}

// Must return a stable value between changes, hence the cache.
function getSnapshot(): ThemePreference {
  cachedPreference ??= readStoredPreference()
  return cachedPreference
}

function getServerSnapshot(): ThemePreference {
  return 'system'
}

function selectPreference(next: ThemePreference) {
  cachedPreference = next
  applyPreference(next)

  try {
    if (next === 'system') window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Non-fatal: the choice applies to this page view, it just won't persist.
  }

  emit()
}

export function ThemeToggle() {
  // Only `aria-pressed` depends on this. The *visible* active segment is driven
  // by CSS off data-theme-pref, which the head script has already set correctly
  // at first paint — so the control never flashes the wrong state either.
  const preference = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  // While following the system, track it live rather than only at load.
  React.useEffect(() => {
    if (preference !== 'system') return

    const query = window.matchMedia(DARK_QUERY)
    const onChange = () => applyPreference('system')

    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [preference])

  return (
    <div
      role="group"
      aria-label="Theme"
      className="flex items-center gap-0.5 rounded-lg border border-border p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon, activeClassName }) => (
        <Button
          key={value}
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`${label} theme`}
          aria-pressed={preference === value}
          onClick={() => selectPreference(value)}
          className={cn('text-muted-foreground', activeClassName)}
        >
          <Icon aria-hidden="true" />
        </Button>
      ))}
    </div>
  )
}
