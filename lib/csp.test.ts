import { describe, expect, it } from 'vitest'

import { contentSecurityPolicy, createNonce } from '@/lib/csp'

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split('; ').map((part) => {
      const [name, ...values] = part.split(' ')
      return [name, values]
    })
  )
}

describe('contentSecurityPolicy', () => {
  it('runs only scripts that carry this request’s nonce', () => {
    const scripts = directives(
      contentSecurityPolicy({ nonce: 'abc123', pathname: '/' })
    ).get('script-src')
    expect(scripts).toEqual([
      "'self'",
      "'nonce-abc123'",
      "'strict-dynamic'",
      'https://challenges.cloudflare.com',
    ])
  })

  it('never allows inline scripts by default', () => {
    const policy = contentSecurityPolicy({ nonce: 'n', pathname: '/login' })
    expect(policy).not.toContain('unsafe-inline')
    expect(policy).not.toContain('unsafe-eval')
  })

  it('keeps the framing, base and plugin rules', () => {
    const policy = directives(
      contentSecurityPolicy({ nonce: 'n', pathname: '/' })
    )
    expect(policy.get('frame-ancestors')).toEqual(["'none'"])
    expect(policy.get('base-uri')).toEqual(["'self'"])
    expect(policy.get('object-src')).toEqual(["'none'"])
  })

  it.each([
    ['/structure', true],
    ['/structure/', false],
    ['/materials/iso-e-super', false],
    ['/account', false],
  ])('allows eval on %s: %s', (pathname, allowed) => {
    expect(
      contentSecurityPolicy({ nonce: 'n', pathname }).includes("'unsafe-eval'")
    ).toBe(allowed)
  })

  it('allows eval everywhere under next dev', () => {
    expect(
      contentSecurityPolicy({ nonce: 'n', pathname: '/', dev: true })
    ).toContain("'unsafe-eval'")
  })
})

describe('createNonce', () => {
  it('is fresh every time and safe inside a header value', () => {
    const nonces = new Set(Array.from({ length: 100 }, createNonce))
    expect(nonces.size).toBe(100)
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/)
  })
})
