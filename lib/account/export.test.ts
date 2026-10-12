import { describe, expect, it } from 'vitest'

import { EXPORT_FORMAT_VERSION, shapeAccountExport } from '@/lib/account/export'

const user = {
  id: 'user-1',
  email: 'reader@example.com',
  new_email: undefined,
  created_at: '2026-09-01T00:00:00Z',
  last_sign_in_at: '2026-10-01T00:00:00Z',
  email_confirmed_at: '2026-09-01T00:05:00Z',
  app_metadata: { providers: ['email', 'google'] },
  identities: [
    {
      id: 'i1',
      identity_id: 'i1',
      user_id: 'user-1',
      provider: 'google',
      created_at: '2026-09-02T00:00:00Z',
      last_sign_in_at: '2026-10-01T00:00:00Z',
      identity_data: {
        name: 'A Reader',
        email: 'reader@example.com',
        sub: 'g-123',
      },
    },
  ],
}

describe('shapeAccountExport', () => {
  const file = shapeAccountExport(
    user,
    [
      { material_id: 'm-pub', created_at: '2026-09-10T00:00:00Z' },
      { material_id: 'm-hidden', created_at: '2026-09-11T00:00:00Z' },
    ],
    [
      {
        material_id: 'm-pub',
        body: 'smells of cedar',
        created_at: '2026-09-10T00:00:00Z',
        updated_at: '2026-09-12T00:00:00Z',
      },
    ],
    [{ id: 'm-pub', slug: 'iso-e-super', canonicalName: 'Iso E Super' }],
    new Date('2026-10-12T00:00:00Z')
  )

  it('is versioned and dated', () => {
    expect(file.format).toBe('perfumers-codex-account-export')
    expect(file.formatVersion).toBe(EXPORT_FORMAT_VERSION)
    expect(file.exportedAt).toBe('2026-10-12T00:00:00.000Z')
  })

  it('carries the account record and what each provider supplied', () => {
    expect(file.account).toMatchObject({
      id: 'user-1',
      email: 'reader@example.com',
      pendingEmailChange: null,
      emailConfirmedAt: '2026-09-01T00:05:00Z',
    })
    expect(file.account.signInMethods).toEqual([
      {
        provider: 'google',
        linkedAt: '2026-09-02T00:00:00Z',
        lastSignInAt: '2026-10-01T00:00:00Z',
        profile: {
          name: 'A Reader',
          email: 'reader@example.com',
          sub: 'g-123',
        },
      },
    ])
  })

  it('keeps every row, naming only materials that are still published', () => {
    expect(file.savedMaterials).toEqual([
      {
        materialId: 'm-pub',
        slug: 'iso-e-super',
        name: 'Iso E Super',
        savedAt: '2026-09-10T00:00:00Z',
      },
      {
        materialId: 'm-hidden',
        slug: null,
        name: null,
        savedAt: '2026-09-11T00:00:00Z',
      },
    ])
    expect(file.notes).toEqual([
      {
        materialId: 'm-pub',
        slug: 'iso-e-super',
        name: 'Iso E Super',
        body: 'smells of cedar',
        createdAt: '2026-09-10T00:00:00Z',
        updatedAt: '2026-09-12T00:00:00Z',
      },
    ])
  })

  it('says what it leaves out rather than leaving the reader to guess', () => {
    expect(file.notIncluded.join(' ')).toMatch(/password/i)
    expect(file.notIncluded.join(' ')).toMatch(/search/i)
    expect(file.notIncluded.join(' ')).toMatch(/IP address/)
  })

  it('never contains a password hash or token field', () => {
    expect(JSON.stringify(file)).not.toMatch(
      /encrypted_password|access_token|refresh_token/
    )
  })
})
