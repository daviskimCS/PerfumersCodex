import { describe, expect, it } from 'vitest'

import {
  RECOVERY_WINDOW_SECONDS,
  hasPasswordSignIn,
  isRecentRecoverySession,
} from '@/lib/account/identity'

const identity = (provider: string) =>
  ({ provider }) as NonNullable<
    Parameters<typeof hasPasswordSignIn>[0]['identities']
  >[number]

describe('hasPasswordSignIn', () => {
  it.each([
    [['email'], true, 'email/password account'],
    [['google'], false, 'Google-only account (still has an email address)'],
    [['google', 'email'], true, 'Google linked to a password account'],
  ])('%j → %s (%s)', (providers, expected) => {
    expect(
      hasPasswordSignIn({
        identities: providers.map(identity),
        app_metadata: {},
      })
    ).toBe(expected)
  })

  it('falls back to app_metadata.providers when identities are absent', () => {
    expect(hasPasswordSignIn({ app_metadata: { providers: ['email'] } })).toBe(
      true
    )
    expect(hasPasswordSignIn({ app_metadata: { providers: ['google'] } })).toBe(
      false
    )
    expect(hasPasswordSignIn({ app_metadata: {} })).toBe(false)
  })
})

describe('isRecentRecoverySession', () => {
  const requested = '2026-10-12T10:00:00Z'
  const requestedS = Date.parse(requested) / 1000
  const now = requestedS + 120

  it('accepts an otp sign-in made after the reset was requested, within the window', () => {
    expect(
      isRecentRecoverySession(
        [{ method: 'otp', timestamp: requestedS + 60 }],
        requested,
        now
      )
    ).toBe(true)
  })

  it.each([
    [
      'a password session',
      [{ method: 'password', timestamp: now - 10 }],
      requested,
      now,
    ],
    [
      'an otp sign-in from before the reset request (e.g. signup confirmation)',
      [{ method: 'otp', timestamp: requestedS - 1 }],
      requested,
      now,
    ],
    [
      'no reset ever requested',
      [{ method: 'otp', timestamp: now - 10 }],
      null,
      now,
    ],
    [
      'an otp sign-in older than the window',
      [{ method: 'otp', timestamp: requestedS + 1 }],
      requested,
      requestedS + 2 + RECOVERY_WINDOW_SECONDS,
    ],
    [
      'a timestamp in the future',
      [{ method: 'otp', timestamp: now + 60 }],
      requested,
      now,
    ],
    ['bare RFC 8176 strings, which carry no time', ['otp'], requested, now],
    ['no amr claim at all', undefined, requested, now],
    [
      'an unparseable recovery_sent_at',
      [{ method: 'otp', timestamp: now - 10 }],
      'yesterday',
      now,
    ],
  ] as const)('refuses %s', (_label, amr, sentAt, at) => {
    expect(isRecentRecoverySession(amr, sentAt, at)).toBe(false)
  })
})
