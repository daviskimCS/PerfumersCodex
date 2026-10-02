import { describe, expect, it } from 'vitest'

import { safeInternalPath } from '@/lib/validation/auth'

/**
 * The open-redirect guard on every auth redirect. The rejection table is the
 * point: each entry is an input a browser would resolve to another origin if
 * it reached a Location header. Inputs are JS string literals, so `'\\'` is
 * one backslash and `'\t'` is a real tab — what `searchParams.get()` returns
 * for `%5C` and `%09`.
 */
describe('safeInternalPath', () => {
  it.each([
    '/',
    '/account',
    '/materials/iso-e-super',
    '/search?q=iso%20e',
    '/materials?family=amber&class=ketone',
    '/saved#top',
    '/materials/%5Cnot-a-backslash',
  ])('keeps the same-site path %j', (path) => {
    expect(safeInternalPath(path)).toBe(path)
  })

  it.each([
    // The cases the old `startsWith('/') && !startsWith('//')` let through.
    ['/\\evil.com', 'backslash after the slash'],
    ['/\\\\evil.com', 'two backslashes'],
    ['/\t/evil.com', 'tab between the slashes'],
    ['/\n/evil.com', 'newline between the slashes'],
    ['/\r/evil.com', 'carriage return between the slashes'],
    // The cases the old guard already refused, kept so they stay refused.
    ['//evil.com', 'protocol-relative'],
    ['///evil.com', 'triple slash'],
    ['https://evil.com', 'absolute URL'],
    ['\\\\evil.com', 'leading backslashes'],
    ['javascript:alert(1)', 'javascript: URL'],
    ['data:text/html,hi', 'data: URL'],
    ['evil.com', 'bare host'],
    ['', 'empty string'],
  ])('refuses %j (%s)', (path) => {
    expect(safeInternalPath(path)).toBeNull()
  })

  it('refuses null', () => {
    expect(safeInternalPath(null)).toBeNull()
  })

  it('keeps every accepted path on the same origin', () => {
    // The property the guard exists for, checked directly for a spread of
    // accepted inputs rather than trusted from the implementation.
    const site = 'https://www.perfumerscodex.com'
    for (const path of ['/account', '/a/b/../c', '/%2F%2Fevil.com']) {
      const safe = safeInternalPath(path)
      expect(safe).not.toBeNull()
      expect(new URL(safe as string, site).origin).toBe(site)
    }
  })
})
