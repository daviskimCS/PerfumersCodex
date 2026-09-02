/**
 * Recent searches — the palette's memory (W4-B / P2-F).
 *
 * CLIENT-ONLY by construction. It touches `window.localStorage`, so it is only
 * ever imported by `components/search-command.tsx` (a `'use client'` module).
 * There is no `import 'client-only'` guard because that package is not a
 * declared dependency of this project and adding one needs the maker
 * (AGENTS.md); the try/catch below already turns a server-side call into an
 * empty list rather than a crash.
 *
 * Three rules run through every function here:
 *
 * 1. **Storage is allowed to fail.** Private windows, blocked cookies, a full
 *    quota, and a page served from `file://` all throw on plain
 *    `localStorage` access. Every touch is wrapped, and every failure degrades
 *    to "no recent searches" — search itself must never break because a
 *    convenience feature could not read a string.
 * 2. **What comes back out of storage is untrusted.** Another tab, an older
 *    build, or a user poking at devtools can leave anything under the key, so
 *    the parsed value is validated as an array of strings and re-normalized on
 *    every read rather than trusted because we wrote it.
 * 3. **Every function returns the new list** so the caller can set state from
 *    the return value instead of re-reading storage.
 */

/** Namespaced so it cannot collide with the `theme` key the layout writes. */
const STORAGE_KEY = 'perfumers-codex:recent-searches'

/** "last ~5 searches" (wave-4.md W4-B). Enough to be useful, short enough to scan. */
const MAX_ENTRIES = 5

/**
 * Nothing a person types into a search box is 200 characters long. The cap is
 * here so a pasted document can never sit in storage forever.
 */
const MAX_ENTRY_LENGTH = 200

/** The stored list, newest first. Always safe to call; never throws. */
export function readRecentSearches(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return normalize(parsed.filter((entry) => typeof entry === 'string'))
  } catch {
    // Unreadable, unparseable, or unavailable — all the same answer.
    return []
  }
}

/**
 * Record a search and return the updated list, newest first.
 *
 * Re-searching something already in the list moves it to the front rather than
 * adding a duplicate, which is what makes a five-item list stay useful.
 */
export function rememberSearch(query: string): string[] {
  const entry = query.trim()
  if (entry === '') return readRecentSearches()

  const next = normalize([entry, ...readRecentSearches()])

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // The list still applies to this page view; it just will not persist.
  }

  return next
}

/** Forget everything. Returns the (empty) list for symmetry with the others. */
export function clearRecentSearches(): string[] {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do — if it cannot be removed it also could not be read.
  }

  return []
}

/**
 * Trim, drop blanks, cap length, dedupe case-insensitively (searching "OTNE"
 * then "otne" is one memory, not two), and keep at most `MAX_ENTRIES`. Order is
 * preserved, so the caller controls recency by putting the newest first.
 */
function normalize(entries: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const entry of entries) {
    const trimmed = entry.trim().slice(0, MAX_ENTRY_LENGTH)
    if (trimmed === '') continue

    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    result.push(trimmed)
    if (result.length === MAX_ENTRIES) break
  }

  return result
}
