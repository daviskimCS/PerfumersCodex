import { describe, expect, it } from 'vitest'

import { isAuthorizedCronRequest } from './cron'

describe('isAuthorizedCronRequest', () => {
  const secret = 'a-long-random-cron-secret'

  it('accepts the exact bearer header Vercel sends', () => {
    expect(isAuthorizedCronRequest(`Bearer ${secret}`, secret)).toBe(true)
  })

  it.each([
    ['no header', null],
    ['empty header', ''],
    ['the bare secret, no scheme', secret],
    ['a wrong secret', 'Bearer not-the-secret'],
    ['a prefix of the secret', `Bearer ${secret.slice(0, -1)}`],
    ['the secret plus a suffix', `Bearer ${secret}x`],
    ['a lowercase scheme', `bearer ${secret}`],
  ])('refuses %s', (_label, header) => {
    expect(isAuthorizedCronRequest(header, secret)).toBe(false)
  })

  it('refuses everything when no secret is configured', () => {
    expect(isAuthorizedCronRequest('Bearer ', undefined)).toBe(false)
    expect(isAuthorizedCronRequest('Bearer undefined', undefined)).toBe(false)
    expect(isAuthorizedCronRequest('Bearer ', '')).toBe(false)
  })
})
